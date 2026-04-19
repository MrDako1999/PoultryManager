import { useMemo } from 'react';
import {
  View, Text, StyleSheet,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  Wheat, ShoppingBag, DollarSign, Scale,
} from 'lucide-react-native';
import { useHeroSheetTokens } from '@/components/HeroSheetScreen';
import { useIsRTL } from '@/stores/localeStore';

const NUMERIC_LOCALE = 'en-US';

const fmt = (val) =>
  Number(val || 0).toLocaleString(NUMERIC_LOCALE, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const fmtInt = (val) => Number(val || 0).toLocaleString(NUMERIC_LOCALE);

const FEED_TYPE_ORDER = { STARTER: 0, GROWER: 1, FINISHER: 2, OTHER: 3 };
const FEED_TYPES_DISPLAYED = ['STARTER', 'GROWER', 'FINISHER'];

/**
 * FeedMixHeroCard — KPI card for Feed Orders. Renders the eyebrow
 * ("FEED"), total kg + bags headline, per-feed-type bar chart, and a
 * 3-cell stat row (Orders / Total Cost / Cost per KG).
 *
 * Lifted from FeedOrdersListView so the BatchFeedOrders orchestrator can
 * reuse the exact same hero while owning its own filter state. The
 * component is fully self-contained: it computes feedByType, displayed
 * types, and totals from the (pre-filtered) `feedOrders` it receives.
 *
 * `feedTypeFilter` is an optional array of feed types to spotlight. When
 * non-empty only matching types contribute to bars/totals/orderCount,
 * mirroring the legacy chip-filter behaviour.
 */
export default function FeedMixHeroCard({
  feedOrders = [],
  feedTypeFilter = [],
}) {
  const { t } = useTranslation();
  const isRTL = useIsRTL();
  const tokens = useHeroSheetTokens();
  const {
    accentColor, dark, mutedColor, textColor, borderColor,
    sectionBg, sectionBorder,
  } = tokens;

  const feedByType = useMemo(() => {
    const groups = {};
    feedOrders.forEach((order) => {
      (order.items || []).forEach((item) => {
        const type = item.feedType || 'OTHER';
        if (feedTypeFilter.length > 0 && !feedTypeFilter.includes(type)) return;
        const bags = item.bags || 0;
        const itemKg = bags * (item.quantitySize || 50);
        if (!groups[type]) groups[type] = { totalKg: 0, totalBags: 0, totalCost: 0 };
        groups[type].totalKg += itemKg;
        groups[type].totalBags += bags;
        groups[type].totalCost += bags * (item.pricePerBag || 0);
      });
    });
    return groups;
  }, [feedOrders, feedTypeFilter]);

  const otherFeed = useMemo(() => Object.entries(feedByType)
    .filter(([type]) => !FEED_TYPES_DISPLAYED.includes(type))
    .reduce(
      (acc, [, g]) => ({
        totalKg: acc.totalKg + g.totalKg,
        totalBags: acc.totalBags + g.totalBags,
        totalCost: acc.totalCost + g.totalCost,
      }),
      { totalKg: 0, totalBags: 0, totalCost: 0 }
    ),
  [feedByType]);

  const displayedTypes = useMemo(() => {
    const candidates = [
      ...FEED_TYPES_DISPLAYED.filter((type) => (feedByType[type]?.totalKg || 0) > 0),
      ...(otherFeed.totalKg > 0 ? ['OTHER'] : []),
    ];
    candidates.sort((a, b) => (FEED_TYPE_ORDER[a] ?? 99) - (FEED_TYPE_ORDER[b] ?? 99));
    return candidates;
  }, [feedByType, otherFeed.totalKg]);

  const getTypeStats = (type) => (
    type === 'OTHER'
      ? otherFeed
      : (feedByType[type] || { totalKg: 0, totalBags: 0, totalCost: 0 })
  );

  const displayedTotals = useMemo(() => displayedTypes.reduce(
    (acc, type) => {
      const g = getTypeStats(type);
      acc.totalKg += g.totalKg;
      acc.totalBags += g.totalBags;
      acc.totalCost += g.totalCost;
      return acc;
    },
    { totalKg: 0, totalBags: 0, totalCost: 0 }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [displayedTypes, feedByType, otherFeed]);

  const totalKgInScope = displayedTotals.totalKg;

  const displayedOrderCount = useMemo(() => {
    if (feedTypeFilter.length === 0) return feedOrders.length;
    const ids = new Set();
    feedOrders.forEach((order) => {
      const has = (order.items || []).some(
        (it) => feedTypeFilter.includes(it.feedType || 'OTHER')
      );
      if (has) ids.add(order._id);
    });
    return ids.size;
  }, [feedOrders, feedTypeFilter]);

  const costPerKg = displayedTotals.totalKg > 0
    ? displayedTotals.totalCost / displayedTotals.totalKg
    : null;

  return (
    <View style={styles.section}>
      <View
        style={[
          styles.eyebrow,
          { flexDirection: isRTL ? 'row-reverse' : 'row' },
        ]}
      >
        <Wheat size={13} color={mutedColor} strokeWidth={2.2} />
        <Text
          style={{
            fontSize: 11,
            lineHeight: 16,
            fontFamily: 'Poppins-SemiBold',
            color: mutedColor,
            letterSpacing: 1.2,
            textTransform: 'uppercase',
          }}
        >
          {t('batches.feedMix', 'Feed')}
        </Text>
      </View>
      <View
        style={[
          styles.kpiCard,
          {
            backgroundColor: sectionBg,
            borderColor: sectionBorder,
            borderWidth: 1,
            ...(dark
              ? {}
              : {
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.04,
                  shadowRadius: 8,
                  elevation: 1,
                }),
          },
        ]}
      >
        <View
          style={[
            styles.kpiHeaderRow,
            { flexDirection: isRTL ? 'row-reverse' : 'row' },
          ]}
        >
          <Text
            style={{
              flex: 1,
              fontSize: 28,
              fontFamily: 'Poppins-Bold',
              color: textColor,
              letterSpacing: -0.4,
              lineHeight: 34,
              textAlign: isRTL ? 'right' : 'left',
            }}
            numberOfLines={1}
          >
            {fmtInt(displayedTotals.totalKg)}
            <Text style={{ fontSize: 18, fontFamily: 'Poppins-SemiBold', color: mutedColor }}>
              {' kg'}
            </Text>
          </Text>
        </View>
        {displayedTotals.totalBags > 0 ? (
          <Text
            style={{
              fontSize: 12,
              fontFamily: 'Poppins-Medium',
              color: mutedColor,
              marginTop: 2,
              textAlign: isRTL ? 'right' : 'left',
            }}
          >
            {`${fmtInt(displayedTotals.totalBags)} ${t('batches.bags', 'bags')}`}
          </Text>
        ) : null}

        {displayedTotals.totalKg === 0 ? (
          <Text
            style={{
              fontSize: 13,
              fontFamily: 'Poppins-Regular',
              color: mutedColor,
              textAlign: 'center',
              paddingVertical: 12,
            }}
          >
            {t('batches.noFeedOrders', 'No feed orders')}
          </Text>
        ) : (
          <View style={{ gap: 10, marginTop: 14 }}>
            {displayedTypes.map((type) => {
              const stats = getTypeStats(type);
              const kg = stats.totalKg;
              const bags = stats.totalBags;
              const widthPct = totalKgInScope > 0 ? (kg / totalKgInScope) * 100 : 0;
              return (
                <View key={type}>
                  <View
                    style={[
                      styles.barLabelRow,
                      { flexDirection: isRTL ? 'row-reverse' : 'row' },
                    ]}
                  >
                    <Text
                      style={{
                        flex: 1,
                        fontSize: 12,
                        fontFamily: 'Poppins-Medium',
                        color: textColor,
                        textAlign: isRTL ? 'right' : 'left',
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
                        <Text style={{ fontSize: 11 }}>
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

        <View
          style={[
            styles.statsRow,
            {
              flexDirection: isRTL ? 'row-reverse' : 'row',
              borderTopColor: borderColor,
            },
          ]}
        >
          <FeedStat
            icon={ShoppingBag}
            label={t('batches.orders', 'Orders')}
            value={fmtInt(displayedOrderCount)}
            isRTL={isRTL}
            tokens={tokens}
          />
          <View style={[styles.statDivider, { backgroundColor: borderColor }]} />
          <FeedStat
            icon={DollarSign}
            label={t('batches.totalCost', 'Total Cost')}
            value={fmt(displayedTotals.totalCost)}
            isRTL={isRTL}
            tokens={tokens}
          />
          <View style={[styles.statDivider, { backgroundColor: borderColor }]} />
          <FeedStat
            icon={Scale}
            label={t('batches.costPerKg', 'Cost / KG')}
            value={costPerKg != null ? fmt(costPerKg) : '—'}
            isRTL={isRTL}
            tokens={tokens}
          />
        </View>
      </View>
    </View>
  );
}

function FeedStat({ icon: Icon, label, value, isRTL, tokens }) {
  const { mutedColor, textColor } = tokens;
  return (
    <View style={statStyles.cell}>
      <View
        style={[
          statStyles.labelRow,
          { flexDirection: isRTL ? 'row-reverse' : 'row' },
        ]}
      >
        {Icon ? <Icon size={11} color={mutedColor} strokeWidth={2.4} /> : null}
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
          color: textColor,
          textAlign: isRTL ? 'right' : 'left',
        }}
        numberOfLines={1}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
  eyebrow: {
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
    marginStart: 6,
  },
  kpiCard: {
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 18,
    overflow: 'hidden',
  },
  kpiHeaderRow: {
    alignItems: 'center',
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
  statsRow: {
    paddingTop: 14,
    paddingBottom: 2,
    borderTopWidth: 1,
    marginTop: 14,
  },
  statDivider: {
    width: 1,
    alignSelf: 'stretch',
    marginHorizontal: 8,
  },
});

const statStyles = StyleSheet.create({
  cell: {
    flex: 1,
    minWidth: 0,
    alignItems: 'flex-start',
  },
  labelRow: {
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
});
