import { useState, useMemo, useEffect } from 'react';
import { useParams, useOutletContext, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Layers, Bird, Skull, DollarSign, Wheat, Droplets,
  Receipt, Calendar, Clock, MapPin, Building2, Home,
  ExternalLink, CheckCircle2, AlertTriangle, CircleDashed, CircleDot,
  FileText, ArrowRight,
} from 'lucide-react';
import CollapsibleSection from '@/components/CollapsibleSection';
import { DocRow, OtherDocsList, fmt, fmtDate } from '@/modules/broiler/details/shared';
import useLocalQuery from '@/hooks/useLocalQuery';
import useSettings from '@/hooks/useSettings';
import api from '@/lib/api';

const STATUS_CONFIG = {
  NEW: { icon: CircleDashed, color: 'text-muted-foreground', bg: 'bg-muted' },
  IN_PROGRESS: { icon: Clock, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-100 dark:bg-amber-900/30' },
  COMPLETE: { icon: CheckCircle2, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-100 dark:bg-emerald-900/30' },
  DELAYED: { icon: AlertTriangle, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-100 dark:bg-red-900/30' },
  OTHER: { icon: CircleDot, color: 'text-muted-foreground', bg: 'bg-muted' },
};

export default function FarmOverview() {
  const { farmId } = useParams();
  const { farm, houses } = useOutletContext();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const accounting = useSettings('accounting');
  const currency = accounting?.currency || 'AED';

  const [farmDocs, setFarmDocs] = useState(null);

  const allBatches = useLocalQuery('batches');
  const allDailyLogs = useLocalQuery('dailyLogs');
  const allSaleOrders = useLocalQuery('saleOrders');
  const allExpenses = useLocalQuery('expenses');

  useEffect(() => {
    let cancelled = false;
    api.get(`/farms/${farmId}`).then(({ data }) => {
      if (!cancelled) setFarmDocs(data);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [farmId]);

  const batches = useMemo(
    () => allBatches.filter((b) => {
      const fId = typeof b.farm === 'object' ? b.farm?._id : b.farm;
      return fId === farmId;
    }),
    [allBatches, farmId],
  );

  const batchIds = useMemo(() => new Set(batches.map((b) => b._id)), [batches]);

  const logsForFarm = useMemo(
    () => allDailyLogs.filter((l) => {
      const bId = typeof l.batch === 'object' ? l.batch?._id : l.batch;
      return batchIds.has(bId);
    }),
    [allDailyLogs, batchIds],
  );

  const salesForFarm = useMemo(
    () => allSaleOrders.filter((s) => {
      const bId = typeof s.batch === 'object' ? s.batch?._id : s.batch;
      return batchIds.has(bId);
    }),
    [allSaleOrders, batchIds],
  );

  const expensesForFarm = useMemo(
    () => allExpenses.filter((e) => {
      const bId = typeof e.batch === 'object' ? e.batch?._id : e.batch;
      return batchIds.has(bId);
    }),
    [allExpenses, batchIds],
  );

  const quickStats = useMemo(() => {
    let totalInitial = 0;
    let totalDeaths = 0;
    let totalFeed = 0;
    let totalWater = 0;

    batches.forEach((b) => {
      (b.houses || []).forEach((h) => {
        totalInitial += h.quantity || 0;
      });
    });

    logsForFarm.forEach((l) => {
      totalDeaths += l.deaths || 0;
      totalFeed += l.feedKg || 0;
      totalWater += l.waterLiters || 0;
    });

    const totalRevenue = salesForFarm.reduce((s, o) => s + (o.totals?.grandTotal || 0), 0);
    const totalExpenses = expensesForFarm.reduce((s, e) => s + (e.totalAmount || 0), 0);

    const completedBatches = batches.filter((b) => b.status === 'COMPLETE');
    let totalDurationDays = 0;
    completedBatches.forEach((b) => {
      if (!b.startDate) return;
      const start = new Date(b.startDate);
      let end = new Date();
      const batchSales = salesForFarm.filter((s) => {
        const bId = typeof s.batch === 'object' ? s.batch?._id : s.batch;
        return bId === b._id;
      });
      if (batchSales.length > 0) {
        let last = start;
        batchSales.forEach((s) => {
          if (s.saleDate) {
            const d = new Date(s.saleDate);
            if (d > last) last = d;
          }
        });
        end = last;
      }
      totalDurationDays += Math.max(0, Math.floor((end - start) / 86400000));
    });

    return {
      totalBatches: batches.length,
      totalInitial,
      totalDeaths,
      mortalityRate: totalInitial > 0 ? ((totalDeaths / totalInitial) * 100).toFixed(2) : '0.00',
      totalRevenue,
      totalExpenses,
      totalFeed,
      totalWater,
      avgMortality: batches.length > 0
        ? ((totalDeaths / Math.max(totalInitial, 1)) * 100).toFixed(2)
        : '0.00',
      avgBatchDuration: completedBatches.length > 0
        ? Math.round(totalDurationDays / completedBatches.length)
        : 0,
    };
  }, [batches, logsForFarm, salesForFarm, expensesForFarm]);

  const batchHistory = useMemo(() => {
    const deathsByBatch = {};
    const revenueByBatch = {};

    logsForFarm.forEach((l) => {
      const bId = typeof l.batch === 'object' ? l.batch?._id : l.batch;
      deathsByBatch[bId] = (deathsByBatch[bId] || 0) + (l.deaths || 0);
    });

    salesForFarm.forEach((s) => {
      const bId = typeof s.batch === 'object' ? s.batch?._id : s.batch;
      revenueByBatch[bId] = (revenueByBatch[bId] || 0) + (s.totals?.grandTotal || 0);
    });

    return batches
      .map((b) => {
        const initial = (b.houses || []).reduce((s, h) => s + (h.quantity || 0), 0);
        const deaths = deathsByBatch[b._id] || 0;
        const mortality = initial > 0 ? ((deaths / initial) * 100).toFixed(1) : '0.0';
        const revenue = revenueByBatch[b._id] || 0;
        const dayCount = b.startDate
          ? Math.max(0, Math.floor((Date.now() - new Date(b.startDate)) / 86400000))
          : 0;

        return { ...b, initial, deaths, mortality, revenue, dayCount };
      })
      .sort((a, b) => new Date(b.startDate || 0) - new Date(a.startDate || 0));
  }, [batches, logsForFarm, salesForFarm]);

  const totalCapacity = houses.reduce((s, h) => s + (h.capacity || 0), 0);
  const businessName = farm.business?.companyName || '';
  const businessId = farm.business?._id || farm.business;

  const hasDocuments = farmDocs && (
    farmDocs.logo ||
    farmDocs.business?.trnCertificate ||
    farmDocs.business?.tradeLicense ||
    (farmDocs.otherDocs && farmDocs.otherDocs.length > 0)
  );

  return (
    <div className="space-y-5">
      {/* Quick Info KPIs */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        {[
          { label: t('farms.detail.totalBatches', 'Total Batches'), value: quickStats.totalBatches, icon: Layers, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-100 dark:bg-blue-900/30' },
          { label: t('farms.detail.birdsProcessed', 'Birds Processed'), value: quickStats.totalInitial.toLocaleString('en-US'), icon: Bird, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-100 dark:bg-amber-900/30' },
          { label: t('farms.detail.overallMortality', 'Mortality Rate'), value: `${quickStats.mortalityRate}%`, icon: Skull, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-100 dark:bg-red-900/30' },
          { label: t('farms.detail.totalRevenue', 'Total Revenue'), value: `${currency} ${fmt(quickStats.totalRevenue)}`, icon: DollarSign, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-100 dark:bg-emerald-900/30' },
        ].map((kpi) => (
          <Card key={kpi.label}>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2.5">
                <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${kpi.bg} shrink-0`}>
                  <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground truncate">{kpi.label}</p>
                  <p className="text-lg font-bold tabular-nums truncate">{kpi.value}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Farm Details + Houses */}
      <Card>
        <CardContent className="pt-5 pb-4">
          <h3 className="text-sm font-semibold mb-3">{t('farms.detail.farmInfo', 'Farm Information')}</h3>
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="space-y-3">
              {businessName && (
                <div className="space-y-0.5">
                  <p className="text-xs text-muted-foreground">{t('farms.linkedBusiness')}</p>
                  <button
                    onClick={() => businessId && navigate(`/dashboard/directory/businesses/${businessId}`)}
                    className="flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                  >
                    <Building2 className="h-3.5 w-3.5 shrink-0" />
                    {businessName}
                  </button>
                </div>
              )}

              <div className="space-y-0.5">
                <p className="text-xs text-muted-foreground">{t('farms.farmType')}</p>
                <p className="text-sm font-medium capitalize">{t(`farms.farmTypes.${farm.farmType || 'broiler'}`)}</p>
              </div>

              {farm.location?.placeName && (
                <div className="space-y-0.5">
                  <p className="text-xs text-muted-foreground">{t('farms.locationSection')}</p>
                  <div className="flex items-center gap-2">
                    <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <p className="text-sm truncate">{farm.location.placeName}</p>
                  </div>
                  {farm.location.lat != null && farm.location.lng != null && (
                    <a
                      href={`https://www.google.com/maps?q=${farm.location.lat},${farm.location.lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-1"
                    >
                      <ExternalLink className="h-3 w-3" />
                      {t('farms.detail.openInMaps', 'Open in Maps')}
                    </a>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">{t('farms.houses')}</p>
              {houses.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('farms.noHouses')}</p>
              ) : (
                <div className="space-y-1.5">
                  {houses.map((h) => (
                    <div key={h._id} className="flex items-center justify-between rounded-md border px-3 py-2">
                      <div className="flex items-center gap-2">
                        <Home className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-sm font-medium">{h.name}</span>
                      </div>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {(h.capacity || 0).toLocaleString('en-US')} {t('farms.birds')}
                      </span>
                    </div>
                  ))}
                  <div className="flex justify-end">
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {t('farms.totalCapacity', 'Total')}: {totalCapacity.toLocaleString('en-US')} {t('farms.birds')}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Documents */}
      {hasDocuments && (
        <Card>
          <CardContent className="pt-5 pb-2">
            <h3 className="text-sm font-semibold mb-2">{t('documents.otherDocs', 'Documents')}</h3>
            <div className="divide-y">
              {farmDocs.logo && <DocRow label={t('farms.logo')} doc={farmDocs.logo} />}
              {farmDocs.business?.trnCertificate && (
                <DocRow label={t('farms.trnCertificate')} doc={farmDocs.business.trnCertificate} />
              )}
              {farmDocs.business?.tradeLicense && (
                <DocRow label={t('farms.tradeLicense')} doc={farmDocs.business.tradeLicense} />
              )}
              <OtherDocsList docs={farmDocs.otherDocs} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* All-Time Statistics */}
      <Card>
        <CardContent className="pt-5 pb-4">
          <h3 className="text-sm font-semibold mb-3">{t('farms.detail.allTimeStats', 'All-Time Statistics')}</h3>
          <div className="grid gap-4 grid-cols-2 sm:grid-cols-3">
            {[
              { label: t('farms.detail.totalFeedConsumed', 'Feed Consumed'), value: `${quickStats.totalFeed.toLocaleString('en-US')} kg`, icon: Wheat },
              { label: t('farms.detail.totalWaterConsumed', 'Water Consumed'), value: `${quickStats.totalWater.toLocaleString('en-US')} L`, icon: Droplets },
              { label: t('farms.detail.totalDeaths', 'Total Deaths'), value: quickStats.totalDeaths.toLocaleString('en-US'), icon: Skull },
              { label: t('farms.detail.totalExpenses', 'Total Expenses'), value: `${currency} ${fmt(quickStats.totalExpenses)}`, icon: Receipt },
              { label: t('farms.detail.avgMortality', 'Avg Mortality'), value: `${quickStats.avgMortality}%`, icon: AlertTriangle },
              { label: t('farms.detail.avgBatchDuration', 'Avg Batch Duration'), value: quickStats.avgBatchDuration > 0 ? `${quickStats.avgBatchDuration} days` : '—', icon: Calendar },
            ].map((stat) => (
              <div key={stat.label} className="flex items-start gap-2.5">
                <stat.icon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground truncate">{stat.label}</p>
                  <p className="text-sm font-semibold tabular-nums">{stat.value}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Batch History */}
      <CollapsibleSection
        title={t('farms.detail.batchHistory', 'Batch History')}
        icon={Layers}
        count={batchHistory.length}
        defaultOpen
        persistKey={`farm-${farmId}-batches`}
        maxHeight={480}
      >
        {batchHistory.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <Layers className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground mb-3">
              {t('farms.detail.noBatches', 'No batches have been created for this farm yet.')}
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => navigate('/dashboard/batches', { state: { openNew: true } })}
            >
              {t('batches.addBatch')}
              <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
            </Button>
          </div>
        ) : (
          batchHistory.map((b) => {
            const status = STATUS_CONFIG[b.status] || STATUS_CONFIG.OTHER;
            const StatusIcon = status.icon;
            return (
              <button
                key={b._id}
                onClick={() => navigate(`/dashboard/batches/${b._id}`)}
                className="flex items-center gap-3 w-full px-4 py-3 text-left hover:bg-muted/30 transition-colors"
              >
                <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${status.bg} shrink-0`}>
                  <StatusIcon className={`h-4 w-4 ${status.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium truncate">{b.batchName}</span>
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${status.bg} ${status.color}`}>
                      {t(`batches.statuses.${b.status}`)}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5 flex-wrap">
                    <span>{fmtDate(b.startDate)}</span>
                    <span className="tabular-nums">{b.dayCount} days</span>
                    <span className="tabular-nums">{b.initial.toLocaleString('en-US')} birds</span>
                    <span className="tabular-nums">{b.mortality}%</span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                    {currency} {fmt(b.revenue)}
                  </p>
                </div>
              </button>
            );
          })
        )}
      </CollapsibleSection>
    </div>
  );
}
