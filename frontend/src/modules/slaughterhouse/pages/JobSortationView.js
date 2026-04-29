import { useState, useMemo } from 'react';
import { useOutletContext, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ClipboardCheck, Pencil } from 'lucide-react';
import SortationSheet from '@/modules/slaughterhouse/sheets/SortationSheet';

const fmtInt = (v) => Number(v || 0).toLocaleString('en-US');

// Lists each truck with its current sortation totals + an Edit
// affordance that opens the SortationSheet focused on that truck.
// Sortation runs at the truck level (per the user spec) and aggregates
// roll up into the reconciliation tab.
export default function JobSortationView() {
  const { id, truckId } = useParams();
  const { t } = useTranslation();
  const { truckEntries = [] } = useOutletContext() || {};

  const [sheetOpen, setSheetOpen] = useState(!!truckId);
  const [activeTruckId, setActiveTruckId] = useState(truckId || null);

  const visibleTrucks = useMemo(
    () => truckEntries.filter((tr) => !tr.deletedAt)
      .sort((a, b) => {
        const aT = a.arrivedAt ? new Date(a.arrivedAt).getTime() : 0;
        const bT = b.arrivedAt ? new Date(b.arrivedAt).getTime() : 0;
        return aT - bT;
      }),
    [truckEntries],
  );

  const openFor = (tId) => {
    setActiveTruckId(tId);
    setSheetOpen(true);
  };

  if (visibleTrucks.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <div className="mx-auto mb-4 inline-flex rounded-full bg-muted p-4">
            <ClipboardCheck className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="mb-1 text-lg font-semibold">{t('sortation.noSortation', 'No sortation logged yet')}</h3>
          <p className="mx-auto mb-4 max-w-sm text-sm text-muted-foreground">
            {t('sortation.noSortationDesc', 'Open a truck to log dead-on-arrival, condemned, B-grade and shortage counts.')}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">{t('sortation.subtitle', 'Separate DOA, condemned, B-grade and shortage as you unload.')}</p>

      <Card>
        <CardContent className="p-0 divide-y">
          {visibleTrucks.map((tr) => {
            const s = tr.sortation || {};
            const expected = Number(tr.expectedQty) || 0;
            const losses = (Number(s.doa) || 0)
              + (Number(s.condemnation) || 0)
              + (Number(s.bGrade) || 0)
              + (Number(s.shortage) || 0);
            const netToLine = expected - losses;
            return (
              <button
                key={tr._id}
                type="button"
                onClick={() => openFor(tr._id)}
                className="w-full text-left flex items-center gap-3 px-4 py-3 hover:bg-accent/50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{tr.vehiclePlate || '—'}</p>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5 flex-wrap tabular-nums">
                    <span>{t('sortation.doa', 'DOA')}: {fmtInt(s.doa)}</span>
                    <span>{t('sortation.condemned', 'Condemned')}: {fmtInt(s.condemnation)}</span>
                    <span>{t('sortation.bGrade', 'B-grade')}: {fmtInt(s.bGrade)}</span>
                    <span>{t('sortation.shortage', 'Shortage')}: {fmtInt(s.shortage)}</span>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-semibold tabular-nums">{fmtInt(netToLine)}</p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                    {t('sortation.netToLine', 'Net to line')}
                  </p>
                </div>
                <Pencil className="h-4 w-4 text-muted-foreground shrink-0" />
              </button>
            );
          })}
        </CardContent>
      </Card>

      <SortationSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        jobId={id}
        truckId={activeTruckId}
      />
    </div>
  );
}
