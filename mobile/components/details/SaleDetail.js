import { useState } from 'react';
import { View, Text, ScrollView, Pressable, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import { Pencil, ChevronDown, ChevronRight, TrendingUp, FileText, Trash2 } from 'lucide-react-native';
import { Badge } from '../ui/Badge';
import Separator from '../ui/Separator';
import FileViewer from '../FileViewer';
import useLocalRecord from '../../hooks/useLocalRecord';
import useSettings from '../../hooks/useSettings';
import useOfflineMutation from '../../hooks/useOfflineMutation';
import { fmt, fmtDate, Row, Section, SectionHeader, TotalBar, DetailLoading, PartyCard, DocumentsSection } from './shared';

export default function SaleDetail({ saleId, onEdit }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [countsOpen, setCountsOpen] = useState(false);
  const [invoiceViewerOpen, setInvoiceViewerOpen] = useState(false);

  const [sale] = useLocalRecord('saleOrders', saleId);
  const accounting = useSettings('accounting');
  const { remove } = useOfflineMutation('saleOrders');

  const relatedExpenseId = sale?.slaughter?.relatedExpense
    ? (sale.slaughter.relatedExpense?._id ?? sale.slaughter.relatedExpense)
    : null;

  if (!sale) return <DetailLoading />;

  const currency = accounting?.currency || 'AED';
  const isSlaughtered = sale.saleMethod === 'SLAUGHTERED';
  const isLiveByPiece = sale.saleMethod === 'LIVE_BY_PIECE';
  const isLiveByWeight = sale.saleMethod === 'LIVE_BY_WEIGHT';
  const isLive = isLiveByPiece || isLiveByWeight;
  const showVat = sale.invoiceType === 'VAT_INVOICE';

  const sl = sale.slaughter || {};
  const cn_ = sale.counts || {};
  const tr = sale.transport || {};
  const totals = sale.totals || {};
  const lv = sale.live || {};

  const losses = (cn_.condemnation || 0) + (cn_.deathOnArrival || 0) + (cn_.rejections || 0) + (cn_.shortage || 0);
  const netProcessed = (cn_.chickensSent || 0) - losses;
  const wholeChickenCount = Math.max(0, netProcessed - (cn_.bGrade || 0));

  const filledPortions = (sale.portions || []).filter((p) => p.quantity > 0);

  const processingCost = isSlaughtered ? (sl.processingCost || 0) : 0;
  const netRevenue = (totals.grandTotal || 0) - processingCost;
  const chickenCount = isSlaughtered ? wholeChickenCount : (lv.birdCount || 0);
  const profitPerChicken = chickenCount > 0 ? netRevenue / chickenCount : 0;

  const invoiceDocs = (sale.invoiceDocs || []).filter(Boolean);
  const reportDocs = (sl.reportDocs || []).filter(Boolean);
  const invoiceMedia = invoiceDocs[0] || null;

  const docGroups = [
    { key: 'invoice', label: t('batches.saleDetail.invoiceDoc', 'Sale Invoice'), docs: invoiceDocs },
    { key: 'report', label: t('batches.saleDetail.processingReport', 'Processing Report'), docs: reportDocs },
    { key: 'transfer', label: t('batches.sourceDetail.transferProof', 'Transfer Proof'), docs: sale.transferProofs },
    { key: 'other', label: t('common.document', 'Document'), docs: sale.otherDocs?.map(d => d.media_id || d) },
  ];

  const handleDelete = () => {
    Alert.alert(
      t('common.confirmDelete', 'Delete'),
      t('batches.saleDetail.confirmDelete', 'Are you sure you want to delete this sale?'),
      [
        { text: t('common.cancel', 'Cancel'), style: 'cancel' },
        {
          text: t('common.delete', 'Delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await remove(saleId);
              router.back();
            } catch {}
          },
        },
      ],
    );
  };

  const customerId = typeof sale.customer === 'object' ? sale.customer?._id : sale.customer;
  const slaughterhouseId = typeof sl.slaughterhouse === 'object' ? sl.slaughterhouse?._id : sl.slaughterhouse;
  const sameParty = isSlaughtered && slaughterhouseId && slaughterhouseId === customerId;
  const hasDistinctSlaughterhouse = isSlaughtered && sl.slaughterhouse?.companyName && !sameParty;

  return (
    <View className="flex-1">
      <View className="px-4 pt-4 pb-3">
        <View className="flex-row items-start justify-between gap-3">
          <View className="flex-1 min-w-0 gap-1.5">
            <View className="flex-row items-center gap-1.5 flex-wrap">
              <Badge>
                <Text className="text-[10px] font-semibold uppercase tracking-wider text-primary-foreground">
                  {sale.invoiceType === 'VAT_INVOICE'
                    ? t('batches.saleInvoiceTypes.VAT_INVOICE')
                    : t('batches.saleInvoiceTypes.CASH_MEMO')}
                </Text>
              </Badge>
              <Badge variant="secondary">
                <Text className="text-[10px] font-semibold uppercase tracking-wider text-secondary-foreground">
                  {t(`batches.saleMethods.${sale.saleMethod}`)}
                </Text>
              </Badge>
            </View>
            <Text className="text-sm font-semibold text-foreground" numberOfLines={1}>
              {sale.saleNumber || '—'}
            </Text>
            <Text className="text-xs text-muted-foreground">{fmtDate(sale.saleDate)}</Text>
          </View>
          <View className="flex-row items-center gap-1.5">
            <Pressable
              onPress={handleDelete}
              className="h-8 w-8 items-center justify-center rounded-md border border-border"
              hitSlop={8}
            >
              <Trash2 size={16} color="hsl(0, 72%, 51%)" />
            </Pressable>
            <Pressable
              onPress={() => onEdit?.(sale)}
              className="h-8 w-8 items-center justify-center rounded-md border border-border"
              hitSlop={8}
            >
              <Pencil size={16} color="hsl(150, 10%, 45%)" />
            </Pressable>
          </View>
        </View>
      </View>

      <Separator />

      <ScrollView className="flex-1" contentContainerClassName="px-4 py-4 gap-4">
        {sale.customer?.companyName && (
          <Pressable onPress={() => { if (customerId) router.push(`/(app)/business/${customerId}`); }}>
            <PartyCard
              label={sameParty
                ? `${t('batches.saleDetail.billTo')} / ${t('batches.saleDetail.slaughterhouse')}`
                : t('batches.saleDetail.billTo')}
              name={sale.customer.companyName}
              onPress
            />
          </Pressable>
        )}

        {hasDistinctSlaughterhouse && (
          <Pressable onPress={() => { if (slaughterhouseId) router.push(`/(app)/business/${slaughterhouseId}`); }}>
            <PartyCard
              label={t('batches.saleDetail.slaughterhouse')}
              name={sl.slaughterhouse.companyName}
              onPress
            />
          </Pressable>
        )}

        {isSlaughtered && cn_.chickensSent > 0 && (
          <Section>
            <Pressable
              onPress={() => setCountsOpen((v) => !v)}
              className="flex-row items-center justify-between px-3 py-2"
            >
              <View className="flex-row items-center gap-1.5">
                <ChevronDown
                  size={14}
                  color="hsl(150, 10%, 45%)"
                  style={!countsOpen ? { transform: [{ rotate: '-90deg' }] } : undefined}
                />
                <Text className="text-xs text-muted-foreground">
                  {cn_.chickensSent.toLocaleString()} {t('batches.saleForm.chickensSent').toLowerCase()}
                  {losses > 0 ? ` (-${losses})` : ''}
                </Text>
              </View>
              <Text className="text-sm font-semibold text-primary">
                {wholeChickenCount.toLocaleString()} {t('batches.saleDetail.gradeA')}
              </Text>
            </Pressable>
            {countsOpen && (
              <View className="px-3 pb-2.5 pt-1 gap-0.5 border-t border-border">
                <Row label={t('batches.saleForm.chickensSent')} value={(cn_.chickensSent || 0).toLocaleString()} bold />
                {cn_.condemnation > 0 && <Row label={t('batches.saleForm.condemnation')} value={`-${cn_.condemnation.toLocaleString()}`} negative />}
                {cn_.deathOnArrival > 0 && <Row label={t('batches.saleForm.deathOnArrival')} value={`-${cn_.deathOnArrival.toLocaleString()}`} negative />}
                {cn_.rejections > 0 && <Row label={t('batches.saleForm.rejections')} value={`-${cn_.rejections.toLocaleString()}`} negative />}
                {cn_.shortage > 0 && <Row label={t('batches.saleForm.shortage')} value={`-${cn_.shortage.toLocaleString()}`} negative />}
                {cn_.bGrade > 0 && <Row label={t('batches.saleForm.bGradeCount')} value={`-${cn_.bGrade.toLocaleString()}`} negative />}
                <Separator className="my-1" />
                <Row label={t('batches.saleForm.netProcessed')} value={netProcessed.toLocaleString()} bold />
                <Row label={t('batches.saleDetail.wholeChickenGradeA')} value={wholeChickenCount.toLocaleString()} bold highlight />
              </View>
            )}
          </Section>
        )}

        {isSlaughtered && sale.wholeChickenItems?.length > 0 && (
          <Section>
            <View className="flex-row items-center bg-primary px-3 py-1.5">
              <Text className="flex-1 text-[10px] font-semibold uppercase tracking-wider text-primary-foreground">
                {t('batches.saleForm.description')}
              </Text>
              <Text className="w-16 text-right text-[10px] font-semibold uppercase text-primary-foreground">
                {t('batches.saleDetail.kgShort')}
              </Text>
              <Text className="w-12 text-right text-[10px] font-semibold uppercase text-primary-foreground">
                {t('batches.saleDetail.rateShort')}
              </Text>
              <Text className="w-20 text-right text-[10px] font-semibold uppercase text-primary-foreground">
                {t('batches.saleForm.amount')}
              </Text>
            </View>
            {sale.wholeChickenItems.map((item, i) => (
              <View key={i} className={`flex-row items-center px-3 py-1.5 border-b border-border ${i % 2 === 1 ? 'bg-muted/30' : ''}`}>
                <Text className="flex-1 text-sm text-foreground pr-2" numberOfLines={1}>
                  {item.description || t('batches.saleForm.wholeChickensDefault')}
                </Text>
                <Text className="w-16 text-right text-sm text-muted-foreground" numberOfLines={1} adjustsFontSizeToFit style={{ fontVariant: ['tabular-nums'] }}>
                  {fmt(item.weightKg)}
                </Text>
                <Text className="w-12 text-right text-sm text-muted-foreground" style={{ fontVariant: ['tabular-nums'] }}>
                  {fmt(item.ratePerKg)}
                </Text>
                <Text className="w-20 text-right text-sm font-medium text-foreground" numberOfLines={1} adjustsFontSizeToFit style={{ fontVariant: ['tabular-nums'] }}>
                  {fmt(item.amount)}
                </Text>
              </View>
            ))}
          </Section>
        )}

        {isSlaughtered && filledPortions.length > 0 && (
          <Section>
            <View className="flex-row items-center bg-primary px-3 py-1.5">
              <Text className="flex-1 text-[10px] font-semibold uppercase tracking-wider text-primary-foreground">
                {t('batches.saleDetail.portions')}
              </Text>
              <Text className="w-12 text-right text-[10px] font-semibold uppercase text-primary-foreground">
                {t('batches.saleDetail.qtyShort')}
              </Text>
              <Text className="w-14 text-right text-[10px] font-semibold uppercase text-primary-foreground">
                {t('batches.saleDetail.rateShort')}
              </Text>
              <Text className="w-20 text-right text-[10px] font-semibold uppercase text-primary-foreground">
                {t('batches.saleForm.amount')}
              </Text>
            </View>
            {filledPortions.map((p, i) => (
              <View key={p.partType} className={`flex-row items-center px-3 py-1.5 border-b border-border ${i % 2 === 1 ? 'bg-muted/30' : ''}`}>
                <Text className="flex-1 text-sm text-foreground pr-2" numberOfLines={1}>
                  {t(`settings.portionLabels.${p.partType}`)}
                </Text>
                <Text className="w-12 text-right text-sm text-muted-foreground" style={{ fontVariant: ['tabular-nums'] }}>
                  {p.quantity.toLocaleString()}
                </Text>
                <Text className="w-14 text-right text-sm text-muted-foreground" style={{ fontVariant: ['tabular-nums'] }}>
                  {fmt(p.rate)}
                </Text>
                <Text className="w-20 text-right text-sm font-medium text-foreground" numberOfLines={1} adjustsFontSizeToFit style={{ fontVariant: ['tabular-nums'] }}>
                  {fmt(p.amount)}
                </Text>
              </View>
            ))}
          </Section>
        )}

        {isLive && (
          <Section>
            <View className="flex-row items-center bg-primary px-3 py-1.5">
              <Text className="flex-1 text-[10px] font-semibold uppercase tracking-wider text-primary-foreground">
                {t('batches.saleForm.description')}
              </Text>
              <Text className="w-16 text-right text-[10px] font-semibold uppercase text-primary-foreground">
                {isLiveByPiece ? t('batches.saleDetail.qtyShort') : t('batches.saleDetail.kgShort')}
              </Text>
              <Text className="w-12 text-right text-[10px] font-semibold uppercase text-primary-foreground">
                {t('batches.saleDetail.rateShort')}
              </Text>
              <Text className="w-20 text-right text-[10px] font-semibold uppercase text-primary-foreground">
                {t('batches.saleForm.amount')}
              </Text>
            </View>
            {isLiveByPiece && (
              <View className="flex-row items-center px-3 py-1.5 border-b border-border">
                <Text className="flex-1 text-sm text-foreground pr-2" numberOfLines={1}>{t('batches.saleForm.liveWeightDefault')}</Text>
                <Text className="w-16 text-right text-sm text-muted-foreground" numberOfLines={1} adjustsFontSizeToFit style={{ fontVariant: ['tabular-nums'] }}>
                  {(lv.birdCount || 0).toLocaleString()}
                </Text>
                <Text className="w-12 text-right text-sm text-muted-foreground" style={{ fontVariant: ['tabular-nums'] }}>
                  {fmt(lv.ratePerBird)}
                </Text>
                <Text className="w-20 text-right text-sm font-medium text-foreground" numberOfLines={1} adjustsFontSizeToFit style={{ fontVariant: ['tabular-nums'] }}>
                  {fmt((lv.birdCount || 0) * (lv.ratePerBird || 0))}
                </Text>
              </View>
            )}
            {isLiveByWeight && lv.weightItems?.map((item, i) => (
              <View key={i} className={`flex-row items-center px-3 py-1.5 border-b border-border ${i % 2 === 1 ? 'bg-muted/30' : ''}`}>
                <Text className="flex-1 text-sm text-foreground pr-2" numberOfLines={1}>
                  {item.description || t('batches.saleForm.liveWeightDefault')}
                </Text>
                <Text className="w-16 text-right text-sm text-muted-foreground" numberOfLines={1} adjustsFontSizeToFit style={{ fontVariant: ['tabular-nums'] }}>
                  {fmt(item.weightKg)}
                </Text>
                <Text className="w-12 text-right text-sm text-muted-foreground" style={{ fontVariant: ['tabular-nums'] }}>
                  {fmt(item.ratePerKg)}
                </Text>
                <Text className="w-20 text-right text-sm font-medium text-foreground" numberOfLines={1} adjustsFontSizeToFit style={{ fontVariant: ['tabular-nums'] }}>
                  {fmt(item.amount)}
                </Text>
              </View>
            ))}
          </Section>
        )}

        <Section>
          <View className="px-3 py-2.5 gap-0.5">
            <Row label={t('batches.saleForm.grossSales')} value={`${currency} ${fmt(totals.grossSales)}`} bold />
            {(totals.transportDeduction || 0) > 0 && (
              <Row
                label={`${t('batches.saleForm.transportDeduction')} (${tr.truckCount} × ${fmt(tr.ratePerTruck)})`}
                value={`-${currency} ${fmt(totals.transportDeduction)}`}
                negative
              />
            )}
            {sale.discounts?.map((d, i) => (
              <Row
                key={i}
                label={d.description || t('batches.saleForm.discountsSection')}
                value={`-${currency} ${fmt(d.amount)}`}
                negative
              />
            ))}
            {showVat && (
              <>
                <Separator className="my-1.5" />
                <Row label={t('batches.saleForm.invoiceTotal')} value={`${currency} ${fmt(totals.subtotal)}`} bold />
                <Row label={t('batches.saleForm.vat')} value={`${currency} ${fmt(totals.vat)}`} />
              </>
            )}
          </View>
          <TotalBar label={t('batches.saleForm.grandTotal')} value={`${currency} ${fmt(totals.grandTotal)}`} />
        </Section>

        {processingCost > 0 && (
          <Section>
            <SectionHeader icon={TrendingUp}>{t('batches.saleForm.farmersView')}</SectionHeader>
            <View className="px-3 py-2.5 gap-0.5">
              <Row label={t('batches.saleForm.grandTotal')} value={`${currency} ${fmt(totals.grandTotal)}`} />
              <Row label={t('batches.saleForm.processingFee')} value={`-${currency} ${fmt(processingCost)}`} negative />
              <Separator className="my-1.5" />
              <Row label={t('batches.saleForm.netRevenue')} value={`${currency} ${fmt(netRevenue)}`} bold highlight />
              {chickenCount > 0 && (
                <Row label={t('batches.saleDetail.profitPerChicken')} value={`${currency} ${fmt(profitPerChicken)}`} />
              )}
            </View>
            {relatedExpenseId && (
              <View className="border-t border-border">
                <Pressable
                  onPress={() => router.push(`/(app)/expense/${relatedExpenseId}`)}
                  className="flex-row items-center justify-between px-3 py-2.5"
                >
                  <Text className="text-xs text-muted-foreground">{t('batches.saleDetail.viewProcessingExpense')}</Text>
                  <ChevronRight size={14} color="hsl(150, 10%, 45%)" />
                </Pressable>
              </View>
            )}
          </Section>
        )}

        {sale.notes && (
          <View className="rounded-lg bg-muted/30 border border-border px-3 py-2.5">
            <Text className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
              {t('common.description')}
            </Text>
            <Text className="text-sm text-foreground">{sale.notes}</Text>
          </View>
        )}

        <DocumentsSection docGroups={docGroups} t={t} />

        <Text className="text-xs text-muted-foreground text-center pt-1 pb-2">
          {t('batches.saleDetail.createdAt')} {fmtDate(sale.createdAt)} · {t('batches.saleDetail.updatedAt')} {fmtDate(sale.updatedAt)}
        </Text>
      </ScrollView>

      <View className="flex-row items-center justify-between pt-2 border-t border-border px-4" style={{ paddingBottom: Math.max(16, insets.bottom + 8) }}>
        {invoiceMedia?.url ? (
          <Pressable
            onPress={() => setInvoiceViewerOpen(true)}
            className="flex-row items-center rounded-lg border border-border px-4 py-2.5"
          >
            <FileText size={14} color="hsl(150, 10%, 45%)" />
            <Text className="text-sm font-medium text-foreground ml-2">{t('batches.viewInvoice', 'View Invoice')}</Text>
          </Pressable>
        ) : <View />}
        <Pressable
          onPress={() => onEdit?.(sale)}
          className="flex-row items-center rounded-lg bg-primary px-4 py-2.5"
        >
          <Pencil size={14} color="#fff" />
          <Text className="text-sm font-medium text-primary-foreground ml-2">{t('batches.editSale')}</Text>
        </Pressable>
      </View>

      {invoiceMedia?.url && (
        <FileViewer
          visible={invoiceViewerOpen}
          media={invoiceMedia}
          onClose={() => setInvoiceViewerOpen(false)}
        />
      )}
    </View>
  );
}
