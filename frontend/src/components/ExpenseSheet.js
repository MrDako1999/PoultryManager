/**
 * ExpenseSheet — self-contained sheet for creating / editing an Expense entry.
 *
 * CONTRACT (entity-sheet pattern):
 *  - Props: { open, onOpenChange, batchId, editingExpense, onEditLinkedSource,
 *             onEditLinkedFeedOrder, onSuccess }
 *  - Owns its own form state (react-hook-form + Zod), guard, file uploads, and mutations.
 *  - Fetches reference data (businesses, accounting) via React Query (cache-deduped).
 *  - Linked expenses (from a Source or FeedOrder) are read-only; the user can jump
 *    to the linked entity via `onEditLinkedSource` / `onEditLinkedFeedOrder` callbacks.
 *  - Calls `onSuccess()` after a successful create/update so the parent can
 *    invalidate list-level queries.
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
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, Link2, ExternalLink } from 'lucide-react';
import SearchableSelect from '@/components/SearchableSelect';
import EnumButtonSelect from '@/components/EnumButtonSelect';
import DocumentsManager from '@/components/DocumentsManager';
import MultiFileUpload from '@/components/MultiFileUpload';
import QuickAddBusinessSheet from '@/components/QuickAddBusinessSheet';
import ConfirmDiscardDialog from '@/components/ConfirmDiscardDialog';
import useFormGuard from '@/hooks/useFormGuard';
import api from '@/lib/api';
import db from '@/lib/db';
import { parseNum, fmtDec, formatDateForInput, decimalInputHandler } from '@/lib/format';
import { INVOICE_TYPES, INVOICE_TYPE_ICONS, EXPENSE_CATEGORIES, EXPENSE_CATEGORY_ICONS } from '@/lib/constants';

const expenseSchema = z.object({
  expenseDate: z.string().min(1, 'Expense date is required'),
  invoiceType: z.string().min(1, 'Invoice type is required'),
  invoiceId: z.string().optional(),
  category: z.string().min(1, 'Category is required'),
  description: z.string().min(1, 'Description is required'),
  tradingCompany: z.string().optional(),
  grossAmount: z.string().min(1, 'Gross amount is required').transform((val) => parseNum(val)),
}).superRefine((data, ctx) => {
  if (!INVOICE_TYPES.includes(data.invoiceType)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Please select an invoice type', path: ['invoiceType'] });
  }
  if (!EXPENSE_CATEGORIES.includes(data.category)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Please select a category', path: ['category'] });
  }
  if (data.invoiceType === 'TAX_INVOICE') {
    if (!data.invoiceId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Invoice ID is required for Tax Invoice', path: ['invoiceId'] });
    }
    if (!data.tradingCompany) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Trading company is required for Tax Invoice', path: ['tradingCompany'] });
    }
  }
  if (data.invoiceType === 'CASH_MEMO') {
    if (!data.tradingCompany) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Trading company is required for Cash Memo', path: ['tradingCompany'] });
    }
  }
  if (typeof data.grossAmount === 'number' && data.grossAmount <= 0) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Gross amount must be greater than 0', path: ['grossAmount'] });
  }
});

const expenseDefaults = {
  expenseDate: '',
  invoiceType: '',
  invoiceId: '',
  category: '',
  description: '',
  tradingCompany: '',
  grossAmount: '',
};

export default function ExpenseSheet({
  open, onOpenChange, batchId, editingExpense, stacked,
  onEditLinkedSource, onEditLinkedFeedOrder, onEditLinkedSaleOrder, onSuccess,
}) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [receipts, setReceipts] = useState([]);
  const [expTransferProofs, setExpTransferProofs] = useState([]);
  const [otherDocs, setOtherDocs] = useState([]);
  const [mediaMap, setMediaMap] = useState({});
  const [qabOpen, setQabOpen] = useState(false);
  const [qabName, setQabName] = useState('');

  const expenseForm = useForm({
    resolver: zodResolver(expenseSchema),
    defaultValues: expenseDefaults,
  });

  const guard = useFormGuard(expenseForm.formState.isDirty);

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

  const categoryOptions = useMemo(
    () => EXPENSE_CATEGORIES.map((c) => ({ value: c, label: t(`batches.expenseCategories.${c}`), icon: EXPENSE_CATEGORY_ICONS[c] })),
    [t]
  );

  const invoiceTypeOptions = useMemo(
    () => INVOICE_TYPES.map((it) => ({ value: it, label: t(`batches.invoiceTypes.${it}`), icon: INVOICE_TYPE_ICONS[it] })),
    [t]
  );

  const watchInvoiceType = expenseForm.watch('invoiceType');
  const watchCategory = expenseForm.watch('category');
  const watchGross = expenseForm.watch('grossAmount');
  const enteredNum = parseNum(watchGross);
  const isTaxInvoice = watchInvoiceType === 'TAX_INVOICE';
  const grossNum = isTaxInvoice ? enteredNum / (1 + vatRate / 100) : enteredNum;
  const taxable = isTaxInvoice ? enteredNum - grossNum : 0;
  const totalAmount = enteredNum;

  const isSourceLinked = !!editingExpense?.source;
  const isFeedOrderLinked = !!editingExpense?.feedOrder;
  const isSaleOrderLinked = !!editingExpense?.saleOrder;
  const isLinked = isSourceLinked || isFeedOrderLinked || isSaleOrderLinked;

  const resetFiles = () => {
    setReceipts([]);
    setExpTransferProofs([]);
  };

  const closeSheet = () => {
    onOpenChange(false);
    setOtherDocs([]);
    setMediaMap({});
    resetFiles();
    guard.resetGuard();
    expenseForm.reset(expenseDefaults);
  };

  const tryClose = () => {
    if (guard.isDirty) {
      guard.setConfirmOpen(true);
    } else {
      closeSheet();
    }
  };

  const populateForm = async (expense) => {
    try {
      const { data: full } = await api.get(`/expenses/${expense._id}`);
      const displayAmount = full.invoiceType === 'TAX_INVOICE' && full.totalAmount
        ? fmtDec(full.totalAmount)
        : full.grossAmount ? fmtDec(full.grossAmount) : '';
      expenseForm.reset({
        expenseDate: formatDateForInput(full.expenseDate),
        invoiceType: full.invoiceType || '',
        invoiceId: full.invoiceId || '',
        category: full.category || '',
        description: full.description || '',
        tradingCompany: full.tradingCompany?._id || full.tradingCompany || '',
        grossAmount: displayAmount,
      });
      setReceipts(full.receipts || []);
      setExpTransferProofs(full.transferProofs || []);
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
      setReceipts([]);
      setExpTransferProofs([]);
      setOtherDocs([]);
      setMediaMap({});
    }
  };

  // Populate form when opening for edit
  useEffect(() => {
    if (!open || !editingExpense) return;

    guard.resetGuard();
    const editDisplayAmount = editingExpense.invoiceType === 'TAX_INVOICE' && editingExpense.totalAmount
      ? fmtDec(editingExpense.totalAmount)
      : editingExpense.grossAmount ? fmtDec(editingExpense.grossAmount) : '';
    expenseForm.reset({
      expenseDate: formatDateForInput(editingExpense.expenseDate),
      invoiceType: editingExpense.invoiceType || '',
      invoiceId: editingExpense.invoiceId || '',
      category: editingExpense.category || '',
      description: editingExpense.description || '',
      tradingCompany: editingExpense.tradingCompany?._id || editingExpense.tradingCompany || '',
      grossAmount: editDisplayAmount,
    });

    populateForm(editingExpense).then(() => {
      guard.armGuard();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editingExpense?._id]);

  // Populate form when opening for create
  useEffect(() => {
    if (!open || editingExpense) return;
    guard.resetGuard();
    setOtherDocs([]);
    setMediaMap({});
    resetFiles();
    expenseForm.reset(expenseDefaults);
    guard.armGuard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    const val = expenseForm.getValues('tradingCompany');
    if (!val || businesses.some(b => b._id === val)) return;
    db.idMap.get({ tempId: val, entityType: 'businesses' }).then(mapping => {
      if (mapping) expenseForm.setValue('tradingCompany', mapping.realId, { shouldDirty: true });
    });
  }, [businesses]); // eslint-disable-line react-hooks/exhaustive-deps

  const { mutate, isPending: isMutating } = useOfflineMutation('expenses');

  const onSubmit = (formData) => {
    const payload = {
      batch: batchId,
      expenseDate: formData.expenseDate,
      invoiceType: formData.invoiceType,
      invoiceId: formData.invoiceType !== 'NO_INVOICE' ? (formData.invoiceId || '') : '',
      category: formData.category || 'OTHERS',
      description: formData.description || '',
      tradingCompany: formData.tradingCompany || null,
      grossAmount: grossNum || formData.grossAmount || 0,
      taxableAmount: taxable,
      totalAmount,
      receipts: receipts.map((m) => m._id),
      transferProofs: expTransferProofs.map((m) => m._id),
      otherDocs,
    };

    mutate({
      action: editingExpense ? 'update' : 'create',
      id: editingExpense ? editingExpense._id : undefined,
      data: payload,
      mediaFields: ['receipts', 'transferProofs'],
    }, {
      onSuccess: () => {
        toast({ title: editingExpense ? t('batches.expenseUpdated') : t('batches.expenseCreated') });
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
            <SheetTitle>
              {editingExpense ? t('batches.editExpense') : t('batches.addExpense')}
            </SheetTitle>
            <SheetDescription>
              {editingExpense ? t('batches.editExpenseDesc') : t('batches.addExpenseDesc')}
            </SheetDescription>
          </SheetHeader>

          {isSourceLinked && (
            <div className="mx-6 mt-2 flex flex-col items-center gap-2">
              <Badge variant="secondary" className="gap-1">
                <Link2 className="h-3 w-3" />
                {t('batches.linkedToSource')}
              </Badge>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => onEditLinkedSource?.(editingExpense)}
              >
                <ExternalLink className="h-3.5 w-3.5" />
                {t('batches.editSourceEntry')}
              </Button>
            </div>
          )}

          {isFeedOrderLinked && (
            <div className="mx-6 mt-2 flex flex-col items-center gap-2">
              <Badge variant="secondary" className="gap-1">
                <Link2 className="h-3 w-3" />
                {t('batches.linkedToFeedOrder')}
              </Badge>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => onEditLinkedFeedOrder?.(editingExpense)}
              >
                <ExternalLink className="h-3.5 w-3.5" />
                {t('batches.editFeedOrderEntry')}
              </Button>
            </div>
          )}

          {isSaleOrderLinked && (
            <div className="mx-6 mt-2 flex flex-col items-center gap-2">
              <Badge variant="secondary" className="gap-1">
                <Link2 className="h-3 w-3" />
                {t('batches.linkedToSaleOrder')}
              </Badge>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => onEditLinkedSaleOrder?.(editingExpense)}
              >
                <ExternalLink className="h-3.5 w-3.5" />
                {t('batches.editSaleOrderEntry')}
              </Button>
            </div>
          )}

          <ScrollArea className="flex-1">
            <fieldset disabled={isLinked} className="contents">
              <form id="expense-form" onSubmit={expenseForm.handleSubmit(onSubmit)} className="space-y-4 px-6 py-4 overflow-hidden">
                {/* Step 1: Invoice Type (always visible) */}
                <div className="space-y-2">
                  <Label>{t('batches.invoiceType')} <span className="text-destructive">*</span></Label>
                  <input type="hidden" {...expenseForm.register('invoiceType')} />
                  <EnumButtonSelect
                    options={invoiceTypeOptions}
                    value={watchInvoiceType}
                    onChange={(val) => expenseForm.setValue('invoiceType', val, { shouldDirty: true, shouldValidate: true })}
                    columns={3}
                    disabled={isLinked}
                  />
                  {expenseForm.formState.errors.invoiceType && (
                    <p className="text-sm text-destructive">{expenseForm.formState.errors.invoiceType.message}</p>
                  )}
                </div>

                {/* Step 2: Category (visible after invoice type selected) */}
                {(!!editingExpense || !!watchInvoiceType) && (
                  <div className="space-y-2">
                    <Label>
                      {t('batches.expenseCategory')} <span className="text-destructive">*</span>
                    </Label>
                    <input type="hidden" {...expenseForm.register('category')} />
                    <EnumButtonSelect
                      options={categoryOptions}
                      value={watchCategory}
                      onChange={(val) => expenseForm.setValue('category', val, { shouldDirty: true, shouldValidate: true })}
                      columns={3}
                      compact
                      disabled={isLinked}
                    />
                    {expenseForm.formState.errors.category && (
                      <p className="text-sm text-destructive">{expenseForm.formState.errors.category.message}</p>
                    )}
                  </div>
                )}

                {/* Step 3: Remaining fields (visible after category selected) */}
                {(!!editingExpense || !!watchCategory) && (
                  <>
                    {watchInvoiceType && watchInvoiceType !== 'NO_INVOICE' && (
                      <div className="space-y-2">
                        <Label htmlFor="e-invoiceId">
                          {t('batches.invoiceIdLabel')}
                          {watchInvoiceType === 'TAX_INVOICE' && <span className="text-destructive"> *</span>}
                        </Label>
                        <Input id="e-invoiceId" {...expenseForm.register('invoiceId')} placeholder={t('batches.invoiceIdPlaceholder')} />
                        {expenseForm.formState.errors.invoiceId && (
                          <p className="text-sm text-destructive">{expenseForm.formState.errors.invoiceId.message}</p>
                        )}
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label htmlFor="e-date">
                        {t('batches.expenseDate')} <span className="text-destructive">*</span>
                      </Label>
                      <Input id="e-date" type="date" {...expenseForm.register('expenseDate')} />
                      {expenseForm.formState.errors.expenseDate && (
                        <p className="text-sm text-destructive">{expenseForm.formState.errors.expenseDate.message}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="e-desc">{t('batches.expenseDescription')} <span className="text-destructive">*</span></Label>
                      <Textarea id="e-desc" {...expenseForm.register('description')} placeholder={t('batches.expenseDescriptionPlaceholder')} rows={2} />
                      {expenseForm.formState.errors.description && (
                        <p className="text-sm text-destructive">{expenseForm.formState.errors.description.message}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label>
                        {t('batches.tradingCompany')}
                        {(watchInvoiceType === 'TAX_INVOICE' || watchInvoiceType === 'CASH_MEMO') && <span className="text-destructive"> *</span>}
                      </Label>
                      <input type="hidden" {...expenseForm.register('tradingCompany')} />
                      <SearchableSelect
                        options={businessOptions}
                        value={expenseForm.watch('tradingCompany')}
                        onChange={(val) => expenseForm.setValue('tradingCompany', val, { shouldDirty: true, shouldValidate: true })}
                        placeholder={t('batches.selectCompany')}
                        searchPlaceholder={t('batches.searchCompany')}
                        emptyMessage={t('common.noResults')}
                        createLabel={t('businesses.addBusiness')}
                        onCreate={(name) => {
                          setQabName(name || '');
                          setQabOpen(true);
                        }}
                        disabled={isLinked}
                      />
                      {expenseForm.formState.errors.tradingCompany && (
                        <p className="text-sm text-destructive">{expenseForm.formState.errors.tradingCompany.message}</p>
                      )}
                    </div>

                    <Separator />

                    <div className="space-y-2">
                      <Label htmlFor="e-gross">
                        {isTaxInvoice ? t('batches.totalAmount') : t('batches.grossAmount')} <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="e-gross"
                        inputMode="decimal"
                        {...expenseForm.register('grossAmount', { onChange: decimalInputHandler })}
                      />
                      {expenseForm.formState.errors.grossAmount && (
                        <p className="text-sm text-destructive">{expenseForm.formState.errors.grossAmount.message}</p>
                      )}
                    </div>

                    <div className="space-y-3 rounded-lg border p-4 bg-muted/30">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{t('batches.grossAmount')}</span>
                        <span className="font-medium">{grossNum.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                      </div>
                      {isTaxInvoice && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">
                            {t('batches.vat')} ({vatRate}%)
                          </span>
                          <span className="font-medium">{taxable.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                        </div>
                      )}
                      <Separator />
                      <div className="flex justify-between text-sm font-semibold">
                        <span>{t('batches.totalAmount')}</span>
                        <span>{totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                      </div>
                    </div>

                    <Separator />

                    <MultiFileUpload
                      label={t('batches.receipt')}
                      files={receipts}
                      onAdd={(media) => setReceipts((prev) => [...prev, media])}
                      onRemove={(i) => setReceipts((prev) => prev.filter((_, idx) => idx !== i))}
                      entityType="expense"
                      entityId={editingExpense?._id}
                      category="expenses"
                      guardMarkDirty={guard.markDirty}
                      readOnly={isLinked}
                    />

                    <MultiFileUpload
                      label={t('batches.transferProof')}
                      files={expTransferProofs}
                      onAdd={(media) => setExpTransferProofs((prev) => [...prev, media])}
                      onRemove={(i) => setExpTransferProofs((prev) => prev.filter((_, idx) => idx !== i))}
                      entityType="expense"
                      entityId={editingExpense?._id}
                      category="expenses"
                      guardMarkDirty={guard.markDirty}
                      readOnly={isLinked}
                    />

                    <Separator />

                    {!isLinked && (
                      <DocumentsManager
                        entityType="expense"
                        entityId={editingExpense?._id}
                        category="expenses"
                        documents={otherDocs}
                        mediaMap={mediaMap}
                        onDocumentsChange={(docs, map) => {
                          setOtherDocs(docs);
                          setMediaMap(map);
                          guard.markDirty();
                        }}
                      />
                    )}
                  </>
                )}
              </form>
            </fieldset>
          </ScrollArea>
          <SheetFooter>
            <Button type="button" variant="outline" onClick={tryClose}>
              {isLinked ? t('common.close') : t('common.cancel')}
            </Button>
            {!isLinked && (
              <Button type="submit" form="expense-form" disabled={isMutating}>
                {isMutating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingExpense ? t('common.save') : t('common.create')}
              </Button>
            )}
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
          expenseForm.setValue('tradingCompany', biz._id, { shouldDirty: true });
        }}
        initialName={qabName}
      />
    </>
  );
}
