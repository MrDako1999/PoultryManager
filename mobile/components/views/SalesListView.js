import { useMemo, useState } from 'react';
import {
  View, Text, ScrollView, Pressable, RefreshControl, LayoutAnimation, StyleSheet, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import {
  ShoppingCart, ChevronsDownUp, ChevronsUpDown, Plus, Layers,
  Receipt, Calendar, Search, X, TrendingUp,
} from 'lucide-react-native';
import { useHeroSheetTokens } from '@/components/HeroSheetScreen';
import SheetSection from '@/components/SheetSection';
import SheetInput from '@/components/SheetInput';
import EmptyState from '@/components/ui/EmptyState';
import SaleRow from '@/modules/broiler/rows/SaleRow';
import ExpenseCategoryGroup from '@/components/rows/ExpenseCategoryGroup';
import { SkeletonRow } from '@/components/skeletons';
import { deltaSync } from '@/lib/syncEngine';
import FilterChips from '@/components/views/FilterChips';
import ListViewHeroKpi from '@/components/views/ListViewHeroKpi';
import { formatRelativeDate } from '@/lib/relativeDate';

const NUMERIC_LOCALE = 'en-US';

const fmt = (val) =>
  Number(val || 0).toLocaleString(NUMERIC_LOCALE, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const fmtInt = (val) => Number(val || 0).toLocaleString(NUMERIC_LOCALE);

export default function SalesListView({
  sales = [],
  loading = false,
  onAdd,
  addLabel,
  emptyTitle,
  batchOptions,
  batchFilter,
  onBatchFilterChange,
  hideHero = false,
  hideSearch = false,
  // When set, the parent provides custom header content (typically the
  // AccountingHero KPI card) that scrolls AWAY with the rest of the list.
  headerComponent = null,
  // When set, the parent provides a toolbar (typically AccountingToolbar)
  // that becomes a STICKY header inside this scroll view. Must be a single
  // React element so React Native's stickyHeaderIndices can target it.
  stickyToolbar = null,
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const tokens = useHeroSheetTokens();
  const {
    accentColor, dark, mutedColor, screenBg, inputBg, inputBorderIdle,
  } = tokens;

  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [groupOpen, setGroupOpen] = useState({});

  const onRefresh = async () => {
    setRefreshing(true);
    try { await deltaSync(); } catch (e) { console.error(e); }
    setRefreshing(false);
  };

  const showBatchChips = Array.isArray(batchOptions) && batchOptions.length > 1;

  const salesAfterBatch = useMemo(() => {
    if (!showBatchChips || !batchFilter || batchFilter === 'ALL') return sales;
    return sales.filter((s) => {
      const bId = typeof s.batch === 'object' ? s.batch?._id : s.batch;
      return bId === batchFilter;
    });
  }, [sales, batchFilter, showBatchChips]);

  const q = searchQuery.toLowerCase();

  const filteredSales = useMemo(() => {
    if (!q) return salesAfterBatch;
    return salesAfterBatch.filter((s) =>
      (s.customer?.companyName || '').toLowerCase().includes(q)
      || (s.saleNumber || '').toLowerCase().includes(q)
    );
  }, [salesAfterBatch, q]);

  const sortedSaleDates = useMemo(() => {
    const groups = {};
    filteredSales.forEach((sale) => {
      const key = sale.saleDate ? new Date(sale.saleDate).toISOString().slice(0, 10) : 'no-date';
      if (!groups[key]) groups[key] = { items: [], revenue: 0 };
      groups[key].items.push(sale);
      groups[key].revenue += sale.totals?.grandTotal || 0;
    });
    return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a));
  }, [filteredSales]);

  const heroStats = useMemo(() => {
    const total = filteredSales.reduce((s, x) => s + (x.totals?.grandTotal || 0), 0);
    const lastDate = filteredSales.reduce((max, s) => {
      if (!s.saleDate) return max;
      const d = new Date(s.saleDate);
      return !max || d > max ? d : max;
    }, null);
    return { total, count: filteredSales.length, lastDate };
  }, [filteredSales]);

  const allExpanded = sortedSaleDates.every(([key]) => groupOpen[key] ?? true);
  const toggleAll = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const next = {};
    sortedSaleDates.forEach(([key]) => { next[key] = !allExpanded; });
    setGroupOpen(next);
  };
  const toggleGroup = (key) =>
    setGroupOpen((p) => ({ ...p, [key]: !(p[key] ?? true) }));

  const lastDateLabel = formatRelativeDate(heroStats.lastDate, t);

  if (loading && sales.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: screenBg, paddingTop: 16 }}>
        <View style={{ paddingHorizontal: 16, gap: 10 }}>
          {[1, 2, 3, 4].map((i) => <SkeletonRow key={i} />)}
        </View>
      </View>
    );
  }

  // The collapse-all toggle is meaningful only when there are 2+ date
  // groups. When the parent passes `stickyToolbar` as a function, we feed
  // them this button via `{ collapseButton }` so they can render it
  // INSIDE the toolbar (alongside search) instead of letting it land in a
  // separate row beneath. Element-form `stickyToolbar` is kept for
  // back-compat — in that case the standalone collapse row still renders.
  const collapseButton = sortedSaleDates.length > 1 ? (
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
  // Suppress the standalone collapse row when the parent has consumed the
  // collapse button via the function-form `stickyToolbar`.
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
          <ListViewHeroKpi
            title={t('batches.totalRevenue', 'Total Revenue')}
            icon={TrendingUp}
            headline={fmt(heroStats.total)}
            stats={[
              {
                icon: Receipt,
                label: t('batches.entries', 'Entries'),
                value: fmtInt(heroStats.count),
              },
              {
                icon: Calendar,
                label: t('batches.lastEntry', 'Last Entry'),
                value: lastDateLabel || '—',
              },
            ]}
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
            {sortedSaleDates.length > 1 ? (
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
                accessibilityLabel={allExpanded ? t('common.collapseAll', 'Collapse all') : t('common.expandAll', 'Expand all')}
              >
                {allExpanded
                  ? <ChevronsDownUp size={18} color={mutedColor} strokeWidth={2.2} />
                  : <ChevronsUpDown size={18} color={mutedColor} strokeWidth={2.2} />}
              </Pressable>
            ) : null}
          </View>
        ) : (
          sortedSaleDates.length > 1 && !collapseButtonOwnedByToolbar ? (
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
                accessibilityLabel={allExpanded ? t('common.collapseAll', 'Collapse all') : t('common.expandAll', 'Expand all')}
              >
                {allExpanded
                  ? <ChevronsDownUp size={16} color={mutedColor} strokeWidth={2.2} />
                  : <ChevronsUpDown size={16} color={mutedColor} strokeWidth={2.2} />}
              </Pressable>
            </View>
          ) : null
        )}

        {filteredSales.length === 0 ? (
          <EmptyState
            icon={ShoppingCart}
            title={searchQuery ? t('common.noResults', 'No results') : (emptyTitle || t('batches.noSales', 'No sales'))}
          />
        ) : (
          <SheetSection padded={false}>
            <View>
              {sortedSaleDates.map(([dateKey, { items, revenue }]) => (
                <ExpenseCategoryGroup
                  key={dateKey}
                  label={dateKey === 'no-date'
                    ? t('common.noDate', 'No Date')
                    : new Date(`${dateKey}T00:00:00`).toLocaleDateString(NUMERIC_LOCALE, { day: '2-digit', month: 'short', year: 'numeric' })}
                  pills={[{ value: fmt(revenue) }, { value: fmtInt(items.length) }]}
                  open={groupOpen[dateKey] ?? true}
                  onToggle={() => toggleGroup(dateKey)}
                >
                  {items.map((sale) => (
                    <SaleRow key={sale._id} sale={sale} onClick={() => router.push(`/(app)/sale/${sale._id}`)} />
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
