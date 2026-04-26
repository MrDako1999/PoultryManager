import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { View, Text, Dimensions, Keyboard, Platform, StyleSheet, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Receipt, FileCheck2, Wallet } from 'lucide-react-native';
import SheetInput from '@/components/SheetInput';
import Select from '@/components/ui/Select';
import EnumButtonSelect from '@/components/ui/EnumButtonSelect';
import DatePicker from '@/components/ui/DatePicker';
import CollapsedAttachmentSection from '@/components/CollapsedAttachmentSection';
import QuickAddBusinessSheet from '@/shared/sheets/QuickAddBusinessSheet';
import FormSheet from '@/components/FormSheet';
import {
  FormSection, FormField, SummaryCard, SummaryRow, CardDivider,
} from '@/components/FormSheetParts';
import { useHeroSheetTokens } from '@/components/HeroSheetScreen';
import { useIsRTL } from '@/stores/localeStore';
import useLocalQuery from '@/hooks/useLocalQuery';
import useSettings from '@/hooks/useSettings';
import useOfflineMutation from '@/hooks/useOfflineMutation';
import { INVOICE_TYPES, INVOICE_TYPE_ICONS, EXPENSE_CATEGORIES, EXPENSE_CATEGORY_ICONS } from '@/lib/constants';
import { useToast } from '@/components/ui/Toast';
import { rowDirection, trailingAlignment, textAlignStart } from '@/lib/rtl';

const parseNum = (v) => { const n = parseFloat(String(v).replace(/,/g, '')); return isNaN(n) ? 0 : n; };

// Frontend semantics: entered amount is the TOTAL (incl. VAT) on Tax Invoice;
// gross + VAT are back-derived. On non-tax invoices entered = gross = total.
const computeAmounts = ({ entered, isTaxInvoice, vatRate }) => {
  const enteredNum = parseNum(entered);
  const gross = isTaxInvoice ? enteredNum / (1 + vatRate / 100) : enteredNum;
  const vat = isTaxInvoice ? enteredNum - gross : 0;
  return { gross, vat, total: enteredNum };
};

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

export default function ExpenseSheet({ open, onClose, batchId, editData }) {
  const { t } = useTranslation();
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

  const scrollRef = useRef(null);
  const scrollViewHeightRef = useRef(0);
  const sectionLayouts = useRef({});
  const keyboardHeightRef = useRef(0);
  const windowHeight = Dimensions.get('window').height;

  useEffect(() => {
    const onShow = (e) => {
      keyboardHeightRef.current = e?.endCoordinates?.height || 0;
    };
    const onHide = () => {
      keyboardHeightRef.current = 0;
    };
    const showSub = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', onShow);
    const hideSub = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', onHide);
    return () => { showSub.remove(); hideSub.remove(); };
  }, []);

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
      const editEntered = editData.invoiceType === 'TAX_INVOICE' && editData.totalAmount
        ? Number(editData.totalAmount).toString()
        : editData.grossAmount?.toString() || '';
      reset({
        expenseDate: editData.expenseDate?.slice(0, 10) || new Date().toISOString().slice(0, 10),
        invoiceType: editData.invoiceType || '',
        invoiceId: editData.invoiceId || '',
        category: editData.category || '',
        description: editData.description || '',
        tradingCompany: (typeof editData.tradingCompany === 'object' ? editData.tradingCompany?._id : editData.tradingCompany) || '',
        grossAmount: editEntered,
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
  const watchDate = watch('expenseDate');
  const watchGross = watch('grossAmount');
  const isTaxInvoice = watchInvoiceType === 'TAX_INVOICE';
  const requiresInvoiceId = isTaxInvoice;
  const requiresTradingCompany = isTaxInvoice || watchInvoiceType === 'CASH_MEMO';
  const showInvoiceIdField = watchInvoiceType !== 'NO_INVOICE';

  const { gross: grossNum, vat: taxableAmount, total: totalAmount } = useMemo(
    () => computeAmounts({ entered: watchGross, isTaxInvoice, vatRate }),
    [watchGross, isTaxInvoice, vatRate]
  );

  const handleSectionLayout = useCallback((key, e) => {
    const { y, height } = e.nativeEvent.layout;
    sectionLayouts.current[key] = { y, height };
  }, []);

  const visibleViewport = useCallback(() => {
    const viewH = scrollViewHeightRef.current || windowHeight;
    return Math.max(180, viewH - keyboardHeightRef.current);
  }, [windowHeight]);

  const scrollYIntoView = useCallback((y, { offsetRatio = 0.30 } = {}) => {
    if (typeof y !== 'number' || !scrollRef.current) return;
    const target = Math.max(0, y - visibleViewport() * offsetRatio);
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ y: target, animated: true });
    });
  }, [visibleViewport]);

  const scrollSectionAboveKeyboard = useCallback((sectionKey) => {
    const layout = sectionLayouts.current[sectionKey];
    if (!layout) return;
    const padding = 16;
    const targetBottomY = layout.y + layout.height + padding;
    const desiredTopY = targetBottomY - visibleViewport();
    if (desiredTopY <= 0) return;
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ y: desiredTopY, animated: true });
    });
  }, [visibleViewport]);

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
  const categoryOptions = useMemo(
    () => EXPENSE_CATEGORIES.map((v) => ({ value: v, label: t(`batches.expenseCategories.${v}`), icon: EXPENSE_CATEGORY_ICONS[v] })),
    [t]
  );

  const onSubmit = async (formData) => {
    setSaving(true);
    try {
      const { gross, vat, total } = computeAmounts({
        entered: formData.grossAmount,
        isTaxInvoice: formData.invoiceType === 'TAX_INVOICE',
        vatRate,
      });
      const payload = {
        batch: batchId,
        expenseDate: formData.expenseDate,
        invoiceType: formData.invoiceType,
        invoiceId: formData.invoiceType === 'NO_INVOICE' ? '' : formData.invoiceId,
        category: formData.category || 'OTHERS',
        description: formData.description || '',
        tradingCompany: formData.tradingCompany || null,
        grossAmount: gross,
        taxableAmount: vat,
        totalAmount: total,
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

  const formatMoney = (n) => `${currency} ${(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const summaryHasContent = totalAmount > 0;
  const categoryLabel = watchCategory ? t(`batches.expenseCategories.${watchCategory}`) : '';

  return (
    <>
      <FormSheet
        open={open}
        onClose={onClose}
        title={editData ? t('batches.editExpense') : t('batches.addExpense')}
        subtitle={categoryLabel || t('batches.expenseSubtitle', 'Track a new expense')}
        icon={Wallet}
        onSubmit={handleSubmit(onSubmit)}
        submitLabel={editData ? t('common.save') : t('common.create')}
        loading={saving}
        scrollViewProps={{
          ref: scrollRef,
          onLayout: (e) => {
            scrollViewHeightRef.current = e.nativeEvent.layout.height;
          },
          keyboardDismissMode: 'on-drag',
          nestedScrollEnabled: true,
        }}
        scrollContentStyle={{
          paddingBottom: 48,
        }}
        footerExtra={
          summaryHasContent ? (
            <ExpenseStickySummary
              currency={currency}
              isTaxInvoice={isTaxInvoice}
              categoryLabel={categoryLabel}
              date={watchDate}
              grossNum={grossNum}
              taxableAmount={taxableAmount}
              totalAmount={totalAmount}
              onPress={() => {
                const layout = sectionLayouts.current.amount;
                if (layout) scrollYIntoView(layout.y, { offsetRatio: 0.18 });
              }}
              t={t}
            />
          ) : null
        }
      >
        <View onLayout={(e) => handleSectionLayout('invoiceType', e)}>
          <FormSection title={t('batches.invoiceType')}>
            <FormField label={t('batches.invoiceType')} required error={errors.invoiceType?.message}>
              <Controller
                control={control}
                name="invoiceType"
                render={({ field: { value, onChange } }) => (
                  <EnumButtonSelect
                    value={value}
                    onChange={onChange}
                    options={invoiceTypeOptions}
                    columns={3}
                  />
                )}
              />
            </FormField>
          </FormSection>
        </View>

        <View onLayout={(e) => handleSectionLayout('category', e)}>
          <FormSection title={t('batches.expenseCategory')}>
            <FormField label={t('batches.expenseCategory')} required error={errors.category?.message}>
              <Controller
                control={control}
                name="category"
                render={({ field: { value, onChange } }) => (
                  <EnumButtonSelect
                    value={value}
                    onChange={onChange}
                    options={categoryOptions}
                    columns={3}
                    compact
                  />
                )}
              />
            </FormField>
          </FormSection>
        </View>

        <View onLayout={(e) => handleSectionLayout('invoiceDetails', e)}>
          <FormSection title={t('batches.invoiceDetails', 'Invoice Details')}>
            {showInvoiceIdField ? (
              <Controller
                control={control}
                name="invoiceId"
                render={({ field: { value, onChange } }) => (
                  <SheetInput
                    label={`${t('batches.invoiceIdLabel')}${requiresInvoiceId ? ' *' : ''}`}
                    value={value}
                    onChangeText={onChange}
                    onFocus={() => scrollSectionAboveKeyboard('invoiceDetails')}
                    placeholder={t('batches.invoiceIdPlaceholder')}
                    returnKeyType="done"
                    error={errors.invoiceId?.message}
                  />
                )}
              />
            ) : null}
            <FormField label={t('batches.expenseDate')} required error={errors.expenseDate?.message}>
              <Controller
                control={control}
                name="expenseDate"
                render={({ field: { value, onChange } }) => (
                  <DatePicker
                    value={value}
                    onChange={onChange}
                    label={t('batches.expenseDate')}
                  />
                )}
              />
            </FormField>
          </FormSection>
        </View>

        <View onLayout={(e) => handleSectionLayout('tradingCompany', e)}>
          <FormSection title={t('batches.tradingCompany')}>
            <FormField
              label={`${t('batches.tradingCompany')}${requiresTradingCompany ? ' *' : ''}`}
              error={errors.tradingCompany?.message}
            >
              <Controller
                control={control}
                name="tradingCompany"
                render={({ field: { value, onChange } }) => (
                  <Select
                    value={value}
                    onValueChange={(v) => onChange(v ?? '')}
                    options={businessOptions}
                    placeholder={t('batches.selectCompany')}
                    label={t('batches.tradingCompany')}
                    onCreateNew={(searchText) => { setBizInitialName(searchText || ''); setQuickAddBiz(true); }}
                    createNewLabel={t('businesses.addBusiness', 'Add Business')}
                    clearable
                  />
                )}
              />
            </FormField>
          </FormSection>
        </View>

        <View onLayout={(e) => handleSectionLayout('description', e)}>
          <FormSection title={t('batches.expenseDescription')}>
            <Controller
              control={control}
              name="description"
              render={({ field: { value, onChange } }) => (
                <SheetInput
                  label={`${t('batches.expenseDescription')} *`}
                  value={value}
                  onChangeText={onChange}
                  onFocus={() => scrollSectionAboveKeyboard('description')}
                  placeholder={t('batches.expenseDescriptionPlaceholder')}
                  returnKeyType="done"
                  error={errors.description?.message}
                />
              )}
            />
          </FormSection>
        </View>

        <View onLayout={(e) => handleSectionLayout('amount', e)}>
          <FormSection title={isTaxInvoice ? t('batches.totalAmount') : t('batches.grossAmount')}>
            <Controller
              control={control}
              name="grossAmount"
              render={({ field: { value, onChange } }) => (
                <SheetInput
                  label={`${isTaxInvoice ? t('batches.totalAmount') : t('batches.grossAmount')} *`}
                  value={value}
                  onChangeText={onChange}
                  onFocus={() => scrollSectionAboveKeyboard('amount')}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  returnKeyType="done"
                  onSubmitEditing={() => Keyboard.dismiss()}
                  suffix={<CurrencyTag label={currency} />}
                  error={errors.grossAmount?.message}
                />
              )}
            />
            {totalAmount > 0 ? (
              <SummaryCard>
                <SummaryRow label={t('batches.grossAmount', 'Net')} value={formatMoney(grossNum)} />
                {isTaxInvoice ? (
                  <SummaryRow label={`${t('batches.vat', 'VAT')} (${vatRate}%)`} value={formatMoney(taxableAmount)} />
                ) : null}
                <CardDivider marginVertical={2} />
                <SummaryRow label={t('batches.totalAmount', 'Total')} value={formatMoney(totalAmount)} emphasis />
              </SummaryCard>
            ) : null}
          </FormSection>
        </View>

        <View onLayout={(e) => handleSectionLayout('attachments', e)}>
          <FormSection title={t('batches.attachments', 'Attachments')}>
            <CollapsedAttachmentSection
              label={t('batches.receipt', 'Receipts')}
              files={receipts}
              onAdd={(media) => setReceipts((prev) => [...prev, media])}
              onRemove={(index) => setReceipts((prev) => prev.filter((_, i) => i !== index))}
              entityType="expense"
              entityId={editData?._id}
              category="expenses"
              icon={Receipt}
            />
            <CollapsedAttachmentSection
              label={t('batches.transferProofs', 'Transfer Proofs')}
              files={expTransferProofs}
              onAdd={(media) => setExpTransferProofs((prev) => [...prev, media])}
              onRemove={(index) => setExpTransferProofs((prev) => prev.filter((_, i) => i !== index))}
              entityType="expense"
              entityId={editData?._id}
              category="expenses"
              icon={FileCheck2}
            />
          </FormSection>
        </View>
      </FormSheet>

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
    </>
  );
}

function ExpenseStickySummary({ currency, isTaxInvoice, categoryLabel, date, grossNum, taxableAmount, totalAmount, onPress, t }) {
  const tokens = useHeroSheetTokens();
  const isRTL = useIsRTL();
  const { sheetBg, borderColor, textColor, mutedColor } = tokens;

  const fmt = (n) => `${currency} ${(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const eyebrow = [categoryLabel || t('batches.expenseSummary', 'Summary'), date || ''].filter(Boolean).join(' . ');

  return (
    <Pressable
      onPress={onPress}
      style={[
        stickyStyles.bar,
        {
          backgroundColor: sheetBg,
          borderTopColor: borderColor,
          flexDirection: rowDirection(isRTL),
        },
      ]}
    >
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          style={{
            fontSize: 10,
            fontFamily: 'Poppins-SemiBold',
            color: mutedColor,
            letterSpacing: 1.2,
            textTransform: 'uppercase',
            textAlign: textAlignStart(isRTL),
          }}
          numberOfLines={1}
        >
          {eyebrow}
        </Text>
        {isTaxInvoice ? (
          <Text
            style={{
              fontSize: 12,
              fontFamily: 'Poppins-Regular',
              color: mutedColor,
              marginTop: 2,
              textAlign: textAlignStart(isRTL),
            }}
            numberOfLines={1}
          >
            {`${t('batches.grossAmount', 'Net')} ${fmt(grossNum)} . ${t('batches.vat', 'VAT')} ${fmt(taxableAmount)}`}
          </Text>
        ) : null}
      </View>
      <View style={{ alignItems: trailingAlignment(isRTL) }}>
        <Text
          style={{
            fontSize: 10,
            fontFamily: 'Poppins-SemiBold',
            color: mutedColor,
            letterSpacing: 1.2,
            textTransform: 'uppercase',
          }}
        >
          {t('batches.totalAmount', 'Total')}
        </Text>
        <Text
          style={{
            fontSize: 16,
            fontFamily: 'Poppins-Bold',
            color: textColor,
            fontVariant: ['tabular-nums'],
          }}
        >
          {fmt(totalAmount)}
        </Text>
      </View>
    </Pressable>
  );
}

const stickyStyles = StyleSheet.create({
  bar: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    gap: 12,
  },
});

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
