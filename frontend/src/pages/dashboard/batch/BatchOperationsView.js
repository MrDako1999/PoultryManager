import { useState, useMemo, useEffect } from 'react';
import { useParams, useOutletContext, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Home, ChevronsDownUp, ChevronsUpDown } from 'lucide-react';
import CollapsibleSection from '@/components/CollapsibleSection';
import ExpenseCategoryGroup from '@/components/rows/ExpenseCategoryGroup';
import DailyLogRow from '@/components/rows/DailyLogRow';
import DailyLogSheet from '@/components/daily-log/DailyLogSheet';
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
                    <span className="px-1.5 py-0">{(entry.quantity || 0).toLocaleString()} {t('farms.birds')}</span>
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
                expandTo={`/dashboard/batches/${id}/operations/${houseId}`}
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
                        onClick={() => navigate(`/dashboard/batches/${id}/operations/${houseId}/${log._id}`)}
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
