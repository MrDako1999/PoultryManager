import { useMemo } from 'react';
import useLocalQuery from '@/hooks/useLocalQuery';

/**
 * Shared broiler dashboard stats. Returns flock + financial aggregates for a
 * given scope. Used by both `BroilerKpiHero` (the in-sheet KPI cards) and the
 * dashboard shell (for the hero quick-stats pulse strip).
 *
 * Both consumers reading via `useLocalQuery` is fine — the underlying queries
 * are cached/deduped by the hook, so we're not doing extra DB work.
 *
 * @param {'active' | 'allTime' | 'thisMonth'} scope
 */
export default function useBroilerDashboardStats(scope = 'active') {
  const [batches, batchesLoading] = useLocalQuery('batches');
  const [dailyLogs] = useLocalQuery('dailyLogs');
  const [saleOrders, salesLoading] = useLocalQuery('saleOrders');
  const [expenses, expensesLoading] = useLocalQuery('expenses');

  const isLoading = batchesLoading || salesLoading || expensesLoading;

  const monthStart = useMemo(() => {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const scopedBatches = useMemo(() => {
    if (scope === 'active') return batches.filter((b) => b.status === 'IN_PROGRESS');
    if (scope === 'allTime') return batches;
    return batches.filter((b) => {
      if (!b.startDate) return false;
      const start = new Date(b.startDate);
      if (start >= monthStart) return true;
      return b.status === 'IN_PROGRESS';
    });
  }, [batches, scope, monthStart]);

  const scopedBatchIds = useMemo(
    () => new Set(scopedBatches.map((b) => b._id)),
    [scopedBatches]
  );

  const flockStats = useMemo(() => {
    let initial = 0;
    let deaths = 0;
    let sold = 0;
    const houseIds = new Set();

    scopedBatches.forEach((b) => {
      (b.houses || []).forEach((h, i) => {
        initial += h.quantity || 0;
        const hid = (typeof h.house === 'object' ? h.house?._id : h.house) || `${b._id}:${i}`;
        houseIds.add(hid);
      });
    });

    dailyLogs.forEach((log) => {
      if (log.deletedAt || log.logType !== 'DAILY' || log.deaths == null) return;
      const batchId = typeof log.batch === 'object' ? log.batch?._id : log.batch;
      if (scopedBatchIds.has(batchId)) deaths += log.deaths || 0;
    });

    // Chickens that have already left the farm via sale orders. Mirrors
    // the canonical chicken-count formula from
    // backend/services/statementService.js: chickensSent (slaughtered
    // sales) + birdCount (live sales). Together these account for every
    // bird on a sale invoice regardless of sale method, so once we
    // subtract them from `initial` (along with deaths) we get the true
    // "still being raised on the farm" count.
    saleOrders.forEach((s) => {
      if (s.deletedAt) return;
      const batchId = typeof s.batch === 'object' ? s.batch?._id : s.batch;
      if (!scopedBatchIds.has(batchId)) return;
      sold += (s.counts?.chickensSent || 0) + (s.live?.birdCount || 0);
    });

    const accountedFor = deaths + sold;
    const liveBirds = Math.max(0, initial - accountedFor);
    const mortalityPct = initial > 0 ? (deaths / initial) * 100 : 0;
    const soldPct = initial > 0 ? (sold / initial) * 100 : 0;
    const survivalPct = initial > 0 ? (liveBirds / initial) * 100 : 0;

    return {
      initial,
      liveBirds,
      sold,
      deaths,
      mortalityPct,
      soldPct,
      survivalPct,
      cycleCount: scopedBatches.length,
      houseCount: houseIds.size,
    };
  }, [scopedBatches, scopedBatchIds, dailyLogs, saleOrders]);

  const financials = useMemo(() => {
    const matchSale = (s) => {
      const batchId = typeof s.batch === 'object' ? s.batch?._id : s.batch;
      if (scope === 'active') return scopedBatchIds.has(batchId);
      if (scope === 'thisMonth') return s.saleDate && new Date(s.saleDate) >= monthStart;
      return true;
    };
    const matchExpense = (e) => {
      const batchId = typeof e.batch === 'object' ? e.batch?._id : e.batch;
      if (scope === 'active') return scopedBatchIds.has(batchId);
      if (scope === 'thisMonth') return e.expenseDate && new Date(e.expenseDate) >= monthStart;
      return true;
    };

    const totalRevenue = saleOrders
      .filter(matchSale)
      .reduce((s, o) => s + (o.totals?.grandTotal || 0), 0);
    const totalExpenses = expenses
      .filter(matchExpense)
      .reduce((s, e) => s + (e.totalAmount || 0), 0);
    const netProfit = totalRevenue - totalExpenses;
    const marginPct = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : null;

    const profitDenom = scope === 'active' ? flockStats.liveBirds : flockStats.initial;
    const profitPerBird = profitDenom > 0 ? netProfit / profitDenom : null;

    return { totalRevenue, totalExpenses, netProfit, marginPct, profitPerBird };
  }, [saleOrders, expenses, scope, scopedBatchIds, monthStart, flockStats]);

  return { flockStats, financials, isLoading, scope };
}
