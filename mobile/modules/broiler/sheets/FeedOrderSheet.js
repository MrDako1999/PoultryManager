import { useState, useEffect, useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2, Wheat } from 'lucide-react-native';
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
  const accounting = useSettings('accounting');
  const [businesses] = useLocalQuery('businesses');
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

  const businessOptions = useMemo(() => {
    const opts = businesses.map((b) => ({ value: b._id, label: b.companyName }));
    if (pendingBiz && !opts.some((o) => o.value === pendingBiz._id)) {
      opts.unshift({ value: pendingBiz._id, label: pendingBiz.companyName });
    }
    return opts;
  }, [businesses, pendingBiz]);

  const feedTypeOptions = useMemo(
    () => FEED_TYPES.map((v) => ({ value: v, label: t(`feed.feedTypes.${v}`), icon: FEED_TYPE_ICONS[v] })),
    [t]
  );

  const updateLine = (index, field, value) => {
    setLineItems((prev) => prev.map((li, i) => i === index ? { ...li, [field]: value } : li));
  };

  const removeLine = (index) => {
    setLineItems((prev) => prev.filter((_, i) => i !== index));
  };

  const subtotal = lineItems.reduce((sum, li) => sum + (parseNum(li.pricePerBag) * parseNum(li.bags)), 0);
  const deliveryChargeNum = parseNum(deliveryCharge);
  const vatAmount = subtotal * (vatRate / 100);
  const grandTotal = subtotal + deliveryChargeNum + vatAmount;

  const handleSave = async () => {
    const errs = {};
    if (!taxInvoiceId.trim()) errs.taxInvoiceId = t('batches.taxInvoiceIdRequired', 'Invoice ID is required');
    if (lineItems.length === 0) errs.lineItems = 'At least one line item is required';
    lineItems.forEach((li, i) => {
      if (!li.feedType) errs[`line_${i}_feedType`] = 'Feed type is required';
    });
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }
    setFieldErrors({});
    setSaving(true);
    try {
      const items = lineItems.map((li) => ({
        feedType: li.feedType,
        feedItem: li.feedItem || null,
        feedDescription: li.feedDescription,
        pricePerBag: parseNum(li.pricePerBag),
        bags: parseNum(li.bags),
        quantitySize: parseNum(li.quantitySize) || 50,
        quantityUnit: li.quantityUnit || 'KG',
        subtotal: parseNum(li.pricePerBag) * parseNum(li.bags),
      }));

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
        disabled={saving || lineItems.length === 0}
      >
        {/* Vendor & invoice */}
        <FormSection title={t('batches.feedVendor', 'Vendor & Invoice')}>
          <FormField label={t('batches.feedCompany')}>
            <Select
              value={selectedCompany}
              onValueChange={setSelectedCompany}
              options={businessOptions}
              placeholder={t('batches.selectFeedCompany')}
              label={t('batches.feedCompany')}
              onCreateNew={(searchText) => { setBizInitialName(searchText || ''); setQuickAddBiz(true); }}
              createNewLabel={t('businesses.addBusiness', 'Add Business')}
            />
          </FormField>

          <SheetInput
            label={`${t('batches.taxInvoiceId')} *`}
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
            <AddRowButton
              icon={Plus}
              label={t('batches.addLineItem', 'Add Line Item')}
              onPress={() => setLineItems((prev) => [...prev, emptyLineItem()])}
            />
          }
        >
          {lineItems.map((item, index) => (
            <FeedLineItemCard
              key={item.key}
              index={index}
              item={item}
              count={lineItems.length}
              feedTypeOptions={feedTypeOptions}
              fieldErrors={fieldErrors}
              t={t}
              onUpdate={updateLine}
              onRemove={removeLine}
            />
          ))}
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
          toast({ title: `${biz.companyName} ${t('common.created', 'created')}` });
        }}
      />
    </>
  );
}

function FeedLineItemCard({ index, item, count, feedTypeOptions, fieldErrors, t, onUpdate, onRemove }) {
  const tokens = useHeroSheetTokens();
  const isRTL = useIsRTL();
  const { dark, mutedColor, errorColor } = tokens;

  return (
    <View
      style={[
        lineItemStyles.card,
        {
          backgroundColor: dark ? 'rgba(255,255,255,0.03)' : 'hsl(148, 22%, 96%)',
          borderColor: dark ? 'hsl(150, 12%, 28%)' : 'hsl(148, 16%, 88%)',
        },
      ]}
    >
      <View
        style={[
          lineItemStyles.headerRow,
          { flexDirection: isRTL ? 'row-reverse' : 'row' },
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
          {t('batches.itemNumber', 'Item')} {index + 1}
        </Text>
        {count > 1 ? (
          <Pressable
            onPress={() => onRemove(index)}
            hitSlop={8}
            style={lineItemStyles.removeBtn}
            accessibilityRole="button"
            accessibilityLabel={t('common.delete', 'Delete')}
          >
            <Trash2 size={14} color={errorColor} />
          </Pressable>
        ) : null}
      </View>

      <View style={{ gap: 12 }}>
        <FormField
          label={t('batches.selectFeedType')}
          required
          error={fieldErrors[`line_${index}_feedType`]}
        >
          <EnumButtonSelect
            value={item.feedType}
            onChange={(v) => onUpdate(index, 'feedType', v)}
            options={feedTypeOptions}
            columns={4}
            compact
          />
        </FormField>

        <SheetInput
          label={t('feed.feedDescription')}
          value={item.feedDescription}
          onChangeText={(v) => onUpdate(index, 'feedDescription', v)}
          placeholder={t('feed.feedDescriptionPlaceholder')}
        />

        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            gap: 12,
          }}
        >
          <View style={{ flex: 1 }}>
            <SheetInput
              label={t('batches.bagsQuantity')}
              value={item.bags}
              onChangeText={(v) => onUpdate(index, 'bags', v)}
              keyboardType="number-pad"
              placeholder="0"
            />
          </View>
          <View style={{ flex: 1 }}>
            <SheetInput
              label={t('batches.pricePerBag')}
              value={item.pricePerBag}
              onChangeText={(v) => onUpdate(index, 'pricePerBag', v)}
              keyboardType="decimal-pad"
              placeholder="0.00"
            />
          </View>
        </View>
      </View>
    </View>
  );
}

const lineItemStyles = StyleSheet.create({
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 14,
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
