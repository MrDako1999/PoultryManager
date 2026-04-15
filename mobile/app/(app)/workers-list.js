import { useState } from 'react';
import { View, Text, ScrollView, Pressable, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import { Users, ChevronLeft, ChevronRight } from 'lucide-react-native';
import useLocalQuery from '../../hooks/useLocalQuery';
import useThemeStore from '../../stores/themeStore';
import SearchInput from '../../components/ui/SearchInput';
import EmptyState from '../../components/ui/EmptyState';
import { SkeletonRow } from '../../components/skeletons';
import { deltaSync } from '../../lib/syncEngine';

export default function WorkersListScreen() {
  const { t } = useTranslation();
  const { resolvedTheme } = useThemeStore();
  const insets = useSafeAreaInsets();
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const [workers, workersLoading] = useLocalQuery('workers');
  const primaryColor = resolvedTheme === 'dark' ? 'hsl(148, 48%, 38%)' : 'hsl(148, 60%, 20%)';
  const mutedColor = 'hsl(150, 10%, 45%)';

  const onRefresh = async () => {
    setRefreshing(true);
    try { await deltaSync(); } catch (e) { console.error(e); }
    setRefreshing(false);
  };

  const q = searchQuery.toLowerCase();
  const filtered = q ? workers.filter((w) => `${w.firstName} ${w.lastName}`.toLowerCase().includes(q)) : workers;

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <View className="flex-row items-center px-2 pt-2 pb-3">
        <Pressable onPress={() => router.back()} className="p-2 -ml-1 active:opacity-60">
          <ChevronLeft size={24} color={primaryColor} />
        </Pressable>
        <Text className="text-xl font-bold text-foreground flex-1">
          {t('nav.workers', 'Workers')}
        </Text>
        <Text className="text-sm text-muted-foreground mr-2">{workers.length}</Text>
      </View>

      <View className="px-4 pb-3">
        <SearchInput value={searchQuery} onChangeText={setSearchQuery} placeholder={t('common.search', 'Search...')} />
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={primaryColor} />}
      >
        {workersLoading && workers.length === 0 ? (
          <View>{[1,2,3,4,5,6].map(i => <SkeletonRow key={i} />)}</View>
        ) : filtered.length === 0 ? (
          <EmptyState
            title={searchQuery ? t('common.noResults', 'No results') : t('workers.noWorkers', 'No workers')}
            description={!searchQuery ? t('workers.noWorkersDesc', 'Sync your data to see workers here.') : undefined}
          />
        ) : (
          filtered.map((worker) => (
            <Pressable
              key={worker._id}
              onPress={() => router.push(`/(app)/worker/${worker._id}`)}
              className="flex-row items-center px-4 py-3 border-b border-border active:bg-accent/50"
            >
              <View className="h-10 w-10 rounded-full bg-muted items-center justify-center mr-3">
                <Users size={18} color={mutedColor} />
              </View>
              <View className="flex-1 min-w-0">
                <Text className="text-sm font-medium text-foreground" numberOfLines={1}>
                  {worker.firstName} {worker.lastName}
                </Text>
                {worker.role && <Text className="text-xs text-muted-foreground mt-0.5">{worker.role}</Text>}
              </View>
              <ChevronRight size={16} color={mutedColor} />
            </Pressable>
          ))
        )}
      </ScrollView>
    </View>
  );
}
