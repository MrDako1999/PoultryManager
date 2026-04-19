import { useMemo, useState } from 'react';
import {
  View, Text, ScrollView, Pressable, RefreshControl, StyleSheet, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import {
  Egg, DollarSign, Plus, Layers, Calendar, Search, X,
} from 'lucide-react-native';
import { useHeroSheetTokens } from '@/components/HeroSheetScreen';
import SheetSection from '@/components/SheetSection';
import SheetInput from '@/components/SheetInput';
import EmptyState from '@/components/ui/EmptyState';
import SourceRow from '@/modules/broiler/rows/SourceRow';
import { SkeletonSourcesTab } from '@/components/skeletons';
import { deltaSync } from '@/lib/syncEngine';
import FilterChips from '@/components/views/FilterChips';
import ListViewHeroKpi from '@/components/views/ListViewHeroKpi';

const NUMERIC_LOCALE = 'en-US';

const fmt = (val) =>
  Number(val || 0).toLocaleString(NUMERIC_LOCALE, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
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

export default function SourcesListView({
  sources = [],
  loading = false,
  onAdd,
  addLabel,
  emptyTitle,
  batchOptions,
  batchFilter,
  onBatchFilterChange,
  hideHero = false,
  hideSearch = false,
  // When set, the parent provides custom header content (typically a
  // SourcesHero KPI card) that scrolls AWAY with the rest of the list.
  headerComponent = null,
  // When set, the parent provides a toolbar (typically AccountingToolbar)
  // that becomes a STICKY header inside this scroll view. Function-form is
  // supported for parity with sibling list views that inject a collapse
  // button — Sources is flat so we always pass `collapseButton: null`.
  stickyToolbar = null,
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const tokens = useHeroSheetTokens();
  const {
    accentColor, dark, mutedColor, screenBg,
  } = tokens;

  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    try { await deltaSync(); } catch (e) { console.error(e); }
    setRefreshing(false);
  };

  const showBatchChips = Array.isArray(batchOptions) && batchOptions.length > 1;

  const sourcesAfterBatch = useMemo(() => {
    if (!showBatchChips || !batchFilter || batchFilter === 'ALL') return sources;
    return sources.filter((s) => {
      const bId = typeof s.batch === 'object' ? s.batch?._id : s.batch;
      return bId === batchFilter;
    });
  }, [sources, batchFilter, showBatchChips]);

  const q = searchQuery.toLowerCase();
  const filtered = useMemo(() => {
    if (!q) return sourcesAfterBatch;
    return sourcesAfterBatch.filter((s) =>
      (s.sourceFrom?.companyName || '').toLowerCase().includes(q)
    );
  }, [sourcesAfterBatch, q]);

  const totalChicks = useMemo(
    () => sourcesAfterBatch.reduce((s, x) => s + (x.totalChicks || 0), 0),
    [sourcesAfterBatch]
  );
  const totalCost = useMemo(
    () => sourcesAfterBatch.reduce((s, x) => s + (x.grandTotal || 0), 0),
    [sourcesAfterBatch]
  );
  const lastDeliveryDate = useMemo(
    () =>
      sourcesAfterBatch.reduce((max, s) => {
        if (!s.deliveryDate) return max;
        const d = new Date(s.deliveryDate);
        return !max || d > max ? d : max;
      }, null),
    [sourcesAfterBatch]
  );
  const costPerChick = totalChicks > 0 ? totalCost / totalChicks : null;
  const lastDeliveryLabel = fmtRelativeDate(lastDeliveryDate);

  if (loading && sources.length === 0) {
    return <SkeletonSourcesTab />;
  }

  const stickyToolbarNode = typeof stickyToolbar === 'function'
    ? stickyToolbar({ collapseButton: null })
    : stickyToolbar;

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
            title={t('batches.sourcesSummary', 'Sources')}
            icon={Egg}
            headline={fmtInt(totalChicks)}
            subline={`${fmt(totalCost)}  ·  ${t('batches.totalCost', 'Total Cost').toLowerCase()}`}
            stats={[
              {
                icon: Layers,
                label: t('batches.entries', 'Entries'),
                value: fmtInt(sourcesAfterBatch.length),
              },
              {
                icon: DollarSign,
                label: t('batches.costPerChick', 'Cost / Chick'),
                value: costPerChick != null ? fmt(costPerChick) : '—',
              },
              {
                icon: Calendar,
                label: t('batches.lastDelivery', 'Last Delivery'),
                value: lastDeliveryLabel || '—',
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
          <View style={{ marginHorizontal: 16, marginBottom: 12 }}>
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
        ) : null}

        {filtered.length === 0 ? (
          <EmptyState
            icon={Egg}
            title={searchQuery
              ? t('common.noResults', 'No results')
              : (emptyTitle || t('batches.noSources', 'No sources'))}
          />
        ) : (
          <SheetSection padded={false}>
            <View>
              {filtered.map((source, i) => (
                <View
                  key={source._id}
                  style={i > 0
                    ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: tokens.borderColor }
                    : null}
                >
                  <SourceRow
                    source={source}
                    onClick={() => router.push(`/(app)/source/${source._id}`)}
                  />
                </View>
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
  searchClearBtn: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 11,
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
