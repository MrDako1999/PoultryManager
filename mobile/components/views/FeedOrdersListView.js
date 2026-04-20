import { useMemo, useState } from 'react';
import {
  View, ScrollView, Pressable, RefreshControl, LayoutAnimation, StyleSheet, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import {
  Wheat, Plus, Layers, Search, X, ChevronsDownUp, ChevronsUpDown,
} from 'lucide-react-native';
import { useHeroSheetTokens } from '@/components/HeroSheetScreen';
import SheetSection from '@/components/SheetSection';
import SheetInput from '@/components/SheetInput';
import EmptyState from '@/components/ui/EmptyState';
import FeedItemRow from '@/modules/broiler/rows/FeedItemRow';
import ExpenseCategoryGroup from '@/components/rows/ExpenseCategoryGroup';
import { SkeletonFeedOrdersTab } from '@/components/skeletons';
import { deltaSync } from '@/lib/syncEngine';
import FilterChips from '@/components/views/FilterChips';
import FeedMixHeroCard from '@/components/views/FeedMixHeroCard';
import useSettings from '@/hooks/useSettings';

const NUMERIC_LOCALE = 'en-US';

const fmt = (val) =>
  Number(val || 0).toLocaleString(NUMERIC_LOCALE, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const fmtInt = (val) => Number(val || 0).toLocaleString(NUMERIC_LOCALE);

const FEED_TYPE_ORDER = { STARTER: 0, GROWER: 1, FINISHER: 2, OTHER: 3 };
const FEED_TYPES_DISPLAYED = ['STARTER', 'GROWER', 'FINISHER'];

// Per-item cost INCLUDING VAT. Mirrors the helper in FeedMixHeroCard so
// the per-feed-type group totals shown in the list match what the hero
// card aggregates above. Prefers the persisted `lineTotal`; falls back
// to subtotal × (1 + vatRate) for legacy items.
const itemCostWithVat = (item, vatRate) => {
  if (item?.lineTotal) return item.lineTotal;
  if (item?.subtotal != null && item?.vatAmount != null) {
    return (item.subtotal || 0) + (item.vatAmount || 0);
  }
  const sub = (item?.bags || 0) * (item?.pricePerBag || 0);
  return sub * (1 + (vatRate || 0) / 100);
};

export default function FeedOrdersListView({
  feedOrders = [],
  loading = false,
  onAdd,
  addLabel,
  emptyTitle,
  batchOptions,
  batchFilter,
  onBatchFilterChange,
  hideHero = false,
  hideSearch = false,
  // Suppresses the legacy single-select feed-type chip row when the
  // parent (typically BatchFeedOrdersTab) handles feed-type filtering
  // through the AccountingToolbar pill row instead.
  hideTypeChips = false,
  // When the parent owns feed-type filtering (multi-select pill row in
  // the AccountingToolbar), it passes the active selection as an array
  // here so item-level filtering still happens inside the list view.
  // Empty/undefined means "show all types".
  feedTypeFilter,
  // When set, the parent provides custom header content (typically a
  // FeedMixHeroCard) that scrolls AWAY with the rest of the list.
  headerComponent = null,
  // When set, the parent provides a toolbar (typically AccountingToolbar)
  // that becomes a STICKY header. Function-form receives `{ collapseButton }`
  // so the parent can render the collapse-all toggle inline with search.
  stickyToolbar = null,
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const tokens = useHeroSheetTokens();
  const {
    accentColor, dark, mutedColor, screenBg, borderColor,
    inputBg, inputBorderIdle,
  } = tokens;
  const accounting = useSettings('accounting');
  const vatRate = accounting?.vatRate ?? 5;

  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('ALL');
  const [groupOpen, setGroupOpen] = useState({});

  const onRefresh = async () => {
    setRefreshing(true);
    try { await deltaSync(); } catch (e) { console.error(e); }
    setRefreshing(false);
  };

  const showBatchChips = Array.isArray(batchOptions) && batchOptions.length > 1;

  const ordersAfterBatch = useMemo(() => {
    if (!showBatchChips || !batchFilter || batchFilter === 'ALL') return feedOrders;
    return feedOrders.filter((o) => {
      const bId = typeof o.batch === 'object' ? o.batch?._id : o.batch;
      return bId === batchFilter;
    });
  }, [feedOrders, batchFilter, showBatchChips]);

  const q = searchQuery.toLowerCase();

  // Aggregate per-feed-type stats for the legacy chip filter row. The
  // hero card itself does its own aggregation (see FeedMixHeroCard) so
  // that callers passing `hideHero` and `hideTypeChips` don't pay the
  // extra cost.
  const feedByType = useMemo(() => {
    if (hideTypeChips) return {};
    const groups = {};
    ordersAfterBatch.forEach((order) => {
      (order.items || []).forEach((item) => {
        const type = item.feedType || 'OTHER';
        const bags = item.bags || 0;
        const itemKg = bags * (item.quantitySize || 50);
        if (!groups[type]) groups[type] = { totalKg: 0, totalBags: 0, totalCost: 0 };
        groups[type].totalKg += itemKg;
        groups[type].totalBags += bags;
        groups[type].totalCost += itemCostWithVat(item, vatRate);
      });
    });
    return groups;
  }, [ordersAfterBatch, hideTypeChips, vatRate]);

  const otherFeedTotalKg = useMemo(() => Object.entries(feedByType)
    .filter(([type]) => !FEED_TYPES_DISPLAYED.includes(type))
    .reduce((sum, [, g]) => sum + g.totalKg, 0),
  [feedByType]);

  // External feed-type filter (multi-select array from the parent)
  // takes precedence over the legacy chip filter. An empty/missing
  // external filter falls back to the chip's single-select string.
  const externalTypeActive = Array.isArray(feedTypeFilter) && feedTypeFilter.length > 0;

  const flatItems = useMemo(() => {
    const items = [];
    ordersAfterBatch.forEach((order) => {
      (order.items || []).forEach((item) => {
        items.push({
          ...item,
          orderDate: order.orderDate,
          companyName: order.feedCompany?.companyName,
          orderId: order._id,
        });
      });
    });
    return items
      .filter((it) => {
        const type = it.feedType || 'OTHER';
        if (externalTypeActive) return feedTypeFilter.includes(type);
        return filter === 'ALL' || type === filter;
      })
      .filter((it) =>
        !q
          || (it.feedDescription || '').toLowerCase().includes(q)
          || (it.companyName || '').toLowerCase().includes(q)
      );
  }, [ordersAfterBatch, filter, q, externalTypeActive, feedTypeFilter]);

  // Group filtered items by feed type — mirrors the date grouping in
  // SalesListView and category grouping in ExpensesListView, so the
  // user can collapse/expand each type and see per-type totals.
  const groupedByType = useMemo(() => {
    const groups = {};
    flatItems.forEach((item) => {
      const type = item.feedType || 'OTHER';
      const bags = item.bags || 0;
      const itemKg = bags * (item.quantitySize || 50);
      if (!groups[type]) {
        groups[type] = { items: [], totalKg: 0, totalBags: 0, totalCost: 0 };
      }
      groups[type].items.push(item);
      groups[type].totalKg += itemKg;
      groups[type].totalBags += bags;
      groups[type].totalCost += itemCostWithVat(item, vatRate);
    });
    Object.values(groups).forEach((g) => {
      g.items.sort((a, b) => new Date(b.orderDate || 0) - new Date(a.orderDate || 0));
    });
    return Object.entries(groups).sort(
      ([a], [b]) => (FEED_TYPE_ORDER[a] ?? 99) - (FEED_TYPE_ORDER[b] ?? 99)
    );
  }, [flatItems, vatRate]);

  const filterOptions = useMemo(() => {
    const options = [{ value: 'ALL', label: t('batches.filterAll', 'All') }];
    FEED_TYPES_DISPLAYED.forEach((type) => {
      if ((feedByType[type]?.totalKg || 0) > 0) {
        options.push({
          value: type,
          label: t(`feed.feedTypes.${type}`, type),
          icon: Wheat,
        });
      }
    });
    if (otherFeedTotalKg > 0) {
      options.push({
        value: 'OTHER',
        label: t('feed.feedTypes.OTHER', 'Other'),
        icon: Wheat,
      });
    }
    return options;
  }, [feedByType, otherFeedTotalKg, t]);

  const allExpanded = groupedByType.every(([type]) => groupOpen[type] ?? true);
  const toggleAll = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const next = {};
    groupedByType.forEach(([type]) => { next[type] = !allExpanded; });
    setGroupOpen(next);
  };
  const toggleGroup = (key) =>
    setGroupOpen((p) => ({ ...p, [key]: !(p[key] ?? true) }));

  if (loading && feedOrders.length === 0) {
    return <SkeletonFeedOrdersTab />;
  }

  // The collapse-all toggle is meaningful only when there are 2+ feed
  // type groups. When the parent passes `stickyToolbar` as a function,
  // we feed them this button via `{ collapseButton }` so they can
  // render it INSIDE the toolbar (alongside search) instead of letting
  // it land in a separate row beneath. Element-form `stickyToolbar` is
  // kept for back-compat — in that case the standalone collapse row
  // still renders.
  const collapseButton = groupedByType.length > 1 ? (
    <Pressable
      onPress={toggleAll}
      android_ripple={{
        color: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
        borderless: false,
      }}
      style={[
        styles.collapseBtn,
        { backgroundColor: inputBg, borderColor: inputBorderIdle },
      ]}
      hitSlop={4}
      accessibilityRole="button"
      accessibilityLabel={allExpanded
        ? t('common.collapseAll', 'Collapse all')
        : t('common.expandAll', 'Expand all')}
    >
      {allExpanded
        ? <ChevronsDownUp size={18} color={mutedColor} strokeWidth={2.2} />
        : <ChevronsUpDown size={18} color={mutedColor} strokeWidth={2.2} />}
    </Pressable>
  ) : null;

  const stickyToolbarNode = typeof stickyToolbar === 'function'
    ? stickyToolbar({ collapseButton })
    : stickyToolbar;
  const collapseButtonOwnedByToolbar = typeof stickyToolbar === 'function';

  // When the parent passes a sticky toolbar we let the ScrollView's
  // contentContainer skip its own paddingTop — the headerComponent (KPI
  // hero) and stickyToolbar (search + pills) own their own top spacing.
  const usingExternalChrome = !!(headerComponent || stickyToolbarNode);
  const stickyIndices = stickyToolbarNode
    ? [headerComponent ? 1 : 0]
    : undefined;

  return (
    <View style={{ flex: 1, backgroundColor: screenBg }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingTop: usingExternalChrome ? 0 : 16,
          paddingBottom: insets.bottom + (onAdd ? 120 : 32),
        }}
        stickyHeaderIndices={stickyIndices}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={accentColor}
            colors={[accentColor]}
            progressBackgroundColor={dark ? 'hsl(150, 18%, 14%)' : '#ffffff'}
          />
        }
      >
        {headerComponent ? <View>{headerComponent}</View> : null}
        {stickyToolbarNode ? <View>{stickyToolbarNode}</View> : null}

        {!hideHero ? (
          <FeedMixHeroCard
            feedOrders={ordersAfterBatch}
            feedTypeFilter={filter === 'ALL' ? [] : [filter]}
          />
        ) : null}

        {showBatchChips ? (
          <View style={{ marginBottom: 12 }}>
            <FilterChips
              value={batchFilter || 'ALL'}
              onChange={onBatchFilterChange}
              options={batchOptions.map((opt) => ({ ...opt, icon: opt.icon || Layers }))}
            />
          </View>
        ) : null}

        {!hideTypeChips && filterOptions.length > 1 ? (
          <View style={{ marginBottom: 12 }}>
            <FilterChips value={filter} onChange={setFilter} options={filterOptions} />
          </View>
        ) : null}

        {!hideSearch ? (
          <View
            style={[
              styles.searchRow,
              { marginHorizontal: 16, marginBottom: 12 },
            ]}
          >
            <View style={{ flex: 1 }}>
              <SheetInput
                icon={Search}
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder={t('common.search', 'Search...')}
                autoCapitalize="none"
                autoCorrect={false}
                dense
                suffix={
                  searchQuery ? (
                    <Pressable
                      onPress={() => setSearchQuery('')}
                      hitSlop={10}
                      style={styles.searchClearBtn}
                    >
                      <X size={14} color={mutedColor} />
                    </Pressable>
                  ) : null
                }
              />
            </View>
            {groupedByType.length > 1 ? (
              <Pressable
                onPress={toggleAll}
                android_ripple={{
                  color: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                  borderless: false,
                }}
                style={[
                  styles.collapseBtn,
                  { backgroundColor: inputBg, borderColor: inputBorderIdle },
                ]}
                hitSlop={4}
                accessibilityRole="button"
                accessibilityLabel={allExpanded
                  ? t('common.collapseAll', 'Collapse all')
                  : t('common.expandAll', 'Expand all')}
              >
                {allExpanded
                  ? <ChevronsDownUp size={18} color={mutedColor} strokeWidth={2.2} />
                  : <ChevronsUpDown size={18} color={mutedColor} strokeWidth={2.2} />}
              </Pressable>
            ) : null}
          </View>
        ) : (
          groupedByType.length > 1 && !collapseButtonOwnedByToolbar ? (
            <View style={{ paddingHorizontal: 16, paddingBottom: 8, alignItems: 'flex-end' }}>
              <Pressable
                onPress={toggleAll}
                android_ripple={{
                  color: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                  borderless: false,
                }}
                style={[
                  styles.collapseBtn,
                  {
                    width: 36,
                    height: 36,
                    backgroundColor: inputBg,
                    borderColor: inputBorderIdle,
                  },
                ]}
                hitSlop={4}
                accessibilityRole="button"
                accessibilityLabel={allExpanded
                  ? t('common.collapseAll', 'Collapse all')
                  : t('common.expandAll', 'Expand all')}
              >
                {allExpanded
                  ? <ChevronsDownUp size={16} color={mutedColor} strokeWidth={2.2} />
                  : <ChevronsUpDown size={16} color={mutedColor} strokeWidth={2.2} />}
              </Pressable>
            </View>
          ) : null
        )}

        {groupedByType.length === 0 ? (
          <EmptyState
            icon={Wheat}
            title={
              searchQuery || filter !== 'ALL' || externalTypeActive
                ? t('common.noResults', 'No results')
                : (emptyTitle || t('batches.noFeedOrders', 'No feed orders'))
            }
          />
        ) : (
          <SheetSection padded={false}>
            <View>
              {groupedByType.map(([type, { items, totalKg, totalCost }]) => (
                <ExpenseCategoryGroup
                  key={type}
                  label={t(`feed.feedTypes.${type}`, type)}
                  pills={[
                    { value: `${fmtInt(totalKg)} kg` },
                    { value: fmt(totalCost) },
                  ]}
                  open={groupOpen[type] ?? true}
                  onToggle={() => toggleGroup(type)}
                >
                  {items.map((item, i) => (
                    <View
                      key={item._id || `${item.orderId}-${i}`}
                      style={i > 0
                        ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: borderColor }
                        : null}
                    >
                      <FeedItemRow
                        item={item}
                        onClick={() => { if (item.orderId) router.push(`/(app)/feed-order/${item.orderId}`); }}
                      />
                    </View>
                  ))}
                </ExpenseCategoryGroup>
              ))}
            </View>
          </SheetSection>
        )}
      </ScrollView>

      {onAdd ? (
        <Pressable
          onPress={onAdd}
          android_ripple={{ color: 'rgba(255,255,255,0.18)', borderless: true, radius: 32 }}
          style={({ pressed }) => [
            styles.fab,
            {
              bottom: insets.bottom + 88,
              backgroundColor: accentColor,
              opacity: pressed ? 0.9 : 1,
              transform: [{ scale: pressed ? 0.95 : 1 }],
            },
          ]}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={addLabel || t('common.add', 'Add')}
        >
          <Plus size={26} color="#ffffff" strokeWidth={2.6} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  searchClearBtn: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 11,
  },
  collapseBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fab: {
    position: 'absolute',
    right: 16,
    height: 56,
    width: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.22,
        shadowRadius: 12,
      },
      android: { elevation: 8 },
    }),
  },
});
