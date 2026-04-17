import { useState, useMemo } from 'react';
import { View, Text, FlatList, RefreshControl, Pressable, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Layers, Plus, Warehouse } from 'lucide-react-native';
import useLocalQuery from '@/hooks/useLocalQuery';
import useOfflineMutation from '@/hooks/useOfflineMutation';
import useThemeStore from '@/stores/themeStore';
import SearchInput from '@/components/ui/SearchInput';
import EmptyState from '@/components/ui/EmptyState';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import Select from '@/components/ui/Select';
import CollapsibleSection from '@/components/CollapsibleSection';
import { SkeletonRow } from '@/components/skeletons';
import { useToast } from '@/components/ui/Toast';
import { deltaSync } from '@/lib/syncEngine';
import BatchSheet from '@/modules/broiler/sheets/BatchSheet';
import BatchRow from '@/modules/broiler/components/BatchRow';
import FarmCountPill from '@/modules/broiler/components/FarmCountPill';
import { getStatusConfig } from '@/modules/broiler/lib/batchStatusConfig';

export default function BatchesScreen() {
  const { t } = useTranslation();
  const { resolvedTheme } = useThemeStore();
  const insets = useSafeAreaInsets();
  const { toast } = useToast();
  const { remove } = useOfflineMutation('batches');

  const [searchQuery, setSearchQuery] = useState('');
  const [farmFilter, setFarmFilter] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [batchSheet, setBatchSheet] = useState({ open: false, data: null });
  const [batchToDelete, setBatchToDelete] = useState(null);

  const [allBatches, batchesLoading] = useLocalQuery('batches');
  const [farms] = useLocalQuery('farms');
  const [allSaleOrders] = useLocalQuery('saleOrders');

  const primaryColor = resolvedTheme === 'dark' ? 'hsl(148, 48%, 38%)' : 'hsl(148, 60%, 20%)';

  const farmsById = useMemo(
    () => Object.fromEntries(farms.map((f) => [f._id, f])),
    [farms]
  );

  const resolveFarm = (batch) => {
    if (batch.farm && typeof batch.farm === 'object') return batch.farm;
    return farmsById[batch.farm] || null;
  };

  const lastSaleDateByBatch = useMemo(() => {
    const map = {};
    (allSaleOrders || []).forEach((sale) => {
      const batchId = sale.batch?._id || sale.batch;
      if (!batchId || !sale.saleDate) return;
      const d = new Date(sale.saleDate);
      if (!map[batchId] || d > map[batchId]) map[batchId] = d;
    });
    return map;
  }, [allSaleOrders]);

  const batchesByFarmFilter = useMemo(() => {
    if (!farmFilter) return allBatches;
    return allBatches.filter((b) => (b.farm?._id ?? b.farm) === farmFilter);
  }, [allBatches, farmFilter]);

  const filteredBatches = useMemo(() => {
    if (!searchQuery.trim()) return batchesByFarmFilter;
    const q = searchQuery.toLowerCase();
    return batchesByFarmFilter.filter((b) => {
      if (b.batchName?.toLowerCase().includes(q)) return true;
      const farm = resolveFarm(b);
      return (
        farm?.farmName?.toLowerCase().includes(q) ||
        farm?.nickname?.toLowerCase().includes(q)
      );
    });
  }, [batchesByFarmFilter, searchQuery, farmsById]);

  const groupedByFarm = useMemo(() => {
    const groups = {};
    filteredBatches.forEach((batch) => {
      const farm = resolveFarm(batch);
      const farmId = farm?._id || '_uncategorized';
      const farmName = farm?.farmName || t('common.uncategorized', 'Uncategorized');
      if (!groups[farmId]) {
        groups[farmId] = { farmId, farmName, batches: [] };
      }
      groups[farmId].batches.push(batch);
    });

    return Object.values(groups)
      .map((group) => {
        group.batches.sort(
          (a, b) => new Date(b.startDate || 0) - new Date(a.startDate || 0)
        );
        return group;
      })
      .sort((a, b) => {
        if (a.farmId === '_uncategorized') return 1;
        if (b.farmId === '_uncategorized') return -1;
        const aDate = a.batches[0]?.startDate ? new Date(a.batches[0].startDate) : new Date(0);
        const bDate = b.batches[0]?.startDate ? new Date(b.batches[0].startDate) : new Date(0);
        return bDate - aDate;
      });
  }, [filteredBatches, farmsById, t]);

  const farmFilterOptions = useMemo(
    () => [
      { value: '', label: t('common.all', 'All') },
      ...farms.map((f) => ({
        value: f._id,
        label: f.farmName,
        description: f.nickname || '',
      })),
    ],
    [farms, t]
  );

  const onRefresh = async () => {
    setRefreshing(true);
    try { await deltaSync(); } catch (e) { console.error(e); }
    setRefreshing(false);
  };

  const openCreate = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setBatchSheet({ open: true, data: null });
  };

  const openEdit = (batch) => {
    setBatchSheet({ open: true, data: batch });
  };

  const requestDelete = (batch) => {
    setBatchToDelete(batch);
  };

  const confirmDelete = async () => {
    if (!batchToDelete) return;
    try {
      await remove(batchToDelete._id);
      toast({ title: t('batches.batchDeleted', 'Batch deleted') });
    } catch (e) {
      console.error(e);
      toast({
        title: t('batches.deleteError', 'Failed to delete batch'),
        variant: 'destructive',
      });
    } finally {
      setBatchToDelete(null);
    }
  };

  const showToolbar = allBatches.length > 0 || farmFilter;
  const isInitialLoading = batchesLoading && allBatches.length === 0;
  const isEmpty = !isInitialLoading && filteredBatches.length === 0;
  const isEmptyClean = isEmpty && !searchQuery && !farmFilter;
  const fabBottom = insets.bottom + 72;

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <View className="px-4 pt-3 pb-3">
        <Text className="text-2xl font-bold text-foreground">
          {t('batches.title', 'Batches')}
        </Text>
        <Text className="text-sm text-muted-foreground mt-0.5">
          {t('batches.subtitle', 'Manage your broiler production cycles')}
        </Text>
      </View>

      {showToolbar && (
        <View className="px-4 pb-3 gap-2">
          <SearchInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder={t('batches.searchPlaceholder', 'Search batches...')}
          />
          <Select
            value={farmFilter}
            onValueChange={setFarmFilter}
            options={farmFilterOptions}
            placeholder={t('batches.filterByFarm', 'All Farms')}
            label={t('batches.filterByFarm', 'All Farms')}
          />
        </View>
      )}

      {isInitialLoading ? (
        <View className="px-4">
          {[1, 2, 3, 4, 5].map((i) => <SkeletonRow key={i} />)}
        </View>
      ) : isEmptyClean ? (
        <EmptyState
          icon={Layers}
          title={t('batches.noBatches', 'No batches yet')}
          description={t(
            'batches.noBatchesDesc',
            'Create your first batch to start tracking a production cycle.'
          )}
          actionLabel={t('batches.addFirstBatch', 'Create First Batch')}
          onAction={openCreate}
        />
      ) : isEmpty ? (
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-sm text-muted-foreground text-center">
            {t('common.noResults', 'No results found')}
          </Text>
        </View>
      ) : (
        <FlatList
          data={groupedByFarm}
          keyExtractor={(group) => group.farmId}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingBottom: insets.bottom + 96,
            gap: 12,
          }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={primaryColor}
            />
          }
          renderItem={({ item: group }) => (
            <CollapsibleSection
              title={group.farmName}
              icon={Warehouse}
              defaultOpen
              headerExtra={
                <FarmCountPill
                  count={group.batches.length}
                  link={group.farmId !== '_uncategorized'}
                  onLinkPress={() => router.push('/(app)/farms-list')}
                />
              }
            >
              <View>
                {group.batches.map((batch, idx) => {
                  const farm = resolveFarm(batch);
                  const displayName =
                    batch.batchName ||
                    (farm
                      ? `${farm.nickname || farm.farmName?.substring(0, 8).toUpperCase()}-B${batch.sequenceNumber ?? '?'}`
                      : t('batches.addBatch', 'New Batch'));
                  const avatarLetter = (
                    farm?.nickname || farm?.farmName || '?'
                  )[0].toUpperCase();
                  const batchNum = batch.sequenceNumber ?? '';
                  const status = getStatusConfig(batch.status);

                  let daySubline = '';
                  if (batch.startDate) {
                    const start = new Date(batch.startDate);
                    const end = batch.status === 'COMPLETE'
                      ? (lastSaleDateByBatch[batch._id] || start)
                      : new Date();
                    const days = Math.max(0, Math.floor((end - start) / 86400000));
                    daySubline = batch.status === 'COMPLETE'
                      ? `${days} days`
                      : `Day ${days}`;
                  }

                  return (
                    <BatchRow
                      key={batch._id}
                      batch={batch}
                      status={status}
                      avatarLetter={avatarLetter}
                      batchNum={batchNum}
                      displayName={displayName}
                      daySubline={daySubline}
                      onPress={(b) => router.push(`/(app)/batch/${b._id}`)}
                      onEdit={openEdit}
                      onDelete={requestDelete}
                      isLast={idx === group.batches.length - 1}
                    />
                  );
                })}
              </View>
            </CollapsibleSection>
          )}
        />
      )}

      {!batchSheet.open && (
        <Pressable
          onPress={openCreate}
          className="absolute right-4 h-14 w-14 rounded-full bg-primary items-center justify-center active:opacity-90"
          style={{
            bottom: fabBottom,
            ...Platform.select({
              ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.18,
                shadowRadius: 8,
              },
              android: { elevation: 6 },
            }),
          }}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t('batches.addBatch', 'New Batch')}
        >
          <Plus size={26} color="hsl(140, 20%, 97%)" strokeWidth={2.4} />
        </Pressable>
      )}

      <BatchSheet
        open={batchSheet.open}
        onClose={() => setBatchSheet({ open: false, data: null })}
        editData={batchSheet.data}
      />

      <ConfirmDialog
        open={!!batchToDelete}
        onOpenChange={(o) => { if (!o) setBatchToDelete(null); }}
        title={t('batches.deleteTitle', 'Delete Batch')}
        description={t(
          'batches.deleteWarning',
          'This will permanently delete this batch. This action cannot be undone.'
        )}
        confirmLabel={t('common.delete', 'Delete')}
        cancelLabel={t('common.cancel', 'Cancel')}
        onConfirm={confirmDelete}
      />
    </View>
  );
}
