import { useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import { ChevronLeft, ClipboardList, Plus, Home } from 'lucide-react-native';
import useLocalRecord from '@/hooks/useLocalRecord';
import useLocalQuery from '@/hooks/useLocalQuery';
import useThemeStore from '@/stores/themeStore';
import EmptyState from '@/components/ui/EmptyState';
import DailyLogRow from '@/modules/broiler/rows/DailyLogRow';
import DailyLogSheet from '@/modules/broiler/sheets/DailyLogSheet';
import { SkeletonRow } from '@/components/skeletons';
import { LOG_TYPES, LOG_TYPE_ICONS } from '@/lib/constants';
import { deltaSync } from '@/lib/syncEngine';

const MUTED = 'hsl(150, 10%, 45%)';

function FilterChips({ value, onChange, options }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
    >
      {options.map((opt) => {
        const Icon = opt.icon;
        const active = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => {
              if (active) return;
              Haptics.selectionAsync().catch(() => {});
              onChange?.(opt.value);
            }}
            className={`flex-row items-center gap-1.5 rounded-full border px-3 py-1.5 ${active ? 'bg-primary border-primary' : 'bg-card border-border'}`}
            hitSlop={4}
          >
            {Icon && (
              <Icon
                size={13}
                color={active ? '#fff' : MUTED}
              />
            )}
            <Text
              className={`text-xs font-medium ${active ? 'text-primary-foreground' : 'text-muted-foreground'}`}
              numberOfLines={1}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export default function BatchHouseLogsList() {
  const { id, houseId } = useLocalSearchParams();
  const { t } = useTranslation();
  const { resolvedTheme } = useThemeStore();
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('ALL');
  const [sheet, setSheet] = useState({ open: false, data: null });

  const [batch] = useLocalRecord('batches', id);
  const [dailyLogs, logsLoading] = useLocalQuery('dailyLogs', { batch: id });

  const primaryColor = resolvedTheme === 'dark' ? 'hsl(148, 48%, 38%)' : 'hsl(148, 60%, 20%)';

  const houses = batch?.houses || [];

  const houseInfo = useMemo(() => {
    const entry = houses.find((h) => {
      const hid = typeof h.house === 'object' ? h.house?._id : h.house;
      return hid === houseId;
    });
    if (!entry) return { id: houseId, name: 'House', initial: 0 };
    return {
      id: houseId,
      name: (typeof entry.house === 'object' ? entry.house?.name : null) || entry.name || 'House',
      initial: entry.quantity || 0,
    };
  }, [houses, houseId]);

  const houseLogs = useMemo(() => {
    return (dailyLogs || []).filter((log) => {
      if (log.deletedAt) return false;
      const lhId = log.house?._id || log.house;
      return lhId === houseId;
    });
  }, [dailyLogs, houseId]);

  const totalDeaths = useMemo(
    () => houseLogs.reduce((s, log) => s + (log.logType === 'DAILY' ? (log.deaths || 0) : 0), 0),
    [houseLogs]
  );
  const currentBirds = Math.max(0, houseInfo.initial - totalDeaths);

  const filteredLogs = useMemo(() => {
    const sorted = [...houseLogs].sort(
      (a, b) => new Date(b.logDate || b.date || 0) - new Date(a.logDate || a.date || 0)
    );
    if (filter === 'ALL') return sorted;
    return sorted.filter((log) => log.logType === filter);
  }, [houseLogs, filter]);

  const filterOptions = useMemo(
    () => [
      { value: 'ALL', label: t('batches.filterAll', 'All') },
      ...LOG_TYPES.map((type) => ({
        value: type,
        label: t(`batches.operations.logTypes.${type}`, type),
        icon: LOG_TYPE_ICONS[type],
      })),
    ],
    [t]
  );

  const onRefresh = async () => {
    setRefreshing(true);
    try { await deltaSync(); } catch (e) { console.error(e); }
    setRefreshing(false);
  };

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <View className="flex-row items-center px-2 pt-2 pb-2">
        <Pressable
          onPress={() => router.back()}
          className="p-2 -ml-1 active:opacity-60"
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={t('common.back', 'Back')}
        >
          <ChevronLeft size={24} color={primaryColor} />
        </Pressable>
        <View className="flex-1 min-w-0">
          <View className="flex-row items-center gap-1.5">
            <Home size={14} color={MUTED} />
            <Text className="text-lg font-bold text-foreground" numberOfLines={1}>
              {houseInfo.name}
            </Text>
          </View>
          <Text className="text-[11px] text-muted-foreground tabular-nums">
            {houseInfo.initial > 0
              ? `${currentBirds.toLocaleString()} / ${houseInfo.initial.toLocaleString()} ${t('farms.birds', 'birds')}`
              : t('batches.viewAllLogs', 'All Logs')}
          </Text>
        </View>
        <Text className="text-sm text-muted-foreground mr-2 tabular-nums">{houseLogs.length}</Text>
      </View>

      <View className="pb-3">
        <FilterChips value={filter} onChange={setFilter} options={filterOptions} />
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={primaryColor} />}
      >
        {logsLoading && houseLogs.length === 0 ? (
          <View className="px-4 gap-3">
            {[1, 2, 3, 4].map((i) => <SkeletonRow key={i} />)}
          </View>
        ) : filteredLogs.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title={
              filter === 'ALL'
                ? t('batches.noDailyLogs', 'No daily logs')
                : t('common.noResults', 'No results')
            }
            description={
              filter === 'ALL'
                ? t('batches.operations.noEntriesDesc', 'Add daily logs to see them here.')
                : undefined
            }
          />
        ) : (
          <View className="px-4">
            <View className="rounded-lg border border-border bg-card overflow-hidden">
              {filteredLogs.map((log) => (
                <DailyLogRow
                  key={log._id}
                  log={log}
                  t={t}
                  onClick={() => router.push(`/(app)/daily-log/${log._id}`)}
                />
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      <Pressable
        onPress={() => setSheet({ open: true, data: null })}
        className="absolute right-5 h-14 w-14 rounded-full bg-primary items-center justify-center"
        style={{
          bottom: insets.bottom + 16,
          elevation: 4,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.2,
          shadowRadius: 4,
        }}
        accessibilityRole="button"
        accessibilityLabel={t('batches.operations.addEntry', 'Add Entry')}
      >
        <Plus size={24} color="#fff" />
      </Pressable>

      <DailyLogSheet
        open={sheet.open}
        onClose={() => setSheet({ open: false, data: null })}
        batchId={id}
        batch={batch}
        houses={houses}
        editData={sheet.data}
      />
    </View>
  );
}
