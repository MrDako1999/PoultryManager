import { useEffect, useMemo, useState } from 'react';
import {
  View, Text, Pressable, StyleSheet, Dimensions,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import {
  Pencil, Trash2, ChevronRight, ChevronLeft,
  Home, User, Weight,
  Thermometer, Calendar,
  Heart, Skull, Wheat, Droplets, TrendingUp,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, withTiming, runOnJS, Easing,
} from 'react-native-reanimated';
import { useHeroSheetTokens } from '@/components/HeroSheetScreen';
import DetailCompactScreen from '@/components/DetailCompactScreen';
import SheetSection from '@/components/SheetSection';
import FileViewer from '@/components/FileViewer';
import DocCard from '@/components/DocCard';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';
import useLocalRecord from '@/hooks/useLocalRecord';
import useLocalQuery from '@/hooks/useLocalQuery';
import useOfflineMutation from '@/hooks/useOfflineMutation';
import useCapabilities from '@/hooks/useCapabilities';
import useAuthStore from '@/stores/authStore';
import { useIsRTL } from '@/stores/localeStore';
import { SkeletonDetailPage } from '@/components/skeletons';
import { rowDirection, textAlignStart, textAlignEnd } from '@/lib/rtl';
import BatchKpiCard, { mortalityToneColor } from '@/modules/broiler/components/BatchKpiCard';

const SCREEN_WIDTH = Dimensions.get('window').width;

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

// Compact mass / volume formatters mirror `BatchHouseLogsList` so the
// cumulative tile reads in the same units the list-level KPI strip uses
// (5,800 kg → "5.8t", 16,400 L → "16.4kL"). Numbers below the threshold
// fall back to the unit-suffixed integer form.
const fmtDecimal = (val, digits = 1) =>
  Number(val || 0).toLocaleString(NUMERIC_LOCALE, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
const fmtCompactKg = (val) => {
  const n = Number(val || 0);
  if (n >= 1000) return `${fmtDecimal(n / 1000)}t`;
  return `${fmtInt(n)} kg`;
};
const fmtCompactL = (val) => {
  const n = Number(val || 0);
  if (n >= 1000) return `${fmtDecimal(n / 1000)}kL`;
  return `${fmtInt(n)} L`;
};

const fmtDate = (d) => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString(NUMERIC_LOCALE, {
    day: '2-digit', month: 'short', year: 'numeric',
  });
};

// Longer label used in the prev/next navigator strip — gives the user
// the weekday context (e.g. "Wed, Apr 23, 2026") so the date carries
// enough orientation on its own without needing to glance at the title.
const fmtNavDate = (d) => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString(NUMERIC_LOCALE, {
    weekday: 'short', day: '2-digit', month: 'short', year: 'numeric',
  });
};

// `dailyLogs` use `logDate` as the canonical entry date but older
// records (and a handful of legacy paths) only set `date`. This mirrors
// `BatchHouseLogsList`'s `dateKeyOf` so the prev/next ordering matches
// the list the user came from.
const entryDateOf = (log) => log?.logDate || log?.date || null;

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
  const { user: currentUser } = useAuthStore();
  const { remove } = useOfflineMutation('dailyLogs');

  // `initialLog` is the entry the user opened (resolved by the route
  // param). It anchors the sibling set (house + logType) and provides
  // a fallback while the batch-wide query is still loading. After
  // that, the *displayed* log is driven by local `activeId` state so
  // swipes / chevron taps swap content in-place without tearing down
  // and rebuilding the screen — the previous version called
  // `router.replace(...)` per swipe, which felt like a full
  // navigation and triggered the skeleton flash the user reported.
  const [initialLog] = useLocalRecord('dailyLogs', logId);

  const batchId = initialLog?.batch && typeof initialLog.batch === 'object'
    ? initialLog.batch._id
    : initialLog?.batch;
  const [batchLogs] = useLocalQuery(
    'dailyLogs',
    batchId ? { batch: batchId } : null
  );
  // Needed for the "Cycle to Date" tile — the per-house initial bird
  // count lives on the batch's `houses` array (not on individual logs).
  // Fetching the same record the parent screen already has is
  // effectively free (`useLocalRecord` is cached and event-driven).
  const [batch] = useLocalRecord('batches', batchId);

  const [activeId, setActiveId] = useState(logId);
  // If the route param itself changes (e.g. an external deep-link push
  // while the screen is mounted), realign the displayed entry. Local
  // swipe-driven setActiveId calls bypass this since `logId` doesn't
  // change for them.
  useEffect(() => { setActiveId(logId); }, [logId]);

  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [viewerDoc, setViewerDoc] = useState(null);

  // Reanimated state for the slide animation. Three roles in one shared
  // value: tracks the finger during pan, animates off-screen at swipe
  // commit, and animates back on-screen after the active log swaps.
  const translateX = useSharedValue(0);

  // Sibling set is anchored to the *initial* log so the scope doesn't
  // re-derive from the active log mid-swipe (which would create a
  // feedback loop). Same house + same logType, asc by (date, createdAt,
  // _id) so it lines up with the list the user came from.
  const siblings = useMemo(() => {
    if (!initialLog || !batchLogs || batchLogs.length === 0) return [];
    const anchorHouseId = (initialLog.house && typeof initialLog.house === 'object')
      ? initialLog.house._id
      : initialLog.house;
    const anchorLogType = initialLog.logType;
    return batchLogs
      .filter((s) => {
        if (!s || s.deletedAt) return false;
        if (s.logType !== anchorLogType) return false;
        const sHouseId = (s.house && typeof s.house === 'object')
          ? s.house._id
          : s.house;
        return sHouseId === anchorHouseId;
      })
      .slice()
      .sort((a, b) => {
        const da = new Date(entryDateOf(a) || 0).getTime();
        const db = new Date(entryDateOf(b) || 0).getTime();
        if (da !== db) return da - db;
        const ca = new Date(a.createdAt || 0).getTime();
        const cb = new Date(b.createdAt || 0).getTime();
        if (ca !== cb) return ca - cb;
        return String(a._id).localeCompare(String(b._id));
      });
  }, [initialLog, batchLogs]);

  const activeIdx = useMemo(
    () => (siblings.length === 0
      ? -1
      : siblings.findIndex((s) => s._id === activeId)),
    [siblings, activeId]
  );

  // The *displayed* log. Falls back to initialLog while the batch-wide
  // query is still loading so the first paint has data even before
  // siblings is computed.
  const log = (activeIdx >= 0 ? siblings[activeIdx] : null) || initialLog;
  const prevLog = activeIdx > 0 ? siblings[activeIdx - 1] : null;
  const nextLog = (activeIdx >= 0 && activeIdx < siblings.length - 1)
    ? siblings[activeIdx + 1]
    : null;
  const currentIdx = activeIdx;
  const hasPrev = !!prevLog;
  const hasNext = !!nextLog;

  // Cumulative cycle stats — sum every DAILY log on this house dated
  // on or before the *active* entry's date. Pulls from `batchLogs`
  // (not `siblings`) because siblings is filtered to the active log's
  // type; we want to aggregate deaths/feed/water across DAILY logs
  // even when the user is viewing a WEIGHT or ENVIRONMENT entry.
  const cumulativeStats = useMemo(() => {
    const activeDate = entryDateOf(log);
    if (!log || !activeDate || !batchLogs || batchLogs.length === 0) {
      return { deaths: 0, feedKg: 0, waterL: 0, daysLogged: 0 };
    }
    const cutoff = new Date(activeDate).getTime();
    const houseId = (log.house && typeof log.house === 'object')
      ? log.house._id
      : log.house;
    let deaths = 0;
    let feedKg = 0;
    let waterL = 0;
    const dayKeys = new Set();
    batchLogs.forEach((s) => {
      if (!s || s.deletedAt) return;
      if (s.logType !== 'DAILY') return;
      const sHouseId = (s.house && typeof s.house === 'object')
        ? s.house._id
        : s.house;
      if (sHouseId !== houseId) return;
      const sDate = entryDateOf(s);
      if (!sDate) return;
      // Inclusive of the active entry's date — we want "as of this
      // day", not "before this day".
      if (new Date(sDate).getTime() > cutoff) return;
      deaths += s.deaths || 0;
      feedKg += s.feedKg || 0;
      waterL += s.waterLiters || 0;
      dayKeys.add(new Date(sDate).toISOString().slice(0, 10));
    });
    return { deaths, feedKg, waterL, daysLogged: dayKeys.size };
  }, [log, batchLogs]);

  // Initial bird count for the active log's house, looked up from the
  // batch document. Anchors the mortality % and the "Live Birds" tile.
  const initialBirds = useMemo(() => {
    if (!batch?.houses || !log) return 0;
    const houseId = (log.house && typeof log.house === 'object')
      ? log.house._id
      : log.house;
    const entry = batch.houses.find((h) => {
      const hid = typeof h.house === 'object' ? h.house?._id : h.house;
      return hid === houseId;
    });
    return Number(entry?.quantity || 0);
  }, [batch, log]);

  const mortalityPct = initialBirds > 0
    ? (cumulativeStats.deaths / initialBirds) * 100
    : 0;
  const liveBirds = Math.max(0, initialBirds - cumulativeStats.deaths);
  const survivalPct = initialBirds > 0
    ? Math.max(0, 100 - mortalityPct)
    : 0;

  // Slide-out → swap → slide-in animation. The body content slides off
  // in the swipe direction, the active id is updated while the content
  // is fully off-screen (so the swap is invisible), then the new
  // content slides in from the opposite edge. Header + navigator update
  // at the swap moment so the user sees the new date / day immediately
  // when the new content arrives. RTL inverts the direction-to-axis
  // mapping so "next" still slides in from the trailing edge.
  const advance = (direction) => {
    const target = direction > 0 ? nextLog : prevLog;
    if (!target?._id) return;
    Haptics.selectionAsync().catch(() => {});

    const targetId = target._id;
    const outX = direction > 0
      ? (isRTL ? SCREEN_WIDTH : -SCREEN_WIDTH)
      : (isRTL ? -SCREEN_WIDTH : SCREEN_WIDTH);
    const inX = -outX;

    translateX.value = withTiming(
      outX,
      { duration: 170, easing: Easing.out(Easing.cubic) },
      (finished) => {
        'worklet';
        if (!finished) return;
        runOnJS(setActiveId)(targetId);
        // Snap to the opposite edge BEFORE React re-renders the new
        // content. The snap is invisible because both edges are off
        // screen; once React commits the new tree it paints there and
        // the spring below carries it back to centre.
        translateX.value = inX;
        translateX.value = withTiming(
          0,
          { duration: 220, easing: Easing.out(Easing.cubic) }
        );
      }
    );
  };
  const goPrev = () => advance(-1);
  const goNext = () => advance(+1);

  // Horizontal pan with vertical-scroll yield. `activeOffsetX` waits
  // for ~15px of horizontal motion before claiming the gesture so the
  // ScrollView still wins for normal vertical scrolls and taps. RTL
  // flips the conceptual direction (drag-right = "next" in Arabic) per
  // §13/§7 of DESIGN_LANGUAGE.md.
  const pan = Gesture.Pan()
    .activeOffsetX([-15, 15])
    .failOffsetY([-12, 12])
    .onUpdate((e) => {
      'worklet';
      let dx = e.translationX;
      // Rubber-band when dragging past the available end so the user
      // gets immediate physical feedback that the direction is empty.
      const conceptualDx = isRTL ? -dx : dx;
      if (conceptualDx > 0 && !hasPrev) dx = dx * 0.25;
      if (conceptualDx < 0 && !hasNext) dx = dx * 0.25;
      translateX.value = dx * 0.7;
    })
    .onEnd((e) => {
      'worklet';
      const threshold = SCREEN_WIDTH * 0.18;
      const dx = isRTL ? -e.translationX : e.translationX;
      if (dx < -threshold && hasNext) {
        runOnJS(advance)(+1);
      } else if (dx > threshold && hasPrev) {
        runOnJS(advance)(-1);
      } else {
        translateX.value = withSpring(0, { damping: 22, stiffness: 260 });
      }
    });

  const bodyAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
    // Light fade as the content travels off-screen so the swap moment
    // is visually smoother than a hard cut.
    opacity: 1 - Math.min(0.4, Math.abs(translateX.value) / SCREEN_WIDTH),
  }));

  if (!log) {
    return (
      <DetailCompactScreen title={t('common.loading', 'Loading...')} headerRight={null}>
        <SkeletonDetailPage />
      </DetailCompactScreen>
    );
  }

  const houseName = typeof log.house === 'object' ? log.house?.name : null;
  const photos = (log.photos || []).filter(Boolean).map((p) => p?.media_id || p);
  const photoMedia = photos.filter((m) => m?.url);

  // Roles like ground_staff hold a scoped `dailyLog:update:own` rather
  // than the unscoped `dailyLog:update`. The scoped grant only matches
  // when explicitly requested with the same scope, so we OR the two
  // checks together AND require the current user to be the author for
  // the scoped path. Same pattern fits delete if a future role ever
  // gets `dailyLog:delete:own`.
  const logAuthorId = typeof log.createdBy === 'object'
    ? log.createdBy?._id
    : log.createdBy;
  const isMyLog = String(logAuthorId) === String(currentUser?._id);
  const canEdit = can('dailyLog:update')
    || (isMyLog && can('dailyLog:update:own'));
  const canDelete = can('dailyLog:delete')
    || (isMyLog && can('dailyLog:delete:own'));

  const typeLabel = t(`batches.operations.logTypes.${log.logType}`, log.logType);
  // Pin the cycle day onto the title so the user can see "which day of
  // the cycle am I on?" at a glance, mirroring what the list row shows.
  // Falls back to the bare type label when the log predates the
  // cycleDay backfill (rare, but possible for legacy imports).
  const compactTitle = log.cycleDay
    ? `${typeLabel} · ${t('batches.cycleDay', 'Day {{days}}', { days: log.cycleDay })}`
    : typeLabel;

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
      // Delete the *displayed* entry, not the route param. After a few
      // swipes those diverge — the prop stays pinned to whatever the
      // user opened, but we want delete to act on whatever's on screen.
      await remove(log._id);
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
    <View style={[heroStyles.actionsRow, { flexDirection: rowDirection(isRTL) }]}>
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
      <GestureDetector gesture={pan}>
        <View style={{ flex: 1 }}>
          <DetailCompactScreen title={compactTitle} headerRight={headerRight}>
            {/* ─── PREV / NEXT NAVIGATOR ─── */}
            {/* Tappable chevrons + entry-date readout. Always rendered
                so users learn the affordance even when only one entry
                exists (the chevrons just fade out). The same row is
                what the swipe gesture is "moving" between conceptually,
                so we keep it visually static at the top of the body. */}
            <SiblingNavigator
              tokens={tokens}
              isRTL={isRTL}
              t={t}
              prevLog={prevLog}
              nextLog={nextLog}
              currentIdx={currentIdx}
              total={siblings.length}
              entryDate={entryDateOf(log)}
              onPrev={goPrev}
              onNext={goNext}
            />

            <Animated.View style={bodyAnimatedStyle}>
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

              {/* ─── CYCLE TO DATE ─── */}
              {/* Cumulative deaths / feed / water aggregated across
                  every DAILY log for this house on-or-before the
                  active entry's date. Mirrors the BatchHouseLogsList
                  hero KPI styling so the user sees the same shape of
                  stats they're used to from the list view, narrowed
                  to the slice of the cycle they're currently looking
                  at. The card is suppressed when there's literally
                  nothing to summarise (no logs, no initial flock). */}
              {(cumulativeStats.daysLogged > 0 || initialBirds > 0) ? (
                <BatchKpiCard
                  title={t('batches.cycleToDate', 'Cycle to Date')}
                  icon={TrendingUp}
                  headline={fmtInt(cumulativeStats.deaths)}
                  headlineColor={
                    cumulativeStats.deaths > 0
                      ? mortalityToneColor(mortalityPct, tokens)
                      : tokens.textColor
                  }
                  subline={
                    initialBirds > 0
                      ? `${t('batches.totalDeaths', 'Deaths').toLowerCase()}  ·  ${fmtNum(mortalityPct, 2)}%`
                      : t('batches.totalDeaths', 'Deaths').toLowerCase()
                  }
                  sublineColor={
                    initialBirds > 0
                      ? mortalityToneColor(mortalityPct, tokens)
                      : undefined
                  }
                  stats={[
                    {
                      icon: Heart,
                      label: t('batches.currentBirds', 'Live Birds'),
                      value: initialBirds > 0 ? fmtInt(liveBirds) : '—',
                      valueColor: tokens.accentColor,
                      subValue: initialBirds > 0
                        ? `${fmtNum(survivalPct, 2)}%`
                        : null,
                    },
                    {
                      icon: Wheat,
                      label: t('batches.operations.feedShort', 'Feed'),
                      value: fmtCompactKg(cumulativeStats.feedKg),
                    },
                    {
                      icon: Droplets,
                      label: t('batches.operations.waterShort', 'Water'),
                      value: fmtCompactL(cumulativeStats.waterL),
                    },
                  ]}
                />
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
                        caption={cumulativeStats.deaths > 0
                          ? t('batches.operations.cumulativeOfTotal', '{{total}} cycle total', {
                              total: fmtInt(cumulativeStats.deaths),
                            })
                          : null}
                      />
                      <KvRow
                        tokens={tokens}
                        isRTL={isRTL}
                        label={t('batches.operations.feedKg', 'Feed Consumed (kg)')}
                        value={log.feedKg != null ? `${fmtNum(log.feedKg, 2)} kg` : '—'}
                        caption={cumulativeStats.feedKg > 0
                          ? t('batches.operations.cumulativeOfTotal', '{{total}} cycle total', {
                              total: fmtCompactKg(cumulativeStats.feedKg),
                            })
                          : null}
                      />
                      <KvRow
                        tokens={tokens}
                        isRTL={isRTL}
                        label={t('batches.operations.waterLiters', 'Water Consumed (L)')}
                        value={log.waterLiters != null ? `${fmtNum(log.waterLiters, 2)} L` : '—'}
                        caption={cumulativeStats.waterL > 0
                          ? t('batches.operations.cumulativeOfTotal', '{{total}} cycle total', {
                              total: fmtCompactL(cumulativeStats.waterL),
                            })
                          : null}
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
                      textAlign: textAlignStart(isRTL),
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
                      flexDirection: rowDirection(isRTL),
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
            </Animated.View>
          </DetailCompactScreen>
        </View>
      </GestureDetector>

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

// Prev / next sibling pager. Pure presentational — `onPrev` / `onNext`
// are no-ops when their respective sibling is missing, and the chevron
// fades to a "disabled" state in that case so the affordance reads as
// "edge of the cycle reached". The center cell shows the entry's date
// in long form (weekday context helps users orient when they've swiped
// through several entries) plus a "X of N" position pill so the UI
// doesn't feel infinite. Layout in StyleSheet per DL §9.
function SiblingNavigator({
  tokens, isRTL, t,
  prevLog, nextLog, currentIdx, total,
  entryDate, onPrev, onNext,
}) {
  const {
    accentColor, mutedColor, textColor, dark,
    elevatedCardBg, elevatedCardBorder,
  } = tokens;
  const PrevIcon = isRTL ? ChevronRight : ChevronLeft;
  const NextIcon = isRTL ? ChevronLeft : ChevronRight;

  const dateLabel = fmtNavDate(entryDate);
  const positionLabel = total > 1 && currentIdx >= 0
    ? `${fmtInt(currentIdx + 1)} / ${fmtInt(total)}`
    : null;

  return (
    <View style={navStyles.outer}>
      <View
        style={[
          navStyles.card,
          {
            flexDirection: rowDirection(isRTL),
            backgroundColor: elevatedCardBg,
            borderColor: elevatedCardBorder,
          },
        ]}
      >
        <NavArrowButton
          disabled={!prevLog}
          onPress={onPrev}
          Icon={PrevIcon}
          accent={accentColor}
          muted={mutedColor}
          dark={dark}
          accessibilityLabel={t('common.previous', 'Previous')}
        />
        <View style={navStyles.center}>
          <View
            style={[
              navStyles.dateRow,
              { flexDirection: rowDirection(isRTL) },
            ]}
          >
            <Calendar size={13} color={mutedColor} strokeWidth={2.2} />
            <Text
              style={{
                fontSize: 14,
                fontFamily: 'Poppins-SemiBold',
                color: textColor,
                fontVariant: ['tabular-nums'],
              }}
              numberOfLines={1}
            >
              {dateLabel}
            </Text>
          </View>
          {positionLabel ? (
            <Text
              style={{
                marginTop: 2,
                fontSize: 11,
                fontFamily: 'Poppins-Medium',
                color: mutedColor,
                fontVariant: ['tabular-nums'],
              }}
              numberOfLines={1}
            >
              {positionLabel}
            </Text>
          ) : null}
        </View>
        <NavArrowButton
          disabled={!nextLog}
          onPress={onNext}
          Icon={NextIcon}
          accent={accentColor}
          muted={mutedColor}
          dark={dark}
          accessibilityLabel={t('common.next', 'Next')}
        />
      </View>
    </View>
  );
}

// Single chevron pill used by `SiblingNavigator`. Kept as a tiny
// component so the disabled/enabled colour swap and the press-state
// background tint stay readable. Functional `style={({pressed}) => ...}`
// is fine here because no layout-bearing props live in the diff (DL §9
// trap only bites when flexDirection / borderWidth land in the
// functional branch).
function NavArrowButton({
  disabled, onPress, Icon, accent, muted, dark, accessibilityLabel,
}) {
  return (
    <Pressable
      onPress={() => {
        if (disabled) return;
        Haptics.selectionAsync().catch(() => {});
        onPress?.();
      }}
      disabled={disabled}
      android_ripple={
        disabled
          ? null
          : {
              color: dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
              borderless: true,
              radius: 22,
            }
      }
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [
        navStyles.arrowBtn,
        {
          backgroundColor: pressed && !disabled
            ? (dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)')
            : 'transparent',
          opacity: disabled ? 0.32 : 1,
        },
      ]}
    >
      <Icon size={20} color={disabled ? muted : accent} strokeWidth={2.4} />
    </Pressable>
  );
}

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
        <View style={[partyStyles.row, { flexDirection: rowDirection(isRTL) }]}>
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
                  textAlign: textAlignStart(isRTL),
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
                textAlign: textAlignStart(isRTL),
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
      <View style={[partyStyles.row, { flexDirection: rowDirection(isRTL) }]}>
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
                textAlign: textAlignStart(isRTL),
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
              textAlign: textAlignStart(isRTL),
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
function KvRow({
  tokens, isRTL, label, value, caption, bold, negative, highlight,
}) {
  const { textColor, mutedColor, errorColor, accentColor } = tokens;
  return (
    <View
      style={[
        kvStyles.row,
        { flexDirection: rowDirection(isRTL) },
      ]}
    >
      <Text
        style={{
          flex: 1,
          fontSize: 13,
          fontFamily: bold ? 'Poppins-SemiBold' : 'Poppins-Regular',
          color: mutedColor,
          textAlign: textAlignStart(isRTL),
        }}
        numberOfLines={2}
      >
        {label}
      </Text>
      <View style={kvStyles.valueCol}>
        <Text
          style={{
            fontSize: 14,
            fontFamily: bold ? 'Poppins-SemiBold' : 'Poppins-Regular',
            color: negative ? errorColor : highlight ? accentColor : textColor,
            fontVariant: ['tabular-nums'],
            textAlign: textAlignEnd(isRTL),
          }}
        >
          {value}
        </Text>
        {/* Optional sub-line for cycle-cumulative context — keeps the
            primary "today's value" reading unchanged but tucks the
            running total under it for at-a-glance comparison. */}
        {caption ? (
          <Text
            style={{
              marginTop: 1,
              fontSize: 11,
              fontFamily: 'Poppins-Medium',
              color: mutedColor,
              fontVariant: ['tabular-nums'],
              textAlign: textAlignEnd(isRTL),
            }}
            numberOfLines={1}
          >
            {caption}
          </Text>
        ) : null}
      </View>
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
          { flexDirection: rowDirection(isRTL) },
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

// Sibling navigator pill — sits at the top of the body, immediately
// below the gradient header, and is the visual anchor for the swipe
// gesture. 14pt radius matches `partyStyles.card` so the row reads as
// a peer of the House card directly below it.
const navStyles = StyleSheet.create({
  outer: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
  card: {
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 4,
    paddingVertical: 6,
    gap: 8,
  },
  arrowBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  dateRow: {
    alignItems: 'center',
    gap: 6,
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
    // `flex-start` (was `center`) keeps the value column top-aligned
    // with the label when an optional caption sub-line is present —
    // otherwise the row's vertical centre shifts under multi-line
    // labels and the value drifts below the label baseline.
    alignItems: 'flex-start',
    gap: 12,
    minHeight: 22,
  },
  valueCol: {
    alignItems: 'flex-end',
    minWidth: 0,
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
