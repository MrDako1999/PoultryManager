import { useState, useMemo, useEffect } from 'react';
import { useParams, useOutletContext, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Home, ChevronsDownUp, ChevronsUpDown, Skull, Heart, TrendingDown,
  Wheat, Droplets, Activity,
} from 'lucide-react';
import CollapsibleSection from '@/components/CollapsibleSection';
import ExpenseCategoryGroup from '@/modules/broiler/rows/ExpenseCategoryGroup';
import DailyLogRow from '@/modules/broiler/rows/DailyLogRow';
import DailyLogSheet from '@/modules/broiler/daily-log/DailyLogSheet';
import MortalityCharts from '@/modules/broiler/charts/MortalityCharts';
import ConsumptionCharts from '@/modules/broiler/charts/ConsumptionCharts';
import useLocalQuery from '@/hooks/useLocalQuery';
import { formatDateForInput } from '@/lib/format';
import KpiHeroCard, {
  mortalityToneClass,
} from '@/modules/broiler/components/KpiHeroCard';

const fmtInt = (val) => Number(val || 0).toLocaleString('en-US');

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

  // Cycle days drives the avg-daily-deaths denominator. Mirrors the
  // mobile BatchPerformanceTab — one elapsed day for batches that
  // started today (so we never divide by zero) and a floor so we
  // don't fractional-divide on partial days.
  const cycleDays = useMemo(() => {
    if (!batch?.startDate) return 0;
    const start = new Date(batch.startDate);
    return Math.max(1, Math.floor((Date.now() - start) / 86400000));
  }, [batch?.startDate]);

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

    const avgDailyDeaths = cycleDays > 0 ? totalDeaths / cycleDays : 0;

    return { totalDeaths, mortalityPct, survivalPct, worstHouse, avgDailyDeaths, totalInitial, hasData: totalDeaths > 0 };
  }, [houses, allLogs, cycleDays]);

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

  const mortColor = mortalityToneClass(mortalityStats.mortalityPct);
  const worstColor = mortalityStats.worstHouse
    ? mortalityToneClass(mortalityStats.worstHouse.rate)
    : null;

  return (
    <>
      {/* Mobile-parity Mortality KPI card — replaces the four flat
          Total Deaths / Rate / Survival / Worst House boxes. The
          headline carries the absolute number toned by severity; the
          subline restates the rate against placed birds; survival,
          worst-house (with rate sub-value) and avg-daily-deaths fill
          the 3-cell stat grid. */}
      {mortalityStats.hasData && (
        <div className="mb-4">
          <KpiHeroCard
            title={t('batches.mortalitySummary', 'Mortality')}
            icon={Skull}
            headline={fmtInt(mortalityStats.totalDeaths)}
            headlineColor={mortalityStats.totalDeaths > 0 ? mortColor : undefined}
            subline={
              mortalityStats.totalInitial > 0
                ? `${t('batches.totalDeaths', 'Deaths').toLowerCase()}  \u00b7  ${mortalityStats.mortalityPct.toFixed(2)}%`
                : t('batches.totalDeaths', 'Deaths').toLowerCase()
            }
            sublineColor={mortalityStats.totalInitial > 0 ? mortColor : undefined}
            stats={[
              {
                icon: Heart,
                label: t('batches.survivalRate', 'Survival'),
                value: `${mortalityStats.survivalPct.toFixed(2)}%`,
                valueColor: 'text-success',
              },
              {
                icon: Home,
                label: t('batches.worstHouse', 'Worst House'),
                value: mortalityStats.worstHouse?.name || '\u2014',
                subValue: mortalityStats.worstHouse
                  ? `${mortalityStats.worstHouse.rate.toFixed(2)}%`
                  : null,
                subValueColor: worstColor,
              },
              {
                icon: TrendingDown,
                label: t('batches.avgDailyDeaths', 'Avg Daily'),
                value: mortalityStats.avgDailyDeaths >= 10
                  ? fmtInt(mortalityStats.avgDailyDeaths)
                  : mortalityStats.avgDailyDeaths.toFixed(1),
              },
            ]}
          />
        </div>
      )}

      <div className="mb-4">
        <MortalityCharts houses={houses} dailyLogs={allLogs} />
      </div>

      {/* Mobile-parity Consumption KPI card — collapses the four
          Feed / Feed-per-bird / Water / Water-per-bird tiles into one
          card. Feed is the headline (the bigger of the two numbers in
          almost every batch), water joins it as a stat with its
          per-bird ratio as a subValue. Feed/bird sits beside it for
          the equivalent ratio cross-reference. */}
      {consumptionStats.hasData && (
        <div className="mb-4">
          <KpiHeroCard
            title={t('batches.consumptionSummary', 'Consumption')}
            icon={Activity}
            headline={fmtCompactKg(consumptionStats.totalFeed)}
            subline={mortalityStats.totalInitial > 0
              ? t('batches.feedPerBirdShort', '{{value}} kg/bird', {
                  value: consumptionStats.feedPerBird.toFixed(2),
                })
              : null}
            stats={[
              {
                icon: Wheat,
                label: t('batches.feedPerBird', 'Feed / Bird'),
                value: `${consumptionStats.feedPerBird.toFixed(2)} kg`,
              },
              {
                icon: Droplets,
                label: t('batches.totalWater', 'Water'),
                value: fmtCompactL(consumptionStats.totalWater),
              },
              {
                icon: Droplets,
                label: t('batches.waterPerBird', 'Water / Bird'),
                value: `${consumptionStats.waterPerBird.toFixed(2)} L`,
              },
            ]}
          />
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
