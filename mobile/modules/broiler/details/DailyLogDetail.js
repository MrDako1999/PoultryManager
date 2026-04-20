import { useState } from 'react';
import {
  View, Text, Pressable, StyleSheet,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import {
  Pencil, Trash2, ChevronRight, ChevronLeft,
  Home, User, Weight,
  Thermometer, Beaker, Gauge,
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

const fmtNum = (val, digits = 2) =>
  Number(val || 0).toLocaleString(NUMERIC_LOCALE, {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  });

const fmtDate = (d) => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString(NUMERIC_LOCALE, {
    day: '2-digit', month: 'short', year: 'numeric',
  });
};

function formatUserName(user) {
  if (!user) return '—';
  if (typeof user === 'object') {
    return `${user.firstName || ''} ${user.lastName || ''}`.trim() || '—';
  }
  return String(user);
}

export default function DailyLogDetail({ logId, onEdit }) {
  const { t } = useTranslation();
  const isRTL = useIsRTL();
  const tokens = useHeroSheetTokens();
  const { toast } = useToast();
  const { can } = useCapabilities();
  const { remove } = useOfflineMutation('dailyLogs');
  const [log, logLoading] = useLocalRecord('dailyLogs', logId);

  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [viewerDoc, setViewerDoc] = useState(null);

  if (logLoading || !log) {
    return (
      <DetailCompactScreen title={t('common.loading', 'Loading...')} headerRight={null}>
        <SkeletonDetailPage />
      </DetailCompactScreen>
    );
  }

  const houseName = typeof log.house === 'object' ? log.house?.name : null;
  const photos = (log.photos || []).filter(Boolean).map((p) => p?.media_id || p);
  const photoMedia = photos.filter((m) => m?.url);

  const canEdit = can('dailyLog:update');
  const canDelete = can('dailyLog:delete');

  const compactTitle = t(`batches.operations.logTypes.${log.logType}`, log.logType);

  const openEdit = () => {
    Haptics.selectionAsync().catch(() => {});
    onEdit?.(log);
  };

  const openDelete = () => {
    Haptics.selectionAsync().catch(() => {});
    setConfirmDeleteOpen(true);
  };

  const handleDelete = async () => {
    if (deleting) return;
    setDeleting(true);
    try {
      await remove(logId);
      toast({ title: t('batches.operations.entryDeleted', 'Entry deleted') });
      setConfirmDeleteOpen(false);
      router.back();
    } catch {
      toast({
        title: t('batches.operations.deleteError', 'Failed to delete entry'),
        variant: 'destructive',
      });
    } finally {
      setDeleting(false);
    }
  };

  // Hero header-right: edit + delete translucent circles. (No view-doc
  // shortcut since photos live in their own scroll section, not as a
  // single primary attachment.)
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

  // Map log type to the existing form-section label so the metrics block
  // header stays in sync with what users see in the Add/Edit sheet.
  const metricsTitle = log.logType === 'WEIGHT'
    ? t('batches.operations.weightMetrics', 'Weight Sample')
    : log.logType === 'ENVIRONMENT'
      ? t('batches.operations.environmentMetrics', 'Environment Readings')
      : t('batches.operations.dailyMetrics', 'Daily Metrics');

  return (
    <>
      <DetailCompactScreen title={compactTitle} headerRight={headerRight}>
        {/* ─── HOUSE ─── */}
        {houseName ? (
          <SheetSection
            title={t('batches.house', 'House')}
            padded={false}
          >
            <View style={{ padding: 12 }}>
              <PartyRow
                tokens={tokens}
                isRTL={isRTL}
                icon={Home}
                name={houseName}
              />
            </View>
          </SheetSection>
        ) : null}

        {/* ─── METRICS (per logType) ─── */}
        <SheetSection title={metricsTitle}>
          <View style={{ gap: 10 }}>
            {log.logType === 'DAILY' ? (
              <>
                <KvRow
                  tokens={tokens}
                  isRTL={isRTL}
                  label={t('batches.operations.deaths', 'Deaths')}
                  value={log.deaths != null
                    ? `${fmtInt(log.deaths)} ${t('batches.operations.deathsUnit', 'birds')}`
                    : '—'}
                />
                <KvRow
                  tokens={tokens}
                  isRTL={isRTL}
                  label={t('batches.operations.feedKg', 'Feed Consumed (kg)')}
                  value={log.feedKg != null ? `${fmtNum(log.feedKg, 2)} kg` : '—'}
                />
                <KvRow
                  tokens={tokens}
                  isRTL={isRTL}
                  label={t('batches.operations.waterLiters', 'Water Consumed (L)')}
                  value={log.waterLiters != null ? `${fmtNum(log.waterLiters, 2)} L` : '—'}
                />
              </>
            ) : null}

            {log.logType === 'WEIGHT' ? (
              <KvRow
                tokens={tokens}
                isRTL={isRTL}
                label={t('batches.operations.averageWeight', 'Average Weight (g)')}
                value={log.averageWeight != null ? `${fmtInt(log.averageWeight)} g` : '—'}
                bold
                highlight
              />
            ) : null}

            {log.logType === 'ENVIRONMENT' ? (
              <>
                <KvRow
                  tokens={tokens}
                  isRTL={isRTL}
                  label={t('batches.operations.temperature', 'Temperature (°C)')}
                  value={log.temperature != null ? `${fmtNum(log.temperature, 1)}°C` : '—'}
                />
                <KvRow
                  tokens={tokens}
                  isRTL={isRTL}
                  label={t('batches.operations.humidity', 'Humidity (%)')}
                  value={log.humidity != null ? `${fmtNum(log.humidity, 0)}%` : '—'}
                />
                <KvRow
                  tokens={tokens}
                  isRTL={isRTL}
                  label={t('batches.operations.waterTDS', 'Water TDS (ppm)')}
                  value={log.waterTDS != null ? `${fmtInt(log.waterTDS)} ppm` : '—'}
                />
                <KvRow
                  tokens={tokens}
                  isRTL={isRTL}
                  label={t('batches.operations.waterPH', 'Water pH')}
                  value={log.waterPH != null ? fmtNum(log.waterPH, 2) : '—'}
                />
              </>
            ) : null}
          </View>
        </SheetSection>

        {/* ─── NOTES ─── */}
        {log.notes ? (
          <SheetSection title={t('batches.operations.notes', 'Notes')}>
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
              {log.notes}
            </Text>
          </SheetSection>
        ) : null}

        {/* ─── PHOTOS ─── */}
        {photoMedia.length > 0 ? (
          <SheetSection
            title={t('batches.operations.photos', 'Photos')}
            padded={false}
          >
            <View style={{ padding: 12, gap: 10 }}>
              {photoMedia.map((media, i) => (
                <DocCard
                  key={`${media._id || i}`}
                  doc={media}
                  label={t('batches.operations.photo', 'Photo')}
                  onPress={() => setViewerDoc(media)}
                />
              ))}
            </View>
          </SheetSection>
        ) : null}

        {/* ─── AUDIT ─── */}
        <SheetSection title={t('batches.operations.audit', 'Audit')} icon={User}>
          <View style={{ gap: 10 }}>
            <KvRow
              tokens={tokens}
              isRTL={isRTL}
              label={t('batches.operations.createdByLabel', 'Created by')}
              value={formatUserName(log.createdBy)}
            />
            {log.updatedBy ? (
              <KvRow
                tokens={tokens}
                isRTL={isRTL}
                label={t('batches.operations.updatedByLabel', 'Last updated by')}
                value={formatUserName(log.updatedBy)}
              />
            ) : null}
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
          {`${t('batches.operations.createdLabel', 'Created')} ${fmtDate(log.createdAt)} · ${t('batches.operations.updatedLabel', 'Last Updated')} ${fmtDate(log.updatedAt)}`}
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
            <View style={{ width: '100%' }}>
              <CtaButton
                variant="primary"
                icon={Pencil}
                label={t('batches.operations.editEntry', 'Edit Entry')}
                onPress={openEdit}
                isRTL={isRTL}
                tokens={tokens}
              />
            </View>
          </View>
        ) : null}
      </DetailCompactScreen>

      {/* Photo preview */}
      <FileViewer
        visible={!!viewerDoc}
        media={viewerDoc}
        onClose={() => setViewerDoc(null)}
      />

      {/* Delete confirmation (replaces the legacy Alert.alert per DL §13). */}
      <ConfirmDialog
        open={confirmDeleteOpen}
        onOpenChange={setConfirmDeleteOpen}
        title={t('batches.operations.deleteTitle', 'Delete Entry')}
        description={t(
          'batches.operations.deleteWarning',
          'This will permanently delete this entry. This action cannot be undone.'
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

// Elevated info card matching the SaleDetail / FeedOrderDetail party row
// chrome (icon tile + label, optional chevron). For the daily log we
// reuse it as a non-tappable House card, but the prop shape mirrors the
// other detail screens so it could become tappable later. Layout in
// StyleSheet per DL §9.
function PartyRow({ tokens, isRTL, icon: Icon = Home, name, caption, onPress }) {
  const {
    elevatedCardBg, elevatedCardBorder, elevatedCardPressedBg, accentColor,
    textColor, mutedColor, dark,
  } = tokens;

  const ForwardArrow = isRTL ? ChevronLeft : ChevronRight;
  const iconTileBg = dark ? 'rgba(148,210,165,0.16)' : 'hsl(148, 35%, 92%)';

  if (!onPress) {
    return (
      <View
        style={[
          partyStyles.card,
          { backgroundColor: elevatedCardBg, borderColor: elevatedCardBorder },
        ]}
      >
        <View style={[partyStyles.row, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
          <View style={[partyStyles.iconTile, { backgroundColor: iconTileBg }]}>
            <Icon size={18} color={accentColor} strokeWidth={2.2} />
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
        <View style={[partyStyles.iconTile, { backgroundColor: iconTileBg }]}>
          <Icon size={18} color={accentColor} strokeWidth={2.2} />
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

// Shared CTA button (only the primary "Edit Entry" variant is wired
// here, but the API mirrors SaleDetail / FeedOrderDetail / ExpenseDetail
// so the row stays drop-in-compatible if a secondary action is added
// later). STATIC style array on the Pressable per DL §9 — functional
// `style={({pressed}) => [...]}` would strip layout-bearing props.
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

const ctaStyles = StyleSheet.create({
  row: {
    marginTop: 4,
  },
});

// Mirrors SaleDetail / FeedOrderDetail / ExpenseDetail so the "Edit Entry"
// CTA is visually identical across detail screens. 56pt height + 16pt
// radius + 1.5pt border are the shared totem.
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
