import { useMemo, useState } from 'react';
import {
  View, Text, ScrollView, Pressable, RefreshControl, StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import {
  Bird, Layers, Skull, Calendar, History,
  DollarSign, TrendingUp, Receipt, Activity, MapPin,
  Egg, ShoppingCart,
} from 'lucide-react-native';
import { useHeroSheetTokens } from '@/components/HeroSheetScreen';
import { useIsRTL } from '@/stores/localeStore';
import useSettings from '@/hooks/useSettings';
import { deltaSync } from '@/lib/syncEngine';
import SheetSection from '@/components/SheetSection';
import LocationActions from '@/components/LocationActions';
import SlidingSegmentedControl from '@/components/SlidingSegmentedControl';
import BatchAvatar from '@/modules/broiler/components/BatchAvatar';
import { getStatusConfig } from '@/modules/broiler/lib/batchStatusConfig';
import { rowDirection, textAlignStart, textAlignEnd } from '@/lib/rtl';
import BatchKpiCard, {
  profitToneColor, mortalityToneColor,
} from '@/modules/broiler/components/BatchKpiCard';

const NUMERIC_LOCALE = 'en-US';
const CYCLE_TARGET_DAYS = 35;
const PAST_CYCLES_LIMIT = 5;
const SCOPES = ['active', 'allTime', 'thisYear'];

const fmt = (val) =>
  Number(val || 0).toLocaleString(NUMERIC_LOCALE, {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  });

const fmtInt = (val) => Number(val || 0).toLocaleString(NUMERIC_LOCALE);

// Same compact recipes as the dashboard's BroilerKpiHero so flock
// counts and financial chips render identically across the two screens.
function trimFixedMantissa(s) {
  if (!s.includes('.')) return s;
  return s.replace(/\.?0+$/, '');
}

const fmtCompact = (val) => {
  const n = Number(val || 0);
  if (!Number.isFinite(n) || n === 0) return '0';
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  if (abs >= 1_000_000) {
    const m = abs / 1_000_000;
    return `${sign}${trimFixedMantissa(m.toFixed(3))}M`;
  }
  if (abs >= 1_000) {
    const k = Math.floor(abs / 1_000);
    return `${sign}${k.toLocaleString(NUMERIC_LOCALE)}K`;
  }
  return `${sign}${fmtInt(abs)}`;
};

const fmtCompactCurrency = (val) => {
  const n = Number(val || 0);
  if (!Number.isFinite(n)) return fmt(0);
  if (n === 0) return fmt(0);
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  if (abs >= 1_000_000) {
    const m = abs / 1_000_000;
    return `${sign}${trimFixedMantissa(m.toFixed(3))}M`;
  }
  if (abs >= 1_000) {
    const k = Math.floor(abs / 1_000);
    return `${sign}${k.toLocaleString(NUMERIC_LOCALE)}K`;
  }
  return fmt(n);
};

function fmtMortalityDeathsForDisplay(deaths) {
  const n = Math.floor(Number(deaths || 0));
  if (n <= 10_000) return fmtInt(n);
  return `${trimFixedMantissa((n / 1000).toFixed(1))}K`;
}

function fmtFlockMortalityCountAndPct(deaths, mortalityPct) {
  const d = Number(deaths || 0);
  const pct = Number(mortalityPct || 0);
  const pctStr = `${pct.toFixed(2)}%`;
  if (d > 0) return `(-${fmtMortalityDeathsForDisplay(d)}) · ${pctStr}`;
  return pctStr;
}

const fmtDate = (d) => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString(NUMERIC_LOCALE, {
    day: '2-digit', month: 'short', year: 'numeric',
  });
};

const IN_PROGRESS_STATUS = getStatusConfig('IN_PROGRESS');

export default function FarmOverviewTab({
  farm,
  houses,
  farmBatches,
  allDailyLogs,
  allSaleOrders,
  allExpenses,
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const isRTL = useIsRTL();
  const tokens = useHeroSheetTokens();
  const {
    accentColor, dark, mutedColor, screenBg, textColor,
  } = tokens;

  const hasFarmLocation =
    (farm.location?.lat != null && farm.location?.lng != null)
    || !!farm.location?.placeName;

  const accounting = useSettings('accounting');
  const currency = accounting?.currency || 'AED';

  const [scope, setScope] = useState('active');
  const [refreshing, setRefreshing] = useState(false);

  const yearStart = useMemo(() => {
    const d = new Date();
    d.setMonth(0, 1);
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

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

  const activeBatches = useMemo(
    () => farmBatches.filter((b) => b.status === 'IN_PROGRESS'),
    [farmBatches]
  );

  const completedBatches = useMemo(
    () => farmBatches
      .filter((b) => b.status === 'COMPLETE')
      .sort((a, b) => new Date(b.startDate || 0) - new Date(a.startDate || 0)),
    [farmBatches]
  );

  const flockStats = useMemo(() => {
    let initial = 0;
    let deaths = 0;
    let sold = 0;
    scopedBatches.forEach((b) => {
      (b.houses || []).forEach((h) => { initial += h.quantity || 0; });
    });
    allDailyLogs.forEach((log) => {
      if (log.deletedAt || log.logType !== 'DAILY' || log.deaths == null) return;
      const batchId = typeof log.batch === 'object' ? log.batch?._id : log.batch;
      if (scopedBatchIds.has(batchId)) deaths += log.deaths || 0;
    });
    // Birds that have left the farm via sales — same recipe as
    // useBroilerDashboardStats so the Flock card here reads identically
    // to the dashboard one (slaughtered + live).
    allSaleOrders.forEach((s) => {
      if (s.deletedAt) return;
      const batchId = typeof s.batch === 'object' ? s.batch?._id : s.batch;
      if (!scopedBatchIds.has(batchId)) return;
      sold += (s.counts?.chickensSent || 0) + (s.live?.birdCount || 0);
    });
    const liveBirds = Math.max(0, initial - deaths - sold);
    const mortalityPct = initial > 0 ? (deaths / initial) * 100 : 0;
    return {
      initial, deaths, sold, liveBirds, mortalityPct,
      cycleCount: scopedBatches.length,
    };
  }, [scopedBatches, scopedBatchIds, allDailyLogs, allSaleOrders]);

  const financials = useMemo(() => {
    const totalRevenue = allSaleOrders.reduce((s, o) => {
      const batchId = typeof o.batch === 'object' ? o.batch?._id : o.batch;
      if (!scopedBatchIds.has(batchId)) return s;
      return s + (o.totals?.grandTotal || 0);
    }, 0);
    const totalExpenses = allExpenses.reduce((s, e) => {
      const batchId = typeof e.batch === 'object' ? e.batch?._id : e.batch;
      if (!scopedBatchIds.has(batchId)) return s;
      return s + (e.totalAmount || 0);
    }, 0);
    const netProfit = totalRevenue - totalExpenses;
    const marginPct = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : null;
    const profitDenom = scope === 'active' ? flockStats.liveBirds : flockStats.initial;
    const profitPerBird = profitDenom > 0 ? netProfit / profitDenom : null;
    return { totalRevenue, totalExpenses, netProfit, marginPct, profitPerBird };
  }, [allSaleOrders, allExpenses, scopedBatchIds, scope, flockStats]);

  const activeBatchCards = useMemo(() => {
    const deathsByBatch = {};
    const activeIds = new Set(activeBatches.map((b) => b._id));
    allDailyLogs.forEach((log) => {
      if (log.deletedAt || log.logType !== 'DAILY') return;
      const batchId = typeof log.batch === 'object' ? log.batch?._id : log.batch;
      if (!activeIds.has(batchId)) return;
      if (log.deaths) deathsByBatch[batchId] = (deathsByBatch[batchId] || 0) + log.deaths;
    });
    return activeBatches
      .map((b) => {
        const initial = (b.houses || []).reduce((s, h) => s + (h.quantity || 0), 0);
        const deaths = deathsByBatch[b._id] || 0;
        const remaining = Math.max(0, initial - deaths);
        const mortalityPct = initial > 0 ? (deaths / initial) * 100 : 0;
        const dayCount = b.startDate
          ? Math.max(0, Math.floor((Date.now() - new Date(b.startDate)) / 86400000))
          : 0;
        const cycleProgressPct = Math.min(100, (dayCount / CYCLE_TARGET_DAYS) * 100);
        const avatarLetter = (
          farm?.nickname || farm?.farmName || b.batchName || '?'
        )[0].toUpperCase();
        const batchNum = b.sequenceNumber ?? '';
        return {
          _id: b._id, batchName: b.batchName, avatarLetter, batchNum,
          dayCount, cycleProgressPct, initial, remaining, deaths, mortalityPct,
        };
      })
      .sort((a, b) => b.mortalityPct - a.mortalityPct);
  }, [activeBatches, allDailyLogs, farm]);

  const pastCycleRows = useMemo(() => completedBatches
    .slice(0, PAST_CYCLES_LIMIT)
    .map((b) => {
      const initial = (b.houses || []).reduce((s, h) => s + (h.quantity || 0), 0);
      let deaths = 0;
      let revenue = 0;
      const start = b.startDate ? new Date(b.startDate) : null;
      let lastSaleDate = null;
      allDailyLogs.forEach((log) => {
        if (log.deletedAt || log.logType !== 'DAILY' || log.deaths == null) return;
        const batchId = typeof log.batch === 'object' ? log.batch?._id : log.batch;
        if (batchId === b._id) deaths += log.deaths || 0;
      });
      allSaleOrders.forEach((s) => {
        const batchId = typeof s.batch === 'object' ? s.batch?._id : s.batch;
        if (batchId !== b._id) return;
        revenue += s.totals?.grandTotal || 0;
        if (s.saleDate) {
          const d = new Date(s.saleDate);
          if (!lastSaleDate || d > lastSaleDate) lastSaleDate = d;
        }
      });
      const end = lastSaleDate || start;
      const days = (start && end) ? Math.max(0, Math.floor((end - start) / 86400000)) : 0;
      const mortalityPct = initial > 0 ? (deaths / initial) * 100 : 0;
      return {
        _id: b._id, batchName: b.batchName, days, revenue, mortalityPct,
      };
    }), [completedBatches, allDailyLogs, allSaleOrders]);

  const flockHeadlineIsLive = scope === 'active';

  const profitColor = profitToneColor(financials.netProfit, tokens);
  const profitPerBirdColor = profitToneColor(financials.profitPerBird, tokens);
  const mortColor = mortalityToneColor(flockStats.mortalityPct, tokens);
  const finFmt = scope === 'active' ? fmt : fmtCompactCurrency;

  const scopeOptions = SCOPES.map((value) => ({
    value,
    label:
      value === 'active' ? t('dashboard.scopeActive', 'Active')
      : value === 'allTime' ? t('dashboard.scopeAllTime', 'All-time')
      : t('farms.scopeThisYear', 'This Year'),
  }));

  const onRefresh = async () => {
    setRefreshing(true);
    try { await deltaSync(); } catch (e) { console.error(e); }
    setRefreshing(false);
  };

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
        {/* Scope toggle — same SlidingSegmentedControl as the dashboard
            so the two screens read as one product. */}
        <View style={{ paddingHorizontal: 16, marginBottom: 12 }}>
          <SlidingSegmentedControl
            value={scope}
            onChange={setScope}
            options={scopeOptions}
            bordered
          />
        </View>

        {/* Flock card — exact dashboard recipe (BroilerKpiHero):
            headline + AVAILABLE / RAISED subscript suffix, scope-aware
            stats (Raised · Sold · Mortality on active; Sold · Cycles ·
            Mortality otherwise). The survival bar that used to live in
            the children slot is intentionally dropped — dashboard's
            Flock card doesn't have one and the user asked for the
            dashboard look. */}
        <BatchKpiCard
          title={t('dashboard.flockSummary', 'Flock')}
          icon={Bird}
          headline={
            flockHeadlineIsLive
              ? fmtInt(flockStats.liveBirds)
              : fmtInt(flockStats.initial)
          }
          headlineSuffix={
            flockHeadlineIsLive
              ? t('dashboard.flockHeadlineAvailableSuffix', 'AVAILABLE')
              : t('dashboard.flockHeadlineRaisedSuffix', 'RAISED')
          }
          headlineSuffixSubscript
          stats={
            flockHeadlineIsLive
              ? [
                  {
                    icon: Egg,
                    label: t('dashboard.flockMetricRaised', 'Raised'),
                    value: fmtCompact(flockStats.initial),
                  },
                  {
                    icon: ShoppingCart,
                    label: t('dashboard.flockMetricSold', 'Sold'),
                    value: fmtCompact(flockStats.sold),
                  },
                  {
                    icon: Skull,
                    label: t('dashboard.flockMetricMortality', 'Mortality'),
                    value: fmtFlockMortalityCountAndPct(
                      flockStats.deaths,
                      flockStats.mortalityPct,
                    ),
                    valueColor: mortColor,
                  },
                ]
              : [
                  {
                    icon: ShoppingCart,
                    label: t('dashboard.flockMetricSold', 'Sold'),
                    value: fmtCompact(flockStats.sold),
                  },
                  {
                    icon: Layers,
                    label: t('dashboard.flockMetricCycles', 'Cycles'),
                    value: fmtInt(flockStats.cycleCount),
                  },
                  {
                    icon: Skull,
                    label: t('dashboard.flockMetricMortality', 'Mortality'),
                    value: fmtFlockMortalityCountAndPct(
                      flockStats.deaths,
                      flockStats.mortalityPct,
                    ),
                    valueColor: mortColor,
                  },
                ]
          }
        />

        {/* Net Profit card — currency suffix subscript instead of prefix
            (dashboard recipe), and Revenue / Expenses use the compact
            currency formatter on All-time so the stat cells don't
            truncate on long horizons. */}
        <BatchKpiCard
          title={t('batches.netProfit', 'Net Profit')}
          icon={DollarSign}
          headlineSuffix={currency}
          headlineSuffixSubscript
          headline={fmt(financials.netProfit)}
          headlineColor={profitColor}
          subline={
            scope !== 'allTime' && financials.marginPct != null
              ? t('batches.margin', 'Margin {{pct}}%', { pct: financials.marginPct.toFixed(1) })
              : null
          }
          stats={[
            {
              icon: TrendingUp,
              label: t('batches.totalRevenue', 'Revenue'),
              value: finFmt(financials.totalRevenue),
            },
            {
              icon: Receipt,
              label: t('batches.expenses', 'Expenses'),
              value: finFmt(financials.totalExpenses),
            },
            {
              icon: Bird,
              label: t('batches.profitPerBird', 'PNL / Bird'),
              value: financials.profitPerBird != null ? fmt(financials.profitPerBird) : '—',
              valueColor: profitPerBirdColor,
            },
          ]}
        />

        {/* Active Batches — slim card recipe matching BroilerActiveBatches
            on the dashboard: header + day-of-cycle progress bar, no per-
            card stat row. Cards are separated by a 2pt rounded divider
            (the canonical inter-card separator used on the dashboard and
            on the Batches list grouping). */}
        {activeBatchCards.length > 0 ? (
          <SheetSection
            title={t('dashboard.activeBatchesTitle', 'Active Batches')}
            icon={Layers}
            padded={false}
          >
            <View style={cardStyles.activeList}>
              {activeBatchCards.map((b, idx) => (
                <View key={b._id}>
                  {idx > 0 ? (
                    <View
                      style={[
                        cardStyles.cardSeparator,
                        { backgroundColor: tokens.elevatedCardBorder },
                      ]}
                    />
                  ) : null}
                  <ActiveBatchCard
                    batch={b}
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

        {/* Past Cycles — kept as-is per design brief */}
        {pastCycleRows.length > 0 ? (
          <SheetSection
            title={t('farms.pastCycles', 'Past Cycles')}
            icon={History}
            padded={false}
          >
            <View style={{ padding: 8, gap: 8 }}>
              {pastCycleRows.map((c) => (
                <PastCycleRow
                  key={c._id}
                  cycle={c}
                  tokens={tokens}
                  isRTL={isRTL}
                  t={t}
                  onPress={() => router.push(`/(app)/batch/${c._id}`)}
                />
              ))}
            </View>
          </SheetSection>
        ) : null}

        {/* Empty fallback when there's nothing to show */}
        {activeBatchCards.length === 0 && pastCycleRows.length === 0 ? (
          <View
            style={{
              marginHorizontal: 16,
              marginBottom: 16,
              paddingVertical: 24,
              alignItems: 'center',
            }}
          >
            <View
              style={[
                styles.emptyTile,
                { backgroundColor: dark ? 'rgba(255,255,255,0.06)' : 'hsl(148, 18%, 94%)' },
              ]}
            >
              <Activity size={20} color={mutedColor} strokeWidth={2.2} />
            </View>
            <Text
              style={{
                fontSize: 13,
                fontFamily: 'Poppins-Medium',
                color: mutedColor,
                marginTop: 10,
                textAlign: 'center',
              }}
            >
              {t('farms.noActiveBatches', 'No active batches')}
            </Text>
          </View>
        ) : null}

        {/* Farm Location — moved to the very bottom. It's a static farm
            property, not a scope-filtered metric, and the user asked for
            it out of the way of the KPI / cycles content above. */}
        {hasFarmLocation ? (
          <SheetSection
            title={t('farms.locationSection', 'Farm Location')}
            icon={MapPin}
            padded={false}
          >
            {farm.location?.placeName ? (
              <View
                style={[
                  locationStyles.addressHeader,
                  { borderBottomColor: tokens.borderColor },
                ]}
              >
                <Text
                  style={{
                    fontSize: 14,
                    fontFamily: 'Poppins-Regular',
                    color: textColor,
                    lineHeight: 20,
                    textAlign: textAlignStart(isRTL),
                    writingDirection: isRTL ? 'rtl' : 'ltr',
                  }}
                >
                  {farm.location.placeName}
                </Text>
              </View>
            ) : null}
            <LocationActions
              name={farm.farmName}
              lat={farm.location?.lat}
              lng={farm.location?.lng}
              address={farm.location?.placeName}
            />
          </SheetSection>
        ) : null}

        <Text
          style={{
            fontSize: 11,
            fontFamily: 'Poppins-Regular',
            color: mutedColor,
            textAlign: 'center',
            marginTop: 4,
            marginHorizontal: 16,
          }}
        >
          {`${t('common.created', 'Created')}  ${fmtDate(farm.createdAt)}`}
        </Text>
      </ScrollView>
    </View>
  );
}

/**
 * Slim active-batch card — same recipe as the dashboard's
 * `BroilerActiveBatches.BatchCard`: avatar + title + bird-count meta,
 * then the DAY-of-cycle label and a thin progress bar. No per-card
 * stat row. Cards are visually separated by a 2pt rounded divider
 * owned by the parent list (see `cardStyles.cardSeparator`).
 */
function ActiveBatchCard({ batch, tokens, isRTL, t, onPress }) {
  const {
    mutedColor, textColor, accentColor, dark,
    elevatedCardBg, elevatedCardBorder, elevatedCardPressedBg,
  } = tokens;
  const mortalityColor = mortalityToneColor(batch.mortalityPct, tokens);

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
      {/* Header — avatar + title + (-deaths) · mortality% meta */}
      <View
        style={[
          cardStyles.headerRow,
          { flexDirection: rowDirection(isRTL) },
        ]}
      >
        <BatchAvatar
          letter={batch.avatarLetter}
          sequence={batch.batchNum}
          status={IN_PROGRESS_STATUS}
          size={40}
        />
        <View style={cardStyles.headerTextCol}>
          <Text
            style={{
              fontSize: 15,
              fontFamily: 'Poppins-SemiBold',
              color: textColor,
              letterSpacing: -0.1,
              textAlign: textAlignStart(isRTL),
            }}
            numberOfLines={1}
          >
            {batch.batchName}
          </Text>
          {batch.initial > 0 ? (
            <View
              style={[
                cardStyles.metaRow,
                { flexDirection: rowDirection(isRTL) },
              ]}
            >
              <View
                style={[
                  cardStyles.metaPiece,
                  { flexDirection: rowDirection(isRTL) },
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
                  {fmtInt(batch.remaining)}
                </Text>
                {batch.deaths > 0 ? (
                  <Text
                    style={{
                      fontSize: 12,
                      fontFamily: 'Poppins-SemiBold',
                      color: mortalityColor,
                    }}
                  >
                    {`(-${fmtInt(batch.deaths)})`}
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
                {`${batch.mortalityPct.toFixed(2)}%`}
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      {/* Day-of-cycle progress */}
      <View
        style={[
          cardStyles.progressLabelRow,
          { flexDirection: rowDirection(isRTL) },
        ]}
      >
        <View
          style={[
            cardStyles.progressLabelLeft,
            { flexDirection: rowDirection(isRTL) },
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
          >
            {t('dashboard.dayN', 'Day {{n}}', { n: batch.dayCount })}
          </Text>
        </View>
        <Text
          style={{
            fontSize: 11,
            fontFamily: 'Poppins-SemiBold',
            color: mutedColor,
          }}
        >
          {`${Math.round(batch.cycleProgressPct)}%`}
        </Text>
      </View>

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
            { backgroundColor: accentColor, width: `${batch.cycleProgressPct}%` },
          ]}
        />
      </View>
    </Pressable>
  );
}

function PastCycleRow({ cycle, tokens, isRTL, t, onPress }) {
  const {
    mutedColor, textColor, accentColor, dark,
    elevatedCardBg, elevatedCardBorder, elevatedCardPressedBg,
  } = tokens;
  const mortColor = mortalityToneColor(cycle.mortalityPct, tokens);
  return (
    <Pressable
      onPressIn={() => Haptics.selectionAsync().catch(() => {})}
      onPress={onPress}
      android_ripple={{
        color: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
        borderless: false,
      }}
      style={({ pressed }) => [
        cardStyles.pastRow,
        {
          backgroundColor: pressed ? elevatedCardPressedBg : elevatedCardBg,
          borderColor: pressed ? accentColor : elevatedCardBorder,
        },
      ]}
    >
      <View
        style={[
          cardStyles.pastRowInner,
          { flexDirection: rowDirection(isRTL) },
        ]}
      >
        <Text
          style={{
            flex: 1,
            minWidth: 0,
            fontSize: 13,
            fontFamily: 'Poppins-SemiBold',
            color: textColor,
            textAlign: textAlignStart(isRTL),
          }}
          numberOfLines={1}
        >
          {cycle.batchName}
        </Text>
        <Text
          style={{
            fontSize: 11,
            fontFamily: 'Poppins-Medium',
            color: mutedColor,
            letterSpacing: 0.4,
          }}
        >
          {t('farms.daysRun', '{{n}} days', { n: cycle.days })}
        </Text>
        <Text
          style={{
            fontSize: 12,
            fontFamily: 'Poppins-SemiBold',
            color: textColor,
          }}
        >
          {fmt(cycle.revenue)}
        </Text>
        <Text
          style={{
            width: 56,
            fontSize: 11,
            fontFamily: 'Poppins-SemiBold',
            color: mortColor,
            textAlign: textAlignEnd(isRTL),
          }}
        >
          {`${cycle.mortalityPct.toFixed(2)}%`}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  emptyTile: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

// Matches the address-header chrome on BusinessOverviewTab so the location
// section reads identically across the app.
const locationStyles = StyleSheet.create({
  addressHeader: {
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});

const cardStyles = StyleSheet.create({
  // Active-batches list — same chrome as the dashboard's
  // BroilerActiveBatches: 8pt edge padding, no gap (the cardSeparator
  // owns the inter-card breathing room so it sits centered).
  activeList: {
    padding: 8,
  },
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
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 8,
  },
  headerTextCol: {
    flex: 1,
    minWidth: 0,
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
  pastRow: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  pastRowInner: {
    alignItems: 'center',
    gap: 10,
  },
});
