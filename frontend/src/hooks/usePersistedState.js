import { useState, useCallback, useRef } from 'react';

/**
 * useState that persists to localStorage.
 * Dates are serialized as ISO strings and revived on read.
 *
 * @param {string} key - localStorage key
 * @param {*} initialValue - default value when nothing stored
 * @param {object} [opts]
 * @param {boolean} [opts.dates] - if true, revive ISO date strings back to Date objects
 */
export default function usePersistedState(key, initialValue, opts) {
  const optsRef = useRef(opts);
  optsRef.current = opts;

  const [value, setValue] = useState(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return initialValue;
      const parsed = JSON.parse(raw);
      if (optsRef.current?.dates) return reviveDates(parsed);
      return parsed;
    } catch {
      return initialValue;
    }
  });

  const set = useCallback((updater) => {
    setValue((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      try {
        if (next === undefined || next === null || (Array.isArray(next) && next.length === 0) || next === '') {
          localStorage.removeItem(key);
        } else {
          localStorage.setItem(key, JSON.stringify(next));
        }
      } catch { /* quota exceeded, ignore */ }
      return next;
    });
  }, [key]);

  return [value, set];
}

const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;

function reviveDates(obj) {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'string' && ISO_RE.test(obj)) return new Date(obj);
  if (Array.isArray(obj)) return obj.map(reviveDates);
  if (typeof obj === 'object') {
    const out = {};
    for (const k in obj) out[k] = reviveDates(obj[k]);
    return out;
  }
  return obj;
}
