import { useMemo } from 'react';
import useLocalQuery from '@/hooks/useLocalQuery';
import { computeReconciliation } from '@/modules/slaughterhouse/lib/reconciliation';
import { countByExpiryStatus } from '@/modules/slaughterhouse/lib/expiry';

// Mirrors useBroilerDashboardStats — single source of truth for every
// slaughterhouse dashboard widget. Returns throughput stats for a
// chosen scope (today / week / month / allTime / active).
//
//   active   — jobs currently open (status !== COMPLETE).
//   today    — jobs opened today.
//   week     — jobs opened in the current week (Mon-start).
//   month    — jobs opened in the current calendar month.
//   allTime  — every job.

function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function startOfWeek(d = new Date()) {
  const x = startOfDay(d);
  const day = x.getDay();
  const diff = day === 0 ? -6 : 1 - day; // Monday-start
  x.setDate(x.getDate() + diff);
  return x;
}

function startOfMonth(d = new Date()) {
  const x = new Date(d);
  x.setDate(1);
  x.setHours(0, 0, 0, 0);
  return x;
}

const num = (v) => (Number(v) || 0);

export default function useSlaughterhouseDashboardStats(scope = 'today') {
  const jobs = useLocalQuery('processingJobs');
  const truckEntries = useLocalQuery('truckEntries');
  const productionBoxes = useLocalQuery('productionBoxes');
  const productionPortions = useLocalQuery('productionPortions');
  const productionGiblets = useLocalQuery('productionGiblets');
  const stockUnits = useLocalQuery('stockUnits');
  const handovers = useLocalQuery('handovers');
  const invoices = useLocalQuery('processingInvoices');

  const now = useMemo(() => new Date(), []);

  // Scope filter on jobs.
  const scopedJobs = useMemo(() => {
    const live = jobs.filter((j) => !j.deletedAt);
    if (scope === 'allTime') return live;
    if (scope === 'active') return live.filter((j) => (j.status || 'NEW') !== 'COMPLETE');
    if (scope === 'today') {
      const sod = startOfDay(now).getTime();
      return live.filter((j) => j.openedAt && new Date(j.openedAt).getTime() >= sod);
    }
    if (scope === 'week') {
      const sow = startOfWeek(now).getTime();
      return live.filter((j) => j.openedAt && new Date(j.openedAt).getTime() >= sow);
    }
    if (scope === 'month') {
      const som = startOfMonth(now).getTime();
      return live.filter((j) => j.openedAt && new Date(j.openedAt).getTime() >= som);
    }
    return live;
  }, [jobs, scope, now]);

  const scopedJobIds = useMemo(
    () => new Set(scopedJobs.map((j) => j._id)),
    [scopedJobs],
  );

  const inScope = (rec) => {
    const jid = typeof rec.job === 'object' ? rec.job?._id : rec.job;
    return scopedJobIds.has(jid);
  };

  // Throughput aggregates rolled up across the scoped jobs.
  const throughput = useMemo(() => {
    const trucks = truckEntries.filter((tr) => !tr.deletedAt && inScope(tr));
    const boxes = productionBoxes.filter((b) => !b.deletedAt && inScope(b));
    const portions = productionPortions.filter((p) => !p.deletedAt && inScope(p));
    const giblets = productionGiblets.filter((g) => !g.deletedAt && inScope(g));

    const recon = computeReconciliation({
      truckEntries: trucks,
      productionBoxes: boxes,
      productionPortions: portions,
      productionGiblets: giblets,
    });

    return {
      jobCount: scopedJobs.length,
      truckCount: trucks.length,
      ...recon,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopedJobs, truckEntries, productionBoxes, productionPortions, productionGiblets]);

  // Live-line stats — independent of scope; the dashboard's "right
  // now" widget uses these directly.
  const liveLine = useMemo(() => {
    const live = jobs.filter((j) => !j.deletedAt);
    const sod = startOfDay(now).getTime();
    const queued = live.filter((j) => (j.status || 'NEW') === 'NEW' || (j.status || 'NEW') === 'UNLOADING' || (j.status || 'NEW') === 'READY');
    const onLine = live.filter((j) => (j.status || 'NEW') === 'PACKING');
    const doneToday = live.filter((j) =>
      ((j.status || 'NEW') === 'COMPLETE' || (j.status || 'NEW') === 'PACKED' || (j.status || 'NEW') === 'AWAITING_APPROVAL')
      && j.closedAt && new Date(j.closedAt).getTime() >= sod);
    return { queued, onLine, doneToday };
  }, [jobs, now]);

  // Cold-store snapshot — used by the StockOverviewWidget and the
  // dashboard alert chip.
  const coldStore = useMemo(() => {
    const live = stockUnits.filter((u) => !u.deletedAt && (Number(u.qtyAvailable) || 0) > 0);
    const expiry = countByExpiryStatus(live, now);
    let totalKg = 0;
    let boxesUnits = 0;
    let portionUnits = 0;
    let gibletUnits = 0;
    for (const u of live) {
      totalKg += num(u.weightKg);
      if (u.sourceType === 'box') boxesUnits += num(u.qtyAvailable);
      else if (u.sourceType === 'giblet') gibletUnits += num(u.qtyAvailable);
      else portionUnits += num(u.qtyAvailable);
    }
    return {
      totalUnits: live.length,
      totalKg,
      boxesUnits,
      portionUnits,
      gibletUnits,
      ...expiry,
    };
  }, [stockUnits, now]);

  // Financials — sum invoices issued in scope. Without backend
  // computed totals this just sums what the local sheet generated.
  const financials = useMemo(() => {
    const live = invoices.filter((i) => !i.deletedAt);
    let processingIncome = 0;
    let vat = 0;
    for (const inv of live) {
      if (!scopedJobIds.has(typeof inv.job === 'object' ? inv.job?._id : inv.job)) continue;
      processingIncome += num(inv.subtotal);
      vat += num(inv.vat);
    }
    const handoverCount = handovers.filter((h) => !h.deletedAt).length;
    return { processingIncome, vat, handoverCount };
  }, [invoices, scopedJobIds, handovers]);

  return {
    throughput,
    liveLine,
    coldStore,
    financials,
  };
}
