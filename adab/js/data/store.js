// Everything the screens read, kept in memory and saved in the phone's storage (db.js). This is the web counterpart of
// the Android repositories: LiteratureRepository (cache + incremental sync), ReadingStateRepository (favorites,
// reading place), NotificationRepository (the user's own list) and the SyncManager status.
//
// The screens only ever read from here. The network only fills it, and only when asked: once at app start, by the
// refresh buttons, and when the app comes back after more than 6 hours (the web has no background job).

import * as api from './api.js';
import * as db from './db.js';
import { canonical } from '../core/alphabet.js';
import { GENRES, genreBySlug } from '../core/content.js';

const PAGE_SIZE = 500;
const OVERLAP_MS = 2 * 60 * 1000;
const NOTIF_LIMIT = 500;
const NOTIF_GRACE_MS = 2 * 60 * 1000;
const KEY_CURSOR = 'entries_cursor_updated_at';
const KEY_LAST_SYNC = 'last_sync_at';
const KEY_NOTIF_FIRST = 'notifications_first_sync_done';

const entries = new Map(); // id -> {id, genreId, body, letter, isDeleted, version, createdAt, updatedAt}
const favorites = new Map(); // "slug|body" -> {key, slug, body, letter, savedAt}
const resumes = new Map(); // slug -> {slug, letter, body, savedAt}
const inbox = new Map(); // id -> {id, title, message, createdAtMs, isRead, isDismissed}
const meta = new Map();

export const sync = { running: false, lastSyncAt: null, lastError: null };

// ------------------------------------------------------------------ change events
const listeners = new Map();
export function on(topic, fn) {
  if (!listeners.has(topic)) listeners.set(topic, new Set());
  listeners.get(topic).add(fn);
  return () => listeners.get(topic).delete(fn);
}
function emit(topic, detail) {
  const set = listeners.get(topic);
  if (set) for (const fn of [...set]) { try { fn(detail); } catch (e) { console.error(e); } }
}

// ------------------------------------------------------------------ start
export async function load() {
  const [e, f, r, n, m] = await Promise.all([
    db.getAll('entries'), db.getAll('favorites'), db.getAll('resume'), db.getAll('inbox'), db.getAll('meta'),
  ]);
  for (const row of e) entries.set(row.id, row);
  for (const row of f) favorites.set(row.key, row);
  for (const row of r) resumes.set(row.slug, row);
  for (const row of n) inbox.set(row.id, row);
  for (const row of m) meta.set(row.key, row.value);
  const last = Number(meta.get(KEY_LAST_SYNC));
  sync.lastSyncAt = Number.isFinite(last) && last > 0 ? last : null;
}

// ------------------------------------------------------------------ reading (always from memory)
function byCreated(a, b) {
  if (a.createdAt < b.createdAt) return -1;
  if (a.createdAt > b.createdAt) return 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/** Every published entry of a genre (all letters), oldest first, like the Android query. */
export function entriesOfGenre(slug) {
  const genre = genreBySlug(slug);
  if (!genre) return [];
  const out = [];
  for (const e of entries.values()) if (!e.isDeleted && e.genreId === genre.id) out.push(e);
  return out.sort(byCreated);
}

export function entriesOf(slug, letter) {
  return entriesOfGenre(slug).filter((e) => e.letter === letter);
}

/** How many entries each letter of a genre has. */
export function letterCounts(slug) {
  const counts = new Map();
  for (const e of entriesOfGenre(slug)) counts.set(e.letter, (counts.get(e.letter) || 0) + 1);
  return counts;
}

export function hasAnyEntries() {
  for (const e of entries.values()) if (!e.isDeleted) return true;
  return false;
}

// ------------------------------------------------------------------ synchronisation
let running = null;

/** Brings the cache up to date with the server. Several calls at once share one run. Rejects with an ApiError. */
export function syncNow() {
  if (running) return running;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return Promise.reject(new api.ApiError(api.Kind.OFFLINE, 'offline'));
  }
  sync.running = true;
  emit('sync');
  running = (async () => {
    try {
      const changed = await syncEntries();
      const now = Date.now();
      meta.set(KEY_LAST_SYNC, String(now));
      await db.write({ meta: [{ key: KEY_LAST_SYNC, value: String(now) }] }).catch(() => {});
      sync.lastSyncAt = now;
      sync.lastError = null;
      if (changed) emit('entries');
      // The notification list is refreshed in the same run; its own failure never fails the literature sync.
      await syncNotificationsQuietly();
    } catch (e) {
      sync.lastError = e;
      throw e;
    } finally {
      sync.running = false;
      running = null;
      emit('sync');
    }
  })();
  return running;
}

function overlapped(ts) {
  const ms = api.parseTime(ts);
  return Number.isFinite(ms) ? new Date(ms - OVERLAP_MS).toISOString() : ts;
}

async function syncEntries() {
  const stored = meta.get(KEY_CURSOR);
  let afterTs = stored ? overlapped(stored) : null;
  let afterId = null;
  let changed = false;
  for (;;) {
    const page = await api.fetchEntriesPage(afterTs, afterId, PAGE_SIZE);
    if (page.length === 0) break;
    const last = page[page.length - 1];
    const rows = [];
    for (const r of page) {
      const local = entries.get(r.id);
      if (local && local.version > r.version) continue; // never older than what is here
      const isDeleted = r.status === 'deleted';
      rows.push({
        id: r.id,
        genreId: r.genreId,
        body: isDeleted ? '' : r.body,
        // An old entry may carry a yeh form that is no letter of the alphabet any more: it is shown under ي.
        letter: canonical(r.letter),
        isDeleted,
        version: r.version,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      });
    }
    for (const row of rows) entries.set(row.id, row);
    meta.set(KEY_CURSOR, last.updatedAt);
    // Progress is saved after every page, so an interrupted sync goes on where it stopped.
    await db.write({ entries: rows, meta: [{ key: KEY_CURSOR, value: last.updatedAt }] }).catch(() => {});
    if (rows.length > 0) changed = true;
    afterTs = last.updatedAt;
    afterId = last.id;
    if (page.length < PAGE_SIZE) break;
  }
  return changed;
}

// ------------------------------------------------------------------ favorites ("خوښ شوي", this phone only)
const favKey = (slug, body) => `${slug}|${body}`;

export function isFavorite(slug, body) {
  return favorites.has(favKey(slug, body));
}

/** Newest first, like the Android list. */
export function favoritesOf(slug) {
  const out = [];
  for (const f of favorites.values()) if (f.slug === slug) out.push(f);
  return out.sort((a, b) => (b.savedAt - a.savedAt) || (a.body < b.body ? -1 : a.body > b.body ? 1 : 0));
}

export function favoriteCount(slug) {
  let n = 0;
  for (const f of favorites.values()) if (f.slug === slug) n++;
  return n;
}

export function setFavorite(slug, body, letter, isOn, savedAt = Date.now()) {
  const key = favKey(slug, body);
  if (isOn) {
    const row = { key, slug, body, letter, savedAt };
    favorites.set(key, row);
    db.write({ favorites: [row] }).catch(() => {});
  } else {
    favorites.delete(key);
    db.write({}, { favorites: [key] }).catch(() => {});
  }
  emit('marks', { slug });
}

// ------------------------------------------------------------------ reading place ("نوبت", one per genre)
export function getResume(slug) {
  return resumes.get(slug) || null;
}

export function setResume(slug, body, letter) {
  const row = { slug, letter, body, savedAt: Date.now() };
  resumes.set(slug, row);
  db.write({ resume: [row] }).catch(() => {});
  emit('marks', { slug });
}

export function clearResume(slug) {
  resumes.delete(slug);
  db.write({}, { resume: [slug] }).catch(() => {});
  emit('marks', { slug });
}

// ------------------------------------------------------------------ the user's notification list
export function visibleNotifications() {
  const out = [];
  for (const n of inbox.values()) if (!n.isDismissed) out.push(n);
  return out.sort((a, b) => (b.createdAtMs - a.createdAtMs) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

export function notification(id) {
  const n = inbox.get(id);
  return n && !n.isDismissed ? n : null;
}

export function unreadCount() {
  let c = 0;
  for (const n of inbox.values()) if (!n.isDismissed && !n.isRead) c++;
  return c;
}

function saveInbox(rows) {
  db.write({ inbox: rows }).catch(() => {});
  emit('inbox');
}

export function markRead(id) {
  const n = inbox.get(id);
  if (!n || n.isRead) return;
  n.isRead = true;
  saveInbox([n]);
}

/** Hides one notification in THIS list only; the publication stays on the server for everybody else. */
export function dismiss(id) {
  const n = inbox.get(id);
  if (!n) return;
  n.isDismissed = true;
  n.isRead = true;
  saveInbox([n]);
}

export function dismissAll() {
  const rows = [];
  for (const n of inbox.values()) {
    if (!n.isDismissed) {
      n.isDismissed = true;
      n.isRead = true;
      rows.push(n);
    }
  }
  if (rows.length) saveInbox(rows);
}

/**
 * New publications are added (unread), publications the administrator deleted are removed. The first run adds the
 * existing history as already read, so a new user does not start with a badge for old news.
 */
export async function syncNotifications() {
  const startedAt = Date.now();
  const remote = await api.fetchNotifications(NOTIF_LIMIT);
  const firstRun = !meta.has(KEY_NOTIF_FIRST);
  const added = [];
  for (const r of remote) {
    if (inbox.has(r.id)) continue;
    const ms = api.parseTime(r.createdAt);
    const row = {
      id: r.id, title: r.title, message: r.message,
      createdAtMs: Number.isFinite(ms) ? ms : startedAt,
      isRead: firstRun, isDismissed: false,
    };
    inbox.set(row.id, row);
    added.push(row);
  }
  const gone = [];
  if (remote.length < NOTIF_LIMIT) {
    const onServer = new Set(remote.map((r) => r.id));
    for (const n of inbox.values()) {
      if (!onServer.has(n.id) && n.createdAtMs < startedAt - NOTIF_GRACE_MS) gone.push(n.id);
    }
    for (const id of gone) inbox.delete(id);
  }
  const metaRows = [];
  if (firstRun) {
    meta.set(KEY_NOTIF_FIRST, String(startedAt));
    metaRows.push({ key: KEY_NOTIF_FIRST, value: String(startedAt) });
  }
  await db.write({ inbox: added, meta: metaRows }, { inbox: gone }).catch(() => {});
  if (added.length || gone.length) emit('inbox');
}

export async function syncNotificationsQuietly() {
  try {
    await syncNotifications();
  } catch (e) {
    // Offline, or the server part is not there yet: the list on the phone stays as it is.
  }
}

export { GENRES };
