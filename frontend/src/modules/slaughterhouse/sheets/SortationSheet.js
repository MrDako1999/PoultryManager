// SortationSheet — single-step sheet to log per-truck sortation
// (DOA / condemned / B-grade / shortage) using the TallyCounter UX.
//
// Reads the live truckEntry from Dexie, mutates only the `sortation`
// sub-object so other fields (vehicle, driver, expectedQty, photos)
// stay intact. Photos are required when any tally goes above zero;
// the save button refuses until each non-zero counter has at least one
// photo attached. Photos are uploaded via MultiFileUpload through the
// same storeBlob -> mediaQueue path the rest of the module uses.
import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter,
} from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, Truck } from 'lucide-react';
import useLocalRecord from '@/hooks/useLocalRecord';
import useOfflineMutation from '@/hooks/useOfflineMutation';
import useFormGuard from '@/hooks/useFormGuard';
import ConfirmDiscardDialog from '@/components/ConfirmDiscardDialog';
import MultiFileUpload from '@/components/MultiFileUpload';
import TallyCounter from '@/modules/slaughterhouse/components/TallyCounter';

const fmtInt = (v) => Number(v || 0).toLocaleString('en-US');

export default function SortationSheet({ open, onOpenChange, jobId, truckId, onSuccess }) {
  const { t } = useTranslation();
  const { toast } = useToast();

  const truck = useLocalRecord('truckEntries', truckId);

  const [doa, setDoa] = useState(0);
  const [condemnation, setCondemnation] = useState(0);
  const [bGrade, setBGrade] = useState(0);
  const [shortage, setShortage] = useState(0);
  const [doaPhotos, setDoaPhotos] = useState([]);
  const [condemnationPhotos, setCondemnationPhotos] = useState([]);
  const [bGradePhotos, setBGradePhotos] = useState([]);
  const [readyForLine, setReadyForLine] = useState(false);

  const guard = useFormGuard(false);
  const { mutate, isPending } = useOfflineMutation('truckEntries');

  // Hydrate from the truck record on open.
  useEffect(() => {
    if (!open || !truck) return;
    guard.resetGuard();
    const s = truck.sortation || {};
    setDoa(Number(s.doa) || 0);
    setCondemnation(Number(s.condemnation) || 0);
    setBGrade(Number(s.bGrade) || 0);
    setShortage(Number(s.shortage) || 0);
    setDoaPhotos(Array.isArray(s.doaPhotos) ? s.doaPhotos : []);
    setCondemnationPhotos(Array.isArray(s.condemnationPhotos) ? s.condemnationPhotos : []);
    setBGradePhotos(Array.isArray(s.bGradePhotos) ? s.bGradePhotos : []);
    setReadyForLine(truck.status === 'READY' || !!truck.unloadingCompletedAt);
    guard.armGuard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, truck?._id]);

  const expected = Number(truck?.expectedQty) || 0;
  const losses = doa + condemnation + bGrade + shortage;
  const netToLine = expected - losses;

  const closeSheet = () => {
    onOpenChange(false);
    guard.resetGuard();
  };

  const tryClose = () => {
    if (guard.isDirty) guard.setConfirmOpen(true);
    else closeSheet();
  };

  const photoErrors = useMemo(() => {
    const errs = [];
    if (doa > 0 && doaPhotos.length === 0) errs.push('doa');
    if (condemnation > 0 && condemnationPhotos.length === 0) errs.push('condemnation');
    if (bGrade > 0 && bGradePhotos.length === 0) errs.push('bGrade');
    return errs;
  }, [doa, doaPhotos, condemnation, condemnationPhotos, bGrade, bGradePhotos]);

  const onSave = () => {
    if (!truck) return;
    if (photoErrors.length > 0) {
      toast({
        title: t('common.error'),
        description: t(
          'sortation.photosRequiredHint',
          'Photo evidence is required for any non-zero count.',
        ),
        variant: 'destructive',
      });
      return;
    }

    const status = readyForLine ? 'READY' : truck.status === 'READY' ? 'UNLOADING' : (truck.status || 'UNLOADING');

    const payload = {
      sortation: {
        doa, condemnation, bGrade, shortage,
        doaPhotos: doaPhotos.map((m) => m._id),
        condemnationPhotos: condemnationPhotos.map((m) => m._id),
        bGradePhotos: bGradePhotos.map((m) => m._id),
      },
      status,
      unloadingCompletedAt: readyForLine
        ? (truck.unloadingCompletedAt || new Date().toISOString())
        : truck.unloadingCompletedAt || null,
    };

    mutate({
      action: 'update',
      id: truck._id,
      data: payload,
      mediaFields: [
        'sortation.doaPhotos',
        'sortation.condemnationPhotos',
        'sortation.bGradePhotos',
      ],
    }, {
      onSuccess: () => {
        toast({ title: t('sortation.saved', 'Sortation saved') });
        closeSheet();
        onSuccess?.();
      },
    });
  };

  if (!truck && open) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent>
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <>
      <Sheet open={open} onOpenChange={(o) => !o && tryClose()}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{t('sortation.title', 'Sortation')}</SheetTitle>
            <SheetDescription>
              {t('sortation.subtitle', 'Separate DOA, condemned, B-grade and shortage as you unload.')}
            </SheetDescription>
          </SheetHeader>

          <ScrollArea className="flex-1">
            <div className="space-y-4 px-6 py-4">

              {/* Truck identity strip — read-only context for the worker. */}
              <div className="flex items-center gap-3 rounded-lg border p-3 bg-muted/30">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted shrink-0">
                  <Truck className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{truck?.vehiclePlate || '—'}</p>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {fmtInt(expected)} {t('trucks.expectedQty', 'Expected birds').toLowerCase()}
                  </p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <TallyCounter
                  label={t('sortation.doa', 'DOA')}
                  value={doa}
                  onChange={(v) => { setDoa(v); guard.markDirty(); }}
                  photoCount={doaPhotos.length}
                />
                <TallyCounter
                  label={t('sortation.condemned', 'Condemned')}
                  value={condemnation}
                  onChange={(v) => { setCondemnation(v); guard.markDirty(); }}
                  photoCount={condemnationPhotos.length}
                />
                <TallyCounter
                  label={t('sortation.bGrade', 'B-grade')}
                  value={bGrade}
                  onChange={(v) => { setBGrade(v); guard.markDirty(); }}
                  photoCount={bGradePhotos.length}
                />
                <TallyCounter
                  label={t('sortation.shortage', 'Shortage')}
                  value={shortage}
                  onChange={(v) => { setShortage(v); guard.markDirty(); }}
                  photoCount={0}
                />
              </div>

              <Separator />

              <div className="rounded-lg border p-3 bg-muted/30 space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t('trucks.expectedQty', 'Expected birds')}</span>
                  <span className="tabular-nums">{fmtInt(expected)}</span>
                </div>
                {losses > 0 ? (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{t('reconciliation.lossesSubtotal', 'Losses')}</span>
                    <span className="tabular-nums text-destructive">-{fmtInt(losses)}</span>
                  </div>
                ) : null}
                <Separator className="my-1" />
                <div className="flex justify-between text-sm font-semibold">
                  <span>{t('sortation.netToLine', 'Net to line')}</span>
                  <span className="tabular-nums">{fmtInt(netToLine)}</span>
                </div>
              </div>

              <Separator />

              {/* Photo evidence — required when any non-zero count above. */}
              <div className="space-y-3">
                {doa > 0 ? (
                  <MultiFileUpload
                    label={t('sortation.doa', 'DOA') + ' — ' + t('sortation.photoHint', 'Photos')}
                    files={doaPhotos}
                    onAdd={(m) => setDoaPhotos((p) => [...p, m])}
                    onRemove={(i) => setDoaPhotos((p) => p.filter((_, idx) => idx !== i))}
                    entityType="truckEntry"
                    entityId={truck?._id}
                    category="truckEntry"
                    guardMarkDirty={guard.markDirty}
                  />
                ) : null}
                {condemnation > 0 ? (
                  <MultiFileUpload
                    label={t('sortation.condemned', 'Condemned') + ' — ' + t('sortation.photoHint', 'Photos')}
                    files={condemnationPhotos}
                    onAdd={(m) => setCondemnationPhotos((p) => [...p, m])}
                    onRemove={(i) => setCondemnationPhotos((p) => p.filter((_, idx) => idx !== i))}
                    entityType="truckEntry"
                    entityId={truck?._id}
                    category="truckEntry"
                    guardMarkDirty={guard.markDirty}
                  />
                ) : null}
                {bGrade > 0 ? (
                  <MultiFileUpload
                    label={t('sortation.bGrade', 'B-grade') + ' — ' + t('sortation.photoHint', 'Photos')}
                    files={bGradePhotos}
                    onAdd={(m) => setBGradePhotos((p) => [...p, m])}
                    onRemove={(i) => setBGradePhotos((p) => p.filter((_, idx) => idx !== i))}
                    entityType="truckEntry"
                    entityId={truck?._id}
                    category="truckEntry"
                    guardMarkDirty={guard.markDirty}
                  />
                ) : null}
              </div>

              <Separator />

              <label className="flex items-start gap-3 rounded-lg border p-3 cursor-pointer hover:bg-accent/50">
                <Switch
                  checked={readyForLine}
                  onCheckedChange={(v) => { setReadyForLine(v); guard.markDirty(); }}
                />
                <div className="space-y-0.5">
                  <p className="text-sm font-medium">
                    {t('trucks.statuses.READY', 'Ready for line')}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t('trucks.readyForLineHint', 'Marks unloading complete and lets the line start packing.')}
                  </p>
                </div>
              </label>

            </div>
          </ScrollArea>

          <SheetFooter>
            <Button type="button" variant="outline" onClick={tryClose}>
              {t('common.cancel')}
            </Button>
            <Button onClick={onSave} disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('sortation.save', 'Save Sortation')}
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
