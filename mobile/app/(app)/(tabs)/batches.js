import { useState, useMemo } from 'react';
import { View, Text, ScrollView, Pressable, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import { Layers, Plus, Warehouse, Calendar, Home } from 'lucide-react-native';
import useLocalQuery from '../../../hooks/useLocalQuery';
import useThemeStore from '../../../stores/themeStore';
import { Badge } from '../../../components/ui/Badge';
import SearchInput from '../../../components/ui/SearchInput';
import EmptyState from '../../../components/ui/EmptyState';
import { STATUS_VARIANTS } from '../../../lib/constants';
import { deltaSync } from '../../../lib/syncEngine';
import BatchSheet from '../../../components/sheets/BatchSheet';
import { SkeletonRow } from '../../../components/skeletons';

export default function BatchesScreen() {
  const { t } = useTranslation();
  const { resolvedTheme } = useThemeStore();
  const insets = useSafeAreaInsets();
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [batchSheet, setBatchSheet] = useState({ open: false, data: null });

  const [batches, batchesLoading] = useLocalQuery('batches');
  const [farms] = useLocalQuery('farms');

  const farmsById = useMemo(
    () => Object.fromEntries(farms.map((f) => [f._id, f])),
    [farms]
  );

  const filteredBatches = useMemo(() => {
    if (!searchQuery) return batches;
    const q = searchQuery.toLowerCase();
    return batches.filter((b) =>
      b.batchName?.toLowerCase().includes(q) ||
      (farmsById[b.farm]?.farmName || b.farm?.farmName || '').toLowerCase().includes(q)
    );
  }, [batches, searchQuery, farmsById]);

  const sortedBatches = useMemo(
    () => [...filteredBatches].sort((a, b) => new Date(b.startDate || 0) - new Date(a.startDate || 0)),
    [filteredBatches]
  );

  const primaryColor = resolvedTheme === 'dark' ? 'hsl(148, 48%, 38%)' : 'hsl(148, 60%, 20%)';
  const mutedColor = 'hsl(150, 10%, 45%)';

  const onRefresh = async () => {
    setRefreshing(true);
    try { await deltaSync(); } catch (e) { console.error(e); }
    setRefreshing(false);
  };

  const resolveFarm = (batch) => {
    if (batch.farm && typeof batch.farm === 'object') return batch.farm;
    return farmsById[batch.farm] || null;
  };

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <View className="px-4 pt-2 pb-3">
        <View className="flex-row items-center justify-between mb-3">
          <Text className="text-xl font-bold text-foreground">{t('nav.batches')}</Text>
          <Pressable
            onPress={() => setBatchSheet({ open: true, data: null })}
            className="h-9 w-9 rounded-md bg-primary items-center justify-center"
          >
            <Plus size={18} color="#f5f8f5" />
          </Pressable>
        </View>
        <SearchInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder={t('batches.searchPlaceholder', 'Search batches...')}
        />
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: insets.bottom + 16, paddingHorizontal: 16 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={primaryColor} />}
      >
        {batchesLoading && batches.length === 0 ? (
          <View>{[1,2,3,4,5].map(i => <SkeletonRow key={i} />)}</View>
        ) : sortedBatches.length === 0 ? (
          <EmptyState
            icon={Layers}
            title={searchQuery ? t('common.noResults', 'No results') : t('batches.noBatches', 'No batches yet')}
            description={searchQuery ? t('common.tryDifferentSearch', 'Try a different search') : t('batches.noBatchesDesc', 'Create your first batch to get started')}
            actionLabel={!searchQuery ? t('batches.addBatch') : undefined}
            onAction={!searchQuery ? () => setBatchSheet({ open: true, data: null }) : undefined}
          />
        ) : (
          sortedBatches.map((batch) => {
            const farm = resolveFarm(batch);
            const birds = (batch.houses || []).reduce((s, h) => s + (h.quantity || 0), 0);
            const houseCount = (batch.houses || []).length;

            return (
              <Pressable
                key={batch._id}
                onPress={() => router.push(`/(app)/batch/${batch._id}`)}
                className="rounded-lg border border-border bg-card p-3 mb-2 active:bg-accent/50"
              >
                <View className="flex-row items-start justify-between mb-1">
                  <View className="flex-1 min-w-0 mr-2">
                    <Text className="text-sm font-semibold text-foreground" numberOfLines={1}>
                      {batch.batchName}
                    </Text>
                  </View>
                  <Badge variant={STATUS_VARIANTS[batch.status] || 'secondary'}>
                    <Text className="text-[10px] font-medium">
                      {t(`batches.statuses.${batch.status}`, batch.status)}
                    </Text>
                  </Badge>
                </View>

                <View className="flex-row items-center gap-3 mt-1">
                  {farm?.farmName && (
                    <View className="flex-row items-center gap-1">
                      <Warehouse size={12} color={mutedColor} />
                      <Text className="text-xs text-muted-foreground" numberOfLines={1}>{farm.farmName}</Text>
                    </View>
                  )}
                  <View className="flex-row items-center gap-1">
                    <Calendar size={12} color={mutedColor} />
                    <Text className="text-xs text-muted-foreground">
                      {batch.startDate ? new Date(batch.startDate).toLocaleDateString() : '—'}
                    </Text>
                  </View>
                </View>

                <View className="flex-row items-center gap-3 mt-1.5">
                  <View className="flex-row items-center gap-1">
                    <Home size={12} color={mutedColor} />
                    <Text className="text-xs text-muted-foreground">{houseCount} {t('farms.houses', 'houses')}</Text>
                  </View>
                  <Text className="text-xs text-muted-foreground">
                    {birds.toLocaleString()} {t('farms.birds', 'birds')}
                  </Text>
                </View>
              </Pressable>
            );
          })
        )}
      </ScrollView>

      <BatchSheet
        open={batchSheet.open}
        onClose={() => setBatchSheet({ open: false, data: null })}
        editData={batchSheet.data}
      />
    </View>
  );
}
