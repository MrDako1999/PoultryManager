import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { View, Text, Dimensions, Animated, Keyboard, Platform, StyleSheet, Pressable } from 'react-native';
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
import KeyboardToolbar, { KEYBOARD_TOOLBAR_ID } from '@/components/ui/KeyboardToolbar';
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
import useFormStepper from '@/hooks/useFormStepper';
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

/**
 * StageBlock - wraps a stage section, tracks its layout y, and fires
 * `onFirstLayout(y, height)` exactly once on its first measurement so the
 * parent can scroll it into view at the moment the layout is actually known.
 */
function StageBlock({ stageKey, onLayoutY, onFirstLayout, children, animateIn }) {
  const opacity = useRef(new Animated.Value(animateIn ? 0 : 1)).current;
  const translateY = useRef(new Animated.Value(animateIn ? 8 : 0)).current;
  const firstLayoutDone = useRef(false);

  useEffect(() => {
    if (!animateIn) return;
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 240, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 240, useNativeDriver: true }),
    ]).start();
  }, [animateIn, opacity, translateY]);

  return (
    <Animated.View
      onLayout={(e) => {
        const { y, height } = e.nativeEvent.layout;
        onLayoutY?.(stageKey, y, height);
        if (!firstLayoutDone.current && height > 0) {
          firstLayoutDone.current = true;
          onFirstLayout?.(stageKey, y, height);
        }
      }}
      style={{ opacity, transform: [{ translateY }] }}
    >
      {children}
    </Animated.View>
  );
}

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
  const [scrollViewHeight, setScrollViewHeight] = useState(0);
  const stageLayouts = useRef({});
  const seenStagesRef = useRef(new Set());
  const keyboardHeightRef = useRef(0);
  const windowHeight = Dimensions.get('window').height;

  const invoiceIdRef = useRef(null);
  const datePickerRef = useRef(null);
  const tradingCompanyRef = useRef(null);
  const descriptionRef = useRef(null);
  const amountRef = useRef(null);

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
    seenStagesRef.current = new Set(editData
      ? ['invoiceType', 'category', 'invoiceIdAndDate', 'tradingCompany', 'description', 'amount', 'attachments']
      : ['invoiceType']);
  }, [editData, reset, open]);

  const watchInvoiceType = watch('invoiceType');
  const watchCategory = watch('category');
  const watchInvoiceId = watch('invoiceId');
  const watchTradingCompany = watch('tradingCompany');
  const watchDescription = watch('description');
  const watchDate = watch('expenseDate');
  const watchGross = watch('grossAmount');
  const isTaxInvoice = watchInvoiceType === 'TAX_INVOICE';
  const requiresInvoiceId = isTaxInvoice;
  const requiresTradingCompany = isTaxInvoice || watchInvoiceType === 'CASH_MEMO';
  const showInvoiceIdField = !!watchInvoiceType && watchInvoiceType !== 'NO_INVOICE';

  const { gross: grossNum, vat: taxableAmount, total: totalAmount } = useMemo(
    () => computeAmounts({ entered: watchGross, isTaxInvoice, vatRate }),
    [watchGross, isTaxInvoice, vatRate]
  );

  // Stage progression uses a "high-water-mark" - once a stage has been
  // unlocked, it stays unlocked even if the user temporarily blanks the
  // gating field.
  const liveStage = useMemo(() => {
    if (!watchInvoiceType) return 0;
    if (!watchCategory) return 1;
    const stage3Ok = requiresInvoiceId
      ? (!!watchInvoiceId && !!watchDate)
      : !!watchDate;
    if (!stage3Ok) return 2;
    if (requiresTradingCompany && !watchTradingCompany) return 3;
    if (!watchDescription) return 4;
    if (!(grossNum > 0)) return 5;
    return 6;
  }, [
    watchInvoiceType, watchCategory, watchInvoiceId, watchDate,
    watchTradingCompany, watchDescription, grossNum,
    requiresInvoiceId, requiresTradingCompany,
  ]);

  const [maxStage, setMaxStage] = useState(0);
  useEffect(() => {
    if (liveStage > maxStage) setMaxStage(liveStage);
  }, [liveStage, maxStage]);

  useEffect(() => {
    setMaxStage(editData ? 6 : 0);
  }, [editData, open]);

  const showStage = {
    invoiceType: true,
    category: maxStage >= 1,
    invoiceIdAndDate: maxStage >= 2,
    tradingCompany: maxStage >= 3,
    description: maxStage >= 4,
    amount: maxStage >= 5,
    attachments: maxStage >= 6,
  };

  const handleStageLayout = useCallback((key, y, height) => {
    stageLayouts.current[key] = { y, height };
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

  const handleStageFirstLayout = useCallback((key, y) => {
    if (seenStagesRef.current.has(key)) return;
    seenStagesRef.current.add(key);
    if (key === 'invoiceType') return;
    scrollYIntoView(y, { offsetRatio: 0.22 });
  }, [scrollYIntoView]);

  const scrollStageAboveKeyboard = useCallback((stageKey) => {
    const layout = stageLayouts.current[stageKey];
    if (!layout) return;
    const padding = 16;
    const targetBottomY = layout.y + layout.height + padding;
    const desiredTopY = targetBottomY - visibleViewport();
    if (desiredTopY <= 0) return;
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ y: desiredTopY, animated: true });
    });
  }, [visibleViewport]);

  const scrollStageIntoBand = useCallback((stageKey) => {
    const layout = stageLayouts.current[stageKey];
    if (!layout) return;
    scrollYIntoView(layout.y, { offsetRatio: 0.22 });
  }, [scrollYIntoView]);

  const stepperSteps = useMemo(() => [
    { key: 'invoiceType', available: showStage.invoiceType, onActivate: () => { Keyboard.dismiss(); scrollStageIntoBand('invoiceType'); } },
    { key: 'category', available: showStage.category, onActivate: () => { Keyboard.dismiss(); scrollStageIntoBand('category'); } },
    { key: 'invoiceId', available: showStage.invoiceIdAndDate && showInvoiceIdField, onActivate: () => { invoiceIdRef.current?.focus(); } },
    { key: 'expenseDate', available: showStage.invoiceIdAndDate, onActivate: () => { datePickerRef.current?.open(); } },
    { key: 'tradingCompany', available: showStage.tradingCompany, onActivate: () => { tradingCompanyRef.current?.open(); } },
    { key: 'description', available: showStage.description, onActivate: () => { descriptionRef.current?.focus(); } },
    { key: 'amount', available: showStage.amount, onActivate: () => { amountRef.current?.focus(); } },
    { key: 'attachments', available: showStage.attachments, onActivate: () => { Keyboard.dismiss(); scrollStageIntoBand('attachments'); } },
  ], [showStage, showInvoiceIdField, scrollStageIntoBand]);

  const stepper = useFormStepper(stepperSteps);

  useEffect(() => {
    if (open) stepper.setCurrentKey(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

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
            const h = e.nativeEvent.layout.height;
            scrollViewHeightRef.current = h;
            setScrollViewHeight(h);
          },
        }}
        scrollContentStyle={{
          paddingBottom: Math.max((scrollViewHeight || windowHeight) * 0.55, 220),
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
                const layout = stageLayouts.current.amount;
                if (layout) scrollYIntoView(layout.y, { offsetRatio: 0.18 });
              }}
              t={t}
            />
          ) : null
        }
      >
        {/* Stage 1 - Invoice Type */}
        <StageBlock stageKey="invoiceType" onLayoutY={handleStageLayout} onFirstLayout={handleStageFirstLayout}>
          <FormSection title={t('batches.invoiceType')}>
            <FormField label={t('batches.invoiceType')} required error={errors.invoiceType?.message}>
              <Controller
                control={control}
                name="invoiceType"
                render={({ field: { value, onChange } }) => (
                  <EnumButtonSelect
                    value={value}
                    onChange={(v) => { onChange(v); stepper.setCurrentKey('invoiceType'); requestAnimationFrame(() => stepper.next()); }}
                    options={invoiceTypeOptions}
                    columns={3}
                  />
                )}
              />
            </FormField>
          </FormSection>
        </StageBlock>

        {/* Stage 2 - Category */}
        {showStage.category ? (
          <StageBlock stageKey="category" onLayoutY={handleStageLayout} onFirstLayout={handleStageFirstLayout} animateIn>
            <FormSection title={t('batches.expenseCategory')}>
              <FormField label={t('batches.expenseCategory')} required error={errors.category?.message}>
                <Controller
                  control={control}
                  name="category"
                  render={({ field: { value, onChange } }) => (
                    <EnumButtonSelect
                      value={value}
                      onChange={(v) => { onChange(v); stepper.setCurrentKey('category'); requestAnimationFrame(() => stepper.next()); }}
                      options={categoryOptions}
                      columns={3}
                      compact
                    />
                  )}
                />
              </FormField>
            </FormSection>
          </StageBlock>
        ) : null}

        {/* Stage 3 - Invoice ID + Date */}
        {showStage.invoiceIdAndDate ? (
          <StageBlock stageKey="invoiceIdAndDate" onLayoutY={handleStageLayout} onFirstLayout={handleStageFirstLayout} animateIn>
            <FormSection title={t('batches.invoiceDetails', 'Invoice Details')}>
              {showInvoiceIdField ? (
                <Controller
                  control={control}
                  name="invoiceId"
                  render={({ field: { value, onChange } }) => (
                    <SheetInput
                      ref={invoiceIdRef}
                      label={`${t('batches.invoiceIdLabel')}${requiresInvoiceId ? ' *' : ''}`}
                      value={value}
                      onChangeText={onChange}
                      onFocus={() => { stepper.setCurrentKey('invoiceId'); scrollStageAboveKeyboard('invoiceIdAndDate'); }}
                      placeholder={t('batches.invoiceIdPlaceholder')}
                      inputAccessoryViewID={KEYBOARD_TOOLBAR_ID}
                      returnKeyType="next"
                      onSubmitEditing={() => stepper.next()}
                      blurOnSubmit={false}
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
                      ref={datePickerRef}
                      value={value}
                      onChange={(v) => { onChange(v); requestAnimationFrame(() => stepper.next()); }}
                      onOpen={() => { stepper.setCurrentKey('expenseDate'); scrollStageIntoBand('invoiceIdAndDate'); }}
                      label={t('batches.expenseDate')}
                    />
                  )}
                />
              </FormField>
            </FormSection>
          </StageBlock>
        ) : null}

        {/* Stage 4 - Trading Company */}
        {showStage.tradingCompany ? (
          <StageBlock stageKey="tradingCompany" onLayoutY={handleStageLayout} onFirstLayout={handleStageFirstLayout} animateIn>
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
                      ref={tradingCompanyRef}
                      value={value}
                      onValueChange={(v) => {
                        onChange(v ?? '');
                        if (v) requestAnimationFrame(() => stepper.next());
                      }}
                      onOpen={() => { stepper.setCurrentKey('tradingCompany'); scrollStageIntoBand('tradingCompany'); }}
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
          </StageBlock>
        ) : null}

        {/* Stage 5 - Description */}
        {showStage.description ? (
          <StageBlock stageKey="description" onLayoutY={handleStageLayout} onFirstLayout={handleStageFirstLayout} animateIn>
            <FormSection title={t('batches.expenseDescription')}>
              <Controller
                control={control}
                name="description"
                render={({ field: { value, onChange } }) => (
                  <SheetInput
                    ref={descriptionRef}
                    label={`${t('batches.expenseDescription')} *`}
                    value={value}
                    onChangeText={onChange}
                    onFocus={() => { stepper.setCurrentKey('description'); scrollStageAboveKeyboard('description'); }}
                    placeholder={t('batches.expenseDescriptionPlaceholder')}
                    inputAccessoryViewID={KEYBOARD_TOOLBAR_ID}
                    returnKeyType="next"
                    onSubmitEditing={() => stepper.next()}
                    blurOnSubmit={false}
                    error={errors.description?.message}
                  />
                )}
              />
            </FormSection>
          </StageBlock>
        ) : null}

        {/* Stage 6 - Amount + breakdown */}
        {showStage.amount ? (
          <StageBlock stageKey="amount" onLayoutY={handleStageLayout} onFirstLayout={handleStageFirstLayout} animateIn>
            <FormSection title={isTaxInvoice ? t('batches.totalAmount') : t('batches.grossAmount')}>
              <Controller
                control={control}
                name="grossAmount"
                render={({ field: { value, onChange } }) => (
                  <SheetInput
                    ref={amountRef}
                    label={`${isTaxInvoice ? t('batches.totalAmount') : t('batches.grossAmount')} *`}
                    value={value}
                    onChangeText={onChange}
                    onFocus={() => { stepper.setCurrentKey('amount'); scrollStageAboveKeyboard('amount'); }}
                    keyboardType="decimal-pad"
                    placeholder="0.00"
                    inputAccessoryViewID={KEYBOARD_TOOLBAR_ID}
                    returnKeyType="done"
                    onSubmitEditing={() => { Keyboard.dismiss(); stepper.next(); }}
                    blurOnSubmit
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
          </StageBlock>
        ) : null}

        {/* Stage 7 - Attachments */}
        {showStage.attachments ? (
          <StageBlock stageKey="attachments" onLayoutY={handleStageLayout} onFirstLayout={handleStageFirstLayout} animateIn>
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
          </StageBlock>
        ) : null}
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

      <KeyboardToolbar
        onPrev={() => stepper.prev()}
        onNext={() => stepper.next()}
        canGoPrev={stepper.canGoPrev}
        canGoNext={stepper.canGoNext}
      />
    </>
  );
}

function ExpenseStickySummary({ currency, isTaxInvoice, categoryLabel, date, grossNum, taxableAmount, totalAmount, onPress, t }) {
  const tokens = useHeroSheetTokens();
  const isRTL = useIsRTL();
  const { dark, sheetBg, borderColor, textColor, mutedColor } = tokens;

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
