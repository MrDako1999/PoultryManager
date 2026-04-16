import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Layers, Bird, TrendingDown, DollarSign, ArrowRight, Warehouse,
  Calendar, Skull, Wheat, ShoppingCart, Receipt, Plus, ClipboardList,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import useAuthStore from '@/stores/authStore';
import useLocalQuery from '@/hooks/useLocalQuery';
import useSettings from '@/hooks/useSettings';

const fmt = (val) =>
  Number(val || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export default function DashboardPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const accounting = useSettings('accounting');
  const currency = accounting?.currency || 'AED';

  const batches = useLocalQuery('batches');
  const dailyLogs = useLocalQuery('dailyLogs');
  const saleOrders = useLocalQuery('saleOrders');
  const expenses = useLocalQuery('expenses');

  const activeBatches = useMemo(
    () => batches.filter((b) => b.status === 'IN_PROGRESS'),
    [batches],
  );

  const kpis = useMemo(() => {
    let initialBirds = 0;
    let totalDeaths = 0;

    const activeBatchIds = new Set(activeBatches.map((b) => b._id));

    activeBatches.forEach((b) => {
      (b.houses || []).forEach((h) => {
        initialBirds += h.quantity || 0;
      });
    });

    dailyLogs.forEach((log) => {
      const batchId = typeof log.batch === 'object' ? log.batch._id : log.batch;
      if (activeBatchIds.has(batchId) && log.deaths) {
        totalDeaths += log.deaths;
      }
    });

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    let monthRevenue = 0;
    saleOrders.forEach((s) => {
      if (s.saleDate && new Date(s.saleDate) >= monthStart) {
        monthRevenue += s.totals?.grandTotal || 0;
      }
    });

    return {
      activeBatches: activeBatches.length,
      totalBirds: initialBirds - totalDeaths,
      mortalityRate: initialBirds > 0
        ? ((totalDeaths / initialBirds) * 100).toFixed(2)
        : '0.00',
      monthRevenue,
    };
  }, [activeBatches, dailyLogs, saleOrders]);

  const batchCards = useMemo(() => {
    const activeBatchIds = new Set(activeBatches.map((b) => b._id));

    const deathsByBatch = {};
    const feedByBatch = {};
    dailyLogs.forEach((log) => {
      const batchId = typeof log.batch === 'object' ? log.batch._id : log.batch;
      if (!activeBatchIds.has(batchId)) return;
      if (log.deaths) deathsByBatch[batchId] = (deathsByBatch[batchId] || 0) + log.deaths;
      if (log.feedKg) feedByBatch[batchId] = (feedByBatch[batchId] || 0) + log.feedKg;
    });

    return activeBatches.map((b) => {
      const initial = (b.houses || []).reduce((s, h) => s + (h.quantity || 0), 0);
      const deaths = deathsByBatch[b._id] || 0;
      const remaining = initial - deaths;
      const mortality = initial > 0 ? ((deaths / initial) * 100).toFixed(1) : '0.0';
      const feed = feedByBatch[b._id] || 0;
      const dayCount = b.startDate
        ? Math.max(0, Math.floor((Date.now() - new Date(b.startDate)) / 86400000))
        : 0;

      return {
        _id: b._id,
        batchName: b.batchName,
        farmName: b.farm?.farmName || b.farm?.nickname || '',
        dayCount,
        initial,
        remaining,
        mortality,
        feed,
      };
    });
  }, [activeBatches, dailyLogs]);

  const financials = useMemo(() => {
    const totalRevenue = saleOrders.reduce((s, o) => s + (o.totals?.grandTotal || 0), 0);
    const totalExpenses = expenses.reduce((s, e) => s + (e.totalAmount || 0), 0);
    return {
      revenue: totalRevenue,
      salesCount: saleOrders.length,
      expenses: totalExpenses,
      expensesCount: expenses.length,
      profit: totalRevenue - totalExpenses,
    };
  }, [saleOrders, expenses]);

  const today = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-heading font-bold tracking-tight">
            {t('dashboard.welcome', { name: user?.firstName || '' })}
          </h1>
          <p className="text-sm text-muted-foreground">{today}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" className="gap-1.5" onClick={() => navigate('/dashboard/batches', { state: { openNew: true } })}>
            <Plus className="h-3.5 w-3.5" />
            {t('dashboard.newBatch')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => navigate('/dashboard/batches')}
          >
            <ClipboardList className="h-3.5 w-3.5" />
            {t('dashboard.viewBatches')}
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('dashboard.activeBatches')}
            </CardTitle>
            <Layers className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums">{kpis.activeBatches}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('dashboard.totalBirds')}
            </CardTitle>
            <Bird className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums">
              {kpis.totalBirds.toLocaleString()}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('dashboard.mortalityRate')}
            </CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums">{kpis.mortalityRate}%</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('dashboard.revenueThisMonth')}
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums">
              <span className="text-base font-semibold text-muted-foreground">{currency}</span>{' '}
              {fmt(kpis.monthRevenue)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Active Batches */}
      <div>
        <h2 className="text-lg font-semibold mb-3">{t('dashboard.activeBatchesTitle')}</h2>
        {batchCards.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <div className="rounded-full bg-muted p-4 mb-4">
                <Layers className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-1">{t('dashboard.noActiveBatches')}</h3>
              <p className="text-sm text-muted-foreground mb-4 max-w-sm">
                {t('dashboard.noActiveBatchesDesc')}
              </p>
              <Button onClick={() => navigate('/dashboard/batches', { state: { openNew: true } })}>
                {t('dashboard.createFirstBatch')}
                <ArrowRight className="ml-2 h-4 w-4 rtl:ml-0 rtl:mr-2 rtl:rotate-180" />
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {batchCards.map((b) => (
              <Card
                key={b._id}
                className="cursor-pointer transition-colors hover:bg-accent/50"
                onClick={() => navigate(`/dashboard/batches/${b._id}`)}
              >
                <CardContent className="pt-5 pb-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">{b.batchName}</p>
                      {b.farmName && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Warehouse className="h-3 w-3 shrink-0" />
                          <span className="truncate">{b.farmName}</span>
                        </p>
                      )}
                    </div>
                    <span className="shrink-0 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium tabular-nums">
                      <Calendar className="h-3 w-3" />
                      {t('dashboard.dayN', { n: b.dayCount })}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                    <div className="flex items-center gap-1.5">
                      <Bird className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <div>
                        <p className="text-xs text-muted-foreground leading-none">{t('dashboard.birds')}</p>
                        <p className="text-sm font-semibold tabular-nums">{b.remaining.toLocaleString()}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Skull className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <div>
                        <p className="text-xs text-muted-foreground leading-none">{t('dashboard.mortality')}</p>
                        <p className="text-sm font-semibold tabular-nums">{b.mortality}%</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Wheat className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <div>
                        <p className="text-xs text-muted-foreground leading-none">{t('dashboard.feedConsumed')}</p>
                        <p className="text-sm font-semibold tabular-nums">{b.feed.toLocaleString()} kg</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Financial Overview */}
      <div>
        <h2 className="text-lg font-semibold mb-3">{t('dashboard.financialOverview')}</h2>
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
          <Card>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                  <ShoppingCart className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <p className="text-sm font-medium">{t('dashboard.totalRevenue')}</p>
                  <p className="text-xs text-muted-foreground">
                    {financials.salesCount} {t('dashboard.salesOrders')}
                  </p>
                </div>
              </div>
              <p className="text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                {currency} {fmt(financials.revenue)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-100 dark:bg-red-900/30">
                  <Receipt className="h-4 w-4 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <p className="text-sm font-medium">{t('dashboard.totalExpenses')}</p>
                  <p className="text-xs text-muted-foreground">
                    {financials.expensesCount} {t('dashboard.expenseRecords')}
                  </p>
                </div>
              </div>
              <p className="text-2xl font-bold tabular-nums text-red-600 dark:text-red-400">
                {currency} {fmt(financials.expenses)}
              </p>
            </CardContent>
          </Card>
        </div>

        <Card className="mt-4">
          <CardContent className="pt-5 pb-4 flex items-center justify-between">
            <p className="text-sm font-medium">{t('dashboard.netProfitLoss')}</p>
            <p className={`text-xl font-bold tabular-nums ${
              financials.profit >= 0
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-red-600 dark:text-red-400'
            }`}>
              {financials.profit >= 0 ? '+' : ''}{currency} {fmt(financials.profit)}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
