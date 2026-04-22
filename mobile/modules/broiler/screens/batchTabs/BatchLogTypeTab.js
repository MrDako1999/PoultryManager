import { useMemo, useState, useCallback } from 'react';
import {
  View, Text, Pressable, ScrollView, RefreshControl, StyleSheet,
  LayoutAnimation, Platform, UIManager,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import {
  Home, CheckCircle2, Circle, ClipboardList, Plus,
  ChevronDown, ChevronRight as ChevronRightGlyph, ChevronLeft as ChevronLeftGlyph,
  ChevronsDownUp, ChevronsUpDown,
} from 'lucide-react-native';
import useLocalQuery from '@/hooks/useLocalQuery';
import { useHeroSheetTokens } from '@/components/HeroSheetScreen';
import { useIsRTL } from '@/stores/localeStore';
import SheetSection from '@/components/SheetSection';
import EmptyState from '@/components/ui/EmptyState';
import BatchKpiCard from '@/modules/broiler/components/BatchKpiCard';
import DailyLogSheet from '@/modules/broiler/sheets/DailyLogSheet';
import { LOG_TYPE_ICONS } from '@/lib/constants';
import { deltaSync } from '@/lib/syncEngine';
import { rowDirection, textAlignStart } from '@/lib/rtl';

const NUMERIC_LOCALE = 'en-US';
const fmt = (val) => Number(val || 0).toLocaleString(NUMERIC_LOCALE);

// Date keys in ISO YYYY-MM-DD so lexicographic compare is timezone safe
// (same trick as BatchHouseLogsList.js / SalesListView).
function dateKeyOf(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

// Build the full list of cycle days from the batch start date through
// today. Each entry is { dayKey, cycleDay }. We work backwards from
// today so the most recent days surface first; cycleDay starts from 1
// on `startDate` (matches the model's `cycleDay` field).
function buildCycleDays(startDate) {
  if (!startDate) return [];
  const start = new Date(startDate);
  if (Number.isNaN(start.getTime())) return [];
  const startKey = start.toISOString().slice(0, 10);
  const out = [];
  const cursor = new Date();
  // Iterate by day until we cross before startDate.
  while (cursor.toISOString().slice(0, 10) >= startKey) {
    const key = cursor.toISOString().slice(0, 10);
    // cycleDay = days since start, 1-indexed.
    const days = Math.floor((cursor.getTime() - start.getTime()) / 86400000) + 1;
    out.push({ dayKey: key, cycleDay: Math.max(1, days) });
    cursor.setDate(cursor.getDate() - 1);
  }
  return out;
}

function fmtDayLabel(dayKey, locale) {
  if (!dayKey) return '';
  const d = new Date(`${dayKey}T00:00:00`);
  if (Number.isNaN(d.getTime())) return dayKey;
  try {
    return d.toLocaleDateString(locale, {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
    });
  } catch {
    return d.toLocaleDateString();
  }
}

const TODAY_KEY = (() => todayKey())();

// Android needs a one-shot opt-in for the legacy LayoutAnimation API
// before any animated state change. Same idiom used by BatchesList.js.
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

/**
 * Per-log-type tab for a batch. Same layout reused for the Daily Logs,
 * Samples, and Environment tabs ground_staff sees on a batch — only
 * the `logType` prop differs.
 *
 * Structure:
 *   - KPI hero showing coverage stats (days fully logged / partial /
 *     missing) for the active cycle.
 *   - Day-grouped list, newest first. Each day shows a status pill and
 *     one row per house in the batch:
 *       - Logged: tap opens the entry detail (edit available there).
 *       - Pending: tap opens DailyLogSheet pre-pinned to that house +
 *         day, with the right `logType`.
 *
 * Read-only of others' entries is enforced by capability — workers
 * with `dailyLog:update:own` can only edit their own entries; the
 * detail screen handles that gate.
 */
export default function BatchLogTypeTab({ batch, batchId, logType }) {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const isRTL = useIsRTL();
  const tokens = useHeroSheetTokens();
  const {
    accentColor, dark, mutedColor, textColor, screenBg, sectionBorder,
  } = tokens;

  const [refreshing, setRefreshing] = useState(false);
  const [sheet, setSheet] = useState(null);
  // Per-day open state. Missing entries default to OPEN so first-time
  // users see content; collapse-all flips the whole list at once.
  const [groupOpen, setGroupOpen] = useState({});

  const [dailyLogs, dailyLogsLoading] = useLocalQuery('dailyLogs', { batch: batchId });

  // COMPLETE batches are archival — block the "tap to log" path on
  // empty house slots and don't render a missing/pending visual on
  // them. Existing entries remain tappable so workers can still view
  // (and edit if owned) historical logs.
  const isCompleted = batch?.status === 'COMPLETE';

  const houses = useMemo(() => {
    return (batch?.houses || []).map((h, idx) => {
      const houseObj = typeof h.house === 'object' ? h.house : null;
      const houseId = houseObj?._id || h.house || `h${idx}`;
      const name = houseObj?.name || h.name || `${t('farms.house', 'House')} ${idx + 1}`;
      return { _id: String(houseId), name };
    });
  }, [batch?.houses, t]);

  // logsByDayHouse[dayKey][houseId] = log
  const logsByDayHouse = useMemo(() => {
    const map = new Map();
    for (const log of dailyLogs || []) {
      if (log.deletedAt) continue;
      if (log.logType !== logType) continue;
      const key = dateKeyOf(log.logDate || log.date);
      if (!key) continue;
      const hid = String(typeof log.house === 'object' ? log.house?._id : log.house);
      if (!hid) continue;
      if (!map.has(key)) map.set(key, new Map());
      map.get(key).set(hid, log);
    }
    return map;
  }, [dailyLogs, logType]);

  const cycleDays = useMemo(() => buildCycleDays(batch?.startDate), [batch?.startDate]);

  // Per-day rollup with a status colour:
  //   full     — every house has an entry of this type
  //   partial  — at least one but not all houses logged
  //   missing  — no houses logged
  //
  // For completed batches we drop entirely-empty days so the
  // archived view is just "what got recorded" rather than a wall of
  // "Missing" headers spanning the whole cycle. Active batches keep
  // every day visible because workers need to see where the gaps are.
  const dayRows = useMemo(() => {
    const houseCount = houses.length;
    const rows = [];
    for (const { dayKey, cycleDay } of cycleDays) {
      const houseMap = logsByDayHouse.get(dayKey) || new Map();
      const logged = houses.filter((h) => houseMap.has(h._id));
      const status = houseCount === 0 || logged.length === 0
        ? 'missing'
        : logged.length === houseCount
          ? 'full'
          : 'partial';
      if (isCompleted && logged.length === 0) continue;
      rows.push({
        dayKey,
        cycleDay,
        houseMap,
        loggedCount: logged.length,
        status,
        isToday: dayKey === TODAY_KEY,
      });
    }
    return rows;
  }, [cycleDays, houses, logsByDayHouse, isCompleted]);

  const summary = useMemo(() => {
    let full = 0;
    let partial = 0;
    let missing = 0;
    for (const row of dayRows) {
      if (row.status === 'full') full += 1;
      else if (row.status === 'partial') partial += 1;
      else missing += 1;
    }
    return { full, partial, missing, total: dayRows.length };
  }, [dayRows]);

  const onRefresh = async () => {
    setRefreshing(true);
    try { await deltaSync(); } catch (e) { console.error(e); }
    setRefreshing(false);
  };

  // Defaulting is "open" — only an explicit `false` collapses a row.
  // That way newly-added days don't surprise the user by being closed.
  const isOpen = useCallback(
    (dayKey) => groupOpen[dayKey] !== false,
    [groupOpen]
  );

  const toggleGroup = useCallback((dayKey) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    Haptics.selectionAsync().catch(() => {});
    setGroupOpen((prev) => ({ ...prev, [dayKey]: !(prev[dayKey] !== false) }));
  }, []);

  const allExpanded = useMemo(
    () => dayRows.every((row) => isOpen(row.dayKey)),
    [dayRows, isOpen]
  );

  const toggleAll = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const next = {};
    for (const row of dayRows) next[row.dayKey] = !allExpanded;
    setGroupOpen(next);
  }, [dayRows, allExpanded]);

  const openExisting = (log) => {
    if (!log?._id) return;
    Haptics.selectionAsync().catch(() => {});
    router.push(`/(app)/daily-log/${log._id}`);
  };

  const openCreate = (house, dayKey) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setSheet({
      house,
      dayKey,
      defaultLogType: logType,
    });
  };

  const closeSheet = () => setSheet(null);

  // Title + empty-state copy come from the log type. The translations
  // already exist in the broiler i18n bundle (used by DailyLogSheet's
  // header subtitle) so we reuse `batches.operations.logTypes.<TYPE>`.
  const TITLES = {
    DAILY: t('batches.dailyLogsTab', 'Daily Logs'),
    WEIGHT: t('batches.samplesTab', 'Samples'),
    ENVIRONMENT: t('batches.environmentTab', 'Environment'),
  };
  const EMPTY_DESC = {
    DAILY: t(
      'batches.emptyDailyLogsDesc',
      'Daily mortality, feed and water entries appear here as soon as they\'re recorded.'
    ),
    WEIGHT: t(
      'batches.emptySamplesDesc',
      'Sample weight readings appear here as soon as they\'re recorded.'
    ),
    ENVIRONMENT: t(
      'batches.emptyEnvironmentDesc',
      'Environment readings (temperature, humidity, water TDS/pH) appear here as soon as they\'re recorded.'
    ),
  };
  const tabIcon = LOG_TYPE_ICONS[logType] || ClipboardList;

  // Reuse the same compact icon-button shape as BatchHouseLogsList /
  // BatchesList collapse-all so the affordance reads identically
  // wherever a long day-grouped list appears in the app.
  const collapseAllButton = dayRows.length > 1 ? (
    <Pressable
      onPress={toggleAll}
      android_ripple={{
        color: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
        borderless: false,
      }}
      style={[
        listToolbarStyles.collapseBtn,
        {
          backgroundColor: tokens.inputBg,
          borderColor: tokens.inputBorderIdle,
        },
      ]}
      hitSlop={4}
      accessibilityRole="button"
      accessibilityLabel={allExpanded
        ? t('common.collapseAll', 'Collapse all')
        : t('common.expandAll', 'Expand all')}
    >
      {allExpanded
        ? <ChevronsDownUp size={16} color={mutedColor} strokeWidth={2.2} />
        : <ChevronsUpDown size={16} color={mutedColor} strokeWidth={2.2} />}
    </Pressable>
  ) : null;

  if (houses.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: screenBg }}>
        <EmptyState
          icon={Home}
          title={t('batches.selectHouses', 'No houses on this batch')}
          description={t(
            'batches.operations.noEntriesDesc',
            'Add houses to start recording entries.'
          )}
        />
      </View>
    );
  }

  if (dailyLogsLoading && (dailyLogs || []).length === 0 && cycleDays.length === 0) {
    return <View style={{ flex: 1, backgroundColor: screenBg }} />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: screenBg }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingTop: 16,
          paddingBottom: insets.bottom + 120,
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={accentColor}
            colors={[accentColor]}
            progressBackgroundColor={dark ? 'hsl(150, 18%, 14%)' : '#ffffff'}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <BatchKpiCard
          title={TITLES[logType] || TITLES.DAILY}
          icon={tabIcon}
          headline={`${fmt(summary.full)} / ${fmt(summary.total)}`}
          subline={
            summary.total === 0
              ? t('batches.coverageNoCycle', 'Cycle hasn\'t started yet')
              : t('batches.coverageDaysFull', 'days fully logged')
          }
          stats={[
            {
              icon: CheckCircle2,
              label: t('batches.coverageFull', 'Complete'),
              value: fmt(summary.full),
              valueColor: accentColor,
            },
            {
              icon: Circle,
              label: t('batches.coveragePartial', 'Partial'),
              value: fmt(summary.partial),
              valueColor: summary.partial > 0
                ? (dark ? '#fbbf24' : '#d97706')
                : undefined,
            },
            {
              icon: Circle,
              label: t('batches.coverageMissing', 'Missing'),
              value: fmt(summary.missing),
              valueColor: summary.missing > 0
                ? (dark ? '#fca5a5' : '#dc2626')
                : undefined,
            },
          ]}
        />

        {dayRows.length === 0 ? (
          <SheetSection>
            <EmptyState
              icon={tabIcon}
              title={t('batches.operations.noEntries', 'No entries yet')}
              description={EMPTY_DESC[logType] || EMPTY_DESC.DAILY}
            />
          </SheetSection>
        ) : (
          <>
            {/* Section toolbar — title on the leading edge, single
                collapse-all icon on the trailing edge. We render it
                outside `SheetSection` (rather than via the built-in
                `title` prop) so we can put the icon next to the
                label without forking the SheetSection component. */}
            <View
              style={[
                listToolbarStyles.toolbar,
                { flexDirection: rowDirection(isRTL) },
              ]}
            >
              <Text
                style={[
                  listToolbarStyles.toolbarTitle,
                  {
                    color: mutedColor,
                    textAlign: textAlignStart(isRTL),
                  },
                ]}
              >
                {t('batches.byDay', 'By day')}
              </Text>
              {collapseAllButton}
            </View>

            <SheetSection padded={false}>
              {dayRows.map((row, idx) => {
                const open = isOpen(row.dayKey);
                return (
                  <View
                    key={row.dayKey}
                    style={
                      idx > 0
                        ? { borderTopWidth: 1, borderTopColor: sectionBorder }
                        : null
                    }
                  >
                    <DayBlock
                      row={row}
                      houses={houses}
                      tokens={tokens}
                      isRTL={isRTL}
                      t={t}
                      dayLabel={fmtDayLabel(row.dayKey, i18n.language)}
                      onOpenExisting={openExisting}
                      onOpenCreate={openCreate}
                      readOnly={isCompleted}
                      open={open}
                      onToggle={() => toggleGroup(row.dayKey)}
                    />
                  </View>
                );
              })}
            </SheetSection>
          </>
        )}
      </ScrollView>

      <DailyLogSheet
        open={!!sheet}
        onClose={closeSheet}
        batchId={batchId}
        houses={sheet ? [sheet.house] : []}
        defaultLogType={sheet?.defaultLogType}
        defaultHouseId={sheet?.house?._id}
        defaultDate={sheet?.dayKey}
      />
    </View>
  );
}

function DayBlock({
  row, houses, tokens, isRTL, t, dayLabel,
  onOpenExisting, onOpenCreate, readOnly = false,
  open = true, onToggle,
}) {
  const {
    accentColor, dark, mutedColor, textColor, sectionBorder, borderColor,
  } = tokens;
  const ChevronGlyph = isRTL ? ChevronLeftGlyph : ChevronRightGlyph;

  const statusMeta = {
    full: {
      label: t('batches.coverageFullPill', 'Complete'),
      color: accentColor,
      bg: dark ? 'rgba(148,210,165,0.14)' : 'hsl(148, 35%, 92%)',
    },
    partial: {
      label: t('batches.coveragePartialPill', '{{n}} of {{total}}', {
        n: row.loggedCount,
        total: houses.length,
      }),
      color: dark ? '#fbbf24' : '#d97706',
      bg: dark ? 'rgba(251,191,36,0.14)' : 'hsl(40, 90%, 94%)',
    },
    missing: {
      label: t('batches.coverageMissingPill', 'Missing'),
      color: dark ? '#fca5a5' : '#dc2626',
      bg: dark ? 'rgba(252,165,165,0.14)' : 'hsl(0, 80%, 96%)',
    },
  }[row.status];

  // Filter once so we can both decide visibility and reflect the
  // count in the collapsed header without walking the houses list
  // twice.
  const visibleHouses = readOnly
    ? houses.filter((h) => row.houseMap.has(h._id))
    : houses;

  return (
    <View>
      <Pressable
        onPress={onToggle}
        android_ripple={{
          color: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
          borderless: false,
        }}
        style={({ pressed }) => ({
          backgroundColor: pressed
            ? (dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)')
            : 'transparent',
        })}
        accessibilityRole="button"
        accessibilityLabel={open
          ? t('common.collapse', 'Collapse')
          : t('common.expand', 'Expand')}
      >
        <View
          style={[
            dayBlockStyles.headerRow,
            {
              flexDirection: rowDirection(isRTL),
              borderBottomColor: open ? sectionBorder : 'transparent',
            },
          ]}
        >
          {/* Chevron rotates 90deg when the block opens — same
              affordance used by the directory category rows. */}
          <View style={dayBlockStyles.chevWrap}>
            {open ? (
              <ChevronDown size={16} color={mutedColor} strokeWidth={2.4} />
            ) : (
              <ChevronGlyph size={16} color={mutedColor} strokeWidth={2.4} />
            )}
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text
              style={{
                fontSize: 13,
                fontFamily: 'Poppins-SemiBold',
                color: textColor,
                letterSpacing: -0.1,
                textAlign: textAlignStart(isRTL),
              }}
              numberOfLines={1}
            >
              {row.isToday
                ? t('batches.today', 'Today')
                : dayLabel}
              {' · '}
              <Text style={{ color: mutedColor, fontFamily: 'Poppins-Medium' }}>
                {t('batches.cycleDay', 'Day {{days}}', { days: row.cycleDay })}
              </Text>
            </Text>
          </View>
          <View
            style={[
              dayBlockStyles.statusPill,
              { backgroundColor: statusMeta.bg, borderColor: statusMeta.color },
            ]}
          >
            <Text
              style={{
                fontSize: 10,
                fontFamily: 'Poppins-SemiBold',
                color: statusMeta.color,
                letterSpacing: 0.6,
                textTransform: 'uppercase',
              }}
            >
              {statusMeta.label}
            </Text>
          </View>
        </View>
      </Pressable>

      {open ? visibleHouses.map((house, idx) => {
        const log = row.houseMap.get(house._id) || null;
        return (
          <HouseLine
            key={`${row.dayKey}:${house._id}`}
            house={house}
            log={log}
            tokens={tokens}
            isRTL={isRTL}
            t={t}
            isFirst={idx === 0}
            onOpen={() =>
              log ? onOpenExisting(log) : onOpenCreate(house, row.dayKey)
            }
          />
        );
      }) : null}
    </View>
  );
}

function HouseLine({
  house, log, tokens, isRTL, t, isFirst, onOpen,
}) {
  const {
    accentColor, dark, mutedColor, textColor, borderColor,
  } = tokens;

  const submitted = !!log;
  const StatusIcon = submitted ? CheckCircle2 : Plus;
  const statusColor = submitted ? accentColor : (dark ? '#fbbf24' : '#d97706');
  const statusBg = submitted
    ? (dark ? 'rgba(148,210,165,0.14)' : 'hsl(148, 35%, 92%)')
    : (dark ? 'rgba(251,191,36,0.12)' : 'hsl(40, 90%, 94%)');

  const subParts = [];
  if (log) {
    if (log.deaths != null) {
      subParts.push(`${log.deaths || 0} ${t('batches.operations.deathsShort', 'deaths').toLowerCase()}`);
    }
    if (log.feedKg) {
      subParts.push(`${log.feedKg} kg ${t('batches.operations.feedShort', 'feed').toLowerCase()}`);
    }
    if (log.averageWeight) {
      subParts.push(`${log.averageWeight} g`);
    }
    if (log.temperature != null) {
      subParts.push(`${log.temperature}°C`);
    }
    if (log.humidity != null) {
      subParts.push(`${log.humidity}% RH`);
    }
  }
  const subline = log
    ? (subParts.join(' · ') || t('batches.operations.entryRecorded', 'Entry recorded'))
    : t('batches.tapToLog', 'Tap to log');

  return (
    <Pressable
      onPressIn={() => Haptics.selectionAsync().catch(() => {})}
      onPress={onOpen}
      android_ripple={{
        color: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
        borderless: false,
      }}
      style={({ pressed }) => ({
        backgroundColor: pressed
          ? (dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)')
          : 'transparent',
        borderTopWidth: isFirst ? 0 : StyleSheet.hairlineWidth,
        borderTopColor: borderColor,
      })}
    >
      <View style={houseLineStyles.row}>
        <View
          style={[
            houseLineStyles.inner,
            { flexDirection: rowDirection(isRTL) },
          ]}
        >
          <View
            style={[
              houseLineStyles.statusTile,
              { backgroundColor: statusBg },
            ]}
          >
            <StatusIcon size={14} color={statusColor} strokeWidth={2.4} />
          </View>
          <View style={houseLineStyles.textCol}>
            <Text
              style={{
                fontSize: 13,
                fontFamily: 'Poppins-SemiBold',
                color: textColor,
                letterSpacing: -0.1,
                textAlign: textAlignStart(isRTL),
              }}
              numberOfLines={1}
            >
              {house.name}
            </Text>
            <Text
              style={{
                fontSize: 11,
                fontFamily: 'Poppins-Regular',
                color: submitted ? mutedColor : statusColor,
                marginTop: 2,
                textAlign: textAlignStart(isRTL),
              }}
              numberOfLines={1}
            >
              {subline}
            </Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const dayBlockStyles = StyleSheet.create({
  headerRow: {
    paddingHorizontal: 12,
    paddingTop: 14,
    paddingBottom: 10,
    alignItems: 'center',
    gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  chevWrap: {
    width: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
});

const listToolbarStyles = StyleSheet.create({
  toolbar: {
    marginHorizontal: 22,
    marginBottom: 10,
    alignItems: 'center',
    gap: 8,
  },
  toolbarTitle: {
    flex: 1,
    fontSize: 11,
    fontFamily: 'Poppins-SemiBold',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  // Same shape used by BatchHouseLogsList / BatchesList collapse-all
  // so the affordance reads identically across the app.
  collapseBtn: {
    height: 30,
    width: 30,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

const houseLineStyles = StyleSheet.create({
  row: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  inner: {
    alignItems: 'center',
    gap: 12,
  },
  statusTile: {
    width: 30,
    height: 30,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textCol: {
    flex: 1,
    minWidth: 0,
  },
});
