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
import { INVOICE_TYPES, INVOICE_TYPE_ICONS } from '@/lib/constants';
import { useToast } from '@/components/ui/Toast';

const parseNum = (v) => { const n = parseFloat(String(v).replace(/,/g, '')); return isNaN(n) ? 0 : n; };

const sourceSchema = z.object({
  sourceFrom: z.string().optional(),
  invoiceType: z.string().min(1, 'Invoice type is required'),
  taxInvoiceId: z.string().optional(),
  chicksRate: z.string().optional(),
  quantityPurchased: z.string().optional(),
  focPercentage: z.string().optional(),
  invoiceDate: z.string().optional(),
  deliveryDate: z.string().optional(),
}).superRefine((data, ctx) => {
  if (data.invoiceType === 'TAX_INVOICE' && !data.taxInvoiceId) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Invoice ID is required for Tax Invoice', path: ['taxInvoiceId'] });
  }
});

function FieldError({ error }) {
  if (!error) return null;
  return <Text className="text-xs text-destructive mt-1">{error.message}</Text>;
}

function RequiredStar() {
  return <Text className="text-destructive"> *</Text>;
}

export default function SourceSheet({ open, onClose, batchId, editData }) {
  const { t } = useTranslation();
  const { bottom: safeBottom } = useSafeAreaInsets();
  const { toast } = useToast();
  const accounting = useSettings('accounting');
  const [businesses] = useLocalQuery('businesses');
  const { create, update } = useOfflineMutation('sources');
  const [saving, setSaving] = useState(false);
  const [quickAddBiz, setQuickAddBiz] = useState(false);
  const [bizInitialName, setBizInitialName] = useState('');
  const [pendingBiz, setPendingBiz] = useState(null);
  const [taxInvoiceDocs, setTaxInvoiceDocs] = useState([]);
  const [transferProofs, setTransferProofs] = useState([]);
  const [deliveryNoteDocs, setDeliveryNoteDocs] = useState([]);

  const currency = accounting?.currency || 'AED';
  const vatRate = accounting?.vatRate || 5;

  const { control, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm({
    resolver: zodResolver(sourceSchema),
    defaultValues: {
      sourceFrom: '', invoiceType: 'TAX_INVOICE', taxInvoiceId: '',
      chicksRate: '', quantityPurchased: '', focPercentage: '',
      invoiceDate: '', deliveryDate: '',
    },
  });

  useEffect(() => {
    if (editData) {
      setTaxInvoiceDocs(editData.taxInvoiceDocs || []);
      setTransferProofs(editData.transferProofs || []);
      setDeliveryNoteDocs(editData.deliveryNoteDocs || []);
      reset({
        sourceFrom: (typeof editData.sourceFrom === 'object' ? editData.sourceFrom?._id : editData.sourceFrom) || '',
        invoiceType: editData.invoiceType || 'TAX_INVOICE',
        taxInvoiceId: editData.taxInvoiceId || '',
        chicksRate: editData.chicksRate?.toString() || '',
        quantityPurchased: editData.quantityPurchased?.toString() || '',
        focPercentage: editData.focPercentage?.toString() || '',
        invoiceDate: editData.invoiceDate?.slice(0, 10) || '',
        deliveryDate: editData.deliveryDate?.slice(0, 10) || '',
      });
    } else {
      setTaxInvoiceDocs([]);
      setTransferProofs([]);
      setDeliveryNoteDocs([]);
      reset({
        sourceFrom: '', invoiceType: 'TAX_INVOICE', taxInvoiceId: '',
        chicksRate: '', quantityPurchased: '', focPercentage: '',
        invoiceDate: '', deliveryDate: new Date().toISOString().slice(0, 10),
      });
    }
  }, [editData, reset, open]);

  const watchInvoiceType = watch('invoiceType');
  const watchRate = watch('chicksRate');
  const watchQty = watch('quantityPurchased');
  const watchFoc = watch('focPercentage');
  const isTax = watchInvoiceType === 'TAX_INVOICE';

  const rateNum = parseNum(watchRate);
  const qtyNum = parseNum(watchQty);
  const focPct = parseNum(watchFoc);
  const focChicks = Math.round(qtyNum * (focPct / 100));
  const totalChicks = qtyNum + focChicks;
  const subtotal = qtyNum * rateNum;
  const vatAmount = isTax ? subtotal * (vatRate / 100) : 0;
  const grandTotal = subtotal + vatAmount;

  const businessOptions = useMemo(() => {
    const opts = businesses.map((b) => ({ value: b._id, label: b.companyName }));
    if (pendingBiz && !opts.some((o) => o.value === pendingBiz._id)) {
      opts.unshift({ value: pendingBiz._id, label: pendingBiz.companyName });
    }
    return opts;
  }, [businesses, pendingBiz]);

  const invoiceTypeOptions = INVOICE_TYPES.map((v) => ({ value: v, label: t(`batches.invoiceTypes.${v}`), icon: INVOICE_TYPE_ICONS[v] }));

  const onSubmit = async (formData) => {
    setSaving(true);
    try {
      const payload = {
        batch: batchId,
        sourceFrom: formData.sourceFrom || null,
        invoiceType: formData.invoiceType || 'TAX_INVOICE',
        taxInvoiceId: formData.taxInvoiceId || '',
        chicksRate: rateNum, quantityPurchased: qtyNum,
        focPercentage: focPct, totalChicks,
        subtotal, vatAmount, grandTotal,
        invoiceDate: formData.invoiceDate || null,
        deliveryDate: formData.deliveryDate || null,
        taxInvoiceDocs: taxInvoiceDocs.map((m) => m._id),
        transferProofs: transferProofs.map((m) => m._id),
        deliveryNoteDocs: deliveryNoteDocs.map((m) => m._id),
      };

      if (editData?._id) {
        await update(editData._id, payload);
        toast({ title: t('batches.sourceUpdated') });
      } else {
        const tempId = `temp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        await create(tempId, payload, ['taxInvoiceDocs', 'transferProofs', 'deliveryNoteDocs']);
        toast({ title: t('batches.sourceCreated') });
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
            {editData ? t('batches.editSource') : t('batches.addSource')}
          </Text>
          <Pressable onPress={onClose} hitSlop={8}>
            <X size={20} color="hsl(150, 10%, 45%)" />
          </Pressable>
        </View>
        <Separator />
        <ScrollView className="flex-1 px-4" contentContainerClassName="py-4 gap-4" keyboardShouldPersistTaps="handled">
          <View className="gap-2">
            <Label>{t('batches.sourceFrom')}</Label>
            <Controller control={control} name="sourceFrom"
              render={({ field: { value, onChange } }) => (
                <Select value={value} onValueChange={onChange} options={businessOptions} placeholder={t('batches.selectSupplier')} label={t('batches.sourceFrom')} onCreateNew={(searchText) => { setBizInitialName(searchText || ''); setQuickAddBiz(true); }} createNewLabel={t('businesses.addBusiness', 'Add Business')} />
              )}
            />
          </View>

          <View className="gap-2">
            <Label>{t('batches.invoiceType')}<RequiredStar /></Label>
            <Controller control={control} name="invoiceType"
              render={({ field: { value, onChange } }) => (
                <EnumButtonSelect value={value} onChange={onChange} options={invoiceTypeOptions} columns={3} />
              )}
            />
            <FieldError error={errors.invoiceType} />
          </View>

          {isTax && (
            <View className="gap-2">
              <Label>{t('batches.taxInvoiceId')}<RequiredStar /></Label>
              <Controller control={control} name="taxInvoiceId"
                render={({ field: { value, onChange } }) => (
                  <Input value={value} onChangeText={onChange} placeholder={t('batches.invoiceIdPlaceholder')} />
                )}
              />
              <FieldError error={errors.taxInvoiceId} />
            </View>
          )}

          <View className="gap-2">
            <Label>{t('batches.chicksRate')}</Label>
            <Controller control={control} name="chicksRate"
              render={({ field: { value, onChange } }) => (
                <Input value={value} onChangeText={onChange} keyboardType="decimal-pad" placeholder="0.00" />
              )}
            />
          </View>

          <View className="gap-2">
            <Label>{t('batches.quantityPurchased')}</Label>
            <Controller control={control} name="quantityPurchased"
              render={({ field: { value, onChange } }) => (
                <Input value={value} onChangeText={onChange} keyboardType="number-pad" placeholder="0" />
              )}
            />
          </View>

          <View className="gap-2">
            <Label>{t('batches.focPercentage')}</Label>
            <Controller control={control} name="focPercentage"
              render={({ field: { value, onChange } }) => (
                <Input value={value} onChangeText={onChange} keyboardType="decimal-pad" placeholder="0" />
              )}
            />
          </View>

          <View className="rounded-lg border border-border bg-muted/30 px-3 py-2.5 gap-1">
            <View className="flex-row justify-between">
              <Text className="text-xs text-muted-foreground">{t('batches.totalChicksField')}</Text>
              <Text className="text-sm font-semibold text-foreground">{totalChicks.toLocaleString()}</Text>
            </View>
            <View className="flex-row justify-between">
              <Text className="text-xs text-muted-foreground">{t('batches.subtotal')}</Text>
              <Text className="text-sm text-foreground" style={{ fontVariant: ['tabular-nums'] }}>
                {currency} {subtotal.toFixed(2)}
              </Text>
            </View>
            {isTax && (
              <View className="flex-row justify-between">
                <Text className="text-xs text-muted-foreground">{t('batches.vat')}</Text>
                <Text className="text-sm text-foreground" style={{ fontVariant: ['tabular-nums'] }}>
                  {currency} {vatAmount.toFixed(2)}
                </Text>
              </View>
            )}
            <View className="flex-row justify-between">
              <Text className="text-xs font-semibold text-foreground">{t('batches.grandTotal')}</Text>
              <Text className="text-sm font-bold text-foreground" style={{ fontVariant: ['tabular-nums'] }}>
                {currency} {grandTotal.toFixed(2)}
              </Text>
            </View>
          </View>

          <View className="gap-2">
            <Label>{t('batches.invoiceDate')}</Label>
            <Controller control={control} name="invoiceDate"
              render={({ field: { value, onChange } }) => (
                <DatePicker value={value} onChange={onChange} label={t('batches.invoiceDate')} />
              )}
            />
          </View>
          <View className="gap-2">
            <Label>{t('batches.deliveryDate')}</Label>
            <Controller control={control} name="deliveryDate"
              render={({ field: { value, onChange } }) => (
                <DatePicker value={value} onChange={onChange} label={t('batches.deliveryDate')} />
              )}
            />
          </View>

          <Separator />

          <MultiFileUpload
            label={t('batches.taxInvoiceDocs', 'Tax Invoice Documents')}
            files={taxInvoiceDocs}
            onAdd={(media) => setTaxInvoiceDocs((prev) => [...prev, media])}
            onRemove={(index) => setTaxInvoiceDocs((prev) => prev.filter((_, i) => i !== index))}
            entityType="source"
            entityId={editData?._id}
            category="sources"
          />

          <MultiFileUpload
            label={t('batches.transferProofs', 'Transfer Proofs')}
            files={transferProofs}
            onAdd={(media) => setTransferProofs((prev) => [...prev, media])}
            onRemove={(index) => setTransferProofs((prev) => prev.filter((_, i) => i !== index))}
            entityType="source"
            entityId={editData?._id}
            category="sources"
          />

          <MultiFileUpload
            label={t('batches.deliveryNoteDocs', 'Delivery Note Documents')}
            files={deliveryNoteDocs}
            onAdd={(media) => setDeliveryNoteDocs((prev) => [...prev, media])}
            onRemove={(index) => setDeliveryNoteDocs((prev) => prev.filter((_, i) => i !== index))}
            entityType="source"
            entityId={editData?._id}
            category="sources"
          />
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
          setValue('sourceFrom', biz._id, { shouldDirty: true });
          toast({ title: `${biz.companyName} ${t('common.created', 'created')}` });
        }}
      />
    </Modal>
  );
}
