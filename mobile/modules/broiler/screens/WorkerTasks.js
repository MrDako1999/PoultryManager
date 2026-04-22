import { useMemo, useState } from 'react';
import {
  View, Text, Pressable, RefreshControl, StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import {
  ListChecks, ClipboardList, Home, CheckCircle2, Circle,
  ChevronRight, ChevronLeft, Weight, Thermometer,
} from 'lucide-react-native';
import useAuthStore from '@/stores/authStore';
import useLocalQuery from '@/hooks/useLocalQuery';
import HeroSheetScreen, { useHeroSheetTokens } from '@/components/HeroSheetScreen';
import SheetSection from '@/components/SheetSection';
import EmptyState from '@/components/ui/EmptyState';
import SyncIconButton from '@/components/SyncIconButton';
import QuickAddFAB from '@/components/QuickAddFAB';
import { useIsRTL } from '@/stores/localeStore';
import { deltaSync } from '@/lib/syncEngine';
import DailyLogSheet from '@/modules/broiler/sheets/DailyLogSheet';
import { rowDirection, textAlignStart } from '@/lib/rtl';

/**
 * Worker Tasks — virtual daily checklist for ground_staff.
 *
 * One row per assigned house. Status is derived at read time from the
 * worker's existing DailyLog records:
 *   - "submitted": this user has a DAILY log for this house dated today.
 *   - "pending":   no DAILY log yet.
 *
 * No new DB entity. No background job. The list rebuilds from scratch
 * after midnight automatically because the derivation key is
 * `isSameLocalDay(log.date, now)`.
 *
 * The same scope-resolution recipe used by WorkerHome lives here too —
 * `farmAssignments` (primary) ∪ legacy `houseAssignments`. Mirrors the
 * backend helper in [backend/services/workerScope.js].
 *
 * Tapping a row opens the standard DailyLogSheet pre-pinned to the
 * tapped house and its active batch (`logType=DAILY`). If a log already
 * exists for today the sheet opens in edit mode against it.
 *
 * The FAB offers WEIGHT and ENVIRONMENT entry — sample/spot readings
 * a worker may add on top of their daily log. Capability-gated: shows
 * only when the user has `dailyLog:create:<TYPE>`.
 */

function isSameLocalDay(a, b) {
  if (!a || !b) return false;
  return new Date(a).toDateString() === new Date(b).toDateString();
}

export default function WorkerTasksScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const isRTL = useIsRTL();
  const tokens = useHeroSheetTokens();
  const { accentColor, dark, mutedColor, textColor, sectionBorder } = tokens;

  const { user } = useAuthStore();
  const [houses] = useLocalQuery('houses');
  const [batches] = useLocalQuery('batches');
  const [dailyLogs] = useLocalQuery('dailyLogs');
  const [workers] = useLocalQuery('workers');
  const [farms] = useLocalQuery('farms');

  const [refreshing, setRefreshing] = useState(false);
  // Open-state is split per "kind" so the FAB menu and the per-row
  // "Log" CTA can't conflict. Each entry holds the targeting we need
  // (house, batch, logType, optional editData for an existing log).
  const [logSheet, setLogSheet] = useState(null);

  const worker = useMemo(
    () => workers.find((w) => {
      const linkedId = typeof w.linkedUser === 'object' ? w.linkedUser?._id : w.linkedUser;
      return String(linkedId) === String(user?._id);
    }),
    [workers, user?._id]
  );

  const assignedHouseIds = useMemo(() => {
    const farmIds = Array.isArray(worker?.farmAssignments)
      ? worker.farmAssignments.map((f) => String(typeof f === 'object' ? f._id : f))
      : [];
    const legacyHouseIds = Array.isArray(worker?.houseAssignments)
      ? worker.houseAssignments.map((h) => String(typeof h === 'object' ? h._id : h))
      : [];
    const farmHouseIds = farmIds.length
      ? houses
          .filter((h) => {
            const fid = String(typeof h.farm === 'object' ? h.farm?._id : h.farm || '');
            return farmIds.includes(fid);
          })
          .map((h) => String(h._id))
      : [];
    return [...new Set([...legacyHouseIds, ...farmHouseIds])];
  }, [worker, houses]);

  const myHouses = useMemo(() => {
    if (assignedHouseIds.length === 0) return [];
    return houses
      .filter((h) => assignedHouseIds.includes(String(h._id)))
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [houses, assignedHouseIds]);

  // Map house -> active batch (anything not yet COMPLETE that contains
  // this house). Same recipe as WorkerHome.
  const activeBatchByHouse = useMemo(() => {
    const m = new Map();
    for (const batch of batches) {
      if (batch.status === 'COMPLETE') continue;
      for (const entry of batch.houses || []) {
        const hid = typeof entry.house === 'object' ? entry.house?._id : entry.house;
        if (hid) m.set(String(hid), batch);
      }
    }
    return m;
  }, [batches]);

  // For each assigned house, find my DAILY log dated today (if any).
  // The `(user_id, batch, house, date, logType)` unique index in
  // [backend/models/DailyLog.js] guarantees at most one DAILY per
  // house/day/account, so we can safely treat the first match as
  // canonical.
  const myTodayLogByHouse = useMemo(() => {
    const now = new Date();
    const m = new Map();
    for (const log of dailyLogs) {
      if (log.deletedAt) continue;
      if (log.logType !== 'DAILY') continue;
      const authorId = typeof log.createdBy === 'object' ? log.createdBy?._id : log.createdBy;
      if (String(authorId) !== String(user?._id)) continue;
      const hid = typeof log.house === 'object' ? log.house?._id : log.house;
      if (!hid) continue;
      if (!isSameLocalDay(log.date, now)) continue;
      m.set(String(hid), log);
    }
    return m;
  }, [dailyLogs, user?._id]);

  // Index farms by id for cheap lookup when attaching farm metadata
  // to each task. House.farm is an ObjectId or a populated object
  // depending on which sync endpoint hydrated it.
  const farmsById = useMemo(() => {
    const m = new Map();
    for (const f of farms) m.set(String(f._id), f);
    return m;
  }, [farms]);

  // Tasks only exist when there's an active batch to log against.
  // Houses sitting empty between cycles (no active batch) are silently
  // dropped — there's nothing for the worker to do until intake. The
  // empty-state copy below distinguishes "no assignments at all" from
  // "assigned but no live batch yet" so the worker knows which.
  const tasks = useMemo(() => {
    return myHouses
      .map((house) => {
        const houseId = String(house._id);
        const batch = activeBatchByHouse.get(houseId) || null;
        if (!batch) return null;
        const existing = myTodayLogByHouse.get(houseId) || null;
        const farmId = String(
          (typeof house.farm === 'object' ? house.farm?._id : house.farm) || ''
        );
        const farm = farmsById.get(farmId)
          || (typeof house.farm === 'object' ? house.farm : null);
        return {
          houseId,
          house,
          batch,
          existing,
          farmId,
          farm,
          status: existing ? 'submitted' : 'pending',
        };
      })
      .filter(Boolean);
  }, [myHouses, activeBatchByHouse, myTodayLogByHouse, farmsById]);

  // Group by farm and sort with a natural-numeric collator inside
  // each group so "House 2" comes before "House 10". Pending rows
  // float to the top of each farm so the worker still sees what
  // needs doing first within a farm without losing the grouping.
  const farmGroups = useMemo(() => {
    const naturalCollator = new Intl.Collator(undefined, {
      numeric: true,
      sensitivity: 'base',
    });
    const groups = new Map();
    for (const task of tasks) {
      const key = task.farmId || '__unassigned__';
      if (!groups.has(key)) {
        groups.set(key, {
          farmId: key,
          farmName:
            task.farm?.farmName
            || task.farm?.nickname
            || t('worker.tasks.unknownFarm', 'Unassigned farm'),
          tasks: [],
        });
      }
      groups.get(key).tasks.push(task);
    }
    for (const group of groups.values()) {
      group.tasks.sort((a, b) => {
        if (a.status !== b.status) return a.status === 'pending' ? -1 : 1;
        return naturalCollator.compare(a.house.name || '', b.house.name || '');
      });
    }
    return [...groups.values()].sort((a, b) =>
      naturalCollator.compare(a.farmName, b.farmName)
    );
  }, [tasks, t]);

  const submittedCount = tasks.filter((task) => task.status === 'submitted').length;
  const totalCount = tasks.length;
  const hasAssignments = myHouses.length > 0;

  const onRefresh = async () => {
    setRefreshing(true);
    try { await deltaSync(); } catch (e) { console.error(e); }
    setRefreshing(false);
  };

  // Single entry point so per-row CTA + FAB menu use identical wiring.
  // `kind` decides logType; falls back to DAILY edit when an existing
  // log is found for today (idempotency rule).
  const openLogSheet = ({ task, kind }) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    if (!task?.batch) return;
    const houseId = String(task.house._id);
    setLogSheet({
      batchId: task.batch._id || task.batch,
      defaultHouseId: houseId,
      defaultLogType: kind,
      editData: kind === 'DAILY' ? task.existing : null,
      // Single-house list keeps the in-sheet picker simple (and locked
      // to the right house); we still pass the array so the existing
      // Select inside DailyLogSheet renders correctly.
      houses: [{ _id: houseId, name: task.house.name }],
    });
  };

  // FAB picks the first pending row to direct WEIGHT/ENVIRONMENT into;
  // if everything's submitted, take the first row regardless. Workers
  // rarely have more than 1-3 houses, so this is the right default.
  const fabAnchor = tasks[0] || null;

  const fabItems = fabAnchor ? [
    {
      key: 'weight',
      icon: Weight,
      label: t('worker.tasks.addWeight', 'Sample weight'),
      onPress: () => openLogSheet({ task: fabAnchor, kind: 'WEIGHT' }),
    },
    {
      key: 'environment',
      icon: Thermometer,
      label: t('worker.tasks.addEnvironment', 'Environment reading'),
      onPress: () => openLogSheet({ task: fabAnchor, kind: 'ENVIRONMENT' }),
    },
  ] : [];

  const heroExtra = (
    <View style={styles.heroIconTile}>
      <ListChecks size={26} color="#ffffff" strokeWidth={2} />
    </View>
  );

  const headerRight = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      {totalCount > 0 ? (
        <View style={styles.heroPill}>
          <Text style={styles.heroPillText}>
            {t('worker.tasks.progress', '{{done}} / {{total}}', {
              done: submittedCount,
              total: totalCount,
            })}
          </Text>
        </View>
      ) : null}
      <SyncIconButton />
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
      <HeroSheetScreen
        title={t('worker.tasks.title', "Today's Tasks")}
        subtitle={
          totalCount === 0
            ? t('worker.tasks.subtitleEmpty', 'No assigned houses yet')
            : submittedCount === totalCount
              ? t('worker.tasks.subtitleAllDone', 'All caught up — great work!')
              : t('worker.tasks.subtitlePending', '{{n}} houses still need a daily log', {
                  n: totalCount - submittedCount,
                })
        }
        showBack={false}
        heroExtra={heroExtra}
        headerRight={headerRight}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={accentColor}
            colors={[accentColor]}
            progressBackgroundColor={dark ? 'hsl(150, 18%, 14%)' : '#ffffff'}
          />
        }
      >
        {totalCount === 0 ? (
          <SheetSection>
            <EmptyState
              icon={hasAssignments ? ClipboardList : Home}
              title={
                hasAssignments
                  ? t('worker.tasks.noActiveTitle', 'Nothing to log right now')
                  : t('worker.noAssignmentsTitle', 'No houses assigned')
              }
              description={
                hasAssignments
                  ? t(
                      'worker.tasks.noActiveDesc',
                      'None of your assigned houses have an active batch yet. Tasks will appear here as soon as a batch starts.'
                    )
                  : t(
                      'worker.noAssignmentsDesc',
                      'Ask your supervisor to assign you to one or more houses to start recording daily logs.'
                    )
              }
            />
          </SheetSection>
        ) : (
          farmGroups.map((group) => (
            <SheetSection
              key={group.farmId}
              title={group.farmName}
              padded={false}
            >
              {group.tasks.map((task, idx) => (
                <View
                  key={task.houseId}
                  style={
                    idx > 0
                      ? { borderTopWidth: 1, borderTopColor: sectionBorder }
                      : null
                  }
                >
                  <TaskRow
                    task={task}
                    tokens={tokens}
                    isRTL={isRTL}
                    t={t}
                    onPress={() => openLogSheet({ task, kind: 'DAILY' })}
                  />
                </View>
              ))}
            </SheetSection>
          ))
        )}
      </HeroSheetScreen>

      {logSheet === null && fabItems.length > 0 ? (
        <QuickAddFAB
          items={fabItems}
          bottomInset={insets.bottom + 49}
        />
      ) : null}

      <DailyLogSheet
        open={!!logSheet}
        onClose={() => setLogSheet(null)}
        batchId={logSheet?.batchId}
        houses={logSheet?.houses || []}
        editData={logSheet?.editData || undefined}
        defaultLogType={logSheet?.defaultLogType}
        defaultHouseId={logSheet?.defaultHouseId}
      />
    </View>
  );
}

function TaskRow({ task, tokens, isRTL, t, onPress }) {
  const { textColor, mutedColor, accentColor, dark, errorColor } = tokens;
  const submitted = task.status === 'submitted';
  const StatusIcon = submitted ? CheckCircle2 : Circle;
  const ForwardChevron = isRTL ? ChevronLeft : ChevronRight;
  const statusColor = submitted ? accentColor : (dark ? '#fbbf24' : '#d97706');

  const ctaLabel = submitted
    ? t('worker.tasks.viewDaily', 'View today\'s log')
    : t('worker.tasks.logDaily', 'Log daily');

  const subline = task.batch
    ? `${task.batch.batchName} · ${
        t('worker.tasks.day', 'Day {{n}}', {
          n: task.batch.cycleDay ?? deriveCycleDay(task.batch),
        })
      }`
    : t('worker.noActiveBatch', 'No active batch');

  return (
    <Pressable
      onPressIn={() => Haptics.selectionAsync().catch(() => {})}
      onPress={onPress}
      android_ripple={{
        color: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
        borderless: false,
      }}
      style={({ pressed }) => ({
        backgroundColor: pressed
          ? (dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)')
          : 'transparent',
      })}
    >
      <View style={styles.rowInner}>
        <View
          style={[
            styles.row,
            { flexDirection: rowDirection(isRTL) },
          ]}
        >
          <View
            style={[
              styles.statusTile,
              {
                backgroundColor: submitted
                  ? (dark ? 'rgba(148,210,165,0.18)' : 'hsl(148, 35%, 92%)')
                  : (dark ? 'rgba(251,191,36,0.14)' : 'hsl(40, 90%, 94%)'),
              },
            ]}
          >
            <StatusIcon size={18} color={statusColor} strokeWidth={2.4} />
          </View>

          <View style={styles.textCol}>
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
              {task.house.name}
            </Text>
            <Text
              style={{
                fontSize: 12,
                fontFamily: 'Poppins-Regular',
                color: mutedColor,
                marginTop: 2,
                textAlign: textAlignStart(isRTL),
              }}
              numberOfLines={1}
            >
              {subline}
            </Text>
            <View
              style={[
                styles.ctaRow,
                { flexDirection: rowDirection(isRTL) },
              ]}
            >
              <ClipboardList size={12} color={statusColor} strokeWidth={2.4} />
              <Text
                style={{
                  fontSize: 11,
                  fontFamily: 'Poppins-SemiBold',
                  color: statusColor,
                  letterSpacing: 0.2,
                  textTransform: 'uppercase',
                }}
              >
                {ctaLabel}
              </Text>
            </View>
          </View>

          <ForwardChevron size={18} color={mutedColor} strokeWidth={2.2} />
        </View>
      </View>
    </Pressable>
  );
}

// Best-effort cycle-day fallback when the synced batch payload doesn't
// include a precomputed `cycleDay` (some module list endpoints omit it
// from the lean projection). Computed off `startDate` if present.
function deriveCycleDay(batch) {
  if (!batch?.startDate) return 1;
  const start = new Date(batch.startDate);
  const now = new Date();
  const ms = now.getTime() - start.getTime();
  return Math.max(1, Math.floor(ms / (1000 * 60 * 60 * 24)) + 1);
}

const styles = StyleSheet.create({
  heroIconTile: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  heroPillText: {
    fontSize: 11,
    fontFamily: 'Poppins-SemiBold',
    color: '#ffffff',
    letterSpacing: 0.4,
    fontVariant: ['tabular-nums'],
  },
  rowInner: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  row: {
    alignItems: 'center',
    gap: 14,
  },
  statusTile: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textCol: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  ctaRow: {
    alignItems: 'center',
    gap: 5,
    marginTop: 6,
  },
});
