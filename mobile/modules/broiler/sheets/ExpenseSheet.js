import { useState, useEffect, useMemo } from 'react';
import { View, Text, Modal, Pressable, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X } from 'lucide-react-native';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Button } from '@/components/ui/Button';
import Select from '@/components/ui/Select';
import EnumButtonSelect from '@/components/ui/EnumButtonSelect';
import DatePicker from '@/components/ui/DatePicker';
import Separator from '@/components/ui/Separator';
import MultiFileUpload from '@/components/MultiFileUpload';
import QuickAddBusinessSheet from '@/shared/sheets/QuickAddBusinessSheet';
import useLocalQuery from '@/hooks/useLocalQuery';
import useSettings from '@/hooks/useSettings';
import useOfflineMutation from '@/hooks/useOfflineMutation';
import { INVOICE_TYPES, INVOICE_TYPE_ICONS, EXPENSE_CATEGORIES, EXPENSE_CATEGORY_ICONS } from '@/lib/constants';
import { useToast } from '@/components/ui/Toast';

const parseNum = (v) => { const n = parseFloat(String(v).replace(/,/g, '')); return isNaN(n) ? 0 : n; };

const expenseSchema = z.object({
  expenseDate: z.string().min(1, 'Expense date is required'),
  invoiceType: z.string().min(1, 'Invoice type is required'),
  invoiceId: z.string().optional(),
  category: z.string().min(1, 'Category is required'),
  description: z.string().min(1, 'Description is required'),
  tradingCompany: z.string().optional(),
  grossAmount: z.string().min(1, 'Amount is required'),
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
  if (parseNum(data.grossAmount) <= 0) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Amount must be greater than 0', path: ['grossAmount'] });
  }
});

function FieldError({ error }) {
  if (!error) return null;
  return <Text className="text-xs text-destructive mt-1">{error.message}</Text>;
}

function RequiredStar() {
  return <Text className="text-destructive"> *</Text>;
}

export default function ExpenseSheet({ open, onClose, batchId, editData }) {
  const { t } = useTranslation();
  const { bottom: safeBottom } = useSafeAreaInsets();
  const { toast } = useToast();
  const accounting = useSettings('accounting');
  const [businesses] = useLocalQuery('businesses');
  const { create, update } = useOfflineMutation('expenses');
  const [saving, setSaving] = useState(false);
  const [receipts, setReceipts] = useState([]);
  const [expTransferProofs, setExpTransferProofs] = useState([]);
  const [quickAddBiz, setQuickAddBiz] = useState(false);
  const [bizInitialName, setBizInitialName] = useState('');
  const [pendingBiz, setPendingBiz] = useState(null);

  const currency = accounting?.currency || 'AED';
  const vatRate = accounting?.vatRate || 5;

  const { control, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
      expenseDate: '',
      invoiceType: '',
      invoiceId: '',
      category: '',
      description: '',
      tradingCompany: '',
      grossAmount: '',
    },
  });

  useEffect(() => {
    if (editData) {
      setReceipts(editData.receipts || []);
      setExpTransferProofs(editData.transferProofs || []);
      reset({
        expenseDate: editData.expenseDate?.slice(0, 10) || new Date().toISOString().slice(0, 10),
        invoiceType: editData.invoiceType || '',
        invoiceId: editData.invoiceId || '',
        category: editData.category || '',
        description: editData.description || '',
        tradingCompany: (typeof editData.tradingCompany === 'object' ? editData.tradingCompany?._id : editData.tradingCompany) || '',
        grossAmount: editData.grossAmount?.toString() || '',
      });
    } else {
      setReceipts([]);
      setExpTransferProofs([]);
      reset({
        expenseDate: '',
        invoiceType: '',
        invoiceId: '',
        category: '',
        description: '',
        tradingCompany: '',
        grossAmount: '',
      });
    }
  }, [editData, reset, open]);

  const watchInvoiceType = watch('invoiceType');
  const watchCategory = watch('category');
  const watchGross = watch('grossAmount');
  const isTaxInvoice = watchInvoiceType === 'TAX_INVOICE';
  const grossNum = parseNum(watchGross);
  const taxableAmount = isTaxInvoice ? grossNum * (vatRate / 100) : 0;
  const totalAmount = grossNum + taxableAmount;

  const showCategory = !!editData || !!watchInvoiceType;
  const showRemainingFields = !!editData || !!watchCategory;

  const businessOptions = useMemo(() => {
    const opts = businesses.map((b) => ({ value: b._id, label: b.companyName }));
    if (pendingBiz && !opts.some((o) => o.value === pendingBiz._id)) {
      opts.unshift({ value: pendingBiz._id, label: pendingBiz.companyName });
    }
    return opts;
  }, [businesses, pendingBiz]);

  const invoiceTypeOptions = INVOICE_TYPES.map((v) => ({ value: v, label: t(`batches.invoiceTypes.${v}`), icon: INVOICE_TYPE_ICONS[v] }));
  const categoryOptions = EXPENSE_CATEGORIES.map((v) => ({ value: v, label: t(`batches.expenseCategories.${v}`), icon: EXPENSE_CATEGORY_ICONS[v] }));

  const onSubmit = async (formData) => {
    setSaving(true);
    try {
      const payload = {
        batch: batchId,
        expenseDate: formData.expenseDate,
        invoiceType: formData.invoiceType,
        invoiceId: formData.invoiceType === 'NO_INVOICE' ? '' : formData.invoiceId,
        category: formData.category || 'OTHERS',
        description: formData.description || '',
        tradingCompany: formData.tradingCompany || null,
        grossAmount: grossNum,
        taxableAmount,
        totalAmount,
        receipts: receipts.map((m) => m._id),
        transferProofs: expTransferProofs.map((m) => m._id),
      };

      if (editData?._id) {
        await update(editData._id, payload);
        toast({ title: t('batches.expenseUpdated') });
      } else {
        const tempId = `temp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        await create(tempId, payload, ['receipts', 'transferProofs']);
        toast({ title: t('batches.expenseCreated') });
      }
      onClose();
    } catch (err) {
      toast({ variant: 'destructive', title: err.message || t('common.error') });
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1 bg-background">
        <View className="flex-row items-center justify-between px-4 pt-4 pb-2">
          <Text className="text-lg font-bold text-foreground">
            {editData ? t('batches.editExpense') : t('batches.addExpense')}
          </Text>
          <Pressable onPress={onClose} hitSlop={8}>
            <X size={20} color="hsl(150, 10%, 45%)" />
          </Pressable>
        </View>
        <Separator />
        <ScrollView className="flex-1 px-4" contentContainerClassName="py-4 gap-4" keyboardShouldPersistTaps="handled">
          {/* Step 1: Invoice Type (always visible) */}
          <View className="gap-2">
            <Label>{t('batches.invoiceType')}<RequiredStar /></Label>
            <Controller
              control={control}
              name="invoiceType"
              render={({ field: { value, onChange } }) => (
                <EnumButtonSelect value={value} onChange={onChange} options={invoiceTypeOptions} columns={3} />
              )}
            />
            <FieldError error={errors.invoiceType} />
          </View>

          {/* Step 2: Category (visible after invoice type selected) */}
          {showCategory && (
            <View className="gap-2">
              <Label>{t('batches.expenseCategory')}<RequiredStar /></Label>
              <Controller
                control={control}
                name="category"
                render={({ field: { value, onChange } }) => (
                  <EnumButtonSelect value={value} onChange={onChange} options={categoryOptions} columns={3} compact />
                )}
              />
              <FieldError error={errors.category} />
            </View>
          )}

          {/* Step 3: Remaining fields (visible after category selected) */}
          {showRemainingFields && (
            <>
              {watchInvoiceType && watchInvoiceType !== 'NO_INVOICE' && (
                <View className="gap-2">
                  <Label>
                    {t('batches.invoiceIdLabel')}
                    {watchInvoiceType === 'TAX_INVOICE' && <RequiredStar />}
                  </Label>
                  <Controller
                    control={control}
                    name="invoiceId"
                    render={({ field: { value, onChange } }) => (
                      <Input value={value} onChangeText={onChange} placeholder={t('batches.invoiceIdPlaceholder')} />
                    )}
                  />
                  <FieldError error={errors.invoiceId} />
                </View>
              )}

              <View className="gap-2">
                <Label>{t('batches.expenseDate')}<RequiredStar /></Label>
                <Controller
                  control={control}
                  name="expenseDate"
                  render={({ field: { value, onChange } }) => (
                    <DatePicker value={value} onChange={onChange} label={t('batches.expenseDate')} />
                  )}
                />
                <FieldError error={errors.expenseDate} />
              </View>

              <View className="gap-2">
                <Label>{t('batches.expenseDescription')}<RequiredStar /></Label>
                <Controller
                  control={control}
                  name="description"
                  render={({ field: { value, onChange } }) => (
                    <Input value={value} onChangeText={onChange} placeholder={t('batches.expenseDescriptionPlaceholder')} />
                  )}
                />
                <FieldError error={errors.description} />
              </View>

              <View className="gap-2">
                <Label>
                  {t('batches.tradingCompany')}
                  {(watchInvoiceType === 'TAX_INVOICE' || watchInvoiceType === 'CASH_MEMO') && <RequiredStar />}
                </Label>
                <Controller
                  control={control}
                  name="tradingCompany"
                  render={({ field: { value, onChange } }) => (
                    <Select
                      value={value}
                      onValueChange={onChange}
                      options={businessOptions}
                      placeholder={t('batches.selectCompany')}
                      label={t('batches.tradingCompany')}
                      onCreateNew={(searchText) => { setBizInitialName(searchText || ''); setQuickAddBiz(true); }}
                      createNewLabel={t('businesses.addBusiness', 'Add Business')}
                    />
                  )}
                />
                <FieldError error={errors.tradingCompany} />
              </View>

              <Separator />

              <View className="gap-2">
                <Label>{isTaxInvoice ? t('batches.totalAmount') : t('batches.grossAmount')}<RequiredStar /></Label>
                <Controller
                  control={control}
                  name="grossAmount"
                  render={({ field: { value, onChange } }) => (
                    <Input value={value} onChangeText={onChange} keyboardType="decimal-pad" placeholder="0.00" />
                  )}
                />
                <FieldError error={errors.grossAmount} />
              </View>

              {isTaxInvoice && taxableAmount > 0 && (
                <View className="rounded-lg border border-border bg-muted/30 px-3 py-2 gap-0.5">
                  <View className="flex-row justify-between">
                    <Text className="text-xs text-muted-foreground">{t('batches.taxableAmount')}</Text>
                    <Text className="text-sm text-foreground" style={{ fontVariant: ['tabular-nums'] }}>
                      {currency} {taxableAmount.toFixed(2)}
                    </Text>
                  </View>
                  <View className="flex-row justify-between">
                    <Text className="text-xs font-semibold text-foreground">{t('batches.totalAmount')}</Text>
                    <Text className="text-sm font-bold text-foreground" style={{ fontVariant: ['tabular-nums'] }}>
                      {currency} {totalAmount.toFixed(2)}
                    </Text>
                  </View>
                </View>
              )}

              <Separator />

              <MultiFileUpload
                label={t('batches.receipt', 'Receipts')}
                files={receipts}
                onAdd={(media) => setReceipts((prev) => [...prev, media])}
                onRemove={(index) => setReceipts((prev) => prev.filter((_, i) => i !== index))}
                entityType="expense"
                entityId={editData?._id}
                category="expenses"
              />

              <MultiFileUpload
                label={t('batches.transferProofs', 'Transfer Proofs')}
                files={expTransferProofs}
                onAdd={(media) => setExpTransferProofs((prev) => [...prev, media])}
                onRemove={(index) => setExpTransferProofs((prev) => prev.filter((_, i) => i !== index))}
                entityType="expense"
                entityId={editData?._id}
                category="expenses"
              />
            </>
          )}
        </ScrollView>

        <View className="px-4 pt-4 border-t border-border" style={{ paddingBottom: Math.max(safeBottom, 16) }}>
          <Button onPress={handleSubmit(onSubmit)} loading={saving} disabled={saving}>
            {editData ? t('common.save') : t('common.create')}
          </Button>
        </View>
      </KeyboardAvoidingView>

      <QuickAddBusinessSheet
        open={quickAddBiz}
        onClose={() => setQuickAddBiz(false)}
        initialName={bizInitialName}
        onCreated={(biz) => {
          setPendingBiz(biz);
          setValue('tradingCompany', biz._id, { shouldDirty: true });
          toast({ title: `${biz.companyName} ${t('common.created', 'created')}` });
        }}
      />
    </Modal>
  );
}
