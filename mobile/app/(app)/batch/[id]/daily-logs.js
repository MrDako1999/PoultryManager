import { useState, useMemo } from 'react';
import { View, Text, ScrollView, Pressable, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ClipboardList, Plus } from 'lucide-react-native';
import useLocalRecord from '../../../../hooks/useLocalRecord';
import useLocalQuery from '../../../../hooks/useLocalQuery';
import useThemeStore from '../../../../stores/themeStore';
import SearchInput from '../../../../components/ui/SearchInput';
import EmptyState from '../../../../components/ui/EmptyState';
import DailyLogRow from '../../../../components/rows/DailyLogRow';
import { SkeletonRow } from '../../../../components/skeletons';
import { deltaSync } from '../../../../lib/syncEngine';
import DailyLogSheet from '../../../../components/sheets/DailyLogSheet';

export default function BatchDailyLogsScreen() {
  const { id } = useLocalSearchParams();
  const { t } = useTranslation();
  const { resolvedTheme } = useThemeStore();
  const insets = useSafeAreaInsets();
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [sheet, setSheet] = useState({ open: false, data: null });

  const [batch] = useLocalRecord('batches', id);
  const [dailyLogs, logsLoading] = useLocalQuery('dailyLogs', { batch: id });
  const primaryColor = resolvedTheme === 'dark' ? 'hsl(148, 48%, 38%)' : 'hsl(148, 60%, 20%)';

  const houses = batch?.houses || [];

  const onRefresh = async () => {
    setRefreshing(true);
    try { await deltaSync(); } catch (e) { console.error(e); }
    setRefreshing(false);
  };

  const q = searchQuery.toLowerCase();

  const sortedLogs = useMemo(() => {
    const sorted = [...dailyLogs].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
    if (!q) return sorted;
    return sorted.filter((log) =>
      (log.logType || '').toLowerCase().includes(q) ||
      (log.notes || '').toLowerCase().includes(q)
    );
  }, [dailyLogs, q]);

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <View className="flex-row items-center px-2 pt-2 pb-3">
        <Pressable onPress={() => router.back()} className="p-2 -ml-1 active:opacity-60">
          <ChevronLeft size={24} color={primaryColor} />
        </Pressable>
        <Text className="text-xl font-bold text-foreground flex-1">
          {t('batches.operationsTab')}
        </Text>
        <Text className="text-sm text-muted-foreground mr-2">{dailyLogs.length}</Text>
      </View>

      <View className="px-4 pb-3">
        <SearchInput value={searchQuery} onChangeText={setSearchQuery} placeholder={t('common.search', 'Search...')} />
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={primaryColor} />}
      >
        {logsLoading && dailyLogs.length === 0 ? (
          <View className="px-4 gap-3">{[1, 2, 3, 4].map((i) => <SkeletonRow key={i} />)}</View>
        ) : sortedLogs.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title={searchQuery ? t('common.noResults', 'No results') : t('batches.noDailyLogs', 'No daily logs')}
          />
        ) : (
          <View className="px-4">
            <View className="rounded-lg border border-border bg-card overflow-hidden">
              {sortedLogs.map((log) => (
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
        style={{ bottom: insets.bottom + 16, elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4 }}
      >
        <Plus size={24} color="#fff" />
      </Pressable>

      <DailyLogSheet
        open={sheet.open}
        onClose={() => setSheet({ open: false, data: null })}
        batchId={id}
        houses={houses}
        editData={sheet.data}
      />
    </View>
  );
}
