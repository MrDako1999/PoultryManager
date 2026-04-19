import { Bird, Layers, TrendingUp } from 'lucide-react-native';
import useBroilerDashboardStats from './useBroilerDashboardStats';

const fmtInt = (val) => Number(val || 0).toLocaleString();

const fmtCompactCurrency = (val) => {
  const n = Number(val || 0);
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1_000_000) {
    return `${sign}${(abs / 1_000_000).toLocaleString(undefined, { maximumFractionDigits: 1 })}M`;
  }
  if (abs >= 1_000) {
    return `${sign}${(abs / 1_000).toLocaleString(undefined, { maximumFractionDigits: 1 })}K`;
  }
  return `${sign}${abs.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
};

/**
 * Returns a dashboard hero quick-stats row for the broiler module.
 *
 * Contract: returns an array of `{ key, icon, label, value, accent? }` objects
 * (or null/[] when no data is available). The dashboard shell renders these as
 * translucent pills inside the hero `heroBelow` slot.
 *
 * `accent` is an optional semantic flag: 'positive' | 'negative' | 'warning'.
 */
export default function useBroilerQuickStats({ currency = 'AED', t } = {}) {
  const { flockStats, financials, isLoading } = useBroilerDashboardStats('active');

  if (isLoading) return null;
  if (flockStats.initial === 0 && financials.totalRevenue === 0 && financials.totalExpenses === 0) {
    return [];
  }

  const stats = [];

  if (flockStats.cycleCount > 0) {
    stats.push({
      key: 'liveBirds',
      icon: Bird,
      label: t?.('dashboard.quickStats.liveBirds', 'live birds') || 'live birds',
      value: fmtInt(flockStats.liveBirds),
    });
    stats.push({
      key: 'activeBatches',
      icon: Layers,
      label: t?.('dashboard.quickStats.activeBatches', 'active batches') || 'active batches',
      value: fmtInt(flockStats.cycleCount),
    });
  }

  if (financials.totalRevenue > 0 || financials.totalExpenses > 0) {
    const profit = financials.netProfit;
    stats.push({
      key: 'netProfit',
      icon: TrendingUp,
      label: t?.('dashboard.quickStats.netProfit', 'net profit') || 'net profit',
      value: `${currency} ${fmtCompactCurrency(profit)}`,
      accent: profit < 0 ? 'negative' : 'positive',
    });
  }

  return stats.slice(0, 3);
}
