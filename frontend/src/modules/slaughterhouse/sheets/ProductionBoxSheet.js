// ProductionBoxSheet — single-step entry sheet for one productionBox
// row (a packed batch of whole chickens at one weight band).
//
// Computes totalBirds (boxQty × birdsPerBox) and totalKg
// (totalBirds × weightBandGrams/1000) live. expiresAt auto-fills from
// packagedAt + settings.defaultShelfLifeDays.boxes; the operator can
// override. When allocation === 'STOCK', also creates a stockUnit
// record so cold-store views update immediately. ONLINE allocations
// skip the stockUnit (ONLINE is "shipping today"; stock that lives
// less than a shift doesn't need a separate inventory record).
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
import WeightBandChips from '@/modules/slaughterhouse/components/WeightBandChips';
import { computeExpiresAt } from '@/modules/slaughterhouse/lib/expiry';
import { buildBoxStockUnit } from '@/modules/slaughterhouse/lib/stockUnitFromProduction';

const ALLOCATIONS = ['ONLINE', 'STOCK'];

export default function ProductionBoxSheet({ open, onOpenChange, jobId, editingBox, onSuccess }) {
  const { t } = useTranslation();
  const { toast } = useToast();

  const settings = useSettings('slaughterhouse');
  const job = useLocalRecord('processingJobs', jobId);
  const storageLocations = useLocalQuery('storageLocations');

  const defaultBirdsPerBox = settings?.defaultBirdsPerBox || 10;

  const [weightBandGrams, setWeightBandGrams] = useState(null);
  const [boxQty, setBoxQty] = useState('');
  const [birdsPerBox, setBirdsPerBox] = useState(String(defaultBirdsPerBox));
  const [allocation, setAllocation] = useState('ONLINE');
  const [storageLocation, setStorageLocation] = useState('');
  const [packagedAt, setPackagedAt] = useState(todayStr());
  const [expiresAt, setExpiresAt] = useState('');
  const [expiryTouched, setExpiryTouched] = useState(false);

  const guard = useFormGuard(false);
  const { mutate: saveBox, isPending: isSavingBox } = useOfflineMutation('productionBoxes');
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

  // Hydrate on open (create or edit).
  useEffect(() => {
    if (!open) return;
    guard.resetGuard();
    if (editingBox) {
      setWeightBandGrams(editingBox.weightBandGrams ?? null);
      setBoxQty(editingBox.boxQty ? fmtInt(editingBox.boxQty) : '');
      setBirdsPerBox(editingBox.birdsPerBox ? fmtInt(editingBox.birdsPerBox) : String(defaultBirdsPerBox));
      setAllocation(editingBox.allocation || 'ONLINE');
      setStorageLocation(typeof editingBox.storageLocation === 'object' ? editingBox.storageLocation?._id : editingBox.storageLocation || '');
      setPackagedAt(formatDateForInput(editingBox.packagedAt) || todayStr());
      setExpiresAt(formatDateForInput(editingBox.expiresAt) || '');
      setExpiryTouched(true);
    } else {
      setWeightBandGrams(null);
      setBoxQty('');
      setBirdsPerBox(String(defaultBirdsPerBox));
      setAllocation('ONLINE');
      setStorageLocation('');
      setPackagedAt(todayStr());
      setExpiresAt('');
      setExpiryTouched(false);
    }
    guard.armGuard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editingBox?._id]);

  // Auto-fill expiry from packaged + default shelf life when not touched.
  useEffect(() => {
    if (expiryTouched || !packagedAt) return;
    const iso = computeExpiresAt({
      packagedAt: new Date(packagedAt).toISOString(),
      kind: 'boxes',
      slaughterhouseSettings: settings,
    });
    setExpiresAt(iso ? iso.slice(0, 10) : '');
  }, [packagedAt, expiryTouched, settings]);

  // Default the storage location to the first available (typically
  // the seeded "Freezer") whenever STOCK is selected without a value.
  useEffect(() => {
    if (allocation === 'STOCK' && !storageLocation && liveLocations.length > 0) {
      const freezer = liveLocations.find((l) => (l.name || '').toLowerCase() === 'freezer');
      setStorageLocation((freezer || liveLocations[0])._id);
    }
  }, [allocation, storageLocation, liveLocations]);

  // Compute live totals.
  const totals = useMemo(() => {
    const qty = parseNum(boxQty);
    const bpb = parseNum(birdsPerBox);
    const totalBirds = qty * bpb;
    const totalKg = totalBirds * ((Number(weightBandGrams) || 0) / 1000);
    return { totalBirds, totalKg };
  }, [boxQty, birdsPerBox, weightBandGrams]);

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

  // Ensure a storage location exists when the operator picks STOCK
  // and there are no locations yet (first-run case). Seeds "Freezer".
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
    if (!weightBandGrams) {
      toast({ title: t('common.error'), description: t('production.selectWeightBand', 'Pick a weight band'), variant: 'destructive' });
      return;
    }
    const qty = parseNum(boxQty);
    if (qty <= 0) {
      toast({ title: t('common.error'), description: t('production.boxQtyRequired', 'Box quantity must be greater than zero'), variant: 'destructive' });
      return;
    }

    const locId = await ensureLocation();

    const payload = {
      job: jobId,
      weightBandGrams: Number(weightBandGrams),
      boxQty: qty,
      birdsPerBox: parseNum(birdsPerBox) || defaultBirdsPerBox,
      totalBirds: totals.totalBirds,
      totalKg: totals.totalKg,
      allocation,
      storageLocation: allocation === 'STOCK' ? (locId || storageLocation || null) : null,
      packagedAt: packagedAt ? new Date(packagedAt).toISOString() : null,
      expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
    };

    saveBox({
      action: editingBox ? 'update' : 'create',
      id: editingBox?._id,
      data: payload,
    }, {
      onSuccess: (rec) => {
        // For STOCK allocations, also enqueue a stockUnit create so
        // the cold-store + handover screens see the unit immediately.
        // ONLINE skips this — ONLINE means "shipping today".
        if (!editingBox && payload.allocation === 'STOCK' && rec?._id) {
          const stockPayload = buildBoxStockUnit({
            box: { ...payload, _id: rec._id },
            job,
            storageLocations: liveLocations,
          });
          saveStockUnit({ action: 'create', data: stockPayload });
        }
        toast({
          title: editingBox
            ? t('production.boxUpdated', 'Box updated')
            : t('production.boxCreated', 'Box added'),
        });
        closeSheet();
        onSuccess?.();
      },
    });
  };

  const isPending = isSavingBox || isSavingStock;

  return (
    <>
      <Sheet open={open} onOpenChange={(o) => !o && tryClose()}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>
              {editingBox ? t('production.editBox', 'Edit box') : t('production.addBox', 'Add box')}
            </SheetTitle>
            <SheetDescription>
              {t('production.boxDesc', 'Log a packed batch of whole chickens at one weight band.')}
            </SheetDescription>
          </SheetHeader>

          <ScrollArea className="flex-1">
            <div className="space-y-4 px-6 py-4">

              <div className="space-y-2">
                <Label>{t('production.weightBand', 'Weight')}</Label>
                <WeightBandChips
                  value={weightBandGrams}
                  onChange={(v) => { setWeightBandGrams(v); guard.markDirty(); }}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="pb-qty">{t('production.boxes', 'Boxes')}</Label>
                  <Input
                    id="pb-qty"
                    inputMode="numeric"
                    value={boxQty}
                    onChange={(e) => { intInputHandler(e); setBoxQty(e.target.value); guard.markDirty(); }}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pb-bpb">{t('production.birdsPerBox', 'Birds / box')}</Label>
                  <Input
                    id="pb-bpb"
                    inputMode="numeric"
                    value={birdsPerBox}
                    onChange={(e) => { intInputHandler(e); setBirdsPerBox(e.target.value); guard.markDirty(); }}
                  />
                </div>
              </div>

              <div className="rounded-lg border p-3 bg-muted/30 space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t('production.totalBirds', 'Total birds')}</span>
                  <span className="tabular-nums font-medium">{fmtInt(totals.totalBirds)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t('production.totalKg', 'Total kg')}</span>
                  <span className="tabular-nums font-medium">{fmtDec(totals.totalKg)}</span>
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
                  <Label htmlFor="pb-pkg">{t('production.packagedAt', 'Packaged on')}</Label>
                  <Input
                    id="pb-pkg"
                    type="date"
                    value={packagedAt}
                    onChange={(e) => { setPackagedAt(e.target.value); guard.markDirty(); }}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pb-exp">{t('production.expiresAt', 'Expires on')}</Label>
                  <Input
                    id="pb-exp"
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
              {editingBox ? t('common.save') : t('common.create', 'Create')}
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
