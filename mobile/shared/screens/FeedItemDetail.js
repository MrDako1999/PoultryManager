import { useState } from 'react';
import {
  View, Text, Pressable, StyleSheet,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useLocalSearchParams, router } from 'expo-router';
import {
  Receipt, Pencil, Trash2, ChevronRight, ChevronLeft,
  Building2, Wheat, Tag,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import HeroSheetScreen, { useHeroSheetTokens } from '@/components/HeroSheetScreen';
import SheetSection from '@/components/SheetSection';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';
import useLocalRecord from '@/hooks/useLocalRecord';
import useSettings from '@/hooks/useSettings';
import useOfflineMutation from '@/hooks/useOfflineMutation';
import useCapabilities from '@/hooks/useCapabilities';
import { useIsRTL } from '@/stores/localeStore';
import { SkeletonDetailPage } from '@/components/skeletons';
import FeedItemSheet from '@/shared/sheets/FeedItemSheet';
import { FEED_TYPE_ICONS } from '@/lib/constants';

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

export default function FeedItemScreen() {
  const { id } = useLocalSearchParams();
  const { t } = useTranslation();
  const isRTL = useIsRTL();
  const tokens = useHeroSheetTokens();
  const { toast } = useToast();
  const { can } = useCapabilities();
  const accounting = useSettings('accounting');
  const currency = accounting?.currency || 'AED';
  const vatRate = accounting?.vatRate ?? 5;

  const { remove } = useOfflineMutation('feedItems');
  const [item, itemLoading] = useLocalRecord('feedItems', id);

  const [editOpen, setEditOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (itemLoading || !item) {
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

  const FeedTypeIcon = FEED_TYPE_ICONS[item.feedType] || Wheat;
  const isInactive = item.isActive === false;

  // Money-side derivation. The catalogue stores `pricePerQty` (subtotal),
  // and `vatAmount` / `grandTotal` are also persisted by the editor — but
  // recompute defensively in case an older record predates that schema.
  const pricePerUnit = item.pricePerQty || item.subtotal || 0;
  const vatAmount = item.vatAmount != null
    ? item.vatAmount
    : pricePerUnit * (vatRate / 100);
  const totalPerUnit = item.grandTotal != null
    ? item.grandTotal
    : pricePerUnit + vatAmount;

  const companyId = typeof item.feedCompany === 'object'
    ? item.feedCompany?._id
    : item.feedCompany;
  const companyName = item.feedCompany?.companyName
    || t('feed.unknownCompany', 'Unknown Company');

  const sizeStr = item.quantitySize && item.quantityUnit
    ? `${fmtInt(item.quantitySize)} ${item.quantityUnit}`
    : '';

  const canEdit = can('feedItem:update');
  const canDelete = can('feedItem:delete');

  const heroTitle = item.feedDescription || t('feed.unknownCompany', 'Feed Item');
  const heroSubtitleParts = [];
  if (companyName) heroSubtitleParts.push(companyName);
  if (sizeStr) heroSubtitleParts.push(sizeStr);
  const heroSubtitle = heroSubtitleParts.join(' · ');

  const openEdit = () => {
    Haptics.selectionAsync().catch(() => {});
    setEditOpen(true);
  };

  const openDelete = () => {
    Haptics.selectionAsync().catch(() => {});
    setConfirmDeleteOpen(true);
  };

  const handleDelete = async () => {
    if (!item?._id || deleting) return;
    setDeleting(true);
    try {
      await remove(item._id);
      toast({ title: t('feed.feedItemDeleted', 'Feed item deleted') });
      setConfirmDeleteOpen(false);
      router.back();
    } catch (e) {
      console.error('[FeedItemDetail] delete failed', e);
      toast({
        title: t('feed.deleteError', 'Failed to delete feed item'),
        variant: 'destructive',
      });
    } finally {
      setDeleting(false);
    }
  };

  const headerRight = (canEdit || canDelete) ? (
    <View style={[heroStyles.actionsRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
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

  // Hero icon tile — feed-type-specific glyph for at-a-glance recognition.
  const heroExtra = (
    <View style={heroStyles.iconTile}>
      <FeedTypeIcon size={26} color="#ffffff" strokeWidth={2.2} />
    </View>
  );

  // Hero "data pulse" — feed-type / status pills + 2 KPI pills.
  const heroBelow = (
    <View style={{ gap: 14 }}>
      <View style={[heroStyles.pillsRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        <HeroBadge label={t(`feed.feedTypes.${item.feedType}`, item.feedType || '')} />
        <HeroBadge
          label={isInactive
            ? t('feed.inactiveLabel', 'Inactive')
            : t('feed.activeLabel', 'Active')}
        />
      </View>
      <View style={[heroStyles.pulseRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        <PulsePill
          icon={Tag}
          label={t('feed.feedItemDetail.priceShort', 'Price')}
          value={`${currency} ${fmtCompact(pricePerUnit)}`}
        />
        <PulsePill
          icon={Receipt}
          label={t('feed.feedItemDetail.totalShort', 'Total')}
          value={`${currency} ${fmtCompact(totalPerUnit)}`}
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
            title={t('feed.feedCompany', 'Feed Company')}
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

        {/* ─── PRICING ─── */}
        <SheetSection
          title={t('feed.pricingSection', 'Pricing')}
          padded={false}
        >
          <View style={{ padding: 16, gap: 8 }}>
            <KvRow
              tokens={tokens}
              isRTL={isRTL}
              label={t('feed.subtotal', 'Price per unit')}
              value={`${currency} ${fmt(pricePerUnit)}`}
              bold
            />
            <KvRow
              tokens={tokens}
              isRTL={isRTL}
              label={`${t('feed.vat', 'VAT')} (${fmtInt(vatRate)}%)`}
              value={`${currency} ${fmt(vatAmount)}`}
            />
          </View>
          <GrandTotalStrip
            tokens={tokens}
            isRTL={isRTL}
            label={t('feed.totalPerUnit', 'Total per unit')}
            value={`${currency} ${fmt(totalPerUnit)}`}
          />
        </SheetSection>

        {/* ─── SPECIFICATIONS ─── */}
        <SheetSection title={t('feed.feedItemDetail.specifications', 'Specifications')}>
          <View style={{ gap: 10 }}>
            <KvRow
              tokens={tokens}
              isRTL={isRTL}
              label={t('feed.feedType', 'Feed Type')}
              value={t(`feed.feedTypes.${item.feedType}`, item.feedType || '—')}
            />
            {sizeStr ? (
              <KvRow
                tokens={tokens}
                isRTL={isRTL}
                label={t('feed.feedItemDetail.feedSize', 'Bag Size')}
                value={sizeStr}
              />
            ) : null}
            <KvRow
              tokens={tokens}
              isRTL={isRTL}
              label={t('feed.feedItemDetail.status', 'Status')}
              value={isInactive
                ? t('feed.inactiveLabel', 'Inactive')
                : t('feed.activeLabel', 'Active')}
              highlight={!isInactive}
            />
          </View>
        </SheetSection>

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
          {`${t('common.created', 'Created')} ${fmtDate(item.createdAt)} · ${t('batches.feedOrderDetail.updatedAt', 'Last Updated')} ${fmtDate(item.updatedAt)}`}
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
            <View style={{ flex: 1 }}>
              <CtaButton
                variant="primary"
                icon={Pencil}
                label={t('feed.editFeedItem', 'Edit Feed Item')}
                onPress={openEdit}
                isRTL={isRTL}
                tokens={tokens}
              />
            </View>
          </View>
        ) : null}
      </HeroSheetScreen>

      <FeedItemSheet
        open={editOpen}
        onClose={() => setEditOpen(false)}
        editData={item}
        canDelete={canDelete}
        onDelete={canDelete ? () => setConfirmDeleteOpen(true) : undefined}
      />

      <ConfirmDialog
        open={confirmDeleteOpen}
        onOpenChange={setConfirmDeleteOpen}
        title={t('feed.deleteFeedItemTitle', 'Delete Feed Item')}
        description={t(
          'feed.deleteFeedItemWarning',
          'This will permanently delete this feed item and cannot be undone.'
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

function HeroBadge({ label }) {
  return (
    <View style={heroStyles.badge}>
      <Text style={heroStyles.badgeText} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

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

const ctaStyles = StyleSheet.create({
  row: {
    marginTop: 4,
  },
});

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
