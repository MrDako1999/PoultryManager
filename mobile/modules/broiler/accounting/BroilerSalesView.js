import { useMemo, useState } from 'react';
import { View, ScrollView, RefreshControl } from 'react-native';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import { ShoppingCart } from 'lucide-react-native';
import useLocalQuery from '@/hooks/useLocalQuery';
import useThemeStore from '@/stores/themeStore';
import SearchInput from '@/components/ui/SearchInput';
import EmptyState from '@/components/ui/EmptyState';
import StatCard from '@/components/ui/StatCard';
import SaleRow from '@/modules/broiler/rows/SaleRow';
import { deltaSync } from '@/lib/syncEngine';
import { SkeletonRow, SkeletonStatCard } from '@/components/skeletons';

const fmt = (val) =>
  Number(val || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function BroilerSalesView() {
  const { t } = useTranslation();
  const { resolvedTheme } = useThemeStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const [saleOrders, salesLoading] = useLocalQuery('saleOrders');
  const primaryColor = resolvedTheme === 'dark' ? 'hsl(148, 48%, 38%)' : 'hsl(148, 60%, 20%)';

  const onRefresh = async () => {
    setRefreshing(true);
    try { await deltaSync(); } catch (e) { console.error(e); }
    setRefreshing(false);
  };

  const q = searchQuery.toLowerCase();

  const filteredSales = useMemo(() => {
    if (!q) return saleOrders;
    return saleOrders.filter((s) =>
      (s.customer?.companyName || '').toLowerCase().includes(q) ||
      (s.saleNumber || '').toLowerCase().includes(q)
    );
  }, [saleOrders, q]);

  const totalRevenue = useMemo(
    () => filteredSales.reduce((s, o) => s + (o.totals?.grandTotal || 0), 0),
    [filteredSales]
  );

  return (
    <View className="flex-1 bg-background">
      <View className="px-4 pb-3">
        <SearchInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder={t('accounting.searchSales', 'Search sales...')}
        />
      </View>

      <ScrollView
        className="flex-1"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={primaryColor} />}
      >
        {salesLoading && saleOrders.length === 0 ? (
          <View className="px-4 gap-3">
            <View className="flex-row gap-2"><SkeletonStatCard /><SkeletonStatCard /></View>
            {[1,2,3,4].map((i) => <SkeletonRow key={i} />)}
          </View>
        ) : (
          <>
            <View className="px-4 mb-3">
              <View className="flex-row gap-2">
                <StatCard label={t('accounting.totalRevenue', 'Total Revenue')} value={fmt(totalRevenue)} icon={ShoppingCart} />
                <StatCard label={t('accounting.salesCount', 'Sales')} value={filteredSales.length} />
              </View>
            </View>
            {filteredSales.length === 0 ? (
              <EmptyState icon={ShoppingCart} title={t('batches.noSales', 'No sales')} />
            ) : (
              <View className="px-4">
                {filteredSales
                  .sort((a, b) => new Date(b.saleDate || 0) - new Date(a.saleDate || 0))
                  .map((sale) => (
                    <View key={sale._id} className="rounded-lg border border-border bg-card mb-2 overflow-hidden">
                      <SaleRow sale={sale} onClick={() => router.push(`/(app)/sale/${sale._id}`)} />
                    </View>
                  ))
                }
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}
