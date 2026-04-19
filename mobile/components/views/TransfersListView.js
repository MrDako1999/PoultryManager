import { useMemo, useState } from 'react';
import {
  View, Text, ScrollView, Pressable, RefreshControl, LayoutAnimation, StyleSheet, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeftRight, ChevronsDownUp, ChevronsUpDown, Plus,
  Calendar, Search, X, Receipt,
} from 'lucide-react-native';
import { useHeroSheetTokens } from '@/components/HeroSheetScreen';
import SheetSection from '@/components/SheetSection';
import SheetInput from '@/components/SheetInput';
import EmptyState from '@/components/ui/EmptyState';
import TransferRow from '@/components/rows/TransferRow';
import ExpenseCategoryGroup from '@/components/rows/ExpenseCategoryGroup';
import { SkeletonRow } from '@/components/skeletons';
import { deltaSync } from '@/lib/syncEngine';
import ListViewHeroKpi from '@/components/views/ListViewHeroKpi';

const NUMERIC_LOCALE = 'en-US';

const fmt = (val) =>
  Number(val || 0).toLocaleString(NUMERIC_LOCALE, {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  });

const fmtInt = (val) => Number(val || 0).toLocaleString(NUMERIC_LOCALE);

const fmtRelativeDate = (val) => {
  if (!val) return null;
  const d = val instanceof Date ? val : new Date(val);
  if (Number.isNaN(d.getTime())) return null;
  const today = new Date();
  const days = Math.floor((today - d) / 86400000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString(NUMERIC_LOCALE, { day: '2-digit', month: 'short' });
};

/**
 * TransfersListView — full-bleed transfers list mirroring the SalesListView /
 * ExpensesListView contract.
 *
 * Architecture:
 *   - Internal hero (ListViewHeroKpi) — disabled with `hideHero` when the
 *     parent provides a richer header via `headerComponent`.
 *   - Internal search row — disabled with `hideSearch` when the parent
 *     provides a sticky toolbar via `stickyToolbar`.
 *   - Date-grouped list using ExpenseCategoryGroup with per-day total +
 *     entry-count pills.
 *   - FAB (when `onAdd` is set) and a token-driven empty state.
 *
 * The `stickyToolbar` prop accepts either a React element or a render
 * function. When passed a function we feed a `{ collapseButton }` arg so
 * the toolbar can render the toggle inline with search instead of letting
 * it land in a separate row beneath.
 *
 * Layout in StyleSheet (DL §9 trap rule). Press-state visuals on the
 * Pressables use functional style only.
 */
export default function TransfersListView({
  transfers = [],
  loading = false,
  onAdd,
  addLabel,
  emptyTitle,
  onRowPress,
  hideHero = false,
  hideSearch = false,
  headerComponent = null,
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

  const q = searchQuery.toLowerCase();

  const filteredTransfers = useMemo(() => {
    if (!q) return transfers;
    return transfers.filter((tr) =>
      (tr.notes || '').toLowerCase().includes(q)
      || (tr.business?.companyName || '').toLowerCase().includes(q)
      || (tr.transferType || '').toLowerCase().includes(q)
    );
  }, [transfers, q]);

  const groupedByDate = useMemo(() => {
    const groups = {};
    filteredTransfers.forEach((tr) => {
      const key = tr.transferDate
        ? new Date(tr.transferDate).toISOString().slice(0, 10)
        : 'no-date';
      if (!groups[key]) groups[key] = { items: [], total: 0 };
      groups[key].items.push(tr);
      groups[key].total += tr.amount || 0;
    });
    Object.values(groups).forEach((g) => {
      g.items.sort((a, b) =>
        new Date(b.transferDate || 0) - new Date(a.transferDate || 0)
      );
    });
    return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a));
  }, [filteredTransfers]);

  const heroStats = useMemo(() => {
    const total = filteredTransfers.reduce((s, x) => s + (x.amount || 0), 0);
    const lastDate = filteredTransfers.reduce((max, tr) => {
      if (!tr.transferDate) return max;
      const d = new Date(tr.transferDate);
      return !max || d > max ? d : max;
    }, null);
    return { total, count: filteredTransfers.length, lastDate };
  }, [filteredTransfers]);

  const allExpanded = groupedByDate.every(([key]) => groupOpen[key] ?? true);
  const toggleAll = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const next = {};
    groupedByDate.forEach(([key]) => { next[key] = !allExpanded; });
    setGroupOpen(next);
  };
  const toggleGroup = (key) =>
    setGroupOpen((p) => ({ ...p, [key]: !(p[key] ?? true) }));

  const lastDateLabel = fmtRelativeDate(heroStats.lastDate);

  if (loading && transfers.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: screenBg, paddingTop: 16 }}>
        <View style={{ paddingHorizontal: 16, gap: 10 }}>
          {[1, 2, 3, 4].map((i) => <SkeletonRow key={i} />)}
        </View>
      </View>
    );
  }

  // Collapse-all toggle is only meaningful when there are 2+ groups. When
  // the parent passes `stickyToolbar` as a function we feed them this
  // button so they can render it inline with search.
  const collapseButton = groupedByDate.length > 1 ? (
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
  // contentContainer skip its own paddingTop — the headerComponent and
  // stickyToolbar own their own top spacing.
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
            title={t('transfers.title', 'Transfers')}
            icon={ArrowLeftRight}
            headline={fmt(heroStats.total)}
            stats={[
              {
                icon: Receipt,
                label: t('batches.entries', 'Entries'),
                value: fmtInt(heroStats.count),
              },
              {
                icon: Calendar,
                label: t('transfers.lastTransfer', 'Last Transfer'),
                value: lastDateLabel || '—',
              },
            ]}
          />
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
            {groupedByDate.length > 1 ? (
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
          groupedByDate.length > 1 && !collapseButtonOwnedByToolbar ? (
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

        {filteredTransfers.length === 0 ? (
          <EmptyState
            icon={ArrowLeftRight}
            title={searchQuery
              ? t('common.noResults', 'No results')
              : (emptyTitle || t('transfers.noTransfers', 'No transfers yet'))}
          />
        ) : (
          <SheetSection padded={false}>
            <View>
              {groupedByDate.map(([dateKey, { items, total }]) => (
                <ExpenseCategoryGroup
                  key={dateKey}
                  label={dateKey === 'no-date'
                    ? t('common.noDate', 'No Date')
                    : new Date(`${dateKey}T00:00:00`).toLocaleDateString(NUMERIC_LOCALE, {
                        day: '2-digit', month: 'short', year: 'numeric',
                      })}
                  pills={[{ value: fmt(total) }, { value: fmtInt(items.length) }]}
                  open={groupOpen[dateKey] ?? true}
                  onToggle={() => toggleGroup(dateKey)}
                >
                  {items.map((transfer) => (
                    <TransferRow
                      key={transfer._id}
                      transfer={transfer}
                      onClick={() => onRowPress?.(transfer)}
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
          accessibilityLabel={addLabel || t('transfers.addTransfer', 'Add Transfer')}
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
