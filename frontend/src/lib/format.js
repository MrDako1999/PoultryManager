/**
 * Shared formatting & parsing utilities.
 *
 * Any number-formatting, date-formatting, or input-handler function
 * used in two or more files belongs here. Keep this module free of
 * React or UI imports — pure JS only.
 *
 * IMPORTANT — locale policy:
 * Numbers are formatted with the en-US locale everywhere (period as the
 * decimal separator, comma as the thousands separator). This is intentional:
 * the app stores raw numeric values and we need a single, predictable
 * presentation that matches what `parseNum` expects to read back. Relying on
 * the browser's default locale produced silent off-by-100x bugs for users in
 * EU locales (e.g. "2,00" was being parsed as 200 because the comma was
 * stripped as if it were a thousands separator).
 *
 * If we ever need to honour the user's locale for display, do it via a
 * separate "display only" helper and keep the form/round-trip layer on en-US.
 */

const NUM_LOCALE = 'en-US';

/**
 * Parse a formatted string into a plain number.
 *
 * Tolerates either decimal style:
 *   "1,234.56"  → 1234.56  (en-US)
 *   "1.234,56"  → 1234.56  (de-DE)
 *   "2,00"      → 2        (single comma followed by ≤2 digits = decimal)
 *   "2,000"     → 2000     (single comma followed by 3 digits = thousands)
 *   "2.00"      → 2
 *
 * Returns 0 for empty / non-numeric input.
 */
export function parseNum(val) {
  if (val == null || val === '') return 0;
  let s = String(val).replace(/[^0-9.,-]/g, '');
  if (!s) return 0;

  const lastDot = s.lastIndexOf('.');
  const lastComma = s.lastIndexOf(',');

  if (lastDot !== -1 && lastComma !== -1) {
    if (lastDot > lastComma) {
      s = s.replace(/,/g, '');
    } else {
      s = s.replace(/\./g, '').replace(',', '.');
    }
  } else if (lastComma !== -1) {
    const tail = s.length - lastComma - 1;
    if (tail > 0 && tail <= 2) {
      s = s.replace(',', '.');
    } else {
      s = s.replace(/,/g, '');
    }
  }

  const num = parseFloat(s);
  return isNaN(num) ? 0 : num;
}

/**
 * Format a number as an en-US integer (e.g. 1234 → "1,234").
 * Returns '' for null / zero / empty.
 */
export function fmtInt(num) {
  if (num == null || num === '' || num === 0) return '';
  return Number(num).toLocaleString(NUM_LOCALE);
}

/**
 * Format a number with 2 decimal places, en-US (e.g. 1234 → "1,234.00").
 * Returns '' for null / zero / empty.
 */
export function fmtDec(val) {
  if (val == null || val === '') return '';
  const n = typeof val === 'string' ? parseNum(val) : val;
  if (n === 0) return '';
  return n.toLocaleString(NUM_LOCALE, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Format a money/decimal value for read-only display, always with 2 decimals
 * and en-US separators. Unlike `fmtDec`, this returns "0.00" for zero so it
 * can be used in totals / summary panels.
 */
export function fmtMoney(val) {
  return Number(val || 0).toLocaleString(NUM_LOCALE, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
 * Format the typed value of an integer input. Shared by `intInputHandler`
 * (mutates e.target.value) and `intOnChange` (returns formatted string).
 */
function formatIntInput(value) {
  const raw = String(value).replace(/[^0-9]/g, '');
  return raw ? Number(raw).toLocaleString(NUM_LOCALE) : '';
}

/**
 * Format the typed value of a decimal input. The input string can contain
 * commas typed by the user on EU keyboards — we treat a single trailing comma
 * (or one that isn't acting as a thousands separator) as a decimal point so
 * users can type "2,5" and have it become "2.5".
 */
function formatDecInput(value) {
  let raw = String(value);

  if (raw.includes(',') && !raw.includes('.')) {
    const lastComma = raw.lastIndexOf(',');
    const tail = raw.length - lastComma - 1;
    if (tail !== 3) {
      raw = raw.slice(0, lastComma).replace(/,/g, '') + '.' + raw.slice(lastComma + 1);
    }
  }

  raw = raw.replace(/[^0-9.]/g, '');

  const firstDot = raw.indexOf('.');
  if (firstDot !== -1) {
    raw = raw.slice(0, firstDot + 1) + raw.slice(firstDot + 1).replace(/\./g, '');
  }

  const parts = raw.split('.');
  const intStr = parts[0] ? parts[0].replace(/,/g, '') : '';
  const intFormatted = intStr ? Number(intStr).toLocaleString(NUM_LOCALE) : '';
  return parts.length > 1 ? `${intFormatted}.${parts[1].slice(0, 2)}` : intFormatted;
}

/**
 * onChange handler for <input> that formats integers with thousand separators.
 * Mutates e.target.value in-place (for react-hook-form register({ onChange })).
 */
export function intInputHandler(e) {
  e.target.value = formatIntInput(e.target.value);
}

/**
 * onChange handler for <input> that formats decimals with thousand separators
 * and at most 2 decimal places.
 * Mutates e.target.value in-place (for react-hook-form register({ onChange })).
 */
export function decimalInputHandler(e) {
  e.target.value = formatDecInput(e.target.value);
}

/**
 * Factory: returns an onChange handler for controlled integer inputs
 * that calls `setter(formatted)` and `dirty()` on change.
 */
export function intOnChange(setter, dirty) {
  return (e) => {
    setter(formatIntInput(e.target.value));
    dirty();
  };
}

/**
 * Factory: returns an onChange handler for controlled decimal inputs
 * that calls `setter(formatted)` and `dirty()` on change.
 */
export function decOnChange(setter, dirty) {
  return (e) => {
    setter(formatDecInput(e.target.value));
    dirty();
  };
}

/**
 * Returns the formatted decimal value for an input event, without calling a
 * setter. Useful when the caller needs to update an indexed/keyed slice of
 * state (e.g. `updateRow(i, 'rate', decFormat(e))`).
 */
export function decFormat(e) {
  return formatDecInput(e.target.value);
}
