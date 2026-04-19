/**
 * SourceSheet — self-contained sheet for creating / editing a Source entry.
 *
 * CONTRACT (entity-sheet pattern):
 *  - Props: { open, onOpenChange, batchId, editingSource, stacked, onSuccess }
 *  - Owns its own form state (react-hook-form + Zod), guard, file uploads, and mutations.
 *  - Fetches reference data (businesses, accounting) via React Query (cache-deduped).
 *  - Calls `onSuccess()` after a successful create/update so the parent can
 *    invalidate list-level queries or refresh linked sheets.
 *  - `stacked` controls z-index when opened on top of another sheet (e.g. from ExpenseSheet).
 */
import { useState, useEffect, useMemo } from 'react';
import useOfflineMutation from '@/hooks/useOfflineMutation';
import useLocalQuery from '@/hooks/useLocalQuery';
import useSettings from '@/hooks/useSettings';
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
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/components/ui/use-toast';
import { Loader2 } from 'lucide-react';
import SearchableSelect from '@/components/SearchableSelect';
import EnumButtonSelect from '@/components/EnumButtonSelect';
import DocumentsManager from '@/components/DocumentsManager';
import MultiFileUpload from '@/components/MultiFileUpload';
import QuickAddBusinessSheet from '@/shared/sheets/QuickAddBusinessSheet';
import ConfirmDiscardDialog from '@/components/ConfirmDiscardDialog';
import useFormGuard from '@/hooks/useFormGuard';
import api from '@/lib/api';
import db from '@/lib/db';
import { parseNum, fmtInt, fmtDec, formatDateForInput, intInputHandler, decimalInputHandler } from '@/lib/format';
import { INVOICE_TYPES, INVOICE_TYPE_ICONS } from '@/lib/constants';

const sourceSchema = z.object({
  sourceFrom: z.string().optional(),
  invoiceType: z.enum(INVOICE_TYPES),
  taxInvoiceId: z.string().optional(),
  chicksRate: z.string().optional().transform((val) => parseNum(val)),
  quantityPurchased: z.string().optional().transform((val) => parseNum(val)),
  focPercentage: z.string().optional().transform((val) => parseNum(val)),
  totalChicks: z.string().optional().transform((val) => parseNum(val)),
  invoiceDate: z.string().optional(),
  deliveryDate: z.string().optional(),
}).superRefine((data, ctx) => {
  if (data.invoiceType === 'TAX_INVOICE' && !data.taxInvoiceId) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Invoice ID is required for Tax Invoice', path: ['taxInvoiceId'] });
  }
});

const sourceDefaults = {
  sourceFrom: '',
  invoiceType: 'TAX_INVOICE',
  taxInvoiceId: '',
  chicksRate: '',
  quantityPurchased: '',
  focPercentage: '',
  totalChicks: '',
  invoiceDate: '',
  deliveryDate: '',
};

export default function SourceSheet({ open, onOpenChange, batchId, editingSource, stacked, onSuccess }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [otherDocs, setOtherDocs] = useState([]);
  const [mediaMap, setMediaMap] = useState({});
  const [taxInvoiceDocs, setTaxInvoiceDocs] = useState([]);
  const [transferProofs, setTransferProofs] = useState([]);
  const [deliveryNoteDocs, setDeliveryNoteDocs] = useState([]);
  const [qabOpen, setQabOpen] = useState(false);
  const [qabName, setQabName] = useState('');

  const sourceForm = useForm({
    resolver: zodResolver(sourceSchema),
    defaultValues: sourceDefaults,
  });

  const guard = useFormGuard(sourceForm.formState.isDirty);

  const businesses = useLocalQuery('businesses');
  const accounting = useSettings('accounting');

  const vatRate = accounting?.vatRate ?? 5;

  const businessOptions = useMemo(
    () => businesses.map((b) => ({
      value: b._id,
      label: b.companyName,
      description: b.trnNumber ? `TRN: ${b.trnNumber}` : '',
    })),
    [businesses]
  );

  const invoiceTypeOptions = useMemo(
    () => INVOICE_TYPES.map((it) => ({ value: it, label: t(`batches.invoiceTypes.${it}`), icon: INVOICE_TYPE_ICONS[it] })),
    [t]
  );

  const watchQty = sourceForm.watch('quantityPurchased');
  const watchRate = sourceForm.watch('chicksRate');
  const watchFoc = sourceForm.watch('focPercentage');
  const watchInvoiceType = sourceForm.watch('invoiceType');

  const qtyNum = parseNum(watchQty);
  const rateNum = parseNum(watchRate);
  const focNum = parseNum(watchFoc);

  const subtotal = qtyNum * rateNum;
  const vat = watchInvoiceType === 'TAX_INVOICE' ? subtotal * (vatRate / 100) : 0;
  const grandTotal = subtotal + vat;
  const calcTotalChicks = Math.round(qtyNum * (1 + focNum / 100));

  useEffect(() => {
    if (!editingSource && open) {
      sourceForm.setValue('totalChicks', calcTotalChicks ? calcTotalChicks.toLocaleString('en-US') : '');
    }
  }, [calcTotalChicks, editingSource, open, sourceForm]);

  const resetFiles = () => {
    setTaxInvoiceDocs([]);
    setTransferProofs([]);
    setDeliveryNoteDocs([]);
  };

  const closeSheet = () => {
    onOpenChange(false);
    setOtherDocs([]);
    setMediaMap({});
    resetFiles();
    guard.resetGuard();
    sourceForm.reset(sourceDefaults);
  };

  const tryClose = () => {
    if (guard.isDirty) {
      guard.setConfirmOpen(true);
    } else {
      closeSheet();
    }
  };

  // Populate form when opening for edit
  useEffect(() => {
    if (!open || !editingSource) return;

    guard.resetGuard();
    sourceForm.reset({
      sourceFrom: editingSource.sourceFrom?._id || editingSource.sourceFrom || '',
      invoiceType: editingSource.invoiceType || 'TAX_INVOICE',
      taxInvoiceId: editingSource.taxInvoiceId || '',
      chicksRate: editingSource.chicksRate ? fmtDec(editingSource.chicksRate) : '',
      quantityPurchased: editingSource.quantityPurchased ? fmtInt(editingSource.quantityPurchased) : '',
      focPercentage: editingSource.focPercentage ? String(editingSource.focPercentage) : '',
      totalChicks: editingSource.totalChicks ? fmtInt(editingSource.totalChicks) : '',
      invoiceDate: formatDateForInput(editingSource.invoiceDate),
      deliveryDate: formatDateForInput(editingSource.deliveryDate),
    });

    (async () => {
      try {
        const { data: full } = await api.get(`/sources/${editingSource._id}`);
        setTaxInvoiceDocs(full.taxInvoiceDocs || []);
        setTransferProofs(full.transferProofs || []);
        setDeliveryNoteDocs(full.deliveryNoteDocs || []);
        const map = {};
        if (full.otherDocs) {
          full.otherDocs.forEach((doc) => {
            if (doc.media_id && typeof doc.media_id === 'object') {
              map[doc.media_id._id] = doc.media_id;
            }
          });
        }
        setMediaMap(map);
        setOtherDocs(
          (full.otherDocs || []).map((d) => ({
            name: d.name,
            media_id: d.media_id?._id ?? d.media_id,
          }))
        );
      } catch {
        setOtherDocs([]);
        setMediaMap({});
        resetFiles();
      }
      guard.armGuard();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editingSource?._id]);

  // Populate form when opening for create
  useEffect(() => {
    if (!open || editingSource) return;
    guard.resetGuard();
    setOtherDocs([]);
    setMediaMap({});
    resetFiles();
    sourceForm.reset(sourceDefaults);
    guard.armGuard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    const val = sourceForm.getValues('sourceFrom');
    if (!val || businesses.some(b => b._id === val)) return;
    db.idMap.get({ tempId: val, entityType: 'businesses' }).then(mapping => {
      if (mapping) sourceForm.setValue('sourceFrom', mapping.realId, { shouldDirty: true });
    });
  }, [businesses]); // eslint-disable-line react-hooks/exhaustive-deps

  const { mutate, isPending: isMutating } = useOfflineMutation('sources');

  const onSubmit = (formData) => {
    const payload = {
      batch: batchId,
      sourceFrom: formData.sourceFrom || null,
      invoiceType: formData.invoiceType || 'TAX_INVOICE',
      taxInvoiceId: formData.taxInvoiceId || '',
      chicksRate: formData.chicksRate || 0,
      quantityPurchased: formData.quantityPurchased || 0,
      focPercentage: formData.focPercentage || 0,
      totalChicks: formData.totalChicks || 0,
      subtotal,
      vatAmount: vat,
      grandTotal,
      invoiceDate: formData.invoiceDate || null,
      deliveryDate: formData.deliveryDate || null,
      taxInvoiceDocs: taxInvoiceDocs.map((m) => m._id),
      transferProofs: transferProofs.map((m) => m._id),
      deliveryNoteDocs: deliveryNoteDocs.map((m) => m._id),
      otherDocs,
    };

    mutate({
      action: editingSource ? 'update' : 'create',
      id: editingSource ? editingSource._id : undefined,
      data: payload,
      mediaFields: ['taxInvoiceDocs', 'transferProofs', 'deliveryNoteDocs'],
    }, {
      onSuccess: () => {
        toast({ title: editingSource ? t('batches.sourceUpdated') : t('batches.sourceCreated') });
        closeSheet();
        onSuccess?.();
      },
    });
  };

  return (
    <>
      <Sheet open={open} onOpenChange={(o) => !o && tryClose()}>
        <SheetContent className={stacked ? 'z-[60]' : ''}>
          <SheetHeader>
            <SheetTitle>{editingSource ? t('batches.editSource') : t('batches.addSource')}</SheetTitle>
            <SheetDescription>{editingSource ? t('batches.editSourceDesc') : t('batches.addSourceDesc')}</SheetDescription>
          </SheetHeader>
          <ScrollArea className="flex-1">
            <form id="source-form" onSubmit={sourceForm.handleSubmit(onSubmit)} className="space-y-4 px-6 py-4 overflow-hidden">
              <div className="space-y-2">
                <Label>{t('batches.sourceFrom')}</Label>
                <input type="hidden" {...sourceForm.register('sourceFrom')} />
                <SearchableSelect
                  options={businessOptions}
                  value={sourceForm.watch('sourceFrom')}
                  onChange={(val) => sourceForm.setValue('sourceFrom', val, { shouldDirty: true })}
                  placeholder={t('batches.selectSupplier')}
                  searchPlaceholder={t('batches.searchSupplier')}
                  emptyMessage={t('common.noResults')}
                  createLabel={t('businesses.addBusiness')}
                  onCreate={(name) => {
                    setQabName(name || '');
                    setQabOpen(true);
                  }}
                />
              </div>

              <div className="space-y-2">
                <Label>{t('batches.invoiceType')}</Label>
                <input type="hidden" {...sourceForm.register('invoiceType')} />
                <EnumButtonSelect
                  options={invoiceTypeOptions}
                  value={watchInvoiceType}
                  onChange={(val) => sourceForm.setValue('invoiceType', val, { shouldDirty: true })}
                  columns={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="s-taxInvoiceId">
                  {t('batches.taxInvoiceId')}
                  {watchInvoiceType === 'TAX_INVOICE' && <span className="text-destructive"> *</span>}
                </Label>
                <Input id="s-taxInvoiceId" {...sourceForm.register('taxInvoiceId')} />
                {sourceForm.formState.errors.taxInvoiceId && (
                  <p className="text-sm text-destructive">{sourceForm.formState.errors.taxInvoiceId.message}</p>
                )}
              </div>

              <Separator />

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="s-chicksRate">{t('batches.chicksRate')}</Label>
                  <Input
                    id="s-chicksRate"
                    inputMode="decimal"
                    {...sourceForm.register('chicksRate', { onChange: decimalInputHandler })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="s-qty">{t('batches.quantityPurchased')}</Label>
                  <Input
                    id="s-qty"
                    inputMode="numeric"
                    {...sourceForm.register('quantityPurchased', { onChange: intInputHandler })}
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="s-foc">{t('batches.focPercentage')}</Label>
                  <Input
                    id="s-foc"
                    inputMode="decimal"
                    {...sourceForm.register('focPercentage')}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="s-totalChicks">{t('batches.totalChicksField')}</Label>
                  <Input
                    id="s-totalChicks"
                    inputMode="numeric"
                    {...sourceForm.register('totalChicks', { onChange: intInputHandler })}
                  />
                </div>
              </div>

              <Separator />

              <div className="space-y-3 rounded-lg border p-4 bg-muted/30">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    {t('batches.subtotal')}
                    {qtyNum > 0 && rateNum > 0 && (
                      <span className="text-xs ml-1">
                        ({qtyNum.toLocaleString('en-US')} × {rateNum.toLocaleString('en-US', { minimumFractionDigits: 2 })})
                      </span>
                    )}
                  </span>
                  <span className="font-medium">{subtotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                </div>
                {watchInvoiceType === 'TAX_INVOICE' && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      {t('batches.vat')} ({vatRate}%)
                      {subtotal > 0 && (
                        <span className="text-xs ml-1">
                          ({subtotal.toLocaleString('en-US', { minimumFractionDigits: 2 })} × {vatRate}%)
                        </span>
                      )}
                    </span>
                    <span className="font-medium">{vat.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between text-sm font-semibold">
                  <span>{t('batches.grandTotal')}</span>
                  <span>{grandTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>

              <Separator />

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="s-invoiceDate">{t('batches.invoiceDate')}</Label>
                  <Input id="s-invoiceDate" type="date" {...sourceForm.register('invoiceDate')} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="s-deliveryDate">{t('batches.deliveryDate')}</Label>
                  <Input id="s-deliveryDate" type="date" {...sourceForm.register('deliveryDate')} />
                </div>
              </div>

              <Separator />

              <MultiFileUpload
                label={t('batches.taxInvoiceDocLabel')}
                files={taxInvoiceDocs}
                onAdd={(media) => setTaxInvoiceDocs((prev) => [...prev, media])}
                onRemove={(i) => setTaxInvoiceDocs((prev) => prev.filter((_, idx) => idx !== i))}
                entityType="source"
                entityId={editingSource?._id}
                category="sources"
                guardMarkDirty={guard.markDirty}
              />

              <MultiFileUpload
                label={t('batches.transferProof')}
                files={transferProofs}
                onAdd={(media) => setTransferProofs((prev) => [...prev, media])}
                onRemove={(i) => setTransferProofs((prev) => prev.filter((_, idx) => idx !== i))}
                entityType="source"
                entityId={editingSource?._id}
                category="sources"
                guardMarkDirty={guard.markDirty}
              />

              <MultiFileUpload
                label={t('batches.deliveryNoteDocLabel')}
                files={deliveryNoteDocs}
                onAdd={(media) => setDeliveryNoteDocs((prev) => [...prev, media])}
                onRemove={(i) => setDeliveryNoteDocs((prev) => prev.filter((_, idx) => idx !== i))}
                entityType="source"
                entityId={editingSource?._id}
                category="sources"
                guardMarkDirty={guard.markDirty}
              />

              <Separator />

              <DocumentsManager
                entityType="source"
                entityId={editingSource?._id}
                category="sources"
                documents={otherDocs}
                mediaMap={mediaMap}
                onDocumentsChange={(docs, map) => {
                  setOtherDocs(docs);
                  setMediaMap(map);
                  guard.markDirty();
                }}
              />
            </form>
          </ScrollArea>
          <SheetFooter>
            <Button type="button" variant="outline" onClick={tryClose}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" form="source-form" disabled={isMutating}>
              {isMutating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingSource ? t('common.save') : t('common.create')}
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
        onCreated={(biz) => {
          sourceForm.setValue('sourceFrom', biz._id, { shouldDirty: true });
        }}
        initialName={qabName}
      />
    </>
  );
}
