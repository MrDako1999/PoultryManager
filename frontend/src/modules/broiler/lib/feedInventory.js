// Feed inventory math for the Batch Overview KPI card.
//
// Direct port of mobile/modules/broiler/lib/feedInventory.js — kept
// pure (no React/RN imports) so the helpers can be unit-tested and
// shared between the inventory card and any future feed surface.
//
// Contract notes (mirrors the mobile file):
//   - "Inventory" = ordered − consumed. Estimate only; trust it as
//     much as you trust your daily logs and your order entry.
//   - The returned `status` collapses every edge case (no orders
//     yet, runway < 3 days, runway 3–7 days, healthy, over-consumed)
//     into a single tag. The card stays declarative.

const BAG_KG = 50;

// Order matters — sequential consumption walks this list to allocate
// consumedKg into per-type buckets. Mirrors the broiler feed schedule
// (starter first, then grower, then finisher; OTHER catches anything
// else, including over-consumption beyond the known orders).
const FEED_TYPES_SEQUENCE = ['STARTER', 'GROWER', 'FINISHER', 'OTHER'];

// Per-phase feed target in kg per starting bird. See the mobile file
// for the rationale; these multipliers are customer-supplied and the
// canonical source of truth lives here for the web + mobile parity.
export const FEED_TARGET_KG_PER_BIRD = {
  STARTER: 0.75,
  GROWER: 0.4,
  FINISHER: 1.0,
  OTHER: 0,
};

/**
 * Compute the feed inventory snapshot for a batch.
 *
 * @param {object} input
 * @param {Array} [input.feedOrders]
 * @param {Array} [input.dailyLogs]
 * @param {Date} [input.today]
 * @param {number} [input.windowDays=7]
 * @returns {{
 *   orderedKg: number,
 *   orderedBags: number,
 *   consumedKg: number,
 *   remainingKg: number,
 *   remainingBags: number,
 *   avgDailyKg: number,
 *   daysLeft: number|null,
 *   status: 'ok'|'low'|'critical'|'over'|'untracked',
 * }}
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
    const raw = log.logDate || log.date;
    if (!raw) continue;
    const key = String(raw).slice(0, 10);
    dailyByDate.set(key, (dailyByDate.get(key) || 0) + kg);
  }

  const remainingKg = Math.max(0, orderedKg - consumedKg);
  // Floor on remaining bags — under-state inventory so farmers don't
  // over-trust the estimate.
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

  // Status precedence: untracked > over > critical > low > ok.
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
 * totals.
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
 * deaths). Houses without a weight sample contribute zero.
 *
 * @param {object} input
 * @param {Array} input.houses
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
 * gained. Returns null when either side is missing or zero.
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
 * Per-phase feed targets (kg) derived from initial bird count and
 * the per-phase multipliers. Returns 0s when birdsPlaced missing so
 * downstream can branch on `total === 0` for the fallback path.
 *
 * @param {object} input
 * @param {number} [input.birdsPlaced]
 * @returns {{ STARTER: number, GROWER: number, FINISHER: number, OTHER: number, TOTAL: number }}
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
 * Total feed/water consumed and per-bird ratios.
 *
 * `birdsAlive` = Σ initial − Σ deaths across the batch. Per-bird
 * ratios use the alive count rather than initial placement so they
 * reflect what each surviving bird has actually consumed.
 *
 * Per-bird values are null when there are no surviving birds.
 *
 * @param {object} input
 * @param {Array} [input.houses]
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
