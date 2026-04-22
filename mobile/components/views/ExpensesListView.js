import { useMemo, useState } from 'react';
import {
  View, Text, ScrollView, Pressable, RefreshControl, LayoutAnimation, StyleSheet, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import {
  Receipt, ChevronsDownUp, ChevronsUpDown, Plus, Layers,
  Calendar, Search, X, Tag,
} from 'lucide-react-native';
import { useHeroSheetTokens } from '@/components/HeroSheetScreen';
import SheetSection from '@/components/SheetSection';
import SheetInput from '@/components/SheetInput';
import EmptyState from '@/components/ui/EmptyState';
import ExpenseRow from '@/modules/broiler/rows/ExpenseRow';
import ExpenseCategoryGroup from '@/components/rows/ExpenseCategoryGroup';
import { SkeletonExpensesTab } from '@/components/skeletons';
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

export default function ExpensesListView({
  expenses = [],
  loading = false,
  onAdd,
  addLabel,
  emptyTitle,
  batchOptions,
  batchFilter,
  onBatchFilterChange,
  hideHero = false,
  hideSearch = false,
  hideCategoryChips = false,
  // When set, the parent provides custom header content (typically the
  // AccountingHero KPI card) that scrolls AWAY with the rest of the list.
  headerComponent = null,
  // When set, the parent provides a toolbar (typically AccountingToolbar)
  // that becomes a STICKY header inside this scroll view.
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
  const [filter, setFilter] = useState('ALL');
  const [catOpen, setCatOpen] = useState({});

  const onRefresh = async () => {
    setRefreshing(true);
    try { await deltaSync(); } catch (e) { console.error(e); }
    setRefreshing(false);
  };

  const q = searchQuery.toLowerCase();

  const showBatchChips = Array.isArray(batchOptions) && batchOptions.length > 1;

  const expensesAfterBatch = useMemo(() => {
    if (!showBatchChips || !batchFilter || batchFilter === 'ALL') return expenses;
    return expenses.filter((e) => {
      const bId = typeof e.batch === 'object' ? e.batch?._id : e.batch;
      return bId === batchFilter;
    });
  }, [expenses, batchFilter, showBatchChips]);

  const categoryTotals = useMemo(() => {
    const groups = {};
    expensesAfterBatch.forEach((e) => {
      const cat = e.category || 'OTHERS';
      groups[cat] = (groups[cat] || 0) + (e.totalAmount || 0);
    });
    return Object.entries(groups).sort(([, a], [, b]) => b - a);
  }, [expensesAfterBatch]);

  const filteredExpenses = useMemo(() => {
    return expensesAfterBatch
      .filter((e) => filter === 'ALL' || (e.category || 'OTHERS') === filter)
      .filter((e) =>
        !q
          || (e.description || '').toLowerCase().includes(q)
          || (e.tradingCompany?.companyName || '').toLowerCase().includes(q)
      );
  }, [expensesAfterBatch, filter, q]);

  const groupedByCategory = useMemo(() => {
    const groups = {};
    filteredExpenses.forEach((e) => {
      const cat = e.category || 'OTHERS';
      if (!groups[cat]) groups[cat] = { items: [], total: 0 };
      groups[cat].items.push(e);
      groups[cat].total += e.totalAmount || 0;
    });
    Object.values(groups).forEach((g) => {
      g.items.sort((a, b) => new Date(b.expenseDate || 0) - new Date(a.expenseDate || 0));
    });
    return Object.entries(groups).sort(([, a], [, b]) => b.total - a.total);
  }, [filteredExpenses]);

  const heroStats = useMemo(() => {
    const total = filteredExpenses.reduce((s, x) => s + (x.totalAmount || 0), 0);
    const lastDate = filteredExpenses.reduce((max, e) => {
      if (!e.expenseDate) return max;
      const d = new Date(e.expenseDate);
      return !max || d > max ? d : max;
    }, null);
    const largest = groupedByCategory[0]?.[0] || null;
    return { total, count: filteredExpenses.length, largest, lastDate };
  }, [filteredExpenses, groupedByCategory]);

  const filterOptions = useMemo(() => {
    const options = [];
    if (categoryTotals.length > 1) {
      options.push({ value: 'ALL', label: t('batches.filterAll', 'All') });
    }
    categoryTotals.forEach(([cat]) => {
      options.push({
        value: cat,
        label: t(`batches.expenseCategories.${cat}`, cat),
        icon: Receipt,
      });
    });
    return options;
  }, [categoryTotals, t]);

  const allExpanded = groupedByCategory.every(([cat]) => catOpen[cat] ?? true);
  const toggleAll = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const next = {};
    groupedByCategory.forEach(([cat]) => { next[cat] = !allExpanded; });
    setCatOpen(next);
  };
  const toggleCat = (key) =>
    setCatOpen((p) => ({ ...p, [key]: !(p[key] ?? true) }));

  const showLastDate = filter !== 'ALL';
  const lastDateLabel = formatRelativeDate(heroStats.lastDate, t);

  if (loading && expenses.length === 0) {
    return <SkeletonExpensesTab />;
  }

  // The collapse-all toggle is meaningful only when there are 2+ category
  // groups. When the parent passes `stickyToolbar` as a function, we feed
  // them this button via `{ collapseButton }` so they can render it
  // INSIDE the toolbar (alongside search) instead of letting it land in a
  // separate row beneath. Element-form `stickyToolbar` is kept for
  // back-compat — in that case the standalone collapse row still renders.
  const collapseButton = groupedByCategory.length > 1 ? (
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
          <ListViewHeroKpi
            title={t('batches.expensesSummary', 'Expenses')}
            icon={Receipt}
            headline={fmt(heroStats.total)}
            stats={[
              {
                icon: Layers,
                label: t('batches.entries', 'Entries'),
                value: fmtInt(heroStats.count),
              },
              showLastDate
                ? {
                    icon: Calendar,
                    label: t('batches.lastEntry', 'Last Entry'),
                    value: lastDateLabel || '—',
                  }
                : {
                    icon: Tag,
                    label: t('batches.largestCategory', 'Largest'),
                    value: heroStats.largest
                      ? t(`batches.expenseCategories.${heroStats.largest}`, heroStats.largest)
                      : '—',
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

        {!hideCategoryChips && filterOptions.length > 1 ? (
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
            {groupedByCategory.length > 1 ? (
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
          groupedByCategory.length > 1 && !collapseButtonOwnedByToolbar ? (
            <View style={{ paddingHorizontal: 16, paddingBottom: 8, alignItems: 'flex-end' }}>
              <Pressable
                onPress={toggleAll}
                android_ripple={{
                  color: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                  borderless: false,
                }}
                style={[
                  styles.collapseBtn,
                  { width: 36, height: 36, backgroundColor: inputBg, borderColor: inputBorderIdle },
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

        {filteredExpenses.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title={
              searchQuery || filter !== 'ALL'
                ? t('common.noResults', 'No results')
                : (emptyTitle || t('batches.noExpenses', 'No expenses'))
            }
          />
        ) : (
          <SheetSection padded={false}>
            <View>
              {groupedByCategory.map(([category, { items, total }]) => (
                <ExpenseCategoryGroup
                  key={category}
                  label={t(`batches.expenseCategories.${category}`, category)}
                  total={total}
                  count={items.length}
                  open={catOpen[category] ?? true}
                  onToggle={() => toggleCat(category)}
                >
                  {items.map((expense) => (
                    <ExpenseRow
                      key={expense._id}
                      expense={expense}
                      categoryLabel={t(`batches.expenseCategories.${expense.category}`, expense.category)}
                      onClick={() => router.push(`/(app)/expense/${expense._id}`)}
                    />
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
