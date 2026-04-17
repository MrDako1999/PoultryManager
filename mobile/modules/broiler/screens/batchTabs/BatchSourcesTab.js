import { useMemo, useState } from 'react';
import { View, Text, ScrollView, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Egg } from 'lucide-react-native';
import useLocalQuery from '@/hooks/useLocalQuery';
import useThemeStore from '@/stores/themeStore';
import SearchInput from '@/components/ui/SearchInput';
import EmptyState from '@/components/ui/EmptyState';
import SourceRow from '@/modules/broiler/rows/SourceRow';
import { SkeletonRow } from '@/components/skeletons';
import { deltaSync } from '@/lib/syncEngine';

const fmt = (val) =>
  Number(val || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function SummaryChip({ label, value }) {
  return (
    <View className="flex-1 rounded-md bg-muted/40 px-3 py-2">
      <Text className="text-[10px] text-muted-foreground" numberOfLines={1}>{label}</Text>
      <Text className="text-sm font-semibold text-foreground tabular-nums" numberOfLines={1}>{value}</Text>
    </View>
  );
}

export default function BatchSourcesTab({ batchId }) {
  const { t } = useTranslation();
  const { resolvedTheme } = useThemeStore();
  const insets = useSafeAreaInsets();
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const [sources, sourcesLoading] = useLocalQuery('sources', { batch: batchId });
  const primaryColor = resolvedTheme === 'dark' ? 'hsl(148, 48%, 38%)' : 'hsl(148, 60%, 20%)';

  const onRefresh = async () => {
    setRefreshing(true);
    try { await deltaSync(); } catch (e) { console.error(e); }
    setRefreshing(false);
  };

  const q = searchQuery.toLowerCase();
  const filtered = useMemo(() => {
    if (!q) return sources;
    return sources.filter((s) =>
      (s.sourceFrom?.companyName || '').toLowerCase().includes(q)
    );
  }, [sources, q]);

  const totalChicks = useMemo(() => sources.reduce((s, x) => s + (x.totalChicks || 0), 0), [sources]);
  const totalCost = useMemo(() => sources.reduce((s, x) => s + (x.grandTotal || 0), 0), [sources]);

  return (
    <View className="flex-1 bg-background">
      <View className="px-4 pt-3 pb-2 flex-row gap-2">
        <SummaryChip label={t('batches.entries', 'Entries')} value={sources.length} />
        <SummaryChip label={t('batches.totalChicksReceived', 'Total Chicks')} value={totalChicks.toLocaleString()} />
        <SummaryChip label={t('batches.totalCost', 'Total Cost')} value={fmt(totalCost)} />
      </View>

      <View className="px-4 pb-3">
        <SearchInput value={searchQuery} onChangeText={setSearchQuery} placeholder={t('common.search', 'Search...')} />
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: insets.bottom + 96 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={primaryColor} />}
      >
        {sourcesLoading && sources.length === 0 ? (
          <View className="px-4 gap-3">{[1, 2, 3, 4].map((i) => <SkeletonRow key={i} />)}</View>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Egg}
            title={searchQuery ? t('common.noResults', 'No results') : t('batches.noSources', 'No sources')}
          />
        ) : (
          <View className="px-4">
            <View className="rounded-lg border border-border bg-card overflow-hidden">
              {filtered.map((source) => (
                <SourceRow
                  key={source._id}
                  source={source}
                  onClick={() => router.push(`/(app)/source/${source._id}`)}
                />
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
