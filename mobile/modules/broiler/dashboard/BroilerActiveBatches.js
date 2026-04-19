import { useState, useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Layers, Skull, Wheat, Calendar, Warehouse, Bird, Home } from 'lucide-react-native';
import useLocalQuery from '@/hooks/useLocalQuery';
import useCapabilities from '@/hooks/useCapabilities';
import EmptyState from '@/components/ui/EmptyState';
import BatchSheet from '@/modules/broiler/sheets/BatchSheet';
import BatchAvatar from '@/modules/broiler/components/BatchAvatar';
import { getStatusConfig } from '@/modules/broiler/lib/batchStatusConfig';
import { SkeletonDashboardBatchCard } from '@/components/skeletons';
import SheetSection from '@/components/SheetSection';
import { useHeroSheetTokens } from '@/components/HeroSheetScreen';
import { useIsRTL } from '@/stores/localeStore';

const CYCLE_TARGET_DAYS = 35;

const IN_PROGRESS_STATUS = getStatusConfig('IN_PROGRESS');

const fmtInt = (val) => Number(val || 0).toLocaleString();

const fmtCompactKg = (val) => {
  const n = Number(val || 0);
  if (n >= 1000) return `${(n / 1000).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}t`;
  return `${fmtInt(n)} kg`;
};

function mortalityToneColor(pct, tokens) {
  if (pct >= 5) return tokens.errorColor;
  if (pct >= 2) return tokens.dark ? '#fbbf24' : '#d97706';
  return tokens.accentColor;
}

function StatCell({ icon: Icon, label, value, valueColor, isRTL }) {
  const { mutedColor, textColor } = useHeroSheetTokens();
  return (
    <View style={cardStyles.statCell}>
      <View style={[cardStyles.statLabelRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        {Icon && <Icon size={11} color={mutedColor} strokeWidth={2.4} />}
        <Text
          style={{
            fontSize: 10,
            fontFamily: 'Poppins-SemiBold',
            color: mutedColor,
            letterSpacing: 0.8,
            textTransform: 'uppercase',
          }}
          numberOfLines={1}
        >
          {label}
        </Text>
      </View>
      <Text
        style={{
          fontSize: 13,
          fontFamily: 'Poppins-SemiBold',
          color: valueColor || textColor,
          textAlign: isRTL ? 'right' : 'left',
        }}
        numberOfLines={1}
      >
        {value}
      </Text>
    </View>
  );
}

function StatDivider() {
  const { borderColor } = useHeroSheetTokens();
  return <View style={[cardStyles.statDivider, { backgroundColor: borderColor }]} />;
}

export default function BroilerActiveBatches() {
  const { t } = useTranslation();
  const tokens = useHeroSheetTokens();
  const {
    mutedColor, textColor, accentColor, borderColor, dark,
    elevatedCardBg, elevatedCardBorder, elevatedCardPressedBg,
  } = tokens;
  const isRTL = useIsRTL();
  const { can } = useCapabilities();
  const canCreate = can('batch:create');
  const [batchSheet, setBatchSheet] = useState({ open: false, data: null });

  const [batches, batchesLoading] = useLocalQuery('batches');
  const [dailyLogs] = useLocalQuery('dailyLogs');

  const activeBatches = useMemo(
    () => batches.filter((b) => b.status === 'IN_PROGRESS'),
    [batches]
  );

  const batchCards = useMemo(() => {
    const activeBatchIds = new Set(activeBatches.map((b) => b._id));
    const deathsByBatch = {};
    const feedByBatch = {};

    dailyLogs.forEach((log) => {
      if (log.deletedAt || log.logType !== 'DAILY') return;
      const batchId = typeof log.batch === 'object' ? log.batch?._id : log.batch;
      if (!activeBatchIds.has(batchId)) return;
      if (log.deaths) deathsByBatch[batchId] = (deathsByBatch[batchId] || 0) + log.deaths;
      if (log.feedKg) feedByBatch[batchId] = (feedByBatch[batchId] || 0) + log.feedKg;
    });

    return activeBatches
      .map((b) => {
        const initial = (b.houses || []).reduce((s, h) => s + (h.quantity || 0), 0);
        const deaths = deathsByBatch[b._id] || 0;
        const remaining = Math.max(0, initial - deaths);
        const mortalityPct = initial > 0 ? (deaths / initial) * 100 : 0;
        const feed = feedByBatch[b._id] || 0;
        const dayCount = b.startDate
          ? Math.max(0, Math.floor((Date.now() - new Date(b.startDate)) / 86400000))
          : 0;
        const cycleProgressPct = Math.min(100, (dayCount / CYCLE_TARGET_DAYS) * 100);
        const houseCount = (b.houses || []).length;
        const farm = b.farm;
        const avatarLetter = (farm?.nickname || farm?.farmName || b.batchName || '?')[0].toUpperCase();
        const batchNum = b.sequenceNumber ?? '';
        return {
          _id: b._id,
          batchName: b.batchName,
          farmName: farm?.farmName || farm?.nickname || '',
          avatarLetter,
          batchNum,
          dayCount,
          cycleProgressPct,
          initial,
          remaining,
          mortalityPct,
          feed,
          houseCount,
        };
      })
      .sort((a, b) => b.mortalityPct - a.mortalityPct);
  }, [activeBatches, dailyLogs]);

  if (batchesLoading) {
    return (
      <SheetSection title={t('dashboard.activeBatchesTitle', 'Active Batches')}>
        <View style={{ gap: 8 }}>
          <SkeletonDashboardBatchCard />
          <SkeletonDashboardBatchCard />
        </View>
      </SheetSection>
    );
  }

  if (batchCards.length === 0) {
    return (
      <SheetSection title={t('dashboard.activeBatchesTitle', 'Active Batches')}>
        <EmptyState
          icon={Layers}
          title={t('dashboard.noActiveBatches', 'No active batches')}
          description={t('dashboard.noActiveBatchesDesc')}
          actionLabel={canCreate ? t('dashboard.createFirstBatch') : undefined}
          onAction={canCreate ? () => setBatchSheet({ open: true, data: null }) : undefined}
        />
        <BatchSheet
          open={batchSheet.open}
          onClose={() => setBatchSheet({ open: false, data: null })}
          editData={batchSheet.data}
        />
      </SheetSection>
    );
  }

  return (
    <>
      <SheetSection
        title={t('dashboard.activeBatchesTitle', 'Active Batches')}
        padded={false}
      >
        <View style={cardStyles.list}>
          {batchCards.map((b) => (
            <BatchCard
              key={b._id}
              card={b}
              isRTL={isRTL}
              tokens={{
                mutedColor, textColor, accentColor, borderColor, dark,
                elevatedCardBg, elevatedCardBorder, elevatedCardPressedBg,
              }}
              t={t}
              onPress={() => router.push(`/(app)/batch/${b._id}`)}
              mortalityColor={mortalityToneColor(b.mortalityPct, tokens)}
            />
          ))}
        </View>
      </SheetSection>

      <BatchSheet
        open={batchSheet.open}
        onClose={() => setBatchSheet({ open: false, data: null })}
        editData={batchSheet.data}
      />
    </>
  );
}

/**
 * Single batch card. Layout lives in `StyleSheet.create` and on plain inner
 * Views; the Pressable's functional style is reserved for the press-state
 * visual deltas only (background, border colour, scale, opacity). This is
 * the §9 "card press recipe" + the NativeWind trap rule from the design doc.
 */
function BatchCard({ card: b, isRTL, tokens, t, onPress, mortalityColor }) {
  const { mutedColor, textColor, accentColor, borderColor, dark, elevatedCardBg, elevatedCardBorder, elevatedCardPressedBg } = tokens;

  return (
    <Pressable
      onPressIn={() => Haptics.selectionAsync().catch(() => {})}
      onPress={onPress}
      android_ripple={{
        color: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
        borderless: false,
      }}
      style={({ pressed }) => [
        cardStyles.card,
        {
          backgroundColor: pressed ? elevatedCardPressedBg : elevatedCardBg,
          borderColor: pressed ? accentColor : elevatedCardBorder,
          transform: [{ scale: pressed ? 0.985 : 1 }],
          opacity: pressed ? 0.95 : 1,
          ...(dark
            ? {}
            : {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: pressed ? 0.04 : 0.07,
                shadowRadius: pressed ? 6 : 10,
                elevation: pressed ? 1 : 2,
              }),
        },
      ]}
    >
      {/* Header row: avatar + batch name + farm/birds */}
      <View style={[cardStyles.headerRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        <BatchAvatar
          letter={b.avatarLetter}
          sequence={b.batchNum}
          status={IN_PROGRESS_STATUS}
          size={40}
        />
        <View style={cardStyles.headerTextCol}>
          <Text
            style={{
              fontSize: 15,
              fontFamily: 'Poppins-SemiBold',
              color: textColor,
              letterSpacing: -0.1,
              textAlign: isRTL ? 'right' : 'left',
            }}
            numberOfLines={1}
          >
            {b.batchName}
          </Text>
          <View
            style={[
              cardStyles.metaRow,
              { flexDirection: isRTL ? 'row-reverse' : 'row' },
            ]}
          >
            {!!b.farmName && (
              <View style={[cardStyles.metaPiece, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                <Warehouse size={11} color={mutedColor} strokeWidth={2.2} />
                <Text
                  style={{ fontSize: 12, fontFamily: 'Poppins-Regular', color: mutedColor }}
                  numberOfLines={1}
                >
                  {b.farmName}
                </Text>
              </View>
            )}
            {b.initial > 0 && (
              <>
                {!!b.farmName && (
                  <Text style={{ fontSize: 12, color: mutedColor }}>·</Text>
                )}
                <View style={[cardStyles.metaPiece, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                  <Bird size={11} color={mutedColor} strokeWidth={2.2} />
                  <Text style={{ fontSize: 12, fontFamily: 'Poppins-Regular', color: mutedColor }}>
                    {fmtInt(b.remaining)}
                  </Text>
                </View>
              </>
            )}
          </View>
        </View>
      </View>

      {/* Day-of-target progress */}
      <View style={[cardStyles.progressLabelRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        <View style={[cardStyles.progressLabelLeft, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
          <Calendar size={11} color={mutedColor} strokeWidth={2.4} />
          <Text
            style={{
              fontSize: 10,
              fontFamily: 'Poppins-SemiBold',
              color: mutedColor,
              letterSpacing: 0.8,
              textTransform: 'uppercase',
            }}
          >
            {t('dashboard.dayOfTarget', 'Day {{day}} of {{target}}', {
              day: b.dayCount,
              target: CYCLE_TARGET_DAYS,
            })}
          </Text>
        </View>
        <Text
          style={{
            fontSize: 11,
            fontFamily: 'Poppins-SemiBold',
            color: mutedColor,
          }}
        >
          {Math.round(b.cycleProgressPct)}%
        </Text>
      </View>

      <View
        style={[
          cardStyles.progressBarTrack,
          { backgroundColor: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)' },
        ]}
      >
        <View
          style={[
            cardStyles.progressBarFill,
            { backgroundColor: accentColor, width: `${b.cycleProgressPct}%` },
          ]}
        />
      </View>

      {/* Stats row */}
      <View
        style={[
          cardStyles.statsRow,
          {
            flexDirection: isRTL ? 'row-reverse' : 'row',
            borderTopColor: borderColor,
          },
        ]}
      >
        <StatCell
          icon={Skull}
          label={t('dashboard.mortality', 'Mortality')}
          value={`${b.mortalityPct.toFixed(2)}%`}
          valueColor={mortalityColor}
          isRTL={isRTL}
        />
        <StatDivider />
        <StatCell
          icon={Wheat}
          label={t('dashboard.feedConsumed', 'Feed')}
          value={fmtCompactKg(b.feed)}
          isRTL={isRTL}
        />
        <StatDivider />
        <StatCell
          icon={Home}
          label={t('dashboard.totalHouses', 'Houses')}
          value={fmtInt(b.houseCount)}
          isRTL={isRTL}
        />
      </View>
    </Pressable>
  );
}

const cardStyles = StyleSheet.create({
  list: {
    padding: 8,
    gap: 14,
  },
  card: {
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  headerRow: {
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 14,
  },
  headerTextCol: {
    flex: 1,
    minWidth: 0,
  },
  metaRow: {
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 2,
  },
  metaPiece: {
    alignItems: 'center',
    gap: 4,
  },
  progressLabelRow: {
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  progressLabelLeft: {
    alignItems: 'center',
    gap: 4,
  },
  progressBarTrack: {
    height: 5,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 14,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  statsRow: {
    paddingTop: 12,
    borderTopWidth: 1,
  },
  statCell: {
    flex: 1,
    alignItems: 'flex-start',
  },
  statLabelRow: {
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  statDivider: {
    width: 1,
    marginHorizontal: 8,
  },
});
