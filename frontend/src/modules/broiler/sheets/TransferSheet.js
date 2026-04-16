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
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { Loader2 } from 'lucide-react';
import SearchableSelect from '@/components/SearchableSelect';
import EnumButtonSelect from '@/components/EnumButtonSelect';
import FileUpload from '@/components/FileUpload';
import QuickAddBusinessSheet from '@/shared/sheets/QuickAddBusinessSheet';
import ConfirmDiscardDialog from '@/components/ConfirmDiscardDialog';
import useFormGuard from '@/hooks/useFormGuard';
import db from '@/lib/db';
import api from '@/lib/api';
import { parseNum, fmtDec, formatDateForInput, decimalInputHandler } from '@/lib/format';
import { Landmark, Banknote, FileCheck, CreditCard } from 'lucide-react';

const TRANSFER_TYPES = ['BANK_TRANSFER', 'CASH', 'CHEQUE', 'CREDIT'];

const TRANSFER_TYPE_ICONS = {
  BANK_TRANSFER: Landmark,
  CASH: Banknote,
  CHEQUE: FileCheck,
  CREDIT: CreditCard,
};

const transferSchema = z.object({
  business: z.string().min(1, 'Business is required'),
  transferDate: z.string().min(1, 'Transfer date is required'),
  amount: z.string().min(1, 'Amount is required').transform((val) => parseNum(val)),
  transferType: z.enum(TRANSFER_TYPES),
  notes: z.string().optional(),
});

const transferDefaults = {
  business: '',
  transferDate: '',
  amount: '',
  transferType: 'CASH',
  notes: '',
};

export default function TransferSheet({ open, onOpenChange, editingTransfer, preselectedBusinessId, stacked, onSuccess }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [transferProof, setTransferProof] = useState(null);
  const [qabOpen, setQabOpen] = useState(false);
  const [qabName, setQabName] = useState('');

  const form = useForm({
    resolver: zodResolver(transferSchema),
    defaultValues: transferDefaults,
  });

  const guard = useFormGuard(form.formState.isDirty);
  const businesses = useLocalQuery('businesses');
  const accounting = useSettings('accounting');
  const currency = accounting?.currency || 'AED';

  const businessOptions = useMemo(
    () => businesses.map((b) => ({
      value: b._id,
      label: b.companyName,
      description: b.trnNumber ? `TRN: ${b.trnNumber}` : '',
    })),
    [businesses]
  );

  const transferTypeOptions = useMemo(
    () => TRANSFER_TYPES.map((tt) => ({
      value: tt,
      label: t(`transfers.types.${tt}`),
      icon: TRANSFER_TYPE_ICONS[tt],
    })),
    [t]
  );

  const closeSheet = () => {
    onOpenChange(false);
    setTransferProof(null);
    guard.resetGuard();
    form.reset(transferDefaults);
  };

  const tryClose = () => {
    if (guard.isDirty) {
      guard.setConfirmOpen(true);
    } else {
      closeSheet();
    }
  };

  useEffect(() => {
    if (!open || !editingTransfer) return;
    guard.resetGuard();
    form.reset({
      business: editingTransfer.business?._id || editingTransfer.business || '',
      transferDate: formatDateForInput(editingTransfer.transferDate),
      amount: editingTransfer.amount ? fmtDec(editingTransfer.amount) : '',
      transferType: editingTransfer.transferType || 'CASH',
      notes: editingTransfer.notes || '',
    });

    (async () => {
      try {
        const { data: full } = await api.get(`/transfers/${editingTransfer._id}`);
        if (full.transferProof) setTransferProof(full.transferProof);
      } catch {
        setTransferProof(null);
      }
      guard.armGuard();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editingTransfer?._id]);

  useEffect(() => {
    if (!open || editingTransfer) return;
    guard.resetGuard();
    setTransferProof(null);
    const defaults = { ...transferDefaults };
    if (preselectedBusinessId) defaults.business = preselectedBusinessId;
    defaults.transferDate = formatDateForInput(new Date());
    form.reset(defaults);
    guard.armGuard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, preselectedBusinessId]);

  useEffect(() => {
    const val = form.getValues('business');
    if (!val || businesses.some(b => b._id === val)) return;
    db.idMap.get({ tempId: val, entityType: 'businesses' }).then(mapping => {
      if (mapping) form.setValue('business', mapping.realId, { shouldDirty: true });
    });
  }, [businesses]); // eslint-disable-line react-hooks/exhaustive-deps

  const { mutate, isPending: isMutating } = useOfflineMutation('transfers');

  const fireReceiptGeneration = async (transferId) => {
    try {
      let resolvedId = transferId;
      const isTempId = transferId.includes('-');
      if (isTempId) {
        for (let i = 0; i < 30; i++) {
          await new Promise((r) => setTimeout(r, 500));
          const mapping = await db.idMap.get({ tempId: transferId, entityType: 'transfers' });
          if (mapping) {
            resolvedId = mapping.realId;
            break;
          }
        }
        if (resolvedId === transferId) return;
      } else {
        for (let i = 0; i < 30; i++) {
          const pending = await db.mutationQueue.where('status').equals('pending').count();
          if (pending === 0) break;
          await new Promise((r) => setTimeout(r, 500));
        }
      }

      const { data: updated } = await api.post(`/transfers/${resolvedId}/receipt`);
      if (updated?._id) {
        await db.transfers.put(updated);
      }
    } catch {
      // receipt generation is best-effort
    }
  };

  const onSubmit = (formData) => {
    const payload = {
      business: formData.business,
      transferDate: formData.transferDate || null,
      amount: formData.amount || 0,
      transferType: formData.transferType || 'CASH',
      transferProof: transferProof?._id || null,
      notes: formData.notes || '',
    };

    mutate({
      action: editingTransfer ? 'update' : 'create',
      id: editingTransfer ? editingTransfer._id : undefined,
      data: payload,
      mediaFields: ['transferProof'],
    }, {
      onSuccess: (result) => {
        toast({ title: editingTransfer ? t('transfers.transferUpdated') : t('transfers.transferCreated') });
        const savedId = result?._id || editingTransfer?._id;
        if (savedId) fireReceiptGeneration(savedId);
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
            <SheetTitle>{editingTransfer ? t('transfers.editTransfer') : t('transfers.addTransfer')}</SheetTitle>
            <SheetDescription>{editingTransfer ? t('transfers.editTransferDesc') : t('transfers.addTransferDesc')}</SheetDescription>
          </SheetHeader>
          <ScrollArea className="flex-1">
            <form id="transfer-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 px-6 py-4 overflow-hidden">
              <div className="space-y-2">
                <Label>{t('transfers.business')}</Label>
                <input type="hidden" {...form.register('business')} />
                <SearchableSelect
                  options={businessOptions}
                  value={form.watch('business')}
                  onChange={(val) => form.setValue('business', val, { shouldDirty: true })}
                  placeholder={t('transfers.selectBusiness')}
                  searchPlaceholder={t('transfers.searchBusiness')}
                  emptyMessage={t('common.noResults')}
                  createLabel={t('businesses.addBusiness')}
                  onCreate={(name) => {
                    setQabName(name || '');
                    setQabOpen(true);
                  }}
                  disabled={!!preselectedBusinessId}
                />
                {form.formState.errors.business && (
                  <p className="text-sm text-destructive">{form.formState.errors.business.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="t-date">{t('transfers.transferDate')}</Label>
                <Input id="t-date" type="date" {...form.register('transferDate')} />
                {form.formState.errors.transferDate && (
                  <p className="text-sm text-destructive">{form.formState.errors.transferDate.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="t-amount">
                  {t('transfers.amount')} <span className="text-destructive">*</span>
                </Label>
                <div className="relative">
                  <span className="absolute inset-y-0 start-0 flex items-center ps-3 text-muted-foreground text-sm pointer-events-none">
                    {currency}
                  </span>
                  <Input
                    id="t-amount"
                    inputMode="decimal"
                    className="ps-14"
                    {...form.register('amount', { onChange: decimalInputHandler })}
                  />
                </div>
                {form.formState.errors.amount && (
                  <p className="text-sm text-destructive">{t('transfers.amountRequired')}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label>{t('transfers.transferType')}</Label>
                <input type="hidden" {...form.register('transferType')} />
                <EnumButtonSelect
                  options={transferTypeOptions}
                  value={form.watch('transferType')}
                  onChange={(val) => form.setValue('transferType', val, { shouldDirty: true })}
                  columns={4}
                />
              </div>

              <div className="space-y-2">
                <Label>{t('transfers.transferProof')}</Label>
                <FileUpload
                  value={transferProof}
                  onUpload={(media) => {
                    setTransferProof(media);
                    guard.markDirty();
                  }}
                  onRemove={() => {
                    setTransferProof(null);
                    guard.markDirty();
                  }}
                  entityType="transfer"
                  entityId={editingTransfer?._id}
                  category="transfer-proofs"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="t-notes">{t('transfers.notes')}</Label>
                <Textarea
                  id="t-notes"
                  placeholder={t('transfers.notesPlaceholder')}
                  {...form.register('notes')}
                  rows={3}
                />
              </div>
            </form>
          </ScrollArea>
          <SheetFooter>
            <Button type="button" variant="outline" onClick={tryClose}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" form="transfer-form" disabled={isMutating}>
              {isMutating && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
              {editingTransfer ? t('common.save') : t('common.create')}
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
          form.setValue('business', biz._id, { shouldDirty: true });
        }}
        initialName={qabName}
      />
    </>
  );
}
