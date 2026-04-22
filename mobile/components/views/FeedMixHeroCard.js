import { useMemo } from 'react';
import {
  View, Text, StyleSheet,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  Wheat, ShoppingBag, Scale,
} from 'lucide-react-native';
import { useHeroSheetTokens } from '@/components/HeroSheetScreen';
import { useIsRTL } from '@/stores/localeStore';
import useSettings from '@/hooks/useSettings';
import BatchKpiCard from '@/modules/broiler/components/BatchKpiCard';
import { rowDirection, textAlignStart } from '@/lib/rtl';

const NUMERIC_LOCALE = 'en-US';

const fmt = (val) =>
  Number(val || 0).toLocaleString(NUMERIC_LOCALE, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const fmtInt = (val) => Number(val || 0).toLocaleString(NUMERIC_LOCALE);

const FEED_TYPE_ORDER = { STARTER: 0, GROWER: 1, FINISHER: 2, OTHER: 3 };
const FEED_TYPES_DISPLAYED = ['STARTER', 'GROWER', 'FINISHER'];

// Per-item cost INCLUDING VAT. Newer orders persist `lineTotal`
// (subtotal + vatAmount); older items may only have `pricePerBag`/`bags`,
// so we fall back to subtotal × (1 + vatRate). Delivery sits at the order
// level and is intentionally excluded from per-feed-type aggregations —
// it's prorated across types in the eyebrow total instead.
const itemCostWithVat = (item, vatRate) => {
  if (item?.lineTotal) return item.lineTotal;
  if (item?.subtotal != null && item?.vatAmount != null) {
    return (item.subtotal || 0) + (item.vatAmount || 0);
  }
  const sub = (item?.bags || 0) * (item?.pricePerBag || 0);
  return sub * (1 + (vatRate || 0) / 100);
};

/**
 * FeedMixHeroCard — KPI card for Feed Orders.
 *
 * Wraps `BatchKpiCard` (the canonical KPI primitive used by the dashboard
 * and Batch Detail tabs) so the eyebrow, headline + subscript suffix,
 * stat row, and surface treatment all match the rest of the app. The
 * per-feed-type bar chart lives in the `children` slot.
 */
export default function FeedMixHeroCard({
  feedOrders = [],
  feedTypeFilter = [],
}) {
  const { t } = useTranslation();
  const isRTL = useIsRTL();
  const tokens = useHeroSheetTokens();
  const {
    accentColor, dark, mutedColor, textColor,
  } = tokens;
  const accounting = useSettings('accounting');
  const vatRate = accounting?.vatRate ?? 5;

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
        groups[type].totalCost += itemCostWithVat(item, vatRate);
      });
    });
    return groups;
  }, [feedOrders, feedTypeFilter, vatRate]);

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

  const hasFeed = displayedTotals.totalKg > 0;

  // Per-feed-type bars rendered inside BatchKpiCard's `children` slot.
  // Empty state mirrors the rest of the app's "no entries yet" copy and
  // sits in the same card chrome so the surface stays consistent.
  const bars = hasFeed ? (
    <View style={{ gap: 10 }}>
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
  ) : (
    <Text
      style={{
        fontSize: 13,
        fontFamily: 'Poppins-Regular',
        color: mutedColor,
        textAlign: 'center',
        paddingVertical: 4,
      }}
    >
      {t('batches.noFeedOrders', 'No feed orders')}
    </Text>
  );

  return (
    <BatchKpiCard
      title={t('batches.feedMix', 'Feed')}
      icon={Wheat}
      headline={fmtInt(displayedTotals.totalKg)}
      headlineSuffix="kg"
      headlineSuffixSubscript
      stats={[
        {
          icon: ShoppingBag,
          label: t('batches.orders', 'Orders'),
          value: fmtInt(displayedOrderCount),
        },
        {
          label: t('batches.totalCost', 'Total Cost'),
          value: fmt(displayedTotals.totalCost),
        },
        {
          icon: Scale,
          label: t('batches.costPerKg', 'Cost / KG'),
          value: costPerKg != null ? fmt(costPerKg) : '—',
        },
      ]}
    >
      {bars}
    </BatchKpiCard>
  );
}

const styles = StyleSheet.create({
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
