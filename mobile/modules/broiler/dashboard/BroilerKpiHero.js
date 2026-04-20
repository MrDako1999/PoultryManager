import { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import {
  Bird, DollarSign, TrendingUp, Receipt, Egg, Skull, ShoppingCart, Layers,
} from 'lucide-react-native';
import { SkeletonDashboardKpiHero } from '@/components/skeletons';
import SlidingSegmentedControl from '@/components/SlidingSegmentedControl';
import { useHeroSheetTokens } from '@/components/HeroSheetScreen';
import useCapabilities from '@/hooks/useCapabilities';
import useSettings from '@/hooks/useSettings';
import BatchKpiCard, { profitToneColor } from '@/modules/broiler/components/BatchKpiCard';
import useBroilerDashboardStats from './useBroilerDashboardStats';

// Western digits everywhere (DL §12.4) — never i18n.language for numerics.
const NUMERIC_LOCALE = 'en-US';

const fmtInt = (val) => Number(val || 0).toLocaleString(NUMERIC_LOCALE);

const fmtMoney = (val) =>
  Number(val || 0).toLocaleString(NUMERIC_LOCALE, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

function trimFixedMantissa(s) {
  if (!s.includes('.')) return s;
  return s.replace(/\.?0+$/, '');
}

// Compact flock + all-time financial headlines: integer K (floor thousands)
// and up to 3 dp on millions, trailing zeros trimmed (e.g. 409K, 776K, 1.185M).
const fmtCompact = (val) => {
  const n = Number(val || 0);
  if (!Number.isFinite(n) || n === 0) return '0';
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  if (abs >= 1_000_000) {
    const m = abs / 1_000_000;
    const body = trimFixedMantissa(m.toFixed(3));
    return `${sign}${body}M`;
  }
  if (abs >= 1_000) {
    const k = Math.floor(abs / 1_000);
    return `${sign}${k.toLocaleString(NUMERIC_LOCALE)}K`;
  }
  return `${sign}${fmtInt(abs)}`;
};

// Same K/M rules as `fmtCompact`; sub‑1K amounts keep full currency decimals.
const fmtCompactCurrency = (val) => {
  const n = Number(val || 0);
  if (!Number.isFinite(n)) return fmtMoney(0);
  if (n === 0) return fmtMoney(0);
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  if (abs >= 1_000_000) {
    const m = abs / 1_000_000;
    const body = trimFixedMantissa(m.toFixed(3));
    return `${sign}${body}M`;
  }
  if (abs >= 1_000) {
    const k = Math.floor(abs / 1_000);
    return `${sign}${k.toLocaleString(NUMERIC_LOCALE)}K`;
  }
  return fmtMoney(n);
};

/** Deaths in mortality chip: full integer until strictly above 10k, then one-decimal K (e.g. 10.4K). */
function fmtMortalityDeathsForDisplay(deaths) {
  const n = Math.floor(Number(deaths || 0));
  if (n <= 10_000) return fmtInt(n);
  const k = n / 1000;
  return `${trimFixedMantissa(k.toFixed(1))}K`;
}

/** Same recipe as `BroilerActiveBatches` meta row: `(-count) · pct%` when losses exist. */
function fmtFlockMortalityCountAndPct(deaths, mortalityPct) {
  const d = Number(deaths || 0);
  const pct = Number(mortalityPct || 0);
  const pctStr = `${pct.toFixed(2)}%`;
  if (d > 0) return `(-${fmtMortalityDeathsForDisplay(d)}) · ${pctStr}`;
  return pctStr;
}

const SCOPES = ['active', 'allTime', 'thisMonth'];

// Tone classifiers — each returns one of `'good' | 'warning' | 'bad'`.
// The chip tint table below paints those tones consistently in both
// themes; we never pass raw colour strings into the chip because some
// of our colour tokens are HSL (e.g. `accentColor`) and HSL strings
// don't accept the hex-alpha append trick that hex tokens do — that's
// what produced the "solid green pill, invisible text" bug.
function mortalityTone(pct) {
  if (pct >= 5) return 'bad';
  if (pct >= 2) return 'warning';
  return 'good';
}

const CHIP_TINTS = {
  good: {
    light: { bg: 'hsl(148, 35%, 92%)',      border: 'hsl(148, 35%, 80%)',      fg: 'hsl(148, 60%, 28%)' },
    dark:  { bg: 'rgba(148,210,165,0.16)',  border: 'rgba(148,210,165,0.30)',  fg: 'hsl(148, 55%, 55%)' },
  },
  warning: {
    light: { bg: 'rgba(217,119,6,0.10)',    border: 'rgba(217,119,6,0.22)',    fg: '#d97706' },
    dark:  { bg: 'rgba(251,191,36,0.16)',   border: 'rgba(251,191,36,0.30)',   fg: '#fbbf24' },
  },
  bad: {
    light: { bg: 'rgba(220,38,38,0.08)',    border: 'rgba(220,38,38,0.20)',    fg: '#dc2626' },
    dark:  { bg: 'rgba(252,165,165,0.14)',  border: 'rgba(252,165,165,0.30)',  fg: '#fca5a5' },
  },
};

export default function BroilerKpiHero() {
  const { t } = useTranslation();
  const tokens = useHeroSheetTokens();
  const { dark } = tokens;
  const accounting = useSettings('accounting');
  const currency = accounting?.currency || 'AED';
  const { can } = useCapabilities();
  const canOpenAccounting = can('expense:read') || can('saleOrder:read');

  const [scope, setScope] = useState('active');
  const { flockStats, financials, isLoading } = useBroilerDashboardStats(scope);

  if (isLoading) {
    return <SkeletonDashboardKpiHero />;
  }

  const goBatches = () => {
    Haptics.selectionAsync().catch(() => {});
    router.push('/(app)/(tabs)/batches');
  };

  const goAccounting = () => {
    Haptics.selectionAsync().catch(() => {});
    router.push('/(app)/(tabs)/accounting');
  };

  const scopeOptions = SCOPES.map((value) => ({
    value,
    label:
      value === 'active' ? t('dashboard.scopeActive', 'Active')
      : value === 'allTime' ? t('dashboard.scopeAllTime', 'All-time')
      : t('dashboard.scopeThisMonth', 'This Month'),
  }));

  const flockHeadlineIsLive = scope === 'active';
  // Mortality stat value — chip-tint table (green / amber / red by rate).
  const mortalityFg = CHIP_TINTS[mortalityTone(flockStats.mortalityPct)][dark ? 'dark' : 'light'].fg;
  const profitColor = profitToneColor(financials.netProfit, tokens);
  const perBirdColor = profitToneColor(financials.profitPerBird, tokens);
  const finFmt = scope === 'active' ? fmtMoney : fmtCompactCurrency;

  return (
    <View>
      {/* Scope segmented control sits ABOVE the sections, like a global filter */}
      <View style={{ paddingHorizontal: 16, marginBottom: 12 }}>
        <SlidingSegmentedControl
          value={scope}
          onChange={setScope}
          options={scopeOptions}
          bordered
        />
      </View>

      {/* Flock — same BatchKpiCard recipe as Net Profit (headline + 3 icon stats; mortality only in stat row) */}
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
        onPress={goBatches}
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
                  valueColor: mortalityFg,
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
                  valueColor: mortalityFg,
                },
              ]
        }
      />

      {/* Same Net Profit KPI card as Batch Overview / Farm Overview */}
      <BatchKpiCard
        title={t('batches.netProfit', 'Net Profit')}
        icon={DollarSign}
        headlineSuffix={currency}
        headlineSuffixSubscript
        headline={fmtMoney(financials.netProfit)}
        headlineColor={profitColor}
        subline={
          scope !== 'allTime' && financials.marginPct != null
            ? t('batches.margin', 'Margin {{pct}}%', { pct: financials.marginPct.toFixed(1) })
            : null
        }
        onPress={canOpenAccounting ? goAccounting : undefined}
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
            value: financials.profitPerBird != null ? fmtMoney(financials.profitPerBird) : '—',
            valueColor: perBirdColor,
          },
        ]}
      />
    </View>
  );
}
