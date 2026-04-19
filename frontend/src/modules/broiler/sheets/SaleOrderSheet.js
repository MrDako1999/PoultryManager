import { useState, useEffect, useMemo, useCallback } from 'react';
import useOfflineMutation from '@/hooks/useOfflineMutation';
import useLocalQuery from '@/hooks/useLocalQuery';
import useSettings from '@/hooks/useSettings';
import { useTranslation } from 'react-i18next';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter,
} from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/components/ui/use-toast';
import {
  Loader2, Plus, Minus, Trash2, ClipboardList, Hash, Calculator, Tag,
  ChevronLeft, ChevronRight, Truck,
} from 'lucide-react';
import SearchableSelect from '@/components/SearchableSelect';
import EnumButtonSelect from '@/components/EnumButtonSelect';
import FileUpload from '@/components/FileUpload';
import QuickAddBusinessSheet from '@/shared/sheets/QuickAddBusinessSheet';
import ConfirmDiscardDialog from '@/components/ConfirmDiscardDialog';
import SaleSummaryPanel from '@/modules/broiler/sheets/SaleSummaryPanel';
import useFormGuard from '@/hooks/useFormGuard';
import api from '@/lib/api';
import db from '@/lib/db';
import { parseNum, fmtInt, fmtDec, fmtMoney, formatDateForInput, todayStr, intOnChange, decOnChange, decFormat } from '@/lib/format';
import { COUNTRY_VAT_MAP, DOC_ACCEPT } from '@/lib/constants';

const PART_TYPES = [
  'LIVER', 'GIZZARD', 'HEART', 'BREAST', 'LEG', 'WING',
  'BONE', 'THIGH', 'DRUMSTICK', 'BONELESS_THIGH', 'NECK', 'MINCE',
];

function addDays(dateStr, days) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

export default function SaleOrderSheet({ open, onOpenChange, batchId, editingSaleOrder, stacked, onSuccess }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const STEPS = ['saleData', 'details', 'accounting'];
  const [step, setStep] = useState('saleData');
  const stepIndex = STEPS.indexOf(step);
  const isFirstStep = stepIndex === 0;
  const isLastStep = stepIndex === STEPS.length - 1;
  const [formDirty, setFormDirty] = useState(false);
  const guard = useFormGuard(formDirty);
  const [quickAddBizOpen, setQuickAddBizOpen] = useState(false);
  const [quickAddBizField, setQuickAddBizField] = useState(null);
  const [quickAddBizName, setQuickAddBizName] = useState('');

  // Step 1
  const [saleMethod, setSaleMethod] = useState('');
  const isSlaughtered = saleMethod === 'SLAUGHTERED';
  const isLiveByWeight = saleMethod === 'LIVE_BY_WEIGHT';
  const isLiveByPiece = saleMethod === 'LIVE_BY_PIECE';
  const isLive = isLiveByWeight || isLiveByPiece;

  const [invoiceType, setInvoiceType] = useState('');
  const [saleDate, setSaleDate] = useState(todayStr());
  const [slaughterDate, setSlaughterDate] = useState(addDays(todayStr(), -1));
  const [slaughterDateTouched, setSlaughterDateTouched] = useState(false);
  const [customer, setCustomer] = useState('');
  const [slaughterhouse, setSlaughterhouse] = useState('');
  const [slaughterhouseTouched, setSlaughterhouseTouched] = useState(false);
  const [slaughterInvoiceRef, setSlaughterInvoiceRef] = useState('');
  const [slaughterReportDocs, setSlaughterReportDocs] = useState([]);
  const [processingCost, setProcessingCost] = useState('');

  // Step 2 – Slaughtered counts
  const [chickensSent, setChickensSent] = useState('');
  const [condemnation, setCondemnation] = useState('');
  const [deathOnArrival, setDeathOnArrival] = useState('');
  const [rejections, setRejections] = useState('');
  const [shortage, setShortage] = useState('');
  const [bGradeCount, setBGradeCount] = useState('');

  // Step 2 – Live sale data
  const [liveBirdCount, setLiveBirdCount] = useState('');
  const [liveRatePerBird, setLiveRatePerBird] = useState('');
  const defaultLiveWeightDesc = t('batches.saleForm.liveWeightDefault');
  const [liveWeightItems, setLiveWeightItems] = useState([{ description: '', weightKg: '', ratePerKg: '', amount: 0 }]);

  // Step 3 – Slaughtered accounting
  const defaultChickenDesc = t('batches.saleForm.wholeChickensDefault');
  const [wholeChickenItems, setWholeChickenItems] = useState([{ description: '', weightKg: '', ratePerKg: '', amount: 0 }]);
  const [portions, setPortions] = useState([]);

  // Step 3 – Shared: transport & discounts
  const [showTransport, setShowTransport] = useState(true);
  const [truckCount, setTruckCount] = useState('1');
  const [truckRate, setTruckRate] = useState('');
  const [discountItems, setDiscountItems] = useState([]);

  // Queries
  const businesses = useLocalQuery('businesses');
  const accounting = useSettings('accounting');
  const saleDefaults = useSettings('saleDefaults');

  const currency = accounting?.currency || 'AED';
  const vatRate = accounting?.vatRate || 0;
  const showVat = invoiceType === 'VAT_INVOICE';

  const businessOptions = useMemo(
    () => businesses.map((b) => ({ value: b._id, label: b.companyName })),
    [businesses]
  );

  // Initialize defaults when opening (new sale)
  useEffect(() => {
    if (open && saleDefaults && !editingSaleOrder) {
      const rates = saleDefaults.portionRates || {};
      setPortions(PART_TYPES.map((pt) => ({
        partType: pt,
        quantity: '',
        rate: fmtDec(rates[pt] || 0),
        amount: 0,
      })));
      setShowTransport(true);
      setTruckCount('1');
      setTruckRate(fmtDec(saleDefaults.transportRatePerTruck || 0));
      setWholeChickenItems([{ description: defaultChickenDesc, weightKg: '', ratePerKg: '', amount: 0 }]);
      setLiveWeightItems([{ description: defaultLiveWeightDesc, weightKg: '', ratePerKg: '', amount: 0 }]);
    }
  }, [open, saleDefaults, editingSaleOrder, defaultChickenDesc, defaultLiveWeightDesc]);

  // Populate form when editing
  useEffect(() => {
    if (open && editingSaleOrder) {
      const so = editingSaleOrder;
      const sl = so.slaughter || {};
      const cn = so.counts || {};
      const tr = so.transport || {};
      const lv = so.live || {};

      setSaleMethod(so.saleMethod || 'SLAUGHTERED');
      setInvoiceType(so.invoiceType || 'CASH_MEMO');
      setSaleDate(formatDateForInput(so.saleDate));
      setSlaughterDate(formatDateForInput(sl.date));
      setSlaughterDateTouched(true);
      setCustomer(typeof so.customer === 'object' ? so.customer?._id : so.customer || '');
      const sh = typeof sl.slaughterhouse === 'object' ? sl.slaughterhouse?._id : sl.slaughterhouse || '';
      setSlaughterhouse(sh);
      setSlaughterhouseTouched(!!sh);
      setSlaughterInvoiceRef(sl.invoiceRef || '');
      const rawReportDocs = (sl.reportDocs || []).filter(Boolean);
      (async () => {
        const resolved = await Promise.all(
          rawReportDocs.map(async (doc) => {
            if (typeof doc === 'object' && doc._id) return doc;
            const id = typeof doc === 'string' ? doc : doc?._id;
            if (!id) return null;
            const media = await db.media.get(id);
            return media || { _id: id };
          }),
        );
        setSlaughterReportDocs(resolved.filter(Boolean));
      })();
      setProcessingCost(fmtDec(sl.processingCost || 0));

      setChickensSent(fmtInt(cn.chickensSent));
      setCondemnation(fmtInt(cn.condemnation));
      setDeathOnArrival(fmtInt(cn.deathOnArrival));
      setRejections(fmtInt(cn.rejections));
      setShortage(fmtInt(cn.shortage));
      setBGradeCount(fmtInt(cn.bGrade));

      setLiveBirdCount(fmtInt(lv.birdCount));
      setLiveRatePerBird(fmtDec(lv.ratePerBird));
      setLiveWeightItems(
        (lv.weightItems?.length ? lv.weightItems : [{ description: defaultLiveWeightDesc, weightKg: '', ratePerKg: '', amount: 0 }])
          .map((i) => ({ description: i.description || defaultLiveWeightDesc, weightKg: fmtDec(i.weightKg), ratePerKg: fmtDec(i.ratePerKg), amount: i.amount || 0 }))
      );

      setWholeChickenItems(
        (so.wholeChickenItems?.length ? so.wholeChickenItems : [{ description: defaultChickenDesc, weightKg: '', ratePerKg: '', amount: 0 }])
          .map((i) => ({ description: i.description || defaultChickenDesc, weightKg: fmtDec(i.weightKg), ratePerKg: fmtDec(i.ratePerKg), amount: i.amount || 0 }))
      );

      const defaultRates = saleDefaults?.portionRates || {};
      setPortions(PART_TYPES.map((pt) => {
        const existing = so.portions?.find((p) => p.partType === pt);
        return {
          partType: pt,
          quantity: existing?.quantity ? fmtInt(existing.quantity) : '',
          rate: existing?.rate != null ? fmtDec(existing.rate) : fmtDec(defaultRates[pt] || 0),
          amount: existing?.amount || 0,
        };
      }));

      const hasTruck = (tr.truckCount || 0) > 0 || (tr.ratePerTruck || 0) > 0;
      setShowTransport(hasTruck);
      setTruckCount(fmtInt(tr.truckCount) || (hasTruck ? '1' : ''));
      setTruckRate(fmtDec(tr.ratePerTruck != null ? tr.ratePerTruck : saleDefaults?.transportRatePerTruck || 0));

      setDiscountItems(
        (so.discounts || []).map((d) => ({ description: d.description || '', amount: fmtDec(d.amount) }))
      );

      setFormDirty(false);
      setStep('saleData');
    }
  }, [open, editingSaleOrder, saleDefaults, defaultChickenDesc, defaultLiveWeightDesc]);

  useEffect(() => {
    const resolve = (val, setter) => {
      if (!val || businesses.some(b => b._id === val)) return;
      db.idMap.get({ tempId: val, entityType: 'businesses' }).then(mapping => {
        if (mapping) setter(mapping.realId);
      });
    };
    resolve(customer, setCustomer);
    resolve(slaughterhouse, setSlaughterhouse);
  }, [businesses]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-fill slaughterDate when saleDate changes
  const handleSaleDateChange = (val) => {
    setSaleDate(val);
    if (isSlaughtered && !slaughterDateTouched) {
      setSlaughterDate(addDays(val, -1));
    }
    markDirty();
  };

  const handleSlaughterDateChange = (val) => {
    setSlaughterDate(val);
    setSlaughterDateTouched(true);
    markDirty();
  };

  const handleCustomerChange = (val) => {
    setCustomer(val);
    if (isSlaughtered && !slaughterhouseTouched) {
      setSlaughterhouse(val);
    }
    markDirty();
  };

  const handleSlaughterhouseChange = (val) => {
    setSlaughterhouse(val);
    setSlaughterhouseTouched(true);
    markDirty();
  };

  const markDirty = useCallback(() => {
    setFormDirty(true);
    guard.markDirty();
  }, [guard]);

  // ── Computed: Slaughtered quantities ──
  const numChickensSent = parseNum(chickensSent);
  const numCondemnation = parseNum(condemnation);
  const numDOA = parseNum(deathOnArrival);
  const numRejections = parseNum(rejections);
  const numShortage = parseNum(shortage);
  const numBGrade = parseNum(bGradeCount);
  const netProcessed = numChickensSent - numCondemnation - numDOA - numRejections - numShortage;
  const wholeChickenCount = Math.max(0, netProcessed - numBGrade);

  // ── Computed: Slaughtered financials ──
  const computedWholeChickenItems = useMemo(() =>
    wholeChickenItems.map((item) => {
      const w = parseNum(item.weightKg);
      const r = parseNum(item.ratePerKg);
      return { ...item, amount: w * r };
    }), [wholeChickenItems]);

  const wholeChickenTotal = useMemo(() =>
    computedWholeChickenItems.reduce((sum, i) => sum + i.amount, 0), [computedWholeChickenItems]);

  const computedPortions = useMemo(() =>
    portions.map((p) => {
      const q = parseNum(p.quantity);
      const r = parseNum(p.rate);
      return { ...p, amount: q * r };
    }), [portions]);

  const portionsTotalVal = useMemo(() =>
    computedPortions.reduce((sum, p) => sum + p.amount, 0), [computedPortions]);

  // ── Computed: Live financials ──
  const numLiveBirdCount = parseNum(liveBirdCount);
  const numLiveRatePerBird = parseNum(liveRatePerBird);
  const livePieceTotal = numLiveBirdCount * numLiveRatePerBird;

  const computedLiveWeightItems = useMemo(() =>
    liveWeightItems.map((item) => {
      const w = parseNum(item.weightKg);
      const r = parseNum(item.ratePerKg);
      return { ...item, amount: w * r };
    }), [liveWeightItems]);

  const liveWeightTotal = useMemo(() =>
    computedLiveWeightItems.reduce((sum, i) => sum + i.amount, 0), [computedLiveWeightItems]);

  const liveSalesTotal = isLiveByPiece ? livePieceTotal : liveWeightTotal;

  // ── Computed: Shared totals ──
  const grossSalesAmount = isSlaughtered
    ? wholeChickenTotal + portionsTotalVal
    : liveSalesTotal;

  const transportDeductionVal = parseNum(truckCount) * parseNum(truckRate);

  const discountsTotalVal = useMemo(() =>
    discountItems.reduce((sum, d) => sum + parseNum(d.amount), 0), [discountItems]);

  const subtotalVal = grossSalesAmount - transportDeductionVal - discountsTotalVal;
  const vatAmountVal = showVat ? subtotalVal * (vatRate / 100) : 0;
  const grandTotalVal = subtotalVal + vatAmountVal;

  const numProcessingCost = parseNum(processingCost);
  const netRevenueVal = grandTotalVal - (isSlaughtered ? numProcessingCost : 0);

  // ── Row management: Whole chickens ──
  const addWholeChickenRow = () => {
    setWholeChickenItems((prev) => [...prev, { description: defaultChickenDesc, weightKg: '', ratePerKg: '', amount: 0 }]);
    markDirty();
  };
  const updateWholeChickenItem = (index, field, value) => {
    setWholeChickenItems((prev) => prev.map((item, i) => i === index ? { ...item, [field]: value } : item));
    markDirty();
  };
  const removeWholeChickenRow = (index) => {
    setWholeChickenItems((prev) => prev.filter((_, i) => i !== index));
    markDirty();
  };

  // ── Row management: Live weight items ──
  const addLiveWeightRow = () => {
    setLiveWeightItems((prev) => [...prev, { description: defaultLiveWeightDesc, weightKg: '', ratePerKg: '', amount: 0 }]);
    markDirty();
  };
  const updateLiveWeightItem = (index, field, value) => {
    setLiveWeightItems((prev) => prev.map((item, i) => i === index ? { ...item, [field]: value } : item));
    markDirty();
  };
  const removeLiveWeightRow = (index) => {
    setLiveWeightItems((prev) => prev.filter((_, i) => i !== index));
    markDirty();
  };

  // ── Row management: Portions ──
  const updatePortion = (index, field, value) => {
    setPortions((prev) => prev.map((p, i) => i === index ? { ...p, [field]: value } : p));
    markDirty();
  };

  // ── Row management: Discount items ──
  const addDiscountRow = () => {
    setDiscountItems((prev) => [...prev, { description: '', amount: '' }]);
    markDirty();
  };
  const updateDiscountItem = (index, field, value) => {
    setDiscountItems((prev) => prev.map((d, i) => i === index ? { ...d, [field]: value } : d));
    markDirty();
  };
  const removeDiscountRow = (index) => {
    setDiscountItems((prev) => prev.filter((_, i) => i !== index));
    markDirty();
  };

  const fireInvoiceGeneration = async (saleOrderId) => {
    try {
      let resolvedId = saleOrderId;

      const isTempId = saleOrderId.includes('-');
      if (isTempId) {
        for (let i = 0; i < 30; i++) {
          await new Promise((r) => setTimeout(r, 500));
          const mapping = await db.idMap.get({ tempId: saleOrderId, entityType: 'saleOrders' });
          if (mapping) {
            resolvedId = mapping.realId;
            break;
          }
        }
        if (resolvedId === saleOrderId) return;
      } else {
        for (let i = 0; i < 30; i++) {
          const pending = await db.mutationQueue.where('status').equals('pending').count();
          if (pending === 0) break;
          await new Promise((r) => setTimeout(r, 500));
        }
      }

      const { data: updated } = await api.post(`/sale-orders/${resolvedId}/invoice`);
      if (updated?._id) {
        await db.saleOrders.put(updated);
      }
      toast({ title: t('batches.invoiceGenerated') });
    } catch {
      toast({ title: t('batches.invoiceGenerationFailed'), variant: 'destructive' });
    }
  };

  const { mutate, isPending: isMutating } = useOfflineMutation('saleOrders');

  const resetForm = () => {
    setStep('saleData');
    setSaleMethod('');
    setInvoiceType('');
    setSaleDate(todayStr());
    setSlaughterDate(addDays(todayStr(), -1));
    setSlaughterDateTouched(false);
    setCustomer('');
    setSlaughterhouse('');
    setSlaughterhouseTouched(false);
    setSlaughterInvoiceRef('');
    setSlaughterReportDocs([]);
    setProcessingCost('');
    setChickensSent('');
    setCondemnation('');
    setDeathOnArrival('');
    setRejections('');
    setShortage('');
    setBGradeCount('');
    setLiveBirdCount('');
    setLiveRatePerBird('');
    setLiveWeightItems([{ description: defaultLiveWeightDesc, weightKg: '', ratePerKg: '', amount: 0 }]);
    setWholeChickenItems([{ description: defaultChickenDesc, weightKg: '', ratePerKg: '', amount: 0 }]);
    setPortions([]);
    setShowTransport(true);
    setTruckCount('1');
    setTruckRate('');
    setDiscountItems([]);
    setFormDirty(false);
    guard.resetGuard();
  };

  const closeSheet = () => {
    resetForm();
    onOpenChange(false);
  };

  const tryClose = () => {
    if (guard.isDirty) {
      guard.setConfirmOpen(true);
    } else {
      closeSheet();
    }
  };

  const handleOpenChange = (isOpen) => {
    if (!isOpen) {
      tryClose();
    } else {
      guard.armGuard();
    }
  };

  const handleSubmit = () => {
    const finalDiscounts = discountItems
      .filter((d) => parseNum(d.amount) > 0)
      .map((d) => ({ description: d.description, amount: parseNum(d.amount) }));

    const payload = {
      batch: batchId,
      saleMethod,
      invoiceType,
      saleDate: saleDate || null,
      customer: customer || null,

      slaughter: isSlaughtered ? {
        method: 'SLAUGHTERED',
        date: slaughterDate || null,
        slaughterhouse: slaughterhouse || null,
        invoiceRef: slaughterInvoiceRef,
        reportDocs: slaughterReportDocs.map((m) => m._id),
        processingCost: numProcessingCost,
      } : null,

      live: isLive ? {
        birdCount: numLiveBirdCount,
        ratePerBird: isLiveByPiece ? numLiveRatePerBird : 0,
        weightItems: isLiveByWeight
          ? computedLiveWeightItems.map((i) => ({
              description: i.description,
              weightKg: parseNum(i.weightKg),
              ratePerKg: parseNum(i.ratePerKg),
              amount: i.amount,
            }))
          : [],
      } : null,

      counts: isSlaughtered ? {
        chickensSent: numChickensSent,
        condemnation: numCondemnation,
        deathOnArrival: numDOA,
        rejections: numRejections,
        shortage: numShortage,
        bGrade: numBGrade,
      } : {},

      wholeChickenItems: isSlaughtered
        ? computedWholeChickenItems.map((i) => ({
            description: i.description,
            weightKg: parseNum(i.weightKg),
            ratePerKg: parseNum(i.ratePerKg),
            amount: i.amount,
          }))
        : [],

      portions: isSlaughtered
        ? computedPortions
            .filter((p) => parseNum(p.quantity) > 0)
            .map((p) => ({ partType: p.partType, quantity: parseNum(p.quantity), rate: parseNum(p.rate), amount: p.amount }))
        : [],

      transport: {
        truckCount: parseNum(truckCount),
        ratePerTruck: parseNum(truckRate),
      },

      discounts: finalDiscounts,

      totals: {
        wholeChicken: isSlaughtered ? wholeChickenTotal : 0,
        portions: isSlaughtered ? portionsTotalVal : 0,
        liveSales: isLive ? liveSalesTotal : 0,
        grossSales: grossSalesAmount,
        transportDeduction: transportDeductionVal,
        discounts: discountsTotalVal,
        subtotal: subtotalVal,
        vat: vatAmountVal,
        grandTotal: grandTotalVal,
      },
    };

    mutate({
      action: editingSaleOrder ? 'update' : 'create',
      id: editingSaleOrder ? editingSaleOrder._id : undefined,
      data: payload,
    }, {
      onSuccess: (result) => {
        toast({ title: editingSaleOrder ? t('batches.saleUpdated') : t('batches.saleCreated') });
        const savedId = result?._id || editingSaleOrder?._id;
        if (savedId) fireInvoiceGeneration(savedId);
        closeSheet();
        onSuccess?.();
      },
    });
  };

  const handleQuickAddBusiness = (biz) => {
    if (quickAddBizField === 'customer') {
      setCustomer(biz._id);
      if (isSlaughtered && !slaughterhouseTouched) setSlaughterhouse(biz._id);
    } else if (quickAddBizField === 'slaughterhouse') {
      setSlaughterhouse(biz._id);
      setSlaughterhouseTouched(true);
    }
    markDirty();
  };

  const fmt = fmtMoney;

  // Tab 2 & 3 labels change based on sale method
  const tab2Label = isSlaughtered ? t('batches.saleForm.stepQuantity') : t('batches.saleForm.stepSaleDetails');
  const tab3Label = isSlaughtered ? t('batches.saleForm.stepAccounting') : t('batches.saleForm.stepDiscounts');

  const stepTruckCount = (delta) => {
    const current = parseNum(truckCount);
    const next = Math.max(0, current + delta);
    setTruckCount(fmtInt(next));
    markDirty();
  };

  const stepTruckRate = (delta) => {
    const current = parseNum(truckRate);
    const next = Math.max(0, current + delta);
    setTruckRate(next ? fmtDec(next) : '');
    markDirty();
  };

  const removeTransport = () => {
    setShowTransport(false);
    setTruckCount('');
    setTruckRate('');
    markDirty();
  };

  // ── Shared Discounts section (rendered inside Tab 3) ──
  const discountsUI = (
    <div className="space-y-3">
      <h3 className="text-sm font-medium">{t('batches.saleForm.discountsSection')}</h3>

      {showTransport ? (
        <div className="rounded-lg border p-3 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Truck className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground">{t('batches.saleForm.transportSection')}</span>
            </div>
            <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={removeTransport}>
              <Trash2 className="h-3.5 w-3.5 text-destructive" />
            </Button>
          </div>

          <div className="grid gap-3 grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs">{t('batches.saleForm.truckCount')}</Label>
              <div className="flex items-center gap-1">
                <Button type="button" variant="outline" size="icon" className="h-9 w-9 shrink-0" onClick={() => stepTruckCount(-1)}>
                  <Minus className="h-3.5 w-3.5" />
                </Button>
                <Input
                  type="text" inputMode="numeric"
                  value={truckCount}
                  onChange={intOnChange(setTruckCount, markDirty)}
                  className="text-center"
                />
                <Button type="button" variant="outline" size="icon" className="h-9 w-9 shrink-0" onClick={() => stepTruckCount(1)}>
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t('batches.saleForm.truckRate')}</Label>
              <div className="flex items-center gap-1">
                <Button type="button" variant="outline" size="icon" className="h-9 w-9 shrink-0" onClick={() => stepTruckRate(-50)}>
                  <Minus className="h-3.5 w-3.5" />
                </Button>
                <div className="relative flex-1">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{currency}</span>
                  <Input
                    type="text" inputMode="decimal"
                    value={truckRate}
                    onChange={decOnChange(setTruckRate, markDirty)}
                    className="pl-11 text-center"
                  />
                </div>
                <Button type="button" variant="outline" size="icon" className="h-9 w-9 shrink-0" onClick={() => stepTruckRate(50)}>
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>

          {transportDeductionVal > 0 && (
            <div className="flex justify-between items-center text-sm font-semibold text-red-600 dark:text-red-400 border-t pt-2">
              <span>{t('batches.saleForm.transportDeduction')}</span>
              <span>-{currency} {fmt(transportDeductionVal)}</span>
            </div>
          )}
        </div>
      ) : (
        <Button
          type="button" variant="outline" size="sm" className="gap-1.5"
          onClick={() => { setShowTransport(true); setTruckCount('1'); markDirty(); }}
        >
          <Truck className="h-3.5 w-3.5" />
          {t('batches.saleForm.addTransport')}
        </Button>
      )}

      {/* Custom discount line items */}
      <div className="space-y-2">
        {discountItems.map((d, i) => (
          <div key={i} className="rounded-lg border p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">#{i + 1}</span>
              <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeDiscountRow(i)}>
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
              </Button>
            </div>
            <div className="grid grid-cols-[1fr_120px] gap-2">
              <Input
                placeholder={t('batches.saleForm.discountDescription')}
                value={d.description}
                onChange={(e) => updateDiscountItem(i, 'description', e.target.value)}
                className="text-sm"
              />
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{currency}</span>
                <Input
                  type="text" inputMode="decimal"
                  value={d.amount}
                  onChange={(e) => updateDiscountItem(i, 'amount', decFormat(e))}
                  className="pl-12 text-sm"
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={addDiscountRow}>
        <Plus className="h-3.5 w-3.5" />
        {t('batches.saleForm.addDiscount')}
      </Button>

      {(transportDeductionVal + discountsTotalVal) > 0 && (
        <div className="flex justify-between items-center text-sm font-semibold text-red-600 dark:text-red-400 border-t pt-2">
          <span>{t('batches.saleForm.totalDiscounts')}</span>
          <span>-{currency} {fmt(transportDeductionVal + discountsTotalVal)}</span>
        </div>
      )}
    </div>
  );

  // ── Reusable weight rows renderer (shared between whole chickens and live weight) ──
  const renderWeightRows = (items, computedItems, total, opts) => (
    <div>
      <h3 className="text-sm font-medium mb-3">{opts.title}</h3>
      <div className="space-y-3">
        {items.map((item, i) => (
          <div key={i} className="rounded-lg border p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">#{i + 1}</span>
              {items.length > 1 && (
                <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => opts.onRemove(i)}>
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              )}
            </div>
            <Input
              placeholder={t('batches.saleForm.description')}
              value={item.description}
              onChange={(e) => opts.onUpdate(i, 'description', e.target.value)}
              className="text-sm"
            />
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">{t('batches.saleForm.weightKg')}</Label>
                <Input
                  type="text" inputMode="decimal"
                  value={item.weightKg}
                  onChange={(e) => opts.onUpdate(i, 'weightKg', decFormat(e))}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{t('batches.saleForm.ratePerKg')}</Label>
                <Input
                  type="text" inputMode="decimal"
                  value={item.ratePerKg}
                  onChange={(e) => opts.onUpdate(i, 'ratePerKg', decFormat(e))}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{t('batches.saleForm.amount')}</Label>
                <Input
                  value={`${currency} ${fmt(computedItems[i]?.amount || 0)}`}
                  disabled
                  className="opacity-60"
                />
              </div>
            </div>
          </div>
        ))}
      </div>
      <Button type="button" variant="outline" size="sm" className="mt-2 gap-1.5" onClick={opts.onAdd}>
        <Plus className="h-3.5 w-3.5" />
        {t('batches.saleForm.addRow')}
      </Button>
      <div className="flex justify-between items-center mt-3 text-sm font-semibold border-t pt-2">
        <span>{opts.totalLabel}</span>
        <span>{currency} {fmt(total)}</span>
      </div>
    </div>
  );

  return (
    <>
      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetContent className={`sm:max-w-lg flex flex-col ${stacked ? 'z-[60]' : ''}`}>
          <SheetHeader className="mb-2">
            <SheetTitle>{editingSaleOrder ? t('batches.editSale') : t('batches.addSale')}</SheetTitle>
            <SheetDescription>{editingSaleOrder ? t('batches.editSaleDesc') : t('batches.addSaleDesc')}</SheetDescription>
          </SheetHeader>

          <Tabs value={step} onValueChange={setStep} className="flex-1 flex flex-col min-h-0">
            <TabsList className="w-full grid grid-cols-3 shrink-0 mx-6 mb-4" style={{ width: 'calc(100% - 3rem)' }}>
              <TabsTrigger value="saleData" className="gap-1.5 text-xs">
                <ClipboardList className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{t('batches.saleForm.stepSaleData')}</span>
              </TabsTrigger>
              <TabsTrigger value="details" className="gap-1.5 text-xs">
                <Hash className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{tab2Label}</span>
              </TabsTrigger>
              <TabsTrigger value="accounting" className="gap-1.5 text-xs">
                {isSlaughtered ? <Calculator className="h-3.5 w-3.5" /> : <Tag className="h-3.5 w-3.5" />}
                <span className="hidden sm:inline">{tab3Label}</span>
              </TabsTrigger>
            </TabsList>

            <ScrollArea className="flex-1 min-h-0">
              <div className="px-6 py-4 space-y-6 overflow-hidden">

                {/* ─── STEP 1: SALE DATA ─── */}
                <TabsContent value="saleData" className="mt-0 space-y-4">
                  <div className="space-y-2">
                    <Label>{t('batches.saleForm.saleMethod')} <span className="text-destructive">*</span></Label>
                    <EnumButtonSelect
                      options={[
                        { value: 'SLAUGHTERED', label: t('batches.saleMethods.SLAUGHTERED') },
                        { value: 'LIVE_BY_WEIGHT', label: t('batches.saleMethods.LIVE_BY_WEIGHT') },
                        { value: 'LIVE_BY_PIECE', label: t('batches.saleMethods.LIVE_BY_PIECE') },
                      ]}
                      value={saleMethod}
                      onChange={(val) => { setSaleMethod(val); markDirty(); }}
                      columns={3}
                    />
                  </div>

                  {(!!editingSaleOrder || !!saleMethod) && (
                    <div className="space-y-2">
                      <Label>{t('batches.saleForm.invoiceType')} <span className="text-destructive">*</span></Label>
                      <EnumButtonSelect
                        compact
                        options={[
                          { value: 'VAT_INVOICE', label: t('batches.saleInvoiceTypes.VAT_INVOICE') },
                          { value: 'CASH_MEMO', label: t('batches.saleInvoiceTypes.CASH_MEMO') },
                        ]}
                        value={invoiceType}
                        onChange={(val) => { setInvoiceType(val); markDirty(); }}
                        columns={2}
                      />
                    </div>
                  )}

                  {(!!editingSaleOrder || !!invoiceType) && (
                    <>
                      <div className="space-y-2">
                        <Label>{t('batches.saleForm.saleDate')}</Label>
                        <Input type="date" value={saleDate} onChange={(e) => handleSaleDateChange(e.target.value)} />
                      </div>

                      <div className="space-y-2">
                        <Label>{t('batches.saleForm.customer')}</Label>
                        <SearchableSelect
                          options={businessOptions}
                          value={customer}
                          onChange={handleCustomerChange}
                          placeholder={t('batches.saleForm.selectCustomer')}
                          searchPlaceholder={t('batches.saleForm.searchCustomer')}
                          emptyMessage={t('common.noResults')}
                          createLabel={t('businesses.addBusiness')}
                          onCreate={(name) => { setQuickAddBizField('customer'); setQuickAddBizName(name || ''); setQuickAddBizOpen(true); }}
                        />
                      </div>

                      {isSlaughtered && (
                        <>
                          <Separator />

                          <div className="grid gap-4 grid-cols-2">
                            <div className="space-y-2">
                              <Label>{t('batches.saleForm.slaughterDate')}</Label>
                              <Input type="date" value={slaughterDate} onChange={(e) => handleSlaughterDateChange(e.target.value)} />
                            </div>
                            <div className="space-y-2">
                              <Label>{t('batches.saleForm.slaughterhouse')}</Label>
                              <SearchableSelect
                                options={businessOptions}
                                value={slaughterhouse}
                                onChange={handleSlaughterhouseChange}
                                placeholder={t('batches.saleForm.selectSlaughterhouse')}
                                searchPlaceholder={t('batches.saleForm.searchSlaughterhouse')}
                                emptyMessage={t('common.noResults')}
                                createLabel={t('businesses.addBusiness')}
                                onCreate={(name) => { setQuickAddBizField('slaughterhouse'); setQuickAddBizName(name || ''); setQuickAddBizOpen(true); }}
                              />
                            </div>
                          </div>

                          <div className="space-y-2">
                            <Label>{t('batches.saleForm.slaughterInvoiceRef')}</Label>
                            <Input
                              value={slaughterInvoiceRef}
                              onChange={(e) => { setSlaughterInvoiceRef(e.target.value); markDirty(); }}
                              placeholder={t('batches.saleForm.slaughterInvoiceRefPlaceholder')}
                            />
                          </div>

                          <div className="space-y-2">
                            <Label>{t('batches.saleForm.processingCost')}</Label>
                            <p className="text-xs text-muted-foreground -mt-1">{t('batches.saleForm.processingCostHint')}</p>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{currency}</span>
                              <Input
                                type="text" inputMode="decimal"
                                value={processingCost}
                                onChange={decOnChange(setProcessingCost, markDirty)}
                                className="pl-12"
                              />
                            </div>
                          </div>

                          <div className="space-y-2">
                            {slaughterReportDocs.map((media, i) => (
                              <FileUpload
                                key={media?._id || i}
                                label={i === 0 ? t('batches.saleForm.slaughterReport') : undefined}
                                value={media}
                                onRemove={() => {
                                  setSlaughterReportDocs((prev) => prev.filter((_, idx) => idx !== i));
                                  markDirty();
                                }}
                                entityType="saleOrder"
                                category="slaughterReport"
                                mediaType="document"
                                accept={DOC_ACCEPT}
                              />
                            ))}
                            <FileUpload
                              label={slaughterReportDocs.length === 0 ? t('batches.saleForm.slaughterReport') : undefined}
                              value={null}
                              multiple
                              onUpload={(media) => {
                                setSlaughterReportDocs((prev) => [...prev, ...(Array.isArray(media) ? media : [media])]);
                                markDirty();
                              }}
                              entityType="saleOrder"
                              category="slaughterReport"
                              mediaType="document"
                              accept={DOC_ACCEPT}
                            />
                          </div>
                        </>
                      )}
                    </>
                  )}
                </TabsContent>

                {/* ─── STEP 2: DETAILS (conditional) ─── */}
                <TabsContent value="details" className="mt-0 space-y-4">
                  {isSlaughtered && (
                    <>
                      <div className="space-y-2">
                        <div className="grid grid-cols-[1fr_120px] items-center gap-3">
                          <Label className="text-sm">{t('batches.saleForm.chickensSent')}</Label>
                          <Input
                            type="text" inputMode="numeric"
                            value={chickensSent}
                            onChange={intOnChange(setChickensSent, markDirty)}
                            className="h-9 text-right"
                          />
                        </div>

                        <Separator />

                        {[
                          ['condemnation', condemnation, setCondemnation, t('batches.saleForm.condemnation')],
                          ['deathOnArrival', deathOnArrival, setDeathOnArrival, t('batches.saleForm.deathOnArrival')],
                          ['rejections', rejections, setRejections, t('batches.saleForm.rejections')],
                          ['shortage', shortage, setShortage, t('batches.saleForm.shortage')],
                          ['bGradeCount', bGradeCount, setBGradeCount, t('batches.saleForm.bGradeCount')],
                        ].map(([key, val, setter, label]) => (
                          <div key={key} className="grid grid-cols-[1fr_120px] items-center gap-3">
                            <Label className="text-sm">{label}</Label>
                            <Input
                              type="text" inputMode="numeric"
                              value={val}
                              onChange={intOnChange(setter, markDirty)}
                              className="h-9 text-right"
                            />
                          </div>
                        ))}
                      </div>

                      <div className="rounded-lg border bg-muted/50 p-4 space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>{t('batches.saleForm.netProcessed')}</span>
                          <span className="font-semibold">{netProcessed.toLocaleString('en-US')}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span>{t('batches.saleForm.wholeChickenCount')}</span>
                          <span className="font-semibold text-primary">{wholeChickenCount.toLocaleString('en-US')}</span>
                        </div>
                      </div>
                    </>
                  )}

                  {isLiveByWeight && (
                    <>
                      <div className="space-y-2">
                        <div className="grid grid-cols-[1fr_120px] items-center gap-3">
                          <Label className="text-sm">{t('batches.saleForm.birdCount')}</Label>
                          <Input
                            type="text" inputMode="numeric"
                            value={liveBirdCount}
                            onChange={intOnChange(setLiveBirdCount, markDirty)}
                            className="h-9 text-right"
                          />
                        </div>
                      </div>

                      <Separator />

                      {renderWeightRows(liveWeightItems, computedLiveWeightItems, liveWeightTotal, {
                        title: t('batches.saleForm.liveByWeightSection'),
                        totalLabel: t('batches.saleForm.liveSalesTotal'),
                        onAdd: addLiveWeightRow,
                        onUpdate: updateLiveWeightItem,
                        onRemove: removeLiveWeightRow,
                      })}
                    </>
                  )}

                  {isLiveByPiece && (
                    <div className="space-y-4">
                      <h3 className="text-sm font-medium">{t('batches.saleForm.liveByPieceSection')}</h3>
                      <div className="grid grid-cols-[1fr_120px] items-center gap-3">
                        <Label className="text-sm">{t('batches.saleForm.birdCount')}</Label>
                        <Input
                          type="text" inputMode="numeric"
                          value={liveBirdCount}
                          onChange={intOnChange(setLiveBirdCount, markDirty)}
                          className="h-9 text-right"
                        />
                      </div>
                      <div className="grid grid-cols-[1fr_120px] items-center gap-3">
                        <Label className="text-sm">{t('batches.saleForm.ratePerBird')}</Label>
                        <Input
                          type="text" inputMode="decimal"
                          value={liveRatePerBird}
                          onChange={decOnChange(setLiveRatePerBird, markDirty)}
                          className="h-9 text-right"
                        />
                      </div>

                      <div className="rounded-lg border bg-muted/50 p-4">
                        <div className="flex justify-between text-sm font-semibold">
                          <span>{t('batches.saleForm.liveSalesTotal')}</span>
                          <span className="text-primary">{currency} {fmt(livePieceTotal)}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </TabsContent>

                {/* ─── STEP 3: ACCOUNTING / DISCOUNTS ─── */}
                <TabsContent value="accounting" className="mt-0 space-y-6">
                  {isSlaughtered && (
                    <>
                      {renderWeightRows(wholeChickenItems, computedWholeChickenItems, wholeChickenTotal, {
                        title: t('batches.saleForm.wholeChickenSection'),
                        totalLabel: t('batches.saleForm.wholeChickenTotal'),
                        onAdd: addWholeChickenRow,
                        onUpdate: updateWholeChickenItem,
                        onRemove: removeWholeChickenRow,
                      })}

                      <Separator />

                      {/* Portions */}
                      <div>
                        <h3 className="text-sm font-medium mb-3">{t('batches.saleForm.portionsSection')}</h3>
                        <div className="space-y-2">
                          <div className="grid grid-cols-[1fr_80px_80px_90px] gap-2 text-xs text-muted-foreground font-medium px-1">
                            <span></span>
                            <span>{t('batches.saleForm.quantity')}</span>
                            <span>{t('batches.saleForm.rate')}</span>
                            <span className="text-right">{t('batches.saleForm.amount')}</span>
                          </div>
                          {portions.map((p, i) => (
                            <div key={p.partType} className="grid grid-cols-[1fr_80px_80px_90px] gap-2 items-center">
                              <span className="text-sm">{t(`settings.portionLabels.${p.partType}`)}</span>
                              <Input
                                type="text" inputMode="numeric"
                                value={p.quantity}
                                onChange={(e) => {
                                  const raw = e.target.value.replace(/[^0-9]/g, '');
                                  updatePortion(i, 'quantity', fmtInt(Number(raw)));
                                }}
                                className="h-8 text-sm"
                              />
                              <Input
                                type="text" inputMode="decimal"
                                value={p.rate}
                                onChange={(e) => updatePortion(i, 'rate', decFormat(e))}
                                className="h-8 text-sm"
                              />
                              <span className="text-sm text-right tabular-nums">
                                {fmt(computedPortions[i]?.amount || 0)}
                              </span>
                            </div>
                          ))}
                        </div>
                        <div className="flex justify-between items-center mt-3 text-sm font-semibold border-t pt-2">
                          <span>{t('batches.saleForm.portionsTotal')}</span>
                          <span>{currency} {fmt(portionsTotalVal)}</span>
                        </div>
                      </div>

                      <Separator />
                    </>
                  )}

                  {discountsUI}
                </TabsContent>

                {/* ─── RUNNING SUMMARY ─── */}
                <div className="pt-2">
                  <SaleSummaryPanel
                    wholeChickenTotal={isSlaughtered ? wholeChickenTotal : 0}
                    portionsTotal={isSlaughtered ? portionsTotalVal : 0}
                    liveSalesTotal={isLive ? liveSalesTotal : 0}
                    grossSalesAmount={grossSalesAmount}
                    transportDeduction={transportDeductionVal}
                    discountsTotal={discountsTotalVal}
                    subtotal={subtotalVal}
                    vatAmount={vatAmountVal}
                    grandTotal={grandTotalVal}
                    processingCost={isSlaughtered ? numProcessingCost : 0}
                    netRevenue={netRevenueVal}
                    currency={currency}
                    showVat={showVat}
                  />
                </div>
              </div>
            </ScrollArea>
          </Tabs>

          <SheetFooter className="flex-row gap-2 justify-between pt-2 border-t px-6">
            <div>
              {isFirstStep ? (
                <Button variant="outline" onClick={tryClose} disabled={isMutating}>
                  {t('common.cancel')}
                </Button>
              ) : (
                <Button variant="outline" onClick={() => setStep(STEPS[stepIndex - 1])} disabled={isMutating}>
                  <ChevronLeft className="mr-1 h-4 w-4" />
                  {t('common.back')}
                </Button>
              )}
            </div>
            <div>
              {isLastStep ? (
                <Button onClick={handleSubmit} disabled={isMutating}>
                  {isMutating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {t('common.save')}
                </Button>
              ) : (
                <Button
                  onClick={() => setStep(STEPS[stepIndex + 1])}
                  disabled={isFirstStep && (!saleMethod || !invoiceType)}
                >
                  {t('common.next')}
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              )}
            </div>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <ConfirmDiscardDialog
        open={guard.confirmOpen}
        onOpenChange={guard.setConfirmOpen}
        onDiscard={closeSheet}
      />

      <QuickAddBusinessSheet
        open={quickAddBizOpen}
        onOpenChange={setQuickAddBizOpen}
        onCreated={handleQuickAddBusiness}
        initialName={quickAddBizName}
      />
    </>
  );
}
