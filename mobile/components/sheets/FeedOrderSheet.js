import { useState, useEffect, useMemo } from 'react';
import { View, Text, Modal, Pressable, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X, Plus, Trash2 } from 'lucide-react-native';
import { Input } from '../ui/Input';
import { Label } from '../ui/Label';
import { Button } from '../ui/Button';
import Select from '../ui/Select';
import EnumButtonSelect from '../ui/EnumButtonSelect';
import DatePicker from '../ui/DatePicker';
import Separator from '../ui/Separator';
import MobileMultiFileUpload from '../MobileMultiFileUpload';
import QuickAddBusinessSheet from './QuickAddBusinessSheet';
import useLocalQuery from '../../hooks/useLocalQuery';
import useSettings from '../../hooks/useSettings';
import useOfflineMutation from '../../hooks/useOfflineMutation';
import useThemeStore from '../../stores/themeStore';
import { FEED_TYPES, FEED_TYPE_ICONS } from '../../lib/constants';
import { useToast } from '../ui/Toast';

const parseNum = (v) => { const n = parseFloat(String(v).replace(/,/g, '')); return isNaN(n) ? 0 : n; };

function FieldError({ message }) {
  if (!message) return null;
  return <Text className="text-xs text-destructive mt-1">{message}</Text>;
}

function RequiredStar() {
  return <Text className="text-destructive"> *</Text>;
}

const emptyLineItem = () => ({
  key: Date.now() + Math.random(),
  feedType: '', feedItem: '', feedDescription: '',
  pricePerBag: '', bags: '', quantitySize: '50', quantityUnit: 'KG',
});

export default function FeedOrderSheet({ open, onClose, batchId, editData }) {
  const { t } = useTranslation();
  const { bottom: safeBottom } = useSafeAreaInsets();
  const { toast } = useToast();
  const { resolvedTheme } = useThemeStore();
  const primaryColor = resolvedTheme === 'dark' ? 'hsl(148, 48%, 38%)' : 'hsl(148, 60%, 20%)';
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

  const feedTypeOptions = FEED_TYPES.map((v) => ({ value: v, label: t(`feed.feedTypes.${v}`), icon: FEED_TYPE_ICONS[v] }));

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

  if (!open) return null;

  return (
    <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1 bg-background">
        <View className="flex-row items-center justify-between px-4 pt-4 pb-2">
          <Text className="text-lg font-bold text-foreground">
            {editData ? t('batches.editFeedOrder') : t('batches.addFeedOrder')}
          </Text>
          <Pressable onPress={onClose} hitSlop={8}>
            <X size={20} color="hsl(150, 10%, 45%)" />
          </Pressable>
        </View>
        <Separator />
        <ScrollView className="flex-1 px-4" contentContainerClassName="py-4 gap-4" keyboardShouldPersistTaps="handled">
          <View className="gap-2">
            <Label>{t('batches.feedCompany')}</Label>
            <Select value={selectedCompany} onValueChange={setSelectedCompany} options={businessOptions} placeholder={t('batches.selectFeedCompany')} label={t('batches.feedCompany')} onCreateNew={(searchText) => { setBizInitialName(searchText || ''); setQuickAddBiz(true); }} createNewLabel={t('businesses.addBusiness', 'Add Business')} />
          </View>

          <View className="gap-2">
            <Label>{t('batches.taxInvoiceId')}<RequiredStar /></Label>
            <Input value={taxInvoiceId} onChangeText={setTaxInvoiceId} placeholder={t('batches.invoiceIdPlaceholder')} />
            <FieldError message={fieldErrors.taxInvoiceId} />
          </View>

          <View className="gap-2">
            <Label>{t('batches.orderDate')}</Label>
            <DatePicker value={orderDate} onChange={setOrderDate} label={t('batches.orderDate')} />
          </View>
          <View className="gap-2">
            <Label>{t('batches.deliveryDate')}</Label>
            <DatePicker value={deliveryDate} onChange={setDeliveryDate} label={t('batches.deliveryDate')} />
          </View>

          <Separator />

          <View className="flex-row items-center justify-between">
            <Text className="text-sm font-semibold text-foreground">{t('batches.lineItems')}</Text>
            <Pressable onPress={() => setLineItems((prev) => [...prev, emptyLineItem()])} className="flex-row items-center gap-1">
              <Plus size={14} color={primaryColor} />
              <Text className="text-xs text-primary font-medium">{t('batches.addLineItem')}</Text>
            </Pressable>
          </View>

          {lineItems.map((item, index) => (
            <View key={item.key} className="rounded-lg border border-border p-3 gap-3">
              <View className="flex-row items-center justify-between">
                <Text className="text-xs font-semibold text-muted-foreground uppercase">Item {index + 1}</Text>
                {lineItems.length > 1 && (
                  <Pressable onPress={() => removeLine(index)} hitSlop={8}>
                    <Trash2 size={14} color="hsl(0, 72%, 51%)" />
                  </Pressable>
                )}
              </View>
              <View className="gap-2">
                <Label>{t('batches.selectFeedType')}<RequiredStar /></Label>
                <EnumButtonSelect
                  value={item.feedType}
                  onChange={(v) => updateLine(index, 'feedType', v)}
                  options={feedTypeOptions}
                  columns={4}
                  compact
                />
                <FieldError message={fieldErrors[`line_${index}_feedType`]} />
              </View>
              <View className="gap-2">
                <Label>{t('feed.feedDescription')}</Label>
                <Input
                  value={item.feedDescription}
                  onChangeText={(v) => updateLine(index, 'feedDescription', v)}
                  placeholder={t('feed.feedDescriptionPlaceholder')}
                />
              </View>
              <View className="flex-row gap-3">
                <View className="flex-1 gap-2">
                  <Label>{t('batches.bagsQuantity')}</Label>
                  <Input
                    value={item.bags}
                    onChangeText={(v) => updateLine(index, 'bags', v)}
                    keyboardType="number-pad"
                    placeholder="0"
                  />
                </View>
                <View className="flex-1 gap-2">
                  <Label>{t('batches.pricePerBag')}</Label>
                  <Input
                    value={item.pricePerBag}
                    onChangeText={(v) => updateLine(index, 'pricePerBag', v)}
                    keyboardType="decimal-pad"
                    placeholder="0.00"
                  />
                </View>
              </View>
            </View>
          ))}

          <View className="gap-2">
            <Label>{t('batches.deliveryCharge')}</Label>
            <Input value={deliveryCharge} onChangeText={setDeliveryCharge} keyboardType="decimal-pad" placeholder="0.00" />
          </View>

          <View className="rounded-lg border border-border bg-muted/30 px-3 py-2.5 gap-1">
            <View className="flex-row justify-between">
              <Text className="text-xs text-muted-foreground">{t('batches.subtotal')}</Text>
              <Text className="text-sm text-foreground" style={{ fontVariant: ['tabular-nums'] }}>{currency} {subtotal.toFixed(2)}</Text>
            </View>
            {deliveryChargeNum > 0 && (
              <View className="flex-row justify-between">
                <Text className="text-xs text-muted-foreground">{t('batches.deliveryCharge')}</Text>
                <Text className="text-sm text-foreground" style={{ fontVariant: ['tabular-nums'] }}>{currency} {deliveryChargeNum.toFixed(2)}</Text>
              </View>
            )}
            <View className="flex-row justify-between">
              <Text className="text-xs text-muted-foreground">{t('batches.vat')}</Text>
              <Text className="text-sm text-foreground" style={{ fontVariant: ['tabular-nums'] }}>{currency} {vatAmount.toFixed(2)}</Text>
            </View>
            <View className="flex-row justify-between">
              <Text className="text-xs font-semibold text-foreground">{t('batches.grandTotal')}</Text>
              <Text className="text-sm font-bold text-foreground" style={{ fontVariant: ['tabular-nums'] }}>{currency} {grandTotal.toFixed(2)}</Text>
            </View>
          </View>

          <Separator />

          <MobileMultiFileUpload
            label={t('batches.taxInvoiceDocs', 'Tax Invoice Documents')}
            files={taxInvoiceDocs}
            onAdd={(media) => setTaxInvoiceDocs((prev) => [...prev, media])}
            onRemove={(index) => setTaxInvoiceDocs((prev) => prev.filter((_, i) => i !== index))}
            entityType="feedOrder"
            entityId={editData?._id}
            category="feed-orders"
          />

          <MobileMultiFileUpload
            label={t('batches.transferProofs', 'Transfer Proofs')}
            files={transferProofs}
            onAdd={(media) => setTransferProofs((prev) => [...prev, media])}
            onRemove={(index) => setTransferProofs((prev) => prev.filter((_, i) => i !== index))}
            entityType="feedOrder"
            entityId={editData?._id}
            category="feed-orders"
          />

          <MobileMultiFileUpload
            label={t('batches.deliveryNoteDocs', 'Delivery Note Documents')}
            files={deliveryNoteDocs}
            onAdd={(media) => setDeliveryNoteDocs((prev) => [...prev, media])}
            onRemove={(index) => setDeliveryNoteDocs((prev) => prev.filter((_, i) => i !== index))}
            entityType="feedOrder"
            entityId={editData?._id}
            category="feed-orders"
          />
        </ScrollView>

        <View className="px-4 pt-4 border-t border-border" style={{ paddingBottom: Math.max(safeBottom, 16) }}>
          <Button onPress={handleSave} loading={saving} disabled={saving || lineItems.length === 0}>
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
          setSelectedCompany(biz._id);
          toast({ title: `${biz.companyName} ${t('common.created', 'created')}` });
        }}
      />
    </Modal>
  );
}
