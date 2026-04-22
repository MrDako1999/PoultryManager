import { useState, useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Layers, Calendar, Bird } from 'lucide-react-native';
import useLocalQuery from '@/hooks/useLocalQuery';
import useCapabilities from '@/hooks/useCapabilities';
import EmptyState from '@/components/ui/EmptyState';
import BatchSheet from '@/modules/broiler/sheets/BatchSheet';
import BatchAvatar from '@/modules/broiler/components/BatchAvatar';
import { getStatusConfig } from '@/modules/broiler/lib/batchStatusConfig';
import { mortalityToneColor } from '@/modules/broiler/components/BatchKpiCard';
import { SkeletonDashboardBatchCard } from '@/components/skeletons';
import SheetSection from '@/components/SheetSection';
import { useHeroSheetTokens } from '@/components/HeroSheetScreen';
import { useIsRTL } from '@/stores/localeStore';
import { rowDirection, textAlignStart } from '@/lib/rtl';

const CYCLE_TARGET_DAYS = 35;

const IN_PROGRESS_STATUS = getStatusConfig('IN_PROGRESS');

const fmtInt = (val) => Number(val || 0).toLocaleString();

export default function BroilerActiveBatches() {
  const { t } = useTranslation();
  const tokens = useHeroSheetTokens();
  const {
    mutedColor, textColor, accentColor, dark,
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

    dailyLogs.forEach((log) => {
      if (log.deletedAt || log.logType !== 'DAILY') return;
      const batchId = typeof log.batch === 'object' ? log.batch?._id : log.batch;
      if (!activeBatchIds.has(batchId)) return;
      if (log.deaths) deathsByBatch[batchId] = (deathsByBatch[batchId] || 0) + log.deaths;
    });

    return activeBatches
      .map((b) => {
        const initial = (b.houses || []).reduce((s, h) => s + (h.quantity || 0), 0);
        const deaths = deathsByBatch[b._id] || 0;
        const remaining = Math.max(0, initial - deaths);
        const mortalityPct = initial > 0 ? (deaths / initial) * 100 : 0;
        const dayCount = b.startDate
          ? Math.max(0, Math.floor((Date.now() - new Date(b.startDate)) / 86400000))
          : 0;
        const cycleProgressPct = Math.min(100, (dayCount / CYCLE_TARGET_DAYS) * 100);
        const farm = b.farm;
        const avatarLetter = (farm?.nickname || farm?.farmName || b.batchName || '?')[0].toUpperCase();
        const batchNum = b.sequenceNumber ?? '';
        return {
          _id: b._id,
          batchName: b.batchName,
          avatarLetter,
          batchNum,
          dayCount,
          cycleProgressPct,
          initial,
          remaining,
          deaths,
          mortalityPct,
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
          {batchCards.map((b, idx) => (
            <View key={b._id}>
              {/* 2pt rounded divider in the gap between cards. Uses the
                  `elevatedCardBorder` token (the strongest border tone in
                  the palette — same one the card outlines use, sized up
                  here so it reads clearly against the white section bg).
                  Skipped above the first card so the section's top edge
                  stays clean. */}
              {idx > 0 ? (
                <View
                  style={[
                    cardStyles.cardSeparator,
                    { backgroundColor: elevatedCardBorder },
                  ]}
                />
              ) : null}
              <BatchCard
                card={b}
                isRTL={isRTL}
                tokens={{
                  mutedColor, textColor, accentColor, dark,
                  elevatedCardBg, elevatedCardBorder, elevatedCardPressedBg,
                }}
                t={t}
                onPress={() => router.push(`/(app)/batch/${b._id}`)}
              />
            </View>
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
function BatchCard({ card: b, isRTL, tokens, t, onPress }) {
  const {
    mutedColor, textColor, accentColor, dark,
    elevatedCardBg, elevatedCardBorder, elevatedCardPressedBg,
  } = tokens;
  // Mortality tone (green / amber / red as deaths climb) — pulled from
  // the shared helper so the dashboard cards colour mortality the exact
  // same way the BatchesList rows do.
  const mortalityColor = mortalityToneColor(b.mortalityPct, tokens);

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
      <View style={[cardStyles.headerRow, { flexDirection: rowDirection(isRTL) }]}>
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
              textAlign: textAlignStart(isRTL),
            }}
            numberOfLines={1}
          >
            {b.batchName}
          </Text>
          {/* Health summary — mirrors the BatchesList row: bird icon +
              remaining count + (-deaths) when there have been losses,
              separator dot, then mortality %. The deaths and the
              percentage both pick up `mortalityColor` so the
              "needs-attention" signal carries through visually. */}
          {b.initial > 0 ? (
            <View
              style={[
                cardStyles.metaRow,
                { flexDirection: rowDirection(isRTL) },
              ]}
            >
              <View style={[cardStyles.metaPiece, { flexDirection: rowDirection(isRTL) }]}>
                <Bird size={11} color={mutedColor} strokeWidth={2.2} />
                <Text style={{ fontSize: 12, fontFamily: 'Poppins-Regular', color: mutedColor }}>
                  {fmtInt(b.remaining)}
                </Text>
                {b.deaths > 0 ? (
                  <Text
                    style={{
                      fontSize: 12,
                      fontFamily: 'Poppins-SemiBold',
                      color: mortalityColor,
                    }}
                  >
                    {`(-${fmtInt(b.deaths)})`}
                  </Text>
                ) : null}
              </View>
              <Text style={{ fontSize: 12, color: mutedColor }}>·</Text>
              <Text
                style={{
                  fontSize: 12,
                  fontFamily: 'Poppins-SemiBold',
                  color: mortalityColor,
                }}
              >
                {`${b.mortalityPct.toFixed(2)}%`}
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      {/* Day-of-target progress */}
      <View style={[cardStyles.progressLabelRow, { flexDirection: rowDirection(isRTL) }]}>
        <View style={[cardStyles.progressLabelLeft, { flexDirection: rowDirection(isRTL) }]}>
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
            {t('dashboard.dayN', 'Day {{n}}', { n: b.dayCount })}
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
    </Pressable>
  );
}

const cardStyles = StyleSheet.create({
  list: {
    padding: 8,
    // No `gap` — vertical breathing room between cards is owned by
    // `cardSeparator`'s `marginVertical` so the divider can sit
    // visually centred in the inter-card space.
  },
  cardSeparator: {
    height: 2,
    borderRadius: 1,
    marginVertical: 12,
    marginHorizontal: 4,
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
    // Keep DAY row visually tied to the header; 14 felt like a full extra line of air.
    marginBottom: 8,
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
    // The progress bar is now the last element in the card; the card's
    // own 14pt padding handles the trailing space, no extra margin needed.
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
});
