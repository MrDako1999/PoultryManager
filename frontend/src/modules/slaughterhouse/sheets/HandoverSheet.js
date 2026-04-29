// HandoverSheet — outbound truck dispatch. Composes:
//   - customer + vehicle plate + driver (single-step entry)
//   - line-item picker drawing from live stockUnits (filterable by
//     allocation==='ONLINE' and ownership)
//   - loading photos + driver SignaturePad
//   - generates a draft handover record + handoverItem records; the
//     three docs (delivery note, sales invoice, handover receipt) are
//     stubbed for now (no PDF generation in v1; backend will own this
//     when it lands).
import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter,
} from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, Truck, Building2, User } from 'lucide-react';
import SearchableSelect from '@/components/SearchableSelect';
import MultiFileUpload from '@/components/MultiFileUpload';
import QuickAddBusinessSheet from '@/shared/sheets/QuickAddBusinessSheet';
import QuickAddContactSheet from '@/shared/sheets/QuickAddContactSheet';
import ConfirmDiscardDialog from '@/components/ConfirmDiscardDialog';
import useFormGuard from '@/hooks/useFormGuard';
import useLocalQuery from '@/hooks/useLocalQuery';
import useOfflineMutation from '@/hooks/useOfflineMutation';
import { storeBlob } from '@/lib/mediaQueue';
import SignaturePad from '@/modules/slaughterhouse/components/SignaturePad';
import ExpiryBadge from '@/modules/slaughterhouse/components/ExpiryBadge';
import { formatBandLabel } from '@/modules/slaughterhouse/lib/defaultWeightBands';

const fmtKg = (v) => Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtInt = (v) => Number(v || 0).toLocaleString('en-US');

export default function HandoverSheet({ open, onOpenChange, onSuccess }) {
  const { t } = useTranslation();
  const { toast } = useToast();

  const [customer, setCustomer] = useState('');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [driver, setDriver] = useState('');
  const [notes, setNotes] = useState('');
  const [selected, setSelected] = useState({});       // stockUnitId -> qty
  const [loadingPhotos, setLoadingPhotos] = useState([]);
  const [signature, setSignature] = useState(null);   // { blob, file }
  const [signatureMedia, setSignatureMedia] = useState(null); // local media after storeBlob
  const [signatureError, setSignatureError] = useState(false);

  const [qabOpen, setQabOpen] = useState(false);
  const [qabName, setQabName] = useState('');
  const [qacOpen, setQacOpen] = useState(false);
  const [qacName, setQacName] = useState('');

  const businesses = useLocalQuery('businesses');
  const contacts = useLocalQuery('contacts');
  const stockUnits = useLocalQuery('stockUnits');
  const storageLocations = useLocalQuery('storageLocations');

  const guard = useFormGuard(false);
  const { mutate: saveHandover, isPending: isSavingHandover } = useOfflineMutation('handovers');
  const { mutate: saveItem } = useOfflineMutation('handoverItems');
  const { mutate: saveStockUnit } = useOfflineMutation('stockUnits');

  const businessesById = useMemo(
    () => Object.fromEntries(businesses.map((b) => [b._id, b])),
    [businesses],
  );
  const locationsById = useMemo(
    () => Object.fromEntries(storageLocations.map((l) => [l._id, l])),
    [storageLocations],
  );

  const businessOptions = useMemo(
    () => businesses.filter((b) => !b.deletedAt).map((b) => ({ value: b._id, label: b.companyName })),
    [businesses],
  );
  const contactOptions = useMemo(
    () => contacts.filter((c) => !c.deletedAt).map((c) => ({
      value: c._id,
      label: `${c.firstName || ''} ${c.lastName || ''}`.trim() || c.email || c.phone || '—',
      description: c.phone || c.email || '',
    })),
    [contacts],
  );

  // Available stock = live + qtyAvailable > 0. Optionally scoped to
  // the selected customer's owned units (toll-processing model).
  const availableStock = useMemo(() => {
    const live = stockUnits.filter((u) => !u.deletedAt && (Number(u.qtyAvailable) || 0) > 0);
    if (!customer) return live;
    return live.filter((u) => {
      const owner = typeof u.owner === 'object' ? u.owner?._id : u.owner;
      return !owner || owner === customer;
    });
  }, [stockUnits, customer]);

  const totalKg = useMemo(() => {
    let kg = 0;
    for (const su of availableStock) {
      const qty = Number(selected[su._id]) || 0;
      if (qty > 0) {
        const perUnitKg = (Number(su.weightKg) || 0) / Math.max(1, Number(su.qtyAvailable) || 1);
        kg += perUnitKg * qty;
      }
    }
    return kg;
  }, [selected, availableStock]);

  const totalItems = useMemo(
    () => Object.values(selected).reduce((sum, q) => sum + (Number(q) || 0), 0),
    [selected],
  );

  // Hydrate / reset on open.
  useEffect(() => {
    if (!open) return;
    guard.resetGuard();
    setCustomer('');
    setVehiclePlate('');
    setDriver('');
    setNotes('');
    setSelected({});
    setLoadingPhotos([]);
    setSignature(null);
    setSignatureMedia(null);
    setSignatureError(false);
    guard.armGuard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Persist signature to mediaBlobs as soon as the user lifts their
  // finger so the saved handover always references a real (local) id.
  useEffect(() => {
    if (!signature?.file) return;
    let cancelled = false;
    (async () => {
      const media = await storeBlob(signature.file);
      if (!cancelled) {
        setSignatureMedia(media);
        setSignatureError(false);
      }
    })();
    return () => { cancelled = true; };
  }, [signature?.file]);

  const closeSheet = () => {
    onOpenChange(false);
    guard.resetGuard();
  };

  const tryClose = () => {
    if (guard.isDirty) guard.setConfirmOpen(true);
    else closeSheet();
  };

  const setQty = (suId, raw) => {
    const num = Math.max(0, parseInt(raw || '0', 10));
    setSelected((p) => ({ ...p, [suId]: num }));
    guard.markDirty();
  };

  const toggle = (suId, su) => {
    setSelected((p) => {
      const next = { ...p };
      if (next[suId]) delete next[suId];
      else next[suId] = Number(su.qtyAvailable) || 1;
      return next;
    });
    guard.markDirty();
  };

  const onSave = async () => {
    if (!customer) {
      toast({ title: t('common.error'), description: t('handovers.customerRequired', 'Pick a customer'), variant: 'destructive' });
      return;
    }
    if (totalItems <= 0) {
      toast({ title: t('common.error'), description: t('handovers.itemsRequired', 'Add at least one item'), variant: 'destructive' });
      return;
    }
    if (!signatureMedia?._id) {
      setSignatureError(true);
      toast({
        title: t('common.error'),
        description: t('handovers.signatureRequired', 'A driver signature is required to confirm dispatch.'),
        variant: 'destructive',
      });
      return;
    }

    const handoverPayload = {
      customer,
      vehiclePlate: vehiclePlate.trim(),
      driver: driver || null,
      dispatchedAt: new Date().toISOString(),
      status: 'DISPATCHED',
      signature: signatureMedia._id,
      loadingPhotos: loadingPhotos.map((m) => m._id),
      // Doc generation is a backend responsibility — leave nulls and
      // the cold-store dashboard surfaces "docs pending" until the
      // backend lands.
      deliveryNote: null,
      salesInvoice: null,
      handoverReceipt: null,
      totals: { totalKg, totalItems },
      notes: notes || '',
    };

    saveHandover({
      action: 'create',
      data: handoverPayload,
      mediaFields: ['signature', 'loadingPhotos'],
    }, {
      onSuccess: (handoverRec) => {
        if (!handoverRec?._id) return;
        // Create one handoverItem per selected stockUnit + decrement
        // the source unit's qtyAvailable. Both writes go through the
        // standard offline queue.
        for (const su of availableStock) {
          const qty = Number(selected[su._id]) || 0;
          if (qty <= 0) continue;
          const perUnitKg = (Number(su.weightKg) || 0) / Math.max(1, Number(su.qtyAvailable) || 1);
          const lineTotalKg = perUnitKg * qty;

          saveItem({
            action: 'create',
            data: {
              handover: handoverRec._id,
              stockUnit: su._id,
              qty,
              unitPrice: 0,
              lineTotal: 0,
              weightKg: lineTotalKg,
            },
          });

          const remaining = Math.max(0, (Number(su.qtyAvailable) || 0) - qty);
          const remainingKg = perUnitKg * remaining;
          saveStockUnit({
            action: 'update',
            id: su._id,
            data: {
              qtyAvailable: remaining,
              weightKg: remainingKg,
            },
          });
        }
        toast({ title: t('handovers.handoverCreated', 'Handover created') });
        closeSheet();
        onSuccess?.();
      },
    });
  };

  const isPending = isSavingHandover;

  return (
    <>
      <Sheet open={open} onOpenChange={(o) => !o && tryClose()}>
        <SheetContent className="sm:max-w-2xl">
          <SheetHeader>
            <SheetTitle>{t('handovers.newHandover', 'New Handover')}</SheetTitle>
            <SheetDescription>{t('handovers.subtitle', 'Outbound dispatches to wholesalers and traders.')}</SheetDescription>
          </SheetHeader>

          <ScrollArea className="flex-1">
            <div className="space-y-4 px-6 py-4">

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>
                    {t('handovers.customer', 'Customer')}
                    <span className="text-destructive ms-1">*</span>
                  </Label>
                  <SearchableSelect
                    options={businessOptions}
                    value={customer}
                    onChange={(v) => { setCustomer(v); guard.markDirty(); }}
                    placeholder={t('handovers.customer', 'Customer')}
                    searchPlaceholder={t('common.search', 'Search…')}
                    emptyMessage={t('common.noResults', 'No results')}
                    createLabel={t('businesses.addBusiness', 'Add Business')}
                    onCreate={(name) => { setQabName(name || ''); setQabOpen(true); }}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ho-plate">{t('handovers.vehiclePlate', 'Vehicle plate')}</Label>
                  <Input
                    id="ho-plate"
                    value={vehiclePlate}
                    onChange={(e) => { setVehiclePlate(e.target.value); guard.markDirty(); }}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>{t('handovers.driver', 'Driver')}</Label>
                <SearchableSelect
                  options={contactOptions}
                  value={driver}
                  onChange={(v) => { setDriver(v); guard.markDirty(); }}
                  placeholder={t('trucks.selectDriver', 'Select a contact…')}
                  searchPlaceholder={t('common.search', 'Search…')}
                  emptyMessage={t('common.noResults', 'No results')}
                  createLabel={t('contacts.addContact', 'Add Contact')}
                  onCreate={(name) => { setQacName(name || ''); setQacOpen(true); }}
                />
              </div>

              <Separator />

              {/* Items picker — checklist of all live stockUnits, with
                  per-unit qty inline. Decremented on save. */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>
                    {t('handovers.items', 'Items loaded')}
                    <span className="text-destructive ms-1">*</span>
                  </Label>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {fmtInt(totalItems)} {t('handovers.totalItems', 'items').toLowerCase()}
                    {' · '}
                    {fmtKg(totalKg)} {t('handovers.totalKg', 'kg').toLowerCase()}
                  </span>
                </div>
                <div className="rounded-lg border divide-y max-h-[300px] overflow-y-auto">
                  {availableStock.length === 0 ? (
                    <div className="p-6 text-center text-xs text-muted-foreground">
                      {t('handovers.noAvailableStock', 'No stock available for this customer.')}
                    </div>
                  ) : availableStock.map((su) => {
                    const qty = Number(selected[su._id]) || 0;
                    const checked = qty > 0;
                    const max = Number(su.qtyAvailable) || 0;
                    const loc = locationsById[typeof su.location === 'object' ? su.location?._id : su.location];
                    const owner = businessesById[typeof su.owner === 'object' ? su.owner?._id : su.owner];
                    const sourceLabel = su.sourceType === 'box'
                      ? formatBandLabel(su.weightBandGrams)
                      : (su.partType || su.sourceType);
                    return (
                      <div key={su._id} className="flex items-center gap-3 px-3 py-2">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={() => toggle(su._id, su)}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="text-sm font-medium truncate">{sourceLabel}</p>
                            <ExpiryBadge expiresAt={su.expiresAt} />
                          </div>
                          <p className="text-xs text-muted-foreground tabular-nums truncate">
                            {fmtInt(max)} avail · {fmtKg(su.weightKg)} kg
                            {loc?.name ? ` · ${loc.name}` : ''}
                            {owner?.companyName ? ` · ${owner.companyName}` : ''}
                          </p>
                        </div>
                        <Input
                          inputMode="numeric"
                          value={checked ? String(qty) : ''}
                          onChange={(e) => setQty(su._id, e.target.value)}
                          disabled={!checked}
                          className="w-20 h-8 text-sm tabular-nums"
                          placeholder="0"
                          max={max}
                          min={0}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label>{t('handovers.loadingPhotos', 'Loading photos')}</Label>
                <MultiFileUpload
                  label={undefined}
                  files={loadingPhotos}
                  onAdd={(m) => setLoadingPhotos((p) => [...p, m])}
                  onRemove={(i) => setLoadingPhotos((p) => p.filter((_, idx) => idx !== i))}
                  entityType="handover"
                  category="handover"
                  guardMarkDirty={guard.markDirty}
                />
              </div>

              <SignaturePad
                label={t('handovers.signature', 'Driver signature')}
                required
                onChange={(sig) => {
                  setSignature(sig);
                  if (!sig) setSignatureMedia(null);
                  guard.markDirty();
                }}
              />
              {signatureError && !signatureMedia ? (
                <p className="text-sm text-destructive">
                  {t('handovers.signatureRequired', 'A driver signature is required to confirm dispatch.')}
                </p>
              ) : null}

              <div className="space-y-2">
                <Label htmlFor="ho-notes">{t('common.notes', 'Notes')}</Label>
                <Textarea id="ho-notes" rows={2} value={notes} onChange={(e) => { setNotes(e.target.value); guard.markDirty(); }} />
              </div>

            </div>
          </ScrollArea>

          <SheetFooter>
            <Button type="button" variant="outline" onClick={tryClose}>
              {t('common.cancel')}
            </Button>
            <Button onClick={onSave} disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('handovers.confirm', 'Confirm & Save')}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <ConfirmDiscardDialog
        open={guard.confirmOpen}
        onOpenChange={guard.setConfirmOpen}
        onDiscard={closeSheet}
      />

      <QuickAddBusinessSheet
        open={qabOpen}
        onOpenChange={setQabOpen}
        onCreated={(b) => setCustomer(b._id)}
        initialName={qabName}
      />

      <QuickAddContactSheet
        open={qacOpen}
        onOpenChange={setQacOpen}
        onCreated={(c) => setDriver(c._id)}
        initialName={qacName}
      />
    </>
  );
}
