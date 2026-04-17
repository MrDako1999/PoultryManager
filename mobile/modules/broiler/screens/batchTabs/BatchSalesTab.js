import { useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, RefreshControl, LayoutAnimation } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ShoppingCart, ChevronsDownUp, ChevronsUpDown } from 'lucide-react-native';
import useLocalQuery from '@/hooks/useLocalQuery';
import useThemeStore from '@/stores/themeStore';
import SearchInput from '@/components/ui/SearchInput';
import EmptyState from '@/components/ui/EmptyState';
import SaleRow from '@/modules/broiler/rows/SaleRow';
import ExpenseCategoryGroup from '@/components/rows/ExpenseCategoryGroup';
import { SkeletonRow } from '@/components/skeletons';
import { deltaSync } from '@/lib/syncEngine';

const fmt = (val) =>
  Number(val || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function SummaryChip({ label, value }) {
  return (
    <View className="flex-1 rounded-md bg-muted/40 px-3 py-2">
      <Text className="text-[10px] text-muted-foreground" numberOfLines={1}>{label}</Text>
      <Text className="text-sm font-semibold text-foreground tabular-nums" numberOfLines={1}>{value}</Text>
    </View>
  );
}

export default function BatchSalesTab({ batchId }) {
  const { t } = useTranslation();
  const { resolvedTheme } = useThemeStore();
  const insets = useSafeAreaInsets();
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [catOpen, setCatOpen] = useState({});

  const [saleOrders, salesLoading] = useLocalQuery('saleOrders', { batch: batchId });
  const primaryColor = resolvedTheme === 'dark' ? 'hsl(148, 48%, 38%)' : 'hsl(148, 60%, 20%)';
  const mutedColor = 'hsl(150, 10%, 45%)';

  const toggleCat = (key) => setCatOpen((p) => ({ ...p, [key]: !(p[key] ?? true) }));

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

  const sortedSaleDates = useMemo(() => {
    const groups = {};
    filteredSales.forEach((sale) => {
      const key = sale.saleDate ? new Date(sale.saleDate).toISOString().slice(0, 10) : 'no-date';
      if (!groups[key]) groups[key] = { items: [], revenue: 0 };
      groups[key].items.push(sale);
      groups[key].revenue += sale.totals?.grandTotal || 0;
    });
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [filteredSales]);

  const totalRevenue = useMemo(
    () => filteredSales.reduce((s, x) => s + (x.totals?.grandTotal || 0), 0),
    [filteredSales]
  );

  const allExpanded = sortedSaleDates.every(([key]) => catOpen[key] ?? true);
  const toggleAll = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const next = {};
    sortedSaleDates.forEach(([key]) => { next[key] = !allExpanded; });
    setCatOpen(next);
  };

  return (
    <View className="flex-1 bg-background">
      <View className="px-4 pt-3 pb-2 flex-row gap-2">
        <SummaryChip label={t('batches.sales', 'Sales')} value={saleOrders.length} />
        <SummaryChip label={t('batches.totalRevenue', 'Total Revenue')} value={fmt(totalRevenue)} />
      </View>

      <View className="px-4 pb-3 flex-row items-center gap-2">
        <View className="flex-1">
          <SearchInput value={searchQuery} onChangeText={setSearchQuery} placeholder={t('common.search', 'Search...')} />
        </View>
        {sortedSaleDates.length > 1 && (
          <Pressable
            onPress={toggleAll}
            className="h-10 w-10 items-center justify-center rounded-md border border-border"
          >
            {allExpanded
              ? <ChevronsDownUp size={18} color={mutedColor} />
              : <ChevronsUpDown size={18} color={mutedColor} />}
          </Pressable>
        )}
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: insets.bottom + 96 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={primaryColor} />}
      >
        {salesLoading && saleOrders.length === 0 ? (
          <View className="px-4 gap-3">{[1, 2, 3, 4].map((i) => <SkeletonRow key={i} />)}</View>
        ) : filteredSales.length === 0 ? (
          <EmptyState
            icon={ShoppingCart}
            title={searchQuery ? t('common.noResults', 'No results') : t('batches.noSales', 'No sales')}
          />
        ) : (
          <View className="px-4">
            <View className="rounded-lg border border-border bg-card overflow-hidden">
              {sortedSaleDates.map(([dateKey, { items, revenue }]) => (
                <ExpenseCategoryGroup
                  key={dateKey}
                  label={dateKey === 'no-date' ? 'No Date' : new Date(dateKey + 'T00:00:00').toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })}
                  pills={[{ value: fmt(revenue) }, { value: items.length }]}
                  open={catOpen[dateKey] ?? true}
                  onToggle={() => toggleCat(dateKey)}
                >
                  {items.map((sale) => (
                    <SaleRow key={sale._id} sale={sale} onClick={() => router.push(`/(app)/sale/${sale._id}`)} />
                  ))}
                </ExpenseCategoryGroup>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
