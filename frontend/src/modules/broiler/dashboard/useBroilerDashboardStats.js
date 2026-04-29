import { useMemo } from 'react';
import useLocalQuery from '@/hooks/useLocalQuery';

/**
 * Web port of mobile/modules/broiler/dashboard/useBroilerDashboardStats.js.
 * Returns flock + financial aggregates for a given scope so widgets share one
 * source of truth.
 *
 *   scope = 'active'    — only IN_PROGRESS batches.
 *   scope = 'allTime'   — every batch.
 *   scope = 'thisMonth' — batches whose startDate is in the current month or
 *                         which are still IN_PROGRESS.
 *
 * Web's useLocalQuery returns just the data array (no loading flag) so we
 * derive `isLoading` purely from whether useLiveQuery has resolved — the
 * hook coalesces undefined to []. Treat `isLoading: false` as "good enough"
 * here; widgets reading us are non-blocking.
 *
 * @param {'active' | 'allTime' | 'thisMonth'} scope
 */
export default function useBroilerDashboardStats(scope = 'active') {
  const batches = useLocalQuery('batches');
  const dailyLogs = useLocalQuery('dailyLogs');
  const saleOrders = useLocalQuery('saleOrders');
  const expenses = useLocalQuery('expenses');

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
    [scopedBatches],
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

    // Mirrors backend/services/statementService.js: chickensSent (slaughtered
    // sales) + birdCount (live sales) account for every bird leaving the
    // farm via a sale invoice. Subtracting deaths AND sold from initial
    // yields the canonical "still being raised on the farm" headline.
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

  return { flockStats, financials, isLoading: false, scope };
}
