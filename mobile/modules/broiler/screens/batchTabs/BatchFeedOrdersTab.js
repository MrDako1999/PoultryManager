import { useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, RefreshControl, LayoutAnimation } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Wheat, ChevronsDownUp, ChevronsUpDown } from 'lucide-react-native';
import useLocalQuery from '@/hooks/useLocalQuery';
import useThemeStore from '@/stores/themeStore';
import SearchInput from '@/components/ui/SearchInput';
import EmptyState from '@/components/ui/EmptyState';
import FeedItemRow from '@/modules/broiler/rows/FeedItemRow';
import ExpenseCategoryGroup from '@/components/rows/ExpenseCategoryGroup';
import { SkeletonRow } from '@/components/skeletons';
import { deltaSync } from '@/lib/syncEngine';

const fmt = (val) =>
  Number(val || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const FEED_TYPE_ORDER = { STARTER: 0, GROWER: 1, FINISHER: 2, OTHER: 3 };

function SummaryChip({ label, value }) {
  return (
    <View className="flex-1 rounded-md bg-muted/40 px-3 py-2">
      <Text className="text-[10px] text-muted-foreground" numberOfLines={1}>{label}</Text>
      <Text className="text-sm font-semibold text-foreground tabular-nums" numberOfLines={1}>{value}</Text>
    </View>
  );
}

export default function BatchFeedOrdersTab({ batchId }) {
  const { t } = useTranslation();
  const { resolvedTheme } = useThemeStore();
  const insets = useSafeAreaInsets();
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [catOpen, setCatOpen] = useState({});

  const [feedOrders, feedLoading] = useLocalQuery('feedOrders', { batch: batchId });
  const primaryColor = resolvedTheme === 'dark' ? 'hsl(148, 48%, 38%)' : 'hsl(148, 60%, 20%)';
  const mutedColor = 'hsl(150, 10%, 45%)';

  const toggleCat = (key) => setCatOpen((p) => ({ ...p, [key]: !(p[key] ?? true) }));

  const onRefresh = async () => {
    setRefreshing(true);
    try { await deltaSync(); } catch (e) { console.error(e); }
    setRefreshing(false);
  };

  const q = searchQuery.toLowerCase();

  const sortedFeedTypes = useMemo(() => {
    const groups = {};
    feedOrders.forEach((order) => {
      (order.items || []).forEach((item) => {
        const type = item.feedType || 'OTHER';
        const itemKg = (item.bags || 0) * (item.quantitySize || 50);
        if (!groups[type]) groups[type] = { items: [], totalKg: 0, totalCost: 0 };
        const enriched = {
          ...item,
          orderDate: order.orderDate,
          companyName: order.feedCompany?.companyName,
          orderId: order._id,
        };
        if (q && !(enriched.feedDescription || '').toLowerCase().includes(q) &&
            !(enriched.companyName || '').toLowerCase().includes(q)) return;
        groups[type].items.push(enriched);
        groups[type].totalKg += itemKg;
        groups[type].totalCost += (item.bags || 0) * (item.pricePerBag || 0);
      });
    });
    return Object.entries(groups)
      .filter(([, g]) => g.items.length > 0)
      .sort(([a], [b]) => (FEED_TYPE_ORDER[a] ?? 99) - (FEED_TYPE_ORDER[b] ?? 99));
  }, [feedOrders, q]);

  const totalItems = sortedFeedTypes.reduce((s, [, g]) => s + g.items.length, 0);
  const totalKg = sortedFeedTypes.reduce((s, [, g]) => s + g.totalKg, 0);
  const totalCost = sortedFeedTypes.reduce((s, [, g]) => s + g.totalCost, 0);

  const allExpanded = sortedFeedTypes.every(([type]) => catOpen[type] ?? true);
  const toggleAll = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const next = {};
    sortedFeedTypes.forEach(([type]) => { next[type] = !allExpanded; });
    setCatOpen(next);
  };

  return (
    <View className="flex-1 bg-background">
      <View className="px-4 pt-3 pb-2 flex-row gap-2">
        <SummaryChip label={t('batches.orders', 'Orders')} value={feedOrders.length} />
        <SummaryChip label={t('batches.totalKg', 'Total KG')} value={`${totalKg.toLocaleString()}`} />
        <SummaryChip label={t('batches.totalCost', 'Total Cost')} value={fmt(totalCost)} />
      </View>

      <View className="px-4 pb-3 flex-row items-center gap-2">
        <View className="flex-1">
          <SearchInput value={searchQuery} onChangeText={setSearchQuery} placeholder={t('common.search', 'Search...')} />
        </View>
        {sortedFeedTypes.length > 1 && (
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
        {feedLoading && feedOrders.length === 0 ? (
          <View className="px-4 gap-3">{[1, 2, 3, 4].map((i) => <SkeletonRow key={i} />)}</View>
        ) : totalItems === 0 ? (
          <EmptyState
            icon={Wheat}
            title={searchQuery ? t('common.noResults', 'No results') : t('batches.noFeedOrders', 'No feed orders')}
          />
        ) : (
          <View className="px-4">
            <View className="rounded-lg border border-border bg-card overflow-hidden">
              {sortedFeedTypes.map(([type, { items, totalKg: kg, totalCost: cost }]) => (
                <ExpenseCategoryGroup
                  key={type}
                  label={t(`feed.feedTypes.${type}`, type)}
                  pills={[{ value: fmt(cost) }, { value: `${kg.toLocaleString()} KG` }, { value: items.length }]}
                  open={catOpen[type] ?? true}
                  onToggle={() => toggleCat(type)}
                >
                  {items.map((item, i) => (
                    <FeedItemRow
                      key={item._id || i}
                      item={item}
                      onClick={() => { if (item.orderId) router.push(`/(app)/feed-order/${item.orderId}`); }}
                    />
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
