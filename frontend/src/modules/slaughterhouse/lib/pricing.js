// Pricing engine — turns a job's production rows into invoice line
// items using the tenant's price list configuration.
//
// Two pricing modes (mirrors plan §3e + the Wahat vs Fakhr report
// differences):
//
//   PER_UNIT   The Fakhr-style report. Rate × quantity per tier.
//              tierA = whole chickens   (rate per kg)
//              tierB = giblets          (rate per tray)
//              tierC = portions         (rate per tray)
//
//   LUMP_SUM   The Wahat-style report. Operator types in an agreed
//              amount per tier; system stores it but doesn't compute.
//
// Returns { lineItems[], subtotal, vat, grandTotal }. VAT is applied
// only when accountingSettings.vatRate > 0 and the job is being
// invoiced as a tax invoice — leave it null on cash memos.

const num = (v) => (Number(v) || 0);

const DEFAULT_TIERS = {
  A: { label: 'Whole Chickens', rate: 0 },
  B: { label: 'Giblets', rate: 0 },
  C: { label: 'Portions', rate: 0 },
};

function readTier(pricing, key) {
  return {
    ...DEFAULT_TIERS[key],
    ...(pricing?.tiers?.[key] || {}),
  };
}

function sumWholeKg(rows) {
  let total = 0;
  for (const b of rows || []) {
    if (b?.deletedAt) continue;
    if (b.totalKg != null) {
      total += num(b.totalKg);
    } else {
      total += num(b.boxQty) * num(b.birdsPerBox) * (num(b.weightBandGrams) / 1000);
    }
  }
  return total;
}

function sumTrayCount(rows) {
  let total = 0;
  for (const r of rows || []) {
    if (r?.deletedAt) continue;
    total += num(r.trayCount);
  }
  return total;
}

// Compute invoice line items for a job. PER_UNIT mode computes from the
// production rows; LUMP_SUM mode just echoes the agreed amounts the
// operator stored on the job.
export function computeInvoiceLines({
  pricing,
  productionBoxes = [],
  productionPortions = [],
  productionGiblets = [],
  lumpSums = null,
} = {}) {
  const mode = pricing?.mode || 'PER_UNIT';
  const tierA = readTier(pricing, 'A');
  const tierB = readTier(pricing, 'B');
  const tierC = readTier(pricing, 'C');

  const lineItems = [];

  if (mode === 'LUMP_SUM') {
    const sums = lumpSums || {};
    if (sums.A != null) {
      lineItems.push({
        tier: 'A', label: tierA.label,
        quantity: null, rate: null, amount: num(sums.A),
      });
    }
    if (sums.B != null) {
      lineItems.push({
        tier: 'B', label: tierB.label,
        quantity: null, rate: null, amount: num(sums.B),
      });
    }
    if (sums.C != null) {
      lineItems.push({
        tier: 'C', label: tierC.label,
        quantity: null, rate: null, amount: num(sums.C),
      });
    }
  } else {
    const wholeKg = sumWholeKg(productionBoxes);
    if (wholeKg > 0) {
      lineItems.push({
        tier: 'A', label: tierA.label,
        quantity: wholeKg, unit: 'kg', rate: num(tierA.rate),
        amount: wholeKg * num(tierA.rate),
      });
    }
    const gibletTrays = sumTrayCount(productionGiblets);
    if (gibletTrays > 0) {
      lineItems.push({
        tier: 'B', label: tierB.label,
        quantity: gibletTrays, unit: 'trays', rate: num(tierB.rate),
        amount: gibletTrays * num(tierB.rate),
      });
    }
    const portionTrays = sumTrayCount(productionPortions);
    if (portionTrays > 0) {
      lineItems.push({
        tier: 'C', label: tierC.label,
        quantity: portionTrays, unit: 'trays', rate: num(tierC.rate),
        amount: portionTrays * num(tierC.rate),
      });
    }
  }

  const subtotal = lineItems.reduce((acc, li) => acc + num(li.amount), 0);
  return { lineItems, subtotal };
}

// Apply VAT and return the invoice totals. `vatRate` is a fraction
// (e.g. 0.05 for 5%). When the rate is 0 or not provided, vat is null
// and grandTotal === subtotal.
export function applyVatTotals({ subtotal, vatRate }) {
  const rate = num(vatRate);
  if (rate <= 0) {
    return {
      subtotal,
      vat: null,
      grandTotal: subtotal,
    };
  }
  const vat = subtotal * rate;
  return {
    subtotal,
    vat,
    grandTotal: subtotal + vat,
  };
}

// Resolve which price list applies to a given customer. When the tenant
// has set a per-customer price list, that wins; otherwise the default
// (business===null) list is used; otherwise the global pricing block on
// the slaughterhouse settings is the final fallback.
export function resolvePriceList({
  customerBusinessId,
  priceLists = [],
  fallbackPricing,
}) {
  const live = priceLists.filter((p) => !p.deletedAt);
  const matched = live.find((p) => {
    const bid = typeof p.business === 'object' ? p.business?._id : p.business;
    return bid && bid === customerBusinessId;
  });
  if (matched) return matched;
  const defaultList = live.find((p) => !p.business);
  if (defaultList) return defaultList;
  return fallbackPricing ? { ...fallbackPricing } : { mode: 'PER_UNIT', tiers: DEFAULT_TIERS };
}
