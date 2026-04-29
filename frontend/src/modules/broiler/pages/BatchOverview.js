import { useState, useMemo, useEffect } from 'react';
import { useParams, useOutletContext, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useToast } from '@/components/ui/use-toast';
import {
  Egg, DollarSign, Wheat, ShoppingCart, ChevronsDownUp, ChevronsUpDown, Home,
  Activity, Skull, Receipt, TrendingUp, Bird, Droplets,
} from 'lucide-react';
import CollapsibleSection from '@/components/CollapsibleSection';
import SourceRow from '@/modules/broiler/rows/SourceRow';
import ExpenseRow from '@/modules/broiler/rows/ExpenseRow';
import FeedItemRow from '@/shared/rows/FeedItemRow';
import SaleRow from '@/modules/broiler/rows/SaleRow';
import ExpenseCategoryGroup from '@/modules/broiler/rows/ExpenseCategoryGroup';
import SourceSheet from '@/modules/broiler/sheets/SourceSheet';
import ExpenseSheet from '@/modules/broiler/sheets/ExpenseSheet';
import FeedOrderSheet from '@/modules/broiler/sheets/FeedOrderSheet';
import SaleOrderSheet from '@/modules/broiler/sheets/SaleOrderSheet';
import useLocalQuery from '@/hooks/useLocalQuery';
import KpiHeroCard, {
  profitToneClass, mortalityToneClass,
} from '@/modules/broiler/components/KpiHeroCard';
import FeedInventoryCard from '@/modules/broiler/components/FeedInventoryCard';
import { cn } from '@/lib/utils';

const fmt = (val) =>
  Number(val || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtInt = (val) => Number(val || 0).toLocaleString('en-US');

// Compact KG / L formatters mirror the mobile BatchOverviewTab so the
// Cycle Performance headline and stat row fit one line even when the
// numbers cross the tonne threshold.
const fmtCompactKg = (val) => {
  const n = Number(val || 0);
  if (n >= 1000) {
    return `${(n / 1000).toLocaleString('en-US', {
      minimumFractionDigits: 1, maximumFractionDigits: 1,
    })}t`;
  }
  return `${fmtInt(n)} kg`;
};

const fmtCompactL = (val) => {
  const n = Number(val || 0);
  if (n >= 1000) {
    return `${(n / 1000).toLocaleString('en-US', {
      minimumFractionDigits: 1, maximumFractionDigits: 1,
    })}kL`;
  }
  return `${fmtInt(n)} L`;
};

// Cap the expense breakdown to the top N categories + an "Others"
// rollup so the body stays compact regardless of how many expense
// categories the user uses (matches mobile §50 of BatchOverviewTab).
const TOP_EXPENSE_CATEGORIES = 5;

export default function BatchOverview() {
  const { id } = useParams();
  const { batch } = useOutletContext();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { toast } = useToast();

  const [sourceSheetOpen, setSourceSheetOpen] = useState(false);
  const [expenseSheetOpen, setExpenseSheetOpen] = useState(false);
  const [feedOrderSheetOpen, setFeedOrderSheetOpen] = useState(false);
  const [saleSheetOpen, setSaleSheetOpen] = useState(false);

  const sources = useLocalQuery('sources', { batch: id });
  const expenses = useLocalQuery('expenses', { batch: id });
  const feedOrders = useLocalQuery('feedOrders', { batch: id });
  const saleOrders = useLocalQuery('saleOrders', { batch: id });
  const dailyLogs = useLocalQuery('dailyLogs', { batch: id });

  const totalSourceChicks = useMemo(() => sources.reduce((s, x) => s + (x.totalChicks || 0), 0), [sources]);
  const totalSourceCost = useMemo(() => sources.reduce((s, x) => s + (x.grandTotal || 0), 0), [sources]);
  const totalExpenses = useMemo(() => expenses.reduce((s, x) => s + (x.totalAmount || 0), 0), [expenses]);
  const totalFeedCost = useMemo(() => feedOrders.reduce((s, x) => s + (x.grandTotal || 0), 0), [feedOrders]);
  const totalRevenue = useMemo(() => saleOrders.reduce((s, x) => s + (x.totals?.grandTotal || 0), 0), [saleOrders]);
  const totalSaleChickens = useMemo(() => saleOrders.reduce((s, x) => {
    return s + (x.counts?.chickensSent || 0) + (x.live?.birdCount || 0);
  }, 0), [saleOrders]);
  const totalSaleTrucks = useMemo(() => saleOrders.reduce((s, x) => s + (x.transport?.truckCount || 0), 0), [saleOrders]);
  const netProfit = totalRevenue - totalExpenses;

  // Single-pass aggregation over dailyLogs — mortality + feed + water
  // need exactly the same iteration so we fold them together rather
  // than recompute three separate filters/reduces.
  const houses = batch?.houses || [];
  const totalInitial = useMemo(
    () => houses.reduce((s, h) => s + (h.quantity || 0), 0),
    [houses],
  );
  const { totalDeaths, deathsByHouse, totalFeedConsumedKg, totalWaterL } = useMemo(() => {
    const byHouse = {};
    let deaths = 0;
    let feedKg = 0;
    let waterL = 0;
    (dailyLogs || []).forEach((log) => {
      if (log.deletedAt || log.logType !== 'DAILY') return;
      if (log.deaths != null) {
        const houseId = typeof log.house === 'object' ? log.house?._id : log.house;
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
  const marginPct = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : null;
  const profitPerBird = currentBirds > 0 ? netProfit / currentBirds : null;

  // Cycle day label — runs to "today" for active batches; for completed
  // batches anchors the end date to the most recent sale so a finished
  // batch reads "32 days elapsed" instead of an ever-growing live counter.
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

  // Per-house mortality rows for the Cycle Performance card body —
  // sorted by absolute deaths descending so the worst row sits at the
  // top, just like the mobile parity layout.
  const houseMortalityRows = useMemo(() => {
    return houses
      .map((entry, i) => {
        const houseId = typeof entry.house === 'object' ? entry.house?._id : entry.house;
        const name = (typeof entry.house === 'object' ? entry.house?.name : null)
          || t('farms.houseN', 'House {{n}}', { n: i + 1 });
        const initial = entry.quantity || 0;
        const houseDeaths = deathsByHouse[houseId] || 0;
        const housePct = initial > 0 ? (houseDeaths / initial) * 100 : 0;
        return { key: houseId || `h${i}`, name, initial, houseDeaths, housePct };
      })
      .sort((a, b) => b.houseDeaths - a.houseDeaths);
  }, [houses, deathsByHouse, t]);

  // Top-N expense categories with the long tail folded into "OTHERS"
  // — same recipe as the mobile BatchOverviewTab card body bars.
  const expenseBreakdownBars = useMemo(() => {
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

  const sortedExpenseCategories = useMemo(() => {
    const groups = {};
    expenses.forEach((e) => {
      const cat = e.category || 'OTHER';
      if (!groups[cat]) groups[cat] = { items: [], total: 0 };
      groups[cat].items.push(e);
      groups[cat].total += e.totalAmount || 0;
    });
    return Object.entries(groups).sort(([a], [b]) =>
      t(`batches.expenseCategories.${a}`).localeCompare(t(`batches.expenseCategories.${b}`)),
    );
  }, [expenses, t]);

  const catStorageKey = `expense-cats-${id}`;
  const [categoryOpen, setCategoryOpen] = useState(() => {
    try { return JSON.parse(localStorage.getItem(catStorageKey) || '{}'); }
    catch { return {}; }
  });
  useEffect(() => {
    if (Object.keys(categoryOpen).length > 0) {
      localStorage.setItem(catStorageKey, JSON.stringify(categoryOpen));
    }
  }, [categoryOpen, catStorageKey]);

  const toggleCategory = (cat) => setCategoryOpen((prev) => ({ ...prev, [cat]: !(prev[cat] ?? true) }));
  const allCategoriesExpanded = sortedExpenseCategories.every(([cat]) => categoryOpen[cat] ?? true);
  const toggleAllCategories = () => {
    const next = {};
    sortedExpenseCategories.forEach(([cat]) => { next[cat] = !allCategoriesExpanded; });
    setCategoryOpen(next);
  };

  const FEED_TYPE_ORDER = { STARTER: 0, GROWER: 1, FINISHER: 2, OTHER: 3 };

  const { sortedFeedTypes, totalFeedKg } = useMemo(() => {
    const groups = {};
    let kg = 0;
    feedOrders.forEach((order) => {
      (order.items || []).forEach((item) => {
        const type = item.feedType || 'OTHER';
        const itemKg = (item.bags || 0) * (item.quantitySize || 50);
        const itemCost = (item.bags || 0) * (item.pricePerBag || 0);
        if (!groups[type]) groups[type] = { items: [], totalKg: 0, totalCost: 0 };
        groups[type].items.push({
          ...item,
          orderDate: order.orderDate,
          companyName: order.feedCompany?.companyName,
          orderId: order._id,
        });
        groups[type].totalKg += itemKg;
        groups[type].totalCost += itemCost;
        kg += itemKg;
      });
    });
    const sorted = Object.entries(groups).sort(
      ([a], [b]) => (FEED_TYPE_ORDER[a] ?? 99) - (FEED_TYPE_ORDER[b] ?? 99),
    );
    sorted.forEach(([, g]) => g.items.sort((a, b) => new Date(a.orderDate || 0) - new Date(b.orderDate || 0)));
    return { sortedFeedTypes: sorted, totalFeedKg: kg };
  }, [feedOrders]);

  const feedCatStorageKey = `feed-cats-${id}`;
  const [feedCatOpen, setFeedCatOpen] = useState(() => {
    try { return JSON.parse(localStorage.getItem(feedCatStorageKey) || '{}'); }
    catch { return {}; }
  });
  useEffect(() => {
    if (Object.keys(feedCatOpen).length > 0) {
      localStorage.setItem(feedCatStorageKey, JSON.stringify(feedCatOpen));
    }
  }, [feedCatOpen, feedCatStorageKey]);

  const toggleFeedCat = (cat) => setFeedCatOpen((prev) => ({ ...prev, [cat]: !(prev[cat] ?? true) }));
  const allFeedCatsExpanded = sortedFeedTypes.every(([cat]) => feedCatOpen[cat] ?? true);
  const toggleAllFeedCats = () => {
    const next = {};
    sortedFeedTypes.forEach(([cat]) => { next[cat] = !allFeedCatsExpanded; });
    setFeedCatOpen(next);
  };

  const sortedSaleDates = useMemo(() => {
    const groups = {};
    saleOrders.forEach((sale) => {
      const key = sale.saleDate ? new Date(sale.saleDate).toISOString().slice(0, 10) : 'no-date';
      if (!groups[key]) groups[key] = { items: [], revenue: 0, chickens: 0, trucks: 0 };
      groups[key].items.push(sale);
      groups[key].revenue += sale.totals?.grandTotal || 0;
      groups[key].chickens += (sale.counts?.chickensSent || 0) + (sale.live?.birdCount || 0);
      groups[key].trucks += sale.transport?.truckCount || 0;
    });
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [saleOrders]);

  const saleDateStorageKey = `sale-dates-${id}`;
  const [saleDateOpen, setSaleDateOpen] = useState(() => {
    try { return JSON.parse(localStorage.getItem(saleDateStorageKey) || '{}'); }
    catch { return {}; }
  });
  useEffect(() => {
    if (Object.keys(saleDateOpen).length > 0) {
      localStorage.setItem(saleDateStorageKey, JSON.stringify(saleDateOpen));
    }
  }, [saleDateOpen, saleDateStorageKey]);

  const toggleSaleDate = (key) => setSaleDateOpen((prev) => ({ ...prev, [key]: !(prev[key] ?? true) }));
  const allSaleDatesExpanded = sortedSaleDates.every(([key]) => saleDateOpen[key] ?? true);
  const toggleAllSaleDates = () => {
    const next = {};
    sortedSaleDates.forEach(([key]) => { next[key] = !allSaleDatesExpanded; });
    setSaleDateOpen(next);
  };

  const fmtDateLabel = (key) => {
    if (key === 'no-date') return t('common.noDate', 'No Date');
    return new Date(key + 'T00:00:00').toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const profitColor = profitToneClass(netProfit);
  const mortColor = mortalityToneClass(mortalityPct);
  const perBirdColor = profitToneClass(profitPerBird);

  return (
    <>
      {/* Mobile-parity KPI strip — uses CSS multi-column instead of a
          rigid grid so cards pack masonry-style and the empty space
          below shorter cards collapses.

          Why multi-column over a 3-column grid: the cards are
          content-driven and have very different intrinsic heights
          (Cycle Performance ~380px, Feed ~400px, Net Profit ~200px,
          Expenses by Category ~470px when 6 categories are present).
          A `lg:grid-cols-3` either wastes vertical space below the
          two shorter cards or forces them to stretch with empty
          internal padding. Multi-column flows the cards top-to-bottom
          per column and lets the browser balance heights naturally.

          The source order matches the original semantic preference
          (Cycle Performance first → LEFT, Feed second → MIDDLE,
          Net Profit + Expenses last). With four blocks across three
          columns the browser typically packs Net Profit beneath one
          of the medium-height cards and keeps Expenses in its own
          column — the result has noticeably less dead space than the
          straight grid did.

          `break-inside-avoid` keeps each card atomic so the browser
          never splits a card across two columns. `mb-4` stacks
          siblings in the same column with the same gap as the
          column gutter. */}
      <div className="columns-1 lg:columns-3 gap-4 [&>*]:break-inside-avoid [&>*]:mb-4">
        {/* Cycle Performance — anchors the LEFT column (first source
            item always starts at the top of column 1). */}
        <KpiHeroCard
          title={t('batches.cyclePerformance', 'Cycle Performance')}
          icon={Activity}
          headline={fmtInt(currentBirds)}
          subline={
            totalInitial > 0
              ? `${t('batches.ofPlaced', 'of {{count}} placed', { count: fmtInt(totalInitial) })}${
                  cycleDayLabel ? `  \u00b7  ${cycleDayLabel}` : ''
                }`
              : (cycleDayLabel || null)
          }
          stats={[
            {
              icon: Skull,
              label: t('dashboard.mortalityRate', 'Mortality'),
              value: `${mortalityPct.toFixed(2)}%`,
              valueColor: mortColor,
              subValue: totalDeaths > 0
                ? t('batches.deathsCount', '{{count}} deaths', { count: fmtInt(totalDeaths) })
                : null,
            },
            {
              icon: Wheat,
              label: t('batches.totalFeed', 'Feed'),
              value: fmtCompactKg(totalFeedConsumedKg),
              subValue: totalFeedKg > 0
                ? t('batches.feedOfOrdered', 'of {{total}}', { total: fmtCompactKg(totalFeedKg) })
                : null,
            },
            {
              icon: Droplets,
              label: t('batches.totalWater', 'Water'),
              value: fmtCompactL(totalWaterL),
              subValue: currentBirds > 0 && totalWaterL > 0
                ? t('batches.waterPerBirdShort', '{{value}} L/bird', {
                    value: (totalWaterL / currentBirds).toFixed(2),
                  })
                : null,
            },
          ]}
        >
          {totalInitial > 0 ? (
            <>
              {/* Survival progress bar — accentStrong fill against a
                  translucent track. Width pegged to surviving %, so a
                  finished batch with high mortality reads visually
                  shorter at a glance. */}
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-foreground/[0.05] dark:bg-white/[0.06]">
                <div
                  className="h-full rounded-full bg-accentStrong"
                  style={{ width: `${survivalPct}%` }}
                  aria-hidden="true"
                />
              </div>
              {/* Per-house mortality rows. Sorted worst-first; the
                  death cluster `(-N)` is hidden when zero so a fresh
                  house reads as just `1,500   0.00%`. */}
              <div className="mt-3 space-y-1.5">
                {houseMortalityRows.map((h) => {
                  const houseTone = mortalityToneClass(h.housePct);
                  return (
                    <div
                      key={h.key}
                      className="flex items-center gap-2 rounded-lg bg-foreground/[0.04] px-2.5 py-1.5 text-xs dark:bg-white/[0.04]"
                    >
                      <Home className="h-3 w-3 shrink-0 text-muted-foreground" strokeWidth={2.2} />
                      <span className="min-w-0 flex-1 truncate font-medium text-foreground">
                        {h.name}
                      </span>
                      <span className="tabular-nums text-muted-foreground">{fmtInt(h.initial)}</span>
                      {h.houseDeaths > 0 ? (
                        <span className={cn('font-semibold tabular-nums', houseTone)}>
                          {`(-${fmtInt(h.houseDeaths)})`}
                        </span>
                      ) : null}
                      <span className={cn('w-12 text-end text-[11px] font-semibold tabular-nums', houseTone)}>
                        {`${h.housePct.toFixed(2)}%`}
                      </span>
                    </div>
                  );
                })}
              </div>
            </>
          ) : null}
        </KpiHeroCard>

        {/* Feed KPI — second item, anchors MIDDLE column on most
            balances. Lifted from mobile Performance tab. */}
        <FeedInventoryCard
          feedOrders={feedOrders}
          dailyLogs={dailyLogs}
          houses={houses}
          onClick={() => navigate(`/dashboard/batches/${id}/feed-orders`)}
        />

        {/* Net Profit — small card. With multi-column auto-balance,
            this typically lands beneath the Feed card or beneath the
            Cycle Performance card to even the column heights. */}
        <KpiHeroCard
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
              value: profitPerBird != null ? fmt(profitPerBird) : '\u2014',
              valueColor: perBirdColor,
            },
          ]}
        />

        {/* Expenses by Category — tallest card (variable: 1 row per
            category, capped at 6). With 4 items across 3 columns the
            browser usually places this on its own in column 3. */}
        <KpiHeroCard
          title={t('batches.expenseBreakdown', 'Expenses by category')}
          icon={Receipt}
          headline={fmt(totalExpenses)}
        >
          {expenseBreakdownBars.length === 0 ? (
            <p className="py-3 text-center text-sm text-muted-foreground">
              {t('batches.operations.noEntries', 'No entries yet')}
            </p>
          ) : (
            <div className="space-y-2.5">
              {expenseBreakdownBars.map(([category, amount]) => {
                const widthPct = totalExpenses > 0 ? (amount / totalExpenses) * 100 : 0;
                return (
                  <div key={category}>
                    <div className="mb-1.5 flex items-center justify-between gap-2">
                      <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">
                        {t(`batches.expenseCategories.${category}`, category)}
                      </span>
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {fmt(amount)}
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-foreground/[0.05] dark:bg-white/[0.06]">
                      <div
                        className="h-full rounded-full bg-accentStrong"
                        style={{ width: `${widthPct}%` }}
                        aria-hidden="true"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </KpiHeroCard>
      </div>

      {/* Compact source/chick summary preserved as a slim utility row —
          the mobile dashboard surfaces these inside the Source Entries
          column, but on web they were the only place totalSourceChicks /
          source count shows. Keep them to avoid an information regression
          from the old 5-card layout. */}
      {sources.length > 0 ? (
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span>
            <span className="tabular-nums text-foreground font-semibold">{fmtInt(totalSourceChicks)}</span>
            {' '}{t('batches.totalChicksReceived')}
          </span>
          <span aria-hidden="true">·</span>
          <span>
            <span className="tabular-nums text-foreground font-semibold">{sources.length}</span>
            {' '}{t('batches.sourceEntries')}
          </span>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3 mt-4">
        {/* Column 1: Sources */}
        <div className="space-y-4">
          <CollapsibleSection
            variant="sources"
            title={t('batches.sourcesTab')}
            icon={Egg}
            headerExtra={
              <span className="inline-flex items-center rounded-full border bg-background/80 text-[10px] font-semibold tabular-nums text-muted-foreground">
                <span className="px-1.5 py-0">{fmt(totalSourceCost)}</span>
                <span className="w-px self-stretch bg-border" />
                <span className="px-1.5 py-0">{totalSourceChicks.toLocaleString('en-US')} {t('batches.chicks', 'chicks')}</span>
                <span className="w-px self-stretch bg-border" />
                <span className="px-1.5 py-0">{sources.length}</span>
              </span>
            }
            expandTo={`/dashboard/batches/${id}/sources`}
            onAdd={() => setSourceSheetOpen(true)}
            persistKey={`batch-${id}-sources`}
            items={sources}
            renderItem={(source) => (
              <SourceRow
                key={source._id}
                source={source}
                onClick={() => navigate(`/dashboard/batches/${id}/sources/${source._id}`)}
              />
            )}
          />

          <CollapsibleSection
            variant="feedOrders"
            title={t('batches.feedOrdersTab')}
            icon={Wheat}
            headerExtra={
              <span className="inline-flex items-center rounded-full border bg-background/80 text-[10px] font-semibold tabular-nums text-muted-foreground">
                <span className="px-1.5 py-0">{fmt(totalFeedCost)}</span>
                <span className="w-px self-stretch bg-border" />
                <span className="px-1.5 py-0">{totalFeedKg.toLocaleString('en-US')} KG</span>
                <span className="w-px self-stretch bg-border" />
                <span className="px-1.5 py-0">{feedOrders.length}</span>
                {sortedFeedTypes.length > 1 && (
                  <>
                    <span className="w-px self-stretch bg-border" />
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={toggleAllFeedCats}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleAllFeedCats(); } }}
                      className="px-1 py-0.5 hover:bg-muted/60 rounded-r-full cursor-pointer transition-colors"
                    >
                      {allFeedCatsExpanded
                        ? <ChevronsDownUp className="h-2.5 w-2.5" />
                        : <ChevronsUpDown className="h-2.5 w-2.5" />}
                    </span>
                  </>
                )}
              </span>
            }
            expandTo={`/dashboard/batches/${id}/feed-orders`}
            onAdd={() => setFeedOrderSheetOpen(true)}
            persistKey={`batch-${id}-feedOrders`}
          >
            {sortedFeedTypes.map(([type, { items, totalKg, totalCost }]) => (
              <ExpenseCategoryGroup
                key={type}
                label={t(`feed.feedTypes.${type}`)}
                pills={[
                  { value: fmt(totalCost) },
                  { value: `${totalKg.toLocaleString('en-US')} KG` },
                  { value: items.length },
                ]}
                open={feedCatOpen[type] ?? true}
                onToggle={() => toggleFeedCat(type)}
              >
                {items.map((item, i) => (
                  <FeedItemRow
                    key={item._id || i}
                    item={item}
                    onClick={() => navigate(`/dashboard/batches/${id}/feed-orders/${item.orderId}`)}
                  />
                ))}
              </ExpenseCategoryGroup>
            ))}
          </CollapsibleSection>
        </div>

        {/* Column 2: Expenses (grouped) */}
        <div className="space-y-4">
          <CollapsibleSection
            variant="expenses"
            title={t('batches.expensesTab')}
            icon={DollarSign}
            headerExtra={
              <span className="inline-flex items-center rounded-full border bg-background/80 text-[10px] font-semibold tabular-nums text-muted-foreground">
                <span className="px-1.5 py-0">{fmt(totalExpenses)}</span>
                <span className="w-px self-stretch bg-border" />
                <span className="px-1.5 py-0">{expenses.length}</span>
                {sortedExpenseCategories.length > 1 && (
                  <>
                    <span className="w-px self-stretch bg-border" />
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={toggleAllCategories}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleAllCategories(); } }}
                      className="px-1 py-0.5 hover:bg-muted/60 rounded-r-full cursor-pointer transition-colors"
                    >
                      {allCategoriesExpanded
                        ? <ChevronsDownUp className="h-2.5 w-2.5" />
                        : <ChevronsUpDown className="h-2.5 w-2.5" />}
                    </span>
                  </>
                )}
              </span>
            }
            expandTo={`/dashboard/batches/${id}/expenses`}
            onAdd={() => setExpenseSheetOpen(true)}
            persistKey={`batch-${id}-expenses`}
          >
            <div>
              {sortedExpenseCategories.map(([category, { items, total }]) => (
                <ExpenseCategoryGroup
                  key={category}
                  label={t(`batches.expenseCategories.${category}`)}
                  total={total}
                  count={items.length}
                  open={categoryOpen[category] ?? true}
                  onToggle={() => toggleCategory(category)}
                >
                  {items.map((expense) => (
                    <ExpenseRow
                      key={expense._id}
                      expense={expense}
                      categoryLabel={t(`batches.expenseCategories.${expense.category}`)}
                      onClick={() => navigate(`/dashboard/batches/${id}/expenses/${expense._id}`)}
                    />
                  ))}
                </ExpenseCategoryGroup>
              ))}
            </div>
          </CollapsibleSection>
        </div>

        {/* Column 3: Sales */}
        <div className="space-y-4">
          <CollapsibleSection
            variant="sales"
            title={t('batches.salesTab')}
            icon={ShoppingCart}
            headerExtra={
              <span className="inline-flex items-center rounded-full border bg-background/80 text-[10px] font-semibold tabular-nums text-muted-foreground">
                <span className="px-1.5 py-0">{fmt(totalRevenue)}</span>
                <span className="w-px self-stretch bg-border" />
                <span className="px-1.5 py-0">{totalSaleChickens.toLocaleString('en-US')} {t('batches.birds', 'birds')}</span>
                <span className="w-px self-stretch bg-border" />
                <span className="px-1.5 py-0">{totalSaleTrucks} {t('batches.trucks', 'trucks')}</span>
                {sortedSaleDates.length > 1 && (
                  <>
                    <span className="w-px self-stretch bg-border" />
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={toggleAllSaleDates}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleAllSaleDates(); } }}
                      className="px-1 py-0.5 hover:bg-muted/60 rounded-r-full cursor-pointer transition-colors"
                    >
                      {allSaleDatesExpanded
                        ? <ChevronsDownUp className="h-2.5 w-2.5" />
                        : <ChevronsUpDown className="h-2.5 w-2.5" />}
                    </span>
                  </>
                )}
              </span>
            }
            expandTo={`/dashboard/batches/${id}/sales`}
            onAdd={() => setSaleSheetOpen(true)}
            persistKey={`batch-${id}-sales`}
          >
            {sortedSaleDates.map(([dateKey, { items, revenue, chickens, trucks }]) => (
              <ExpenseCategoryGroup
                key={dateKey}
                label={fmtDateLabel(dateKey)}
                pills={[
                  { value: fmt(revenue) },
                  { value: `${chickens.toLocaleString('en-US')} ${t('batches.birds', 'birds')}` },
                  { value: `${trucks} ${t('batches.trucks', 'trucks')}` },
                ]}
                open={saleDateOpen[dateKey] ?? true}
                onToggle={() => toggleSaleDate(dateKey)}
              >
                {items.map((sale) => (
                  <SaleRow
                    key={sale._id}
                    sale={sale}
                    onClick={() => navigate(`/dashboard/batches/${id}/sales/${sale._id}`)}
                  />
                ))}
              </ExpenseCategoryGroup>
            ))}
          </CollapsibleSection>
        </div>
      </div>

      <SourceSheet
        open={sourceSheetOpen}
        onOpenChange={(open) => { if (!open) setSourceSheetOpen(false); }}
        batchId={id}
        editingSource={null}
        onSuccess={() => {}}
      />
      <ExpenseSheet
        open={expenseSheetOpen}
        onOpenChange={(open) => { if (!open) setExpenseSheetOpen(false); }}
        batchId={id}
        editingExpense={null}
        onSuccess={() => {}}
      />
      <FeedOrderSheet
        open={feedOrderSheetOpen}
        onOpenChange={(open) => { if (!open) setFeedOrderSheetOpen(false); }}
        batchId={id}
        editingFeedOrder={null}
        onSuccess={() => {}}
      />
      <SaleOrderSheet
        open={saleSheetOpen}
        onOpenChange={(open) => { if (!open) setSaleSheetOpen(false); }}
        batchId={id}
        editingSaleOrder={null}
      />
    </>
  );
}
