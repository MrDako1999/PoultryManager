import { useMemo, useState } from 'react';
import { View, Text, ScrollView, RefreshControl, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import {
  Home, Wheat, Receipt, Droplets, Skull, Activity, DollarSign, TrendingUp, Bird,
} from 'lucide-react-native';
import useLocalQuery from '@/hooks/useLocalQuery';
import { useHeroSheetTokens } from '@/components/HeroSheetScreen';
import { useIsRTL } from '@/stores/localeStore';
import { deltaSync } from '@/lib/syncEngine';
import { SkeletonBatchOverview } from '@/components/skeletons';
import { rowDirection, textAlignStart } from '@/lib/rtl';
import BatchKpiCard, {
  profitToneColor, mortalityToneColor,
} from '@/modules/broiler/components/BatchKpiCard';

const NUMERIC_LOCALE = 'en-US';

const fmt = (val) =>
  Number(val || 0).toLocaleString(NUMERIC_LOCALE, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
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

const FEED_TYPE_ORDER = { STARTER: 0, GROWER: 1, FINISHER: 2, OTHER: 3 };
const FEED_TYPES_DISPLAYED = ['STARTER', 'GROWER', 'FINISHER'];
const TOP_EXPENSE_CATEGORIES = 5;

export default function BatchOverviewTab({ batch, batchId, onJumpTab }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const isRTL = useIsRTL();
  const tokens = useHeroSheetTokens();
  const {
    accentColor, dark, mutedColor, textColor, screenBg,
  } = tokens;
  const [refreshing, setRefreshing] = useState(false);

  const [expenses, expensesLoading] = useLocalQuery('expenses', { batch: batchId });
  const [feedOrders, feedOrdersLoading] = useLocalQuery('feedOrders', { batch: batchId });
  const [saleOrders, saleOrdersLoading] = useLocalQuery('saleOrders', { batch: batchId });
  const [dailyLogs, dailyLogsLoading] = useLocalQuery('dailyLogs', { batch: batchId });

  const isLoading = expensesLoading || feedOrdersLoading || saleOrdersLoading || dailyLogsLoading;

  const houses = batch?.houses || [];
  const totalInitial = useMemo(
    () => houses.reduce((s, h) => s + (h.quantity || 0), 0),
    [houses]
  );

  const { totalDeaths, deathsByHouse, totalFeedConsumedKg, totalWaterL } = useMemo(() => {
    const byHouse = {};
    let deaths = 0;
    let feedKg = 0;
    let waterL = 0;
    (dailyLogs || []).forEach((log) => {
      if (log.deletedAt || log.logType !== 'DAILY') return;
      if (log.deaths != null) {
        const houseId = log.house?._id || log.house;
        byHouse[houseId] = (byHouse[houseId] || 0) + (log.deaths || 0);
        deaths += log.deaths || 0;
      }
      feedKg += log.feedKg || 0;
      waterL += log.waterLiters || 0;
    });
    return {
      totalDeaths: deaths,
      deathsByHouse: byHouse,
      totalFeedConsumedKg: feedKg,
      totalWaterL: waterL,
    };
  }, [dailyLogs]);

  const currentBirds = Math.max(0, totalInitial - totalDeaths);
  const mortalityPct = totalInitial > 0 ? (totalDeaths / totalInitial) * 100 : 0;
  const survivalPct = totalInitial > 0 ? (currentBirds / totalInitial) * 100 : 0;

  const cycleDayLabel = useMemo(() => {
    if (!batch?.startDate) return null;
    const start = new Date(batch.startDate);
    let end;
    if (batch.status === 'COMPLETE') {
      const lastSaleDate = saleOrders.reduce((max, sale) => {
        if (!sale.saleDate) return max;
        const d = new Date(sale.saleDate);
        return !max || d > max ? d : max;
      }, null);
      end = lastSaleDate || start;
    } else {
      end = new Date();
    }
    const days = Math.max(0, Math.floor((end - start) / 86400000));
    return batch.status === 'COMPLETE'
      ? t('batches.cycleElapsed', '{{days}} days elapsed', { days: fmtInt(days) })
      : t('batches.cycleDay', 'Day {{days}}', { days: fmtInt(days) });
  }, [batch?.startDate, batch?.status, saleOrders, t]);

  const totalExpenses = useMemo(() => expenses.reduce((s, x) => s + (x.totalAmount || 0), 0), [expenses]);
  const totalRevenue = useMemo(() => saleOrders.reduce((s, x) => s + (x.totals?.grandTotal || 0), 0), [saleOrders]);
  const netProfit = totalRevenue - totalExpenses;
  const marginPct = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : null;
  const profitPerBird = currentBirds > 0 ? netProfit / currentBirds : null;

  const feedByType = useMemo(() => {
    const groups = {};
    feedOrders.forEach((order) => {
      (order.items || []).forEach((item) => {
        const type = item.feedType || 'OTHER';
        const bags = item.bags || 0;
        const itemKg = bags * (item.quantitySize || 50);
        if (!groups[type]) groups[type] = { totalKg: 0, totalBags: 0 };
        groups[type].totalKg += itemKg;
        groups[type].totalBags += bags;
      });
    });
    return groups;
  }, [feedOrders]);

  const totalFeedKg = useMemo(
    () => Object.values(feedByType).reduce((s, g) => s + g.totalKg, 0),
    [feedByType]
  );

  const totalFeedBags = useMemo(
    () => Object.values(feedByType).reduce((s, g) => s + g.totalBags, 0),
    [feedByType]
  );

  const otherFeed = useMemo(() => Object.entries(feedByType)
    .filter(([type]) => !FEED_TYPES_DISPLAYED.includes(type))
    .reduce(
      (acc, [, g]) => ({ totalKg: acc.totalKg + g.totalKg, totalBags: acc.totalBags + g.totalBags }),
      { totalKg: 0, totalBags: 0 }
    ),
  [feedByType]);

  const expenseBreakdown = useMemo(() => {
    const groups = {};
    expenses.forEach((e) => {
      const cat = e.category || 'OTHERS';
      if (!groups[cat]) groups[cat] = 0;
      groups[cat] += e.totalAmount || 0;
    });
    const sorted = Object.entries(groups).sort(([, a], [, b]) => b - a);
    const top = sorted.slice(0, TOP_EXPENSE_CATEGORIES);
    const rest = sorted.slice(TOP_EXPENSE_CATEGORIES);
    const otherTotal = rest.reduce((s, [, v]) => s + v, 0);
    if (otherTotal > 0) {
      top.push(['OTHERS', otherTotal]);
    }
    return top;
  }, [expenses]);

  const onRefresh = async () => {
    setRefreshing(true);
    try { await deltaSync(); } catch (e) { console.error(e); }
    setRefreshing(false);
  };

  if (isLoading) {
    return <SkeletonBatchOverview />;
  }

  const profitColor = profitToneColor(netProfit, tokens);
  const mortColor = mortalityToneColor(mortalityPct, tokens);
  const perBirdColor = profitToneColor(profitPerBird, tokens);

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
          title={t('batches.netProfit', 'Net Profit')}
          icon={DollarSign}
          headline={fmt(netProfit)}
          headlineColor={profitColor}
          subline={marginPct != null
            ? t('batches.margin', 'Margin {{pct}}%', { pct: marginPct.toFixed(1) })
            : null}
          stats={[
            {
              icon: TrendingUp,
              label: t('batches.totalRevenue', 'Revenue'),
              value: fmt(totalRevenue),
            },
            {
              icon: Receipt,
              label: t('batches.expenses', 'Expenses'),
              value: fmt(totalExpenses),
            },
            {
              icon: Bird,
              label: t('batches.profitPerBird', 'PNL / Bird'),
              value: profitPerBird != null ? fmt(profitPerBird) : '—',
              valueColor: perBirdColor,
            },
          ]}
        />

        <BatchKpiCard
          title={t('batches.cyclePerformance', 'Cycle Performance')}
          icon={Activity}
          headline={fmtInt(currentBirds)}
          subline={
            totalInitial > 0
              ? `${t('batches.ofPlaced', 'of {{count}} placed', { count: fmtInt(totalInitial) })}${
                  cycleDayLabel ? `  ·  ${cycleDayLabel}` : ''
                }`
              : (cycleDayLabel || null)
          }
          onPress={() => onJumpTab?.('performance')}
          stats={[
            {
              icon: Skull,
              label: t('dashboard.mortalityRate', 'Mortality'),
              value: `${mortalityPct.toFixed(2)}%`,
              valueColor: mortColor,
            },
            {
              icon: Wheat,
              label: t('batches.totalFeed', 'Feed'),
              value: fmtCompactKg(totalFeedConsumedKg),
            },
            {
              icon: Droplets,
              label: t('batches.totalWater', 'Water'),
              value: fmtCompactL(totalWaterL),
            },
          ]}
        >
          {totalInitial > 0 ? (
            <>
              <View
                style={[
                  styles.survivalTrack,
                  {
                    backgroundColor: dark
                      ? 'rgba(255,255,255,0.06)'
                      : 'rgba(0,0,0,0.05)',
                  },
                ]}
              >
                <View
                  style={[
                    styles.survivalFill,
                    {
                      backgroundColor: accentColor,
                      width: `${survivalPct}%`,
                    },
                  ]}
                />
              </View>
              <View style={{ gap: 6, marginTop: 12 }}>
                {houses
                  .map((entry, i) => {
                    const houseId = typeof entry.house === 'object' ? entry.house?._id : entry.house;
                    const name = (typeof entry.house === 'object' ? entry.house?.name : null)
                      || t('farms.houseN', 'House {{n}}', { n: i + 1 });
                    const initial = entry.quantity || 0;
                    const houseDeaths = deathsByHouse[houseId] || 0;
                    const housePct = initial > 0 ? (houseDeaths / initial) * 100 : 0;
                    return { key: houseId || `h${i}`, name, initial, houseDeaths, housePct };
                  })
                  .sort((a, b) => b.houseDeaths - a.houseDeaths)
                  .map((h) => (
                    <View
                      key={h.key}
                      style={[
                        styles.houseRow,
                        {
                          flexDirection: rowDirection(isRTL),
                          backgroundColor: dark
                            ? 'rgba(255,255,255,0.04)'
                            : 'hsl(148, 18%, 96%)',
                        },
                      ]}
                    >
                      <Home size={11} color={mutedColor} strokeWidth={2.2} />
                      <Text
                        style={{
                          flex: 1,
                          fontSize: 12,
                          fontFamily: 'Poppins-Medium',
                          color: textColor,
                          textAlign: textAlignStart(isRTL),
                        }}
                        numberOfLines={1}
                      >
                        {h.name}
                      </Text>
                      <Text
                        style={{
                          fontSize: 12,
                          fontFamily: 'Poppins-Regular',
                          color: mutedColor,
                        }}
                      >
                        {fmtInt(h.initial)}
                      </Text>
                      {h.houseDeaths > 0 ? (
                        <Text
                          style={{
                            fontSize: 12,
                            fontFamily: 'Poppins-SemiBold',
                            color: mortalityToneColor(h.housePct, tokens),
                          }}
                        >
                          {`(-${fmtInt(h.houseDeaths)})`}
                        </Text>
                      ) : null}
                      <Text
                        style={{
                          width: 50,
                          fontSize: 11,
                          fontFamily: 'Poppins-SemiBold',
                          color: mortalityToneColor(h.housePct, tokens),
                          textAlign: 'right',
                        }}
                      >
                        {`${h.housePct.toFixed(2)}%`}
                      </Text>
                    </View>
                  ))}
              </View>
            </>
          ) : null}
        </BatchKpiCard>

        <BatchKpiCard
          title={t('batches.feedMix', 'Feed')}
          icon={Wheat}
          onPress={() => onJumpTab?.('feedOrders')}
          headline={`${fmtInt(totalFeedKg)}`}
          subline={totalFeedBags > 0
            ? `kg  ·  ${fmtInt(totalFeedBags)} ${t('batches.bags', 'bags')}`
            : 'kg'}
        >
          {totalFeedKg === 0 ? (
            <Text
              style={{
                fontSize: 13,
                fontFamily: 'Poppins-Regular',
                color: mutedColor,
                textAlign: 'center',
                paddingVertical: 12,
              }}
            >
              {t('batches.operations.noEntries', 'No entries yet')}
            </Text>
          ) : (
            <View style={{ gap: 10, marginTop: 4 }}>
              {[...FEED_TYPES_DISPLAYED, ...(otherFeed.totalKg > 0 ? ['OTHER'] : [])]
                .sort((a, b) => (FEED_TYPE_ORDER[a] ?? 99) - (FEED_TYPE_ORDER[b] ?? 99))
                .map((type) => {
                  const kg = type === 'OTHER' ? otherFeed.totalKg : (feedByType[type]?.totalKg || 0);
                  const bags = type === 'OTHER' ? otherFeed.totalBags : (feedByType[type]?.totalBags || 0);
                  const widthPct = totalFeedKg > 0 ? (kg / totalFeedKg) * 100 : 0;
                  return (
                    <View key={type}>
                      <View
                        style={[
                          styles.barLabelRow,
                          { flexDirection: rowDirection(isRTL) },
                        ]}
                      >
                        <Text
                          style={{
                            flex: 1,
                            fontSize: 12,
                            fontFamily: 'Poppins-Medium',
                            color: textColor,
                            textAlign: textAlignStart(isRTL),
                          }}
                        >
                          {t(`feed.feedTypes.${type}`, type)}
                        </Text>
                        <Text
                          style={{
                            fontSize: 12,
                            fontFamily: 'Poppins-Regular',
                            color: mutedColor,
                          }}
                        >
                          {fmtInt(kg)}
                          <Text style={{ fontSize: 11 }}> kg</Text>
                          {bags > 0 ? (
                            <Text style={{ fontSize: 11, color: mutedColor }}>
                              {`  (${fmtInt(bags)})`}
                            </Text>
                          ) : null}
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.barTrack,
                          {
                            backgroundColor: dark
                              ? 'rgba(255,255,255,0.06)'
                              : 'rgba(0,0,0,0.05)',
                          },
                        ]}
                      >
                        <View
                          style={[
                            styles.barFill,
                            { backgroundColor: accentColor, width: `${widthPct}%` },
                          ]}
                        />
                      </View>
                    </View>
                  );
                })}
            </View>
          )}
        </BatchKpiCard>

        <BatchKpiCard
          title={t('batches.expenseBreakdown', 'Expenses by category')}
          icon={Receipt}
          onPress={() => onJumpTab?.('expenses')}
          headline={fmt(totalExpenses)}
        >
          {expenseBreakdown.length === 0 ? (
            <Text
              style={{
                fontSize: 13,
                fontFamily: 'Poppins-Regular',
                color: mutedColor,
                textAlign: 'center',
                paddingVertical: 12,
              }}
            >
              {t('batches.operations.noEntries', 'No entries yet')}
            </Text>
          ) : (
            <View style={{ gap: 10, marginTop: 4 }}>
              {expenseBreakdown.map(([category, amount]) => {
                const widthPct = totalExpenses > 0 ? (amount / totalExpenses) * 100 : 0;
                return (
                  <View key={category}>
                    <View
                      style={[
                        styles.barLabelRow,
                        { flexDirection: rowDirection(isRTL) },
                      ]}
                    >
                      <Text
                        style={{
                          flex: 1,
                          fontSize: 12,
                          fontFamily: 'Poppins-Medium',
                          color: textColor,
                          textAlign: textAlignStart(isRTL),
                        }}
                        numberOfLines={1}
                      >
                        {t(`batches.expenseCategories.${category}`, category)}
                      </Text>
                      <Text
                        style={{
                          fontSize: 12,
                          fontFamily: 'Poppins-Regular',
                          color: mutedColor,
                        }}
                      >
                        {fmt(amount)}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.barTrack,
                        {
                          backgroundColor: dark
                            ? 'rgba(255,255,255,0.06)'
                            : 'rgba(0,0,0,0.05)',
                        },
                      ]}
                    >
                      <View
                        style={[
                          styles.barFill,
                          { backgroundColor: accentColor, width: `${widthPct}%` },
                        ]}
                      />
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </BatchKpiCard>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  survivalTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    marginTop: 12,
  },
  survivalFill: {
    height: '100%',
    borderRadius: 3,
  },
  houseRow: {
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
  },
  barLabelRow: {
    alignItems: 'center',
    marginBottom: 6,
  },
  barTrack: {
    height: 5,
    borderRadius: 3,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 3,
  },
});
