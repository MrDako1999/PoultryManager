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
  TrendingDown, Home, Layers,
} from 'lucide-react-native';
import { useHeroSheetTokens } from '@/components/HeroSheetScreen';
import { useIsRTL } from '@/stores/localeStore';
import { deltaSync } from '@/lib/syncEngine';
import EmptyState from '@/components/ui/EmptyState';
import SheetSection from '@/components/SheetSection';
import ChartCard from '@/components/ChartCard';
import MortalityChart from '@/modules/broiler/charts/MortalityChart';
import ConsumptionChart from '@/modules/broiler/charts/ConsumptionChart';
import { SkeletonFarmPerformanceTab } from '@/components/skeletons';
import BatchKpiCard, {
  mortalityToneColor,
} from '@/modules/broiler/components/BatchKpiCard';

const NUMERIC_LOCALE = 'en-US';

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
  const [mortView, setMortView] = useState('cumulative');
  const [consMetric, setConsMetric] = useState('feed');
  const [consView, setConsView] = useState('cumulative');

  // Build a unified house list across the farm. Daily logs reference houses
  // by `house._id || house`; we need a stable, ordered list of distinct
  // houses that appear across this farm's batches. Same recipe as the
  // pre-rework version — preserved verbatim because it powers MortalityChart
  // and ConsumptionChart.
  const farmHouses = useMemo(() => {
    const map = new Map();
    houses.forEach((h) => {
      if (!h._id) return;
      map.set(h._id, { house: { _id: h._id, name: h.name } });
    });
    farmBatches.forEach((b) => {
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
  }, [houses, farmBatches]);

  const farmBatchIds = useMemo(
    () => new Set(farmBatches.map((b) => b._id)),
    [farmBatches]
  );

  const farmDailyLogs = useMemo(
    () => allDailyLogs.filter((log) => {
      if (log.deletedAt || log.logType !== 'DAILY') return false;
      const batchId = typeof log.batch === 'object' ? log.batch?._id : log.batch;
      return farmBatchIds.has(batchId);
    }),
    [allDailyLogs, farmBatchIds]
  );

  const startDateById = useMemo(() => {
    const map = {};
    farmBatches.forEach((b) => { map[b._id] = b.startDate; });
    return map;
  }, [farmBatches]);

  // Average across batches per (house, cycleDay), separately for deaths/feed/water.
  // Each (house, day) accumulates contributions from each batch that had a log
  // on that day for that house. Multiple logs from the same batch on the same
  // day get summed first (e.g. weight + daily); then divided by the number of
  // contributing batches.
  function buildAveragedLogs(field) {
    const perBatch = {};
    farmDailyLogs.forEach((log) => {
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
    return Object.values(agg).map(({ sum, batches, houseId, day }) => {
      const avg = batches.size > 0 ? sum / batches.size : 0;
      return {
        _id: `synth-${field}-${houseId}-${day}`,
        logType: 'DAILY',
        cycleDay: day,
        house: { _id: houseId },
        [field]: avg,
      };
    });
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const averagedDeathsLogs = useMemo(() => buildAveragedLogs('deaths'), [farmDailyLogs, startDateById]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const averagedFeedLogs = useMemo(() => buildAveragedLogs('feedKg'), [farmDailyLogs, startDateById]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const averagedWaterLogs = useMemo(() => buildAveragedLogs('waterLiters'), [farmDailyLogs, startDateById]);

  const consumptionLogs = consMetric === 'feed' ? averagedFeedLogs : averagedWaterLogs;

  // Hero stats — totals across all logs (not averaged), for honest top-line numbers.
  const mortalityStats = useMemo(() => {
    let totalDeaths = 0;
    let totalInitial = 0;
    const deathsByHouse = {};
    const initialByHouse = {};
    const dayKeys = new Set();
    farmBatches.forEach((b) => {
      (b.houses || []).forEach((bh) => {
        const id = (typeof bh.house === 'object' ? bh.house?._id : bh.house);
        const qty = bh.quantity || 0;
        totalInitial += qty;
        if (id) initialByHouse[id] = (initialByHouse[id] || 0) + qty;
      });
    });
    farmDailyLogs.forEach((log) => {
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
  }, [farmBatches, farmDailyLogs, farmHouses]);

  const consumptionStats = useMemo(() => {
    let totalFeed = 0;
    let totalWater = 0;
    const dayKeys = new Set();
    farmDailyLogs.forEach((log) => {
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
  }, [farmDailyLogs, mortalityStats.totalInitial]);

  const perBatchCards = useMemo(() => {
    const deathsByBatch = {};
    const feedByBatch = {};
    farmDailyLogs.forEach((log) => {
      const batchId = typeof log.batch === 'object' ? log.batch?._id : log.batch;
      if (!batchId) return;
      deathsByBatch[batchId] = (deathsByBatch[batchId] || 0) + (log.deaths || 0);
      feedByBatch[batchId] = (feedByBatch[batchId] || 0) + (log.feedKg || 0);
    });
    return farmBatches
      .map((b) => {
        const initial = (b.houses || []).reduce((s, h) => s + (h.quantity || 0), 0);
        const deaths = deathsByBatch[b._id] || 0;
        const mortalityPct = initial > 0 ? (deaths / initial) * 100 : 0;
        const feed = feedByBatch[b._id] || 0;
        const dayCount = b.startDate
          ? Math.max(0, Math.floor((Date.now() - new Date(b.startDate)) / 86400000))
          : 0;
        return {
          _id: b._id, batchName: b.batchName,
          initial, deaths, mortalityPct, feed, dayCount,
          status: b.status,
        };
      })
      .sort((a, b) => b.mortalityPct - a.mortalityPct);
  }, [farmBatches, farmDailyLogs]);

  const onRefresh = async () => {
    setRefreshing(true);
    try { await deltaSync(); } catch (e) { console.error(e); }
    setRefreshing(false);
  };

  if (dailyLogsLoading && farmDailyLogs.length === 0) {
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

        {perBatchCards.length > 0 ? (
          <SheetSection
            title={t('farms.perBatchPerformance', 'Per Batch')}
            icon={Layers}
            padded={false}
          >
            <View style={{ padding: 8, gap: 12 }}>
              {perBatchCards.map((b) => (
                <PerBatchCard
                  key={b._id}
                  batch={b}
                  tokens={tokens}
                  isRTL={isRTL}
                  t={t}
                  onPress={() => router.push(`/(app)/batch/${b._id}`)}
                />
              ))}
            </View>
          </SheetSection>
        ) : null}
      </ScrollView>
    </View>
  );
}

/**
 * Per-batch summary card. Elevated tappable surface with the batch name +
 * status pill and a 4-cell stat row. Layout in StyleSheet (§9 trap rule).
 */
function PerBatchCard({ batch, tokens, isRTL, t, onPress }) {
  const {
    textColor, accentColor, dark,
    elevatedCardBg, elevatedCardBorder, elevatedCardPressedBg,
  } = tokens;
  const mortColor = mortalityToneColor(batch.mortalityPct, tokens);
  const isInProgress = batch.status === 'IN_PROGRESS';
  const statusBg = isInProgress
    ? (dark ? 'rgba(217, 119, 6, 0.18)' : 'hsl(38, 92%, 92%)')
    : (dark ? 'rgba(148,210,165,0.18)' : 'hsl(148, 35%, 92%)');
  const statusFg = isInProgress
    ? (dark ? '#fbbf24' : '#d97706')
    : accentColor;
  const statusLabel = isInProgress
    ? t('batches.statusInProgress', 'In Progress')
    : t('batches.statusComplete', 'Complete');

  return (
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
        },
      ]}
    >
      <View
        style={[
          cardStyles.headerRow,
          { flexDirection: isRTL ? 'row-reverse' : 'row' },
        ]}
      >
        <Text
          style={{
            flex: 1,
            minWidth: 0,
            fontSize: 14,
            fontFamily: 'Poppins-SemiBold',
            color: textColor,
            letterSpacing: -0.1,
            textAlign: isRTL ? 'right' : 'left',
          }}
          numberOfLines={1}
        >
          {batch.batchName}
        </Text>
        <View style={[cardStyles.statusPill, { backgroundColor: statusBg }]}>
          <Text
            style={{
              fontSize: 10,
              fontFamily: 'Poppins-SemiBold',
              color: statusFg,
              letterSpacing: 0.4,
              textTransform: 'uppercase',
            }}
          >
            {statusLabel}
          </Text>
        </View>
      </View>

      <View
        style={[
          cardStyles.statRow,
          {
            flexDirection: isRTL ? 'row-reverse' : 'row',
            borderTopColor: dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
          },
        ]}
      >
        <StatCell
          icon={Layers}
          label={t('batches.totalChicks', 'Chicks')}
          value={fmtInt(batch.initial)}
          tokens={tokens}
          isRTL={isRTL}
        />
        <StatDivider tokens={tokens} />
        <StatCell
          icon={Skull}
          label={t('dashboard.mortalityRate', 'Mortality')}
          value={`${batch.mortalityPct.toFixed(2)}%`}
          valueColor={mortColor}
          tokens={tokens}
          isRTL={isRTL}
        />
        <StatDivider tokens={tokens} />
        <StatCell
          icon={Wheat}
          label={t('dashboard.feedConsumed', 'Feed')}
          value={fmtCompactKg(batch.feed)}
          tokens={tokens}
          isRTL={isRTL}
        />
        <StatDivider tokens={tokens} />
        <StatCell
          icon={Activity}
          label={t('batches.dayCount', 'Days')}
          value={fmtInt(batch.dayCount)}
          tokens={tokens}
          isRTL={isRTL}
        />
      </View>
    </Pressable>
  );
}

function StatCell({ icon: Icon, label, value, valueColor, tokens, isRTL }) {
  const { mutedColor, textColor } = tokens;
  return (
    <View style={cardStyles.statCell}>
      <View
        style={[
          cardStyles.statLabelRow,
          { flexDirection: isRTL ? 'row-reverse' : 'row' },
        ]}
      >
        <Icon size={11} color={mutedColor} strokeWidth={2.4} />
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
          {label}
        </Text>
      </View>
      <Text
        style={{
          fontSize: 14,
          fontFamily: 'Poppins-SemiBold',
          color: valueColor || textColor,
          fontVariant: ['tabular-nums'],
          textAlign: isRTL ? 'right' : 'left',
          marginTop: 2,
        }}
        numberOfLines={1}
      >
        {value}
      </Text>
    </View>
  );
}

function StatDivider({ tokens }) {
  const { dark } = tokens;
  return (
    <View
      style={{
        width: StyleSheet.hairlineWidth,
        backgroundColor: dark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)',
        marginHorizontal: 8,
        alignSelf: 'stretch',
      }}
    />
  );
}

const cardStyles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  headerRow: {
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  statRow: {
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  statCell: {
    flex: 1,
    minWidth: 0,
  },
  statLabelRow: {
    alignItems: 'center',
    gap: 4,
  },
});
