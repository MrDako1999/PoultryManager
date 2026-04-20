import { useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2, Wheat } from 'lucide-react-native';
import SheetInput from '@/components/SheetInput';
import Select from '@/components/ui/Select';
import SlidingSegmentedControl from '@/components/SlidingSegmentedControl';
import DatePicker from '@/components/ui/DatePicker';
import MultiFileUpload from '@/components/MultiFileUpload';
import QuickAddBusinessSheet from '@/shared/sheets/QuickAddBusinessSheet';
import FormSheet from '@/components/FormSheet';
import {
  FormSection, FormField, SummaryCard, SummaryRow, CardDivider, AddRowButton,
} from '@/components/FormSheetParts';
import { useHeroSheetTokens } from '@/components/HeroSheetScreen';
import { useIsRTL } from '@/stores/localeStore';
import useLocalQuery from '@/hooks/useLocalQuery';
import useSettings from '@/hooks/useSettings';
import useOfflineMutation from '@/hooks/useOfflineMutation';
import { FEED_TYPES, FEED_TYPE_ICONS } from '@/lib/constants';
import { useToast } from '@/components/ui/Toast';

const parseNum = (v) => { const n = parseFloat(String(v).replace(/,/g, '')); return isNaN(n) ? 0 : n; };

const emptyLineItem = () => ({
  key: Date.now() + Math.random(),
  feedType: '', feedItem: '', feedDescription: '',
  pricePerBag: '', bags: '', quantitySize: '50', quantityUnit: 'KG',
});

export default function FeedOrderSheet({ open, onClose, batchId, editData }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const tokens = useHeroSheetTokens();
  const accounting = useSettings('accounting');
  const [businesses] = useLocalQuery('businesses');
  const [feedItems] = useLocalQuery('feedItems');
  const { create, update } = useOfflineMutation('feedOrders');
  const [saving, setSaving] = useState(false);
  const [quickAddBiz, setQuickAddBiz] = useState(false);
  const [bizInitialName, setBizInitialName] = useState('');
  const [pendingBiz, setPendingBiz] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [taxInvoiceDocs, setTaxInvoiceDocs] = useState([]);
  const [transferProofs, setTransferProofs] = useState([]);
  const [deliveryNoteDocs, setDeliveryNoteDocs] = useState([]);

  const currency = accounting?.currency || 'AED';
  const vatRate = accounting?.vatRate || 5;

  const [selectedCompany, setSelectedCompany] = useState('');
  const [taxInvoiceId, setTaxInvoiceId] = useState('');
  const [orderDate, setOrderDate] = useState(new Date().toISOString().slice(0, 10));
  const [deliveryDate, setDeliveryDate] = useState('');
  const [deliveryCharge, setDeliveryCharge] = useState('');
  const [lineItems, setLineItems] = useState([emptyLineItem()]);

  const feedCompanyIds = useMemo(() => {
    const ids = new Set();
    feedItems.forEach((fi) => {
      if (fi.isActive === false) return;
      const cid = fi.feedCompany?._id ?? fi.feedCompany;
      if (cid) ids.add(String(cid));
    });
    return ids;
  }, [feedItems]);

  const feedItemCountByCompany = useMemo(() => {
    const m = new Map();
    feedItems.forEach((fi) => {
      if (fi.isActive === false) return;
      const cid = fi.feedCompany?._id ?? fi.feedCompany;
      if (cid == null) return;
      const k = String(cid);
      m.set(k, (m.get(k) || 0) + 1);
    });
    return m;
  }, [feedItems]);

  const companyFeedItems = useMemo(() => {
    if (!selectedCompany) return [];
    const sid = String(selectedCompany);
    return feedItems.filter((fi) => {
      if (fi.isActive === false) return false;
      const cid = fi.feedCompany?._id ?? fi.feedCompany;
      return cid != null && String(cid) === sid;
    });
  }, [feedItems, selectedCompany]);

  const companyPickerOptions = useMemo(() => {
    let priRaw = businesses.filter((b) => feedCompanyIds.has(String(b._id)));
    let othRaw = businesses.filter((b) => !feedCompanyIds.has(String(b._id)));
    if (pendingBiz
      && !priRaw.some((b) => b._id === pendingBiz._id)
      && !othRaw.some((b) => b._id === pendingBiz._id)) {
      othRaw = [{ _id: pendingBiz._id, companyName: pendingBiz.companyName, trnNumber: pendingBiz.trnNumber }, ...othRaw];
    }
    const pri = priRaw.map((b) => {
      const n = feedItemCountByCompany.get(String(b._id)) || 0;
      const catalogueTag = n === 1
        ? t('batches.feedProductCount_one', '1 product')
        : n > 1
          ? t('batches.feedProductCount_many', '{{count}} products', { count: n })
          : undefined;
      return {
        value: b._id,
        label: b.companyName,
        description: b.trnNumber ? `TRN: ${b.trnNumber}` : '',
        catalogueTag,
      };
    });
    const oth = othRaw.map((b) => ({
      value: b._id,
      label: b.companyName,
      description: b.trnNumber ? `TRN: ${b.trnNumber}` : '',
    }));
    const out = [];
    if (pri.length) {
      out.push({
        value: '__section_feed',
        label: t('batches.feedCompanySectionCatalogue', 'With feed products'),
        isSectionHeader: true,
      });
      out.push(...pri);
    }
    if (oth.length) {
      if (pri.length) {
        out.push({
          value: '__section_other',
          label: t('batches.feedCompanySectionOther', 'Other businesses'),
          isSectionHeader: true,
        });
      }
      out.push(...oth);
    }
    return out;
  }, [businesses, feedCompanyIds, feedItemCountByCompany, pendingBiz, t]);

  const handleCompanyChange = useCallback((val) => {
    setSelectedCompany(val || '');
    setLineItems([emptyLineItem()]);
  }, []);

  useEffect(() => {
    if (editData) {
      setTaxInvoiceDocs(editData.taxInvoiceDocs || []);
      setTransferProofs(editData.transferProofs || []);
      setDeliveryNoteDocs(editData.deliveryNoteDocs || []);
      setSelectedCompany((typeof editData.feedCompany === 'object' ? editData.feedCompany?._id : editData.feedCompany) || '');
      setTaxInvoiceId(editData.taxInvoiceId || '');
      setOrderDate(editData.orderDate?.slice(0, 10) || new Date().toISOString().slice(0, 10));
      setDeliveryDate(editData.deliveryDate?.slice(0, 10) || '');
      setDeliveryCharge(editData.deliveryCharge?.toString() || '');
      setLineItems(
        (editData.items || []).map((item) => ({
          key: item._id || Date.now() + Math.random(),
          feedType: item.feedType || '',
          feedItem: item.feedItem?._id || item.feedItem || '',
          feedDescription: item.feedDescription || '',
          pricePerBag: item.pricePerBag?.toString() || '',
          bags: item.bags?.toString() || '',
          quantitySize: item.quantitySize?.toString() || '50',
          quantityUnit: item.quantityUnit || 'KG',
        }))
      );
    } else {
      setTaxInvoiceDocs([]);
      setTransferProofs([]);
      setDeliveryNoteDocs([]);
      setSelectedCompany('');
      setTaxInvoiceId('');
      setOrderDate(new Date().toISOString().slice(0, 10));
      setDeliveryDate('');
      setDeliveryCharge('');
      setLineItems([emptyLineItem()]);
    }
  }, [editData, open]);

  const feedTypeOptions = useMemo(
    () => FEED_TYPES.map((v) => ({ value: v, label: t(`feed.feedTypes.${v}`), icon: FEED_TYPE_ICONS[v] })),
    [t]
  );

  const applyFeedTypeSelection = useCallback((index, ftVal) => {
    const filtered = companyFeedItems.filter((fi) => fi.feedType === ftVal);
    setLineItems((prev) => prev.map((li, i) => {
      if (i !== index) return li;
      if (filtered.length === 1) {
        const fi = filtered[0];
        return {
          ...li,
          feedType: ftVal,
          feedItem: fi._id,
          feedDescription: fi.feedDescription || '',
          pricePerBag: fi.pricePerQty != null ? String(fi.pricePerQty) : '',
          quantitySize: String(fi.quantitySize ?? 50),
          quantityUnit: fi.quantityUnit || 'KG',
        };
      }
      return {
        ...li,
        feedType: ftVal,
        feedItem: '',
        feedDescription: '',
        pricePerBag: '',
        quantitySize: '50',
        quantityUnit: 'KG',
      };
    }));
  }, [companyFeedItems]);

  const applyProductSelection = useCallback((index, feedItemId) => {
    const fi = companyFeedItems.find((f) => f._id === feedItemId);
    if (!fi) return;
    setLineItems((prev) => prev.map((li, i) => (i === index ? {
      ...li,
      feedItem: fi._id,
      feedDescription: fi.feedDescription || '',
      pricePerBag: fi.pricePerQty != null ? String(fi.pricePerQty) : '',
      quantitySize: String(fi.quantitySize ?? 50),
      quantityUnit: fi.quantityUnit || 'KG',
    } : li)));
  }, [companyFeedItems]);

  const updateLine = (index, field, value) => {
    setLineItems((prev) => prev.map((li, i) => (i === index ? { ...li, [field]: value } : li)));
  };

  const removeLine = (index) => {
    setLineItems((prev) => prev.filter((_, i) => i !== index));
  };

  const subtotal = lineItems.reduce((sum, li) => sum + (parseNum(li.pricePerBag) * parseNum(li.bags)), 0);
  const deliveryChargeNum = parseNum(deliveryCharge);
  const vatAmount = subtotal * (vatRate / 100);
  const grandTotal = subtotal + deliveryChargeNum + vatAmount;

  const priCount = businesses.filter((b) => feedCompanyIds.has(String(b._id))).length;

  const handleSave = async () => {
    const errs = {};
    if (!selectedCompany) errs.feedCompany = t('batches.feedCompanyRequired');
    if (lineItems.length === 0) errs.lineItems = 'At least one line item is required';
    lineItems.forEach((li, i) => {
      if (!li.feedType) errs[`line_${i}_feedType`] = t('batches.feedTypeRequired');
      if (!li.feedItem) errs[`line_${i}_feedItem`] = t('batches.feedProductRequired');
      if (parseNum(li.bags) <= 0) errs[`line_${i}_bags`] = t('batches.bagsRequired');
    });
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }
    setFieldErrors({});
    setSaving(true);
    try {
      const items = lineItems.map((li) => {
        const liSub = parseNum(li.pricePerBag) * parseNum(li.bags);
        const liVat = liSub * (vatRate / 100);
        return {
          feedType: li.feedType,
          feedItem: li.feedItem || null,
          feedDescription: li.feedDescription,
          pricePerBag: parseNum(li.pricePerBag),
          bags: parseNum(li.bags),
          quantitySize: parseNum(li.quantitySize) || 50,
          quantityUnit: li.quantityUnit || 'KG',
          subtotal: liSub,
          vatAmount: liVat,
          lineTotal: liSub + liVat,
        };
      });

      const payload = {
        batch: batchId,
        feedCompany: selectedCompany || null,
        taxInvoiceId,
        orderDate: orderDate || null,
        deliveryDate: deliveryDate || null,
        deliveryCharge: deliveryChargeNum,
        subtotal, vatAmount, grandTotal,
        items,
        taxInvoiceDocs: taxInvoiceDocs.map((m) => m._id),
        transferProofs: transferProofs.map((m) => m._id),
        deliveryNoteDocs: deliveryNoteDocs.map((m) => m._id),
      };

      if (editData?._id) {
        await update(editData._id, payload);
        toast({ title: t('batches.feedOrderUpdated') });
      } else {
        const tempId = `temp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        await create(tempId, payload, ['taxInvoiceDocs', 'transferProofs', 'deliveryNoteDocs']);
        toast({ title: t('batches.feedOrderCreated') });
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
        title={editData ? t('batches.editFeedOrder') : t('batches.addFeedOrder')}
        subtitle={`${lineItems.length} ${lineItems.length === 1 ? t('batches.lineItem', 'line item') : t('batches.lineItems', 'line items')}`}
        icon={Wheat}
        onSubmit={handleSave}
        submitLabel={editData ? t('common.save') : t('common.create')}
        loading={saving}
        disabled={saving || lineItems.length === 0 || !selectedCompany}
      >
        {/* Vendor & invoice */}
        <FormSection title={t('batches.feedVendor', 'Vendor & Invoice')}>
          <FormField label={t('batches.feedCompany')} error={fieldErrors.feedCompany}>
            <Select
              value={selectedCompany}
              onValueChange={handleCompanyChange}
              options={companyPickerOptions}
              placeholder={t('batches.selectFeedCompany')}
              label={t('batches.feedCompany')}
              searchPlaceholder={t('batches.searchFeedCompany', 'Search…')}
              forceSearchable
              onCreateNew={(searchText) => { setBizInitialName(searchText || ''); setQuickAddBiz(true); }}
              createNewLabel={t('businesses.addBusiness', 'Add Business')}
            />
          </FormField>
          {priCount > 0 ? (
            <Text
              style={{
                fontSize: 12,
                fontFamily: 'Poppins-Regular',
                color: tokens.mutedColor,
                marginTop: -4,
                marginBottom: 4,
              }}
            >
              {t('batches.feedCompanyHint')}
            </Text>
          ) : null}

          <SheetInput
            label={t('batches.taxInvoiceId')}
            value={taxInvoiceId}
            onChangeText={setTaxInvoiceId}
            placeholder={t('batches.invoiceIdPlaceholder')}
            error={fieldErrors.taxInvoiceId}
          />
        </FormSection>

        {/* Dates */}
        <FormSection title={t('batches.feedDates', 'Dates')}>
          <FormField label={t('batches.orderDate')}>
            <DatePicker value={orderDate} onChange={setOrderDate} label={t('batches.orderDate')} />
          </FormField>
          <FormField label={t('batches.deliveryDate')}>
            <DatePicker value={deliveryDate} onChange={setDeliveryDate} label={t('batches.deliveryDate')} />
          </FormField>
        </FormSection>

        {/* Line items */}
        <FormSection
          title={t('batches.lineItems', 'Line Items')}
          headerRight={
            selectedCompany ? (
              <AddRowButton
                icon={Plus}
                label={t('batches.addLineItem', 'Add Line Item')}
                onPress={() => setLineItems((prev) => [...prev, emptyLineItem()])}
              />
            ) : null
          }
        >
          {!selectedCompany ? (
            <Text
              style={{
                fontSize: 14,
                fontFamily: 'Poppins-Regular',
                color: tokens.mutedColor,
                textAlign: 'center',
                paddingVertical: 16,
              }}
            >
              {t('batches.selectFeedCompanyFirst')}
            </Text>
          ) : (
            lineItems.map((item, index) => (
              <FeedLineItemCard
                key={item.key}
                index={index}
                item={item}
                count={lineItems.length}
                feedTypeOptions={feedTypeOptions}
                companyFeedItems={companyFeedItems}
                currency={currency}
                fieldErrors={fieldErrors}
                t={t}
                onFeedTypeChange={applyFeedTypeSelection}
                onProductChange={applyProductSelection}
                onUpdate={updateLine}
                onRemove={removeLine}
              />
            ))
          )}
        </FormSection>

        {/* Charges & totals */}
        <FormSection title={t('batches.feedTotals', 'Charges & Totals')}>
          <SheetInput
            label={t('batches.deliveryCharge')}
            value={deliveryCharge}
            onChangeText={setDeliveryCharge}
            keyboardType="decimal-pad"
            placeholder="0.00"
            suffix={<CurrencyTag label={currency} />}
          />
          <SummaryCard>
            <SummaryRow label={t('batches.subtotal')} value={fmtMoney(subtotal)} />
            {deliveryChargeNum > 0 ? (
              <SummaryRow label={t('batches.deliveryCharge')} value={fmtMoney(deliveryChargeNum)} />
            ) : null}
            <SummaryRow label={t('batches.vat')} value={fmtMoney(vatAmount)} />
            <CardDivider marginVertical={2} />
            <SummaryRow label={t('batches.grandTotal')} value={fmtMoney(grandTotal)} emphasis />
          </SummaryCard>
        </FormSection>

        {/* Documents */}
        <FormSection title={t('batches.feedDocuments', 'Documents')}>
          <MultiFileUpload
            label={t('batches.taxInvoiceDocs', 'Tax Invoice Documents')}
            files={taxInvoiceDocs}
            onAdd={(media) => setTaxInvoiceDocs((prev) => [...prev, media])}
            onRemove={(index) => setTaxInvoiceDocs((prev) => prev.filter((_, i) => i !== index))}
            entityType="feedOrder"
            entityId={editData?._id}
            category="feed-orders"
          />
          <MultiFileUpload
            label={t('batches.transferProofs', 'Transfer Proofs')}
            files={transferProofs}
            onAdd={(media) => setTransferProofs((prev) => [...prev, media])}
            onRemove={(index) => setTransferProofs((prev) => prev.filter((_, i) => i !== index))}
            entityType="feedOrder"
            entityId={editData?._id}
            category="feed-orders"
          />
          <MultiFileUpload
            label={t('batches.deliveryNoteDocs', 'Delivery Note Documents')}
            files={deliveryNoteDocs}
            onAdd={(media) => setDeliveryNoteDocs((prev) => [...prev, media])}
            onRemove={(index) => setDeliveryNoteDocs((prev) => prev.filter((_, i) => i !== index))}
            entityType="feedOrder"
            entityId={editData?._id}
            category="feed-orders"
          />
        </FormSection>
      </FormSheet>

      <QuickAddBusinessSheet
        open={quickAddBiz}
        onClose={() => setQuickAddBiz(false)}
        initialName={bizInitialName}
        onCreated={(biz) => {
          setPendingBiz(biz);
          setSelectedCompany(biz._id);
          setLineItems([emptyLineItem()]);
          toast({ title: `${biz.companyName} ${t('common.created', 'created')}` });
        }}
      />
    </>
  );
}

function FeedLineItemCard({
  index,
  item,
  count,
  feedTypeOptions,
  companyFeedItems,
  currency,
  fieldErrors,
  t,
  onFeedTypeChange,
  onProductChange,
  onUpdate,
  onRemove,
}) {
  const tokens = useHeroSheetTokens();
  const isRTL = useIsRTL();
  const { dark, mutedColor, errorColor, textColor, accentColor, borderColor } = tokens;

  // SlidingSegmentedControl always shows a pill on the first option, so make
  // the stored value match what's visually highlighted.
  useEffect(() => {
    if (!item.feedType && feedTypeOptions[0]) {
      onFeedTypeChange(index, feedTypeOptions[0].value);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const matchingItems = companyFeedItems.filter((fi) =>
    !item.feedType || fi.feedType === item.feedType
  );
  const productOptions = matchingItems.map((fi) => ({
    value: fi._id,
    label: fi.feedDescription || '—',
    description: `${fi.quantitySize ?? ''}${fi.quantityUnit || ''} — ${currency} ${Number(fi.pricePerQty || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
  }));

  const singleProduct = item.feedType && matchingItems.length === 1 ? matchingItems[0] : null;
  const showProductSelect = item.feedType && matchingItems.length > 1;
  const showSingleSummary = item.feedType && matchingItems.length === 1;
  const showNoProducts = item.feedType && matchingItems.length === 0;

  const labelStyle = {
    fontSize: 13,
    fontFamily: 'Poppins-Medium',
    color: textColor,
    textAlign: isRTL ? 'right' : 'left',
  };

  return (
    <View
      style={{
        paddingTop: index === 0 ? 2 : 18,
        borderTopWidth: index === 0 ? 0 : StyleSheet.hairlineWidth,
        borderTopColor: borderColor,
      }}
    >
      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 12,
        }}
      >
        <Text
          style={{
            fontSize: 12,
            fontFamily: 'Poppins-SemiBold',
            color: mutedColor,
            letterSpacing: 0.8,
            textTransform: 'uppercase',
          }}
        >
          {t('batches.itemNumber', 'Item')} {index + 1}
        </Text>
        {count > 1 ? (
          <Pressable
            onPress={() => onRemove(index)}
            hitSlop={8}
            style={{
              width: 32,
              height: 32,
              borderRadius: 16,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
            }}
            accessibilityRole="button"
            accessibilityLabel={t('common.delete', 'Delete')}
          >
            <Trash2 size={16} color={errorColor} strokeWidth={2.2} />
          </Pressable>
        ) : null}
      </View>

      <View style={{ gap: 14 }}>
        <FormField
          label={t('batches.selectFeedType')}
          required
          error={fieldErrors[`line_${index}_feedType`]}
        >
          <SlidingSegmentedControl
            value={item.feedType}
            onChange={(v) => onFeedTypeChange(index, v)}
            options={feedTypeOptions}
            bordered={false}
          />
        </FormField>

        {showNoProducts ? (
          <Text style={{ fontSize: 14, fontFamily: 'Poppins-Regular', color: mutedColor }}>
            {t('batches.noFeedProducts')}
          </Text>
        ) : null}

        {showSingleSummary && singleProduct ? (
          <View
            style={{
              paddingVertical: 10,
              paddingHorizontal: 12,
              borderStartWidth: 3,
              borderStartColor: accentColor,
              backgroundColor: dark ? 'rgba(148,210,165,0.08)' : 'hsl(148, 40%, 97%)',
              borderRadius: 10,
            }}
          >
            <Text style={{ fontSize: 15, fontFamily: 'Poppins-SemiBold', color: textColor }} numberOfLines={2}>
              {singleProduct.feedDescription}
            </Text>
            <Text style={{ fontSize: 13, fontFamily: 'Poppins-Regular', color: mutedColor, marginTop: 4 }} numberOfLines={2}>
              {`${singleProduct.quantitySize ?? ''}${singleProduct.quantityUnit || ''} · ${currency} ${Number(singleProduct.pricePerQty || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            </Text>
          </View>
        ) : null}

        {showProductSelect ? (
          <FormField label={t('feed.feedDescription', 'Product')} error={fieldErrors[`line_${index}_feedItem`]}>
            <Select
              value={item.feedItem}
              onValueChange={(v) => onProductChange(index, v)}
              options={productOptions}
              placeholder={t('batches.selectFeedProduct')}
              label={t('batches.selectFeedProduct')}
              searchPlaceholder={t('batches.searchFeedProduct', 'Search…')}
              forceSearchable={productOptions.length > 5}
            />
          </FormField>
        ) : null}

        {item.feedItem ? (
          <View style={{ gap: 8 }}>
            <View
              style={{
                flexDirection: isRTL ? 'row-reverse' : 'row',
                gap: 12,
                alignItems: 'stretch',
              }}
            >
              <View style={{ flex: 1, minWidth: 0, minHeight: 44, justifyContent: 'flex-end' }}>
                <Text style={[labelStyle, { marginHorizontal: 4 }]}>
                  {t('batches.bagsQuantity')}
                  <Text style={{ color: errorColor }}> *</Text>
                </Text>
                <View style={{ height: 16 }} />
              </View>
              <View style={{ flex: 1, minWidth: 0, minHeight: 44, justifyContent: 'flex-end' }}>
                <Text style={[labelStyle, { marginHorizontal: 4 }]}>
                  {t('batches.pricePerBag')}
                </Text>
                <Text
                  style={{
                    fontSize: 11,
                    fontFamily: 'Poppins-Regular',
                    color: mutedColor,
                    marginHorizontal: 4,
                    marginTop: 2,
                    textAlign: isRTL ? 'right' : 'left',
                  }}
                >
                  {t('batches.exVat')}
                </Text>
              </View>
            </View>
            <View
              style={{
                flexDirection: isRTL ? 'row-reverse' : 'row',
                gap: 12,
                alignItems: 'flex-start',
              }}
            >
              <View style={{ flex: 1, minWidth: 0 }}>
                <SheetInput
                  label={null}
                  value={item.bags}
                  onChangeText={(v) => onUpdate(index, 'bags', v)}
                  keyboardType="number-pad"
                  placeholder="0"
                  error={fieldErrors[`line_${index}_bags`]}
                />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <SheetInput
                  label={null}
                  value={item.pricePerBag}
                  onChangeText={(v) => onUpdate(index, 'pricePerBag', v)}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                />
              </View>
            </View>
          </View>
        ) : null}
      </View>
    </View>
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
