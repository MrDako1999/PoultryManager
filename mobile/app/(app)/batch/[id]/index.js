import { useState, useMemo, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft, Egg, DollarSign, Wheat, ShoppingCart, Home, Calendar, Warehouse, Layers, ClipboardList,
} from 'lucide-react-native';
import useLocalRecord from '../../../../hooks/useLocalRecord';
import useLocalQuery from '../../../../hooks/useLocalQuery';
import useThemeStore from '../../../../stores/themeStore';
import { Badge } from '../../../../components/ui/Badge';
import StatCard from '../../../../components/ui/StatCard';
import CollapsibleSection from '../../../../components/CollapsibleSection';
import SourceRow from '../../../../components/rows/SourceRow';
import ExpenseRow from '../../../../components/rows/ExpenseRow';
import SaleRow from '../../../../components/rows/SaleRow';
import FeedItemRow from '../../../../components/rows/FeedItemRow';
import DailyLogRow from '../../../../components/rows/DailyLogRow';
import ExpenseCategoryGroup from '../../../../components/rows/ExpenseCategoryGroup';
import EmptyState from '../../../../components/ui/EmptyState';
import { SkeletonBatchDetail } from '../../../../components/skeletons';
import { STATUS_VARIANTS } from '../../../../lib/constants';
import { deltaSync } from '../../../../lib/syncEngine';
import ExpenseSheet from '../../../../components/sheets/ExpenseSheet';
import SourceSheet from '../../../../components/sheets/SourceSheet';
import FeedOrderSheet from '../../../../components/sheets/FeedOrderSheet';
import SaleOrderSheet from '../../../../components/sheets/SaleOrderSheet';
import DailyLogSheet from '../../../../components/sheets/DailyLogSheet';
import QuickAddFAB from '../../../../components/QuickAddFAB';

const fmt = (val) =>
  Number(val || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const FEED_TYPE_ORDER = { STARTER: 0, GROWER: 1, FINISHER: 2, OTHER: 3 };

export default function BatchDetailScreen() {
  const { id } = useLocalSearchParams();
  const { t } = useTranslation();
  const { resolvedTheme } = useThemeStore();
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState('overview');

  const [expenseSheet, setExpenseSheet] = useState({ open: false, data: null });
  const [sourceSheet, setSourceSheet] = useState({ open: false, data: null });
  const [feedOrderSheet, setFeedOrderSheet] = useState({ open: false, data: null });
  const [saleSheet, setSaleSheet] = useState({ open: false, data: null });
  const [dailyLogSheet, setDailyLogSheet] = useState({ open: false, data: null });

  const [batch, batchLoading] = useLocalRecord('batches', id);
  const [sources] = useLocalQuery('sources', { batch: id });
  const [expenses] = useLocalQuery('expenses', { batch: id });
  const [feedOrders] = useLocalQuery('feedOrders', { batch: id });
  const [saleOrders] = useLocalQuery('saleOrders', { batch: id });
  const [dailyLogs] = useLocalQuery('dailyLogs', { batch: id });

  const primaryColor = resolvedTheme === 'dark' ? 'hsl(148, 48%, 38%)' : 'hsl(148, 60%, 20%)';
  const mutedColor = 'hsl(150, 10%, 45%)';
  const iconColor = resolvedTheme === 'dark' ? '#e0e8e0' : '#1a2e1a';

  const totalChicks = useMemo(() => sources.reduce((s, x) => s + (x.totalChicks || 0), 0), [sources]);
  const totalExpenses = useMemo(() => expenses.reduce((s, x) => s + (x.totalAmount || 0), 0), [expenses]);
  const totalFeedCost = useMemo(() => feedOrders.reduce((s, x) => s + (x.grandTotal || 0), 0), [feedOrders]);
  const totalRevenue = useMemo(() => saleOrders.reduce((s, x) => s + (x.totals?.grandTotal || 0), 0), [saleOrders]);
  const netProfit = totalRevenue - totalExpenses;

  const sortedExpenseCategories = useMemo(() => {
    const groups = {};
    expenses.forEach((e) => {
      const cat = e.category || 'OTHER';
      if (!groups[cat]) groups[cat] = { items: [], total: 0 };
      groups[cat].items.push(e);
      groups[cat].total += e.totalAmount || 0;
    });
    return Object.entries(groups).sort(([a], [b]) =>
      t(`batches.expenseCategories.${a}`).localeCompare(t(`batches.expenseCategories.${b}`))
    );
  }, [expenses, t]);

  const sortedFeedTypes = useMemo(() => {
    const groups = {};
    feedOrders.forEach((order) => {
      (order.items || []).forEach((item) => {
        const type = item.feedType || 'OTHER';
        const itemKg = (item.bags || 0) * (item.quantitySize || 50);
        if (!groups[type]) groups[type] = { items: [], totalKg: 0, totalCost: 0 };
        groups[type].items.push({
          ...item,
          orderDate: order.orderDate,
          companyName: order.feedCompany?.companyName,
          orderId: order._id,
        });
        groups[type].totalKg += itemKg;
        groups[type].totalCost += (item.bags || 0) * (item.pricePerBag || 0);
      });
    });
    return Object.entries(groups).sort(
      ([a], [b]) => (FEED_TYPE_ORDER[a] ?? 99) - (FEED_TYPE_ORDER[b] ?? 99)
    );
  }, [feedOrders]);

  const sortedSaleDates = useMemo(() => {
    const groups = {};
    saleOrders.forEach((sale) => {
      const key = sale.saleDate ? new Date(sale.saleDate).toISOString().slice(0, 10) : 'no-date';
      if (!groups[key]) groups[key] = { items: [], revenue: 0 };
      groups[key].items.push(sale);
      groups[key].revenue += sale.totals?.grandTotal || 0;
    });
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [saleOrders]);

  const sortedDailyLogs = useMemo(() =>
    [...dailyLogs].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0)),
    [dailyLogs]);

  const [catOpen, setCatOpen] = useState({});
  const toggleCat = (key) => setCatOpen((p) => ({ ...p, [key]: !(p[key] ?? false) }));

  const quickAddItems = useMemo(() => [
    { key: 'expense',   icon: DollarSign,   label: t('batches.expensesTab'),   onPress: () => setExpenseSheet({ open: true, data: null }) },
    { key: 'sale',      icon: ShoppingCart,  label: t('batches.salesTab'),      onPress: () => setSaleSheet({ open: true, data: null }) },
    { key: 'feed',      icon: Wheat,         label: t('batches.feedOrdersTab'), onPress: () => setFeedOrderSheet({ open: true, data: null }) },
    { key: 'source',    icon: Egg,           label: t('batches.sourcesTab'),    onPress: () => setSourceSheet({ open: true, data: null }) },
    { key: 'dailyLog',  icon: ClipboardList, label: t('batches.operationsTab'), onPress: () => setDailyLogSheet({ open: true, data: null }) },
  ], [t]);

  const onRefresh = async () => {
    setRefreshing(true);
    try { await deltaSync(); } catch (e) { console.error(e); }
    setRefreshing(false);
  };

  if (batchLoading) return <SkeletonBatchDetail />;

  if (!batch) {
    return (
      <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
        <EmptyState
          icon={Layers}
          title={t('batches.notFound', 'Batch not found')}
          actionLabel={t('batches.backToBatches', 'Back to Batches')}
          onAction={() => router.back()}
        />
      </View>
    );
  }

  const farmName = typeof batch.farm === 'object' ? batch.farm?.farmName : '';
  const houses = batch.houses || [];
  const totalBirds = houses.reduce((s, h) => s + (h.quantity || 0), 0);

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <View className="px-4 pt-2 pb-3 border-b border-border">
        <View className="flex-row items-center gap-3">
          <Pressable onPress={() => router.back()} className="h-9 w-9 items-center justify-center rounded-md" hitSlop={8}>
            <ArrowLeft size={20} color={iconColor} />
          </Pressable>
          <View className="flex-1 min-w-0">
            <View className="flex-row items-center gap-2">
              <Text className="text-lg font-bold text-foreground" numberOfLines={1}>{batch.batchName}</Text>
              <Badge variant={STATUS_VARIANTS[batch.status] || 'secondary'}>
                <Text className="text-[10px] font-medium">{t(`batches.statuses.${batch.status}`, batch.status)}</Text>
              </Badge>
            </View>
            <View className="flex-row items-center gap-3">
              {farmName && (
                <View className="flex-row items-center gap-1">
                  <Warehouse size={12} color={mutedColor} />
                  <Text className="text-xs text-muted-foreground">{farmName}</Text>
                </View>
              )}
              <View className="flex-row items-center gap-1">
                <Calendar size={12} color={mutedColor} />
                <Text className="text-xs text-muted-foreground">
                  {batch.startDate ? new Date(batch.startDate).toLocaleDateString() : '—'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        <View className="flex-row mt-3 rounded-lg border border-border bg-muted/30 p-0.5">
          <Pressable
            onPress={() => setTab('overview')}
            className={`flex-1 py-2 rounded-md items-center ${tab === 'overview' ? 'bg-card' : ''}`}
          >
            <Text className={`text-sm font-medium ${tab === 'overview' ? 'text-foreground' : 'text-muted-foreground'}`}>
              {t('batches.overviewTab')}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setTab('operations')}
            className={`flex-1 py-2 rounded-md items-center ${tab === 'operations' ? 'bg-card' : ''}`}
          >
            <Text className={`text-sm font-medium ${tab === 'operations' ? 'text-foreground' : 'text-muted-foreground'}`}>
              {t('batches.operationsTab')}
            </Text>
          </Pressable>
        </View>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 88 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={primaryColor} />}
      >
        {tab === 'overview' ? (
          <>
            <View className="flex-row gap-2 mb-2">
              <StatCard label={t('batches.totalChicksReceived')} value={totalChicks.toLocaleString()} />
              <StatCard label={t('batches.sourceEntries')} value={sources.length} />
            </View>
            <View className="flex-row gap-2 mb-2">
              <StatCard label={t('batches.totalCost')} value={fmt(totalExpenses)} />
              <StatCard label={t('batches.totalRevenue')} value={fmt(totalRevenue)} />
            </View>
            <View className="flex-row gap-2 mb-4">
              <StatCard
                label={t('batches.netProfit', 'Net Profit')}
                value={fmt(netProfit)}
                valueClassName={netProfit < 0 ? 'text-red-500' : 'text-green-600'}
              />
            </View>

            {houses.length > 0 && (
              <View className="mb-4">
                <View className="flex-row items-center gap-2 mb-2">
                  <Home size={14} color={mutedColor} />
                  <Text className="text-sm font-medium text-foreground">{t('batches.housesBreakdown', 'Houses')}</Text>
                  <Text className="text-xs text-muted-foreground">({totalBirds.toLocaleString()} {t('farms.birds', 'birds')})</Text>
                </View>
                <View className="flex-row flex-wrap gap-2">
                  {houses.map((entry, i) => {
                    const name = typeof entry.house === 'object' ? entry.house?.name : `House ${i + 1}`;
                    return (
                      <View key={i} className="flex-row items-center gap-2 rounded-lg border border-border px-3 py-2">
                        <View className="h-7 w-7 rounded-md bg-primary/10 items-center justify-center">
                          <Home size={14} color={primaryColor} />
                        </View>
                        <View>
                          <Text className="text-sm font-medium text-foreground">{name}</Text>
                          <Text className="text-xs text-muted-foreground">{(entry.quantity || 0).toLocaleString()} birds</Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>
            )}

            <View className="mb-3">
              <CollapsibleSection
                title={t('batches.sourcesTab')}
                icon={Egg}
                onAdd={() => setSourceSheet({ open: true, data: null })}
                headerExtra={
                  <View className="flex-row items-center gap-2">
                    <Text className="text-[10px] text-muted-foreground font-semibold">{fmt(sources.reduce((s, x) => s + (x.grandTotal || 0), 0))}</Text>
                    <Text className="text-[10px] text-muted-foreground font-semibold">{sources.length}</Text>
                  </View>
                }
                items={sources}
                maxItems={3}
                expandTo={`/(app)/batch/${id}/sources`}
                onExpand={() => router.push(`/(app)/batch/${id}/sources`)}
                renderItem={(source) => (
                  <SourceRow key={source._id} source={source} onClick={() => router.push(`/(app)/source/${source._id}`)} />
                )}
              />
            </View>

            <View className="mb-3">
              <CollapsibleSection
                title={t('batches.feedOrdersTab')}
                icon={Wheat}
                onAdd={() => setFeedOrderSheet({ open: true, data: null })}
                expandTo={`/(app)/batch/${id}/feed-orders`}
                onExpand={() => router.push(`/(app)/batch/${id}/feed-orders`)}
                itemCount={sortedFeedTypes.reduce((s, [, g]) => s + g.items.length, 0)}
                headerExtra={
                  <View className="flex-row items-center gap-2">
                    <Text className="text-[10px] text-muted-foreground font-semibold">{fmt(totalFeedCost)}</Text>
                    <Text className="text-[10px] text-muted-foreground font-semibold">{feedOrders.length}</Text>
                  </View>
                }
              >
                {sortedFeedTypes.slice(0, 3).map(([type, { items, totalKg, totalCost }]) => (
                  <ExpenseCategoryGroup
                    key={type}
                    label={t(`feed.feedTypes.${type}`, type)}
                    pills={[{ value: fmt(totalCost) }, { value: `${totalKg.toLocaleString()} KG` }, { value: items.length }]}
                    open={catOpen[`feed-${type}`] ?? false}
                    onToggle={() => toggleCat(`feed-${type}`)}
                  >
                    {items.slice(0, 2).map((item, i) => (
                      <FeedItemRow
                        key={item._id || i}
                        item={item}
                        onClick={() => { if (item.orderId) router.push(`/(app)/feed-order/${item.orderId}`); }}
                      />
                    ))}
                  </ExpenseCategoryGroup>
                ))}
              </CollapsibleSection>
            </View>

            <View className="mb-3">
              <CollapsibleSection
                title={t('batches.expensesTab')}
                icon={DollarSign}
                onAdd={() => setExpenseSheet({ open: true, data: null })}
                expandTo={`/(app)/batch/${id}/expenses`}
                onExpand={() => router.push(`/(app)/batch/${id}/expenses`)}
                itemCount={expenses.length}
                headerExtra={
                  <View className="flex-row items-center gap-2">
                    <Text className="text-[10px] text-muted-foreground font-semibold">{fmt(totalExpenses)}</Text>
                    <Text className="text-[10px] text-muted-foreground font-semibold">{expenses.length}</Text>
                  </View>
                }
              >
                {sortedExpenseCategories.slice(0, 3).map(([category, { items, total }]) => (
                  <ExpenseCategoryGroup
                    key={category}
                    label={t(`batches.expenseCategories.${category}`, category)}
                    total={total}
                    count={items.length}
                    open={catOpen[`exp-${category}`] ?? false}
                    onToggle={() => toggleCat(`exp-${category}`)}
                  >
                    {items.slice(0, 2).map((expense) => (
                      <ExpenseRow
                        key={expense._id}
                        expense={expense}
                        categoryLabel={t(`batches.expenseCategories.${expense.category}`, expense.category)}
                        onClick={() => router.push(`/(app)/expense/${expense._id}`)}
                      />
                    ))}
                  </ExpenseCategoryGroup>
                ))}
              </CollapsibleSection>
            </View>

            <View className="mb-3">
              <CollapsibleSection
                title={t('batches.salesTab')}
                icon={ShoppingCart}
                onAdd={() => setSaleSheet({ open: true, data: null })}
                expandTo={`/(app)/batch/${id}/sales`}
                onExpand={() => router.push(`/(app)/batch/${id}/sales`)}
                itemCount={saleOrders.length}
                headerExtra={
                  <View className="flex-row items-center gap-2">
                    <Text className="text-[10px] text-muted-foreground font-semibold">{fmt(totalRevenue)}</Text>
                    <Text className="text-[10px] text-muted-foreground font-semibold">{saleOrders.length}</Text>
                  </View>
                }
              >
                {sortedSaleDates.slice(0, 3).map(([dateKey, { items, revenue }]) => (
                  <ExpenseCategoryGroup
                    key={dateKey}
                    label={dateKey === 'no-date' ? 'No Date' : new Date(dateKey + 'T00:00:00').toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })}
                    pills={[{ value: fmt(revenue) }, { value: items.length }]}
                    open={catOpen[`sale-${dateKey}`] ?? false}
                    onToggle={() => toggleCat(`sale-${dateKey}`)}
                  >
                    {items.slice(0, 2).map((sale) => (
                      <SaleRow key={sale._id} sale={sale} onClick={() => router.push(`/(app)/sale/${sale._id}`)} />
                    ))}
                  </ExpenseCategoryGroup>
                ))}
              </CollapsibleSection>
            </View>
          </>
        ) : (
          <>
            <CollapsibleSection
              title={t('batches.operationsTab')}
              icon={ClipboardList}
              onAdd={() => setDailyLogSheet({ open: true, data: null })}
              headerExtra={
                <Text className="text-[10px] text-muted-foreground font-semibold">{dailyLogs.length}</Text>
              }
              items={sortedDailyLogs}
              maxItems={5}
              expandTo={`/(app)/batch/${id}/daily-logs`}
              onExpand={() => router.push(`/(app)/batch/${id}/daily-logs`)}
              renderItem={(log) => (
                <DailyLogRow
                  key={log._id}
                  log={log}
                  t={t}
                  onClick={() => router.push(`/(app)/daily-log/${log._id}`)}
                />
              )}
            />
          </>
        )}
      </ScrollView>

      <QuickAddFAB items={quickAddItems} bottomInset={insets.bottom} />

      <ExpenseSheet
        open={expenseSheet.open}
        onClose={() => setExpenseSheet({ open: false, data: null })}
        batchId={id}
        editData={expenseSheet.data}
      />
      <SourceSheet
        open={sourceSheet.open}
        onClose={() => setSourceSheet({ open: false, data: null })}
        batchId={id}
        editData={sourceSheet.data}
      />
      <FeedOrderSheet
        open={feedOrderSheet.open}
        onClose={() => setFeedOrderSheet({ open: false, data: null })}
        batchId={id}
        editData={feedOrderSheet.data}
      />
      <SaleOrderSheet
        open={saleSheet.open}
        onClose={() => setSaleSheet({ open: false, data: null })}
        batchId={id}
        editData={saleSheet.data}
      />
      <DailyLogSheet
        open={dailyLogSheet.open}
        onClose={() => setDailyLogSheet({ open: false, data: null })}
        batchId={id}
        houses={houses}
        editData={dailyLogSheet.data}
      />
    </View>
  );
}
