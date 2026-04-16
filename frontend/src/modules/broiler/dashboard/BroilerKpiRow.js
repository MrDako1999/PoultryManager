import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Layers, Bird, TrendingDown, DollarSign } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import useLocalQuery from '@/hooks/useLocalQuery';
import useSettings from '@/hooks/useSettings';

const fmt = (val) =>
  Number(val || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function BroilerKpiRow() {
  const { t } = useTranslation();
  const accounting = useSettings('accounting');
  const currency = accounting?.currency || 'AED';

  const batches = useLocalQuery('batches');
  const dailyLogs = useLocalQuery('dailyLogs');
  const saleOrders = useLocalQuery('saleOrders');

  const activeBatches = useMemo(
    () => batches.filter((b) => b.status === 'IN_PROGRESS'),
    [batches],
  );

  const kpis = useMemo(() => {
    let initialBirds = 0;
    let totalDeaths = 0;
    const activeBatchIds = new Set(activeBatches.map((b) => b._id));

    activeBatches.forEach((b) => {
      (b.houses || []).forEach((h) => { initialBirds += h.quantity || 0; });
    });

    dailyLogs.forEach((log) => {
      const batchId = typeof log.batch === 'object' ? log.batch._id : log.batch;
      if (activeBatchIds.has(batchId) && log.deaths) totalDeaths += log.deaths;
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
      mortalityRate: initialBirds > 0 ? ((totalDeaths / initialBirds) * 100).toFixed(2) : '0.00',
      monthRevenue,
    };
  }, [activeBatches, dailyLogs, saleOrders]);

  return (
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
  );
}
