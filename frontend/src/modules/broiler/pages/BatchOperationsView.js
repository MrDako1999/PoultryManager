import { useState, useMemo, useEffect } from 'react';
import { useParams, useOutletContext, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/components/ui/card';
import { Home, ChevronsDownUp, ChevronsUpDown, Skull, ShieldCheck, AlertTriangle, Wheat, Droplets } from 'lucide-react';
import CollapsibleSection from '@/components/CollapsibleSection';
import ExpenseCategoryGroup from '@/modules/broiler/rows/ExpenseCategoryGroup';
import DailyLogRow from '@/modules/broiler/rows/DailyLogRow';
import DailyLogSheet from '@/modules/broiler/daily-log/DailyLogSheet';
import MortalityCharts from '@/modules/broiler/charts/MortalityCharts';
import ConsumptionCharts from '@/modules/broiler/charts/ConsumptionCharts';
import useLocalQuery from '@/hooks/useLocalQuery';
import { formatDateForInput } from '@/lib/format';

function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

export default function BatchOperationsView() {
  const { id } = useParams();
  const { batch } = useOutletContext();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const allLogs = useLocalQuery('dailyLogs', { batch: id });
  const houses = batch?.houses || [];

  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedHouseId, setSelectedHouseId] = useState(null);

  const logsByHouse = useMemo(() => {
    const map = {};
    allLogs.forEach((log) => {
      const houseId = typeof log.house === 'object' ? log.house._id : log.house;
      if (!map[houseId]) map[houseId] = [];
      map[houseId].push(log);
    });
    for (const key of Object.keys(map)) {
      map[key].sort((a, b) => new Date(b.date) - new Date(a.date) || a.logType.localeCompare(b.logType));
    }
    return map;
  }, [allLogs]);

  const groupByDate = (logs) => {
    const groups = {};
    logs.forEach((log) => {
      const dateKey = formatDateForInput(log.date);
      if (!groups[dateKey]) groups[dateKey] = { items: [], cycleDay: log.cycleDay };
      groups[dateKey].items.push(log);
    });
    return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a));
  };

  const dateCatKey = `ops-dates-${id}`;
  const [dateCatOpen, setDateCatOpen] = useState(() => {
    try { return JSON.parse(localStorage.getItem(dateCatKey) || '{}'); }
    catch { return {}; }
  });
  useEffect(() => {
    if (Object.keys(dateCatOpen).length > 0) {
      localStorage.setItem(dateCatKey, JSON.stringify(dateCatOpen));
    }
  }, [dateCatOpen, dateCatKey]);

  const toggleDateCat = (key) => setDateCatOpen((prev) => ({ ...prev, [key]: !(prev[key] ?? true) }));

  const mortalityStats = useMemo(() => {
    const totalInitial = houses.reduce((s, h) => s + (h.quantity || 0), 0);
    const deathLogs = allLogs.filter(
      (log) => log.logType === 'DAILY' && log.deaths != null && !log.deletedAt
    );
    const totalDeaths = deathLogs.reduce((s, log) => s + (log.deaths || 0), 0);
    const mortalityPct = totalInitial > 0 ? (totalDeaths / totalInitial) * 100 : 0;
    const survivalPct = 100 - mortalityPct;

    let worstHouse = null;
    if (houses.length) {
      const deathsByHouse = {};
      deathLogs.forEach((log) => {
        const hId = typeof log.house === 'object' ? log.house?._id : log.house;
        deathsByHouse[hId] = (deathsByHouse[hId] || 0) + (log.deaths || 0);
      });
      let worstRate = -1;
      houses.forEach((entry) => {
        const hId = typeof entry.house === 'object' ? entry.house?._id : entry.house;
        const hName = typeof entry.house === 'object' ? entry.house?.name : null;
        const qty = entry.quantity || 0;
        const deaths = deathsByHouse[hId] || 0;
        const rate = qty > 0 ? (deaths / qty) * 100 : 0;
        if (rate > worstRate) {
          worstRate = rate;
          worstHouse = { name: hName || '—', rate, deaths };
        }
      });
    }

    return { totalDeaths, mortalityPct, survivalPct, worstHouse, hasData: totalDeaths > 0 };
  }, [houses, allLogs]);

  const consumptionStats = useMemo(() => {
    const dailyLogs_ = allLogs.filter(
      (log) => log.logType === 'DAILY' && !log.deletedAt
    );
    const totalFeed = dailyLogs_.reduce((s, log) => s + (log.feedKg || 0), 0);
    const totalWater = dailyLogs_.reduce((s, log) => s + (log.waterLiters || 0), 0);
    const totalInitial = houses.reduce((s, h) => s + (h.quantity || 0), 0);
    const feedPerBird = totalInitial > 0 ? totalFeed / totalInitial : 0;
    const waterPerBird = totalInitial > 0 ? totalWater / totalInitial : 0;
    return { totalFeed, totalWater, feedPerBird, waterPerBird, hasData: totalFeed > 0 || totalWater > 0 };
  }, [houses, allLogs]);

  const openAdd = (houseId) => {
    setSelectedHouseId(houseId);
    setSheetOpen(true);
  };

  if (houses.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Home className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-lg font-semibold mb-2">{t('batches.selectHouses')}</h2>
        <p className="text-sm text-muted-foreground">{t('batches.operations.noEntriesDesc')}</p>
      </div>
    );
  }

  return (
    <>
      {mortalityStats.hasData && (
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4 mb-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-1">
                <Skull className="h-4 w-4 text-red-500" />
                <p className="text-xs text-muted-foreground">{t('charts.totalDeaths', 'Total Deaths')}</p>
              </div>
              <div className="text-2xl font-bold tabular-nums">{mortalityStats.totalDeaths.toLocaleString('en-US')}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <p className="text-xs text-muted-foreground">{t('charts.mortalityRate', 'Mortality Rate')}</p>
              </div>
              <div className="text-2xl font-bold tabular-nums">{mortalityStats.mortalityPct.toFixed(2)}%</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-1">
                <ShieldCheck className="h-4 w-4 text-emerald-500" />
                <p className="text-xs text-muted-foreground">{t('charts.survivalRate', 'Survival Rate')}</p>
              </div>
              <div className="text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{mortalityStats.survivalPct.toFixed(2)}%</div>
            </CardContent>
          </Card>
          {mortalityStats.worstHouse && (
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 mb-1">
                  <Home className="h-4 w-4 text-red-500" />
                  <p className="text-xs text-muted-foreground">{t('charts.worstHouse', 'Highest Mortality')}</p>
                </div>
                <div className="text-2xl font-bold truncate">{mortalityStats.worstHouse.name}</div>
                <p className="text-xs text-muted-foreground tabular-nums mt-0.5">
                  {mortalityStats.worstHouse.deaths.toLocaleString('en-US')} {t('charts.deaths', 'deaths')} ({mortalityStats.worstHouse.rate.toFixed(2)}%)
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <div className="mb-4">
        <MortalityCharts houses={houses} dailyLogs={allLogs} />
      </div>

      {consumptionStats.hasData && (
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4 mb-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-1">
                <Wheat className="h-4 w-4 text-amber-600" />
                <p className="text-xs text-muted-foreground">{t('charts.totalFeed', 'Total Feed')}</p>
              </div>
              <div className="text-2xl font-bold tabular-nums">{consumptionStats.totalFeed.toLocaleString('en-US')} kg</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-1">
                <Wheat className="h-4 w-4 text-amber-600/60" />
                <p className="text-xs text-muted-foreground">{t('charts.feedPerBird', 'Feed / Bird')}</p>
              </div>
              <div className="text-2xl font-bold tabular-nums">{consumptionStats.feedPerBird.toFixed(2)} kg</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-1">
                <Droplets className="h-4 w-4 text-blue-500" />
                <p className="text-xs text-muted-foreground">{t('charts.totalWater', 'Total Water')}</p>
              </div>
              <div className="text-2xl font-bold tabular-nums">{consumptionStats.totalWater.toLocaleString('en-US')} L</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-1">
                <Droplets className="h-4 w-4 text-blue-500/60" />
                <p className="text-xs text-muted-foreground">{t('charts.waterPerBird', 'Water / Bird')}</p>
              </div>
              <div className="text-2xl font-bold tabular-nums">{consumptionStats.waterPerBird.toFixed(2)} L</div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="mb-4">
        <ConsumptionCharts houses={houses} dailyLogs={allLogs} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {houses.map((entry) => {
          const houseId = typeof entry.house === 'object' ? entry.house._id : entry.house;
          const houseName = typeof entry.house === 'object'
            ? entry.house.name
            : `${t('batches.house')} ${houseId}`;
          const houseLogs = logsByHouse[houseId] || [];
          const dateGroups = groupByDate(houseLogs);

          const allDatesExpanded = dateGroups.every(([key]) => dateCatOpen[`${houseId}-${key}`] ?? true);
          const toggleAllDates = () => {
            const next = { ...dateCatOpen };
            dateGroups.forEach(([key]) => { next[`${houseId}-${key}`] = !allDatesExpanded; });
            setDateCatOpen(next);
          };

          return (
            <div key={houseId} className="space-y-4">
              <CollapsibleSection
                title={houseName}
                icon={Home}
                headerExtra={
                  <span className="inline-flex items-center rounded-full border bg-background/80 text-[10px] font-semibold tabular-nums text-muted-foreground">
                    <span className="px-1.5 py-0">{(entry.quantity || 0).toLocaleString('en-US')} {t('farms.birds')}</span>
                    <span className="w-px self-stretch bg-border" />
                    <span className="px-1.5 py-0">{houseLogs.length}</span>
                    {dateGroups.length > 1 && (
                      <>
                        <span className="w-px self-stretch bg-border" />
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={toggleAllDates}
                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleAllDates(); } }}
                          className="px-1 py-0.5 hover:bg-muted/60 rounded-r-full cursor-pointer transition-colors"
                        >
                          {allDatesExpanded
                            ? <ChevronsDownUp className="h-2.5 w-2.5" />
                            : <ChevronsUpDown className="h-2.5 w-2.5" />}
                        </span>
                      </>
                    )}
                  </span>
                }
                expandTo={`/dashboard/batches/${id}/performance/${houseId}`}
                onAdd={() => openAdd(houseId)}
                persistKey={`batch-${id}-ops-${houseId}`}
              >
                {dateGroups.map(([dateKey, { items, cycleDay }]) => (
                  <ExpenseCategoryGroup
                    key={dateKey}
                    label={formatDate(dateKey)}
                    pills={[
                      ...(cycleDay ? [{ value: t('batches.operations.cycleDay', { day: cycleDay }) }] : []),
                      { value: items.length },
                    ]}
                    open={dateCatOpen[`${houseId}-${dateKey}`] ?? true}
                    onToggle={() => toggleDateCat(`${houseId}-${dateKey}`)}
                  >
                    {items.map((log) => (
                      <DailyLogRow
                        key={log._id}
                        log={log}
                        t={t}
                        onClick={() => navigate(`/dashboard/batches/${id}/performance/${houseId}/${log._id}`)}
                      />
                    ))}
                  </ExpenseCategoryGroup>
                ))}
              </CollapsibleSection>
            </div>
          );
        })}
      </div>

      <DailyLogSheet
        open={sheetOpen}
        onOpenChange={(open) => { if (!open) setSheetOpen(false); }}
        batchId={id}
        houseId={selectedHouseId}
        editingLog={null}
        batch={batch}
        onSuccess={() => {}}
      />
    </>
  );
}
