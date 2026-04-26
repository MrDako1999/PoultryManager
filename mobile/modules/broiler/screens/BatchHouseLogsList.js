import { useMemo, useState } from 'react';
import {
  View, Text, Pressable, ScrollView, RefreshControl, LayoutAnimation,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import {
  ChevronLeft, ChevronRight, ClipboardList, Home, Skull, Heart,
  Wheat, Droplets, ChevronsDownUp, ChevronsUpDown, Tag,
  Weight, Thermometer,
} from 'lucide-react-native';
import useLocalRecord from '@/hooks/useLocalRecord';
import useLocalQuery from '@/hooks/useLocalQuery';
import useCapabilities from '@/hooks/useCapabilities';
import { useHeroSheetTokens } from '@/components/HeroSheetScreen';
import { useIsRTL } from '@/stores/localeStore';
import SheetSection from '@/components/SheetSection';
import EmptyState from '@/components/ui/EmptyState';
import QuickAddFAB from '@/components/QuickAddFAB';
import DailyLogRow from '@/modules/broiler/rows/DailyLogRow';
import DailyLogSheet from '@/modules/broiler/sheets/DailyLogSheet';
import ExpenseCategoryGroup from '@/components/rows/ExpenseCategoryGroup';
import BatchKpiCard, {
  mortalityToneColor,
} from '@/modules/broiler/components/BatchKpiCard';
import { AccountingToolbar } from '@/components/views/AccountingFilterBar';
import { SkeletonRow } from '@/components/skeletons';
import { LOG_TYPES } from '@/lib/constants';
import { deltaSync } from '@/lib/syncEngine';
import { rowDirection, textAlignStart } from '@/lib/rtl';

const NUMERIC_LOCALE = 'en-US';

const fmt = (val) =>
  Number(val || 0).toLocaleString(NUMERIC_LOCALE);

const fmtDecimal = (val, digits = 1) =>
  Number(val || 0).toLocaleString(NUMERIC_LOCALE, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });

const fmtCompactKg = (val) => {
  const n = Number(val || 0);
  if (n >= 1000) return `${fmtDecimal(n / 1000)}t`;
  return `${fmt(n)} kg`;
};

const fmtCompactL = (val) => {
  const n = Number(val || 0);
  if (n >= 1000) return `${fmtDecimal(n / 1000)}kL`;
  return `${fmt(n)} L`;
};

// Date keys are stored ISO YYYY-MM-DD so lexicographic compare is timezone
// safe (same trick as SalesListView). Keep it consistent across the app.
const dateKeyOf = (log) => {
  const raw = log.logDate || log.date;
  if (!raw) return 'no-date';
  return new Date(raw).toISOString().slice(0, 10);
};

export default function BatchHouseLogsList() {
  const { id, houseId } = useLocalSearchParams();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const isRTL = useIsRTL();
  const { can } = useCapabilities();
  const tokens = useHeroSheetTokens();
  const {
    accentColor, dark, mutedColor, textColor, screenBg, borderColor,
    inputBg, inputBorderIdle,
  } = tokens;

  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [dateRange, setDateRange] = useState(undefined);
  const [logTypeFilter, setLogTypeFilter] = useState([]);
  const [groupOpen, setGroupOpen] = useState({});
  // null = closed. When set, holds the entry context: an existing log
  // (`data`) for edit mode, or a `defaultLogType` chosen from the
  // QuickAddFAB menu so the same sheet handles all three create flows
  // without juggling separate booleans.
  const [sheet, setSheet] = useState(null);

  const [batch, batchLoading] = useLocalRecord('batches', id);
  const [dailyLogs, logsLoading] = useLocalQuery('dailyLogs', { batch: id });

  const isCompleted = batch?.status === 'COMPLETE';

  const houses = batch?.houses || [];

  const houseInfo = useMemo(() => {
    const entry = houses.find((h) => {
      const hid = typeof h.house === 'object' ? h.house?._id : h.house;
      return hid === houseId;
    });
    if (!entry) {
      return {
        id: houseId,
        name: t('batches.viewAllLogs', 'All Logs'),
        initial: 0,
      };
    }
    return {
      id: houseId,
      name: (typeof entry.house === 'object' ? entry.house?.name : null)
        || entry.name
        || t('farms.house', 'House'),
      initial: entry.quantity || 0,
    };
  }, [houses, houseId, t]);

  // All non-deleted logs for this specific house, sorted desc by date.
  const allHouseLogs = useMemo(() => {
    return (dailyLogs || [])
      .filter((log) => {
        if (log.deletedAt) return false;
        const lhId = log.house?._id || log.house;
        return lhId === houseId;
      })
      .sort(
        (a, b) =>
          new Date(b.logDate || b.date || 0)
          - new Date(a.logDate || a.date || 0)
      );
  }, [dailyLogs, houseId]);

  // Apply search + date range + log type filters.
  const filteredLogs = useMemo(() => {
    const q = search.trim().toLowerCase();
    const fromIso = dateRange?.from || null;
    const toIso = dateRange?.to || dateRange?.from || null;
    const typeSet = logTypeFilter.length > 0 ? new Set(logTypeFilter) : null;

    return allHouseLogs.filter((log) => {
      if (typeSet && !typeSet.has(log.logType)) return false;
      if (fromIso || toIso) {
        const key = dateKeyOf(log);
        if (key === 'no-date') return false;
        if (fromIso && key < fromIso) return false;
        if (toIso && key > toIso) return false;
      }
      if (!q) return true;
      const hay = [
        log.notes,
        log.logType,
        log.cycleDay != null ? `day ${log.cycleDay}` : null,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [allHouseLogs, search, dateRange, logTypeFilter]);

  // KPI hero stats — operate on the *filtered* set so the card always
  // matches what the list below is showing.
  const heroStats = useMemo(() => {
    let deaths = 0;
    let feedKg = 0;
    let waterL = 0;
    const dayCounts = new Set();
    filteredLogs.forEach((log) => {
      if (log.logType === 'DAILY') {
        deaths += log.deaths || 0;
        feedKg += log.feedKg || 0;
        waterL += log.waterLiters || 0;
      }
      const key = dateKeyOf(log);
      if (key !== 'no-date') dayCounts.add(key);
    });
    const initial = houseInfo.initial || 0;
    const mortalityPct = initial > 0 ? (deaths / initial) * 100 : 0;
    const currentBirds = Math.max(0, initial - deaths);
    return {
      deaths,
      feedKg,
      waterL,
      mortalityPct,
      currentBirds,
      daysLogged: dayCounts.size,
    };
  }, [filteredLogs, houseInfo.initial]);

  // Group filtered logs by ISO day key, newest first.
  const groupedByDay = useMemo(() => {
    const groups = {};
    filteredLogs.forEach((log) => {
      const key = dateKeyOf(log);
      if (!groups[key]) groups[key] = { logs: [], deaths: 0, feedKg: 0 };
      groups[key].logs.push(log);
      if (log.logType === 'DAILY') {
        groups[key].deaths += log.deaths || 0;
        groups[key].feedKg += log.feedKg || 0;
      }
    });
    return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a));
  }, [filteredLogs]);

  const filterPills = useMemo(() => ([
    {
      key: 'logType',
      label: t('batches.operations.logType', 'Entry Type'),
      icon: Tag,
      options: LOG_TYPES.map((type) => ({
        value: type,
        label: t(`batches.operations.logTypes.${type}`, type),
      })),
      values: logTypeFilter,
      onChange: setLogTypeFilter,
    },
  ]), [t, logTypeFilter]);

  // Quick-add menu — same per-type shape as BatchDetail's Performance
  // tab so the affordance is consistent wherever the user lands. Each
  // item opens the DailyLogSheet pre-pinned to this house + the chosen
  // log type. We re-evaluate when capabilities change (rare) and when
  // the sheet's own callback identity changes (never; useState
  // setters are stable, but the linter can't prove that).
  const openLog = (logType) => setSheet({ logType, data: null });
  const quickAddItems = useMemo(() => [
    can('dailyLog:create') && {
      key: 'dailyLog',
      icon: ClipboardList,
      label: t('batches.dailyLogsTab', 'Daily Logs'),
      onPress: () => openLog('DAILY'),
    },
    (can('dailyLog:create:WEIGHT') || can('dailyLog:create')) && {
      key: 'sample',
      icon: Weight,
      label: t('batches.samplesTab', 'Samples'),
      onPress: () => openLog('WEIGHT'),
    },
    (can('dailyLog:create:ENVIRONMENT') || can('dailyLog:create')) && {
      key: 'environment',
      icon: Thermometer,
      label: t('batches.environmentTab', 'Environment'),
      onPress: () => openLog('ENVIRONMENT'),
    },
  ].filter(Boolean), [can, t]);

  const resetAll = () => {
    setSearch('');
    setDateRange(undefined);
    setLogTypeFilter([]);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try { await deltaSync(); } catch (e) { console.error(e); }
    setRefreshing(false);
  };

  const allExpanded = groupedByDay.every(([key]) => groupOpen[key] ?? true);
  const toggleAll = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const next = {};
    groupedByDay.forEach(([key]) => { next[key] = !allExpanded; });
    setGroupOpen(next);
  };
  const toggleGroup = (key) =>
    setGroupOpen((p) => ({ ...p, [key]: !(p[key] ?? true) }));

  const collapseButton = groupedByDay.length > 1 ? (
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

  const ChevronGlyph = isRTL ? ChevronRight : ChevronLeft;
  const mortColor = mortalityToneColor(heroStats.mortalityPct, tokens);
  const hasAnyFilter = !!(
    search || dateRange?.from || dateRange?.to || logTypeFilter.length > 0
  );

  if (batchLoading) {
    return <View style={{ flex: 1, backgroundColor: screenBg }} />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: screenBg }}>
      {/* Custom header bar — back chevron + house name + log count */}
      <View
        style={[
          styles.headerBar,
          {
            paddingTop: insets.top + 8,
            backgroundColor: screenBg,
            borderBottomColor: borderColor,
            flexDirection: rowDirection(isRTL),
          },
        ]}
      >
        <Pressable
          onPress={() => {
            Haptics.selectionAsync().catch(() => {});
            router.back();
          }}
          android_ripple={{
            color: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
            borderless: true,
            radius: 22,
          }}
          style={styles.backBtn}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={t('common.back', 'Back')}
        >
          <ChevronGlyph size={24} color={accentColor} strokeWidth={2.4} />
        </Pressable>
        <View style={styles.headerTextCol}>
          <View
            style={[
              styles.headerTitleRow,
              { flexDirection: rowDirection(isRTL) },
            ]}
          >
            <Home size={14} color={mutedColor} strokeWidth={2.2} />
            <Text
              style={{
                fontSize: 17,
                fontFamily: 'Poppins-Bold',
                color: textColor,
                textAlign: textAlignStart(isRTL),
              }}
              numberOfLines={1}
            >
              {houseInfo.name}
            </Text>
          </View>
          <Text
            style={{
              fontSize: 11,
              fontFamily: 'Poppins-Medium',
              color: mutedColor,
              marginTop: 1,
              textAlign: textAlignStart(isRTL),
            }}
            numberOfLines={1}
          >
            {houseInfo.initial > 0
              ? `${fmt(heroStats.currentBirds)} / ${fmt(houseInfo.initial)} ${t('farms.birds', 'birds').toLowerCase()}`
              : t('batches.operations.noEntries', 'No entries yet')}
          </Text>
        </View>
        <Text
          style={{
            fontSize: 12,
            fontFamily: 'Poppins-SemiBold',
            color: mutedColor,
            marginEnd: isRTL ? 0 : 8,
            marginStart: isRTL ? 8 : 0,
          }}
        >
          {fmt(allHouseLogs.length)}
        </Text>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingTop: 0,
          paddingBottom: insets.bottom + 120,
        }}
        stickyHeaderIndices={[1]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={accentColor}
            colors={[accentColor]}
            progressBackgroundColor={dark ? 'hsl(150, 18%, 14%)' : '#ffffff'}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* KPI Hero — scrolls away with the list */}
        <View style={styles.heroWrap}>
          <BatchKpiCard
            title={t('batches.cyclePerformance', 'Cycle Performance')}
            icon={Skull}
            headline={fmt(heroStats.deaths)}
            headlineColor={heroStats.deaths > 0 ? mortColor : undefined}
            subline={
              hasAnyFilter
                ? t('accounting.showingOf', '{{shown}} of {{total}}', {
                    shown: fmt(filteredLogs.length),
                    total: fmt(allHouseLogs.length),
                  })
                : (houseInfo.initial > 0
                  ? `${t('batches.totalDeaths', 'Deaths').toLowerCase()}  ·  ${heroStats.mortalityPct.toFixed(2)}%`
                  : t('batches.totalDeaths', 'Deaths').toLowerCase())
            }
            sublineColor={!hasAnyFilter && houseInfo.initial > 0 ? mortColor : undefined}
            stats={[
              {
                icon: Heart,
                label: t('batches.currentBirds', 'Live Birds'),
                value: houseInfo.initial > 0 ? fmt(heroStats.currentBirds) : '—',
                valueColor: accentColor,
              },
              {
                icon: Wheat,
                label: t('batches.operations.feedShort', 'Feed'),
                value: fmtCompactKg(heroStats.feedKg),
              },
              {
                icon: Droplets,
                label: t('batches.operations.waterShort', 'Water'),
                value: fmtCompactL(heroStats.waterL),
              },
            ]}
          />
        </View>

        {/* Sticky toolbar — search + date range + log type filter + reset */}
        <View>
          <AccountingToolbar
            search={search}
            setSearch={setSearch}
            dateRange={dateRange}
            setDateRange={setDateRange}
            filters={filterPills}
            onResetAll={resetAll}
            searchTrailing={collapseButton}
          />
        </View>

        {/* Loading state on initial load */}
        {logsLoading && allHouseLogs.length === 0 ? (
          <View style={{ paddingHorizontal: 16, paddingTop: 16, gap: 10 }}>
            {[1, 2, 3, 4].map((i) => <SkeletonRow key={i} />)}
          </View>
        ) : groupedByDay.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title={hasAnyFilter
              ? t('common.noResults', 'No results found')
              : t('batches.operations.noEntries', 'No entries yet')}
            description={!hasAnyFilter
              ? t('batches.operations.noEntriesDesc', 'Start logging daily data for this house.')
              : undefined}
          />
        ) : (
          <SheetSection padded={false}>
            <View>
              {groupedByDay.map(([dateKey, group]) => (
                <ExpenseCategoryGroup
                  key={dateKey}
                  label={dateKey === 'no-date'
                    ? t('common.noDate', 'No Date')
                    : new Date(`${dateKey}T00:00:00`).toLocaleDateString(NUMERIC_LOCALE, {
                        weekday: 'short',
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                  pills={[
                    ...(group.deaths > 0
                      ? [{ value: `${fmt(group.deaths)} ${t('batches.operations.deathsShort', 'Deaths').toLowerCase()}` }]
                      : []),
                    ...(group.feedKg > 0
                      ? [{ value: fmtCompactKg(group.feedKg) }]
                      : []),
                    { value: fmt(group.logs.length) },
                  ]}
                  open={groupOpen[dateKey] ?? true}
                  onToggle={() => toggleGroup(dateKey)}
                >
                  {group.logs.map((log, i) => (
                    <View
                      key={log._id || `${dateKey}-${i}`}
                      style={i > 0
                        ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: borderColor }
                        : null}
                    >
                      <DailyLogRow
                        log={log}
                        t={t}
                        onClick={() => router.push(`/(app)/daily-log/${log._id}`)}
                      />
                    </View>
                  ))}
                </ExpenseCategoryGroup>
              ))}
            </View>
          </SheetSection>
        )}
      </ScrollView>

      {/* Quick-add FAB — expands to a 3-option menu (Daily Log / Sample
          / Environment). Each option opens DailyLogSheet pre-filled with
          (a) the entry type the user picked and (b) the house they're
          currently looking at, so the form lands ready to save with
          two taps total. The unscoped `dailyLog:create` cap is treated
          as a superset of the per-type variants — owners and managers
          see all three options; ground_staff / vets see only the
          subsets they're authorised for. Suppressed entirely on
          completed batches. */}
      {!isCompleted && quickAddItems.length > 0 ? (
        <QuickAddFAB items={quickAddItems} bottomInset={insets.bottom} />
      ) : null}

      <DailyLogSheet
        open={!!sheet}
        onClose={() => setSheet(null)}
        batchId={id}
        batch={batch}
        houses={houses}
        editData={sheet?.data || null}
        defaultLogType={sheet?.logType || 'DAILY'}
        defaultHouseId={houseId}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  headerBar: {
    paddingBottom: 10,
    paddingHorizontal: 4,
    alignItems: 'center',
    gap: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTextCol: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 4,
  },
  headerTitleRow: {
    alignItems: 'center',
    gap: 6,
  },
  heroWrap: {
    paddingTop: 16,
  },
  collapseBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
