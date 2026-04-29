import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  Bird, ClipboardList, Truck, DollarSign, TrendingUp, Skull,
} from 'lucide-react';
import SegmentedControl from '@/components/ui/segmented-control';
import KpiHeroCard from '@/modules/broiler/components/KpiHeroCard';
import useSettings from '@/hooks/useSettings';
import useSlaughterhouseDashboardStats from './useSlaughterhouseDashboardStats';

const NUMERIC_LOCALE = 'en-US';

const fmtInt = (val) => Number(val || 0).toLocaleString(NUMERIC_LOCALE);

const fmtMoney = (val) => Number(val || 0).toLocaleString(NUMERIC_LOCALE, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function trimMantissa(s) {
  if (!s.includes('.')) return s;
  return s.replace(/\.?0+$/, '');
}

const fmtCompact = (val) => {
  const n = Number(val || 0);
  if (!Number.isFinite(n) || n === 0) return '0';
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${sign}${trimMantissa((abs / 1_000_000).toFixed(3))}M`;
  if (abs >= 1_000) return `${sign}${Math.floor(abs / 1_000).toLocaleString(NUMERIC_LOCALE)}K`;
  return `${sign}${fmtInt(abs)}`;
};

const SCOPES = ['today', 'week', 'month', 'allTime'];

export default function ProcessingKpiHero() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const accounting = useSettings('accounting');
  const currency = accounting?.currency || 'AED';

  const [scope, setScope] = useState('today');
  const stats = useSlaughterhouseDashboardStats(scope);

  const scopeOptions = SCOPES.map((value) => ({
    value,
    label:
      value === 'today' ? t('dashboard.scopeToday', 'Today')
      : value === 'week' ? t('dashboard.scopeThisWeek', 'This Week')
      : value === 'month' ? t('dashboard.scopeThisMonth', 'This Month')
      : t('dashboard.scopeAllTime', 'All-time'),
  }));

  const t_ = stats.throughput;
  const doaPct = t_.expectedQty > 0 ? (t_.doa / t_.expectedQty) * 100 : 0;
  const rejectPct = t_.expectedQty > 0 ? (t_.condemnation / t_.expectedQty) * 100 : 0;
  const yieldPct = t_.wholeBirdYieldPct != null ? t_.wholeBirdYieldPct : 0;
  const doaTone = doaPct >= 1 ? 'text-destructive' : doaPct >= 0.5 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400';

  return (
    <div className="space-y-4">
      <SegmentedControl value={scope} onChange={setScope} options={scopeOptions} />

      <KpiHeroCard
        title={t('processingJobs.title', 'Processing')}
        icon={ClipboardList}
        headline={fmtInt(t_.wholeBirdsPacked)}
        headlineSuffix={t('production.totalBirds', 'BIRDS').toUpperCase()}
        onClick={() => navigate('/dashboard/processing-jobs')}
        stats={[
          {
            icon: Truck,
            label: t('processingJobs.trucks', 'Trucks'),
            value: fmtInt(t_.truckCount),
          },
          {
            icon: Bird,
            label: t('reconciliation.expected', 'Expected'),
            value: fmtCompact(t_.expectedQty),
          },
          {
            icon: Skull,
            label: t('processingJobs.doa', 'DOA'),
            value: `${fmtInt(t_.doa)} · ${doaPct.toFixed(2)}%`,
            valueColor: doaTone,
          },
        ]}
      />

      <KpiHeroCard
        title={t('processingJobs.yield', 'Yield')}
        icon={TrendingUp}
        headline={`${yieldPct.toFixed(1)}%`}
        subline={
          t_.avgDressedKg != null
            ? t('reconciliation.yieldAvgDressedKg', 'Avg dressed weight') + ` ${t_.avgDressedKg.toFixed(2)} kg`
            : null
        }
        stats={[
          {
            icon: Bird,
            label: t('reconciliation.produced', 'Produced'),
            value: fmtCompact(t_.wholeBirdsPacked),
          },
          {
            icon: Bird,
            label: t('processingJobs.bGrade', 'B-grade'),
            value: fmtCompact(t_.bGrade),
          },
          {
            icon: Bird,
            label: t('processingJobs.condemned', 'Condemned'),
            value: `${fmtInt(t_.condemnation)} · ${rejectPct.toFixed(2)}%`,
          },
        ]}
      />

      <KpiHeroCard
        title={t('dashboard.processingIncome', 'Processing income')}
        icon={DollarSign}
        headline={fmtMoney(stats.financials.processingIncome)}
        headlineSuffix={currency}
        stats={[
          {
            icon: Truck,
            label: t('dashboard.doneToday', 'Done today'),
            value: fmtInt(stats.liveLine.doneToday.length),
          },
          {
            icon: ClipboardList,
            label: t('processingJobs.title', 'Jobs'),
            value: fmtInt(t_.jobCount),
          },
          {
            icon: Truck,
            label: t('handovers.title', 'Handovers'),
            value: fmtInt(stats.financials.handoverCount),
          },
        ]}
      />
    </div>
  );
}
