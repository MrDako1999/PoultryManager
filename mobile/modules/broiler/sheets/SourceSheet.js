import { useState, useEffect, useMemo } from 'react';
import { View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { PackagePlus } from 'lucide-react-native';
import SheetInput from '@/components/SheetInput';
import Select from '@/components/ui/Select';
import EnumButtonSelect from '@/components/ui/EnumButtonSelect';
import DatePicker from '@/components/ui/DatePicker';
import MultiFileUpload from '@/components/MultiFileUpload';
import QuickAddBusinessSheet from '@/shared/sheets/QuickAddBusinessSheet';
import FormSheet from '@/components/FormSheet';
import {
  FormSection, FormField, SummaryCard, SummaryRow, CardDivider,
} from '@/components/FormSheetParts';
import { useHeroSheetTokens } from '@/components/HeroSheetScreen';
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

export default function SourceSheet({ open, onClose, batchId, editData }) {
  const { t } = useTranslation();
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

  const invoiceTypeOptions = useMemo(
    () => INVOICE_TYPES.map((v) => ({ value: v, label: t(`batches.invoiceTypes.${v}`), icon: INVOICE_TYPE_ICONS[v] })),
    [t]
  );

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

  const fmtMoney = (n) => `${currency} ${(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <>
      <FormSheet
        open={open}
        onClose={onClose}
        title={editData ? t('batches.editSource') : t('batches.addSource')}
        subtitle={t(`batches.invoiceTypes.${watchInvoiceType}`, '')}
        icon={PackagePlus}
        onSubmit={handleSubmit(onSubmit)}
        submitLabel={editData ? t('common.save') : t('common.create')}
        loading={saving}
      >
        {/* Supplier */}
        <FormSection title={t('batches.sourceSupplier', 'Supplier & Invoice')}>
          <FormField label={t('batches.sourceFrom')}>
            <Controller
              control={control}
              name="sourceFrom"
              render={({ field: { value, onChange } }) => (
                <Select
                  value={value}
                  onValueChange={onChange}
                  options={businessOptions}
                  placeholder={t('batches.selectSupplier')}
                  label={t('batches.sourceFrom')}
                  onCreateNew={(searchText) => { setBizInitialName(searchText || ''); setQuickAddBiz(true); }}
                  createNewLabel={t('businesses.addBusiness', 'Add Business')}
                />
              )}
            />
          </FormField>

          <FormField label={t('batches.invoiceType')} required error={errors.invoiceType?.message}>
            <Controller
              control={control}
              name="invoiceType"
              render={({ field: { value, onChange } }) => (
                <EnumButtonSelect value={value} onChange={onChange} options={invoiceTypeOptions} columns={3} />
              )}
            />
          </FormField>

          {isTax ? (
            <Controller
              control={control}
              name="taxInvoiceId"
              render={({ field: { value, onChange } }) => (
                <SheetInput
                  label={`${t('batches.taxInvoiceId')} *`}
                  value={value}
                  onChangeText={onChange}
                  placeholder={t('batches.invoiceIdPlaceholder')}
                  error={errors.taxInvoiceId?.message}
                />
              )}
            />
          ) : null}
        </FormSection>

        {/* Pricing */}
        <FormSection title={t('batches.sourcePricing', 'Pricing & Quantity')}>
          <Controller
            control={control}
            name="chicksRate"
            render={({ field: { value, onChange } }) => (
              <SheetInput
                label={t('batches.chicksRate')}
                value={value}
                onChangeText={onChange}
                keyboardType="decimal-pad"
                placeholder="0.00"
                suffix={<CurrencyTag label={currency} />}
              />
            )}
          />
          <Controller
            control={control}
            name="quantityPurchased"
            render={({ field: { value, onChange } }) => (
              <SheetInput
                label={t('batches.quantityPurchased')}
                value={value}
                onChangeText={onChange}
                keyboardType="number-pad"
                placeholder="0"
              />
            )}
          />
          <Controller
            control={control}
            name="focPercentage"
            render={({ field: { value, onChange } }) => (
              <SheetInput
                label={t('batches.focPercentage')}
                value={value}
                onChangeText={onChange}
                keyboardType="decimal-pad"
                placeholder="0"
                suffix={<CurrencyTag label="%" />}
              />
            )}
          />

          <SummaryCard>
            <SummaryRow
              label={t('batches.totalChicksField')}
              value={totalChicks.toLocaleString('en-US')}
            />
            <SummaryRow label={t('batches.subtotal')} value={fmtMoney(subtotal)} />
            {isTax ? (
              <SummaryRow label={t('batches.vat')} value={fmtMoney(vatAmount)} />
            ) : null}
            <CardDivider marginVertical={2} />
            <SummaryRow label={t('batches.grandTotal')} value={fmtMoney(grandTotal)} emphasis />
          </SummaryCard>
        </FormSection>

        {/* Dates */}
        <FormSection title={t('batches.sourceDates', 'Dates')}>
          <FormField label={t('batches.invoiceDate')}>
            <Controller
              control={control}
              name="invoiceDate"
              render={({ field: { value, onChange } }) => (
                <DatePicker value={value} onChange={onChange} label={t('batches.invoiceDate')} />
              )}
            />
          </FormField>
          <FormField label={t('batches.deliveryDate')}>
            <Controller
              control={control}
              name="deliveryDate"
              render={({ field: { value, onChange } }) => (
                <DatePicker value={value} onChange={onChange} label={t('batches.deliveryDate')} />
              )}
            />
          </FormField>
        </FormSection>

        {/* Documents */}
        <FormSection title={t('batches.sourceDocuments', 'Documents')}>
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
        </FormSection>
      </FormSheet>

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
    </>
  );
}

function CurrencyTag({ label }) {
  const { mutedColor, dark } = useHeroSheetTokens();
  return (
    <View
      style={{
        backgroundColor: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
        borderRadius: 8,
        paddingHorizontal: 8,
        paddingVertical: 3,
      }}
    >
      <Text
        style={{
          fontSize: 11,
          fontFamily: 'Poppins-SemiBold',
          color: mutedColor,
          letterSpacing: 0.4,
        }}
      >
        {label}
      </Text>
    </View>
  );
}
