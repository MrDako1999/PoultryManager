import { useState } from 'react';
import {
  View, Text, Pressable, StyleSheet, LayoutAnimation, Platform, UIManager,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import {
  Receipt, Pencil, Trash2, ChevronRight, ChevronLeft, ChevronDown, ChevronUp,
  TrendingUp, FileText, Building2,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useHeroSheetTokens } from '@/components/HeroSheetScreen';
import DetailCompactScreen from '@/components/DetailCompactScreen';
import SheetSection from '@/components/SheetSection';
import FileViewer from '@/components/FileViewer';
import DocCard from '@/components/DocCard';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';
import useLocalRecord from '@/hooks/useLocalRecord';
import useSettings from '@/hooks/useSettings';
import useOfflineMutation from '@/hooks/useOfflineMutation';
import useCapabilities from '@/hooks/useCapabilities';
import { useIsRTL } from '@/stores/localeStore';
import { SkeletonDetailPage } from '@/components/skeletons';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// Western digits everywhere (DL §12.4) — never i18n.language for numerics.
const NUMERIC_LOCALE = 'en-US';

const fmt = (val) =>
  Number(val || 0).toLocaleString(NUMERIC_LOCALE, {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  });

const fmtInt = (val) => Number(val || 0).toLocaleString(NUMERIC_LOCALE);

const fmtDate = (d) => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString(NUMERIC_LOCALE, {
    day: '2-digit', month: 'short', year: 'numeric',
  });
};

export default function SaleDetail({ saleId, onEdit }) {
  const { t } = useTranslation();
  const isRTL = useIsRTL();
  const tokens = useHeroSheetTokens();
  const { toast } = useToast();
  const { can } = useCapabilities();
  const accounting = useSettings('accounting');
  const { remove } = useOfflineMutation('saleOrders');
  const [sale, saleLoading] = useLocalRecord('saleOrders', saleId);

  const [countsOpen, setCountsOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [viewerDoc, setViewerDoc] = useState(null);

  if (saleLoading || !sale) {
    return (
      <DetailCompactScreen title={t('common.loading', 'Loading...')} headerRight={null}>
        <SkeletonDetailPage />
      </DetailCompactScreen>
    );
  }

  const currency = accounting?.currency || 'AED';
  const isSlaughtered = sale.saleMethod === 'SLAUGHTERED';
  const isLiveByPiece = sale.saleMethod === 'LIVE_BY_PIECE';
  const isLiveByWeight = sale.saleMethod === 'LIVE_BY_WEIGHT';
  const isLive = isLiveByPiece || isLiveByWeight;
  const showVat = sale.invoiceType === 'VAT_INVOICE';

  const sl = sale.slaughter || {};
  const cn = sale.counts || {};
  const tr = sale.transport || {};
  const totals = sale.totals || {};
  const lv = sale.live || {};

  const losses = (cn.condemnation || 0) + (cn.deathOnArrival || 0)
    + (cn.rejections || 0) + (cn.shortage || 0);
  const netProcessed = (cn.chickensSent || 0) - losses;
  const wholeChickenCount = Math.max(0, netProcessed - (cn.bGrade || 0));
  const filledPortions = (sale.portions || []).filter((p) => p.quantity > 0);

  const processingCost = isSlaughtered ? (sl.processingCost || 0) : 0;
  const grandTotal = totals.grandTotal || 0;
  const netRevenue = grandTotal - processingCost;
  const chickenCount = isSlaughtered ? wholeChickenCount : (lv.birdCount || 0);
  const profitPerChicken = chickenCount > 0 ? netRevenue / chickenCount : 0;

  const customerId = typeof sale.customer === 'object' ? sale.customer?._id : sale.customer;
  const slaughterhouseId = typeof sl.slaughterhouse === 'object'
    ? sl.slaughterhouse?._id : sl.slaughterhouse;
  const sameParty = isSlaughtered && slaughterhouseId && slaughterhouseId === customerId;
  const hasDistinctSlaughterhouse = isSlaughtered
    && sl.slaughterhouse?.companyName && !sameParty;

  const relatedExpenseId = sale.slaughter?.relatedExpense
    ? (sale.slaughter.relatedExpense?._id ?? sale.slaughter.relatedExpense)
    : null;

  const invoiceDocs = (sale.invoiceDocs || []).filter(Boolean);
  const reportDocs = (sl.reportDocs || []).filter(Boolean);
  const transferProofs = (sale.transferProofs || []).filter(Boolean);
  const otherDocs = (sale.otherDocs || []).filter(Boolean).map((d) => d.media_id || d);
  const invoiceMedia = invoiceDocs[0] || null;
  const allDocs = [
    ...invoiceDocs.map((d) => ({ doc: d, label: t('batches.saleDetail.invoiceDoc', 'Sale Invoice') })),
    ...reportDocs.map((d) => ({ doc: d, label: t('batches.saleDetail.processingReport', 'Processing Report') })),
    ...transferProofs.map((d) => ({ doc: d, label: t('batches.sourceDetail.transferProof', 'Transfer Proof') })),
    ...otherDocs.map((d) => ({ doc: d, label: t('common.description', 'Document') })),
  ].filter((g) => g.doc?.url);

  const canEdit = can('saleOrder:update');
  const canDelete = can('saleOrder:delete');

  const compactTitle = t('batches.saleDetail.screenTitle', 'Sale');

  const handleDelete = async () => {
    if (deleting) return;
    setDeleting(true);
    try {
      await remove(saleId);
      toast({ title: t('batches.saleDeleted', 'Sale order deleted') });
      setConfirmDeleteOpen(false);
      router.back();
    } catch {
      toast({
        title: t('batches.saleDeleteError', 'Failed to delete sale order'),
        variant: 'destructive',
      });
    } finally {
      setDeleting(false);
    }
  };

  const toggleCounts = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    Haptics.selectionAsync().catch(() => {});
    setCountsOpen((v) => !v);
  };

  const openEdit = () => {
    Haptics.selectionAsync().catch(() => {});
    onEdit?.(sale);
  };

  const openDelete = () => {
    Haptics.selectionAsync().catch(() => {});
    setConfirmDeleteOpen(true);
  };

  const openInvoiceViewer = () => {
    if (!invoiceMedia) return;
    Haptics.selectionAsync().catch(() => {});
    setViewerDoc(invoiceMedia);
  };

  const headerRight = (invoiceMedia || canEdit || canDelete) ? (
    <View style={[heroStyles.actionsRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
      {invoiceMedia ? (
        <Pressable
          onPress={openInvoiceViewer}
          hitSlop={6}
          android_ripple={{ color: 'rgba(255,255,255,0.18)', borderless: true, radius: 20 }}
          style={heroStyles.actionBtn}
          accessibilityRole="button"
          accessibilityLabel={t('batches.viewInvoice', 'View Invoice')}
        >
          <FileText size={18} color="#ffffff" strokeWidth={2.4} />
        </Pressable>
      ) : null}
      {canEdit ? (
        <Pressable
          onPress={openEdit}
          hitSlop={6}
          android_ripple={{ color: 'rgba(255,255,255,0.18)', borderless: true, radius: 20 }}
          style={heroStyles.actionBtn}
          accessibilityRole="button"
          accessibilityLabel={t('common.edit', 'Edit')}
        >
          <Pencil size={18} color="#ffffff" strokeWidth={2.4} />
        </Pressable>
      ) : null}
      {canDelete ? (
        <Pressable
          onPress={openDelete}
          hitSlop={6}
          android_ripple={{ color: 'rgba(255,255,255,0.18)', borderless: true, radius: 20 }}
          style={heroStyles.actionBtn}
          accessibilityRole="button"
          accessibilityLabel={t('common.delete', 'Delete')}
        >
          <Trash2 size={18} color="#ffffff" strokeWidth={2.4} />
        </Pressable>
      ) : null}
    </View>
  ) : null;

  return (
    <>
      <DetailCompactScreen title={compactTitle} headerRight={headerRight}>
        {/* ─── BILL TO / SLAUGHTERHOUSE ─── */}
        {(sale.customer?.companyName || hasDistinctSlaughterhouse) ? (
          <SheetSection
            title={sameParty
              ? t('batches.saleDetail.billToSlaughterhouse', 'Bill To / Slaughterhouse')
              : t('batches.saleDetail.billTo', 'Bill To')}
            padded={false}
          >
            <View style={{ padding: 12, gap: 10 }}>
              {sale.customer?.companyName ? (
                <PartyRow
                  tokens={tokens}
                  isRTL={isRTL}
                  name={sale.customer.companyName}
                  onPress={customerId
                    ? () => router.push(`/(app)/business/${customerId}`)
                    : null}
                />
              ) : null}
              {hasDistinctSlaughterhouse ? (
                <PartyRow
                  tokens={tokens}
                  isRTL={isRTL}
                  name={sl.slaughterhouse.companyName}
                  caption={t('batches.saleDetail.slaughterhouse', 'Slaughterhouse')}
                  onPress={slaughterhouseId
                    ? () => router.push(`/(app)/business/${slaughterhouseId}`)
                    : null}
                />
              ) : null}
            </View>
          </SheetSection>
        ) : null}

        {/* ─── SLAUGHTER DETAILS ─── */}
        {isSlaughtered && (sl.date || sl.invoiceRef || processingCost > 0) ? (
          <SheetSection title={t('batches.saleDetail.slaughterInfo', 'Processing Information')}>
            <View style={{ gap: 10 }}>
              {sl.date ? (
                <KvRow
                  tokens={tokens}
                  isRTL={isRTL}
                  label={t('batches.saleDetail.slaughterDate', 'Slaughter Date')}
                  value={fmtDate(sl.date)}
                />
              ) : null}
              {sl.invoiceRef ? (
                <KvRow
                  tokens={tokens}
                  isRTL={isRTL}
                  label={t('batches.saleDetail.invoiceRef', 'Invoice Reference')}
                  value={sl.invoiceRef}
                />
              ) : null}
              {processingCost > 0 ? (
                <KvRow
                  tokens={tokens}
                  isRTL={isRTL}
                  label={t('batches.saleDetail.processingCost', 'Processing Cost')}
                  value={`${currency} ${fmt(processingCost)}`}
                />
              ) : null}
            </View>
          </SheetSection>
        ) : null}

        {/* ─── PROCESSING COUNTS ─── */}
        {isSlaughtered && cn.chickensSent > 0 ? (
          <SheetSection title={t('batches.saleDetail.counts', 'Processing Counts')} padded={false}>
            <Pressable
              onPress={toggleCounts}
              android_ripple={{
                color: tokens.dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
                borderless: false,
              }}
              style={countsStyles.toggle}
            >
              <View
                style={[
                  countsStyles.toggleRow,
                  { flexDirection: isRTL ? 'row-reverse' : 'row' },
                ]}
              >
                <View style={countsStyles.chevronSlot}>
                  {countsOpen ? (
                    <ChevronDown
                      size={18}
                      color={tokens.textColor}
                      strokeWidth={2.4}
                    />
                  ) : (
                    <ChevronUp
                      size={18}
                      color={tokens.textColor}
                      strokeWidth={2.4}
                    />
                  )}
                </View>
                <Text
                  style={{
                    flex: 1,
                    fontSize: 13,
                    fontFamily: 'Poppins-Regular',
                    color: tokens.mutedColor,
                    textAlign: isRTL ? 'right' : 'left',
                  }}
                  numberOfLines={1}
                >
                  {`${fmtInt(cn.chickensSent)} ${t('batches.saleForm.chickensSent', 'Chickens Sent').toLowerCase()}`}
                  {losses > 0 ? ` (-${fmtInt(losses)})` : ''}
                </Text>
                <Text
                  style={{
                    fontSize: 14,
                    fontFamily: 'Poppins-SemiBold',
                    color: tokens.accentColor,
                    fontVariant: ['tabular-nums'],
                  }}
                >
                  {`${fmtInt(wholeChickenCount)} ${t('batches.saleDetail.gradeA', 'Grade A')}`}
                </Text>
              </View>
            </Pressable>
            {countsOpen ? (
              <View
                style={[
                  countsStyles.detail,
                  { borderTopColor: tokens.borderColor },
                ]}
              >
                <KvRow
                  tokens={tokens}
                  isRTL={isRTL}
                  label={t('batches.saleForm.chickensSent', 'Chickens Sent')}
                  value={fmtInt(cn.chickensSent)}
                  bold
                />
                {cn.condemnation > 0 ? (
                  <KvRow
                    tokens={tokens}
                    isRTL={isRTL}
                    label={t('batches.saleForm.condemnation', 'Condemnation')}
                    value={`-${fmtInt(cn.condemnation)}`}
                    negative
                  />
                ) : null}
                {cn.deathOnArrival > 0 ? (
                  <KvRow
                    tokens={tokens}
                    isRTL={isRTL}
                    label={t('batches.saleForm.deathOnArrival', 'Death on Arrival')}
                    value={`-${fmtInt(cn.deathOnArrival)}`}
                    negative
                  />
                ) : null}
                {cn.rejections > 0 ? (
                  <KvRow
                    tokens={tokens}
                    isRTL={isRTL}
                    label={t('batches.saleForm.rejections', 'Rejections')}
                    value={`-${fmtInt(cn.rejections)}`}
                    negative
                  />
                ) : null}
                {cn.shortage > 0 ? (
                  <KvRow
                    tokens={tokens}
                    isRTL={isRTL}
                    label={t('batches.saleForm.shortage', 'Shortage')}
                    value={`-${fmtInt(cn.shortage)}`}
                    negative
                  />
                ) : null}
                {cn.bGrade > 0 ? (
                  <KvRow
                    tokens={tokens}
                    isRTL={isRTL}
                    label={t('batches.saleForm.bGradeCount', 'B-Grade')}
                    value={`-${fmtInt(cn.bGrade)}`}
                    negative
                  />
                ) : null}
                <View style={[countsStyles.divider, { backgroundColor: tokens.borderColor }]} />
                <KvRow
                  tokens={tokens}
                  isRTL={isRTL}
                  label={t('batches.saleForm.netProcessed', 'Net Processed')}
                  value={fmtInt(netProcessed)}
                  bold
                />
                <KvRow
                  tokens={tokens}
                  isRTL={isRTL}
                  label={t('batches.saleDetail.wholeChickenGradeA', 'Whole Chicken (Grade A)')}
                  value={fmtInt(wholeChickenCount)}
                  bold
                  highlight
                />
              </View>
            ) : null}
          </SheetSection>
        ) : null}

        {/* ─── WHOLE CHICKENS ─── */}
        {isSlaughtered && sale.wholeChickenItems?.length > 0 ? (
          <SheetSection
            title={t('batches.saleDetail.wholeChickenItems', 'Whole Chicken Weights')}
            padded={false}
          >
            <MiniTable
              tokens={tokens}
              isRTL={isRTL}
              columns={[
                t('batches.saleForm.description', 'Description'),
                t('batches.saleDetail.kgShort', 'KG'),
                t('batches.saleDetail.rateShort', 'Rate'),
                t('batches.saleForm.amount', 'Amount'),
              ]}
              rows={sale.wholeChickenItems.map((item) => [
                item.description || t('batches.saleForm.wholeChickensDefault', 'Whole Chickens'),
                fmt(item.weightKg),
                fmt(item.ratePerKg),
                fmt(item.amount),
              ])}
            />
          </SheetSection>
        ) : null}

        {/* ─── POULTRY PORTIONS ─── */}
        {isSlaughtered && filledPortions.length > 0 ? (
          <SheetSection
            title={t('batches.saleDetail.portions', 'Poultry Portions')}
            padded={false}
          >
            <MiniTable
              tokens={tokens}
              isRTL={isRTL}
              columns={[
                t('batches.saleForm.partType', 'Part'),
                t('batches.saleDetail.qtyShort', 'Qty'),
                t('batches.saleDetail.rateShort', 'Rate'),
                t('batches.saleForm.amount', 'Amount'),
              ]}
              rows={filledPortions.map((p) => [
                t(`settings.portionLabels.${p.partType}`, p.partType),
                fmtInt(p.quantity),
                fmt(p.rate),
                fmt(p.amount),
              ])}
            />
          </SheetSection>
        ) : null}

        {/* ─── LIVE SALE ─── */}
        {isLive ? (
          <SheetSection
            title={t('batches.saleDetail.liveDetails', 'Live Sale Details')}
            padded={false}
          >
            <MiniTable
              tokens={tokens}
              isRTL={isRTL}
              columns={[
                t('batches.saleForm.description', 'Description'),
                isLiveByPiece
                  ? t('batches.saleDetail.qtyShort', 'Qty')
                  : t('batches.saleDetail.kgShort', 'KG'),
                t('batches.saleDetail.rateShort', 'Rate'),
                t('batches.saleForm.amount', 'Amount'),
              ]}
              rows={isLiveByPiece
                ? [[
                    t('batches.saleForm.liveWeightDefault', 'Live Birds'),
                    fmtInt(lv.birdCount),
                    fmt(lv.ratePerBird),
                    fmt((lv.birdCount || 0) * (lv.ratePerBird || 0)),
                  ]]
                : (lv.weightItems || []).map((item) => [
                    item.description || t('batches.saleForm.liveWeightDefault', 'Live Birds'),
                    fmt(item.weightKg),
                    fmt(item.ratePerKg),
                    fmt(item.amount),
                  ])}
            />
          </SheetSection>
        ) : null}

        {/* ─── TOTALS ─── */}
        <SheetSection title={t('batches.saleForm.summary', 'Summary')} padded={false}>
          <View style={{ padding: 16, gap: 8 }}>
            <KvRow
              tokens={tokens}
              isRTL={isRTL}
              label={t('batches.saleForm.grossSales', 'Gross Sales')}
              value={`${currency} ${fmt(totals.grossSales)}`}
              bold
            />
            {(totals.transportDeduction || 0) > 0 ? (
              <KvRow
                tokens={tokens}
                isRTL={isRTL}
                label={`${t('batches.saleForm.transportDeduction', 'Transport Deduction')} (${fmtInt(tr.truckCount)} × ${fmt(tr.ratePerTruck)})`}
                value={`-${currency} ${fmt(totals.transportDeduction)}`}
                negative
              />
            ) : null}
            {sale.discounts?.map((d, i) => (
              <KvRow
                key={i}
                tokens={tokens}
                isRTL={isRTL}
                label={d.description || t('batches.saleForm.discountsSection', 'Discounts')}
                value={`-${currency} ${fmt(d.amount)}`}
                negative
              />
            ))}
            {showVat ? (
              <>
                <View style={[countsStyles.divider, { backgroundColor: tokens.borderColor }]} />
                <KvRow
                  tokens={tokens}
                  isRTL={isRTL}
                  label={t('batches.saleForm.invoiceTotal', 'Subtotal')}
                  value={`${currency} ${fmt(totals.subtotal)}`}
                  bold
                />
                <KvRow
                  tokens={tokens}
                  isRTL={isRTL}
                  label={t('batches.saleForm.vat', 'VAT')}
                  value={`${currency} ${fmt(totals.vat)}`}
                />
              </>
            ) : null}
          </View>
          <GrandTotalStrip
            tokens={tokens}
            isRTL={isRTL}
            label={t('batches.saleForm.grandTotal', 'Grand Total')}
            value={`${currency} ${fmt(grandTotal)}`}
          />
        </SheetSection>

        {/* ─── FARMER'S VIEW ─── */}
        {processingCost > 0 ? (
          <SheetSection
            title={t('batches.saleForm.farmersView', "Farmer's View")}
            icon={TrendingUp}
            padded={false}
          >
            <View style={{ padding: 16, gap: 8 }}>
              <KvRow
                tokens={tokens}
                isRTL={isRTL}
                label={t('batches.saleForm.grandTotal', 'Grand Total')}
                value={`${currency} ${fmt(grandTotal)}`}
              />
              <KvRow
                tokens={tokens}
                isRTL={isRTL}
                label={t('batches.saleForm.processingFee', 'Processing Fee')}
                value={`-${currency} ${fmt(processingCost)}`}
                negative
              />
              <View style={[countsStyles.divider, { backgroundColor: tokens.borderColor }]} />
              <KvRow
                tokens={tokens}
                isRTL={isRTL}
                label={t('batches.saleForm.netRevenue', 'Net Revenue')}
                value={`${currency} ${fmt(netRevenue)}`}
                bold
                highlight
              />
              {chickenCount > 0 ? (
                <KvRow
                  tokens={tokens}
                  isRTL={isRTL}
                  label={t('batches.saleDetail.profitPerChicken', 'Revenue per Chicken')}
                  value={`${currency} ${fmt(profitPerChicken)}`}
                />
              ) : null}
            </View>
            {relatedExpenseId ? (
              <Pressable
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  router.push(`/(app)/expense/${relatedExpenseId}`);
                }}
                android_ripple={{
                  color: tokens.dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
                  borderless: false,
                }}
                style={[linkRowStyles.row, { borderTopColor: tokens.borderColor }]}
              >
                <View
                  style={[
                    linkRowStyles.inner,
                    { flexDirection: isRTL ? 'row-reverse' : 'row' },
                  ]}
                >
                  <Text
                    style={{
                      flex: 1,
                      fontSize: 13,
                      fontFamily: 'Poppins-Medium',
                      color: tokens.mutedColor,
                      textAlign: isRTL ? 'right' : 'left',
                    }}
                  >
                    {t('batches.saleDetail.viewProcessingExpense', 'View Processing Expense')}
                  </Text>
                  <ForwardChevron size={16} color={tokens.mutedColor} strokeWidth={2.2} isRTL={isRTL} />
                </View>
              </Pressable>
            ) : null}
          </SheetSection>
        ) : null}

        {/* ─── NOTES ─── */}
        {sale.notes ? (
          <SheetSection title={t('common.description', 'Description')}>
            <Text
              style={{
                fontSize: 14,
                fontFamily: 'Poppins-Regular',
                color: tokens.textColor,
                lineHeight: 20,
                textAlign: isRTL ? 'right' : 'left',
                writingDirection: isRTL ? 'rtl' : 'ltr',
              }}
            >
              {sale.notes}
            </Text>
          </SheetSection>
        ) : null}

        {/* ─── DOCUMENTS ─── */}
        {allDocs.length > 0 ? (
          <SheetSection
            title={t('batches.saleDetail.documents', 'Documents')}
            padded={false}
          >
            <View style={{ padding: 12, gap: 10 }}>
              {allDocs.map((g, i) => (
                <DocCard
                  key={`${g.doc._id || i}`}
                  doc={g.doc}
                  label={g.label}
                  onPress={() => setViewerDoc(g.doc)}
                />
              ))}
            </View>
          </SheetSection>
        ) : null}

        {/* ─── FOOTER META ─── */}
        <Text
          style={{
            fontSize: 12,
            fontFamily: 'Poppins-Regular',
            color: tokens.mutedColor,
            textAlign: 'center',
            marginHorizontal: 16,
            marginBottom: 8,
            marginTop: 4,
          }}
        >
          {`${t('batches.saleDetail.createdAt', 'Created')} ${fmtDate(sale.createdAt)} · ${t('batches.saleDetail.updatedAt', 'Last Updated')} ${fmtDate(sale.updatedAt)}`}
        </Text>

        {/* ─── BOTTOM CTA STRIP ─── */}
        {(invoiceMedia || canEdit) ? (
          <View
            style={[
              ctaStyles.row,
              {
                marginHorizontal: 16,
                gap: 10,
                flexDirection: isRTL ? 'row-reverse' : 'row',
              },
            ]}
          >
            {invoiceMedia ? (
              <View style={{ flex: canEdit ? 1 : undefined, width: canEdit ? undefined : '100%' }}>
                <CtaButton
                  variant="secondary"
                  icon={FileText}
                  label={t('batches.viewInvoice', 'View Invoice')}
                  onPress={() => setViewerDoc(invoiceMedia)}
                  isRTL={isRTL}
                  tokens={tokens}
                />
              </View>
            ) : null}
            {canEdit ? (
              <View style={{ flex: invoiceMedia ? 1 : undefined, width: invoiceMedia ? undefined : '100%' }}>
                <CtaButton
                  variant="primary"
                  icon={Pencil}
                  label={t('batches.editSale', 'Edit Sale')}
                  onPress={openEdit}
                  isRTL={isRTL}
                  tokens={tokens}
                />
              </View>
            ) : null}
          </View>
        ) : null}
      </DetailCompactScreen>

      {/* Doc preview */}
      <FileViewer
        visible={!!viewerDoc}
        media={viewerDoc}
        onClose={() => setViewerDoc(null)}
      />

      {/* Delete confirmation (replaces the old Alert.alert per DL §13). */}
      <ConfirmDialog
        open={confirmDeleteOpen}
        onOpenChange={setConfirmDeleteOpen}
        title={t('batches.deleteSaleTitle', 'Delete Sale Order')}
        description={t(
          'batches.deleteSaleWarning',
          'This will permanently delete this sale order and its associated processing expense. This action cannot be undone.'
        )}
        confirmLabel={t('common.delete', 'Delete')}
        cancelLabel={t('common.cancel', 'Cancel')}
        onConfirm={handleDelete}
        isPending={deleting}
      />
    </>
  );
}

/* ───────────────────── Sub-components ───────────────────── */

// Tappable party row (Bill To / Slaughterhouse). Layout in StyleSheet per
// DL §9 — inner View carries flexDirection, never the Pressable.
function PartyRow({ tokens, isRTL, name, caption, onPress }) {
  const {
    elevatedCardBg, elevatedCardBorder, elevatedCardPressedBg, accentColor,
    textColor, mutedColor, dark,
  } = tokens;

  const ForwardArrow = isRTL ? ChevronLeft : ChevronRight;

  if (!onPress) {
    return (
      <View
        style={[
          partyStyles.card,
          { backgroundColor: elevatedCardBg, borderColor: elevatedCardBorder },
        ]}
      >
        <View style={[partyStyles.row, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
          <View style={[partyStyles.iconTile, { backgroundColor: dark ? 'rgba(148,210,165,0.16)' : 'hsl(148, 35%, 92%)' }]}>
            <Building2 size={18} color={accentColor} strokeWidth={2.2} />
          </View>
          <View style={partyStyles.textCol}>
            {caption ? (
              <Text
                style={{
                  fontSize: 11,
                  fontFamily: 'Poppins-SemiBold',
                  color: mutedColor,
                  letterSpacing: 0.6,
                  textTransform: 'uppercase',
                  textAlign: isRTL ? 'right' : 'left',
                }}
                numberOfLines={1}
              >
                {caption}
              </Text>
            ) : null}
            <Text
              style={{
                fontSize: 15,
                fontFamily: 'Poppins-SemiBold',
                color: textColor,
                textAlign: isRTL ? 'right' : 'left',
              }}
              numberOfLines={1}
            >
              {name}
            </Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <Pressable
      onPressIn={() => Haptics.selectionAsync().catch(() => {})}
      onPress={onPress}
      android_ripple={{
        color: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
        borderless: false,
      }}
      style={({ pressed }) => [
        partyStyles.card,
        {
          backgroundColor: pressed ? elevatedCardPressedBg : elevatedCardBg,
          borderColor: pressed ? accentColor : elevatedCardBorder,
          transform: [{ scale: pressed ? 0.985 : 1 }],
          opacity: pressed ? 0.96 : 1,
        },
      ]}
    >
      <View style={[partyStyles.row, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        <View style={[partyStyles.iconTile, { backgroundColor: dark ? 'rgba(148,210,165,0.16)' : 'hsl(148, 35%, 92%)' }]}>
          <Building2 size={18} color={accentColor} strokeWidth={2.2} />
        </View>
        <View style={partyStyles.textCol}>
          {caption ? (
            <Text
              style={{
                fontSize: 11,
                fontFamily: 'Poppins-SemiBold',
                color: mutedColor,
                letterSpacing: 0.6,
                textTransform: 'uppercase',
                textAlign: isRTL ? 'right' : 'left',
              }}
              numberOfLines={1}
            >
              {caption}
            </Text>
          ) : null}
          <Text
            style={{
              fontSize: 15,
              fontFamily: 'Poppins-SemiBold',
              color: textColor,
              textAlign: isRTL ? 'right' : 'left',
            }}
            numberOfLines={1}
          >
            {name}
          </Text>
        </View>
        <ForwardArrow size={18} color={mutedColor} strokeWidth={2.2} />
      </View>
    </Pressable>
  );
}

// Key/value row used inside totals / counts / detail sections.
function KvRow({ tokens, isRTL, label, value, bold, negative, highlight }) {
  const { textColor, mutedColor, errorColor, accentColor } = tokens;
  return (
    <View
      style={[
        kvStyles.row,
        { flexDirection: isRTL ? 'row-reverse' : 'row' },
      ]}
    >
      <Text
        style={{
          flex: 1,
          fontSize: 13,
          fontFamily: bold ? 'Poppins-SemiBold' : 'Poppins-Regular',
          color: mutedColor,
          textAlign: isRTL ? 'right' : 'left',
        }}
        numberOfLines={2}
      >
        {label}
      </Text>
      <Text
        style={{
          fontSize: 14,
          fontFamily: bold ? 'Poppins-SemiBold' : 'Poppins-Regular',
          color: negative ? errorColor : highlight ? accentColor : textColor,
          fontVariant: ['tabular-nums'],
          textAlign: isRTL ? 'left' : 'right',
        }}
      >
        {value}
      </Text>
    </View>
  );
}

// Mini-table for line items (whole chickens / portions / live items).
// Header band uses the accent green; rows alternate a subtle tint.
function MiniTable({ tokens, isRTL, columns, rows }) {
  const { accentColor, borderColor, textColor, mutedColor, dark } = tokens;
  const altRowBg = dark ? 'rgba(255,255,255,0.025)' : 'hsl(148, 22%, 97%)';

  const renderCell = (val, idx, total, isHeader) => {
    const isLabelCol = idx === 0;
    const align = isLabelCol
      ? (isRTL ? 'right' : 'left')
      : (idx === total - 1 ? (isRTL ? 'left' : 'right') : 'center');
    return (
      <Text
        key={idx}
        style={{
          flex: isLabelCol ? 1.4 : 1,
          fontSize: isHeader ? 10.5 : 13,
          fontFamily: isHeader ? 'Poppins-SemiBold' : 'Poppins-Regular',
          color: isHeader ? '#ffffff' : (isLabelCol ? textColor : mutedColor),
          letterSpacing: isHeader ? 0.8 : 0,
          textTransform: isHeader ? 'uppercase' : undefined,
          textAlign: align,
          fontVariant: isLabelCol || isHeader ? undefined : ['tabular-nums'],
          paddingHorizontal: 4,
        }}
        numberOfLines={1}
      >
        {val}
      </Text>
    );
  };

  return (
    <View>
      <View
        style={[
          tableStyles.headerRow,
          { backgroundColor: accentColor, flexDirection: isRTL ? 'row-reverse' : 'row' },
        ]}
      >
        {columns.map((c, i) => renderCell(c, i, columns.length, true))}
      </View>
      {rows.map((row, i) => (
        <View
          key={i}
          style={[
            tableStyles.row,
            {
              flexDirection: isRTL ? 'row-reverse' : 'row',
              backgroundColor: i % 2 === 1 ? altRowBg : 'transparent',
              borderBottomColor: borderColor,
              borderBottomWidth: i === rows.length - 1 ? 0 : StyleSheet.hairlineWidth,
            },
          ]}
        >
          {row.map((cell, j) => renderCell(cell, j, row.length, false))}
        </View>
      ))}
    </View>
  );
}

// Flush-bottom green strip inside the totals section card.
function GrandTotalStrip({ tokens, isRTL, label, value }) {
  const { accentColor } = tokens;
  return (
    <View
      style={[
        grandTotalStyles.strip,
        { backgroundColor: accentColor, flexDirection: isRTL ? 'row-reverse' : 'row' },
      ]}
    >
      <Text style={[grandTotalStyles.label, { textAlign: isRTL ? 'right' : 'left' }]}>
        {label}
      </Text>
      <Text style={[grandTotalStyles.value, { textAlign: isRTL ? 'left' : 'right' }]}>
        {value}
      </Text>
    </View>
  );
}

// Tiny RTL-aware chevron passthrough used inside FarmersView "view expense" row.
function ForwardChevron({ size, color, strokeWidth, isRTL }) {
  const Glyph = isRTL ? ChevronLeft : ChevronRight;
  return <Glyph size={size} color={color} strokeWidth={strokeWidth} />;
}

// Shared CTA button used by both the View Invoice (secondary) and Edit
// Sale (primary) bottom buttons. By going through the SAME Pressable +
// SAME StyleSheet for both, we guarantee identical height / radius /
// padding so the row never looks asymmetric.
//
// IMPORTANT: this MUST use a STATIC style array on the Pressable. The
// functional `style={({ pressed }) => [...]}` form triggers DL §9
// "NativeWind / Pressable functional-style trap" which silently strips
// layout properties — the previous attempt collapsed View Invoice down
// to a tiny ghost text+icon. Press feedback is tracked via local state.
function CtaButton({ variant, icon: Icon, label, onPress, isRTL, tokens }) {
  const { dark, accentColor } = tokens;
  const [pressed, setPressed] = useState(false);

  const filled = variant === 'primary';

  const idleBg = filled
    ? accentColor
    : (dark ? 'rgba(148,210,165,0.16)' : 'hsl(148, 35%, 92%)');
  const pressedBg = filled
    ? (dark ? 'hsl(148, 55%, 48%)' : 'hsl(148, 60%, 24%)')
    : (dark ? 'rgba(148,210,165,0.26)' : 'hsl(148, 35%, 86%)');
  // Filled buttons use the same border color as the fill so the 1.5pt
  // border doesn't read as a visible outline; secondary keeps the brand
  // accent border so the outline stands out against the dark sheet.
  const borderColor = filled ? idleBg : accentColor;
  const fg = filled ? '#f5f8f5' : accentColor;

  return (
    <Pressable
      onPressIn={() => {
        setPressed(true);
        Haptics.selectionAsync().catch(() => {});
      }}
      onPressOut={() => setPressed(false)}
      onPress={onPress}
      android_ripple={{
        color: filled
          ? 'rgba(255,255,255,0.18)'
          : (dark ? 'rgba(148,210,165,0.18)' : 'rgba(20,83,45,0.12)'),
        borderless: false,
      }}
      style={[
        ctaButtonStyles.btn,
        {
          backgroundColor: pressed ? pressedBg : idleBg,
          borderColor,
          opacity: pressed ? 0.95 : 1,
        },
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <View
        style={[
          ctaButtonStyles.inner,
          { flexDirection: isRTL ? 'row-reverse' : 'row' },
        ]}
      >
        <Icon size={18} color={fg} strokeWidth={2.4} />
        <Text
          style={{
            fontSize: 15,
            fontFamily: 'Poppins-SemiBold',
            color: fg,
          }}
          numberOfLines={1}
        >
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

/* ───────────────────── StyleSheets ───────────────────── */

const heroStyles = StyleSheet.create({
  actionsRow: {
    alignItems: 'center',
    gap: 8,
  },
  actionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

const partyStyles = StyleSheet.create({
  card: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  row: {
    alignItems: 'center',
    gap: 12,
  },
  iconTile: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textCol: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
});

const kvStyles = StyleSheet.create({
  row: {
    alignItems: 'center',
    gap: 12,
    minHeight: 22,
  },
});

const countsStyles = StyleSheet.create({
  toggle: {
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  chevronSlot: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleRow: {
    alignItems: 'center',
    gap: 10,
  },
  detail: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 4,
  },
});

const tableStyles = StyleSheet.create({
  headerRow: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignItems: 'center',
  },
  row: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: 'center',
  },
});

const grandTotalStyles = StyleSheet.create({
  strip: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: {
    flex: 1,
    fontSize: 11,
    fontFamily: 'Poppins-Bold',
    color: '#ffffff',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  value: {
    fontSize: 15,
    fontFamily: 'Poppins-Bold',
    color: '#ffffff',
    fontVariant: ['tabular-nums'],
    marginStart: 12,
  },
});

const linkRowStyles = StyleSheet.create({
  row: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  inner: {
    alignItems: 'center',
    gap: 10,
  },
});

const ctaStyles = StyleSheet.create({
  row: {
    marginTop: 4,
  },
});

// Single source of truth for both CTA buttons (View Invoice + Edit Sale).
// `width: '100%'` makes each Pressable fill its flex parent in the row so
// they pair up at the same width. `height: 56` + `borderRadius: 16` +
// `borderWidth: 1.5` are identical for both — the only thing that changes
// per variant is the fill / border / fg colour.
const ctaButtonStyles = StyleSheet.create({
  btn: {
    width: '100%',
    height: 56,
    borderRadius: 16,
    borderWidth: 1.5,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inner: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
});
