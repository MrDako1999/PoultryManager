import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  Bird, DollarSign, TrendingUp, Receipt, Egg, Skull, ShoppingCart, Layers,
} from 'lucide-react';
import SegmentedControl from '@/components/ui/segmented-control';
import useCapabilities from '@/hooks/useCapabilities';
import useSettings from '@/hooks/useSettings';
import KpiHeroCard, {
  profitToneClass,
  mortalityToneClass,
} from '@/modules/broiler/components/KpiHeroCard';
import useBroilerDashboardStats from './useBroilerDashboardStats';

// Western digits everywhere (DESIGN_LANGUAGE.md §12.4) — never i18n.language
// for numerics. Numbers render identically across locales so support / ops
// can sanity-check data without a locale context switch.
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

// Compact integer formatter: K (floor thousands) and up to 3dp on millions
// with trailing zeros trimmed (e.g. 409K, 776K, 1.185M). Used for flock and
// all-time financials so headlines stay one line at narrow widths.
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
  if (!Number.isFinite(n)) return fmtMoney(0);
  if (n === 0) return fmtMoney(0);
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
  return fmtMoney(n);
};

// Keep deaths int up to 10k, then 1dp K (e.g. 10.4K). Avoids long death
// counts blowing out the mortality cell on busy dashboards.
function fmtMortalityDeathsForDisplay(deaths) {
  const n = Math.floor(Number(deaths || 0));
  if (n <= 10_000) return fmtInt(n);
  return `${trimFixedMantissa((n / 1000).toFixed(1))}K`;
}

// Mirror BroilerActiveBatches meta: `(-count) · pct%` when losses exist,
// just `pct%` otherwise.
function fmtFlockMortalityCountAndPct(deaths, mortalityPct) {
  const d = Number(deaths || 0);
  const pctStr = `${Number(mortalityPct || 0).toFixed(2)}%`;
  if (d > 0) return `(-${fmtMortalityDeathsForDisplay(d)}) · ${pctStr}`;
  return pctStr;
}

const SCOPES = ['active', 'allTime', 'thisMonth'];

export default function BroilerKpiHero() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const accounting = useSettings('accounting');
  const currency = accounting?.currency || 'AED';
  const { can } = useCapabilities();
  const canOpenAccounting = can('expense:read') || can('saleOrder:read');

  const [scope, setScope] = useState('active');
  const { flockStats, financials } = useBroilerDashboardStats(scope);

  // TODO(privacy): thread useFinancialPrivacyStore once the web store ships
  // (mobile uses it to mask money + force tone-neutral colours).

  const scopeOptions = SCOPES.map((value) => ({
    value,
    label:
      value === 'active' ? t('dashboard.scopeActive', 'Active')
      : value === 'allTime' ? t('dashboard.scopeAllTime', 'All-time')
      : t('dashboard.scopeThisMonth', 'This Month'),
  }));

  const flockHeadlineIsLive = scope === 'active';
  const mortalityClass = mortalityToneClass(flockStats.mortalityPct);
  const profitClass = profitToneClass(financials.netProfit);
  const perBirdClass = profitToneClass(financials.profitPerBird);
  const finFmt = scope === 'active' ? fmtMoney : fmtCompactCurrency;

  return (
    <div className="space-y-4">
      <SegmentedControl value={scope} onChange={setScope} options={scopeOptions} />

      {/* Flock */}
      <KpiHeroCard
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
        onClick={() => navigate('/dashboard/batches')}
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
                  valueColor: mortalityClass,
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
                  valueColor: mortalityClass,
                },
              ]
        }
      />

      {/* Net Profit */}
      <KpiHeroCard
        title={t('batches.netProfit', 'Net Profit')}
        icon={DollarSign}
        headline={fmtMoney(financials.netProfit)}
        headlineSuffix={currency}
        headlineColor={profitClass}
        subline={
          scope !== 'allTime' && financials.marginPct != null
            ? t('batches.margin', 'Margin {{pct}}%', { pct: financials.marginPct.toFixed(1) })
            : null
        }
        onClick={canOpenAccounting ? () => navigate('/dashboard/accounting') : undefined}
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
            value:
              financials.profitPerBird != null ? fmtMoney(financials.profitPerBird) : '—',
            valueColor: perBirdClass,
          },
        ]}
      />
    </div>
  );
}
