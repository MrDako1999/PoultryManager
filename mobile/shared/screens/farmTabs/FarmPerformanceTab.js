import { useMemo, useState } from 'react';
import {
  View, Text, ScrollView, Pressable, RefreshControl, StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import {
  Skull, Wheat, Droplets, Activity, BarChart3, Heart, ClipboardList,
  TrendingDown, Home, Layers, Bird, Calendar,
} from 'lucide-react-native';
import { useHeroSheetTokens } from '@/components/HeroSheetScreen';
import { useIsRTL } from '@/stores/localeStore';
import { deltaSync } from '@/lib/syncEngine';
import EmptyState from '@/components/ui/EmptyState';
import SheetSection from '@/components/SheetSection';
import ChartCard from '@/components/ChartCard';
import SlidingSegmentedControl from '@/components/SlidingSegmentedControl';
import MortalityChart from '@/modules/broiler/charts/MortalityChart';
import ConsumptionChart from '@/modules/broiler/charts/ConsumptionChart';
import { SkeletonFarmPerformanceTab } from '@/components/skeletons';
import BatchAvatar from '@/modules/broiler/components/BatchAvatar';
import { getStatusConfig } from '@/modules/broiler/lib/batchStatusConfig';
import BatchKpiCard, {
  mortalityToneColor,
} from '@/modules/broiler/components/BatchKpiCard';

const NUMERIC_LOCALE = 'en-US';
const CYCLE_TARGET_DAYS = 35;
const SCOPES = ['active', 'allTime', 'thisYear'];

const fmt = (val, digits = 0) =>
  Number(val || 0).toLocaleString(NUMERIC_LOCALE, {
    minimumFractionDigits: digits, maximumFractionDigits: digits,
  });

const fmtInt = (val) => Number(val || 0).toLocaleString(NUMERIC_LOCALE);

const fmtCompactKg = (val) => {
  const n = Number(val || 0);
  if (n >= 1000) {
    return `${(n / 1000).toLocaleString(NUMERIC_LOCALE, {
      minimumFractionDigits: 1, maximumFractionDigits: 1,
    })}t`;
  }
  return `${fmtInt(n)} kg`;
};

const fmtCompactL = (val) => {
  const n = Number(val || 0);
  if (n >= 1000) {
    return `${(n / 1000).toLocaleString(NUMERIC_LOCALE, {
      minimumFractionDigits: 1, maximumFractionDigits: 1,
    })}kL`;
  }
  return `${fmtInt(n)} L`;
};

function getCycleDay(log, startDate) {
  if (log.cycleDay != null) return log.cycleDay;
  if (!log.logDate || !startDate) return 0;
  const ms = new Date(log.logDate) - new Date(startDate);
  return Math.max(1, Math.floor(ms / 86400000) + 1);
}

export default function FarmPerformanceTab({
  houses,
  farmBatches,
  allDailyLogs,
  allSaleOrders = [],
  dailyLogsLoading,
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const isRTL = useIsRTL();
  const tokens = useHeroSheetTokens();
  const {
    accentColor, dark, mutedColor, screenBg,
  } = tokens;

  const [refreshing, setRefreshing] = useState(false);
  const [scope, setScope] = useState('active');
  const [mortView, setMortView] = useState('cumulative');
  const [consMetric, setConsMetric] = useState('feed');
  const [consView, setConsView] = useState('cumulative');

  const yearStart = useMemo(() => {
    const d = new Date();
    d.setMonth(0, 1);
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  // Apply the scope toggle to the farm's batches. Mortality / consumption
  // KPIs, the trend charts, and the per-cycle list all derive from this
  // scoped slice — same pattern the dashboard uses to filter its hero.
  const scopedBatches = useMemo(() => {
    if (scope === 'active') return farmBatches.filter((b) => b.status === 'IN_PROGRESS');
    if (scope === 'thisYear') {
      return farmBatches.filter((b) => b.startDate && new Date(b.startDate) >= yearStart);
    }
    return farmBatches;
  }, [farmBatches, scope, yearStart]);

  const scopedBatchIds = useMemo(
    () => new Set(scopedBatches.map((b) => b._id)),
    [scopedBatches]
  );

  const scopedDailyLogs = useMemo(
    () => allDailyLogs.filter((log) => {
      if (log.deletedAt || log.logType !== 'DAILY') return false;
      const batchId = typeof log.batch === 'object' ? log.batch?._id : log.batch;
      return scopedBatchIds.has(batchId);
    }),
    [allDailyLogs, scopedBatchIds]
  );

  // Build a unified house list across the scoped batches. Daily logs
  // reference houses by `house._id || house`; we need a stable, ordered
  // list of distinct houses for the chart legends + averaging step.
  const farmHouses = useMemo(() => {
    const map = new Map();
    houses.forEach((h) => {
      if (!h._id) return;
      map.set(h._id, { house: { _id: h._id, name: h.name } });
    });
    scopedBatches.forEach((b) => {
      (b.houses || []).forEach((bh) => {
        const id = (typeof bh.house === 'object' ? bh.house?._id : bh.house) || bh._id;
        if (!id) return;
        if (!map.has(id)) {
          const name = (typeof bh.house === 'object' ? bh.house?.name : null) || bh.name;
          map.set(id, { house: { _id: id, name: name || 'House' } });
        }
      });
    });
    return Array.from(map.values());
  }, [houses, scopedBatches]);

  const startDateById = useMemo(() => {
    const map = {};
    scopedBatches.forEach((b) => { map[b._id] = b.startDate; });
    return map;
  }, [scopedBatches]);

  // Average across batches per (house, cycleDay), separately for deaths /
  // feed / water. Each (house, day) accumulates contributions from each
  // batch that had a log on that day for that house. Multiple logs from
  // the same batch on the same day get summed first, then divided by the
  // number of contributing batches so the chart shows a representative
  // per-house curve regardless of how many cycles fall in scope.
  function buildAveragedLogs(field) {
    const perBatch = {};
    scopedDailyLogs.forEach((log) => {
      if (log[field] == null) return;
      const batchId = typeof log.batch === 'object' ? log.batch?._id : log.batch;
      const houseId = log.house?._id || log.house;
      if (!batchId || !houseId) return;
      const day = getCycleDay(log, startDateById[batchId]);
      if (!day) return;
      const key = `${batchId}|${houseId}|${day}`;
      perBatch[key] = (perBatch[key] || 0) + (log[field] || 0);
    });
    const agg = {};
    Object.entries(perBatch).forEach(([key, value]) => {
      const [batchId, houseId, dayStr] = key.split('|');
      const day = Number(dayStr);
      const aKey = `${houseId}|${day}`;
      if (!agg[aKey]) agg[aKey] = { sum: 0, batches: new Set(), houseId, day };
      agg[aKey].sum += value;
      agg[aKey].batches.add(batchId);
    });
    return Object.values(agg).map(({ sum, batches, houseId, day }) => ({
      _id: `synth-${field}-${houseId}-${day}`,
      logType: 'DAILY',
      cycleDay: day,
      house: { _id: houseId },
      [field]: batches.size > 0 ? sum / batches.size : 0,
    }));
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const averagedDeathsLogs = useMemo(() => buildAveragedLogs('deaths'), [scopedDailyLogs, startDateById]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const averagedFeedLogs = useMemo(() => buildAveragedLogs('feedKg'), [scopedDailyLogs, startDateById]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const averagedWaterLogs = useMemo(() => buildAveragedLogs('waterLiters'), [scopedDailyLogs, startDateById]);

  const consumptionLogs = consMetric === 'feed' ? averagedFeedLogs : averagedWaterLogs;

  // Hero KPIs — unaveraged totals across the scoped slice for honest
  // top-line numbers (matches BatchPerformanceTab's recipe).
  const mortalityStats = useMemo(() => {
    let totalDeaths = 0;
    let totalInitial = 0;
    const deathsByHouse = {};
    const initialByHouse = {};
    const dayKeys = new Set();
    scopedBatches.forEach((b) => {
      (b.houses || []).forEach((bh) => {
        const id = (typeof bh.house === 'object' ? bh.house?._id : bh.house);
        const qty = bh.quantity || 0;
        totalInitial += qty;
        if (id) initialByHouse[id] = (initialByHouse[id] || 0) + qty;
      });
    });
    scopedDailyLogs.forEach((log) => {
      if (log.deaths == null) return;
      const houseId = log.house?._id || log.house;
      totalDeaths += log.deaths || 0;
      if (houseId) deathsByHouse[houseId] = (deathsByHouse[houseId] || 0) + (log.deaths || 0);
      const dateKey = log.logDate || log.date;
      if (dateKey) dayKeys.add(new Date(dateKey).toISOString().slice(0, 10));
    });
    const mortalityPct = totalInitial > 0 ? (totalDeaths / totalInitial) * 100 : 0;
    const survivalPct = 100 - mortalityPct;
    const houseEntries = Object.entries(deathsByHouse).map(([hid, deaths]) => {
      const initial = initialByHouse[hid] || 0;
      const rate = initial > 0 ? (deaths / initial) * 100 : 0;
      const meta = farmHouses.find((h) => h.house._id === hid);
      return { id: hid, name: meta?.house?.name || 'House', deaths, rate };
    });
    const sortedHouses = houseEntries.sort((a, b) => b.rate - a.rate);
    const worst = sortedHouses[0] && sortedHouses[0].deaths > 0 ? sortedHouses[0] : null;
    const avgDailyDeaths = dayKeys.size > 0 ? totalDeaths / dayKeys.size : 0;
    return {
      totalDeaths, mortalityPct, survivalPct,
      worstHouse: worst, avgDailyDeaths, totalInitial,
    };
  }, [scopedBatches, scopedDailyLogs, farmHouses]);

  const consumptionStats = useMemo(() => {
    let totalFeed = 0;
    let totalWater = 0;
    const dayKeys = new Set();
    scopedDailyLogs.forEach((log) => {
      totalFeed += log.feedKg || 0;
      totalWater += log.waterLiters || 0;
      const dateKey = log.logDate || log.date;
      if (dateKey && (log.feedKg || log.waterLiters)) {
        dayKeys.add(new Date(dateKey).toISOString().slice(0, 10));
      }
    });
    const totalInitial = mortalityStats.totalInitial;
    return {
      totalFeed,
      totalWater,
      feedPerBird: totalInitial > 0 ? totalFeed / totalInitial : 0,
      waterPerBird: totalInitial > 0 ? totalWater / totalInitial : 0,
      daysLogged: dayKeys.size,
    };
  }, [scopedDailyLogs, mortalityStats.totalInitial]);

  // Last sale date per batch — used to compute the "X days" elapsed
  // figure on completed cycles, matching the BatchesList row.
  const lastSaleDateByBatch = useMemo(() => {
    const map = {};
    allSaleOrders.forEach((sale) => {
      if (sale.deletedAt) return;
      const batchId = typeof sale.batch === 'object' ? sale.batch?._id : sale.batch;
      if (!batchId || !sale.saleDate) return;
      const d = new Date(sale.saleDate);
      if (!map[batchId] || d > map[batchId]) map[batchId] = d;
    });
    return map;
  }, [allSaleOrders]);

  // Per-batch summary for the bottom list. Same data shape as the cards
  // on the Batches list so the row component below can render them
  // identically (avatar + meta + day-of-cycle progress + bar).
  const perBatchCards = useMemo(() => {
    const deathsByBatch = {};
    scopedDailyLogs.forEach((log) => {
      const batchId = typeof log.batch === 'object' ? log.batch?._id : log.batch;
      if (!batchId) return;
      deathsByBatch[batchId] = (deathsByBatch[batchId] || 0) + (log.deaths || 0);
    });
    return scopedBatches
      .map((b) => {
        const initial = (b.houses || []).reduce((s, h) => s + (h.quantity || 0), 0);
        const deaths = deathsByBatch[b._id] || 0;
        const remaining = Math.max(0, initial - deaths);
        const mortalityPct = initial > 0 ? (deaths / initial) * 100 : 0;

        const isComplete = b.status === 'COMPLETE';
        const isInProgress = b.status === 'IN_PROGRESS';
        const start = b.startDate ? new Date(b.startDate) : null;
        const end = isComplete
          ? (lastSaleDateByBatch[b._id] || start)
          : new Date();
        const dayCount = (start && end)
          ? Math.max(0, Math.floor((end - start) / 86400000))
          : 0;
        const cycleProgressPct = isComplete
          ? 100
          : Math.min(100, (dayCount / CYCLE_TARGET_DAYS) * 100);

        const avatarLetter = (b.batchName || '?')[0].toUpperCase();
        const batchNum = b.sequenceNumber ?? '';

        return {
          _id: b._id, batchName: b.batchName, status: b.status,
          isComplete, isInProgress, hasStarted: !!b.startDate,
          avatarLetter, batchNum,
          initial, deaths, remaining, mortalityPct,
          dayCount, cycleProgressPct,
        };
      })
      .sort((a, b) => b.mortalityPct - a.mortalityPct);
  }, [scopedBatches, scopedDailyLogs, lastSaleDateByBatch]);

  const onRefresh = async () => {
    setRefreshing(true);
    try { await deltaSync(); } catch (e) { console.error(e); }
    setRefreshing(false);
  };

  if (dailyLogsLoading && allDailyLogs.length === 0) {
    return <SkeletonFarmPerformanceTab />;
  }

  if (farmBatches.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: screenBg }}>
        <EmptyState
          icon={Activity}
          title={t('farms.noBatchesYet', 'No batches yet')}
          description={t(
            'farms.noBatchesDesc',
            'Performance data will appear here once you start running batches on this farm.'
          )}
        />
      </View>
    );
  }

  const mortColor = mortalityToneColor(mortalityStats.mortalityPct, tokens);
  const worstColor = mortalityStats.worstHouse
    ? mortalityToneColor(mortalityStats.worstHouse.rate, tokens)
    : null;

  const scopeOptions = SCOPES.map((value) => ({
    value,
    label:
      value === 'active' ? t('dashboard.scopeActive', 'Active')
      : value === 'allTime' ? t('dashboard.scopeAllTime', 'All-time')
      : t('farms.scopeThisYear', 'This Year'),
  }));

  return (
    <View style={{ flex: 1, backgroundColor: screenBg }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingTop: 16,
          paddingBottom: insets.bottom + 120,
        }}
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
        {/* Scope toggle — same SlidingSegmentedControl as the dashboard /
            Farm Overview, so all three farm-level surfaces honour the
            same Active / All-time / This Year filter. */}
        <View style={{ paddingHorizontal: 16, marginBottom: 12 }}>
          <SlidingSegmentedControl
            value={scope}
            onChange={setScope}
            options={scopeOptions}
            bordered
          />
        </View>

        {/* Order matches BatchPerformanceTab exactly:
            Mortality KPI → Mortality Chart → Consumption KPI →
            Consumption Chart → Per-cycle list. */}

        <BatchKpiCard
          title={t('batches.mortalitySummary', 'Mortality')}
          icon={Skull}
          headline={fmt(mortalityStats.totalDeaths)}
          headlineColor={mortalityStats.totalDeaths > 0 ? mortColor : undefined}
          subline={
            mortalityStats.totalInitial > 0
              ? `${t('batches.totalDeaths', 'Deaths').toLowerCase()}  ·  ${mortalityStats.mortalityPct.toFixed(2)}%`
              : t('batches.totalDeaths', 'Deaths').toLowerCase()
          }
          sublineColor={mortalityStats.totalInitial > 0 ? mortColor : undefined}
          stats={[
            {
              icon: Heart,
              label: t('batches.survivalRate', 'Survival'),
              value: `${mortalityStats.survivalPct.toFixed(2)}%`,
              valueColor: accentColor,
            },
            {
              icon: Home,
              label: t('batches.worstHouse', 'Worst House'),
              value: mortalityStats.worstHouse?.name || '—',
              subValue: mortalityStats.worstHouse
                ? `${mortalityStats.worstHouse.rate.toFixed(2)}%`
                : null,
              subValueColor: worstColor,
            },
            {
              icon: TrendingDown,
              label: t('batches.avgDailyDeaths', 'Avg Daily'),
              value: mortalityStats.avgDailyDeaths >= 10
                ? fmt(mortalityStats.avgDailyDeaths)
                : mortalityStats.avgDailyDeaths.toFixed(1),
            },
          ]}
        />

        <ChartCard
          sectionTitle={t('charts.mortalityTrend', 'Mortality Trend')}
          sectionIcon={Activity}
          title={mortView === 'cumulative'
            ? t('farms.avgCumulativeMortality', 'Avg Cumulative Mortality / House')
            : t('farms.avgDailyDeaths', 'Avg Daily Deaths / House')}
          segments={[
            { value: 'cumulative', icon: Activity },
            { value: 'daily', icon: BarChart3 },
          ]}
          segmentValue={mortView}
          onSegmentChange={setMortView}
        >
          <MortalityChart
            dailyLogs={averagedDeathsLogs}
            houses={farmHouses}
            view={mortView}
          />
        </ChartCard>

        <BatchKpiCard
          title={t('batches.consumptionSummary', 'Consumption')}
          icon={Wheat}
          headline={fmtCompactKg(consumptionStats.totalFeed)}
          subline={`${fmtCompactL(consumptionStats.totalWater)}  ·  ${t('batches.totalWater', 'Water').toLowerCase()}`}
          stats={[
            {
              icon: Wheat,
              label: t('batches.feedPerBird', 'Feed / Bird'),
              value: `${consumptionStats.feedPerBird.toFixed(2)} kg`,
            },
            {
              icon: Droplets,
              label: t('batches.waterPerBird', 'Water / Bird'),
              value: `${consumptionStats.waterPerBird.toFixed(2)} L`,
            },
            {
              icon: ClipboardList,
              label: t('batches.daysLogged', 'Days Logged'),
              value: fmt(consumptionStats.daysLogged),
            },
          ]}
        />

        <ChartCard
          sectionTitle={t('charts.consumption', 'Consumption Trend')}
          sectionIcon={Wheat}
          title={consMetric === 'feed'
            ? (consView === 'cumulative'
                ? t('farms.avgCumulativeFeed', 'Avg Cumulative Feed / House')
                : t('farms.avgDailyFeed', 'Avg Daily Feed / House'))
            : (consView === 'cumulative'
                ? t('farms.avgCumulativeWater', 'Avg Cumulative Water / House')
                : t('farms.avgDailyWater', 'Avg Daily Water / House'))}
          segments={[
            { value: 'feed', icon: Wheat },
            { value: 'water', icon: Droplets },
          ]}
          segmentValue={consMetric}
          onSegmentChange={setConsMetric}
          segmentsRow2={[
            { value: 'cumulative', icon: Activity },
            { value: 'daily', icon: BarChart3 },
          ]}
          segmentValue2={consView}
          onSegmentChange2={setConsView}
        >
          <ConsumptionChart
            dailyLogs={consumptionLogs}
            houses={farmHouses}
            metric={consMetric}
            view={consView}
          />
        </ChartCard>

        {/* Per-cycle list — visual recipe lifted from the Batches list
            row (avatar + name + bird/mortality meta, day-of-cycle label,
            progress bar). No swipe actions, no expense aggregation; just
            the clean batch-row look the user already trusts on the
            Batches tab. Cards separated by the canonical 2pt rounded
            divider used everywhere batches are listed. */}
        {perBatchCards.length > 0 ? (
          <SheetSection
            title={t('farms.perBatchPerformance', 'Per Batch')}
            icon={Layers}
            padded={false}
          >
            <View style={cycleListStyles.list}>
              {perBatchCards.map((b, idx) => (
                <View key={b._id}>
                  {idx > 0 ? (
                    <View
                      style={[
                        cycleListStyles.cardSeparator,
                        { backgroundColor: tokens.elevatedCardBorder },
                      ]}
                    />
                  ) : null}
                  <CycleRow
                    cycle={b}
                    tokens={tokens}
                    isRTL={isRTL}
                    t={t}
                    onPress={() => router.push(`/(app)/batch/${b._id}`)}
                  />
                </View>
              ))}
            </View>
          </SheetSection>
        ) : null}
      </ScrollView>
    </View>
  );
}

/**
 * Per-cycle row — same visual recipe as `BatchesList.BatchRow`, minus
 * the swipe actions / edit / delete chrome. The user explicitly asked
 * to "reuse the view we use for Batchlist view" for this list.
 */
function CycleRow({ cycle, tokens, isRTL, t, onPress }) {
  const {
    mutedColor, textColor, accentColor, dark,
    elevatedCardBg, elevatedCardBorder, elevatedCardPressedBg,
  } = tokens;
  const status = getStatusConfig(cycle.status);
  const mortalityColor = mortalityToneColor(cycle.mortalityPct, tokens);

  const showHealthMeta = cycle.initial > 0;
  const showProgressBar = cycle.hasStarted && (cycle.isInProgress || cycle.isComplete);
  // Same complete-state behaviour as BatchesList: keep the % + track
  // mounted for vertical-rhythm parity, but hide them with opacity 0
  // so the card height matches in-progress rows.
  const hideProgressChrome = cycle.isComplete;
  const barPct = cycle.isComplete ? 100 : cycle.cycleProgressPct;

  const progressLabel = cycle.isComplete
    ? t('batches.daysShort', '{{days}} days', { days: cycle.dayCount })
    : cycle.isInProgress
      ? t('dashboard.dayN', 'Day {{n}}', { n: cycle.dayCount })
      : t('batches.notStarted', 'Not started');

  return (
    <Pressable
      onPressIn={() => Haptics.selectionAsync().catch(() => {})}
      onPress={onPress}
      android_ripple={{
        color: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
        borderless: false,
      }}
      style={({ pressed }) => [
        cycleStyles.card,
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
      <View
        style={[
          cycleStyles.headerRow,
          { flexDirection: isRTL ? 'row-reverse' : 'row' },
        ]}
      >
        <BatchAvatar
          letter={cycle.avatarLetter}
          sequence={cycle.batchNum}
          status={status}
          size={40}
          radius={14}
        />
        <View style={cycleStyles.headerTextCol}>
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
            {cycle.batchName}
          </Text>
          {showHealthMeta ? (
            <View
              style={[
                cycleStyles.metaRow,
                { flexDirection: isRTL ? 'row-reverse' : 'row' },
              ]}
            >
              <View
                style={[
                  cycleStyles.metaPiece,
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
                  {fmtInt(cycle.remaining)}
                </Text>
                {cycle.deaths > 0 ? (
                  <Text
                    style={{
                      fontSize: 12,
                      fontFamily: 'Poppins-SemiBold',
                      color: mortalityColor,
                    }}
                  >
                    {`(-${fmtInt(cycle.deaths)})`}
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
                {`${cycle.mortalityPct.toFixed(2)}%`}
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      <View
        style={[
          cycleStyles.progressLabelRow,
          { flexDirection: isRTL ? 'row-reverse' : 'row' },
        ]}
      >
        <View
          style={[
            cycleStyles.progressLabelLeft,
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
              cycleStyles.progressBarTrack,
              {
                backgroundColor: dark
                  ? 'rgba(255,255,255,0.06)'
                  : 'rgba(0,0,0,0.05)',
              },
            ]}
          >
            <View
              style={[
                cycleStyles.progressBarFill,
                { backgroundColor: accentColor, width: `${barPct}%` },
              ]}
            />
          </View>
        </View>
      ) : null}
    </Pressable>
  );
}

const cycleListStyles = StyleSheet.create({
  list: {
    padding: 8,
  },
  cardSeparator: {
    height: 2,
    borderRadius: 1,
    marginVertical: 12,
    marginHorizontal: 4,
  },
});

const cycleStyles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  headerRow: {
    alignItems: 'center',
    gap: 12,
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
});
