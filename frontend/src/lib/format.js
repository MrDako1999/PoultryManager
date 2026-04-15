/**
 * Shared formatting & parsing utilities.
 *
 * Any number-formatting, date-formatting, or input-handler function
 * used in two or more files belongs here. Keep this module free of
 * React or UI imports — pure JS only.
 */

/**
 * Parse a formatted string (e.g. "1,234.56") into a plain number.
 * Returns 0 for empty / non-numeric input.
 */
export function parseNum(val) {
  if (!val || val === '') return 0;
  const num = parseFloat(String(val).replace(/[^0-9.]/g, ''));
  return isNaN(num) ? 0 : num;
}

/**
 * Format a number as a locale-string integer (e.g. 1234 → "1,234").
 * Returns '' for null / zero / empty.
 */
export function fmtInt(num) {
  if (num == null || num === '' || num === 0) return '';
  return Number(num).toLocaleString();
}

/**
 * Format a number as a locale-string with 2 decimal places (e.g. 1234 → "1,234.00").
 * Returns '' for null / zero / empty.
 */
export function fmtDec(val) {
  if (val == null || val === '') return '';
  const n = typeof val === 'string' ? parseNum(val) : val;
  if (n === 0) return '';
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Convert a date string (or Date) to an HTML <input type="date"> value (YYYY-MM-DD).
 */
export function formatDateForInput(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Today as YYYY-MM-DD in local time.
 */
export function todayStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * onChange handler for <input> that formats integers with thousand separators.
 * Mutates e.target.value in-place (for react-hook-form register({ onChange })).
 */
export function intInputHandler(e) {
  const raw = e.target.value.replace(/[^0-9]/g, '');
  e.target.value = raw ? Number(raw).toLocaleString() : '';
}

/**
 * onChange handler for <input> that formats decimals with thousand separators
 * and at most 2 decimal places.
 * Mutates e.target.value in-place (for react-hook-form register({ onChange })).
 */
export function decimalInputHandler(e) {
  const raw = e.target.value.replace(/[^0-9.]/g, '');
  const parts = raw.split('.');
  const intPart = parts[0] ? Number(parts[0].replace(/,/g, '')).toLocaleString() : '';
  if (parts.length > 1) {
    e.target.value = `${intPart}.${parts[1].slice(0, 2)}`;
  } else {
    e.target.value = intPart;
  }
}

/**
 * Factory: returns an onChange handler for controlled integer inputs
 * that calls `setter(formatted)` and `dirty()` on change.
 */
export function intOnChange(setter, dirty) {
  return (e) => {
    const raw = e.target.value.replace(/[^0-9]/g, '');
    const formatted = raw ? Number(raw).toLocaleString() : '';
    setter(formatted);
    dirty();
  };
}

/**
 * Factory: returns an onChange handler for controlled decimal inputs
 * that calls `setter(formatted)` and `dirty()` on change.
 */
export function decOnChange(setter, dirty) {
  return (e) => {
    const raw = e.target.value.replace(/[^0-9.]/g, '');
    const parts = raw.split('.');
    const intPart = parts[0] ? Number(parts[0].replace(/,/g, '')).toLocaleString() : '';
    const formatted = parts.length > 1 ? `${intPart}.${parts[1].slice(0, 2)}` : intPart;
    setter(formatted);
    dirty();
  };
}
