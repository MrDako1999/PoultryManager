// Feed inventory math for the Batch Overview KPI card.
//
// Pulls together the two sources of truth for feed flow:
//
//   - Feed orders (what arrived on the farm) — `bags × quantitySize` per
//     line item across every order tied to the batch.
//   - Daily logs (what was eaten) — sum of `feedKg` on every non-deleted
//     DAILY-type log.
//
// The difference is an *estimate* of feed sitting on the farm right
// now. It's only as good as the inputs (ground staff have to log feed
// each day; orders have to be entered when delivered) but it's the
// best signal we have for "should the farmer call the supplier today".
//
// The returned `status` collapses the various edge cases (no orders
// recorded yet, runway under 3 days, runway 3–7 days, runway healthy,
// consumption already above orders) into a single tag the UI consumes
// for tone + banners. Keeping the policy here means the Batch Overview
// card stays declarative — it just renders whatever the helper says.

const BAG_KG = 50;

// Order matters — sequential consumption walks this list to allocate
// consumedKg into per-type buckets. Mirrors the broiler feed schedule
// (starter first, then grower, then finisher; OTHER catches anything
// else, including over-consumption beyond the known orders).
const FEED_TYPES_SEQUENCE = ['STARTER', 'GROWER', 'FINISHER', 'OTHER'];

// Per-phase feed target in kg per starting bird. Multiplying these
// against the batch's initial bird placement gives the kg of feed the
// operator SHOULD ultimately purchase across the cycle for each
// phase. Used by the FeedInventoryCard's bar visualization to mark
// the third "still to order" zone.
//
// Source: customer rule of thumb. Industry-standard broiler feed
// schedules vary by strain and target finish weight; these values
// reflect the multipliers the user supplied for this customer's farm
// management. If we ever need per-batch overrides (e.g. a heavier
// finishing target), thread a per-batch settings record through
// `computeFeedTargets` instead of editing this constant.
//
// OTHER intentionally has no target — anything outside the standard
// three phases is treated as discretionary and not goal-tracked.
export const FEED_TARGET_KG_PER_BIRD = {
  STARTER: 0.75,
  GROWER: 0.4,
  FINISHER: 1.0,
  OTHER: 0,
};

/**
 * @typedef {Object} FeedInventory
 * @property {number} orderedKg
 * @property {number} orderedBags - sum of `item.bags` (raw count, ignores `quantitySize`).
 * @property {number} consumedKg
 * @property {number} remainingKg - clamped at 0; see `status === 'over'` for the over-consumed branch.
 * @property {number} remainingBags - kg / 50, floored to one decimal so we under-state inventory.
 * @property {number} avgDailyKg - rolling average over `windowDays` ending today, only days with logs counted.
 * @property {number|null} daysLeft - null when avgDailyKg is 0 (no recent logs to project from).
 * @property {'ok'|'low'|'critical'|'over'|'untracked'} status
 */

/**
 * Compute the feed inventory snapshot for a batch.
 *
 * @param {object} input
 * @param {Array} [input.feedOrders] - feed orders for this batch (each with an `items` array).
 * @param {Array} [input.dailyLogs] - daily logs for this batch.
 * @param {Date} [input.today] - clock anchor for the rolling window. Injectable for testing.
 * @param {number} [input.windowDays=7] - rolling window size in days.
 * @returns {FeedInventory}
 */
export function computeFeedInventory({
  feedOrders,
  dailyLogs,
  today = new Date(),
  windowDays = 7,
} = {}) {
  let orderedKg = 0;
  let orderedBags = 0;
  for (const o of feedOrders || []) {
    for (const it of (o.items || [])) {
      orderedKg += (it.bags || 0) * (it.quantitySize || BAG_KG);
      orderedBags += it.bags || 0;
    }
  }

  // Aggregate consumed + bucket per-day so the rolling-average loop
  // below can do O(windowDays) lookups instead of re-scanning the logs.
  let consumedKg = 0;
  const dailyByDate = new Map();
  for (const log of dailyLogs || []) {
    if (log?.deletedAt || log?.logType !== 'DAILY') continue;
    const kg = log.feedKg || 0;
    if (!kg) continue;
    consumedKg += kg;
    // `logDate` is the canonical field on synced logs; new offline-
    // created entries may still carry `date`. Either way we want the
    // YYYY-MM-DD prefix so timezone drift doesn't bucket the same
    // farmer-day into two slots.
    const raw = log.logDate || log.date;
    if (!raw) continue;
    const key = String(raw).slice(0, 10);
    dailyByDate.set(key, (dailyByDate.get(key) || 0) + kg);
  }

  const remainingKg = Math.max(0, orderedKg - consumedKg);
  // Floor on remaining bags — under-state inventory so farmers don't
  // over-trust the estimate. Mirror of the round-up rule we apply to
  // CONSUMED bags in mobile/components/FeedAmountInput.js (where
  // over-stating consumption is the safe direction).
  const remainingBags = Math.floor((remainingKg / BAG_KG) * 10) / 10;

  // Rolling N-day average. Only days that actually have a log count
  // toward the divisor — averaging across "missed" days would suppress
  // the projection right after a worker forgets to log overnight.
  let windowKg = 0;
  let windowDaysWithData = 0;
  for (let i = 0; i < windowDays; i += 1) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    if (dailyByDate.has(key)) {
      windowKg += dailyByDate.get(key);
      windowDaysWithData += 1;
    }
  }
  const avgDailyKg = windowDaysWithData > 0 ? windowKg / windowDaysWithData : 0;
  const daysLeft = avgDailyKg > 0 ? remainingKg / avgDailyKg : null;

  // Status precedence matters: `untracked` (no orders entered yet)
  // beats `over` because we can't claim over-consumption against an
  // empty ledger. After that, `over` beats the runway buckets — if
  // we're already past the orders we don't care whether the projected
  // runway is "low" or "critical", it's worse than either.
  let status = 'ok';
  if (orderedKg === 0) {
    status = 'untracked';
  } else if (consumedKg > orderedKg) {
    status = 'over';
  } else if (daysLeft != null && daysLeft < 3) {
    status = 'critical';
  } else if (daysLeft != null && daysLeft < 7) {
    status = 'low';
  }

  return {
    orderedKg,
    orderedBags,
    consumedKg,
    remainingKg,
    remainingBags,
    avgDailyKg,
    daysLeft,
    status,
  };
}

/**
 * Group feed-order line items by feed type and return per-type kg + bag
 * totals. Used by the inventory card to build phase-progress bars and
 * by `allocateConsumedByType` to know each phase's capacity.
 *
 * @param {Array} feedOrders
 * @returns {Record<string, { totalKg: number, totalBags: number }>}
 */
export function aggregateOrderedByType(feedOrders) {
  const groups = {};
  for (const o of feedOrders || []) {
    for (const it of (o.items || [])) {
      const type = it.feedType || 'OTHER';
      const bags = it.bags || 0;
      const kg = bags * (it.quantitySize || BAG_KG);
      if (!groups[type]) groups[type] = { totalKg: 0, totalBags: 0 };
      groups[type].totalKg += kg;
      groups[type].totalBags += bags;
    }
  }
  return groups;
}

/**
 * Distribute total consumed kg across feed types in the canonical
 * broiler sequence (STARTER → GROWER → FINISHER → OTHER), filling each
 * phase up to its ordered capacity before spilling into the next.
 *
 * The daily log doesn't tag consumption with a feed type, so this is
 * an approximation — but it matches how broilers actually eat through
 * a cycle (starter sacks empty before grower opens), so it produces a
 * useful "where are we in the cycle" signal for the per-phase bars.
 *
 * Any consumption past the last known phase lands in OTHER as
 * overshoot, which is what the over-consumption banner flags.
 *
 * @param {object} input
 * @param {Record<string, { totalKg: number }>} input.orderedByType
 * @param {number} input.consumedKg
 * @returns {Record<'STARTER'|'GROWER'|'FINISHER'|'OTHER', number>}
 */
export function allocateConsumedByType({ orderedByType, consumedKg } = {}) {
  const result = { STARTER: 0, GROWER: 0, FINISHER: 0, OTHER: 0 };
  let remaining = consumedKg || 0;
  for (const t of FEED_TYPES_SEQUENCE) {
    const ordered = orderedByType?.[t]?.totalKg || 0;
    const used = Math.min(remaining, ordered);
    result[t] = used;
    remaining = Math.max(0, remaining - used);
  }
  if (remaining > 0) result.OTHER += remaining;
  return result;
}

/**
 * Total live weight (kg) of the flock, derived from each house's
 * latest WEIGHT-type sample × its current alive count (initial −
 * deaths). Houses without a weight sample contribute zero — they're
 * effectively excluded from the FCR calculation, which is the
 * conservative choice (better to under-count weight than over-count).
 *
 * Returns 0 when no house has any weight sample, which makes
 * `computeFCR` short-circuit to null upstream.
 *
 * @param {object} input
 * @param {Array} input.houses - batch.houses (each with `quantity` and either an embedded house ref or id).
 * @param {Array} input.dailyLogs
 * @returns {number}
 */
export function deriveLiveWeightKg({ houses, dailyLogs } = {}) {
  const latestSample = new Map();
  const deathsByHouse = new Map();
  for (const log of dailyLogs || []) {
    if (log?.deletedAt) continue;
    const hid = String(typeof log.house === 'object' ? log.house?._id : log.house);
    if (!hid || hid === 'undefined') continue;
    if (log.logType === 'WEIGHT' && log.averageWeight != null) {
      const date = new Date(log.logDate || log.date || 0);
      const cur = latestSample.get(hid);
      if (!cur || date > cur.date) {
        latestSample.set(hid, { date, weightG: log.averageWeight });
      }
    } else if (log.logType === 'DAILY' && log.deaths != null) {
      deathsByHouse.set(hid, (deathsByHouse.get(hid) || 0) + (log.deaths || 0));
    }
  }
  let totalKg = 0;
  for (const h of houses || []) {
    const hid = String(typeof h.house === 'object' ? h.house?._id : h.house);
    const sample = latestSample.get(hid);
    if (!sample) continue;
    const initial = h.quantity || 0;
    const deaths = deathsByHouse.get(hid) || 0;
    const alive = Math.max(0, initial - deaths);
    totalKg += alive * (sample.weightG / 1000);
  }
  return totalKg;
}

/**
 * Feed Conversion Ratio — kg of feed consumed per kg of live weight
 * gained. The classic broiler economics indicator: lower is better
 * (target band roughly 1.4–1.7 for modern strains).
 *
 * Returns null when either side is missing or zero so the UI can show
 * a neutral em-dash instead of `Infinity` / `NaN` / a misleading 0.
 *
 * @param {object} input
 * @param {number} input.consumedKg
 * @param {number} input.liveWeightKg
 * @returns {number|null}
 */
export function computeFCR({ consumedKg, liveWeightKg } = {}) {
  if (!consumedKg || !liveWeightKg || liveWeightKg <= 0) return null;
  return consumedKg / liveWeightKg;
}

/**
 * Per-phase feed targets (kg) for a batch, derived from the starting
 * bird count and the per-phase multipliers in
 * `FEED_TARGET_KG_PER_BIRD`. Returned object also carries `TOTAL`
 * (sum across the three real phases) for the OVERALL bar on the
 * Feed card.
 *
 * Returns all-zero fields when `birdsPlaced` is missing/zero so
 * downstream can branch on `total === 0` for the "no target"
 * fallback rather than juggling null.
 *
 * @param {object} input
 * @param {number} [input.birdsPlaced] - sum of `houses[].quantity`.
 * @returns {{
 *   STARTER: number,
 *   GROWER: number,
 *   FINISHER: number,
 *   OTHER: number,
 *   TOTAL: number,
 * }}
 */
export function computeFeedTargets({ birdsPlaced } = {}) {
  const birds = birdsPlaced || 0;
  const result = {
    STARTER: birds * FEED_TARGET_KG_PER_BIRD.STARTER,
    GROWER: birds * FEED_TARGET_KG_PER_BIRD.GROWER,
    FINISHER: birds * FEED_TARGET_KG_PER_BIRD.FINISHER,
    OTHER: birds * FEED_TARGET_KG_PER_BIRD.OTHER,
  };
  result.TOTAL = result.STARTER + result.GROWER + result.FINISHER + result.OTHER;
  return result;
}

/**
 * Total feed/water consumed and per-bird ratios. Splits out from
 * `computeFeedInventory` because the inventory math doesn't need
 * water (or bird counts), and we'd rather avoid burdening every
 * inventory caller with house data they don't otherwise read.
 *
 * `birdsAlive` here is `Σ initial − Σ deaths` across the batch — the
 * conventional flock-level "current" count. Per-bird ratios use the
 * alive count rather than initial placement so they reflect what each
 * surviving bird has actually consumed (closer to the field reality;
 * dead birds don't continue eating).
 *
 * Per-bird values are null when there are no surviving birds — we
 * surface an em-dash in the UI rather than dividing by zero.
 *
 * @param {object} input
 * @param {Array} [input.houses] - batch.houses
 * @param {Array} [input.dailyLogs]
 * @returns {{
 *   totalFeedKg: number,
 *   totalWaterL: number,
 *   birdsAlive: number,
 *   feedPerBirdKg: number|null,
 *   waterPerBirdL: number|null,
 * }}
 */
export function computeConsumptionRatios({ houses, dailyLogs } = {}) {
  let totalFeedKg = 0;
  let totalWaterL = 0;
  const deathsByHouse = new Map();
  for (const log of dailyLogs || []) {
    if (log?.deletedAt || log?.logType !== 'DAILY') continue;
    totalFeedKg += log.feedKg || 0;
    totalWaterL += log.waterLiters || 0;
    if (log.deaths != null) {
      const hid = String(typeof log.house === 'object' ? log.house?._id : log.house);
      if (hid && hid !== 'undefined') {
        deathsByHouse.set(hid, (deathsByHouse.get(hid) || 0) + (log.deaths || 0));
      }
    }
  }
  let birdsInitial = 0;
  let totalDeaths = 0;
  for (const h of houses || []) {
    const hid = String(typeof h.house === 'object' ? h.house?._id : h.house);
    birdsInitial += h.quantity || 0;
    totalDeaths += deathsByHouse.get(hid) || 0;
  }
  const birdsAlive = Math.max(0, birdsInitial - totalDeaths);
  return {
    totalFeedKg,
    totalWaterL,
    birdsAlive,
    feedPerBirdKg: birdsAlive > 0 ? totalFeedKg / birdsAlive : null,
    waterPerBirdL: birdsAlive > 0 ? totalWaterL / birdsAlive : null,
  };
}
