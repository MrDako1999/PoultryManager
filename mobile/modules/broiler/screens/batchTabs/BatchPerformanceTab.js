import { useMemo, useState } from 'react';
import { View, Text, ScrollView, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import {
  Skull, AlertTriangle, ShieldCheck, Home, Wheat, Droplets,
  Activity, BarChart3,
} from 'lucide-react-native';
import useLocalQuery from '@/hooks/useLocalQuery';
import useThemeStore from '@/stores/themeStore';
import StatCard from '@/components/ui/StatCard';
import EmptyState from '@/components/ui/EmptyState';
import CollapsibleSection from '@/components/CollapsibleSection';
import ChartCard from '@/components/ChartCard';
import MortalityChart from '@/modules/broiler/charts/MortalityChart';
import ConsumptionChart from '@/modules/broiler/charts/ConsumptionChart';
import DailyLogRow from '@/modules/broiler/rows/DailyLogRow';
import { deltaSync } from '@/lib/syncEngine';

const fmt = (val, digits = 0) =>
  Number(val || 0).toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits });

export default function BatchPerformanceTab({ batch, batchId }) {
  const { t } = useTranslation();
  const { resolvedTheme } = useThemeStore();
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);
  const [mortView, setMortView] = useState('cumulative');
  const [consMetric, setConsMetric] = useState('feed');
  const [consView, setConsView] = useState('cumulative');

  const [dailyLogs] = useLocalQuery('dailyLogs', { batch: batchId });
  const houses = batch?.houses || [];
  const startDate = batch?.startDate;

  const primaryColor = resolvedTheme === 'dark' ? 'hsl(148, 48%, 38%)' : 'hsl(148, 60%, 20%)';

  const totalInitial = useMemo(
    () => houses.reduce((s, h) => s + (h.quantity || 0), 0),
    [houses]
  );

  const mortalityStats = useMemo(() => {
    const deathLogs = (dailyLogs || []).filter(
      (log) => log.logType === 'DAILY' && log.deaths != null && !log.deletedAt
    );
    const totalDeaths = deathLogs.reduce((s, log) => s + (log.deaths || 0), 0);
    const mortalityPct = totalInitial > 0 ? (totalDeaths / totalInitial) * 100 : 0;
    const survivalPct = 100 - mortalityPct;

    const deathsByHouse = {};
    deathLogs.forEach((log) => {
      const houseId = log.house?._id || log.house;
      deathsByHouse[houseId] = (deathsByHouse[houseId] || 0) + (log.deaths || 0);
    });
    let worstHouse = null;
    let worstRate = -1;
    houses.forEach((h, i) => {
      const houseId = typeof h.house === 'object' ? h.house?._id : h.house;
      const houseQty = h.quantity || 0;
      const houseDeaths = deathsByHouse[houseId] || 0;
      const rate = houseQty > 0 ? (houseDeaths / houseQty) * 100 : 0;
      if (rate > worstRate) {
        worstRate = rate;
        worstHouse = {
          name: (typeof h.house === 'object' ? h.house?.name : null) || h.name || `House ${i + 1}`,
          deaths: houseDeaths,
          rate,
        };
      }
    });

    return {
      totalDeaths,
      mortalityPct,
      survivalPct,
      worstHouse,
      hasData: totalDeaths > 0,
    };
  }, [dailyLogs, houses, totalInitial]);

  const consumptionStats = useMemo(() => {
    const logs = (dailyLogs || []).filter((log) => log.logType === 'DAILY' && !log.deletedAt);
    const totalFeed = logs.reduce((s, log) => s + (log.feedKg || 0), 0);
    const totalWater = logs.reduce((s, log) => s + (log.waterLiters || 0), 0);
    return {
      totalFeed,
      totalWater,
      feedPerBird: totalInitial > 0 ? totalFeed / totalInitial : 0,
      waterPerBird: totalInitial > 0 ? totalWater / totalInitial : 0,
      hasData: totalFeed > 0 || totalWater > 0,
    };
  }, [dailyLogs, totalInitial]);

  const logsByHouse = useMemo(() => {
    const map = new Map();
    houses.forEach((h, i) => {
      const houseId = (typeof h.house === 'object' ? h.house?._id : h.house) || `h${i}`;
      const name = (typeof h.house === 'object' ? h.house?.name : null) || h.name || `House ${i + 1}`;
      map.set(houseId, { id: houseId, name, qty: h.quantity || 0, logs: [] });
    });
    (dailyLogs || []).forEach((log) => {
      if (log.deletedAt) return;
      const houseId = log.house?._id || log.house;
      const entry = map.get(houseId);
      if (entry) entry.logs.push(log);
    });
    map.forEach((entry) => {
      entry.logs.sort((a, b) => new Date(b.logDate || b.date || 0) - new Date(a.logDate || a.date || 0));
    });
    return Array.from(map.values());
  }, [dailyLogs, houses]);

  const onRefresh = async () => {
    setRefreshing(true);
    try { await deltaSync(); } catch (e) { console.error(e); }
    setRefreshing(false);
  };

  if (houses.length === 0) {
    return (
      <View className="flex-1 bg-background">
        <EmptyState
          icon={Home}
          title={t('batches.selectHouses', 'No houses on this batch')}
          description={t('batches.operations.noEntriesDesc', 'Add houses to see performance data.')}
        />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 96 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={primaryColor} />}
      >
        {mortalityStats.hasData && (
          <>
            <View className="flex-row gap-2 mb-2">
              <StatCard
                label={t('batches.totalDeaths', 'Total Deaths')}
                value={mortalityStats.totalDeaths.toLocaleString()}
                valueClassName="text-red-500"
                icon={Skull}
              />
              <StatCard
                label={t('dashboard.mortalityRate', 'Mortality Rate')}
                value={`${mortalityStats.mortalityPct.toFixed(2)}%`}
                valueClassName="text-amber-500"
                icon={AlertTriangle}
              />
            </View>
            <View className="flex-row gap-2 mb-3">
              <StatCard
                label={t('batches.survivalRate', 'Survival Rate')}
                value={`${mortalityStats.survivalPct.toFixed(2)}%`}
                valueClassName="text-emerald-600"
                icon={ShieldCheck}
              />
              <View className="flex-1 rounded-lg border border-border bg-card p-3 min-w-[100px]">
                <View className="flex-row items-center justify-between mb-1">
                  <Text className="text-xs text-muted-foreground flex-1" numberOfLines={1}>
                    {t('batches.highestMortality', 'Highest Mortality')}
                  </Text>
                  <Home size={14} color="#dc2626" />
                </View>
                <Text className="text-base font-bold text-foreground" numberOfLines={1}>
                  {mortalityStats.worstHouse?.name || '—'}
                </Text>
                <Text className="text-[11px] text-muted-foreground tabular-nums" numberOfLines={1}>
                  {mortalityStats.worstHouse
                    ? `${(mortalityStats.worstHouse.deaths || 0).toLocaleString()} (${mortalityStats.worstHouse.rate.toFixed(1)}%)`
                    : '—'}
                </Text>
              </View>
            </View>
          </>
        )}

        <View className="mb-3">
          <ChartCard
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
        </View>

        {consumptionStats.hasData && (
          <>
            <View className="flex-row gap-2 mb-2">
              <StatCard
                label={t('batches.totalFeed', 'Total Feed')}
                value={`${fmt(consumptionStats.totalFeed)} kg`}
                valueClassName="text-amber-600"
                icon={Wheat}
              />
              <StatCard
                label={t('batches.feedPerBird', 'Feed / Bird')}
                value={`${consumptionStats.feedPerBird.toFixed(2)} kg`}
                icon={Wheat}
              />
            </View>
            <View className="flex-row gap-2 mb-3">
              <StatCard
                label={t('batches.totalWater', 'Total Water')}
                value={`${fmt(consumptionStats.totalWater)} L`}
                valueClassName="text-blue-500"
                icon={Droplets}
              />
              <StatCard
                label={t('batches.waterPerBird', 'Water / Bird')}
                value={`${consumptionStats.waterPerBird.toFixed(2)} L`}
                icon={Droplets}
              />
            </View>
          </>
        )}

        <View className="mb-3">
          <ChartCard
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
        </View>

        <View className="mt-2 gap-3">
          {logsByHouse.map((house) => (
            <CollapsibleSection
              key={house.id}
              title={house.name}
              icon={Home}
              itemCount={house.logs.length}
              headerExtra={
                <Text className="text-[10px] text-muted-foreground font-semibold tabular-nums">
                  {house.qty.toLocaleString()} {t('farms.birds', 'birds')}
                </Text>
              }
              defaultOpen={false}
            >
              {house.logs.length === 0 ? (
                <View className="px-3 py-4">
                  <Text className="text-xs text-muted-foreground text-center">
                    {t('batches.operations.noEntries', 'No entries yet')}
                  </Text>
                </View>
              ) : (
                house.logs.slice(0, 3).map((log) => (
                  <DailyLogRow
                    key={log._id}
                    log={log}
                    onClick={() => router.push(`/(app)/daily-log/${log._id}`)}
                  />
                ))
              )}
            </CollapsibleSection>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
