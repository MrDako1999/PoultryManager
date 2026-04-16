import { useState, useEffect, useMemo } from 'react';
import { View, Text, Modal, Pressable, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X, Plus, Trash2 } from 'lucide-react-native';
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
import useThemeStore from '@/stores/themeStore';
import { SALE_METHODS, SALE_METHOD_ICONS, SALE_INVOICE_TYPES, SALE_INVOICE_TYPE_ICONS, PART_TYPES } from '@/lib/constants';
import { useToast } from '@/components/ui/Toast';

const parseNum = (v) => { const n = parseFloat(String(v).replace(/,/g, '')); return isNaN(n) ? 0 : n; };
const fmtDec = (v) => { const n = Number(v || 0); return n ? n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ''; };

function addDays(dateStr, days) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

function FieldError({ message }) {
  if (!message) return null;
  return <Text className="text-xs text-destructive mt-1">{message}</Text>;
}

function RequiredStar() {
  return <Text className="text-destructive"> *</Text>;
}

export default function SaleOrderSheet({ open, onClose, batchId, editData }) {
  const { t } = useTranslation();
  const { bottom: safeBottom } = useSafeAreaInsets();
  const { toast } = useToast();
  const { resolvedTheme } = useThemeStore();
  const primaryColor = resolvedTheme === 'dark' ? 'hsl(148, 48%, 38%)' : 'hsl(148, 60%, 20%)';
  const dangerColor = 'hsl(0, 72%, 51%)';
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

  // Computed counts (step 1)
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

  // Auto-fill helpers
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

  if (!open) return null;

  const totalSteps = isSlaughtered ? 3 : 2;

  return (
    <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1 bg-background">
        <View className="flex-row items-center justify-between px-4 pt-4 pb-2">
          <Text className="text-lg font-bold text-foreground">
            {editData ? t('batches.editSale') : t('batches.addSale')}
          </Text>
          <Pressable onPress={onClose} hitSlop={8}>
            <X size={20} color="hsl(150, 10%, 45%)" />
          </Pressable>
        </View>

        <View className="flex-row px-4 pb-2 gap-1">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <View key={i} className={`flex-1 h-1 rounded-full ${i <= step ? 'bg-primary' : 'bg-border'}`} />
          ))}
        </View>

        <Separator />
        <ScrollView className="flex-1 px-4" contentContainerClassName="py-4 gap-4" keyboardShouldPersistTaps="handled">

          {/* ─── STEP 0: SALE DATA ─── */}
          {step === 0 && (
            <>
              <View className="gap-2">
                <Label>{t('batches.saleForm.saleMethod')}<RequiredStar /></Label>
                <EnumButtonSelect
                  value={saleMethod}
                  onChange={setSaleMethod}
                  options={SALE_METHODS.map((v) => ({ value: v, label: t(`batches.saleMethods.${v}`, v), icon: SALE_METHOD_ICONS[v] }))}
                  columns={3}
                />
                <FieldError message={fieldErrors.saleMethod} />
              </View>
              <View className="gap-2">
                <Label>{t('batches.saleForm.invoiceType')}<RequiredStar /></Label>
                <EnumButtonSelect
                  value={invoiceType}
                  onChange={setInvoiceType}
                  options={SALE_INVOICE_TYPES.map((v) => ({ value: v, label: t(`batches.saleInvoiceTypes.${v}`, v), icon: SALE_INVOICE_TYPE_ICONS[v] }))}
                  columns={2}
                  compact
                />
                <FieldError message={fieldErrors.invoiceType} />
              </View>
              <View className="gap-2">
                <Label>{t('batches.saleForm.saleDate')}<RequiredStar /></Label>
                <DatePicker value={saleDate} onChange={handleSaleDateChange} label={t('batches.saleForm.saleDate')} />
                <FieldError message={fieldErrors.saleDate} />
              </View>
              <View className="gap-2">
                <Label>{t('batches.saleForm.customer')}<RequiredStar /></Label>
                <Select value={customer} onValueChange={handleCustomerChange} options={businessOptions} placeholder={t('batches.saleForm.selectCustomer')} label={t('batches.saleForm.customer')} onCreateNew={(searchText) => { setQuickAddBizField('customer'); setBizInitialName(searchText || ''); setQuickAddBiz(true); }} createNewLabel={t('businesses.addBusiness', 'Add Business')} />
                <FieldError message={fieldErrors.customer} />
              </View>
              {isSlaughtered && (
                <>
                  <Separator />
                  <View className="flex-row gap-3">
                    <View className="flex-1 gap-2">
                      <Label>{t('batches.saleForm.slaughterDate', 'Slaughter Date')}</Label>
                      <DatePicker value={slaughterDate} onChange={handleSlaughterDateChange} label={t('batches.saleForm.slaughterDate', 'Slaughter Date')} />
                    </View>
                  </View>
                  <View className="gap-2">
                    <Label>{t('batches.saleForm.slaughterhouse')}</Label>
                    <Select value={slaughterhouse} onValueChange={handleSlaughterhouseChange} options={businessOptions} placeholder={t('batches.saleForm.selectSlaughterhouse')} label={t('batches.saleForm.slaughterhouse')} onCreateNew={(searchText) => { setQuickAddBizField('slaughterhouse'); setBizInitialName(searchText || ''); setQuickAddBiz(true); }} createNewLabel={t('businesses.addBusiness', 'Add Business')} />
                  </View>
                  <View className="gap-2">
                    <Label>{t('batches.saleForm.slaughterInvoiceRef', 'Invoice Reference')}</Label>
                    <Input value={slaughterInvoiceRef} onChangeText={setSlaughterInvoiceRef} placeholder={t('batches.saleForm.slaughterInvoiceRefPlaceholder', 'e.g. INV-001')} />
                  </View>
                  <View className="gap-2">
                    <Label>{t('batches.saleForm.processingCost')}</Label>
                    <Input value={processingCost} onChangeText={setProcessingCost} keyboardType="decimal-pad" placeholder="0.00" />
                  </View>
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
                </>
              )}
            </>
          )}

          {/* ─── STEP 1: SLAUGHTERED COUNTS ─── */}
          {step === 1 && isSlaughtered && (
            <>
              <Text className="text-sm font-semibold text-foreground">{t('batches.saleForm.stepQuantity')}</Text>
              <View className="gap-3">
                <View className="gap-2"><Label>{t('batches.saleForm.chickensSent')}</Label><Input value={chickensSent} onChangeText={setChickensSent} keyboardType="number-pad" /></View>
                <View className="gap-2"><Label>{t('batches.saleForm.condemnation')}</Label><Input value={condemnation} onChangeText={setCondemnation} keyboardType="number-pad" /></View>
                <View className="gap-2"><Label>{t('batches.saleForm.deathOnArrival')}</Label><Input value={deathOnArrival} onChangeText={setDeathOnArrival} keyboardType="number-pad" /></View>
                <View className="gap-2"><Label>{t('batches.saleForm.rejections')}</Label><Input value={rejections} onChangeText={setRejections} keyboardType="number-pad" /></View>
                <View className="gap-2"><Label>{t('batches.saleForm.shortage')}</Label><Input value={shortage} onChangeText={setShortage} keyboardType="number-pad" /></View>
                <View className="gap-2"><Label>{t('batches.saleForm.bGradeCount')}</Label><Input value={bGradeCount} onChangeText={setBGradeCount} keyboardType="number-pad" /></View>
              </View>

              <View className="rounded-xl border border-border bg-card p-4 gap-3 mt-1">
                <View className="flex-row items-center justify-between">
                  <Text className="text-sm text-muted-foreground">{t('batches.saleForm.netProcessed', 'Net Processed')}</Text>
                  <Text className="text-base font-bold text-foreground">{netProcessed.toLocaleString()}</Text>
                </View>
                <Separator />
                <View className="flex-row items-center justify-between">
                  <Text className="text-sm text-muted-foreground">{t('batches.saleForm.wholeChickenCount', 'Whole Chicken Count')}</Text>
                  <Text className="text-base font-bold text-primary">{wholeChickenCount.toLocaleString()}</Text>
                </View>
              </View>
            </>
          )}

          {/* ─── LAST STEP: ACCOUNTING ─── */}
          {((step === 1 && !isSlaughtered) || (step === 2 && isSlaughtered)) && (
            <>
              {/* Whole Chicken Weight Rows (slaughtered) */}
              {isSlaughtered && (
                <View className="gap-3">
                  <Text className="text-sm font-semibold text-foreground">{t('batches.saleForm.wholeChickenSection')}</Text>
                  {wholeChickenItems.map((item, i) => (
                    <View key={i} className="rounded-lg border border-border p-3 gap-2">
                      <View className="flex-row items-center justify-between">
                        <Text className="text-[10px] text-muted-foreground">#{i + 1}</Text>
                        {wholeChickenItems.length > 1 && (
                          <Pressable onPress={() => setWholeChickenItems((p) => p.filter((_, idx) => idx !== i))} hitSlop={8}>
                            <Trash2 size={14} color={dangerColor} />
                          </Pressable>
                        )}
                      </View>
                      <Input
                        value={item.description}
                        onChangeText={(v) => { const next = [...wholeChickenItems]; next[i] = { ...next[i], description: v }; setWholeChickenItems(next); }}
                        placeholder={t('batches.saleForm.description')}
                      />
                      <View className="flex-row gap-2">
                        <View className="flex-1 gap-1">
                          <Label>{t('batches.saleForm.weightKg', 'Weight (kg)')}</Label>
                          <Input value={item.weightKg} onChangeText={(v) => {
                            const next = [...wholeChickenItems]; next[i] = { ...next[i], weightKg: v }; setWholeChickenItems(next);
                          }} keyboardType="decimal-pad" placeholder="0" />
                        </View>
                        <View className="flex-1 gap-1">
                          <Label>{t('batches.saleForm.ratePerKg', 'Rate/kg')}</Label>
                          <Input value={item.ratePerKg} onChangeText={(v) => {
                            const next = [...wholeChickenItems]; next[i] = { ...next[i], ratePerKg: v }; setWholeChickenItems(next);
                          }} keyboardType="decimal-pad" placeholder="0" />
                        </View>
                        <View className="flex-1 gap-1">
                          <Label>{t('batches.saleForm.amount')}</Label>
                          <Input value={fmtDec(parseNum(item.weightKg) * parseNum(item.ratePerKg))} editable={false} className="opacity-60" />
                        </View>
                      </View>
                    </View>
                  ))}
                  <Pressable onPress={() => setWholeChickenItems((p) => [...p, { description: '', weightKg: '', ratePerKg: '' }])}
                    className="flex-row items-center gap-1 self-start">
                    <Plus size={14} color={primaryColor} /><Text className="text-xs text-primary font-medium">{t('batches.saleForm.addRow')}</Text>
                  </Pressable>
                  <View className="flex-row justify-between items-center border-t border-border pt-2">
                    <Text className="text-xs font-semibold text-foreground">{t('batches.saleForm.wholeChickenTotal', 'Whole Chicken Total')}</Text>
                    <Text className="text-sm font-semibold text-foreground" style={{ fontVariant: ['tabular-nums'] }}>{currency} {wholeChickenTotal.toFixed(2)}</Text>
                  </View>
                </View>
              )}

              {/* Portions Grid (slaughtered) */}
              {isSlaughtered && (
                <>
                  <Separator />
                  <View className="gap-3">
                    <Text className="text-sm font-semibold text-foreground">{t('batches.saleForm.portionsSection', 'Poultry Portions')}</Text>
                    {portions.map((p, i) => (
                      <View key={p.partType} className="flex-row items-center gap-2">
                        <Text className="w-20 text-xs text-foreground" numberOfLines={1}>{t(`settings.portionLabels.${p.partType}`)}</Text>
                        <View className="flex-1">
                          <Input
                            value={p.quantity}
                            onChangeText={(v) => { const next = [...portions]; next[i] = { ...next[i], quantity: v }; setPortions(next); }}
                            keyboardType="number-pad"
                            placeholder="0"
                          />
                        </View>
                        <View className="flex-1">
                          <Input
                            value={p.rate}
                            onChangeText={(v) => { const next = [...portions]; next[i] = { ...next[i], rate: v }; setPortions(next); }}
                            keyboardType="decimal-pad"
                            placeholder="0"
                          />
                        </View>
                        <Text className="w-16 text-right text-xs text-muted-foreground" style={{ fontVariant: ['tabular-nums'] }}>
                          {fmtDec(parseNum(p.quantity) * parseNum(p.rate))}
                        </Text>
                      </View>
                    ))}
                    <View className="flex-row justify-between items-center border-t border-border pt-2">
                      <Text className="text-xs font-semibold text-foreground">{t('batches.saleForm.portionsTotal', 'Portions Total')}</Text>
                      <Text className="text-sm font-semibold text-foreground" style={{ fontVariant: ['tabular-nums'] }}>{currency} {portionsTotal.toFixed(2)}</Text>
                    </View>
                  </View>
                </>
              )}

              {/* Live By Piece */}
              {isLiveByPiece && (
                <View className="gap-3">
                  <Text className="text-sm font-semibold text-foreground">{t('batches.saleForm.liveByPieceSection', 'Live Sale - By Piece')}</Text>
                  <View className="gap-2"><Label>{t('batches.saleForm.birdCount')}</Label><Input value={liveBirdCount} onChangeText={setLiveBirdCount} keyboardType="number-pad" /></View>
                  <View className="gap-2"><Label>{t('batches.saleForm.ratePerBird')}</Label><Input value={liveRatePerBird} onChangeText={setLiveRatePerBird} keyboardType="decimal-pad" /></View>
                </View>
              )}

              {/* Live By Weight */}
              {isLiveByWeight && (
                <View className="gap-3">
                  <Text className="text-sm font-semibold text-foreground">{t('batches.saleForm.liveByWeightSection')}</Text>
                  <View className="gap-2"><Label>{t('batches.saleForm.birdCount')}</Label><Input value={liveBirdCount} onChangeText={setLiveBirdCount} keyboardType="number-pad" /></View>
                  <Separator />
                  {liveWeightItems.map((item, i) => (
                    <View key={i} className="rounded-lg border border-border p-3 gap-2">
                      <View className="flex-row items-center justify-between">
                        <Text className="text-[10px] text-muted-foreground">#{i + 1}</Text>
                        {liveWeightItems.length > 1 && (
                          <Pressable onPress={() => setLiveWeightItems((p) => p.filter((_, idx) => idx !== i))} hitSlop={8}>
                            <Trash2 size={14} color={dangerColor} />
                          </Pressable>
                        )}
                      </View>
                      <Input
                        value={item.description}
                        onChangeText={(v) => { const next = [...liveWeightItems]; next[i] = { ...next[i], description: v }; setLiveWeightItems(next); }}
                        placeholder={t('batches.saleForm.description')}
                      />
                      <View className="flex-row gap-2">
                        <View className="flex-1 gap-1">
                          <Label>{t('batches.saleForm.weightKg', 'Weight (kg)')}</Label>
                          <Input value={item.weightKg} onChangeText={(v) => {
                            const next = [...liveWeightItems]; next[i] = { ...next[i], weightKg: v }; setLiveWeightItems(next);
                          }} keyboardType="decimal-pad" />
                        </View>
                        <View className="flex-1 gap-1">
                          <Label>{t('batches.saleForm.ratePerKg', 'Rate/kg')}</Label>
                          <Input value={item.ratePerKg} onChangeText={(v) => {
                            const next = [...liveWeightItems]; next[i] = { ...next[i], ratePerKg: v }; setLiveWeightItems(next);
                          }} keyboardType="decimal-pad" />
                        </View>
                        <View className="flex-1 gap-1">
                          <Label>{t('batches.saleForm.amount')}</Label>
                          <Input value={fmtDec(parseNum(item.weightKg) * parseNum(item.ratePerKg))} editable={false} className="opacity-60" />
                        </View>
                      </View>
                    </View>
                  ))}
                  <Pressable onPress={() => setLiveWeightItems((p) => [...p, { description: '', weightKg: '', ratePerKg: '' }])}
                    className="flex-row items-center gap-1 self-start">
                    <Plus size={14} color={primaryColor} /><Text className="text-xs text-primary font-medium">{t('batches.saleForm.addRow')}</Text>
                  </Pressable>
                </View>
              )}

              {/* Transport & Discounts */}
              <Separator />
              <View className="gap-3">
                <Text className="text-sm font-semibold text-foreground">{t('batches.saleForm.transportSection')}</Text>
                <View className="flex-row gap-3">
                  <View className="flex-1 gap-2"><Label>{t('batches.saleForm.truckCount')}</Label><Input value={truckCount} onChangeText={setTruckCount} keyboardType="number-pad" /></View>
                  <View className="flex-1 gap-2"><Label>{t('batches.saleForm.truckRate')}</Label><Input value={truckRate} onChangeText={setTruckRate} keyboardType="decimal-pad" /></View>
                </View>
              </View>

              {/* Discount Line Items */}
              <View className="gap-3">
                <Text className="text-sm font-semibold text-foreground">{t('batches.saleForm.discountsSection', 'Discounts')}</Text>
                {discountItems.map((d, i) => (
                  <View key={i} className="rounded-lg border border-border p-3 gap-2">
                    <View className="flex-row items-center justify-between">
                      <Text className="text-[10px] text-muted-foreground">#{i + 1}</Text>
                      <Pressable onPress={() => setDiscountItems((p) => p.filter((_, idx) => idx !== i))} hitSlop={8}>
                        <Trash2 size={14} color={dangerColor} />
                      </Pressable>
                    </View>
                    <View className="flex-row gap-2">
                      <View className="flex-[2] gap-1">
                        <Input
                          value={d.description}
                          onChangeText={(v) => { const next = [...discountItems]; next[i] = { ...next[i], description: v }; setDiscountItems(next); }}
                          placeholder={t('batches.saleForm.discountDescription', 'Description')}
                        />
                      </View>
                      <View className="flex-1 gap-1">
                        <Input
                          value={d.amount}
                          onChangeText={(v) => { const next = [...discountItems]; next[i] = { ...next[i], amount: v }; setDiscountItems(next); }}
                          keyboardType="decimal-pad"
                          placeholder="0.00"
                        />
                      </View>
                    </View>
                  </View>
                ))}
                <Pressable onPress={() => setDiscountItems((p) => [...p, { description: '', amount: '' }])}
                  className="flex-row items-center gap-1 self-start">
                  <Plus size={14} color={primaryColor} /><Text className="text-xs text-primary font-medium">{t('batches.saleForm.addDiscount', 'Add Discount')}</Text>
                </Pressable>
              </View>

              {/* Summary */}
              <View className="rounded-lg border border-border bg-muted/30 px-3 py-2.5 gap-1">
                <View className="flex-row justify-between"><Text className="text-xs text-muted-foreground">{t('batches.saleForm.grossSales')}</Text><Text className="text-sm text-foreground" style={{ fontVariant: ['tabular-nums'] }}>{currency} {grossSales.toFixed(2)}</Text></View>
                {transportDeduction > 0 && <View className="flex-row justify-between"><Text className="text-xs text-muted-foreground">{t('batches.saleForm.transportDeduction')}</Text><Text className="text-sm text-red-500" style={{ fontVariant: ['tabular-nums'] }}>-{currency} {transportDeduction.toFixed(2)}</Text></View>}
                {totalDiscounts > 0 && <View className="flex-row justify-between"><Text className="text-xs text-muted-foreground">{t('batches.saleForm.totalDiscounts', 'Total Discounts')}</Text><Text className="text-sm text-red-500" style={{ fontVariant: ['tabular-nums'] }}>-{currency} {totalDiscounts.toFixed(2)}</Text></View>}
                {showVat && <View className="flex-row justify-between"><Text className="text-xs text-muted-foreground">{t('batches.saleForm.vat')}</Text><Text className="text-sm text-foreground" style={{ fontVariant: ['tabular-nums'] }}>{currency} {vat.toFixed(2)}</Text></View>}
                <View className="flex-row justify-between"><Text className="text-xs font-semibold text-foreground">{t('batches.saleForm.grandTotal')}</Text><Text className="text-sm font-bold text-foreground" style={{ fontVariant: ['tabular-nums'] }}>{currency} {grandTotal.toFixed(2)}</Text></View>
              </View>
            </>
          )}
        </ScrollView>

        <View className="px-4 pt-4 border-t border-border flex-row gap-3" style={{ paddingBottom: Math.max(safeBottom, 16) }}>
          {step > 0 && (
            <Button variant="outline" onPress={() => setStep((s) => s - 1)} className="flex-1">
              {t('common.back')}
            </Button>
          )}
          {step < totalSteps - 1 ? (
            <Button onPress={() => { if (step === 0 && !validateStep0()) return; setStep((s) => s + 1); }} className="flex-1">
              {t('common.next')}
            </Button>
          ) : (
            <Button onPress={handleSave} loading={saving} disabled={saving} className="flex-1">
              {editData ? t('common.save') : t('common.create')}
            </Button>
          )}
        </View>
      </KeyboardAvoidingView>

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
    </Modal>
  );
}
