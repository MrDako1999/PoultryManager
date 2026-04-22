import { useState, useEffect, useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Plus, Trash2, ShoppingBag, Check, ChevronLeft, ChevronRight,
} from 'lucide-react-native';
import SheetInput from '@/components/SheetInput';
import Select from '@/components/ui/Select';
import EnumButtonSelect from '@/components/ui/EnumButtonSelect';
import DatePicker from '@/components/ui/DatePicker';
import MultiFileUpload from '@/components/MultiFileUpload';
import QuickAddBusinessSheet from '@/shared/sheets/QuickAddBusinessSheet';
import FormSheet from '@/components/FormSheet';
import {
  FormSection, FormField, SummaryCard, SummaryRow, CardDivider, AddRowButton,
} from '@/components/FormSheetParts';
import { useHeroSheetTokens } from '@/components/HeroSheetScreen';
import { useIsRTL } from '@/stores/localeStore';
import CtaButton from '@/components/ui/CtaButton';
import useLocalQuery from '@/hooks/useLocalQuery';
import useSettings from '@/hooks/useSettings';
import useOfflineMutation from '@/hooks/useOfflineMutation';
import { SALE_METHODS, SALE_METHOD_ICONS, SALE_INVOICE_TYPES, SALE_INVOICE_TYPE_ICONS, PART_TYPES } from '@/lib/constants';
import { useToast } from '@/components/ui/Toast';
import { rowDirection, textAlignStart, textAlignEnd } from '@/lib/rtl';

const parseNum = (v) => { const n = parseFloat(String(v).replace(/,/g, '')); return isNaN(n) ? 0 : n; };
const fmtDec = (v) => { const n = Number(v || 0); return n ? n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ''; };

function addDays(dateStr, days) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

export default function SaleOrderSheet({ open, onClose, batchId, editData }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const accounting = useSettings('accounting');
  const [businesses] = useLocalQuery('businesses');
  const saleDefaults = useSettings('saleDefaults');
  const { create, update } = useOfflineMutation('saleOrders');
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState(0);
  const [quickAddBiz, setQuickAddBiz] = useState(false);
  const [quickAddBizField, setQuickAddBizField] = useState('customer');
  const [bizInitialName, setBizInitialName] = useState('');
  const [pendingBiz, setPendingBiz] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});

  const currency = accounting?.currency || 'AED';
  const vatRate = accounting?.vatRate || 5;

  // Step 0
  const [saleMethod, setSaleMethod] = useState('SLAUGHTERED');
  const [invoiceType, setInvoiceType] = useState('CASH_MEMO');
  const [saleDate, setSaleDate] = useState(new Date().toISOString().slice(0, 10));
  const [customer, setCustomer] = useState('');
  const [slaughterhouse, setSlaughterhouse] = useState('');
  const [slaughterhouseTouched, setSlaughterhouseTouched] = useState(false);
  const [slaughterDate, setSlaughterDate] = useState(addDays(new Date().toISOString().slice(0, 10), -1));
  const [slaughterDateTouched, setSlaughterDateTouched] = useState(false);
  const [slaughterInvoiceRef, setSlaughterInvoiceRef] = useState('');
  const [processingCost, setProcessingCost] = useState('');
  const [slaughterReportDocs, setSlaughterReportDocs] = useState([]);

  // Step 1 (slaughtered counts)
  const [chickensSent, setChickensSent] = useState('');
  const [condemnation, setCondemnation] = useState('');
  const [deathOnArrival, setDeathOnArrival] = useState('');
  const [rejections, setRejections] = useState('');
  const [shortage, setShortage] = useState('');
  const [bGradeCount, setBGradeCount] = useState('');

  // Weight rows
  const [wholeChickenItems, setWholeChickenItems] = useState([{ description: '', weightKg: '', ratePerKg: '' }]);
  const [liveBirdCount, setLiveBirdCount] = useState('');
  const [liveRatePerBird, setLiveRatePerBird] = useState('');
  const [liveWeightItems, setLiveWeightItems] = useState([{ description: '', weightKg: '', ratePerKg: '' }]);

  // Portions
  const [portions, setPortions] = useState([]);

  // Transport & discounts
  const [truckCount, setTruckCount] = useState('');
  const [truckRate, setTruckRate] = useState(saleDefaults?.transportRatePerTruck?.toString() || '');
  const [discountItems, setDiscountItems] = useState([]);

  useEffect(() => {
    if (editData) {
      setSaleMethod(editData.saleMethod || 'SLAUGHTERED');
      setInvoiceType(editData.invoiceType || 'CASH_MEMO');
      setSaleDate(editData.saleDate?.slice(0, 10) || new Date().toISOString().slice(0, 10));
      setCustomer((typeof editData.customer === 'object' ? editData.customer?._id : editData.customer) || '');
      const sl = editData.slaughter || {};
      const sh = (typeof sl.slaughterhouse === 'object' ? sl.slaughterhouse?._id : sl.slaughterhouse) || '';
      setSlaughterhouse(sh);
      setSlaughterhouseTouched(!!sh);
      setSlaughterDate(sl.date ? new Date(sl.date).toISOString().slice(0, 10) : addDays(editData.saleDate?.slice(0, 10), -1));
      setSlaughterDateTouched(!!sl.date);
      setSlaughterInvoiceRef(sl.invoiceRef || '');
      setProcessingCost(sl.processingCost?.toString() || '');
      const cn = editData.counts || {};
      setChickensSent(cn.chickensSent?.toString() || '');
      setCondemnation(cn.condemnation?.toString() || '');
      setDeathOnArrival(cn.deathOnArrival?.toString() || '');
      setRejections(cn.rejections?.toString() || '');
      setShortage(cn.shortage?.toString() || '');
      setBGradeCount(cn.bGrade?.toString() || '');
      setWholeChickenItems(editData.wholeChickenItems?.length > 0
        ? editData.wholeChickenItems.map((i) => ({ description: i.description || '', weightKg: i.weightKg?.toString() || '', ratePerKg: i.ratePerKg?.toString() || '' }))
        : [{ description: '', weightKg: '', ratePerKg: '' }]);
      const lv = editData.live || {};
      setLiveBirdCount(lv.birdCount?.toString() || '');
      setLiveRatePerBird(lv.ratePerBird?.toString() || '');
      setLiveWeightItems(lv.weightItems?.length > 0
        ? lv.weightItems.map((i) => ({ description: i.description || '', weightKg: i.weightKg?.toString() || '', ratePerKg: i.ratePerKg?.toString() || '' }))
        : [{ description: '', weightKg: '', ratePerKg: '' }]);
      const tr = editData.transport || {};
      setTruckCount(tr.truckCount?.toString() || '');
      setTruckRate(tr.ratePerTruck?.toString() || saleDefaults?.transportRatePerTruck?.toString() || '');
      setDiscountItems((editData.discounts || []).map((d) => ({ description: d.description || '', amount: d.amount?.toString() || '' })));
      setSlaughterReportDocs(editData.slaughter?.reportDocs || []);

      const defaultRates = saleDefaults?.portionRates || {};
      setPortions(PART_TYPES.map((pt) => {
        const existing = editData.portions?.find((p) => p.partType === pt);
        return {
          partType: pt,
          quantity: existing?.quantity?.toString() || '',
          rate: existing?.rate != null ? existing.rate.toString() : (defaultRates[pt]?.toString() || ''),
          amount: existing?.amount || 0,
        };
      }));
      setStep(0);
    } else {
      setSaleMethod('SLAUGHTERED'); setInvoiceType('CASH_MEMO');
      const today = new Date().toISOString().slice(0, 10);
      setSaleDate(today); setSlaughterDate(addDays(today, -1)); setSlaughterDateTouched(false);
      setCustomer(''); setSlaughterhouse(''); setSlaughterhouseTouched(false);
      setSlaughterInvoiceRef(''); setProcessingCost('');
      setChickensSent(''); setCondemnation(''); setDeathOnArrival('');
      setRejections(''); setShortage(''); setBGradeCount('');
      setWholeChickenItems([{ description: '', weightKg: '', ratePerKg: '' }]);
      setLiveBirdCount(''); setLiveRatePerBird('');
      setLiveWeightItems([{ description: '', weightKg: '', ratePerKg: '' }]);
      setTruckCount(''); setTruckRate(saleDefaults?.transportRatePerTruck?.toString() || '');
      setDiscountItems([]); setSlaughterReportDocs([]);
      const defaultRates = saleDefaults?.portionRates || {};
      setPortions(PART_TYPES.map((pt) => ({ partType: pt, quantity: '', rate: defaultRates[pt]?.toString() || '', amount: 0 })));
      setStep(0);
    }
  }, [editData, open, saleDefaults]);

  const businessOptions = useMemo(() => {
    const opts = businesses.map((b) => ({ value: b._id, label: b.companyName }));
    if (pendingBiz && !opts.some((o) => o.value === pendingBiz._id)) {
      opts.unshift({ value: pendingBiz._id, label: pendingBiz.companyName });
    }
    return opts;
  }, [businesses, pendingBiz]);

  const isSlaughtered = saleMethod === 'SLAUGHTERED';
  const isLiveByPiece = saleMethod === 'LIVE_BY_PIECE';
  const isLiveByWeight = saleMethod === 'LIVE_BY_WEIGHT';
  const showVat = invoiceType === 'VAT_INVOICE';

  // Computed counts
  const numSent = parseNum(chickensSent);
  const losses = parseNum(condemnation) + parseNum(deathOnArrival) + parseNum(rejections) + parseNum(shortage);
  const netProcessed = numSent - losses;
  const wholeChickenCount = Math.max(0, netProcessed - parseNum(bGradeCount));

  // Computed totals
  const wholeChickenTotal = wholeChickenItems.reduce((s, i) => s + (parseNum(i.weightKg) * parseNum(i.ratePerKg)), 0);
  const portionsTotal = portions.reduce((s, p) => s + (parseNum(p.quantity) * parseNum(p.rate)), 0);
  const liveSalesTotal = isLiveByPiece
    ? parseNum(liveBirdCount) * parseNum(liveRatePerBird)
    : liveWeightItems.reduce((s, i) => s + (parseNum(i.weightKg) * parseNum(i.ratePerKg)), 0);

  const grossSales = isSlaughtered ? wholeChickenTotal + portionsTotal : liveSalesTotal;
  const transportDeduction = parseNum(truckCount) * parseNum(truckRate);
  const totalDiscounts = discountItems.reduce((s, d) => s + parseNum(d.amount), 0);
  const subtotal = grossSales - transportDeduction - totalDiscounts;
  const vat = showVat ? subtotal * (vatRate / 100) : 0;
  const grandTotal = subtotal + vat;

  const handleSaleDateChange = (val) => {
    setSaleDate(val);
    if (isSlaughtered && !slaughterDateTouched) setSlaughterDate(addDays(val, -1));
  };

  const handleCustomerChange = (val) => {
    setCustomer(val);
    if (isSlaughtered && !slaughterhouseTouched) setSlaughterhouse(val);
  };

  const handleSlaughterhouseChange = (val) => {
    setSlaughterhouse(val);
    setSlaughterhouseTouched(true);
  };

  const handleSlaughterDateChange = (val) => {
    setSlaughterDate(val);
    setSlaughterDateTouched(true);
  };

  const validateStep0 = () => {
    const errs = {};
    if (!saleMethod) errs.saleMethod = 'Sale method is required';
    if (!invoiceType) errs.invoiceType = 'Invoice type is required';
    if (!saleDate) errs.saleDate = 'Sale date is required';
    if (!customer) errs.customer = 'Customer is required';
    if (Object.keys(errs).length > 0) { setFieldErrors(errs); return false; }
    setFieldErrors({});
    return true;
  };

  const handleSave = async () => {
    setFieldErrors({});
    setSaving(true);
    try {
      const finalDiscounts = discountItems
        .filter((d) => parseNum(d.amount) > 0)
        .map((d) => ({ description: d.description, amount: parseNum(d.amount) }));

      const computedPortions = isSlaughtered
        ? portions.filter((p) => parseNum(p.quantity) > 0).map((p) => ({
            partType: p.partType,
            quantity: parseNum(p.quantity),
            rate: parseNum(p.rate),
            amount: parseNum(p.quantity) * parseNum(p.rate),
          }))
        : [];

      const payload = {
        batch: batchId,
        saleMethod, invoiceType, saleDate, customer: customer || null,
        slaughter: isSlaughtered ? {
          date: slaughterDate || null,
          slaughterhouse: slaughterhouse || null,
          invoiceRef: slaughterInvoiceRef,
          processingCost: parseNum(processingCost),
          reportDocs: slaughterReportDocs.map((m) => m._id),
        } : null,
        counts: isSlaughtered ? {
          chickensSent: parseNum(chickensSent),
          condemnation: parseNum(condemnation),
          deathOnArrival: parseNum(deathOnArrival),
          rejections: parseNum(rejections),
          shortage: parseNum(shortage),
          bGrade: parseNum(bGradeCount),
        } : {},
        live: !isSlaughtered ? {
          birdCount: parseNum(liveBirdCount),
          ratePerBird: isLiveByPiece ? parseNum(liveRatePerBird) : 0,
          weightItems: isLiveByWeight ? liveWeightItems.map((i) => ({
            description: i.description, weightKg: parseNum(i.weightKg),
            ratePerKg: parseNum(i.ratePerKg), amount: parseNum(i.weightKg) * parseNum(i.ratePerKg),
          })) : [],
        } : null,
        wholeChickenItems: isSlaughtered ? wholeChickenItems.map((i) => ({
          description: i.description, weightKg: parseNum(i.weightKg),
          ratePerKg: parseNum(i.ratePerKg), amount: parseNum(i.weightKg) * parseNum(i.ratePerKg),
        })) : [],
        portions: computedPortions,
        transport: { truckCount: parseNum(truckCount), ratePerTruck: parseNum(truckRate) },
        discounts: finalDiscounts,
        totals: {
          wholeChicken: wholeChickenTotal, portions: portionsTotal,
          liveSales: liveSalesTotal, grossSales,
          transportDeduction, discounts: totalDiscounts,
          subtotal, vat, grandTotal,
        },
      };

      if (editData?._id) {
        await update(editData._id, payload);
        toast({ title: t('batches.saleUpdated') });
      } else {
        const tempId = `temp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        await create(tempId, payload);
        toast({ title: t('batches.saleCreated') });
      }
      onClose();
    } catch (err) {
      toast({ variant: 'destructive', title: err.message || t('common.error') });
    } finally {
      setSaving(false);
    }
  };

  const totalSteps = isSlaughtered ? 3 : 2;

  const fmtMoney = (n) => `${currency} ${(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <>
      <FormSheet
        open={open}
        onClose={onClose}
        title={editData ? t('batches.editSale') : t('batches.addSale')}
        subtitle={`${t('common.step', 'Step')} ${step + 1} / ${totalSteps}`}
        icon={ShoppingBag}
        headerExtra={<StepProgress current={step} total={totalSteps} />}
        footer={
          <SaleFooter
            step={step}
            totalSteps={totalSteps}
            saving={saving}
            editData={editData}
            onBack={() => setStep((s) => s - 1)}
            onNext={() => { if (step === 0 && !validateStep0()) return; setStep((s) => s + 1); }}
            onSave={handleSave}
            t={t}
          />
        }
      >
        {/* ─── STEP 0: SALE DATA ─── */}
        {step === 0 ? (
          <>
            <FormSection title={t('batches.saleForm.saleSetup', 'Sale Setup')}>
              <FormField label={t('batches.saleForm.saleMethod')} required error={fieldErrors.saleMethod}>
                <EnumButtonSelect
                  value={saleMethod}
                  onChange={setSaleMethod}
                  options={SALE_METHODS.map((v) => ({ value: v, label: t(`batches.saleMethods.${v}`, v), icon: SALE_METHOD_ICONS[v] }))}
                  columns={3}
                />
              </FormField>
              <FormField label={t('batches.saleForm.invoiceType')} required error={fieldErrors.invoiceType}>
                <EnumButtonSelect
                  value={invoiceType}
                  onChange={setInvoiceType}
                  options={SALE_INVOICE_TYPES.map((v) => ({ value: v, label: t(`batches.saleInvoiceTypes.${v}`, v), icon: SALE_INVOICE_TYPE_ICONS[v] }))}
                  columns={2}
                  compact
                />
              </FormField>
              <FormField label={t('batches.saleForm.saleDate')} required error={fieldErrors.saleDate}>
                <DatePicker value={saleDate} onChange={handleSaleDateChange} label={t('batches.saleForm.saleDate')} />
              </FormField>
              <FormField label={t('batches.saleForm.customer')} required error={fieldErrors.customer}>
                <Select
                  value={customer}
                  onValueChange={handleCustomerChange}
                  options={businessOptions}
                  placeholder={t('batches.saleForm.selectCustomer')}
                  label={t('batches.saleForm.customer')}
                  onCreateNew={(searchText) => { setQuickAddBizField('customer'); setBizInitialName(searchText || ''); setQuickAddBiz(true); }}
                  createNewLabel={t('businesses.addBusiness', 'Add Business')}
                />
              </FormField>
            </FormSection>

            {isSlaughtered ? (
              <FormSection title={t('batches.saleForm.slaughterDetails', 'Slaughter Details')}>
                <FormField label={t('batches.saleForm.slaughterDate', 'Slaughter Date')}>
                  <DatePicker value={slaughterDate} onChange={handleSlaughterDateChange} label={t('batches.saleForm.slaughterDate', 'Slaughter Date')} />
                </FormField>
                <FormField label={t('batches.saleForm.slaughterhouse')}>
                  <Select
                    value={slaughterhouse}
                    onValueChange={handleSlaughterhouseChange}
                    options={businessOptions}
                    placeholder={t('batches.saleForm.selectSlaughterhouse')}
                    label={t('batches.saleForm.slaughterhouse')}
                    onCreateNew={(searchText) => { setQuickAddBizField('slaughterhouse'); setBizInitialName(searchText || ''); setQuickAddBiz(true); }}
                    createNewLabel={t('businesses.addBusiness', 'Add Business')}
                  />
                </FormField>
                <SheetInput
                  label={t('batches.saleForm.slaughterInvoiceRef', 'Invoice Reference')}
                  value={slaughterInvoiceRef}
                  onChangeText={setSlaughterInvoiceRef}
                  placeholder={t('batches.saleForm.slaughterInvoiceRefPlaceholder', 'e.g. INV-001')}
                />
                <SheetInput
                  label={t('batches.saleForm.processingCost')}
                  value={processingCost}
                  onChangeText={setProcessingCost}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  suffix={<CurrencyTag label={currency} />}
                />
                <View>
                  <MultiFileUpload
                    label={t('batches.saleForm.slaughterReportDocs', 'Slaughter Report Documents')}
                    files={slaughterReportDocs}
                    onAdd={(media) => setSlaughterReportDocs((prev) => [...prev, media])}
                    onRemove={(index) => setSlaughterReportDocs((prev) => prev.filter((_, i) => i !== index))}
                    entityType="saleOrder"
                    entityId={editData?._id}
                    category="slaughterReport"
                    mediaType="document"
                  />
                </View>
              </FormSection>
            ) : null}
          </>
        ) : null}

        {/* ─── STEP 1: SLAUGHTERED COUNTS ─── */}
        {step === 1 && isSlaughtered ? (
          <FormSection title={t('batches.saleForm.stepQuantity')}>
            <SheetInput label={t('batches.saleForm.chickensSent')} value={chickensSent} onChangeText={setChickensSent} keyboardType="number-pad" placeholder="0" />
            <SheetInput label={t('batches.saleForm.condemnation')} value={condemnation} onChangeText={setCondemnation} keyboardType="number-pad" placeholder="0" />
            <SheetInput label={t('batches.saleForm.deathOnArrival')} value={deathOnArrival} onChangeText={setDeathOnArrival} keyboardType="number-pad" placeholder="0" />
            <SheetInput label={t('batches.saleForm.rejections')} value={rejections} onChangeText={setRejections} keyboardType="number-pad" placeholder="0" />
            <SheetInput label={t('batches.saleForm.shortage')} value={shortage} onChangeText={setShortage} keyboardType="number-pad" placeholder="0" />
            <SheetInput label={t('batches.saleForm.bGradeCount')} value={bGradeCount} onChangeText={setBGradeCount} keyboardType="number-pad" placeholder="0" />

            <SummaryCard>
              <SummaryRow label={t('batches.saleForm.netProcessed', 'Net Processed')} value={netProcessed.toLocaleString('en-US')} />
              <CardDivider marginVertical={2} />
              <SummaryRow label={t('batches.saleForm.wholeChickenCount', 'Whole Chicken Count')} value={wholeChickenCount.toLocaleString('en-US')} emphasis />
            </SummaryCard>
          </FormSection>
        ) : null}

        {/* ─── LAST STEP: ACCOUNTING ─── */}
        {((step === 1 && !isSlaughtered) || (step === 2 && isSlaughtered)) ? (
          <>
            {isSlaughtered ? (
              <FormSection
                title={t('batches.saleForm.wholeChickenSection')}
                headerRight={
                  <AddRowButton
                    icon={Plus}
                    label={t('batches.saleForm.addRow')}
                    onPress={() => setWholeChickenItems((p) => [...p, { description: '', weightKg: '', ratePerKg: '' }])}
                  />
                }
              >
                {wholeChickenItems.map((item, i) => (
                  <WeightRowCard
                    key={i}
                    index={i}
                    item={item}
                    count={wholeChickenItems.length}
                    onUpdate={(field, v) => {
                      const next = [...wholeChickenItems];
                      next[i] = { ...next[i], [field]: v };
                      setWholeChickenItems(next);
                    }}
                    onRemove={() => setWholeChickenItems((p) => p.filter((_, idx) => idx !== i))}
                    t={t}
                  />
                ))}
                <View style={{ paddingTop: 4 }}>
                  <SummaryRow
                    label={t('batches.saleForm.wholeChickenTotal', 'Whole Chicken Total')}
                    value={`${currency} ${wholeChickenTotal.toFixed(2)}`}
                    emphasis
                  />
                </View>
              </FormSection>
            ) : null}

            {isSlaughtered ? (
              <FormSection title={t('batches.saleForm.portionsSection', 'Poultry Portions')}>
                <PortionsTable
                  portions={portions}
                  onUpdate={(i, field, v) => {
                    const next = [...portions];
                    next[i] = { ...next[i], [field]: v };
                    setPortions(next);
                  }}
                  t={t}
                  currency={currency}
                  portionsTotal={portionsTotal}
                />
              </FormSection>
            ) : null}

            {isLiveByPiece ? (
              <FormSection title={t('batches.saleForm.liveByPieceSection', 'Live Sale - By Piece')}>
                <SheetInput label={t('batches.saleForm.birdCount')} value={liveBirdCount} onChangeText={setLiveBirdCount} keyboardType="number-pad" placeholder="0" />
                <SheetInput
                  label={t('batches.saleForm.ratePerBird')}
                  value={liveRatePerBird}
                  onChangeText={setLiveRatePerBird}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  suffix={<CurrencyTag label={currency} />}
                />
              </FormSection>
            ) : null}

            {isLiveByWeight ? (
              <FormSection
                title={t('batches.saleForm.liveByWeightSection')}
                headerRight={
                  <AddRowButton
                    icon={Plus}
                    label={t('batches.saleForm.addRow')}
                    onPress={() => setLiveWeightItems((p) => [...p, { description: '', weightKg: '', ratePerKg: '' }])}
                  />
                }
              >
                <SheetInput label={t('batches.saleForm.birdCount')} value={liveBirdCount} onChangeText={setLiveBirdCount} keyboardType="number-pad" placeholder="0" />
                {liveWeightItems.map((item, i) => (
                  <WeightRowCard
                    key={i}
                    index={i}
                    item={item}
                    count={liveWeightItems.length}
                    onUpdate={(field, v) => {
                      const next = [...liveWeightItems];
                      next[i] = { ...next[i], [field]: v };
                      setLiveWeightItems(next);
                    }}
                    onRemove={() => setLiveWeightItems((p) => p.filter((_, idx) => idx !== i))}
                    t={t}
                  />
                ))}
              </FormSection>
            ) : null}

            <FormSection title={t('batches.saleForm.transportSection')}>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <SheetInput label={t('batches.saleForm.truckCount')} value={truckCount} onChangeText={setTruckCount} keyboardType="number-pad" placeholder="0" />
                </View>
                <View style={{ flex: 1 }}>
                  <SheetInput
                    label={t('batches.saleForm.truckRate')}
                    value={truckRate}
                    onChangeText={setTruckRate}
                    keyboardType="decimal-pad"
                    placeholder="0.00"
                  />
                </View>
              </View>
            </FormSection>

            <FormSection
              title={t('batches.saleForm.discountsSection', 'Discounts')}
              headerRight={
                <AddRowButton
                  icon={Plus}
                  label={t('batches.saleForm.addDiscount', 'Add Discount')}
                  onPress={() => setDiscountItems((p) => [...p, { description: '', amount: '' }])}
                />
              }
            >
              {discountItems.length === 0 ? (
                <DiscountEmpty t={t} />
              ) : (
                discountItems.map((d, i) => (
                  <DiscountRowCard
                    key={i}
                    index={i}
                    item={d}
                    onUpdate={(field, v) => {
                      const next = [...discountItems];
                      next[i] = { ...next[i], [field]: v };
                      setDiscountItems(next);
                    }}
                    onRemove={() => setDiscountItems((p) => p.filter((_, idx) => idx !== i))}
                    t={t}
                  />
                ))
              )}
            </FormSection>

            <FormSection title={t('batches.saleForm.summary', 'Summary')}>
              <SummaryCard>
                <SummaryRow label={t('batches.saleForm.grossSales')} value={fmtMoney(grossSales)} />
                {transportDeduction > 0 ? (
                  <SummaryRow label={t('batches.saleForm.transportDeduction')} value={`- ${fmtMoney(transportDeduction)}`} negative />
                ) : null}
                {totalDiscounts > 0 ? (
                  <SummaryRow label={t('batches.saleForm.totalDiscounts', 'Total Discounts')} value={`- ${fmtMoney(totalDiscounts)}`} negative />
                ) : null}
                {showVat ? (
                  <SummaryRow label={t('batches.saleForm.vat')} value={fmtMoney(vat)} />
                ) : null}
                <CardDivider marginVertical={2} />
                <SummaryRow label={t('batches.saleForm.grandTotal')} value={fmtMoney(grandTotal)} emphasis />
              </SummaryCard>
            </FormSection>
          </>
        ) : null}
      </FormSheet>

      <QuickAddBusinessSheet
        open={quickAddBiz}
        onClose={() => setQuickAddBiz(false)}
        initialName={bizInitialName}
        onCreated={(biz) => {
          setPendingBiz(biz);
          if (quickAddBizField === 'slaughterhouse') {
            setSlaughterhouse(biz._id);
            setSlaughterhouseTouched(true);
          } else {
            setCustomer(biz._id);
            if (isSlaughtered && !slaughterhouseTouched) setSlaughterhouse(biz._id);
          }
          toast({ title: `${biz.companyName} ${t('common.created', 'created')}` });
        }}
      />
    </>
  );
}

/* -------------------- internal sub-components -------------------- */

function StepProgress({ current, total }) {
  const tokens = useHeroSheetTokens();
  const isRTL = useIsRTL();
  const { accentColor, dark } = tokens;
  const dim = dark ? 'hsl(150, 14%, 24%)' : 'hsl(148, 14%, 88%)';
  return (
    <View style={[stepStyles.row, { flexDirection: rowDirection(isRTL) }]}>
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          style={[
            stepStyles.bar,
            { backgroundColor: i <= current ? accentColor : dim },
          ]}
        />
      ))}
    </View>
  );
}

function SaleFooter({ step, totalSteps, saving, editData, onBack, onNext, onSave, t }) {
  const insets = useSafeAreaInsets();
  const tokens = useHeroSheetTokens();
  const isRTL = useIsRTL();
  const { sheetBg, borderColor } = tokens;

  // Mirrored chevrons so Back / Next read correctly in Arabic.
  const BackIcon = isRTL ? ChevronRight : ChevronLeft;
  const ForwardIcon = isRTL ? ChevronLeft : ChevronRight;
  const isLastStep = step >= totalSteps - 1;

  return (
    <View
      style={[
        footerStyles.bar,
        {
          flexDirection: rowDirection(isRTL),
          backgroundColor: sheetBg,
          borderTopColor: borderColor,
          paddingBottom: Math.max(insets.bottom, 16),
        },
      ]}
    >
      {step > 0 ? (
        <View style={{ flex: 1 }}>
          <CtaButton
            variant="secondary"
            icon={BackIcon}
            label={t('common.back')}
            onPress={onBack}
          />
        </View>
      ) : null}
      <View style={{ flex: 1 }}>
        {!isLastStep ? (
          <CtaButton
            variant="primary"
            icon={ForwardIcon}
            label={t('common.next')}
            onPress={onNext}
          />
        ) : (
          <CtaButton
            variant="primary"
            icon={editData ? Check : Plus}
            label={editData ? t('common.save') : t('common.create')}
            onPress={onSave}
            loading={saving}
            disabled={saving}
          />
        )}
      </View>
    </View>
  );
}

function WeightRowCard({ index, item, count, onUpdate, onRemove, t }) {
  const tokens = useHeroSheetTokens();
  const isRTL = useIsRTL();
  const { dark, mutedColor, errorColor } = tokens;
  return (
    <View
      style={[
        rowStyles.card,
        {
          backgroundColor: dark ? 'rgba(255,255,255,0.03)' : 'hsl(148, 22%, 96%)',
          borderColor: dark ? 'hsl(150, 12%, 28%)' : 'hsl(148, 16%, 88%)',
        },
      ]}
    >
      <View
        style={[
          rowStyles.headerRow,
          { flexDirection: rowDirection(isRTL) },
        ]}
      >
        <Text
          style={{
            fontSize: 11,
            fontFamily: 'Poppins-SemiBold',
            color: mutedColor,
            letterSpacing: 1.2,
            textTransform: 'uppercase',
          }}
        >
          #{index + 1}
        </Text>
        {count > 1 ? (
          <Pressable onPress={onRemove} hitSlop={8} style={rowStyles.removeBtn}>
            <Trash2 size={14} color={errorColor} />
          </Pressable>
        ) : null}
      </View>
      <SheetInput
        label={t('batches.saleForm.description')}
        value={item.description}
        onChangeText={(v) => onUpdate('description', v)}
        placeholder={t('batches.saleForm.description')}
      />
      <View style={{ flexDirection: rowDirection(isRTL), gap: 10 }}>
        <View style={{ flex: 1 }}>
          <SheetInput
            label={t('batches.saleForm.weightKg', 'Weight (kg)')}
            value={item.weightKg}
            onChangeText={(v) => onUpdate('weightKg', v)}
            keyboardType="decimal-pad"
            placeholder="0"
          />
        </View>
        <View style={{ flex: 1 }}>
          <SheetInput
            label={t('batches.saleForm.ratePerKg', 'Rate/kg')}
            value={item.ratePerKg}
            onChangeText={(v) => onUpdate('ratePerKg', v)}
            keyboardType="decimal-pad"
            placeholder="0"
          />
        </View>
      </View>
      <View style={{ flexDirection: rowDirection(isRTL), justifyContent: 'space-between', alignItems: 'center', paddingTop: 4 }}>
        <Text style={{ fontSize: 11, fontFamily: 'Poppins-SemiBold', color: mutedColor, letterSpacing: 1.2, textTransform: 'uppercase' }}>
          {t('batches.saleForm.amount')}
        </Text>
        <Text
          style={{
            fontSize: 14,
            fontFamily: 'Poppins-SemiBold',
            color: tokens.textColor,
            fontVariant: ['tabular-nums'],
          }}
        >
          {fmtDec(parseNum(item.weightKg) * parseNum(item.ratePerKg)) || '0.00'}
        </Text>
      </View>
    </View>
  );
}

function PortionsTable({ portions, onUpdate, t, currency, portionsTotal }) {
  const tokens = useHeroSheetTokens();
  const isRTL = useIsRTL();
  const { mutedColor, textColor } = tokens;
  return (
    <>
      <View
        style={[
          portionStyles.headerRow,
          { flexDirection: rowDirection(isRTL) },
        ]}
      >
        <Text style={[portionStyles.headerCell, { flex: 1.2, color: mutedColor, textAlign: textAlignStart(isRTL) }]}>
          {t('batches.saleForm.partType', 'Part')}
        </Text>
        <Text style={[portionStyles.headerCell, { flex: 1, color: mutedColor, textAlign: 'center' }]}>
          {t('batches.saleForm.quantity', 'Qty')}
        </Text>
        <Text style={[portionStyles.headerCell, { flex: 1, color: mutedColor, textAlign: 'center' }]}>
          {t('batches.saleForm.rate', 'Rate')}
        </Text>
        <Text style={[portionStyles.headerCell, { flex: 0.9, color: mutedColor, textAlign: textAlignEnd(isRTL) }]}>
          {t('batches.saleForm.amount', 'Amt')}
        </Text>
      </View>
      {portions.map((p, i) => (
        <View
          key={p.partType}
          style={[
            portionStyles.row,
            { flexDirection: rowDirection(isRTL) },
          ]}
        >
          <Text
            style={{
              flex: 1.2,
              fontSize: 12.5,
              fontFamily: 'Poppins-Medium',
              color: textColor,
              textAlign: textAlignStart(isRTL),
            }}
            numberOfLines={1}
          >
            {t(`settings.portionLabels.${p.partType}`)}
          </Text>
          <View style={{ flex: 1, paddingHorizontal: 4 }}>
            <SheetInput
              dense
              value={p.quantity}
              onChangeText={(v) => onUpdate(i, 'quantity', v)}
              keyboardType="number-pad"
              placeholder="0"
            />
          </View>
          <View style={{ flex: 1, paddingHorizontal: 4 }}>
            <SheetInput
              dense
              value={p.rate}
              onChangeText={(v) => onUpdate(i, 'rate', v)}
              keyboardType="decimal-pad"
              placeholder="0"
            />
          </View>
          <Text
            style={{
              flex: 0.9,
              fontSize: 12.5,
              fontFamily: 'Poppins-Medium',
              color: mutedColor,
              textAlign: textAlignEnd(isRTL),
              fontVariant: ['tabular-nums'],
            }}
          >
            {fmtDec(parseNum(p.quantity) * parseNum(p.rate)) || '-'}
          </Text>
        </View>
      ))}
      <View style={{ paddingTop: 4 }}>
        <SummaryRow
          label={t('batches.saleForm.portionsTotal', 'Portions Total')}
          value={`${currency} ${portionsTotal.toFixed(2)}`}
          emphasis
        />
      </View>
    </>
  );
}

function DiscountRowCard({ index, item, onUpdate, onRemove, t }) {
  const tokens = useHeroSheetTokens();
  const isRTL = useIsRTL();
  const { dark, mutedColor, errorColor } = tokens;
  return (
    <View
      style={[
        rowStyles.card,
        {
          backgroundColor: dark ? 'rgba(255,255,255,0.03)' : 'hsl(148, 22%, 96%)',
          borderColor: dark ? 'hsl(150, 12%, 28%)' : 'hsl(148, 16%, 88%)',
        },
      ]}
    >
      <View
        style={[
          rowStyles.headerRow,
          { flexDirection: rowDirection(isRTL) },
        ]}
      >
        <Text
          style={{
            fontSize: 11,
            fontFamily: 'Poppins-SemiBold',
            color: mutedColor,
            letterSpacing: 1.2,
            textTransform: 'uppercase',
          }}
        >
          #{index + 1}
        </Text>
        <Pressable onPress={onRemove} hitSlop={8} style={rowStyles.removeBtn}>
          <Trash2 size={14} color={errorColor} />
        </Pressable>
      </View>
      <View style={{ flexDirection: rowDirection(isRTL), gap: 10 }}>
        <View style={{ flex: 2 }}>
          <SheetInput
            value={item.description}
            onChangeText={(v) => onUpdate('description', v)}
            placeholder={t('batches.saleForm.discountDescription', 'Description')}
          />
        </View>
        <View style={{ flex: 1 }}>
          <SheetInput
            value={item.amount}
            onChangeText={(v) => onUpdate('amount', v)}
            keyboardType="decimal-pad"
            placeholder="0.00"
          />
        </View>
      </View>
    </View>
  );
}

function DiscountEmpty({ t }) {
  const { mutedColor } = useHeroSheetTokens();
  const isRTL = useIsRTL();
  return (
    <Text
      style={{
        fontSize: 12.5,
        fontFamily: 'Poppins-Regular',
        color: mutedColor,
        textAlign: textAlignStart(isRTL),
        fontStyle: 'italic',
      }}
    >
      {t('batches.saleForm.noDiscounts', 'No discounts added.')}
    </Text>
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

const stepStyles = StyleSheet.create({
  row: {
    gap: 6,
  },
  bar: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
});

const footerStyles = StyleSheet.create({
  bar: {
    paddingHorizontal: 20,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
});

const rowStyles = StyleSheet.create({
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 12,
  },
  headerRow: {
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  removeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

const portionStyles = StyleSheet.create({
  headerRow: {
    alignItems: 'center',
    paddingBottom: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'transparent',
    marginBottom: 4,
  },
  headerCell: {
    fontSize: 10.5,
    fontFamily: 'Poppins-SemiBold',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  row: {
    alignItems: 'center',
    paddingVertical: 4,
  },
});
