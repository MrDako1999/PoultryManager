import { useState } from 'react';
import {
  View, Text, Pressable, StyleSheet,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import {
  Receipt, Pencil, Trash2, ChevronRight, ChevronLeft,
  FileText, Building2, Wheat, Package, Link2,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import HeroSheetScreen, { useHeroSheetTokens } from '@/components/HeroSheetScreen';
import SheetSection from '@/components/SheetSection';
import FileViewer from '@/components/FileViewer';
import DocCard from '@/components/DocCard';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';
import useLocalRecord from '@/hooks/useLocalRecord';
import useLocalQuery from '@/hooks/useLocalQuery';
import useSettings from '@/hooks/useSettings';
import useOfflineMutation from '@/hooks/useOfflineMutation';
import useCapabilities from '@/hooks/useCapabilities';
import { useIsRTL } from '@/stores/localeStore';
import { SkeletonDetailPage } from '@/components/skeletons';

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

// Compact "12.4K" formatter for hero pulse pills so currency-prefixed
// values don't blow out at narrow widths.
const fmtCompact = (val) => {
  const n = Number(val || 0);
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return fmt(n);
};

export default function FeedOrderDetail({ feedOrderId, onEdit }) {
  const { t } = useTranslation();
  const isRTL = useIsRTL();
  const tokens = useHeroSheetTokens();
  const { toast } = useToast();
  const { can } = useCapabilities();
  const accounting = useSettings('accounting');
  const { remove } = useOfflineMutation('feedOrders');
  const [order, orderLoading] = useLocalRecord('feedOrders', feedOrderId);

  // Feed orders cascade-create exactly one expense; we look it up here so
  // we can surface a "View Related Expense" navigation row.
  const [linkedExpenses] = useLocalQuery('expenses', { feedOrder: feedOrderId });
  const linkedExpenseId = linkedExpenses?.[0]?._id || null;

  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [viewerDoc, setViewerDoc] = useState(null);

  if (orderLoading || !order) {
    return (
      <HeroSheetScreen
        title={t('common.loading', 'Loading...')}
        heroExtra={(
          <View style={heroStyles.iconTile}>
            <Wheat size={26} color="#ffffff" strokeWidth={2.2} />
          </View>
        )}
      >
        <SkeletonDetailPage />
      </HeroSheetScreen>
    );
  }

  const currency = accounting?.currency || 'AED';
  const items = order.items || [];
  const totalBags = items.reduce((sum, li) => sum + (li.bags || 0), 0);
  const hasVat = (order.vatAmount || 0) > 0;
  const hasDelivery = (order.deliveryCharge || 0) > 0;
  const grandTotal = order.grandTotal || 0;

  const companyId = typeof order.feedCompany === 'object'
    ? order.feedCompany?._id
    : order.feedCompany;
  const companyName = order.feedCompany?.companyName;

  const taxInvoiceDocs = (order.taxInvoiceDocs || []).filter(Boolean);
  const transferProofs = (order.transferProofs || []).filter(Boolean);
  const deliveryNoteDocs = (order.deliveryNoteDocs || []).filter(Boolean);
  const invoiceMedia = taxInvoiceDocs[0] || null;
  const allDocs = [
    ...taxInvoiceDocs.map((d) => ({ doc: d, label: t('batches.feedOrderDetail.taxInvoiceDoc', 'Tax Invoice') })),
    ...deliveryNoteDocs.map((d) => ({ doc: d, label: t('batches.feedOrderDetail.deliveryNoteDoc', 'Delivery Note') })),
    ...transferProofs.map((d) => ({ doc: d, label: t('batches.feedOrderDetail.transferProof', 'Transfer Proof') })),
  ].filter((g) => g.doc?.url);

  const canEdit = can('feedOrder:update');
  const canDelete = can('feedOrder:delete');

  // Hero title — supplier first, then a localised "Unknown Supplier" so
  // the hero never renders blank.
  const heroTitle = companyName
    || t('batches.unknownSupplier', 'Unknown Supplier');
  const heroSubtitleParts = [];
  if (order.taxInvoiceId) heroSubtitleParts.push(order.taxInvoiceId);
  if (order.orderDate) heroSubtitleParts.push(fmtDate(order.orderDate));
  const heroSubtitle = heroSubtitleParts.join(' · ');

  const openEdit = () => {
    Haptics.selectionAsync().catch(() => {});
    onEdit?.(order);
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

  const handleDelete = async () => {
    if (deleting) return;
    setDeleting(true);
    try {
      await remove(feedOrderId);
      toast({ title: t('batches.feedOrderDeleted', 'Feed order deleted') });
      setConfirmDeleteOpen(false);
      router.back();
    } catch {
      toast({
        title: t('batches.feedOrderDeleteError', 'Failed to delete feed order'),
        variant: 'destructive',
      });
    } finally {
      setDeleting(false);
    }
  };

  // Hero header-right: view-invoice + edit + delete translucent circles.
  const headerRight = (invoiceMedia || canEdit || canDelete) ? (
    <View style={[heroStyles.actionsRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
      {invoiceMedia ? (
        <Pressable
          onPress={openInvoiceViewer}
          hitSlop={6}
          android_ripple={{ color: 'rgba(255,255,255,0.18)', borderless: true, radius: 20 }}
          style={heroStyles.actionBtn}
          accessibilityRole="button"
          accessibilityLabel={t('batches.feedOrderDetail.viewInvoice', 'View Invoice')}
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

  // Hero icon tile — Wheat for "feed order" identity at a glance.
  const heroExtra = (
    <View style={heroStyles.iconTile}>
      <Wheat size={26} color="#ffffff" strokeWidth={2.2} />
    </View>
  );

  // Hero "data pulse" — single bag count pill + 2 KPI pills.
  const heroBelow = (
    <View style={{ gap: 14 }}>
      <View style={[heroStyles.pillsRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        <HeroBadge label={`${fmtInt(totalBags)} ${t('batches.bags', 'BAGS').toUpperCase()}`} />
      </View>
      <View style={[heroStyles.pulseRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        <PulsePill
          icon={Package}
          label={t('batches.feedOrderDetail.totalBagsShort', 'Bags')}
          value={fmtInt(totalBags)}
        />
        <PulsePill
          icon={Receipt}
          label={t('batches.feedOrderDetail.grandTotalShort', 'Total')}
          value={`${currency} ${fmtCompact(grandTotal)}`}
        />
      </View>
    </View>
  );

  return (
    <>
      <HeroSheetScreen
        scrollableHero
        title={heroTitle}
        subtitle={heroSubtitle}
        heroExtra={heroExtra}
        headerRight={headerRight}
        heroBelow={heroBelow}
      >
        {/* ─── FEED COMPANY ─── */}
        {companyName ? (
          <SheetSection
            title={t('batches.feedCompany', 'Feed Company')}
            padded={false}
          >
            <View style={{ padding: 12 }}>
              <PartyRow
                tokens={tokens}
                isRTL={isRTL}
                name={companyName}
                onPress={companyId
                  ? () => router.push(`/(app)/business/${companyId}`)
                  : null}
              />
            </View>
          </SheetSection>
        ) : null}

        {/* ─── ORDER ITEMS ─── */}
        {items.length > 0 ? (
          <SheetSection
            title={t('batches.feedOrderDetail.feedOrder', 'Feed Order')}
            padded={false}
          >
            <FeedItemsTable
              tokens={tokens}
              isRTL={isRTL}
              items={items}
              t={t}
            />
          </SheetSection>
        ) : null}

        {/* ─── AMOUNT BREAKDOWN ─── */}
        <SheetSection title={t('batches.grandTotal', 'Grand Total')} padded={false}>
          <View style={{ padding: 16, gap: 8 }}>
            <KvRow
              tokens={tokens}
              isRTL={isRTL}
              label={t('batches.subtotal', 'Subtotal')}
              value={`${currency} ${fmt(order.subtotal)}`}
              bold
            />
            {hasDelivery ? (
              <KvRow
                tokens={tokens}
                isRTL={isRTL}
                label={t('batches.deliveryCharge', 'Delivery Charge')}
                value={`${currency} ${fmt(order.deliveryCharge)}`}
              />
            ) : null}
            {hasVat ? (
              <KvRow
                tokens={tokens}
                isRTL={isRTL}
                label={t('batches.vat', 'VAT')}
                value={`${currency} ${fmt(order.vatAmount)}`}
              />
            ) : null}
          </View>
          <GrandTotalStrip
            tokens={tokens}
            isRTL={isRTL}
            label={t('batches.grandTotal', 'Grand Total')}
            value={`${currency} ${fmt(grandTotal)}`}
          />
        </SheetSection>

        {/* ─── LINKED EXPENSE ─── */}
        {linkedExpenseId ? (
          <SheetSection
            title={t('batches.expenseDetail.linkedEntity', 'Linked To')}
            icon={Link2}
            padded={false}
          >
            <View style={{ padding: 12 }}>
              <LinkedRow
                tokens={tokens}
                isRTL={isRTL}
                icon={Receipt}
                label={t('batches.feedOrderDetail.viewRelatedExpense', 'View Related Expense')}
                onPress={() => router.push(`/(app)/expense/${linkedExpenseId}`)}
              />
            </View>
          </SheetSection>
        ) : null}

        {/* ─── DETAILS ─── */}
        {(order.orderDate || order.deliveryDate || order.taxInvoiceId) ? (
          <SheetSection title={t('common.date', 'Date')}>
            <View style={{ gap: 10 }}>
              {order.orderDate ? (
                <KvRow
                  tokens={tokens}
                  isRTL={isRTL}
                  label={t('batches.orderDate', 'Order Date')}
                  value={fmtDate(order.orderDate)}
                />
              ) : null}
              {order.deliveryDate ? (
                <KvRow
                  tokens={tokens}
                  isRTL={isRTL}
                  label={t('batches.deliveryDate', 'Delivery Date')}
                  value={fmtDate(order.deliveryDate)}
                />
              ) : null}
              {order.taxInvoiceId ? (
                <KvRow
                  tokens={tokens}
                  isRTL={isRTL}
                  label={t('batches.taxInvoiceId', 'Tax Invoice ID')}
                  value={order.taxInvoiceId}
                />
              ) : null}
            </View>
          </SheetSection>
        ) : null}

        {/* ─── DOCUMENTS ─── */}
        {allDocs.length > 0 ? (
          <SheetSection
            title={t('batches.feedOrderDetail.documents', 'Documents')}
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
          {`${t('batches.feedOrderDetail.createdAt', 'Created')} ${fmtDate(order.createdAt)} · ${t('batches.feedOrderDetail.updatedAt', 'Last Updated')} ${fmtDate(order.updatedAt)}`}
        </Text>

        {/* ─── BOTTOM CTA STRIP ─── */}
        {canEdit ? (
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
              <View style={{ flex: 1 }}>
                <CtaButton
                  variant="secondary"
                  icon={FileText}
                  label={t('batches.feedOrderDetail.viewInvoice', 'View Invoice')}
                  onPress={openInvoiceViewer}
                  isRTL={isRTL}
                  tokens={tokens}
                />
              </View>
            ) : null}
            <View style={{ flex: invoiceMedia ? 1 : undefined, width: invoiceMedia ? undefined : '100%' }}>
              <CtaButton
                variant="primary"
                icon={Pencil}
                label={t('batches.editFeedOrder', 'Edit Feed Order')}
                onPress={openEdit}
                isRTL={isRTL}
                tokens={tokens}
              />
            </View>
          </View>
        ) : null}
      </HeroSheetScreen>

      {/* Doc preview */}
      <FileViewer
        visible={!!viewerDoc}
        media={viewerDoc}
        onClose={() => setViewerDoc(null)}
      />

      {/* Delete confirmation. Feed orders always cascade to their expense
          plus all line items, so the existing deleteFeedOrderWarning is
          always the right copy. */}
      <ConfirmDialog
        open={confirmDeleteOpen}
        onOpenChange={setConfirmDeleteOpen}
        title={t('batches.deleteFeedOrderTitle', 'Delete Feed Order')}
        description={t(
          'batches.deleteFeedOrderWarning',
          'This will permanently delete this feed order, its line items, and the associated expense. This action cannot be undone.'
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

// Translucent white pill in the hero (DL §7 hero toolbar / status pills).
function HeroBadge({ label }) {
  return (
    <View style={heroStyles.badge}>
      <Text style={heroStyles.badgeText} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

// Translucent KPI pill in the hero "data pulse" strip (DL §7.d).
function PulsePill({ icon: Icon, label, value }) {
  return (
    <View style={heroStyles.pulsePill}>
      <View style={heroStyles.pulseTopRow}>
        {Icon ? <Icon size={13} color="#ffffff" strokeWidth={2.4} /> : null}
        <Text style={heroStyles.pulseValue} numberOfLines={1}>
          {value}
        </Text>
      </View>
      <Text style={heroStyles.pulseLabel} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

// Tappable party row (Feed Company). Layout in StyleSheet per DL §9 —
// inner View carries flexDirection, never the Pressable.
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

// Key/value row used inside detail sections.
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

// Flush-bottom green strip inside a section card.
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

// Tappable "Linked to ..." card. Mirrors PartyRow's chrome (elevated
// card surface + accent icon tile + bold label + mirrored chevron) so it
// reads as a sibling of the Feed Company row above. Layout in StyleSheet
// per DL §9.
function LinkedRow({ tokens, isRTL, icon: Icon = Receipt, label, sublabel, onPress }) {
  const {
    elevatedCardBg, elevatedCardBorder, elevatedCardPressedBg, accentColor,
    textColor, mutedColor, dark,
  } = tokens;
  const ForwardArrow = isRTL ? ChevronLeft : ChevronRight;

  return (
    <Pressable
      onPressIn={() => Haptics.selectionAsync().catch(() => {})}
      onPress={onPress}
      android_ripple={{
        color: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
        borderless: false,
      }}
      style={({ pressed }) => [
        linkedRowStyles.card,
        {
          backgroundColor: pressed ? elevatedCardPressedBg : elevatedCardBg,
          borderColor: pressed ? accentColor : elevatedCardBorder,
          transform: [{ scale: pressed ? 0.985 : 1 }],
          opacity: pressed ? 0.96 : 1,
        },
      ]}
    >
      <View style={[linkedRowStyles.row, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        <View
          style={[
            linkedRowStyles.iconTile,
            { backgroundColor: dark ? 'rgba(148,210,165,0.16)' : 'hsl(148, 35%, 92%)' },
          ]}
        >
          <Icon size={18} color={accentColor} strokeWidth={2.2} />
        </View>
        <View style={linkedRowStyles.textCol}>
          <Text
            style={{
              fontSize: 15,
              fontFamily: 'Poppins-SemiBold',
              color: textColor,
              textAlign: isRTL ? 'right' : 'left',
            }}
            numberOfLines={1}
          >
            {label}
          </Text>
          {sublabel ? (
            <Text
              style={{
                fontSize: 12,
                fontFamily: 'Poppins-Regular',
                color: mutedColor,
                marginTop: 2,
                textAlign: isRTL ? 'right' : 'left',
              }}
              numberOfLines={1}
            >
              {sublabel}
            </Text>
          ) : null}
        </View>
        <ForwardArrow size={18} color={mutedColor} strokeWidth={2.2} />
      </View>
    </Pressable>
  );
}

// Mini-table for feed-order line items. Mirrors SaleDetail's MiniTable
// (accent-green header, alternating row tint, hairline dividers) but the
// first column carries a description (bold) plus a muted size sub-label,
// e.g. "AFYA FINISHER" / "50KG".
function FeedItemsTable({ tokens, isRTL, items, t }) {
  const { accentColor, borderColor, textColor, mutedColor, dark } = tokens;
  const altRowBg = dark ? 'rgba(255,255,255,0.025)' : 'hsl(148, 22%, 97%)';

  // Column flex weights.
  const COL_PRODUCT = 1.6;
  const COL_BAGS = 0.8;
  const COL_PRICE = 1;
  const COL_AMOUNT = 1.2;

  return (
    <View>
      {/* Header band */}
      <View
        style={[
          tableStyles.headerRow,
          { backgroundColor: accentColor, flexDirection: isRTL ? 'row-reverse' : 'row' },
        ]}
      >
        <Text
          style={[
            tableStyles.headerCell,
            { flex: COL_PRODUCT, textAlign: isRTL ? 'right' : 'left' },
          ]}
          numberOfLines={1}
        >
          {t('batches.feedOrderDetail.product', 'Product')}
        </Text>
        <Text
          style={[
            tableStyles.headerCell,
            { flex: COL_BAGS, textAlign: 'center' },
          ]}
          numberOfLines={1}
        >
          {t('batches.bags', 'Bags').toUpperCase()}
        </Text>
        <Text
          style={[
            tableStyles.headerCell,
            { flex: COL_PRICE, textAlign: 'center' },
          ]}
          numberOfLines={1}
        >
          {t('batches.feedOrderDetail.price', 'Price')}
        </Text>
        <Text
          style={[
            tableStyles.headerCell,
            { flex: COL_AMOUNT, textAlign: isRTL ? 'left' : 'right' },
          ]}
          numberOfLines={1}
        >
          {t('batches.feedOrderDetail.amount', 'Amount')}
        </Text>
      </View>

      {items.map((item, i) => {
        const desc = item.feedDescription
          || item.feedItem?.feedDescription
          || t(`feed.feedTypes.${item.feedType}`, item.feedType || '—');
        const size = item.quantitySize && item.quantityUnit
          ? `${item.quantitySize}${item.quantityUnit}`
          : '';
        return (
          <View
            key={item._id || i}
            style={[
              tableStyles.row,
              {
                flexDirection: isRTL ? 'row-reverse' : 'row',
                backgroundColor: i % 2 === 1 ? altRowBg : 'transparent',
                borderBottomColor: borderColor,
                borderBottomWidth: i === items.length - 1 ? 0 : StyleSheet.hairlineWidth,
              },
            ]}
          >
            {/* PRODUCT — 2-line cell: bold description + muted size */}
            <View
              style={{
                flex: COL_PRODUCT,
                paddingHorizontal: 4,
                alignItems: isRTL ? 'flex-end' : 'flex-start',
              }}
            >
              <Text
                style={{
                  fontSize: 13,
                  fontFamily: 'Poppins-Medium',
                  color: textColor,
                  textAlign: isRTL ? 'right' : 'left',
                }}
                numberOfLines={1}
              >
                {desc}
              </Text>
              {size ? (
                <Text
                  style={{
                    fontSize: 11,
                    fontFamily: 'Poppins-Regular',
                    color: mutedColor,
                    marginTop: 1,
                    textAlign: isRTL ? 'right' : 'left',
                  }}
                  numberOfLines={1}
                >
                  {size}
                </Text>
              ) : null}
            </View>

            {/* BAGS */}
            <Text
              style={{
                flex: COL_BAGS,
                fontSize: 13,
                fontFamily: 'Poppins-Regular',
                color: mutedColor,
                textAlign: 'center',
                fontVariant: ['tabular-nums'],
                paddingHorizontal: 4,
              }}
              numberOfLines={1}
            >
              {fmtInt(item.bags)}
            </Text>

            {/* PRICE */}
            <Text
              style={{
                flex: COL_PRICE,
                fontSize: 13,
                fontFamily: 'Poppins-Regular',
                color: mutedColor,
                textAlign: 'center',
                fontVariant: ['tabular-nums'],
                paddingHorizontal: 4,
              }}
              numberOfLines={1}
            >
              {fmt(item.pricePerBag)}
            </Text>

            {/* AMOUNT (subtotal) */}
            <Text
              style={{
                flex: COL_AMOUNT,
                fontSize: 13,
                fontFamily: 'Poppins-SemiBold',
                color: textColor,
                textAlign: isRTL ? 'left' : 'right',
                fontVariant: ['tabular-nums'],
                paddingHorizontal: 4,
              }}
              numberOfLines={1}
            >
              {fmt(item.subtotal)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

// Shared CTA button used by both View Invoice (secondary) and Edit
// Feed Order (primary) bottom buttons. STATIC style array on the
// Pressable per DL §9 — functional `style={({pressed}) => [...]}` strips
// layout-bearing props.
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
  iconTile: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
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
  pillsRow: {
    flexWrap: 'wrap',
    gap: 8,
  },
  badge: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  badgeText: {
    fontSize: 11,
    fontFamily: 'Poppins-SemiBold',
    color: '#ffffff',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  pulseRow: {
    gap: 8,
  },
  pulsePill: {
    flex: 1,
    minWidth: 0,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 2,
  },
  pulseTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pulseValue: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Poppins-SemiBold',
    color: '#ffffff',
    fontVariant: ['tabular-nums'],
  },
  pulseLabel: {
    fontSize: 10.5,
    fontFamily: 'Poppins-Medium',
    color: 'rgba(255,255,255,0.78)',
    letterSpacing: 0.4,
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

// Mirrors partyStyles so the linked card and the party card read as
// siblings (same border radius, padding, icon-tile sizing, gap).
const linkedRowStyles = StyleSheet.create({
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

const tableStyles = StyleSheet.create({
  headerRow: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignItems: 'center',
  },
  headerCell: {
    fontSize: 10.5,
    fontFamily: 'Poppins-SemiBold',
    color: '#ffffff',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    paddingHorizontal: 4,
  },
  row: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: 'center',
  },
});

const ctaStyles = StyleSheet.create({
  row: {
    marginTop: 4,
  },
});

// Single source of truth for both CTA buttons (View Invoice + Edit Feed
// Order). Identical height / radius / border / padding so the row is
// guaranteed symmetric.
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
