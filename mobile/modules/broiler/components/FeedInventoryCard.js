import { useMemo } from 'react';
import {
  View, Text, Pressable, StyleSheet,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import {
  Wheat, Package, BarChart3,
} from 'lucide-react-native';
import { useHeroSheetTokens } from '@/components/HeroSheetScreen';
import { useIsRTL } from '@/stores/localeStore';
import useFeedDisplayStore from '@/stores/feedDisplayStore';
import { rowDirection, textAlignStart } from '@/lib/rtl';
import FeedProgressBar from '@/components/FeedProgressBar';
import BatchKpiCard, {
  feedStockToneColor,
} from '@/modules/broiler/components/BatchKpiCard';
import {
  computeFeedInventory,
  aggregateOrderedByType,
  allocateConsumedByType,
  deriveLiveWeightKg,
  computeFCR,
  computeConsumptionRatios,
  computeFeedTargets,
} from '@/modules/broiler/lib/feedInventory';

const NUMERIC_LOCALE = 'en-US';
const FEED_TYPES_DISPLAYED = ['STARTER', 'GROWER', 'FINISHER'];
const BAG_KG = 50;

const fmtInt = (val) => Number(val || 0).toLocaleString(NUMERIC_LOCALE);

const fmtBags = (val) =>
  Number(val || 0).toLocaleString(NUMERIC_LOCALE, { maximumFractionDigits: 1 });

const fmtRatio = (val, unit) => {
  if (val == null) return '\u2014';
  return `${val.toFixed(2)} ${unit}`;
};

// Phase-row right-side figure. Kept compact so each row stays one
// line: tonnes when any value crosses 1000 kg, bag counts when in
// bags mode. Falls back to the 2-up `consumed/ordered` shape when no
// target is known (e.g. before any birds are placed).
const trimTrailingZero = (numStr) => numStr.replace(/\.0$/, '');

const fmtPhaseFigureKg = (consumed, ordered, target) => {
  if (target > 0) {
    const max = Math.max(consumed, ordered, target);
    if (max >= 1000) {
      const f = (v) => trimTrailingZero((v / 1000).toFixed(1));
      return `${f(consumed)}/${f(ordered)}/${f(target)}t`;
    }
    return `${fmtInt(consumed)}/${fmtInt(ordered)}/${fmtInt(target)} kg`;
  }
  return `${fmtInt(consumed)}/${fmtInt(ordered)} kg`;
};

const fmtPhaseFigureBags = (consumedKg, orderedKg, targetKg) => {
  const c = consumedKg / BAG_KG;
  const o = orderedKg / BAG_KG;
  if (targetKg > 0) {
    const target = targetKg / BAG_KG;
    return `${fmtBags(c)}/${fmtBags(o)}/${fmtBags(target)} bags`;
  }
  return `${fmtBags(c)}/${fmtBags(o)} bags`;
};

/**
 * FeedInventoryCard — single source of truth for the unified Feed
 * KPI tile. Used on Batch Overview AND Batch Performance so the math
 * + presentation stay in lockstep, and ALSO mirrors the visual
 * grammar of FeedMixHeroCard on the Feed Orders tab (same
 * `FeedProgressBar` primitive in the body) so the user reads "feed"
 * the same way everywhere.
 *
 * Composition:
 *   1. Headline + subline = remaining inventory in the user's chosen
 *      unit (kg or bags), with the converse unit + days-left as the
 *      subline. The action-oriented "when do I reorder?" view.
 *   2. Inline kg/bags toggle — controls the headline + subline + bar
 *      figures. Choice is persisted across launches via
 *      `feedDisplayStore`.
 *   3. Per-phase bars (children) = consumed / ordered / target for
 *      each feed type. Consumption is allocated *sequentially* across
 *      STARTER → GROWER → FINISHER → OTHER (see
 *      `allocateConsumedByType`). Each row's bar shows three zones:
 *      solid = consumed, medium = ordered, palest = remaining target.
 *   4. Stat row = Feed/Bird, Bags Left, FCR. Stays in canonical
 *      units regardless of the toggle so the stat surface reads
 *      identically across surfaces.
 *
 * Banners surface only when the status warrants action: red for
 * critical (under 3 days runway), amber for over-consumption
 * (consumed exceeds tracked orders — usually means missing order
 * entries rather than a literal shortage, hence the softer tone).
 *
 * @param {object} props
 * @param {Array} props.feedOrders
 * @param {Array} props.dailyLogs
 * @param {Array} props.houses - batch.houses, used for FCR live-weight + per-bird ratios + targets.
 * @param {() => void} [props.onPress]
 */
export default function FeedInventoryCard({
  feedOrders,
  dailyLogs,
  houses,
  onPress,
}) {
  const { t } = useTranslation();
  const isRTL = useIsRTL();
  const tokens = useHeroSheetTokens();
  const {
    accentColor, mutedColor, textColor, dark, errorColor,
  } = tokens;

  const unit = useFeedDisplayStore((s) => s.unit);
  const setUnit = useFeedDisplayStore((s) => s.setUnit);
  const inBags = unit === 'bags';

  const inventory = useMemo(
    () => computeFeedInventory({ feedOrders, dailyLogs }),
    [feedOrders, dailyLogs]
  );
  const orderedByType = useMemo(
    () => aggregateOrderedByType(feedOrders),
    [feedOrders]
  );
  const consumedByType = useMemo(
    () => allocateConsumedByType({
      orderedByType,
      consumedKg: inventory.consumedKg,
    }),
    [orderedByType, inventory.consumedKg]
  );
  const liveWeightKg = useMemo(
    () => deriveLiveWeightKg({ houses, dailyLogs }),
    [houses, dailyLogs]
  );
  const fcr = useMemo(
    () => computeFCR({ consumedKg: inventory.consumedKg, liveWeightKg }),
    [inventory.consumedKg, liveWeightKg]
  );
  const ratios = useMemo(
    () => computeConsumptionRatios({ houses, dailyLogs }),
    [houses, dailyLogs]
  );

  const totalInitialBirds = useMemo(
    () => (houses || []).reduce((s, h) => s + (h.quantity || 0), 0),
    [houses]
  );
  const feedTargets = useMemo(
    () => computeFeedTargets({ birdsPlaced: totalInitialBirds }),
    [totalInitialBirds]
  );

  const phases = useMemo(() => {
    // Show a phase row whenever it either has feed ordered against
    // it OR has a non-zero target the user hasn't started ordering
    // toward yet — empty STARTER/GROWER/FINISHER rows surface the
    // "you should still order this" gap visually via the bar's
    // pale-track third zone.
    const list = FEED_TYPES_DISPLAYED.filter(
      (type) => (orderedByType[type]?.totalKg || 0) > 0
        || (feedTargets[type] || 0) > 0
    );
    if ((orderedByType.OTHER?.totalKg || 0) > 0) list.push('OTHER');
    return list;
  }, [orderedByType, feedTargets]);

  // Headline + subline both swap when the unit toggle flips. The
  // primary value (headline) always reads in the chosen unit; the
  // subline carries the converse unit as a quick cross-reference,
  // followed by days-left when we have a projection.
  const headlineValue = inBags
    ? fmtBags(inventory.remainingBags)
    : fmtInt(inventory.remainingKg);
  const headlineSuffix = inBags
    ? t('batches.bagsUnit', 'bags')
    : t('batches.kgUnit', 'kg');

  const subline = useMemo(() => {
    if (inventory.status === 'untracked') return null;
    const conversePart = inBags
      ? `\u2248 ${fmtInt(inventory.remainingKg)} ${t('batches.kgUnit', 'kg')}`
      : t('batches.feedRemainingBags', '\u2248 {{bags}} bags', {
          bags: fmtBags(inventory.remainingBags),
        });
    const parts = [conversePart];
    if (inventory.daysLeft != null) {
      parts.push(
        t('batches.feedDaysLeft', '{{days}} days left', {
          days: fmtInt(Math.max(0, Math.floor(inventory.daysLeft))),
        })
      );
    }
    return parts.join('  \u00b7  ');
  }, [
    inventory.status,
    inventory.remainingKg,
    inventory.remainingBags,
    inventory.daysLeft,
    inBags,
    t,
  ]);

  const sublineColor = (inventory.status === 'over' || inventory.daysLeft != null)
    ? feedStockToneColor(inventory.status, tokens)
    : mutedColor;

  const fmtPhase = inBags ? fmtPhaseFigureBags : fmtPhaseFigureKg;

  return (
    <BatchKpiCard
      title={t('batches.feedMix', 'Feed')}
      icon={Wheat}
      onPress={onPress}
      headline={headlineValue}
      headlineColor={feedStockToneColor(inventory.status, tokens)}
      headlineSuffix={headlineSuffix}
      headlineSuffixSubscript
      subline={subline}
      sublineColor={sublineColor}
      // Toggle takes the chevron's slot — the unit switch is more
      // useful here than a navigation hint, and tapping anywhere
      // else on the card still fires `onPress` for the
      // jump-to-feed-orders shortcut on Overview.
      headlineRight={(
        <UnitToggle
          unit={unit}
          onChange={(next) => {
            if (next === unit) return;
            Haptics.selectionAsync().catch(() => {});
            setUnit(next);
          }}
          tokens={tokens}
          t={t}
        />
      )}
      stats={[
        {
          icon: Wheat,
          label: t('batches.feedPerBird', 'Feed / Bird'),
          value: fmtRatio(ratios.feedPerBirdKg, 'kg'),
        },
        {
          icon: Package,
          label: t('batches.bagsLeft', 'Bags Left'),
          value: inventory.status === 'untracked'
            ? '\u2014'
            : fmtBags(inventory.remainingBags),
        },
        {
          icon: BarChart3,
          label: t('batches.feedFcr', 'FCR'),
          value: fcr != null ? fcr.toFixed(2) : '\u2014',
        },
      ]}
    >
      {inventory.status === 'critical' || inventory.status === 'over' ? (
        <View
          style={[
            styles.alert,
            {
              flexDirection: rowDirection(isRTL),
              backgroundColor: inventory.status === 'critical'
                ? (dark ? 'rgba(220,38,38,0.14)' : 'hsl(0, 78%, 96%)')
                : (dark ? 'rgba(251,191,36,0.14)' : 'hsl(38, 92%, 95%)'),
            },
          ]}
        >
          <Text
            style={{
              flex: 1,
              fontSize: 12,
              fontFamily: 'Poppins-Medium',
              color: inventory.status === 'critical'
                ? errorColor
                : (dark ? '#fbbf24' : '#d97706'),
              textAlign: textAlignStart(isRTL),
            }}
          >
            {inventory.status === 'critical'
              ? t('batches.feedLowStock', 'Low stock \u2014 order feed soon')
              : t('batches.feedOverConsumed', 'Consumption exceeds tracked orders')}
          </Text>
        </View>
      ) : null}

      {inventory.status === 'untracked' ? (
        <Text
          style={{
            fontSize: 13,
            fontFamily: 'Poppins-Regular',
            color: mutedColor,
            textAlign: 'center',
            paddingVertical: 8,
          }}
        >
          {t('batches.feedUntracked', 'Add feed orders to track inventory')}
        </Text>
      ) : phases.length > 0 ? (
        <View style={{ gap: 6, marginTop: 2 }}>
          {/* Slash-format legend, right-aligned to line up under
              the figures column of the phase rows below. The toggle
              has been hoisted into the headline row (chevron slot),
              so the legend stands alone here — minimal vertical
              footprint, exactly the column it keys. */}
          {feedTargets.TOTAL > 0 ? (
            <Text
              style={[
                styles.legend,
                { textAlign: isRTL ? 'left' : 'right' },
              ]}
              numberOfLines={1}
            >
              <Text style={{ color: accentColor, fontFamily: 'Poppins-SemiBold' }}>
                {t('batches.feedLegendConsumed', 'consumed')}
              </Text>
              <Text style={{ color: mutedColor }}>{'  /  '}</Text>
              <Text style={{ color: textColor }}>
                {t('batches.feedLegendOrdered', 'ordered')}
              </Text>
              <Text style={{ color: mutedColor }}>{'  /  '}</Text>
              <Text style={{ color: mutedColor }}>
                {t('batches.feedLegendTarget', 'target')}
              </Text>
            </Text>
          ) : null}
          {phases.map((type) => {
            const ordered = orderedByType[type]?.totalKg || 0;
            const consumed = consumedByType[type] || 0;
            const target = feedTargets[type] || 0;
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
                  }}
                  numberOfLines={1}
                >
                  {t(`feed.feedTypes.${type}`, type)}
                </Text>
                <View style={styles.barWrap}>
                  <FeedProgressBar
                    consumedKg={consumed}
                    orderedKg={ordered}
                    targetKg={target}
                  />
                </View>
                <Text
                  style={{
                    minWidth: 110,
                    fontSize: 10,
                    fontFamily: 'Poppins-Medium',
                    color: mutedColor,
                    textAlign: 'right',
                  }}
                  numberOfLines={1}
                >
                  {fmtPhase(consumed, ordered, target)}
                </Text>
              </View>
            );
          })}
        </View>
      ) : null}
    </BatchKpiCard>
  );
}

/**
 * Two-pill segmented toggle for kg vs bags. Sized as a small
 * affordance — sits above the per-phase bars right-aligned, doesn't
 * fight the headline for prominence. Active pill uses the accent
 * fill we use for selected-tile states elsewhere.
 */
function UnitToggle({ unit, onChange, tokens, t }) {
  const { accentColor, mutedColor, dark } = tokens;
  const trackBg = dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)';
  const activePillBg = dark ? 'rgba(148,210,165,0.20)' : 'hsl(148, 35%, 92%)';

  const options = [
    { id: 'kg', label: t('batches.kgUnit', 'kg') },
    { id: 'bags', label: t('batches.bagsUnit', 'bags') },
  ];

  return (
    // The track itself is a Pressable with a no-op onPress so taps
    // landing in the 2px padding between pills don't bubble to the
    // parent KPI card's `onPress` (RN's responder system grants
    // touches to the innermost Pressable). Without this, tapping
    // anywhere in the toggle's gutter would also fire the card's
    // navigation handler.
    <Pressable
      onPress={() => {}}
      style={[
        styles.toggleTrack,
        { backgroundColor: trackBg },
      ]}
      accessibilityRole="tablist"
    >
      {options.map((opt) => {
        const active = unit === opt.id;
        return (
          <Pressable
            key={opt.id}
            onPress={() => onChange(opt.id)}
            style={[
              styles.togglePill,
              {
                backgroundColor: active ? activePillBg : 'transparent',
              },
            ]}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
          >
            <Text
              style={{
                fontSize: 10,
                fontFamily: active ? 'Poppins-SemiBold' : 'Poppins-Medium',
                color: active ? accentColor : mutedColor,
                textTransform: 'uppercase',
                letterSpacing: 0.6,
              }}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  alert: {
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    marginBottom: 10,
  },
  phaseRow: {
    alignItems: 'center',
    gap: 8,
  },
  barWrap: {
    flex: 1,
    minWidth: 0,
  },
  toggleTrack: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    padding: 2,
    gap: 2,
  },
  togglePill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  legend: {
    fontSize: 10,
    fontFamily: 'Poppins-Medium',
    letterSpacing: 0.4,
    marginBottom: 2,
  },
});
