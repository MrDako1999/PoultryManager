// Persistent ring buffer of structured error entries from the DB +
// sync layers. Persistence matters: the EMUI symptom we're chasing
// often only surfaces AFTER the app has been backgrounded / restarted,
// which is exactly when an in-memory buffer would have been wiped. We
// stash entries in MMKV (synchronous, fast, bounded by storage rather
// than RAM) so the long-press diagnostic on BatchesList can replay
// what happened across that lifecycle boundary.
//
// `react-native-mmkv` is already in `mobile/package.json` but wasn't
// initialised before this file. We open a dedicated `pm-error-log`
// store so the entries can't collide with anything else (auth tokens
// stay in expo-secure-store; this is purely a dev/QA observability
// tool that's also safe to ship to users).
//
// All exported helpers are non-throwing: a failure here MUST NOT
// cascade into the caller's error path (we'd just end up logging the
// failure-to-log).

import { MMKV } from 'react-native-mmkv';
import { isNativeHandleError } from './errorClassify';

const STORE_ID = 'pm-error-log';
const KEY = 'entries';
const MAX_ENTRIES = 50;

let _storage = null;

function getStorage() {
  if (_storage) return _storage;
  try {
    _storage = new MMKV({ id: STORE_ID });
  } catch (err) {
    // MMKV can fail to initialise on dev clients without the native
    // module linked (Expo Go) — fall back to an in-memory shim that
    // implements the tiny subset we use here so callers don't have to
    // null-check.
    console.warn('[errorBuffer] MMKV init failed, falling back to in-memory:', err?.message);
    let mem = '';
    _storage = {
      getString: () => mem,
      set: (_k, v) => { mem = v; },
      delete: () => { mem = ''; },
    };
  }
  return _storage;
}

function readEntries() {
  try {
    const raw = getStorage().getString(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    // Corrupt JSON in MMKV is fine to discard — the buffer is
    // best-effort.
    return [];
  }
}

function writeEntries(entries) {
  try {
    getStorage().set(KEY, JSON.stringify(entries));
  } catch (err) {
    // MMKV writes basically can't fail unless the device is wedged
    // beyond recovery, but still don't surface it.
    console.warn('[errorBuffer] write failed:', err?.message);
  }
}

/**
 * Classify an error into one of the buckets we care about for
 * triage. `kind` overrides the auto-classification when the caller
 * already knows (e.g. useLocalQuery knows it caught a JSON.parse).
 */
function classify(err, kind) {
  if (kind) return kind;
  if (isNativeHandleError(err)) return 'native_handle';
  const msg = String(err?.message || err || '');
  if (/Network Error|ECONNABORTED|ERR_NETWORK|timeout/i.test(msg)) return 'network';
  if (/JSON|Unexpected token|Unexpected end of/i.test(msg)) return 'json_parse';
  if (/no such table|no such column/i.test(msg)) return 'schema';
  return 'other';
}

/**
 * Push an error onto the ring buffer. Best-effort — never throws.
 *
 * @param {string} source - 'getDb' | 'syncEngine' | 'useLocalQuery' |
 *   'useLocalRecord' | 'mutationQueue' | string
 * @param {Error|string} err
 * @param {string} [kind] - optional explicit classification
 * @param {object} [extra] - optional small key/value bag (e.g.
 *   { table: 'batches' }) that gets stringified into the entry
 */
export function recordError(source, err, kind, extra) {
  try {
    const entry = {
      ts: new Date().toISOString(),
      source: String(source || 'unknown').slice(0, 32),
      kind: classify(err, kind),
      message: String(err?.message || err || '').slice(0, 500),
    };
    // Only the first frame — full stacks are too big to be useful in
    // the in-app diagnostic and chew through MMKV space fast.
    if (err?.stack) {
      const firstFrame = String(err.stack).split('\n')[1];
      if (firstFrame) entry.stack = firstFrame.trim().slice(0, 200);
    }
    if (extra && typeof extra === 'object') {
      const compact = {};
      for (const [k, v] of Object.entries(extra)) {
        compact[k] = String(v).slice(0, 80);
      }
      entry.extra = compact;
    }

    const entries = readEntries();
    entries.push(entry);
    // Drop the oldest entries when we exceed the cap. Slice from the
    // tail so the buffer stays a true ring.
    const trimmed = entries.length > MAX_ENTRIES
      ? entries.slice(entries.length - MAX_ENTRIES)
      : entries;
    writeEntries(trimmed);
  } catch (innerErr) {
    console.warn('[errorBuffer] recordError failed:', innerErr?.message);
  }
}

/**
 * Read the most recent entries in reverse-chronological order.
 * Defaults to the last 20 — that's what fits comfortably in the
 * Batches diagnostic Alert on a typical phone screen.
 */
export function getRecentErrors(n = 20) {
  const entries = readEntries();
  if (entries.length <= n) return [...entries].reverse();
  return entries.slice(entries.length - n).reverse();
}

/** Wipe the buffer. Used by the diagnostic's "Clear error log" button. */
export function clearErrorBuffer() {
  try {
    getStorage().delete(KEY);
  } catch (err) {
    console.warn('[errorBuffer] clear failed:', err?.message);
  }
}

/** Total number of entries currently retained (for the diagnostic header). */
export function getErrorBufferSize() {
  return readEntries().length;
}
