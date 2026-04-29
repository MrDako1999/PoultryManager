// Shared sheet body for ProductionPortionSheet + ProductionGibletSheet.
// Both differ only in the chip strip (portion vs giblet types), the
// table they write to (productionPortions vs productionGiblets), the
// shelf life key, and a couple of label strings — so we hoist
// everything into one parametrised internal component and keep the
// two exported sheets as thin wrappers.
import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter,
} from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/components/ui/use-toast';
import { Loader2 } from 'lucide-react';
import EnumButtonSelect from '@/components/EnumButtonSelect';
import SearchableSelect from '@/components/SearchableSelect';
import ConfirmDiscardDialog from '@/components/ConfirmDiscardDialog';
import useFormGuard from '@/hooks/useFormGuard';
import useLocalQuery from '@/hooks/useLocalQuery';
import useLocalRecord from '@/hooks/useLocalRecord';
import useOfflineMutation from '@/hooks/useOfflineMutation';
import useSettings from '@/hooks/useSettings';
import { parseNum, fmtInt, fmtDec, intInputHandler, decimalInputHandler, formatDateForInput, todayStr } from '@/lib/format';
import PartTypeChips from '@/modules/slaughterhouse/components/PartTypeChips';
import { computeExpiresAt } from '@/modules/slaughterhouse/lib/expiry';
import { buildPortionStockUnit } from '@/modules/slaughterhouse/lib/stockUnitFromProduction';

const ALLOCATIONS = ['ONLINE', 'STOCK'];

export default function ProductionTraySheet({
  open, onOpenChange, jobId, editingRow, onSuccess,
  // Configuration:
  table,                  // 'productionPortions' | 'productionGiblets'
  kind,                   // 'portion' | 'giblet'
  shelfLifeKey,           // 'portions' | 'giblets'
  chipKind,               // forwarded to PartTypeChips: 'portion' | 'giblet'
  titles,                 // { create, edit, desc }
}) {
  const { t } = useTranslation();
  const { toast } = useToast();

  const settings = useSettings('slaughterhouse');
  const job = useLocalRecord('processingJobs', jobId);
  const storageLocations = useLocalQuery('storageLocations');

  const [partType, setPartType] = useState('');
  const [trayCount, setTrayCount] = useState('');
  const [weightPerTray, setWeightPerTray] = useState('');
  const [allocation, setAllocation] = useState('ONLINE');
  const [storageLocation, setStorageLocation] = useState('');
  const [packagedAt, setPackagedAt] = useState(todayStr());
  const [expiresAt, setExpiresAt] = useState('');
  const [expiryTouched, setExpiryTouched] = useState(false);

  const guard = useFormGuard(false);
  const { mutate: saveRow, isPending: isSavingRow } = useOfflineMutation(table);
  const { mutate: saveStockUnit, isPending: isSavingStock } = useOfflineMutation('stockUnits');
  const { mutate: saveLocation } = useOfflineMutation('storageLocations');

  const liveLocations = useMemo(
    () => storageLocations.filter((l) => !l.deletedAt),
    [storageLocations],
  );
  const locationOptions = useMemo(
    () => liveLocations.map((l) => ({ value: l._id, label: l.name })),
    [liveLocations],
  );

  // Hydrate.
  useEffect(() => {
    if (!open) return;
    guard.resetGuard();
    if (editingRow) {
      setPartType(editingRow.partType || '');
      setTrayCount(editingRow.trayCount ? fmtInt(editingRow.trayCount) : '');
      setWeightPerTray(editingRow.weightPerTray ? fmtDec(editingRow.weightPerTray) : '');
      setAllocation(editingRow.allocation || 'ONLINE');
      setStorageLocation(typeof editingRow.storageLocation === 'object' ? editingRow.storageLocation?._id : editingRow.storageLocation || '');
      setPackagedAt(formatDateForInput(editingRow.packagedAt) || todayStr());
      setExpiresAt(formatDateForInput(editingRow.expiresAt) || '');
      setExpiryTouched(true);
    } else {
      setPartType('');
      setTrayCount('');
      setWeightPerTray('');
      setAllocation('ONLINE');
      setStorageLocation('');
      setPackagedAt(todayStr());
      setExpiresAt('');
      setExpiryTouched(false);
    }
    guard.armGuard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editingRow?._id]);

  // Auto-fill expiry when not touched.
  useEffect(() => {
    if (expiryTouched || !packagedAt) return;
    const iso = computeExpiresAt({
      packagedAt: new Date(packagedAt).toISOString(),
      kind: shelfLifeKey,
      slaughterhouseSettings: settings,
    });
    setExpiresAt(iso ? iso.slice(0, 10) : '');
  }, [packagedAt, expiryTouched, settings, shelfLifeKey]);

  // Default storage location.
  useEffect(() => {
    if (allocation === 'STOCK' && !storageLocation && liveLocations.length > 0) {
      const freezer = liveLocations.find((l) => (l.name || '').toLowerCase() === 'freezer');
      setStorageLocation((freezer || liveLocations[0])._id);
    }
  }, [allocation, storageLocation, liveLocations]);

  const totalKg = useMemo(
    () => parseNum(trayCount) * parseNum(weightPerTray),
    [trayCount, weightPerTray],
  );

  const closeSheet = () => {
    onOpenChange(false);
    guard.resetGuard();
  };

  const tryClose = () => {
    if (guard.isDirty) guard.setConfirmOpen(true);
    else closeSheet();
  };

  const allocationOptions = useMemo(
    () => ALLOCATIONS.map((a) => ({
      value: a,
      label: t(`production.allocations.${a}`, a),
    })),
    [t],
  );

  const ensureLocation = async () => {
    if (allocation !== 'STOCK') return null;
    if (storageLocation) return storageLocation;
    if (liveLocations.length > 0) return liveLocations[0]._id;
    return new Promise((resolve) => {
      saveLocation({
        action: 'create',
        data: { name: 'Freezer', temperatureZone: 'FROZEN' },
      }, {
        onSuccess: (rec) => resolve(rec?._id || null),
        onError: () => resolve(null),
      });
    });
  };

  const onSave = async () => {
    if (!partType) {
      toast({ title: t('common.error'), description: t('production.partTypeRequired', 'Pick a type'), variant: 'destructive' });
      return;
    }
    const trays = parseNum(trayCount);
    if (trays <= 0) {
      toast({ title: t('common.error'), description: t('production.trayCountRequired', 'Tray count must be greater than zero'), variant: 'destructive' });
      return;
    }

    const locId = await ensureLocation();

    const payload = {
      job: jobId,
      partType,
      trayCount: trays,
      weightPerTray: parseNum(weightPerTray),
      totalKg,
      allocation,
      storageLocation: allocation === 'STOCK' ? (locId || storageLocation || null) : null,
      packagedAt: packagedAt ? new Date(packagedAt).toISOString() : null,
      expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
    };

    saveRow({
      action: editingRow ? 'update' : 'create',
      id: editingRow?._id,
      data: payload,
    }, {
      onSuccess: (rec) => {
        if (!editingRow && payload.allocation === 'STOCK' && rec?._id) {
          const stockPayload = buildPortionStockUnit({
            row: { ...payload, _id: rec._id },
            job,
            storageLocations: liveLocations,
            kind,
          });
          saveStockUnit({ action: 'create', data: stockPayload });
        }
        toast({
          title: editingRow
            ? t('production.rowUpdated', 'Updated')
            : t('production.rowCreated', 'Added'),
        });
        closeSheet();
        onSuccess?.();
      },
    });
  };

  const isPending = isSavingRow || isSavingStock;

  return (
    <>
      <Sheet open={open} onOpenChange={(o) => !o && tryClose()}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>
              {editingRow ? titles.edit : titles.create}
            </SheetTitle>
            <SheetDescription>{titles.desc}</SheetDescription>
          </SheetHeader>

          <ScrollArea className="flex-1">
            <div className="space-y-4 px-6 py-4">

              <div className="space-y-2">
                <Label>
                  {chipKind === 'giblet'
                    ? t('production.giblets', 'Giblets')
                    : t('production.portions', 'Portions')}
                </Label>
                <PartTypeChips
                  kind={chipKind}
                  value={partType}
                  onChange={(v) => { setPartType(v); guard.markDirty(); }}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="pt-trays">{t('production.trayCount', 'Trays')}</Label>
                  <Input
                    id="pt-trays"
                    inputMode="numeric"
                    value={trayCount}
                    onChange={(e) => { intInputHandler(e); setTrayCount(e.target.value); guard.markDirty(); }}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pt-kgpt">{t('production.weightPerTray', 'Kg / tray')}</Label>
                  <Input
                    id="pt-kgpt"
                    inputMode="decimal"
                    value={weightPerTray}
                    onChange={(e) => { decimalInputHandler(e); setWeightPerTray(e.target.value); guard.markDirty(); }}
                  />
                </div>
              </div>

              <div className="rounded-lg border p-3 bg-muted/30 space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t('production.totalKg', 'Total kg')}</span>
                  <span className="tabular-nums font-medium">{fmtDec(totalKg)}</span>
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label>{t('production.allocation', 'Destination')}</Label>
                <EnumButtonSelect
                  options={allocationOptions}
                  value={allocation}
                  onChange={(v) => { setAllocation(v); guard.markDirty(); }}
                  columns={2}
                />
              </div>

              {allocation === 'STOCK' ? (
                <div className="space-y-2">
                  <Label>{t('stock.byLocation', 'Location')}</Label>
                  <SearchableSelect
                    options={locationOptions}
                    value={storageLocation}
                    onChange={(v) => { setStorageLocation(v); guard.markDirty(); }}
                    placeholder={t('stock.byLocation', 'Location')}
                    searchPlaceholder={t('common.search', 'Search…')}
                    emptyMessage={t('common.noResults', 'No results')}
                  />
                </div>
              ) : null}

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="pt-pkg">{t('production.packagedAt', 'Packaged on')}</Label>
                  <Input
                    id="pt-pkg"
                    type="date"
                    value={packagedAt}
                    onChange={(e) => { setPackagedAt(e.target.value); guard.markDirty(); }}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pt-exp">{t('production.expiresAt', 'Expires on')}</Label>
                  <Input
                    id="pt-exp"
                    type="date"
                    value={expiresAt}
                    onChange={(e) => { setExpiresAt(e.target.value); setExpiryTouched(true); guard.markDirty(); }}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    {t('production.expiryAuto', 'Auto-set from settings; you can override.')}
                  </p>
                </div>
              </div>

            </div>
          </ScrollArea>

          <SheetFooter>
            <Button type="button" variant="outline" onClick={tryClose}>
              {t('common.cancel')}
            </Button>
            <Button onClick={onSave} disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingRow ? t('common.save') : t('common.create', 'Create')}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <ConfirmDiscardDialog
        open={guard.confirmOpen}
        onOpenChange={guard.setConfirmOpen}
        onDiscard={closeSheet}
      />
    </>
  );
}
