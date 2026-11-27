// Shared pieces of the pages: top bar, refresh button, sync line, stanza card, long lists, snackbar, dialog.

import { h, icon, clear, formatMillis, ltr } from './dom.js';
import { S } from '../strings.js';
import * as store from '../data/store.js';
import { Kind } from '../data/api.js';
import * as nav from './nav.js';
import { highlight } from '../core/search.js';
import { shareStanza } from './share.js';

// ------------------------------------------------------------------ page frame

/** A page with the centred top bar (back arrow on the reading-start side, actions on the other side). */
export function pageFrame({ title, back = true, actions = [], cls = '' }) {
  const titleEl = h('h1', { class: 'topbar-title' }, title);
  const bar = h('header', { class: 'topbar' },
    back
      ? h('button', { class: 'icon-btn flip', 'aria-label': S.back, onclick: () => nav.back() }, icon('back'))
      : h('span'),
    titleEl,
    h('div', { class: 'topbar-actions' }, actions),
  );
  const scroller = h('div', { class: 'scroller' });
  const el = h('section', { class: `page ${cls}` }, bar, scroller);
  return { el, scroller, titleEl, bar };
}

export function errorText(e) {
  const kind = e && e.kind;
  if (kind === Kind.OFFLINE || kind === Kind.TIMEOUT) return S.err_network;
  if (kind === Kind.SERVER) return S.err_server;
  return S.err_generic;
}

// ------------------------------------------------------------------ online state
export function isOnline() {
  return navigator.onLine !== false;
}

const onlineListeners = new Set();
export function onOnlineChange(fn) {
  onlineListeners.add(fn);
  return () => onlineListeners.delete(fn);
}
window.addEventListener('online', () => onlineListeners.forEach((fn) => fn(true)));
window.addEventListener('offline', () => onlineListeners.forEach((fn) => fn(false)));

// ------------------------------------------------------------------ refresh button and sync line

/**
 * The refresh button of the top bar. It always takes the same space: while a refresh runs the icon becomes a spinner
 * of the same size and the button is disabled (also while offline). The result of a refresh the person asked for is
 * shown in a short message.
 */
export function refreshButton(onDone) {
  const btn = h('button', { class: 'icon-btn', 'aria-label': S.sync_now });
  const paint = () => {
    clear(btn);
    btn.append(store.sync.running ? h('span', { class: 'spinner' }) : icon('refresh'));
    btn.disabled = store.sync.running || !isOnline();
  };
  btn.addEventListener('click', () => {
    store.syncNow()
      .then(() => { snackbar(S.sync_done); if (onDone) onDone(); })
      .catch((e) => snackbar(errorText(e)));
    paint();
  });
  paint();
  const off1 = store.on('sync', paint);
  const off2 = onOnlineChange(paint);
  btn.dispose = () => { off1(); off2(); };
  return btn;
}

/** "وروستی تازه کېدل: …" — one line of constant height. */
export function syncLine() {
  const el = h('div', { class: 'sync-line' });
  const paint = () => {
    if (store.sync.running) el.textContent = S.syncing;
    else if (store.sync.lastSyncAt) { clear(el).append(S.sync_last(''), ltr(formatMillis(store.sync.lastSyncAt))); }
    else el.textContent = S.sync_never;
  };
  paint();
  const off = store.on('sync', paint);
  el.dispose = off;
  return el;
}

export function emptyState(text) {
  return h('div', { class: 'empty' }, text);
}

// ------------------------------------------------------------------ stanza card

/**
 * One tappa / kakṛai ghaṛai in its own bordered card, with the heart, the clock ("نوبت", optional) and the share
 * button in the corner. highlightWords (comparing form) are painted where they occur.
 */
export function stanzaCard({ text, slug, letter, highlightWords = [], resume = true, onHeart = null }) {
  const p = h('p', { class: 'card-text' });
  if (highlightWords.length) {
    let at = 0;
    for (const span of highlight(text, highlightWords)) {
      if (span.start > at) p.append(text.slice(at, span.start));
      p.append(h('mark', null, text.slice(span.start, span.end)));
      at = span.end;
    }
    if (at < text.length) p.append(text.slice(at));
  } else {
    p.textContent = text;
  }

  const heart = h('button', { class: 'mark-btn' });
  heart.addEventListener('click', () => {
    if (onHeart) onHeart();
    else store.setFavorite(slug, text, letter, !store.isFavorite(slug, text));
  });
  const marks = h('div', { class: 'card-marks' }, heart);

  let clock = null;
  if (resume) {
    clock = h('button', { class: 'mark-btn' }, icon('history'));
    clock.addEventListener('click', () => {
      const r = store.getResume(slug);
      if (r && r.body === text) store.clearResume(slug);
      else store.setResume(slug, text, letter);
    });
    marks.append(clock);
  }
  const share = h('button', { class: 'mark-btn', 'aria-label': S.share_button }, icon('share'));
  share.addEventListener('click', () => shareStanza(text, slug));
  marks.append(share);

  const card = h('article', { class: 'card', dataset: { slug } }, p, marks);
  card._text = text;
  card._paint = () => {
    const fav = store.isFavorite(slug, text);
    clear(heart).append(icon(fav ? 'heart' : 'heartOutline'));
    heart.classList.toggle('fav-on', fav);
    heart.setAttribute('aria-label', fav ? S.favorite_remove : S.favorite_add);
    if (clock) {
      const r = store.getResume(slug);
      const isResume = !!r && r.body === text;
      clock.classList.toggle('resume-on', isResume);
      clock.setAttribute('aria-label', isResume ? S.resume_clear : S.resume_set);
      card.classList.toggle('is-resume', isResume);
    }
  };
  card._paint();
  return card;
}

/** Repaints the hearts and clocks of every card of a genre that is in a page (after a tap anywhere). */
store.on('marks', ({ slug }) => {
  for (const card of document.querySelectorAll('.card')) {
    if (card.dataset.slug === slug && card._paint) card._paint();
  }
});

// ------------------------------------------------------------------ long lists

/**
 * Fills `container` with cards for `items`, a few dozen at a time while the reader scrolls (a letter or a search can
 * hold thousands of stanzas). ensure(i) makes sure item i exists and returns its element.
 */
export function lazyList(container, scroller, items, makeCard, { first = 40, step = 60 } = {}) {
  const nodes = [];
  const sentinel = h('div', { class: 'list-sentinel' });
  container.append(sentinel);
  const more = (upTo) => {
    const end = Math.min(items.length, upTo);
    const frag = document.createDocumentFragment();
    for (let i = nodes.length; i < end; i++) {
      const node = makeCard(items[i], i);
      nodes.push(node);
      frag.append(node);
    }
    container.insertBefore(frag, sentinel);
    if (nodes.length >= items.length) { observer.disconnect(); sentinel.remove(); }
  };
  const observer = new IntersectionObserver((list) => {
    if (list.some((e) => e.isIntersecting)) more(nodes.length + step);
  }, { root: scroller, rootMargin: '0px 0px 1200px 0px' });
  more(first);
  if (nodes.length < items.length) observer.observe(sentinel);
  return {
    ensure(i) { if (i >= nodes.length) more(i + step); return nodes[i] || null; },
    get count() { return nodes.length; },
    dispose() { observer.disconnect(); },
  };
}

// ------------------------------------------------------------------ snackbar

let snackTimer = null;
let snackDone = null;

/** A short message at the bottom. With an action (e.g. "بېرته") the promise says whether it was pressed. */
export function snackbar(text, action) {
  const bar = document.getElementById('snackbar');
  if (snackDone) snackDone(false);
  clearTimeout(snackTimer);
  clear(bar);
  bar.append(h('span', null, text));
  return new Promise((resolve) => {
    snackDone = (pressed) => {
      snackDone = null;
      clearTimeout(snackTimer);
      bar.hidden = true;
      resolve(pressed);
    };
    if (action) bar.append(h('button', { onclick: () => snackDone && snackDone(true) }, action));
    bar.hidden = false;
    bar.classList.remove('show');
    void bar.offsetWidth;
    bar.classList.add('show');
    snackTimer = setTimeout(() => snackDone && snackDone(false), action ? 4000 : 2800);
  });
}

// ------------------------------------------------------------------ dialog

export function confirmDialog({ title, message, confirm, cancel = S.admin_cancel, danger = false }) {
  return new Promise((resolve) => {
    const done = (v) => { scrim.remove(); resolve(v); };
    const scrim = h('div', { class: 'dialog-scrim', onclick: (e) => { if (e.target === scrim) done(false); } },
      h('div', { class: 'dialog', role: 'alertdialog', 'aria-modal': 'true' },
        h('h2', null, title),
        h('p', null, message),
        h('div', { class: 'actions' },
          h('button', { class: 'btn btn-text', onclick: () => done(false) }, cancel),
          h('button', { class: `btn btn-text${danger ? ' danger' : ''}`, onclick: () => done(true) }, confirm),
        ),
      ),
    );
    document.body.append(scrim);
  });
}

export function uuid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const hex = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
