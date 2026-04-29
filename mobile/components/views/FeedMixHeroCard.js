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
import FeedProgressBar from '@/components/FeedProgressBar';
import BatchKpiCard from '@/modules/broiler/components/BatchKpiCard';
import {
  aggregateOrderedByType,
  allocateConsumedByType,
  computeFeedInventory,
} from '@/modules/broiler/lib/feedInventory';
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
 * Wraps `BatchKpiCard` so it sits in the same surface chrome as every
 * other KPI tile in the app. Two-layer scope: the **stats** (orders
 * count, total cost, cost/kg) reflect the user's current filters
 * (date range, company, search, feed type), while the **per-type
 * bars** show batch-wide consumption progress — the same
 * `FeedProgressBar` primitive the Batch Overview / Performance Feed
 * card uses, so the visual grammar stays unified across every
 * feed-related surface in the app.
 *
 * The bars stay anchored to full-batch ordered + consumed totals so a
 * date filter (or company filter) doesn't make the consumption fill
 * look like it's running away from a shrunken envelope. When the
 * user filters by feed type, only the matching phase rows render but
 * each row's consumed/ordered numbers still come from the full batch.
 *
 * @param {object} props
 * @param {Array} props.feedOrders - filtered orders, used for stats.
 * @param {Array} [props.allFeedOrders] - unfiltered orders, used for the bars.
 *   Falls back to `feedOrders` when omitted (e.g. legacy callers).
 * @param {Array} [props.dailyLogs] - batch's daily logs; powers the consumption fill.
 * @param {string[]} [props.feedTypeFilter=[]]
 */
export default function FeedMixHeroCard({
  feedOrders = [],
  allFeedOrders,
  dailyLogs,
  feedTypeFilter = [],
}) {
  const { t } = useTranslation();
  const isRTL = useIsRTL();
  const tokens = useHeroSheetTokens();
  const {
    mutedColor, textColor,
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

  // Bars: anchored to the unfiltered batch view so consumption never
  // runs away from a shrunken filtered envelope. Fall back to the
  // filtered list when the unfiltered one isn't supplied so legacy
  // callers (and any consumer that doesn't have a batch context)
  // still get a sensible bar.
  const orderedByTypeFull = useMemo(
    () => aggregateOrderedByType(allFeedOrders ?? feedOrders),
    [allFeedOrders, feedOrders]
  );
  const consumedKg = useMemo(
    () => (dailyLogs
      ? computeFeedInventory({ feedOrders: allFeedOrders ?? feedOrders, dailyLogs }).consumedKg
      : 0),
    [allFeedOrders, feedOrders, dailyLogs]
  );
  const consumedByType = useMemo(
    () => allocateConsumedByType({ orderedByType: orderedByTypeFull, consumedKg }),
    [orderedByTypeFull, consumedKg]
  );

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

  // Per-feed-type bars rendered inside BatchKpiCard's `children`
  // slot. Each row uses the shared FeedProgressBar so the visual is
  // identical to the Batch Overview / Performance Feed card.
  const bars = hasFeed ? (
    <View style={{ gap: 6, marginTop: 2 }}>
      {displayedTypes.map((type) => {
        // Bar geometry uses full-batch ordered + consumed allocation
        // (`orderedByTypeFull` / `consumedByType`) so the user sees
        // accurate phase progress regardless of which filters they've
        // applied above. The right-side label still shows the
        // FILTERED ordered amount so the row's numbers tie back to
        // the cost/orders stats up top.
        const orderedFiltered = getTypeStats(type).totalKg;
        const orderedFull = orderedByTypeFull[type]?.totalKg || 0;
        const consumed = consumedByType[type] || 0;
        return (
          <View
            key={type}
            style={[
              styles.phaseRow,
              { flexDirection: rowDirection(isRTL) },
            ]}
          >
            <Text
              style={{
                width: 64,
                fontSize: 11,
                fontFamily: 'Poppins-SemiBold',
                color: textColor,
                letterSpacing: 0.4,
                textTransform: 'uppercase',
                textAlign: textAlignStart(isRTL),
              }}
              numberOfLines={1}
            >
              {t(`feed.feedTypes.${type}`, type)}
            </Text>
            <View style={styles.barWrap}>
              <FeedProgressBar consumedKg={consumed} orderedKg={orderedFull} />
            </View>
            <Text
              style={{
                minWidth: 90,
                fontSize: 10,
                fontFamily: 'Poppins-Medium',
                color: mutedColor,
                textAlign: 'right',
              }}
              numberOfLines={1}
            >
              {`${fmtInt(consumed)}/${fmtInt(orderedFiltered)} kg`}
            </Text>
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
  phaseRow: {
    alignItems: 'center',
    gap: 8,
  },
  barWrap: {
    flex: 1,
    minWidth: 0,
  },
});
