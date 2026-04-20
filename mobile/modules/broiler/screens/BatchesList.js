import { useState, useMemo, useRef, useCallback } from 'react';
import {
  View, Text, ScrollView, RefreshControl, Pressable, StyleSheet, Platform,
  LayoutAnimation, UIManager,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import {
  Search, ChevronDown, ChevronUp, ChevronRight, ChevronLeft,
  Layers, Warehouse, Pencil, Trash2, X, Calendar, Bird, RotateCcw,
  Clock, CheckCircle2, Filter, ChevronsDownUp, ChevronsUpDown,
} from 'lucide-react-native';
import useLocalQuery from '@/hooks/useLocalQuery';
import useOfflineMutation from '@/hooks/useOfflineMutation';
import { useHeroSheetTokens } from '@/components/HeroSheetScreen';
import SheetSection from '@/components/SheetSection';
import SheetInput from '@/components/SheetInput';
import DateRangePicker from '@/components/ui/DateRangePicker';
import EmptyState from '@/components/ui/EmptyState';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import BottomPickerSheet from '@/components/BottomPickerSheet';
import SyncIconButton from '@/components/SyncIconButton';
import QuickAddFAB from '@/components/QuickAddFAB';
import { SkeletonRow } from '@/components/skeletons';
import { useToast } from '@/components/ui/Toast';
import { useIsRTL } from '@/stores/localeStore';
import { deltaSync } from '@/lib/syncEngine';
import BatchSheet from '@/modules/broiler/sheets/BatchSheet';
import BatchAvatar from '@/modules/broiler/components/BatchAvatar';
import { getStatusConfig } from '@/modules/broiler/lib/batchStatusConfig';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const CYCLE_TARGET_DAYS = 35;
const NUMERIC_LOCALE = 'en-US';
const SWIPE_ACTION_WIDTH = 76;

const fmtInt = (val) => Number(val || 0).toLocaleString(NUMERIC_LOCALE);

function parseIsoDate(s) {
  if (!s) return null;
  const [y, m, d] = s.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function mortalityToneColor(pct, tokens) {
  if (pct >= 5) return tokens.errorColor;
  if (pct >= 2) return tokens.dark ? '#fbbf24' : '#d97706';
  return tokens.accentColor;
}

export default function BatchesScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const isRTL = useIsRTL();
  const tokens = useHeroSheetTokens();
  const {
    accentColor, dark, mutedColor, borderColor, screenBg, heroGradient,
  } = tokens;

  const { toast } = useToast();
  const { remove } = useOfflineMutation('batches');

  const [searchQuery, setSearchQuery] = useState('');
  const [farmFilter, setFarmFilter] = useState([]);
  // dateRange = { from?: 'YYYY-MM-DD', to?: 'YYYY-MM-DD' } | null
  const [dateRange, setDateRange] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateSheetOpen, setDateSheetOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [batchSheet, setBatchSheet] = useState({ open: false, data: null });
  const [batchToDelete, setBatchToDelete] = useState(null);
  // Lifted from the per-group component so the toolbar's collapse-all
  // button can flip every farm group at once. Map of `farmId -> open`;
  // groups missing from the map default to true (matches the previous
  // local-state default and the BatchHouseLogsList recipe).
  const [groupOpen, setGroupOpen] = useState({});

  const farmPickerRef = useRef(null);
  const statusPickerRef = useRef(null);

  const [allBatches, batchesLoading] = useLocalQuery('batches');
  const [farms] = useLocalQuery('farms');
  const [allSaleOrders] = useLocalQuery('saleOrders');
  const [dailyLogs] = useLocalQuery('dailyLogs');

  const farmsById = useMemo(
    () => Object.fromEntries(farms.map((f) => [f._id, f])),
    [farms]
  );

  const resolveFarm = (batch) => {
    if (batch.farm && typeof batch.farm === 'object') return batch.farm;
    return farmsById[batch.farm] || null;
  };

  const lastSaleDateByBatch = useMemo(() => {
    const map = {};
    (allSaleOrders || []).forEach((sale) => {
      const batchId = sale.batch?._id || sale.batch;
      if (!batchId || !sale.saleDate) return;
      const d = new Date(sale.saleDate);
      if (!map[batchId] || d > map[batchId]) map[batchId] = d;
    });
    return map;
  }, [allSaleOrders]);

  const deathsByBatch = useMemo(() => {
    const map = {};
    (dailyLogs || []).forEach((log) => {
      if (log.deletedAt || log.logType !== 'DAILY') return;
      const batchId = typeof log.batch === 'object' ? log.batch?._id : log.batch;
      if (!batchId || !log.deaths) return;
      map[batchId] = (map[batchId] || 0) + log.deaths;
    });
    return map;
  }, [dailyLogs]);

  const batchesByFarmFilter = useMemo(() => {
    if (!farmFilter || farmFilter.length === 0) return allBatches;
    const set = new Set(farmFilter);
    return allBatches.filter((b) => set.has(b.farm?._id ?? b.farm));
  }, [allBatches, farmFilter]);

  const batchesByDateRange = useMemo(() => {
    if (!dateRange || (!dateRange.from && !dateRange.to)) return batchesByFarmFilter;
    const fromTs = dateRange.from ? parseIsoDate(dateRange.from)?.getTime() : null;
    // Inclusive of the entire `to` day → push to 23:59:59.999.
    const toTs = dateRange.to ? parseIsoDate(dateRange.to)?.getTime() + 86399999 : null;
    return batchesByFarmFilter.filter((b) => {
      if (!b.startDate) return false;
      const ts = new Date(b.startDate).getTime();
      if (Number.isNaN(ts)) return false;
      if (fromTs != null && ts < fromTs) return false;
      if (toTs != null && ts > toTs) return false;
      return true;
    });
  }, [batchesByFarmFilter, dateRange]);

  const batchesByStatus = useMemo(() => {
    if (statusFilter === 'all') return batchesByDateRange;
    if (statusFilter === 'active') {
      return batchesByDateRange.filter((b) => b.status === 'IN_PROGRESS');
    }
    return batchesByDateRange.filter((b) => b.status === 'COMPLETE');
  }, [batchesByDateRange, statusFilter]);

  const filteredBatches = useMemo(() => {
    if (!searchQuery.trim()) return batchesByStatus;
    const q = searchQuery.toLowerCase();
    return batchesByStatus.filter((b) => {
      if (b.batchName?.toLowerCase().includes(q)) return true;
      const farm = resolveFarm(b);
      return (
        farm?.farmName?.toLowerCase().includes(q) ||
        farm?.nickname?.toLowerCase().includes(q)
      );
    });
  }, [batchesByStatus, searchQuery, farmsById]);

  const groupedByFarm = useMemo(() => {
    const groups = {};
    filteredBatches.forEach((batch) => {
      const farm = resolveFarm(batch);
      const farmId = farm?._id || '_uncategorized';
      const farmName = farm?.farmName || t('common.uncategorized', 'Uncategorized');
      if (!groups[farmId]) {
        groups[farmId] = { farmId, farmName, batches: [] };
      }
      groups[farmId].batches.push(batch);
    });

    return Object.values(groups)
      .map((group) => {
        group.batches.sort(
          (a, b) => new Date(b.startDate || 0) - new Date(a.startDate || 0)
        );
        return group;
      })
      .sort((a, b) => {
        if (a.farmId === '_uncategorized') return 1;
        if (b.farmId === '_uncategorized') return -1;
        const aDate = a.batches[0]?.startDate ? new Date(a.batches[0].startDate) : new Date(0);
        const bDate = b.batches[0]?.startDate ? new Date(b.batches[0].startDate) : new Date(0);
        return bDate - aDate;
      });
  }, [filteredBatches, farmsById, t]);

  const farmFilterOptions = useMemo(
    () => farms.map((f) => ({
      value: f._id,
      label: f.farmName,
      description: f.nickname || '',
    })),
    [farms]
  );

  const farmFilterCount = farmFilter.length;
  const dateRangeActive = !!(dateRange && (dateRange.from || dateRange.to));

  const isGroupOpen = useCallback(
    (farmId) => groupOpen[farmId] ?? true,
    [groupOpen]
  );

  const allGroupsExpanded = useMemo(
    () => groupedByFarm.every((g) => isGroupOpen(g.farmId)),
    [groupedByFarm, isGroupOpen]
  );

  const toggleGroup = useCallback((farmId) => {
    Haptics.selectionAsync().catch(() => {});
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setGroupOpen((p) => ({ ...p, [farmId]: !(p[farmId] ?? true) }));
  }, []);

  const toggleAllGroups = useCallback(() => {
    Haptics.selectionAsync().catch(() => {});
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const next = {};
    groupedByFarm.forEach((g) => { next[g.farmId] = !allGroupsExpanded; });
    setGroupOpen(next);
  }, [groupedByFarm, allGroupsExpanded]);

  const onRefresh = async () => {
    setRefreshing(true);
    try { await deltaSync(); } catch (e) { console.error(e); }
    setRefreshing(false);
  };

  const openCreate = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setBatchSheet({ open: true, data: null });
  };

  const openEdit = (batch) => {
    setBatchSheet({ open: true, data: batch });
  };

  const requestDelete = (batch) => {
    setBatchToDelete(batch);
  };

  const confirmDelete = async () => {
    if (!batchToDelete) return;
    try {
      await remove(batchToDelete._id);
      toast({ title: t('batches.batchDeleted', 'Batch deleted') });
    } catch (e) {
      console.error(e);
      toast({
        title: t('batches.deleteError', 'Failed to delete batch'),
        variant: 'destructive',
      });
    } finally {
      setBatchToDelete(null);
    }
  };

  const isInitialLoading = batchesLoading && allBatches.length === 0;
  const isEmptyClean = !isInitialLoading && allBatches.length === 0;
  const isFilteredEmpty = !isInitialLoading && allBatches.length > 0 && filteredBatches.length === 0;
  // QuickAddFAB lays itself out at `bottom: bottomInset + 16` from the
  // screen edge. On a tabs-landing screen we have to clear the tab bar
  // (~49pt content + safe-area-inset-bottom on iOS, ~83pt total). Adding
  // 84pt to the safe-area bottom puts the FAB ~35pt above the tab bar's
  // top edge — easy thumb reach without overlapping any tab icon, and
  // visually aligned with the BatchDetail FAB which sits 16pt above its
  // own (tabbar-less) bottom safe area.
  const fabBottomInset = insets.bottom + 84;

  return (
    <View style={{ flex: 1, backgroundColor: screenBg }}>
      <BrandHeader
        title={t('batches.title', 'Batches')}
        subtitle={t('batches.subtitle', 'Manage your broiler production cycles')}
        gradient={heroGradient}
        topInset={insets.top}
        isRTL={isRTL}
      />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        stickyHeaderIndices={[0]}
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
        <View
          style={{
            backgroundColor: screenBg,
            paddingHorizontal: 16,
            paddingTop: 16,
            paddingBottom: 14,
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: borderColor,
          }}
        >
          <Toolbar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            farmFilterCount={farmFilterCount}
            onOpenFarmPicker={() => farmPickerRef.current?.open()}
            onClearFarmFilter={() => setFarmFilter([])}
            dateRangeActive={dateRangeActive}
            onOpenDatePicker={() => setDateSheetOpen(true)}
            onClearDateRange={() => setDateRange(null)}
            statusFilter={statusFilter}
            onOpenStatusPicker={() => statusPickerRef.current?.open()}
            onStatusFilterChange={setStatusFilter}
            // Collapse-all only meaningful when there's more than one
            // farm group on screen — same gating used by BatchHouseLogsList.
            collapseAllVisible={groupedByFarm.length > 1}
            allGroupsExpanded={allGroupsExpanded}
            onToggleAllGroups={toggleAllGroups}
            isRTL={isRTL}
            tokens={tokens}
            t={t}
          />
        </View>

        <View style={{ paddingTop: 18 }}>
          {isInitialLoading ? (
            <View style={{ paddingHorizontal: 16, gap: 10 }}>
              {[1, 2, 3, 4].map((i) => <SkeletonRow key={i} />)}
            </View>
          ) : isEmptyClean ? (
            <EmptyState
              icon={Layers}
              title={t('batches.noBatches', 'No batches yet')}
              description={t(
                'batches.noBatchesDesc',
                'Create your first batch to start tracking a production cycle.'
              )}
              actionLabel={t('batches.addFirstBatch', 'Create First Batch')}
              onAction={openCreate}
            />
          ) : isFilteredEmpty ? (
            <View
              style={{
                marginHorizontal: 16,
                marginTop: 16,
                alignItems: 'center',
                paddingVertical: 24,
              }}
            >
              <Text
                style={{
                  fontSize: 14,
                  fontFamily: 'Poppins-Regular',
                  color: mutedColor,
                  textAlign: 'center',
                }}
              >
                {t('common.noResults', 'No results found')}
              </Text>
            </View>
          ) : (
            groupedByFarm.map((group) => (
              <FarmGroupSection
                key={group.farmId}
                group={group}
                open={isGroupOpen(group.farmId)}
                onToggle={() => toggleGroup(group.farmId)}
                isRTL={isRTL}
                tokens={tokens}
                t={t}
                resolveFarm={resolveFarm}
                lastSaleDateByBatch={lastSaleDateByBatch}
                deathsByBatch={deathsByBatch}
                onPressBatch={(b) => router.push(`/(app)/batch/${b._id}`)}
                onEditBatch={openEdit}
                onDeleteBatch={requestDelete}
              />
            ))
          )}
        </View>
      </ScrollView>

      {!batchSheet.open && (
        <QuickAddFAB
          items={[]}
          directAction={openCreate}
          bottomInset={fabBottomInset}
        />
      )}

      <BottomPickerSheet
        ref={farmPickerRef}
        icon={Warehouse}
        title={t('batches.filterByFarm', 'Filter by farm')}
        subtitle={t('batches.filterByFarmDesc', 'Select farms to filter')}
        searchPlaceholder={t('batches.searchFarm', 'Search farms…')}
        searchFields={['label', 'description']}
        options={farmFilterOptions}
        value={farmFilter}
        onValueChange={(val) => setFarmFilter(val || [])}
        multiple
        forceSearchable
      />

      <BottomPickerSheet
        ref={statusPickerRef}
        icon={Filter}
        title={t('batches.filterByStatus', 'Filter by status')}
        subtitle={t('batches.filterByStatusDesc', 'Show all batches or narrow by status')}
        searchable={false}
        options={[
          { value: 'all', label: t('batches.filterAll', 'All') },
          { value: 'active', label: t('batches.statusFilterActive', 'Active') },
          { value: 'inactive', label: t('batches.statusFilterInactive', 'Inactive') },
        ]}
        value={statusFilter}
        onValueChange={(val) => setStatusFilter(val || 'all')}
        sheetHeightFraction={0.42}
      />

      <DateRangePicker
        open={dateSheetOpen}
        onClose={() => setDateSheetOpen(false)}
        value={dateRange}
        onChange={setDateRange}
        subtitle={t('batches.dateRangeDesc', 'Filter batches by start date')}
      />

      <BatchSheet
        open={batchSheet.open}
        onClose={() => setBatchSheet({ open: false, data: null })}
        editData={batchSheet.data}
      />

      <ConfirmDialog
        open={!!batchToDelete}
        onOpenChange={(o) => { if (!o) setBatchToDelete(null); }}
        title={t('batches.deleteTitle', 'Delete Batch')}
        description={t(
          'batches.deleteWarning',
          'This will permanently delete this batch. This action cannot be undone.'
        )}
        confirmLabel={t('common.delete', 'Delete')}
        cancelLabel={t('common.cancel', 'Cancel')}
        onConfirm={confirmDelete}
      />
    </View>
  );
}

function BrandHeader({ title, subtitle, gradient, topInset, isRTL }) {
  return (
    <LinearGradient
      colors={gradient}
      start={isRTL ? { x: 1, y: 0 } : { x: 0, y: 0 }}
      end={isRTL ? { x: 0, y: 1 } : { x: 1, y: 1 }}
      style={{
        paddingTop: topInset + 14,
        paddingBottom: 22,
        paddingHorizontal: 20,
      }}
    >
      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text
            style={{
              fontSize: 24,
              fontFamily: 'Poppins-Bold',
              color: '#ffffff',
              letterSpacing: -0.4,
              lineHeight: 30,
              textAlign: isRTL ? 'right' : 'left',
              writingDirection: isRTL ? 'rtl' : 'ltr',
            }}
            numberOfLines={1}
          >
            {title}
          </Text>
          {subtitle ? (
            <Text
              style={{
                fontSize: 12,
                fontFamily: 'Poppins-Regular',
                color: 'rgba(255,255,255,0.78)',
                marginTop: 4,
                textAlign: isRTL ? 'right' : 'left',
                writingDirection: isRTL ? 'rtl' : 'ltr',
              }}
              numberOfLines={1}
            >
              {subtitle}
            </Text>
          ) : null}
        </View>
        <SyncIconButton />
      </View>
    </LinearGradient>
  );
}

function Toolbar({
  searchQuery, onSearchChange,
  farmFilterCount, onOpenFarmPicker, onClearFarmFilter,
  dateRangeActive, onOpenDatePicker, onClearDateRange,
  statusFilter, onOpenStatusPicker, onStatusFilterChange,
  collapseAllVisible, allGroupsExpanded, onToggleAllGroups,
  isRTL, tokens, t,
}) {
  const { mutedColor, accentColor, dark, inputBg, inputBorderIdle } = tokens;
  const statusActive = statusFilter !== 'all';
  const anyFilterActive = !!searchQuery || farmFilterCount > 0 || dateRangeActive
    || statusActive;

  const onResetAll = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    if (searchQuery) onSearchChange('');
    if (farmFilterCount > 0) onClearFarmFilter();
    if (dateRangeActive) onClearDateRange();
    if (statusActive) onStatusFilterChange('all');
  }, [
    searchQuery, onSearchChange,
    farmFilterCount, onClearFarmFilter,
    dateRangeActive, onClearDateRange,
    statusActive, onStatusFilterChange,
  ]);

  // Status pill mirrors the Farms / Date dropdowns: shows the filter name
  // when nothing is selected, swaps to the picked value (Active / Inactive)
  // with accent treatment when active. The icon also swaps to communicate
  // state at a glance.
  const statusMeta = useMemo(() => {
    if (statusFilter === 'active') {
      return { label: t('batches.statusFilterActive', 'Active'), icon: Clock };
    }
    if (statusFilter === 'inactive') {
      return { label: t('batches.statusFilterInactive', 'Inactive'), icon: CheckCircle2 };
    }
    return { label: t('batches.statusFilter', 'Status'), icon: Filter };
  }, [statusFilter, t]);

  const farmsLabel = t('batches.farmsFilter', 'Farms');
  const dateLabel = t('batches.dateFilter', 'Date');

  return (
    <View style={{ gap: 12 }}>
      {/* Search row — SheetInput + inline Reset (when active) + collapse-all
          toggle. Same recipe as AccountingFilterBar / BatchHouseLogsList so
          the Batches screen follows the rest of the list views. */}
      <View
        style={[
          toolbarStyles.searchRow,
          { flexDirection: isRTL ? 'row-reverse' : 'row' },
        ]}
      >
        <View style={{ flex: 1, minWidth: 0 }}>
          <SheetInput
            icon={Search}
            value={searchQuery}
            onChangeText={onSearchChange}
            placeholder={t('batches.searchPlaceholder', 'Search batches...')}
            autoCapitalize="none"
            autoCorrect={false}
            dense
            suffix={
              searchQuery ? (
                <Pressable
                  onPress={() => onSearchChange('')}
                  hitSlop={10}
                  style={toolbarStyles.clearBtn}
                >
                  <X size={14} color={mutedColor} />
                </Pressable>
              ) : null
            }
          />
        </View>
        {anyFilterActive ? (
          <Pressable
            onPress={onResetAll}
            android_ripple={{
              color: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
              borderless: false,
            }}
            style={[
              toolbarStyles.resetChip,
              {
                backgroundColor: dark ? 'rgba(148,210,165,0.10)' : 'hsl(148, 35%, 96%)',
                borderColor: accentColor,
              },
            ]}
            hitSlop={4}
            accessibilityRole="button"
            accessibilityLabel={t('common.resetAll', 'Reset all')}
          >
            <View
              style={[
                toolbarStyles.resetChipInner,
                { flexDirection: isRTL ? 'row-reverse' : 'row' },
              ]}
            >
              <RotateCcw size={14} color={accentColor} strokeWidth={2.4} />
              <Text
                style={{
                  fontSize: 13,
                  fontFamily: 'Poppins-SemiBold',
                  color: accentColor,
                  letterSpacing: 0.1,
                }}
                numberOfLines={1}
              >
                {t('common.reset', 'Reset')}
              </Text>
            </View>
          </Pressable>
        ) : null}
        {collapseAllVisible ? (
          <Pressable
            onPress={onToggleAllGroups}
            android_ripple={{
              color: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
              borderless: false,
            }}
            style={[
              toolbarStyles.collapseBtn,
              { backgroundColor: inputBg, borderColor: inputBorderIdle },
            ]}
            hitSlop={4}
            accessibilityRole="button"
            accessibilityLabel={allGroupsExpanded
              ? t('common.collapseAll', 'Collapse all')
              : t('common.expandAll', 'Expand all')}
          >
            {allGroupsExpanded
              ? <ChevronsDownUp size={18} color={mutedColor} strokeWidth={2.2} />
              : <ChevronsUpDown size={18} color={mutedColor} strokeWidth={2.2} />}
          </Pressable>
        ) : null}
      </View>

      <View
        style={[
          toolbarStyles.triggerRow,
          { flexDirection: isRTL ? 'row-reverse' : 'row' },
        ]}
      >
        <FilterTrigger
          icon={statusMeta.icon}
          label={statusMeta.label}
          active={statusActive}
          onPress={onOpenStatusPicker}
          isRTL={isRTL}
          tokens={tokens}
        />
        <FilterTrigger
          icon={Warehouse}
          label={farmsLabel}
          active={farmFilterCount > 0}
          onPress={onOpenFarmPicker}
          isRTL={isRTL}
          tokens={tokens}
        />
        <FilterTrigger
          icon={Calendar}
          label={dateLabel}
          active={dateRangeActive}
          onPress={onOpenDatePicker}
          isRTL={isRTL}
          tokens={tokens}
        />
      </View>
    </View>
  );
}

/**
 * Compact filter trigger pill used in the toolbar. Static layout in
 * `StyleSheet.create` (see DESIGN_LANGUAGE.md §9 for why); functional style
 * is reserved for press-state border tint only.
 *
 * `countBadge` (optional number) shows a small accent-filled count on the
 * trailing edge — useful for multi-select filters where the label can't
 * fully convey "N selected".
 */
function FilterTrigger({ icon: Icon, label, active, countBadge, onPress, isRTL, tokens }) {
  const { mutedColor, textColor, accentColor, inputBg, inputBorderIdle, dark } = tokens;
  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync().catch(() => {});
        onPress?.();
      }}
      android_ripple={{
        color: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
        borderless: false,
      }}
      style={[
        toolbarStyles.trigger,
        {
          backgroundColor: active
            ? (dark ? 'rgba(148,210,165,0.10)' : 'hsl(148, 35%, 96%)')
            : inputBg,
          borderColor: active ? accentColor : inputBorderIdle,
        },
      ]}
    >
      <View
        style={[
          toolbarStyles.triggerInner,
          { flexDirection: isRTL ? 'row-reverse' : 'row' },
        ]}
      >
        <View
          style={[
            toolbarStyles.triggerIconTile,
            {
              backgroundColor: active
                ? (dark ? 'rgba(148,210,165,0.22)' : 'hsl(148, 38%, 88%)')
                : (dark ? 'rgba(255,255,255,0.04)' : 'hsl(148, 18%, 94%)'),
            },
          ]}
        >
          <Icon
            size={15}
            color={active ? accentColor : mutedColor}
            strokeWidth={2.2}
          />
        </View>
        <Text
          style={{
            flex: 1,
            minWidth: 0,
            fontSize: 13,
            fontFamily: active ? 'Poppins-SemiBold' : 'Poppins-Medium',
            color: active ? accentColor : textColor,
            textAlign: isRTL ? 'right' : 'left',
          }}
          numberOfLines={1}
        >
          {label}
        </Text>
        {countBadge != null ? (
          <View style={[toolbarStyles.countBadge, { backgroundColor: accentColor }]}>
            <Text
              style={{
                fontSize: 11,
                fontFamily: 'Poppins-Bold',
                color: '#ffffff',
              }}
            >
              {countBadge}
            </Text>
          </View>
        ) : (
          <ChevronDown size={14} color={active ? accentColor : mutedColor} strokeWidth={2.4} />
        )}
      </View>
    </Pressable>
  );
}

function FarmGroupSection({
  group, open, onToggle,
  isRTL, tokens, t, resolveFarm, lastSaleDateByBatch, deathsByBatch,
  onPressBatch, onEditBatch, onDeleteBatch,
}) {
  const { mutedColor, elevatedCardBorder } = tokens;

  const Chevron = open ? ChevronUp : (isRTL ? ChevronLeft : ChevronRight);

  return (
    <View style={{ marginBottom: open ? 0 : 16 }}>
      <Pressable
        onPress={onToggle}
        hitSlop={6}
        style={[
          sectionStyles.eyebrow,
          { flexDirection: isRTL ? 'row-reverse' : 'row' },
        ]}
      >
        <Text
          style={{
            flex: 1,
            fontSize: 11,
            fontFamily: 'Poppins-SemiBold',
            color: mutedColor,
            letterSpacing: 1.4,
            textTransform: 'uppercase',
            textAlign: isRTL ? 'right' : 'left',
          }}
          numberOfLines={1}
        >
          {group.farmName}
        </Text>
        <Chevron size={14} color={mutedColor} strokeWidth={2.4} />
      </Pressable>

      {open ? (
        <SheetSection padded={false}>
          {/* Inner padding inset so cards don't kiss the section edge —
              same recipe as the dashboard's BroilerActiveBatches. */}
          <View style={{ padding: 8 }}>
            {group.batches.map((batch, idx) => (
              <View key={batch._id}>
                {/* 2pt rounded divider in the gap between cards. Same
                    `elevatedCardBorder` token + sizing as the dashboard's
                    BroilerActiveBatches separator, so the two batch
                    surfaces (dashboard widget + Batches tab) are
                    visually consistent. Skipped above the first card so
                    the section's top edge stays clean. */}
                {idx > 0 ? (
                  <View
                    style={[
                      cardStyles.cardSeparator,
                      { backgroundColor: elevatedCardBorder },
                    ]}
                  />
                ) : null}
                <BatchRow
                  batch={batch}
                  tokens={tokens}
                  isRTL={isRTL}
                  t={t}
                  resolveFarm={resolveFarm}
                  lastSaleDateByBatch={lastSaleDateByBatch}
                  deathsByBatch={deathsByBatch}
                  onPress={() => onPressBatch(batch)}
                  onEdit={() => onEditBatch(batch)}
                  onDelete={() => onDeleteBatch(batch)}
                />
              </View>
            ))}
          </View>
        </SheetSection>
      ) : null}
    </View>
  );
}

/**
 * Batch card. Modeled on the dashboard's `BroilerActiveBatches.BatchCard`:
 * elevated surface, header (avatar + title + bird-count meta), day-of-target
 * progress + bar. We skip the farm-name meta because the parent
 * `FarmGroupSection` already groups by farm. For COMPLETE batches the label
 * reads "Completed in X days"; the % and bar stay mounted with opacity 0 so
 * card height matches in-progress rows.
 *
 * Layout lives in `StyleSheet.create` and on plain inner Views — Pressable's
 * functional style is reserved for press-state visuals only (DESIGN_LANGUAGE.md §9).
 */
function BatchRow({
  batch, tokens, isRTL, t, resolveFarm, lastSaleDateByBatch, deathsByBatch,
  onPress, onEdit, onDelete,
}) {
  const {
    mutedColor, textColor, accentColor, dark,
    elevatedCardBg, elevatedCardBorder, elevatedCardPressedBg,
  } = tokens;
  const swipeRef = useRef(null);

  const farm = resolveFarm(batch);
  const status = getStatusConfig(batch.status);
  const avatarLetter = (farm?.nickname || farm?.farmName || batch.batchName || '?')[0].toUpperCase();
  const batchNum = batch.sequenceNumber ?? '';
  const displayName =
    batch.batchName ||
    (farm
      ? `${farm.nickname || farm.farmName?.substring(0, 8).toUpperCase()}-B${batch.sequenceNumber ?? '?'}`
      : t('batches.addBatch', 'New Batch'));

  const initialBirds = (batch.houses || []).reduce(
    (sum, h) => sum + (h.quantity || 0), 0
  );
  const deaths = (deathsByBatch && deathsByBatch[batch._id]) || 0;
  const remaining = Math.max(0, initialBirds - deaths);
  const mortalityPct = initialBirds > 0 ? (deaths / initialBirds) * 100 : 0;
  const mortalityColor = mortalityToneColor(mortalityPct, tokens);
  const showHealthMeta = initialBirds > 0;

  let dayCount = 0;
  let cycleProgressPct = 0;
  if (batch.startDate) {
    const start = new Date(batch.startDate);
    const end = batch.status === 'COMPLETE'
      ? (lastSaleDateByBatch[batch._id] || start)
      : new Date();
    dayCount = Math.max(0, Math.floor((end - start) / 86400000));
    cycleProgressPct = Math.min(100, (dayCount / CYCLE_TARGET_DAYS) * 100);
  }

  const isInProgress = batch.status === 'IN_PROGRESS';
  const isComplete = batch.status === 'COMPLETE';
  const hasStarted = !!batch.startDate;

  // For complete batches, the bar reads as 100% and the label shifts to
  // "Completed in X days" (no day-of-target target is meaningful any more).
  const showProgressBar = hasStarted && (isInProgress || isComplete);
  const barPct = isComplete ? 100 : cycleProgressPct;
  // Keep % + track in the tree for identical vertical rhythm; hide visually.
  const hideProgressChrome = isComplete;

  const progressLabel = isComplete
    // List rows are already grouped under the farm header and clearly
    // styled as "complete" via the avatar's status pip + green bar — the
    // "Completed in" prefix is redundant noise here, so we just say
    // "X days". The full phrasing is preserved on BatchDetailHeader
    // where it stands alone without the surrounding row context.
    ? t('batches.daysShort', '{{days}} days', { days: dayCount })
    : isInProgress
      ? t('dashboard.dayN', 'Day {{n}}', { n: dayCount })
      : t('batches.notStarted', 'Not started');

  const handleEdit = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    swipeRef.current?.close?.();
    setTimeout(() => onEdit?.(), 150);
  };

  const handleDelete = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    swipeRef.current?.close?.();
    setTimeout(() => onDelete?.(), 150);
  };

  const renderRightActions = () => (
    <View style={{ flexDirection: 'row' }}>
      <Pressable
        onPress={handleEdit}
        style={({ pressed }) => [
          cardStyles.swipeAction,
          { backgroundColor: '#f59e0b', opacity: pressed ? 0.8 : 1 },
        ]}
      >
        <Pencil size={20} color="#ffffff" strokeWidth={2.2} />
        <Text style={cardStyles.swipeActionLabel}>
          {t('common.edit', 'Edit')}
        </Text>
      </Pressable>
      <Pressable
        onPress={handleDelete}
        style={({ pressed }) => [
          cardStyles.swipeAction,
          { backgroundColor: '#dc2626', opacity: pressed ? 0.8 : 1 },
        ]}
      >
        <Trash2 size={20} color="#ffffff" strokeWidth={2.2} />
        <Text style={cardStyles.swipeActionLabel}>
          {t('common.delete', 'Delete')}
        </Text>
      </Pressable>
    </View>
  );

  return (
    <Swipeable
      ref={swipeRef}
      friction={2}
      rightThreshold={40}
      overshootRight={false}
      renderRightActions={renderRightActions}
    >
      <Pressable
        onPressIn={() => Haptics.selectionAsync().catch(() => {})}
        onPress={onPress}
        android_ripple={{
          color: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
          borderless: false,
        }}
        style={({ pressed }) => [
          cardStyles.card,
          {
            backgroundColor: pressed ? elevatedCardPressedBg : elevatedCardBg,
            borderColor: pressed ? accentColor : elevatedCardBorder,
            transform: [{ scale: pressed ? 0.985 : 1 }],
            opacity: pressed ? 0.95 : 1,
            ...(dark
              ? {}
              : {
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: pressed ? 0.04 : 0.07,
                  shadowRadius: pressed ? 6 : 10,
                  elevation: pressed ? 1 : 2,
                }),
          },
        ]}
      >
        {/* Header row: avatar + title + bird-count meta (no farm name —
            grouped above) */}
        <View
          style={[
            cardStyles.headerRow,
            { flexDirection: isRTL ? 'row-reverse' : 'row' },
          ]}
        >
          <BatchAvatar
            letter={avatarLetter}
            sequence={batchNum}
            status={status}
            size={40}
            radius={14}
          />
          <View style={cardStyles.headerTextCol}>
            <Text
              style={{
                fontSize: 15,
                fontFamily: 'Poppins-SemiBold',
                color: textColor,
                letterSpacing: -0.1,
                textAlign: isRTL ? 'right' : 'left',
              }}
              numberOfLines={1}
            >
              {displayName}
            </Text>
            {showHealthMeta ? (
              <View
                style={[
                  cardStyles.metaRow,
                  { flexDirection: isRTL ? 'row-reverse' : 'row' },
                ]}
              >
                <View
                  style={[
                    cardStyles.metaPiece,
                    { flexDirection: isRTL ? 'row-reverse' : 'row' },
                  ]}
                >
                  <Bird size={11} color={mutedColor} strokeWidth={2.2} />
                  <Text
                    style={{
                      fontSize: 12,
                      fontFamily: 'Poppins-Regular',
                      color: mutedColor,
                    }}
                  >
                    {fmtInt(remaining)}
                  </Text>
                  {deaths > 0 ? (
                    <Text
                      style={{
                        fontSize: 12,
                        fontFamily: 'Poppins-SemiBold',
                        color: mortalityColor,
                      }}
                    >
                      {`(-${fmtInt(deaths)})`}
                    </Text>
                  ) : null}
                </View>
                <Text style={{ fontSize: 12, color: mutedColor }}>·</Text>
                <Text
                  style={{
                    fontSize: 12,
                    fontFamily: 'Poppins-SemiBold',
                    color: mortalityColor,
                  }}
                >
                  {`${mortalityPct.toFixed(2)}%`}
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* Day-of-target / completed-in label + percentage */}
        <View
          style={[
            cardStyles.progressLabelRow,
            { flexDirection: isRTL ? 'row-reverse' : 'row' },
          ]}
        >
          <View
            style={[
              cardStyles.progressLabelLeft,
              { flexDirection: isRTL ? 'row-reverse' : 'row' },
            ]}
          >
            <Calendar size={11} color={mutedColor} strokeWidth={2.4} />
            <Text
              style={{
                fontSize: 10,
                fontFamily: 'Poppins-SemiBold',
                color: mutedColor,
                letterSpacing: 0.8,
                textTransform: 'uppercase',
              }}
              numberOfLines={1}
            >
              {progressLabel}
            </Text>
          </View>
          {showProgressBar ? (
            <Text
              style={{
                fontSize: 11,
                fontFamily: 'Poppins-SemiBold',
                color: mutedColor,
                opacity: hideProgressChrome ? 0 : 1,
              }}
            >
              {`${Math.round(barPct)}%`}
            </Text>
          ) : null}
        </View>

        {showProgressBar ? (
          <View style={{ opacity: hideProgressChrome ? 0 : 1 }}>
            <View
              style={[
                cardStyles.progressBarTrack,
                {
                  backgroundColor: dark
                    ? 'rgba(255,255,255,0.06)'
                    : 'rgba(0,0,0,0.05)',
                },
              ]}
            >
              <View
                style={[
                  cardStyles.progressBarFill,
                  { backgroundColor: accentColor, width: `${barPct}%` },
                ]}
              />
            </View>
          </View>
        ) : null}
      </Pressable>
    </Swipeable>
  );
}

const sectionStyles = StyleSheet.create({
  eyebrow: {
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 22,
    marginBottom: 10,
  },
});

const cardStyles = StyleSheet.create({
  // 2pt rounded divider between batch cards inside a farm group. Same
  // recipe as the dashboard's BroilerActiveBatches separator —
  // `elevatedCardBorder` colour, 2pt height, soft pill ends, with
  // `marginVertical` owning the inter-card breathing room (replaces
  // the legacy `containerStyle: { marginBottom: 14 }` on Swipeable).
  cardSeparator: {
    height: 2,
    borderRadius: 1,
    marginVertical: 12,
    marginHorizontal: 4,
  },
  card: {
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  headerRow: {
    alignItems: 'center',
    gap: 12,
    // Match dashboard `BroilerActiveBatches` — tight gap before DAY / progress row.
    marginBottom: 8,
  },
  headerTextCol: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  metaRow: {
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 2,
  },
  metaPiece: {
    alignItems: 'center',
    gap: 4,
  },
  progressLabelRow: {
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  progressLabelLeft: {
    alignItems: 'center',
    gap: 4,
    flex: 1,
    minWidth: 0,
  },
  progressBarTrack: {
    height: 5,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  swipeAction: {
    width: SWIPE_ACTION_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swipeActionLabel: {
    fontSize: 11,
    fontFamily: 'Poppins-SemiBold',
    color: '#ffffff',
    marginTop: 4,
  },
});

const toolbarStyles = StyleSheet.create({
  // Search row hosts the SheetInput plus optional inline Reset chip and
  // the collapse-all toggle, matching the AccountingFilterBar pattern
  // used across the other list views.
  searchRow: {
    alignItems: 'center',
    gap: 10,
  },
  triggerRow: {
    alignItems: 'stretch',
    gap: 8,
  },
  trigger: {
    flex: 1,
    minWidth: 0,
    borderRadius: 14,
    borderWidth: 1.5,
    height: 46,
    justifyContent: 'center',
    paddingStart: 6,
    paddingEnd: 10,
  },
  triggerInner: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
  },
  triggerIconTile: {
    width: 26,
    height: 26,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearBtn: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 11,
  },
  countBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Inline reset chip — same height/radius profile as SheetInput's
  // dense field so the search row reads as one unified strip.
  resetChip: {
    height: 44,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    justifyContent: 'center',
  },
  resetChipInner: {
    alignItems: 'center',
    gap: 6,
  },
  // Square collapse-all toggle — borrowed from BatchHouseLogsList so the
  // affordance is identical across screens.
  collapseBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
