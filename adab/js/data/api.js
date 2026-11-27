// Thin client for the Supabase REST (PostgREST) endpoints, the public part of data/remote/SupabaseApi.kt of the
// Android app. Only the PUBLIC publishable key is used, in the "apikey" header (it is not a JWT, so it is never sent
// as a Bearer token). What it may do is decided by Row Level Security on the server: read genres, published entries
// and notifications; insert a pending contribution; insert a report. Nothing else.

import { SUPABASE_URL, SUPABASE_KEY } from '../config.js';

export const Kind = Object.freeze({
  OFFLINE: 'OFFLINE', TIMEOUT: 'TIMEOUT', UNAUTHORIZED: 'UNAUTHORIZED', FORBIDDEN: 'FORBIDDEN',
  CONFLICT: 'CONFLICT', NOT_FOUND: 'NOT_FOUND', BAD_REQUEST: 'BAD_REQUEST', SERVER: 'SERVER', UNKNOWN: 'UNKNOWN',
});

export class ApiError extends Error {
  constructor(kind, message, status = 0) {
    super(message);
    this.kind = kind;
    this.status = status;
  }
}

const TIMEOUT_MS = 30000;

function kindOf(status) {
  if (status === 401) return Kind.UNAUTHORIZED;
  if (status === 403) return Kind.FORBIDDEN;
  if (status === 404) return Kind.NOT_FOUND;
  if (status === 409) return Kind.CONFLICT;
  if (status === 400 || status === 422) return Kind.BAD_REQUEST;
  if (status >= 500) return Kind.SERVER;
  return Kind.UNKNOWN;
}

async function send(path, { params = [], method = 'GET', body, prefer } = {}) {
  const url = new URL(SUPABASE_URL.replace(/\/+$/, '') + path);
  for (const [k, v] of params) url.searchParams.append(k, v);
  const headers = { apikey: SUPABASE_KEY, Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json; charset=utf-8';
  if (prefer) headers.Prefer = prefer;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let response;
  try {
    response = await fetch(url.toString(), {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
      cache: 'no-store',
    });
  } catch (e) {
    if (e && e.name === 'AbortError') throw new ApiError(Kind.TIMEOUT, 'timeout');
    throw new ApiError(Kind.OFFLINE, (e && e.message) || 'network error');
  } finally {
    clearTimeout(timer);
  }
  let text;
  try {
    text = await response.text();
  } catch (e) {
    throw new ApiError(Kind.OFFLINE, 'network error');
  }
  if (response.ok) return text;
  let message = '';
  try {
    const o = JSON.parse(text);
    message = o.message || o.error_description || o.msg || '';
  } catch (e) {
    message = text.slice(0, 200);
  }
  throw new ApiError(kindOf(response.status), message || `HTTP ${response.status}`, response.status);
}

function parseArray(text) {
  const value = JSON.parse(text);
  if (!Array.isArray(value)) throw new ApiError(Kind.UNKNOWN, 'not a list');
  return value;
}

/**
 * One page of entries (tombstones included) after the given keyset position, oldest change first.
 * afterId is only used together with afterUpdatedAt.
 */
export async function fetchEntriesPage(afterUpdatedAt, afterId, limit) {
  const params = [
    ['select', 'id,genre_id,body,letter,status,version,created_at,updated_at'],
    ['order', 'updated_at.asc,id.asc'],
    ['limit', String(limit)],
  ];
  if (afterUpdatedAt) {
    if (afterId) {
      params.push(['or', `(updated_at.gt.${afterUpdatedAt},and(updated_at.eq.${afterUpdatedAt},id.gt.${afterId}))`]);
    } else {
      params.push(['updated_at', `gt.${afterUpdatedAt}`]);
    }
  }
  return parseArray(await send('/rest/v1/literature_entries', { params })).map((o) => ({
    id: String(o.id),
    genreId: String(o.genre_id),
    body: o.body == null ? '' : String(o.body),
    letter: String(o.letter),
    status: String(o.status),
    version: Number(o.version),
    createdAt: String(o.created_at),
    updatedAt: String(o.updated_at),
  }));
}

/** The administrator's publications, newest first (public). */
export async function fetchNotifications(limit) {
  const params = [
    ['select', 'id,title,message,created_at'],
    ['order', 'created_at.desc'],
    ['limit', String(limit)],
  ];
  return parseArray(await send('/rest/v1/notifications', { params })).map((o) => ({
    id: String(o.id),
    title: String(o.title),
    message: o.message == null ? '' : String(o.message),
    createdAt: String(o.created_at),
  }));
}

/**
 * Sends a contribution. The id is made by the app, so a retry can never create a second row. Returns normally only
 * when the server stored it (201) or already has this very contribution (409).
 */
export async function submitContribution(id, genreId, body) {
  try {
    await send('/rest/v1/contributions', {
      method: 'POST', prefer: 'return=minimal', body: { id, genre_id: genreId, body },
    });
  } catch (e) {
    if (!(e instanceof ApiError) || e.kind !== Kind.CONFLICT) throw e;
  }
}

/** Sends a report to the administrator; same rules as a contribution. */
export async function submitReport(id, kind, body, appVersion) {
  try {
    await send('/rest/v1/reports', {
      method: 'POST', prefer: 'return=minimal', body: { id, kind, body, app_version: appVersion },
    });
  } catch (e) {
    if (!(e instanceof ApiError) || e.kind !== Kind.CONFLICT) throw e;
  }
}

/** A server timestamp as epoch milliseconds (also with 6 decimals, which Safari's Date.parse refuses); NaN if unreadable. */
export function parseTime(iso) {
  if (typeof iso !== 'string') return NaN;
  let s = iso.trim().replace(' ', 'T').replace(/(\.\d{3})\d+/, '$1');
  if (/[+-]\d{2}$/.test(s)) s += ':00';
  return Date.parse(s);
}
