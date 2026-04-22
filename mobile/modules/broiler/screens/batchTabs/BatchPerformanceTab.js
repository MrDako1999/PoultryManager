import { useMemo, useState } from 'react';
import {
  View, Text, Pressable, ScrollView, RefreshControl, StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import {
  Home, Wheat, Droplets, Activity, BarChart3, Skull, Heart, ClipboardList,
  TrendingDown, ChevronRight, ChevronLeft,
} from 'lucide-react-native';
import useLocalQuery from '@/hooks/useLocalQuery';
import { useHeroSheetTokens } from '@/components/HeroSheetScreen';
import { useIsRTL } from '@/stores/localeStore';
import SheetSection from '@/components/SheetSection';
import EmptyState from '@/components/ui/EmptyState';
import ChartCard from '@/components/ChartCard';
import MortalityChart from '@/modules/broiler/charts/MortalityChart';
import ConsumptionChart from '@/modules/broiler/charts/ConsumptionChart';
import { SkeletonBatchPerformance } from '@/components/skeletons';
import { deltaSync } from '@/lib/syncEngine';
import { rowDirection, textAlignStart } from '@/lib/rtl';
import BatchKpiCard, {
  mortalityToneColor,
} from '@/modules/broiler/components/BatchKpiCard';

const NUMERIC_LOCALE = 'en-US';

const fmt = (val, digits = 0) =>
  Number(val || 0).toLocaleString(NUMERIC_LOCALE, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });

const fmtCompactKg = (val) => {
  const n = Number(val || 0);
  if (n >= 1000) {
    return `${(n / 1000).toLocaleString(NUMERIC_LOCALE, {
      minimumFractionDigits: 1, maximumFractionDigits: 1,
    })}t`;
  }
  return `${fmt(n)} kg`;
};

const fmtCompactL = (val) => {
  const n = Number(val || 0);
  if (n >= 1000) {
    return `${(n / 1000).toLocaleString(NUMERIC_LOCALE, {
      minimumFractionDigits: 1, maximumFractionDigits: 1,
    })}kL`;
  }
  return `${fmt(n)} L`;
};

export default function BatchPerformanceTab({ batch, batchId }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const isRTL = useIsRTL();
  const tokens = useHeroSheetTokens();
  const {
    accentColor, dark, mutedColor, textColor, borderColor, screenBg,
    elevatedCardBg, elevatedCardBorder,
  } = tokens;
  const [refreshing, setRefreshing] = useState(false);
  const [mortView, setMortView] = useState('cumulative');
  const [consMetric, setConsMetric] = useState('feed');
  const [consView, setConsView] = useState('cumulative');
  const [dailyLogs, dailyLogsLoading] = useLocalQuery('dailyLogs', { batch: batchId });
  const houses = batch?.houses || [];
  const startDate = batch?.startDate;

  const openHouseLogs = (id) => {
    Haptics.selectionAsync().catch(() => {});
    router.push(`/(app)/batch/${batchId}/house/${id}/logs`);
  };

  const totalInitial = useMemo(
    () => houses.reduce((s, h) => s + (h.quantity || 0), 0),
    [houses]
  );

  const cycleDays = useMemo(() => {
    if (!startDate) return 0;
    const start = new Date(startDate);
    const days = Math.max(1, Math.floor((new Date() - start) / 86400000));
    return days;
  }, [startDate]);

  const housesData = useMemo(() => {
    const meta = houses.map((h, i) => {
      const houseId = (typeof h.house === 'object' ? h.house?._id : h.house) || `h${i}`;
      const name = (typeof h.house === 'object' ? h.house?.name : null)
        || h.name
        || t('farms.houseN', 'House {{n}}', { n: i + 1 });
      return { id: houseId, name, qty: h.quantity || 0 };
    });
    const idIndex = Object.fromEntries(meta.map((m, i) => [m.id, i]));

    const enriched = meta.map((m) => ({
      ...m,
      logs: [],
      deaths: 0,
      feedKg: 0,
      waterL: 0,
      lastLogDate: null,
    }));

    (dailyLogs || []).forEach((log) => {
      if (log.deletedAt) return;
      const houseId = log.house?._id || log.house;
      const idx = idIndex[houseId];
      if (idx == null) return;
      const entry = enriched[idx];
      entry.logs.push(log);
      if (log.logType === 'DAILY') {
        if (log.deaths != null) entry.deaths += log.deaths || 0;
        entry.feedKg += log.feedKg || 0;
        entry.waterL += log.waterLiters || 0;
      }
      const logDateRaw = log.logDate || log.date;
      if (logDateRaw) {
        const d = new Date(logDateRaw);
        if (!entry.lastLogDate || d > entry.lastLogDate) entry.lastLogDate = d;
      }
    });

    enriched.forEach((entry) => {
      entry.logs.sort((a, b) => new Date(b.logDate || b.date || 0) - new Date(a.logDate || a.date || 0));
      entry.mortalityPct = entry.qty > 0 ? (entry.deaths / entry.qty) * 100 : 0;
      entry.currentBirds = Math.max(0, entry.qty - entry.deaths);
    });

    return enriched;
  }, [dailyLogs, houses, t]);

  const sortedHousesByMortality = useMemo(
    () => [...housesData].sort((a, b) => b.mortalityPct - a.mortalityPct),
    [housesData]
  );

  const mortalityStats = useMemo(() => {
    const totalDeaths = housesData.reduce((s, h) => s + h.deaths, 0);
    const mortalityPct = totalInitial > 0 ? (totalDeaths / totalInitial) * 100 : 0;
    const survivalPct = 100 - mortalityPct;
    const worst = sortedHousesByMortality[0];
    const worstHouse = worst && worst.deaths > 0
      ? { name: worst.name, deaths: worst.deaths, rate: worst.mortalityPct }
      : null;
    const avgDailyDeaths = cycleDays > 0 ? totalDeaths / cycleDays : 0;
    return {
      totalDeaths,
      mortalityPct,
      survivalPct,
      worstHouse,
      avgDailyDeaths,
      hasData: totalDeaths > 0,
    };
  }, [housesData, sortedHousesByMortality, totalInitial, cycleDays]);

  const consumptionStats = useMemo(() => {
    const dayCounts = new Set();
    let totalFeed = 0;
    let totalWater = 0;
    (dailyLogs || []).forEach((log) => {
      if (log.deletedAt || log.logType !== 'DAILY') return;
      totalFeed += log.feedKg || 0;
      totalWater += log.waterLiters || 0;
      const dateKey = log.logDate || log.date;
      if (dateKey && (log.feedKg || log.waterLiters)) {
        dayCounts.add(new Date(dateKey).toISOString().slice(0, 10));
      }
    });
    return {
      totalFeed,
      totalWater,
      feedPerBird: totalInitial > 0 ? totalFeed / totalInitial : 0,
      waterPerBird: totalInitial > 0 ? totalWater / totalInitial : 0,
      daysLogged: dayCounts.size,
      hasData: totalFeed > 0 || totalWater > 0,
    };
  }, [dailyLogs, totalInitial]);

  const onRefresh = async () => {
    setRefreshing(true);
    try { await deltaSync(); } catch (e) { console.error(e); }
    setRefreshing(false);
  };

  if (houses.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: screenBg }}>
        <EmptyState
          icon={Home}
          title={t('batches.selectHouses', 'No houses on this batch')}
          description={t('batches.operations.noEntriesDesc', 'Add houses to see performance data.')}
        />
      </View>
    );
  }

  if (dailyLogsLoading) {
    return <SkeletonBatchPerformance />;
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
            totalInitial > 0
              ? `${t('batches.totalDeaths', 'Deaths').toLowerCase()}  ·  ${mortalityStats.mortalityPct.toFixed(2)}%`
              : t('batches.totalDeaths', 'Deaths').toLowerCase()
          }
          sublineColor={totalInitial > 0 ? mortColor : undefined}
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
            ? t('charts.cumulativeMortality', 'Cumulative Mortality')
            : t('charts.dailyDeaths', 'Daily Deaths')}
          segments={[
            { value: 'cumulative', icon: Activity },
            { value: 'daily', icon: BarChart3 },
          ]}
          segmentValue={mortView}
          onSegmentChange={setMortView}
        >
          <MortalityChart
            dailyLogs={dailyLogs}
            houses={houses}
            startDate={startDate}
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
          title={consMetric === 'feed' ? t('batches.totalFeed', 'Total Feed') : t('batches.totalWater', 'Total Water')}
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
            dailyLogs={dailyLogs}
            houses={houses}
            startDate={startDate}
            metric={consMetric}
            view={consView}
          />
        </ChartCard>

        {/* Per-house raw data — each card opens a full house log detail
            screen (KPI hero + filters + day-grouped logs). The card itself
            shows a quick-stat sub-line so the user can compare houses at a
            glance without drilling in. */}
        {housesData.length > 0 ? (
          <SheetSection
            title={t('batches.rawDataByHouse', 'Raw data by house')}
            icon={ClipboardList}
            padded={false}
          >
            <View style={{ padding: 8, gap: 10 }}>
              {housesData.map((house) => {
                const ChevronGlyph = isRTL ? ChevronLeft : ChevronRight;
                const subParts = [];
                if (house.deaths > 0) {
                  subParts.push(`${fmt(house.deaths)} ${t('batches.operations.deathsShort', 'Deaths').toLowerCase()}`);
                }
                if (house.feedKg > 0) {
                  subParts.push(`${fmt(house.feedKg)} kg ${t('batches.operations.feedShort', 'Feed').toLowerCase()}`);
                }
                if (house.waterL > 0) {
                  subParts.push(`${fmt(house.waterL)} L ${t('batches.operations.waterShort', 'Water').toLowerCase()}`);
                }
                const subline = subParts.length > 0
                  ? subParts.join('  ·  ')
                  : t('batches.operations.noEntries', 'No entries yet');
                return (
                  <Pressable
                    key={house.id}
                    onPress={() => openHouseLogs(house.id)}
                    android_ripple={{
                      color: dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
                      borderless: false,
                    }}
                    style={[
                      perHouseStyles.card,
                      {
                        backgroundColor: elevatedCardBg,
                        borderColor: elevatedCardBorder,
                      },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={t('batches.viewAllLogs', 'All Logs')}
                  >
                    <View
                      style={[
                        perHouseStyles.headerRow,
                        { flexDirection: rowDirection(isRTL) },
                      ]}
                    >
                      <Home size={14} color={mutedColor} strokeWidth={2.2} />
                      <View style={perHouseStyles.textCol}>
                        <View
                          style={[
                            perHouseStyles.titleRow,
                            { flexDirection: rowDirection(isRTL) },
                          ]}
                        >
                          <Text
                            style={{
                              flex: 1,
                              fontSize: 14,
                              fontFamily: 'Poppins-SemiBold',
                              color: textColor,
                              textAlign: textAlignStart(isRTL),
                            }}
                            numberOfLines={1}
                          >
                            {house.name}
                          </Text>
                          <Text
                            style={{
                              fontSize: 11,
                              fontFamily: 'Poppins-SemiBold',
                              color: mutedColor,
                              letterSpacing: 0.4,
                            }}
                          >
                            {`${fmt(house.qty)} ${t('farms.birds', 'birds').toLowerCase()}`}
                          </Text>
                        </View>
                        <Text
                          style={{
                            fontSize: 11,
                            fontFamily: 'Poppins-Medium',
                            color: mutedColor,
                            marginTop: 3,
                            textAlign: textAlignStart(isRTL),
                          }}
                          numberOfLines={1}
                        >
                          {subline}
                        </Text>
                      </View>
                      <View
                        style={[
                          perHouseStyles.countPill,
                          {
                            backgroundColor: dark ? 'rgba(255,255,255,0.06)' : 'hsl(148, 18%, 96%)',
                            borderColor: dark ? 'rgba(255,255,255,0.08)' : borderColor,
                          },
                        ]}
                      >
                        <Text
                          style={{
                            fontSize: 11,
                            fontFamily: 'Poppins-SemiBold',
                            color: mutedColor,
                          }}
                        >
                          {fmt(house.logs.length)}
                        </Text>
                      </View>
                      <ChevronGlyph size={16} color={mutedColor} strokeWidth={2.4} />
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </SheetSection>
        ) : null}
      </ScrollView>
    </View>
  );
}

const perHouseStyles = StyleSheet.create({
  card: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  headerRow: {
    alignItems: 'center',
    gap: 10,
  },
  textCol: {
    flex: 1,
    minWidth: 0,
  },
  titleRow: {
    alignItems: 'center',
    gap: 8,
  },
  countPill: {
    minWidth: 28,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
  },
});
