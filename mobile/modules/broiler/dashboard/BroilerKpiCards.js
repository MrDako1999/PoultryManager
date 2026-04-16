import { useMemo } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Layers, Egg, DollarSign, TrendingUp } from 'lucide-react-native';
import useLocalQuery from '@/hooks/useLocalQuery';
import StatCard from '@/components/ui/StatCard';
import { SkeletonDashboardCards } from '@/components/skeletons';

const fmt = (val) =>
  Number(val || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function BroilerKpiCards() {
  const { t } = useTranslation();
  const [batches, batchesLoading] = useLocalQuery('batches');
  const [expenses] = useLocalQuery('expenses');
  const [saleOrders] = useLocalQuery('saleOrders');

  const activeBatches = useMemo(
    () => batches.filter((b) => b.status !== 'COMPLETE'),
    [batches]
  );

  const totalBirds = useMemo(
    () => activeBatches.reduce((sum, b) =>
      sum + (b.houses || []).reduce((s, h) => s + (h.quantity || 0), 0), 0),
    [activeBatches]
  );

  const totalExpenses = useMemo(
    () => expenses.reduce((sum, e) => sum + (e.totalAmount || 0), 0),
    [expenses]
  );

  const totalRevenue = useMemo(
    () => saleOrders.reduce((sum, s) => sum + (s.totals?.grandTotal || 0), 0),
    [saleOrders]
  );

  if (batchesLoading) {
    return <SkeletonDashboardCards />;
  }

  return (
    <>
      <View className="flex-row gap-2 mb-2">
        <StatCard label={t('dashboard.activeBatches')} value={activeBatches.length} icon={Layers} />
        <StatCard label={t('dashboard.totalBirds')} value={totalBirds.toLocaleString()} icon={Egg} />
      </View>
      <View className="flex-row gap-2">
        <StatCard label={t('dashboard.totalExpenses', 'Total Cost')} value={fmt(totalExpenses)} icon={DollarSign} />
        <StatCard label={t('dashboard.revenue')} value={fmt(totalRevenue)} icon={TrendingUp} />
      </View>
    </>
  );
}
