/**
 * Centralised relative-date / time-ago formatters.
 *
 * Before this module existed, the same fmtRelativeDate / formatTimeAgo
 * code was copy-pasted into 9 different files (BatchSourcesTab,
 * BatchExpensesTab, BatchSalesTab, BusinessSalesTab, BusinessExpensesTab,
 * BusinessTransfersTab, SourcesListView, SalesListView, ExpensesListView,
 * TransfersListView, SyncIconButton…) with hardcoded English strings —
 * "Today" / "Yesterday" / "Xd ago" / "Just now" — that never localised
 * to Arabic. Any callable that produces user-visible text must accept
 * the i18next `t` function so the bundle and locale are honoured.
 *
 * Both helpers gracefully degrade if `t` is omitted (returns English),
 * so they remain usable from non-React code paths (e.g. logging) without
 * forcing an i18n dependency.
 */

const NUMERIC_LOCALE_FALLBACK = 'en-US';

function asDate(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

/**
 * Compact relative date used in list-row "last entry" / "last delivery"
 * stamps. Today / Yesterday / Xd ago for the last week, then a localised
 * "DD MMM" fallback.
 *
 * @param {Date|string|number|null} value
 * @param {(key: string, fallback?: string, opts?: object) => string} [t]
 *   i18next translator. Optional but strongly recommended.
 * @param {string} [locale]
 *   BCP-47 tag for the absolute-date fallback. Defaults to en-US so
 *   numerals stay Latin (the rest of the codebase uses NUMERIC_LOCALE for
 *   the same reason — Arabic-Indic digits hurt readability in tabular
 *   columns).
 */
export function formatRelativeDate(value, t, locale = NUMERIC_LOCALE_FALLBACK) {
  const d = asDate(value);
  if (!d) return null;
  const now = new Date();
  const days = Math.floor((now - d) / 86400000);
  if (days <= 0) {
    return t ? t('common.today', 'Today') : 'Today';
  }
  if (days === 1) {
    return t ? t('common.yesterday', 'Yesterday') : 'Yesterday';
  }
  if (days < 7) {
    return t
      ? t('common.daysAgo', '{{n}}d ago', { n: days })
      : `${days}d ago`;
  }
  return d.toLocaleDateString(locale, { day: '2-digit', month: 'short' });
}

/**
 * Sync-popover "last synced X ago" formatter. Caller passes the raw ISO
 * string off `useSyncStore`; we render Just now / Xm ago / Xh ago / Xd
 * ago. Returns "Never" when the value is missing — that's a sentinel for
 * "we have not synced this device yet".
 *
 * @param {string|number|Date|null} dateStr
 * @param {(key: string, fallback?: string, opts?: object) => string} [t]
 */
export function formatTimeAgo(dateStr, t) {
  if (!dateStr) return t ? t('common.never', 'Never') : 'Never';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return t ? t('common.justNow', 'Just now') : 'Just now';
  if (mins < 60) {
    return t
      ? t('common.minutesAgo', '{{n}}m ago', { n: mins })
      : `${mins}m ago`;
  }
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) {
    return t
      ? t('common.hoursAgo', '{{n}}h ago', { n: hrs })
      : `${hrs}h ago`;
  }
  const days = Math.floor(hrs / 24);
  return t
    ? t('common.daysAgo', '{{n}}d ago', { n: days })
    : `${days}d ago`;
}
