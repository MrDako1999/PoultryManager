import { useState, useMemo } from 'react';
import { useOutletContext, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Card, CardContent,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Truck, Building2, User } from 'lucide-react';
import useLocalQuery from '@/hooks/useLocalQuery';
import useCapabilities from '@/hooks/useCapabilities';
import TruckEntrySheet from '@/modules/slaughterhouse/sheets/TruckEntrySheet';

const fmtInt = (v) => Number(v || 0).toLocaleString('en-US');

// Index tab inside a job — list the trucks attached, with the add CTA.
// Sortation lives in its own tab; this view is just the manifest of
// inbound vehicles + their basic identity (plate + driver + supplier).
export default function JobTrucksView() {
  const { id } = useParams();
  const { t } = useTranslation();
  const { truckEntries = [] } = useOutletContext() || {};
  const { can } = useCapabilities();
  const canCreate = can('truckEntry:create');

  const businesses = useLocalQuery('businesses');
  const contacts = useLocalQuery('contacts');

  const businessesById = useMemo(
    () => Object.fromEntries(businesses.map((b) => [b._id, b])),
    [businesses],
  );
  const contactsById = useMemo(
    () => Object.fromEntries(contacts.map((c) => [c._id, c])),
    [contacts],
  );

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingTruck, setEditingTruck] = useState(null);

  const visibleTrucks = useMemo(
    () => truckEntries.filter((tr) => !tr.deletedAt)
      .sort((a, b) => {
        const aT = a.arrivedAt ? new Date(a.arrivedAt).getTime() : 0;
        const bT = b.arrivedAt ? new Date(b.arrivedAt).getTime() : 0;
        return aT - bT;
      }),
    [truckEntries],
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {t('processingJobs.trucks_other', '{{count}} trucks', { count: visibleTrucks.length })}
        </p>
        {canCreate ? (
          <Button size="sm" className="gap-1.5" onClick={() => { setEditingTruck(null); setSheetOpen(true); }}>
            <Plus className="h-3.5 w-3.5" />
            {t('trucks.addTruck', 'Add Truck')}
          </Button>
        ) : null}
      </div>

      {visibleTrucks.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <div className="mx-auto mb-4 inline-flex rounded-full bg-muted p-4">
              <Truck className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="mb-1 text-lg font-semibold">{t('trucks.noTrucks', 'No trucks added yet')}</h3>
            <p className="mx-auto mb-4 max-w-sm text-sm text-muted-foreground">
              {t('trucks.noTrucksDesc', 'Add the first truck for this job.')}
            </p>
            {canCreate ? (
              <Button size="sm" className="gap-1.5" onClick={() => { setEditingTruck(null); setSheetOpen(true); }}>
                <Plus className="h-3.5 w-3.5" />
                {t('trucks.addTruck', 'Add Truck')}
              </Button>
            ) : null}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0 divide-y">
            {visibleTrucks.map((tr) => {
              const supplierId = typeof tr.supplier === 'object' ? tr.supplier?._id : tr.supplier;
              const driverId = typeof tr.driver === 'object' ? tr.driver?._id : tr.driver;
              const supplier = businessesById[supplierId];
              const driver = contactsById[driverId];
              return (
                <button
                  key={tr._id}
                  type="button"
                  onClick={() => { setEditingTruck(tr); setSheetOpen(true); }}
                  className="w-full text-left flex items-center gap-3 px-4 py-3 hover:bg-accent/50 transition-colors"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted shrink-0">
                    <Truck className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="font-medium truncate">{tr.vehiclePlate || '—'}</p>
                      {tr.status ? (
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground border rounded-full px-1.5 py-0">
                          {t(`trucks.statuses.${tr.status}`, tr.status)}
                        </span>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5 flex-wrap">
                      {supplier?.companyName ? (
                        <span className="flex items-center gap-1 truncate">
                          <Building2 className="h-3 w-3 shrink-0" />
                          <span className="truncate">{supplier.companyName}</span>
                        </span>
                      ) : null}
                      {driver?.firstName ? (
                        <span className="flex items-center gap-1 truncate">
                          <User className="h-3 w-3 shrink-0" />
                          <span className="truncate">{driver.firstName} {driver.lastName || ''}</span>
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-medium tabular-nums">
                      {fmtInt(tr.expectedQty)}
                    </p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                      {t('trucks.expectedQty', 'Expected birds').toLowerCase()}
                    </p>
                  </div>
                </button>
              );
            })}
          </CardContent>
        </Card>
      )}

      <TruckEntrySheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        jobId={id}
        editingTruck={editingTruck}
      />
    </div>
  );
}
