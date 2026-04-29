import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Wheat, Package, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import useFeedDisplayStore from '@/stores/feedDisplayStore';
import FeedProgressBar from '@/components/FeedProgressBar';
import KpiHeroCard, {
  feedStockToneClass,
} from '@/modules/broiler/components/KpiHeroCard';
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

// Phase-row right-side figure. Tonnes when any value crosses 1000 kg
// so each row stays one line; falls back to a 2-up consumed/ordered
// when no per-phase target is known (e.g. before any birds are placed).
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
 * KPI tile. Web port of mobile/modules/broiler/components/FeedInventoryCard.js,
 * built on top of the shared KpiHeroCard primitive so it inherits the
 * same eyebrow / headline / stat-grid chrome as every other KPI on the
 * page.
 *
 * Composition (mirrors mobile):
 *   1. Headline + subline = remaining inventory in the user's chosen
 *      unit (kg or bags), with the converse unit + days-left as the
 *      subline. The action-oriented "when do I reorder?" view.
 *   2. Inline kg/bags toggle in the headline-right slot. Choice is
 *      persisted across launches via `feedDisplayStore`.
 *   3. Per-phase bars (children) = consumed / ordered / target for
 *      each feed type. Consumption is allocated *sequentially* across
 *      STARTER → GROWER → FINISHER → OTHER. Each row's bar shows
 *      three zones: solid = consumed, medium = ordered, palest = remaining target.
 *   4. Stat row = Feed/Bird, Bags Left, FCR.
 *
 * Banners surface only when the status warrants action: red for
 * critical (under 3 days runway), amber for over-consumption.
 */
export default function FeedInventoryCard({
  feedOrders,
  dailyLogs,
  houses,
  onClick,
}) {
  const { t } = useTranslation();

  const unit = useFeedDisplayStore((s) => s.unit);
  const setUnit = useFeedDisplayStore((s) => s.setUnit);
  const inBags = unit === 'bags';

  const inventory = useMemo(
    () => computeFeedInventory({ feedOrders, dailyLogs }),
    [feedOrders, dailyLogs],
  );
  const orderedByType = useMemo(
    () => aggregateOrderedByType(feedOrders),
    [feedOrders],
  );
  const consumedByType = useMemo(
    () => allocateConsumedByType({
      orderedByType,
      consumedKg: inventory.consumedKg,
    }),
    [orderedByType, inventory.consumedKg],
  );
  const liveWeightKg = useMemo(
    () => deriveLiveWeightKg({ houses, dailyLogs }),
    [houses, dailyLogs],
  );
  const fcr = useMemo(
    () => computeFCR({ consumedKg: inventory.consumedKg, liveWeightKg }),
    [inventory.consumedKg, liveWeightKg],
  );
  const ratios = useMemo(
    () => computeConsumptionRatios({ houses, dailyLogs }),
    [houses, dailyLogs],
  );

  const totalInitialBirds = useMemo(
    () => (houses || []).reduce((s, h) => s + (h.quantity || 0), 0),
    [houses],
  );
  const feedTargets = useMemo(
    () => computeFeedTargets({ birdsPlaced: totalInitialBirds }),
    [totalInitialBirds],
  );

  // Show a phase row whenever it either has feed ordered against
  // it OR has a non-zero target the user hasn't started ordering
  // toward yet — empty rows surface the "still to order" gap visually
  // via the bar's pale-track third zone.
  const phases = useMemo(() => {
    const list = FEED_TYPES_DISPLAYED.filter(
      (type) => (orderedByType[type]?.totalKg || 0) > 0
        || (feedTargets[type] || 0) > 0,
    );
    if ((orderedByType.OTHER?.totalKg || 0) > 0) list.push('OTHER');
    return list;
  }, [orderedByType, feedTargets]);

  // Headline + subline both swap when the unit toggle flips.
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
        }),
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

  const headlineColor = feedStockToneClass(inventory.status);
  const sublineColor = (inventory.status === 'over' || inventory.daysLeft != null)
    ? feedStockToneClass(inventory.status)
    : 'text-muted-foreground';

  const fmtPhase = inBags ? fmtPhaseFigureBags : fmtPhaseFigureKg;

  return (
    <KpiHeroCard
      title={t('batches.feedMix', 'Feed')}
      icon={Wheat}
      onClick={onClick}
      headline={headlineValue}
      headlineColor={headlineColor}
      headlineSuffix={headlineSuffix}
      subline={subline}
      sublineColor={sublineColor}
      headlineRight={(
        <UnitToggle
          unit={unit}
          onChange={(next) => {
            if (next === unit) return;
            setUnit(next);
          }}
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
      {/* Critical / over-consumption banner — surfaces only when
          the inventory math says the operator should act today. */}
      {inventory.status === 'critical' || inventory.status === 'over' ? (
        <div
          className={cn(
            'mb-2.5 rounded-lg px-3 py-2 text-xs font-medium',
            inventory.status === 'critical'
              ? 'bg-destructive/10 text-destructive dark:bg-destructive/15'
              : 'bg-warning-bg text-warning',
          )}
        >
          {inventory.status === 'critical'
            ? t('batches.feedLowStock', 'Low stock \u2014 order feed soon')
            : t('batches.feedOverConsumed', 'Consumption exceeds tracked orders')}
        </div>
      ) : null}

      {inventory.status === 'untracked' ? (
        <p className="py-2 text-center text-sm text-muted-foreground">
          {t('batches.feedUntracked', 'Add feed orders to track inventory')}
        </p>
      ) : phases.length > 0 ? (
        <div className="space-y-1.5">
          {/* Slash-format legend, end-aligned to line up with the
              figures column of the phase rows below. */}
          {feedTargets.TOTAL > 0 ? (
            <div className="text-end text-[10px] font-medium tracking-wide">
              <span className="font-semibold text-success">
                {t('batches.feedLegendConsumed', 'consumed')}
              </span>
              <span className="text-muted-foreground">{'  /  '}</span>
              <span className="text-foreground">
                {t('batches.feedLegendOrdered', 'ordered')}
              </span>
              <span className="text-muted-foreground">{'  /  '}</span>
              <span className="text-muted-foreground">
                {t('batches.feedLegendTarget', 'target')}
              </span>
            </div>
          ) : null}
          {phases.map((type) => {
            const ordered = orderedByType[type]?.totalKg || 0;
            const consumed = consumedByType[type] || 0;
            const target = feedTargets[type] || 0;
            return (
              <div
                key={type}
                className="flex items-center gap-2"
              >
                <span className="w-16 truncate text-[11px] font-semibold uppercase tracking-wider text-foreground">
                  {t(`feed.feedTypes.${type}`, type)}
                </span>
                <div className="min-w-0 flex-1">
                  <FeedProgressBar
                    consumedKg={consumed}
                    orderedKg={ordered}
                    targetKg={target}
                  />
                </div>
                <span className="min-w-[110px] text-end text-[10px] font-medium text-muted-foreground tabular-nums truncate">
                  {fmtPhase(consumed, ordered, target)}
                </span>
              </div>
            );
          })}
        </div>
      ) : null}
    </KpiHeroCard>
  );
}

/**
 * Two-pill segmented toggle for kg vs bags. Sized as a small
 * affordance — sits in the headline-right slot, doesn't fight the
 * headline for prominence. Active pill uses a soft accent fill.
 */
function UnitToggle({ unit, onChange, t }) {
  const options = [
    { id: 'kg', label: t('batches.kgUnit', 'kg') },
    { id: 'bags', label: t('batches.bagsUnit', 'bags') },
  ];

  return (
    <div
      role="tablist"
      aria-label={t('batches.feedUnitToggle', 'Feed display unit')}
      className="inline-flex items-center gap-0.5 rounded-full bg-foreground/[0.04] p-0.5 dark:bg-white/[0.06]"
    >
      {options.map((opt) => {
        const active = unit === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            role="tab"
            aria-selected={active}
            className={cn(
              'rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider transition-colors',
              active
                ? 'bg-success-bg text-success'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
