// Generates the canonical weight band list for whole-chicken boxes from
// the tenant's slaughterhouse settings. Bands are returned in ascending
// order with custom bands merged into the regular grid (de-duplicated
// against the step series). Pure function — safe to call inside render
// loops without memoisation.
//
// Default seed (mirrors plan §5):
//   { minGrams: 600, maxGrams: 2200, stepGrams: 50, customBands: [] }

export const DEFAULT_WEIGHT_BANDS = {
  minGrams: 600,
  maxGrams: 2200,
  stepGrams: 50,
  customBands: [],
};

export function generateWeightBands(weightBandSettings) {
  const cfg = {
    ...DEFAULT_WEIGHT_BANDS,
    ...(weightBandSettings || {}),
  };
  const min = Math.max(1, Number(cfg.minGrams) || DEFAULT_WEIGHT_BANDS.minGrams);
  const max = Math.max(min, Number(cfg.maxGrams) || DEFAULT_WEIGHT_BANDS.maxGrams);
  const step = Math.max(1, Number(cfg.stepGrams) || DEFAULT_WEIGHT_BANDS.stepGrams);

  const bands = new Set();
  for (let g = min; g <= max; g += step) bands.add(g);
  for (const c of cfg.customBands || []) {
    const n = Number(c);
    if (Number.isFinite(n) && n > 0) bands.add(n);
  }
  return Array.from(bands).sort((a, b) => a - b);
}

// Format a band's grams as a human-friendly label, e.g. 600 -> "600g".
// Kept here so every chip / row / detail row uses the same convention.
export function formatBandLabel(grams) {
  return `${Math.round(Number(grams) || 0)}g`;
}

// Convert a band's grams to kilograms (used for totalKg computations).
export function bandToKg(grams) {
  return (Number(grams) || 0) / 1000;
}
