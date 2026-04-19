import { useMemo, useState } from 'react';
import {
  View, Text, ScrollView, Pressable, RefreshControl, StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import {
  Bird, Layers, Skull, Wheat, Calendar, Home, History,
  DollarSign, TrendingUp, Receipt, Activity, MapPin,
} from 'lucide-react-native';
import { useHeroSheetTokens } from '@/components/HeroSheetScreen';
import { useIsRTL } from '@/stores/localeStore';
import useSettings from '@/hooks/useSettings';
import { deltaSync } from '@/lib/syncEngine';
import SheetSection from '@/components/SheetSection';
import LocationActions from '@/components/LocationActions';
import FilterChips from '@/components/views/FilterChips';
import BatchAvatar from '@/modules/broiler/components/BatchAvatar';
import { getStatusConfig } from '@/modules/broiler/lib/batchStatusConfig';
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

const fmtCompactKg = (val) => {
  const n = Number(val || 0);
  if (n >= 1000) {
    return `${(n / 1000).toLocaleString(NUMERIC_LOCALE, {
      minimumFractionDigits: 1, maximumFractionDigits: 1,
    })}t`;
  }
  return `${fmtInt(n)} kg`;
};

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
    scopedBatches.forEach((b) => {
      (b.houses || []).forEach((h) => { initial += h.quantity || 0; });
    });
    allDailyLogs.forEach((log) => {
      if (log.deletedAt || log.logType !== 'DAILY' || log.deaths == null) return;
      const batchId = typeof log.batch === 'object' ? log.batch?._id : log.batch;
      if (scopedBatchIds.has(batchId)) deaths += log.deaths || 0;
    });
    const liveBirds = Math.max(0, initial - deaths);
    const mortalityPct = initial > 0 ? (deaths / initial) * 100 : 0;
    const survivalPct = initial > 0 ? (liveBirds / initial) * 100 : 0;
    return {
      initial, deaths, liveBirds, mortalityPct, survivalPct,
      cycleCount: scopedBatches.length,
    };
  }, [scopedBatches, scopedBatchIds, allDailyLogs]);

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
    const feedByBatch = {};
    const activeIds = new Set(activeBatches.map((b) => b._id));
    allDailyLogs.forEach((log) => {
      if (log.deletedAt || log.logType !== 'DAILY') return;
      const batchId = typeof log.batch === 'object' ? log.batch?._id : log.batch;
      if (!activeIds.has(batchId)) return;
      if (log.deaths) deathsByBatch[batchId] = (deathsByBatch[batchId] || 0) + log.deaths;
      if (log.feedKg) feedByBatch[batchId] = (feedByBatch[batchId] || 0) + log.feedKg;
    });
    return activeBatches
      .map((b) => {
        const initial = (b.houses || []).reduce((s, h) => s + (h.quantity || 0), 0);
        const deaths = deathsByBatch[b._id] || 0;
        const remaining = Math.max(0, initial - deaths);
        const mortalityPct = initial > 0 ? (deaths / initial) * 100 : 0;
        const feed = feedByBatch[b._id] || 0;
        const dayCount = b.startDate
          ? Math.max(0, Math.floor((Date.now() - new Date(b.startDate)) / 86400000))
          : 0;
        const cycleProgressPct = Math.min(100, (dayCount / CYCLE_TARGET_DAYS) * 100);
        const houseCount = (b.houses || []).length;
        const avatarLetter = (
          farm?.nickname || farm?.farmName || b.batchName || '?'
        )[0].toUpperCase();
        const batchNum = b.sequenceNumber ?? '';
        return {
          _id: b._id, batchName: b.batchName, avatarLetter, batchNum,
          dayCount, cycleProgressPct, initial, remaining, mortalityPct,
          feed, houseCount,
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
  const hasFlockData = flockStats.initial > 0;

  const profitColor = profitToneColor(financials.netProfit, tokens);
  const profitPerBirdColor = profitToneColor(financials.profitPerBird, tokens);
  const mortColor = mortalityToneColor(flockStats.mortalityPct, tokens);

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
        {/* Location — quick shortcuts to navigation apps + share. Pinned
            above the scope chips because the location is a property of
            the farm itself (not a scope-filtered metric). Uses the same
            `padded={false}` + LocationActions recipe as BusinessOverviewTab
            so the address card reads identically across the app: address
            text on top (when present), then a hairline-divided stack of
            full-width navigate / share rows. */}
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
                    textAlign: isRTL ? 'right' : 'left',
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

        {/* Scope filter chips — Active / All-time / This Year */}
        <View style={{ marginBottom: 16 }}>
          <FilterChips
            value={scope}
            onChange={setScope}
            options={scopeOptions.map((opt) => ({ ...opt, icon: Layers }))}
          />
        </View>

        {/* Net Profit card */}
        <BatchKpiCard
          title={t('batches.netProfit', 'Net Profit')}
          icon={DollarSign}
          headlinePrefix={currency}
          headline={fmt(financials.netProfit)}
          headlineColor={profitColor}
          subline={financials.marginPct != null
            ? t('batches.margin', 'Margin {{pct}}%', { pct: financials.marginPct.toFixed(1) })
            : null}
          stats={[
            {
              icon: TrendingUp,
              label: t('batches.totalRevenue', 'Revenue'),
              value: fmt(financials.totalRevenue),
            },
            {
              icon: Receipt,
              label: t('batches.expenses', 'Expenses'),
              value: fmt(financials.totalExpenses),
            },
            {
              icon: Bird,
              label: t('batches.profitPerBird', 'Profit / Bird'),
              value: financials.profitPerBird != null ? fmt(financials.profitPerBird) : '—',
              valueColor: profitPerBirdColor,
            },
          ]}
        />

        {/* Flock Summary card */}
        <BatchKpiCard
          title={t('dashboard.flockSummary', 'Flock')}
          icon={Bird}
          headline={flockHeadlineIsLive ? fmtInt(flockStats.liveBirds) : fmtInt(flockStats.initial)}
          subline={
            hasFlockData && flockHeadlineIsLive
              ? `${t('batches.ofPlaced', 'of {{count}} placed', { count: fmtInt(flockStats.initial) })}`
              : (hasFlockData ? t('farms.birdsRaised', 'birds raised') : null)
          }
          stats={[
            {
              icon: Layers,
              label: flockHeadlineIsLive
                ? t('dashboard.activeBatches', 'Active Batches')
                : t('farms.cyclesRun', 'Cycles Run'),
              value: fmtInt(flockStats.cycleCount),
            },
            {
              icon: Skull,
              label: t('dashboard.mortalityRate', 'Mortality'),
              value: `${flockStats.mortalityPct.toFixed(2)}%`,
              valueColor: mortColor,
            },
            {
              icon: Home,
              label: t('dashboard.totalHouses', 'Houses'),
              value: fmtInt(houses.length),
            },
          ]}
        >
          {hasFlockData ? (
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
                  { backgroundColor: accentColor, width: `${flockStats.survivalPct}%` },
                ]}
              />
            </View>
          ) : null}
        </BatchKpiCard>

        {/* Active Batches — elevated tappable cards inside a padded={false} section */}
        {activeBatchCards.length > 0 ? (
          <SheetSection
            title={t('dashboard.activeBatchesTitle', 'Active Batches')}
            icon={Layers}
            padded={false}
          >
            <View style={{ padding: 8, gap: 12 }}>
              {activeBatchCards.map((b) => (
                <ActiveBatchCard
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

        {/* Past Cycles — compact summary rows */}
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
 * Tappable elevated card representing a single active batch on this farm.
 * Layout in StyleSheet.create per §9; functional Pressable style is
 * reserved for press-state visual deltas (background, border, scale).
 */
function ActiveBatchCard({ batch, tokens, isRTL, t, onPress }) {
  const {
    mutedColor, textColor, accentColor, dark,
    elevatedCardBg, elevatedCardBorder, elevatedCardPressedBg,
  } = tokens;
  const mortColor = mortalityToneColor(batch.mortalityPct, tokens);

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
        <BatchAvatar
          letter={batch.avatarLetter}
          sequence={batch.batchNum}
          status={IN_PROGRESS_STATUS}
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
            {batch.batchName}
          </Text>
          {batch.initial > 0 ? (
            <View
              style={[
                cardStyles.metaRow,
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
                {fmtInt(batch.remaining)}
              </Text>
            </View>
          ) : null}
        </View>
      </View>

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
            {t('dashboard.dayOfTarget', 'Day {{day}} of {{target}}', {
              day: batch.dayCount, target: CYCLE_TARGET_DAYS,
            })}
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
          icon={Skull}
          label={t('dashboard.mortality', 'Mortality')}
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
          icon={Home}
          label={t('dashboard.totalHouses', 'Houses')}
          value={fmtInt(batch.houseCount)}
          tokens={tokens}
          isRTL={isRTL}
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
          { flexDirection: isRTL ? 'row-reverse' : 'row' },
        ]}
      >
        <Text
          style={{
            flex: 1,
            minWidth: 0,
            fontSize: 13,
            fontFamily: 'Poppins-SemiBold',
            color: textColor,
            textAlign: isRTL ? 'right' : 'left',
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
            textAlign: isRTL ? 'left' : 'right',
          }}
        >
          {`${cycle.mortalityPct.toFixed(2)}%`}
        </Text>
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
  card: {
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  headerRow: {
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  headerTextCol: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  metaRow: {
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
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
  statRow: {
    paddingTop: 12,
    marginTop: 12,
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
