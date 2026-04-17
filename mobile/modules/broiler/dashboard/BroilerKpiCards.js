import { useMemo } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import { Layers, Bird, TrendingDown, DollarSign } from 'lucide-react-native';
import useLocalQuery from '@/hooks/useLocalQuery';
import useSettings from '@/hooks/useSettings';
import StatCard from '@/components/ui/StatCard';
import { SkeletonDashboardCards } from '@/components/skeletons';

const fmt = (val) =>
  Number(val || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function BroilerKpiCards() {
  const { t } = useTranslation();
  const accounting = useSettings('accounting');
  const currency = accounting?.currency || 'AED';

  const [batches, batchesLoading] = useLocalQuery('batches');
  const [dailyLogs] = useLocalQuery('dailyLogs');
  const [saleOrders] = useLocalQuery('saleOrders');

  const activeBatches = useMemo(
    () => batches.filter((b) => b.status === 'IN_PROGRESS'),
    [batches]
  );

  const kpis = useMemo(() => {
    let initialBirds = 0;
    let totalDeaths = 0;
    const activeBatchIds = new Set(activeBatches.map((b) => b._id));

    activeBatches.forEach((b) => {
      (b.houses || []).forEach((h) => { initialBirds += h.quantity || 0; });
    });

    dailyLogs.forEach((log) => {
      const batchId = typeof log.batch === 'object' ? log.batch?._id : log.batch;
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

  if (batchesLoading) {
    return <SkeletonDashboardCards />;
  }

  const goBatches = () => router.push('/(app)/(tabs)/batches');
  const goAccounting = () => router.push('/(app)/(tabs)/accounting');

  return (
    <>
      <View className="flex-row gap-2 mb-2">
        <StatCard
          label={t('dashboard.activeBatches')}
          value={kpis.activeBatches}
          icon={Layers}
          onPress={goBatches}
        />
        <StatCard
          label={t('dashboard.totalBirds')}
          value={kpis.totalBirds.toLocaleString()}
          icon={Bird}
          onPress={goBatches}
        />
      </View>
      <View className="flex-row gap-2">
        <StatCard
          label={t('dashboard.mortalityRate')}
          value={`${kpis.mortalityRate}%`}
          icon={TrendingDown}
          onPress={goBatches}
        />
        <StatCard
          label={t('dashboard.revenueThisMonth')}
          value={`${currency} ${fmt(kpis.monthRevenue)}`}
          icon={DollarSign}
          onPress={goAccounting}
        />
      </View>
    </>
  );
}
