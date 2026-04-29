// Reconciliation engine — the variance and yield identities that turn
// a processingJob + its child rows into the same numbers the printed
// reports show (the Wahat sheet's BALANCE, the Fakhr sheet's STATUS
// CHECK, plus the dressed-weight/giblets-ratio yields).
//
// Identity from plan §6:
//
//   Σ truck.expectedQty  −  Σ doa  −  Σ condemnation  −  Σ bGrade  −  Σ shortage
//                       =  Σ box.totalBirds  +  variance
//
// Yields:
//   avgDressedKg   = Σ box.totalKg / Σ box.totalBirds        (whole chicken avg)
//   gibletsRatioKg = Σ giblet.totalKg / Σ box.totalKg        (% giblet vs whole)

const num = (v) => (Number(v) || 0);

function sumLive(rows, mapper) {
  let total = 0;
  for (const r of rows || []) {
    if (r?.deletedAt) continue;
    total += num(mapper(r));
  }
  return total;
}

function boxTotalBirds(box) {
  if (box.totalBirds != null) return num(box.totalBirds);
  return num(box.boxQty) * num(box.birdsPerBox);
}

function boxTotalKg(box) {
  if (box.totalKg != null) return num(box.totalKg);
  return num(box.boxQty) * num(box.birdsPerBox) * (num(box.weightBandGrams) / 1000);
}

function portionTotalKg(row) {
  if (row.totalKg != null) return num(row.totalKg);
  return num(row.trayCount) * num(row.weightPerTray);
}

// Compute the full reconciliation snapshot for a job. Pure function —
// callers pass child rows already filtered to this job (by useLocalQuery
// with { job: jobId }). Returns numbers the UI can format with
// fmtInt/fmtDec/fmtMoney.
//
// `variance > 0` means more birds than packed (under-production); `< 0`
// means more boxed than reconciled losses allow (over-count, likely a
// miscounted truck or B-grade).
export function computeReconciliation({
  truckEntries = [],
  productionBoxes = [],
  productionPortions = [],
  productionGiblets = [],
} = {}) {
  const expectedQty = sumLive(truckEntries, (t) => t.expectedQty);

  const doa = sumLive(truckEntries, (t) => t.sortation?.doa);
  const condemnation = sumLive(truckEntries, (t) => t.sortation?.condemnation);
  const bGrade = sumLive(truckEntries, (t) => t.sortation?.bGrade);
  const shortage = sumLive(truckEntries, (t) => t.sortation?.shortage);
  const losses = doa + condemnation + bGrade + shortage;
  const netToLine = expectedQty - losses;

  const wholeBirdsPacked = sumLive(productionBoxes, boxTotalBirds);
  const wholeKgPacked = sumLive(productionBoxes, boxTotalKg);

  const portionsKg = sumLive(productionPortions, portionTotalKg);
  const gibletsKg = sumLive(productionGiblets, portionTotalKg);
  const trayKg = portionsKg + gibletsKg;

  // Birds-equivalent of B-grade outputs is intentionally not deducted
  // from variance — B-grade birds were already counted as a loss above.
  // Variance = expected − losses − wholeBirdsPacked.
  const variance = netToLine - wholeBirdsPacked;

  const avgDressedKg = wholeBirdsPacked > 0 ? wholeKgPacked / wholeBirdsPacked : null;
  const gibletsRatio = wholeKgPacked > 0 ? gibletsKg / wholeKgPacked : null;

  // Yield % against the live weight in. We don't have per-truck live
  // weight on the schema (only counts), so we approximate against
  // expectedQty × avgDressedKg as a rough plant-level yield. When live
  // weight ingestion is added, swap this denominator.
  const wholeBirdYieldPct = expectedQty > 0
    ? (wholeBirdsPacked / expectedQty) * 100
    : null;

  return {
    expectedQty,
    losses,
    doa,
    condemnation,
    bGrade,
    shortage,
    netToLine,
    wholeBirdsPacked,
    wholeKgPacked,
    portionsKg,
    gibletsKg,
    trayKg,
    variance,
    isBalanced: variance === 0,
    avgDressedKg,
    gibletsRatio,
    wholeBirdYieldPct,
  };
}

// Severity tag for a variance value — drives chip tone on the
// reconciliation tab and the close-job sheet.
export function varianceTone(variance) {
  if (variance === 0) return 'ok';
  const abs = Math.abs(variance);
  if (abs <= 5) return 'minor';
  if (abs <= 25) return 'warning';
  return 'critical';
}
