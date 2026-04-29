// TruckEntrySheet — single-step entry sheet for a truckEntry inside a
// processingJob. Required: vehiclePlate, supplier, expectedQty,
// truckPhoto (frontal). Optional: driver (contact), arrivedAt,
// unloadingStartedAt, unloadingCompletedAt, status, notes.
//
// Mirrors SourceSheet pattern — useOfflineMutation, useFormGuard,
// ConfirmDiscardDialog, react-hook-form + zod, SearchableSelect for
// supplier/driver with QuickAddBusinessSheet/QuickAddContactSheet
// inline. Photo upload uses the existing FileUpload component which
// internally calls storeBlob() so the photo is queued for upload via
// the standard mediaQueue when sync resumes.
import { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
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
import { useToast } from '@/components/ui/use-toast';
import { Loader2 } from 'lucide-react';
import SearchableSelect from '@/components/SearchableSelect';
import EnumButtonSelect from '@/components/EnumButtonSelect';
import FileUpload from '@/components/FileUpload';
import QuickAddBusinessSheet from '@/shared/sheets/QuickAddBusinessSheet';
import QuickAddContactSheet from '@/shared/sheets/QuickAddContactSheet';
import ConfirmDiscardDialog from '@/components/ConfirmDiscardDialog';
import useFormGuard from '@/hooks/useFormGuard';
import useLocalQuery from '@/hooks/useLocalQuery';
import useOfflineMutation from '@/hooks/useOfflineMutation';
import { parseNum, fmtInt, formatDateForInput, intInputHandler } from '@/lib/format';

const TRUCK_STATUSES = ['EXPECTED', 'ARRIVED', 'WAITING', 'UNLOADING', 'READY'];

const schema = z.object({
  supplier: z.string().min(1, 'Supplier is required'),
  vehiclePlate: z.string().min(1, 'Vehicle plate is required'),
  driver: z.string().optional(),
  expectedQty: z.string().optional().transform((v) => parseNum(v)),
  arrivedAt: z.string().optional(),
  unloadingStartedAt: z.string().optional(),
  unloadingCompletedAt: z.string().optional(),
  status: z.enum(TRUCK_STATUSES),
  notes: z.string().optional(),
});

const defaults = {
  supplier: '',
  vehiclePlate: '',
  driver: '',
  expectedQty: '',
  arrivedAt: '',
  unloadingStartedAt: '',
  unloadingCompletedAt: '',
  status: 'ARRIVED',
  notes: '',
};

function nowLocalISO() {
  const d = new Date();
  const offset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - offset).toISOString().slice(0, 16);
}

export default function TruckEntrySheet({ open, onOpenChange, jobId, editingTruck, onSuccess }) {
  const { t } = useTranslation();
  const { toast } = useToast();

  const [truckPhoto, setTruckPhoto] = useState(null);
  const [photoError, setPhotoError] = useState(false);

  const [qabOpen, setQabOpen] = useState(false);
  const [qabName, setQabName] = useState('');
  const [qacOpen, setQacOpen] = useState(false);
  const [qacName, setQacName] = useState('');

  const businesses = useLocalQuery('businesses');
  const contacts = useLocalQuery('contacts');

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: defaults,
  });

  const guard = useFormGuard(form.formState.isDirty);

  const businessOptions = useMemo(
    () => businesses
      .filter((b) => !b.deletedAt)
      .map((b) => ({ value: b._id, label: b.companyName })),
    [businesses],
  );

  const contactOptions = useMemo(
    () => contacts
      .filter((c) => !c.deletedAt)
      .map((c) => ({
        value: c._id,
        label: `${c.firstName || ''} ${c.lastName || ''}`.trim() || c.email || c.phone || '—',
        description: c.phone || c.email || '',
      })),
    [contacts],
  );

  const statusOptions = useMemo(
    () => TRUCK_STATUSES.map((s) => ({
      value: s,
      label: t(`trucks.statuses.${s}`, s),
    })),
    [t],
  );

  // Hydrate state on open.
  useEffect(() => {
    if (!open) return;
    guard.resetGuard();
    setPhotoError(false);
    if (editingTruck) {
      form.reset({
        supplier: typeof editingTruck.supplier === 'object' ? editingTruck.supplier?._id : editingTruck.supplier || '',
        vehiclePlate: editingTruck.vehiclePlate || '',
        driver: typeof editingTruck.driver === 'object' ? editingTruck.driver?._id : editingTruck.driver || '',
        expectedQty: editingTruck.expectedQty ? fmtInt(editingTruck.expectedQty) : '',
        arrivedAt: editingTruck.arrivedAt ? formatDateForInput(editingTruck.arrivedAt) : '',
        unloadingStartedAt: editingTruck.unloadingStartedAt
          ? new Date(editingTruck.unloadingStartedAt).toISOString().slice(0, 16)
          : '',
        unloadingCompletedAt: editingTruck.unloadingCompletedAt
          ? new Date(editingTruck.unloadingCompletedAt).toISOString().slice(0, 16)
          : '',
        status: editingTruck.status || 'ARRIVED',
        notes: editingTruck.notes || '',
      });
      setTruckPhoto(editingTruck.truckPhoto && typeof editingTruck.truckPhoto === 'object' ? editingTruck.truckPhoto : null);
    } else {
      form.reset({
        ...defaults,
        arrivedAt: nowLocalISO().slice(0, 10),
      });
      setTruckPhoto(null);
    }
    guard.armGuard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editingTruck?._id]);

  const closeSheet = () => {
    onOpenChange(false);
    form.reset(defaults);
    setTruckPhoto(null);
    setPhotoError(false);
    guard.resetGuard();
  };

  const tryClose = () => {
    if (guard.isDirty) guard.setConfirmOpen(true);
    else closeSheet();
  };

  const { mutate, isPending } = useOfflineMutation('truckEntries');

  const onSubmit = (formData) => {
    if (!truckPhoto?._id) {
      setPhotoError(true);
      toast({
        title: t('common.error'),
        description: t('trucks.truckPhotoRequired', 'A frontal photo of the truck is required.'),
        variant: 'destructive',
      });
      return;
    }

    const payload = {
      job: jobId,
      supplier: formData.supplier,
      vehiclePlate: formData.vehiclePlate.trim(),
      driver: formData.driver || null,
      expectedQty: formData.expectedQty || 0,
      arrivedAt: formData.arrivedAt
        ? new Date(formData.arrivedAt).toISOString()
        : null,
      unloadingStartedAt: formData.unloadingStartedAt
        ? new Date(formData.unloadingStartedAt).toISOString()
        : null,
      unloadingCompletedAt: formData.unloadingCompletedAt
        ? new Date(formData.unloadingCompletedAt).toISOString()
        : null,
      status: formData.status || 'ARRIVED',
      truckPhoto: truckPhoto._id,
      // Keep an existing sortation block intact when editing — this
      // sheet only owns the truck-identity fields. Sortation lives in
      // SortationSheet, which writes the same record's `sortation` sub-
      // object.
      sortation: editingTruck?.sortation || {
        doa: 0, condemnation: 0, bGrade: 0, shortage: 0,
        doaPhotos: [], condemnationPhotos: [], bGradePhotos: [],
      },
      notes: formData.notes || '',
    };

    mutate({
      action: editingTruck ? 'update' : 'create',
      id: editingTruck?._id,
      data: payload,
      mediaFields: ['truckPhoto'],
    }, {
      onSuccess: () => {
        toast({
          title: editingTruck
            ? t('trucks.truckUpdated', 'Truck updated')
            : t('trucks.truckCreated', 'Truck added'),
        });
        closeSheet();
        onSuccess?.();
      },
    });
  };

  return (
    <>
      <Sheet open={open} onOpenChange={(o) => !o && tryClose()}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>
              {editingTruck ? t('trucks.editTruck', 'Edit Truck') : t('trucks.addTruck', 'Add Truck')}
            </SheetTitle>
            <SheetDescription>
              {t('trucks.addTruckDesc', 'Log an inbound vehicle for this job.')}
            </SheetDescription>
          </SheetHeader>

          <ScrollArea className="flex-1">
            <form id="truck-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 px-6 py-4">

              {/* Truck photo — REQUIRED frontal image. Stored locally
                  via FileUpload -> storeBlob; the saved truckEntry just
                  references the temp media id and the sync engine
                  uploads later via uploadPendingMedia. */}
              <div className="space-y-2">
                <Label>
                  {t('trucks.truckPhoto', 'Frontal truck photo')}
                  <span className="text-destructive ms-1">*</span>
                </Label>
                <p className="text-xs text-muted-foreground">
                  {t('trucks.truckPhotoHint', 'Capture a clear frontal image of the truck for traceability.')}
                </p>
                <FileUpload
                  value={truckPhoto}
                  onUpload={(media) => {
                    setTruckPhoto(media);
                    setPhotoError(false);
                    guard.markDirty();
                  }}
                  onRemove={() => {
                    setTruckPhoto(null);
                    guard.markDirty();
                  }}
                  accept={{ 'image/*': ['.jpg', '.jpeg', '.png', '.webp'] }}
                  entityType="truckEntry"
                  entityId={editingTruck?._id}
                  category="processingJob"
                  mediaType="image"
                />
                {photoError ? (
                  <p className="text-sm text-destructive">
                    {t('trucks.truckPhotoRequired', 'A frontal photo of the truck is required.')}
                  </p>
                ) : null}
              </div>

              <Separator />

              <div className="space-y-2">
                <Label>
                  {t('trucks.supplier', 'Source supplier')}
                  <span className="text-destructive ms-1">*</span>
                </Label>
                <input type="hidden" {...form.register('supplier')} />
                <SearchableSelect
                  options={businessOptions}
                  value={form.watch('supplier')}
                  onChange={(val) => form.setValue('supplier', val, { shouldDirty: true })}
                  placeholder={t('trucks.selectSupplier', 'Select a business…')}
                  searchPlaceholder={t('common.search', 'Search…')}
                  emptyMessage={t('common.noResults', 'No results')}
                  createLabel={t('businesses.addBusiness', 'Add Business')}
                  onCreate={(name) => { setQabName(name || ''); setQabOpen(true); }}
                />
                {form.formState.errors.supplier && (
                  <p className="text-sm text-destructive">{form.formState.errors.supplier.message}</p>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="tr-plate">
                    {t('trucks.vehiclePlate', 'Vehicle plate')}
                    <span className="text-destructive ms-1">*</span>
                  </Label>
                  <Input id="tr-plate" {...form.register('vehiclePlate')} />
                  {form.formState.errors.vehiclePlate && (
                    <p className="text-sm text-destructive">{form.formState.errors.vehiclePlate.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tr-expected">{t('trucks.expectedQty', 'Expected birds')}</Label>
                  <Input
                    id="tr-expected"
                    inputMode="numeric"
                    {...form.register('expectedQty', { onChange: intInputHandler })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>{t('trucks.driver', 'Driver')}</Label>
                <input type="hidden" {...form.register('driver')} />
                <SearchableSelect
                  options={contactOptions}
                  value={form.watch('driver')}
                  onChange={(val) => form.setValue('driver', val, { shouldDirty: true })}
                  placeholder={t('trucks.selectDriver', 'Select a contact…')}
                  searchPlaceholder={t('common.search', 'Search…')}
                  emptyMessage={t('common.noResults', 'No results')}
                  createLabel={t('contacts.addContact', 'Add Contact')}
                  onCreate={(name) => { setQacName(name || ''); setQacOpen(true); }}
                />
              </div>

              <Separator />

              <div className="space-y-2">
                <Label>{t('trucks.statuses.ARRIVED', 'Status')}</Label>
                <input type="hidden" {...form.register('status')} />
                <EnumButtonSelect
                  options={statusOptions}
                  value={form.watch('status')}
                  onChange={(val) => form.setValue('status', val, { shouldDirty: true })}
                  columns={Math.min(5, statusOptions.length)}
                  compact
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="tr-arrived">{t('trucks.arrivedAt', 'Arrived at')}</Label>
                  <Input id="tr-arrived" type="datetime-local" {...form.register('arrivedAt')} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tr-ulstart">{t('trucks.unloadingStartedAt', 'Unloading started')}</Label>
                  <Input id="tr-ulstart" type="datetime-local" {...form.register('unloadingStartedAt')} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tr-ulend">{t('trucks.unloadingCompletedAt', 'Unloading completed')}</Label>
                  <Input id="tr-ulend" type="datetime-local" {...form.register('unloadingCompletedAt')} />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="tr-notes">{t('common.notes', 'Notes')}</Label>
                <Textarea id="tr-notes" rows={2} {...form.register('notes')} />
              </div>
            </form>
          </ScrollArea>

          <SheetFooter>
            <Button type="button" variant="outline" onClick={tryClose}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" form="truck-form" disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingTruck ? t('common.save') : t('common.create', 'Create')}
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
        onCreated={(biz) => form.setValue('supplier', biz._id, { shouldDirty: true })}
        initialName={qabName}
      />

      <QuickAddContactSheet
        open={qacOpen}
        onOpenChange={setQacOpen}
        onCreated={(c) => form.setValue('driver', c._id, { shouldDirty: true })}
        initialName={qacName}
      />
    </>
  );
}
