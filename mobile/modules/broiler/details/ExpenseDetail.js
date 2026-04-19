import { useState } from 'react';
import {
  View, Text, Pressable, StyleSheet,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import {
  Receipt, Pencil, Trash2, ChevronRight, ChevronLeft,
  FileText, Building2, BadgePercent, Link2,
  Egg, Wheat, ShoppingCart,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import HeroSheetScreen, { useHeroSheetTokens } from '@/components/HeroSheetScreen';
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
import { EXPENSE_CATEGORY_ICONS } from '@/lib/constants';

// Western digits everywhere (DL §12.4) — never i18n.language for numerics.
const NUMERIC_LOCALE = 'en-US';

const fmt = (val) =>
  Number(val || 0).toLocaleString(NUMERIC_LOCALE, {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  });

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

export default function ExpenseDetail({ expenseId, onEdit }) {
  const { t } = useTranslation();
  const isRTL = useIsRTL();
  const tokens = useHeroSheetTokens();
  const { toast } = useToast();
  const { can } = useCapabilities();
  const accounting = useSettings('accounting');
  const { remove } = useOfflineMutation('expenses');
  const [expense, expenseLoading] = useLocalRecord('expenses', expenseId);

  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [viewerDoc, setViewerDoc] = useState(null);

  if (expenseLoading || !expense) {
    return (
      <HeroSheetScreen
        title={t('common.loading', 'Loading...')}
        heroExtra={(
          <View style={heroStyles.iconTile}>
            <Receipt size={26} color="#ffffff" strokeWidth={2.2} />
          </View>
        )}
      >
        <SkeletonDetailPage />
      </HeroSheetScreen>
    );
  }

  const currency = accounting?.currency || 'AED';
  const hasVat = (expense.taxableAmount || 0) > 0;
  const totalAmount = expense.totalAmount || 0;

  // Linked source / feed order / sale order — these expenses are
  // auto-generated and should be edited via the parent entity.
  const sourceId = typeof expense.source === 'object' ? expense.source?._id : expense.source;
  const feedOrderId = typeof expense.feedOrder === 'object' ? expense.feedOrder?._id : expense.feedOrder;
  const saleOrderId = typeof expense.saleOrder === 'object' ? expense.saleOrder?._id : expense.saleOrder;
  const isLinked = !!(sourceId || feedOrderId || saleOrderId);

  // Pick the right cascade warning based on which parent owns this expense.
  const deleteWarning = sourceId
    ? t('batches.deleteExpenseSourceWarning',
       'This will permanently delete this expense and its associated source entry. This action cannot be undone.')
    : feedOrderId
      ? t('batches.deleteExpenseFeedOrderWarning',
         'This will permanently delete this expense and its associated feed order with all line items. This action cannot be undone.')
      : saleOrderId
        ? t('batches.deleteExpenseSaleOrderWarning',
           'This will permanently delete this expense and its associated sale order. This action cannot be undone.')
        : t('batches.deleteExpenseWarning',
           'This will permanently delete this expense. This action cannot be undone.');

  const tradingCompanyId = typeof expense.tradingCompany === 'object'
    ? expense.tradingCompany?._id
    : expense.tradingCompany;
  const tradingCompanyName = expense.tradingCompany?.companyName;

  const receipts = (expense.receipts || []).filter(Boolean);
  const transferProofs = (expense.transferProofs || []).filter(Boolean);
  const receiptMedia = receipts[0] || null;
  const allDocs = [
    ...receipts.map((d) => ({ doc: d, label: t('batches.receipt', 'Receipt') })),
    ...transferProofs.map((d) => ({ doc: d, label: t('batches.sourceDetail.transferProof', 'Transfer Proof') })),
  ].filter((g) => g.doc?.url);

  // Linked expenses are read-only here; edits / deletes happen via the
  // parent entity to keep the cascade in sync.
  const canEdit = !isLinked && can('expense:update');
  const canDelete = !isLinked && can('expense:delete');

  const categoryLabel = t(`batches.expenseCategories.${expense.category}`, expense.category);
  const invoiceTypeLabel = t(`batches.invoiceTypes.${expense.invoiceType}`, expense.invoiceType);
  const invoiceTypeIsNone = expense.invoiceType === 'NO_INVOICE';

  // Hero title — prefer the trading company; fall back to description; fall
  // back to the category label so we always have something to show.
  const heroTitle = tradingCompanyName
    || expense.description
    || categoryLabel;
  const heroSubtitleParts = [];
  if (expense.invoiceId) heroSubtitleParts.push(expense.invoiceId);
  heroSubtitleParts.push(fmtDate(expense.expenseDate));
  const heroSubtitle = heroSubtitleParts.join(' · ');

  const CategoryIcon = EXPENSE_CATEGORY_ICONS[expense.category] || Receipt;

  const openEdit = () => {
    Haptics.selectionAsync().catch(() => {});
    onEdit?.(expense);
  };

  const openDelete = () => {
    Haptics.selectionAsync().catch(() => {});
    setConfirmDeleteOpen(true);
  };

  const openReceiptViewer = () => {
    if (!receiptMedia) return;
    Haptics.selectionAsync().catch(() => {});
    setViewerDoc(receiptMedia);
  };

  const handleDelete = async () => {
    if (deleting) return;
    setDeleting(true);
    try {
      await remove(expenseId);
      toast({ title: t('batches.expenseDeleted', 'Expense deleted') });
      setConfirmDeleteOpen(false);
      router.back();
    } catch {
      toast({
        title: t('batches.expenseDeleteError', 'Failed to delete expense'),
        variant: 'destructive',
      });
    } finally {
      setDeleting(false);
    }
  };

  // Hero header-right: view-receipt + edit + delete translucent circles.
  const headerRight = (receiptMedia || canEdit || canDelete) ? (
    <View style={[heroStyles.actionsRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
      {receiptMedia ? (
        <Pressable
          onPress={openReceiptViewer}
          hitSlop={6}
          android_ripple={{ color: 'rgba(255,255,255,0.18)', borderless: true, radius: 20 }}
          style={heroStyles.actionBtn}
          accessibilityRole="button"
          accessibilityLabel={t('batches.expenseDetail.viewReceipt', 'View Receipt')}
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

  // Hero icon tile — category-specific glyph for at-a-glance recognition.
  const heroExtra = (
    <View style={heroStyles.iconTile}>
      <CategoryIcon size={26} color="#ffffff" strokeWidth={2.2} />
    </View>
  );

  // Hero "data pulse" — status pills + 1-2 KPI pills.
  const heroBelow = (
    <View style={{ gap: 14 }}>
      <View style={[heroStyles.pillsRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        <HeroBadge label={categoryLabel} />
        <HeroBadge label={invoiceTypeLabel} />
      </View>
      <View style={[heroStyles.pulseRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        <PulsePill
          icon={Receipt}
          label={t('batches.expenseDetail.totalShort', 'Total')}
          value={`${currency} ${fmtCompact(totalAmount)}`}
        />
        {hasVat ? (
          <PulsePill
            icon={BadgePercent}
            label={t('batches.expenseDetail.vatShort', 'VAT')}
            value={`${currency} ${fmtCompact(expense.taxableAmount)}`}
          />
        ) : null}
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
        {/* ─── TRADING COMPANY ─── */}
        {tradingCompanyName ? (
          <SheetSection
            title={t('batches.tradingCompany', 'Trading Company')}
            padded={false}
          >
            <View style={{ padding: 12 }}>
              <PartyRow
                tokens={tokens}
                isRTL={isRTL}
                name={tradingCompanyName}
                onPress={tradingCompanyId
                  ? () => router.push(`/(app)/business/${tradingCompanyId}`)
                  : null}
              />
            </View>
          </SheetSection>
        ) : null}

        {/* ─── INVOICE INFO ─── */}
        {(expense.invoiceId || !invoiceTypeIsNone) ? (
          <SheetSection title={t('batches.invoice', 'Invoice')}>
            <View style={{ gap: 10 }}>
              {expense.invoiceId ? (
                <KvRow
                  tokens={tokens}
                  isRTL={isRTL}
                  label={t('batches.invoiceIdLabel', 'Invoice ID')}
                  value={expense.invoiceId}
                />
              ) : null}
              <KvRow
                tokens={tokens}
                isRTL={isRTL}
                label={t('batches.invoiceType', 'Invoice Type')}
                value={invoiceTypeLabel}
              />
            </View>
          </SheetSection>
        ) : null}

        {/* ─── AMOUNT BREAKDOWN ─── */}
        <SheetSection title={t('batches.totalAmount', 'Total Amount')} padded={false}>
          <View style={{ padding: 16, gap: 8 }}>
            <KvRow
              tokens={tokens}
              isRTL={isRTL}
              label={t('batches.grossAmount', 'Gross Amount')}
              value={`${currency} ${fmt(expense.grossAmount)}`}
              bold
            />
            {hasVat ? (
              <KvRow
                tokens={tokens}
                isRTL={isRTL}
                label={t('batches.taxableAmount', 'VAT Amount')}
                value={`${currency} ${fmt(expense.taxableAmount)}`}
              />
            ) : null}
          </View>
          <GrandTotalStrip
            tokens={tokens}
            isRTL={isRTL}
            label={t('batches.totalAmount', 'Total Amount')}
            value={`${currency} ${fmt(totalAmount)}`}
          />
        </SheetSection>

        {/* ─── LINKED TO ─── */}
        {isLinked ? (
          <SheetSection
            title={t('batches.expenseDetail.linkedEntity', 'Linked To')}
            icon={Link2}
            padded={false}
          >
            {/* Stacked elevated cards (gap: 10) so each linked parent reads
                as a sibling of the Trading Company card above. The icon
                per row echoes the parent entity's hero icon (Egg / Wheat
                / ShoppingCart) for instant recognition. */}
            <View style={{ padding: 12, gap: 10 }}>
              {sourceId ? (
                <LinkedRow
                  tokens={tokens}
                  isRTL={isRTL}
                  icon={Egg}
                  label={t('batches.linkedToSource', 'Linked to Source')}
                  onPress={() => router.push(`/(app)/source/${sourceId}`)}
                />
              ) : null}
              {feedOrderId ? (
                <LinkedRow
                  tokens={tokens}
                  isRTL={isRTL}
                  icon={Wheat}
                  label={t('batches.linkedToFeedOrder', 'Linked to Feed Order')}
                  onPress={() => router.push(`/(app)/feed-order/${feedOrderId}`)}
                />
              ) : null}
              {saleOrderId ? (
                <LinkedRow
                  tokens={tokens}
                  isRTL={isRTL}
                  icon={ShoppingCart}
                  label={t('batches.linkedToSaleOrder', 'Linked to Sale Order')}
                  onPress={() => router.push(`/(app)/sale/${saleOrderId}`)}
                />
              ) : null}
            </View>
          </SheetSection>
        ) : null}

        {/* ─── DETAILS (date) ─── */}
        <SheetSection title={t('common.date', 'Date')}>
          <KvRow
            tokens={tokens}
            isRTL={isRTL}
            label={t('batches.expenseDate', 'Expense Date')}
            value={fmtDate(expense.expenseDate)}
          />
        </SheetSection>

        {/* ─── NOTES ─── */}
        {expense.description ? (
          <SheetSection title={t('batches.expenseDescription', 'Description')}>
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
              {expense.description}
            </Text>
          </SheetSection>
        ) : null}

        {/* ─── DOCUMENTS ─── */}
        {allDocs.length > 0 ? (
          <SheetSection
            title={t('batches.expenseDetail.documents', 'Documents')}
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
          {`${t('batches.expenseDetail.createdAt', 'Created')} ${fmtDate(expense.createdAt)} · ${t('batches.expenseDetail.updatedAt', 'Last Updated')} ${fmtDate(expense.updatedAt)}`}
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
            {receiptMedia ? (
              <View style={{ flex: 1 }}>
                <CtaButton
                  variant="secondary"
                  icon={FileText}
                  label={t('batches.expenseDetail.viewReceipt', 'View Receipt')}
                  onPress={openReceiptViewer}
                  isRTL={isRTL}
                  tokens={tokens}
                />
              </View>
            ) : null}
            <View style={{ flex: receiptMedia ? 1 : undefined, width: receiptMedia ? undefined : '100%' }}>
              <CtaButton
                variant="primary"
                icon={Pencil}
                label={t('batches.editExpense', 'Edit Expense')}
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

      {/* Delete confirmation (replaces the legacy Alert.alert per DL §13). */}
      <ConfirmDialog
        open={confirmDeleteOpen}
        onOpenChange={setConfirmDeleteOpen}
        title={t('batches.deleteExpenseTitle', 'Delete Expense')}
        description={deleteWarning}
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

// Tappable party row (Trading Company). Layout in StyleSheet per DL §9 —
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

// Tappable "Linked to ..." card. Mirrors PartyRow's chrome (elevated
// card surface + accent icon tile + bold label + mirrored chevron) so
// each linked-parent card reads as a sibling of the Trading Company row
// above. The `icon` prop lets each row echo the parent entity's hero
// icon (Egg for source, Wheat for feed order, ShoppingCart for sale).
// Layout in StyleSheet per DL §9.
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

// Shared CTA button used by both View Receipt (secondary) and Edit
// Expense (primary) bottom buttons. STATIC style array on the Pressable
// per DL §9 — functional `style={({pressed}) => [...]}` strips layout.
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

const ctaStyles = StyleSheet.create({
  row: {
    marginTop: 4,
  },
});

// Single source of truth for both CTA buttons (View Receipt + Edit
// Expense). Identical height / radius / border / padding so the row is
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
