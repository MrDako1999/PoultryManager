// Expiry helpers — settings-driven shelf life for produced units, plus
// a status function that renders the cold-store ExpiryBadge tone.
//
// Defaults mirror the plan §5 seed (3 days for boxes + portions, 2 for
// giblets). The shelf life can be overridden per tenant in
// useSettings('slaughterhouse').defaultShelfLifeDays.
//
// `expiryStatus(expiresAt)` collapses the time-to-expiry into a single
// tag the UI can map to a tone:
//   - expired  : already past expiry
//   - critical : <24h left
//   - soon     : 24h–72h left
//   - fresh    : >72h left
//   - none     : no expiresAt set
//
// Snapshot semantics: when a row is created the computed expiresAt is
// stored on the record. Later edits to the default shelf life days do
// NOT retro-affect existing rows — only new rows pick up the change.

export const DEFAULT_SHELF_LIFE_DAYS = {
  boxes: 3,
  portions: 3,
  giblets: 2,
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MS_PER_HOUR = 60 * 60 * 1000;

function readShelfLifeSetting(slaughterhouseSettings, kind) {
  const cfg = slaughterhouseSettings?.defaultShelfLifeDays || {};
  const candidate = cfg[kind];
  const fallback = DEFAULT_SHELF_LIFE_DAYS[kind];
  const n = Number(candidate);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

// Compute an expiresAt ISO string from a packagedAt timestamp + tenant
// shelf life. `kind` is one of 'boxes' | 'portions' | 'giblets'. Falls
// back to today + default shelf life when packagedAt isn't supplied.
export function computeExpiresAt({ packagedAt, kind, slaughterhouseSettings }) {
  const days = readShelfLifeSetting(slaughterhouseSettings, kind);
  const base = packagedAt ? new Date(packagedAt) : new Date();
  if (Number.isNaN(base.getTime())) return null;
  const expires = new Date(base.getTime() + days * MS_PER_DAY);
  return expires.toISOString();
}

// Status tag for an expiresAt value. The thresholds match the plan §3f
// Cold Store note (Critical <24h, Soon 24-72h, Fresh >72h, plus Expired).
export function expiryStatus(expiresAt, now = new Date()) {
  if (!expiresAt) return 'none';
  const t = new Date(expiresAt).getTime();
  if (Number.isNaN(t)) return 'none';
  const diffMs = t - now.getTime();
  if (diffMs <= 0) return 'expired';
  if (diffMs < 24 * MS_PER_HOUR) return 'critical';
  if (diffMs < 72 * MS_PER_HOUR) return 'soon';
  return 'fresh';
}

// Hours remaining until expiry — useful for the dashboard "X items
// expire in <Yh" copy. Negative when already expired.
export function hoursToExpiry(expiresAt, now = new Date()) {
  if (!expiresAt) return null;
  const t = new Date(expiresAt).getTime();
  if (Number.isNaN(t)) return null;
  return (t - now.getTime()) / MS_PER_HOUR;
}

// Count units in a list whose expiry status falls into a given bucket.
// Useful for dashboard widgets that summarise expiry pressure.
export function countByExpiryStatus(units, now = new Date()) {
  const counts = { fresh: 0, soon: 0, critical: 0, expired: 0, none: 0 };
  for (const u of units || []) {
    if (u?.deletedAt) continue;
    const status = expiryStatus(u?.expiresAt, now);
    counts[status] = (counts[status] || 0) + 1;
  }
  return counts;
}
