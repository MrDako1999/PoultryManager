import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import PagerView from 'react-native-pager-view';
import { Warehouse } from 'lucide-react-native';
import useLocalRecord from '@/hooks/useLocalRecord';
import useLocalQuery from '@/hooks/useLocalQuery';
import useCapabilities from '@/hooks/useCapabilities';
import useOfflineMutation from '@/hooks/useOfflineMutation';
import { useToast } from '@/components/ui/Toast';
import EmptyState from '@/components/ui/EmptyState';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import Tabs from '@/components/ui/Tabs';
import { SkeletonFarmDetail } from '@/components/skeletons';
import { useHeroSheetTokens } from '@/components/HeroSheetScreen';
import FarmDetailHeader from '@/shared/components/FarmDetailHeader';
import FarmSheet from '@/shared/sheets/FarmSheet';
import FarmOverviewTab from './farmTabs/FarmOverviewTab';
import FarmPerformanceTab from './farmTabs/FarmPerformanceTab';
import FarmSourcesTab from './farmTabs/FarmSourcesTab';
import FarmFeedOrdersTab from './farmTabs/FarmFeedOrdersTab';
import FarmSalesTab from './farmTabs/FarmSalesTab';
import FarmExpensesTab from './farmTabs/FarmExpensesTab';

export default function FarmDetailScreen() {
  const { id } = useLocalSearchParams();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { can } = useCapabilities();
  const { toast } = useToast();
  const { remove } = useOfflineMutation('farms');
  const { screenBg } = useHeroSheetTokens();

  const canEdit = can('farm:update');
  const canDelete = can('farm:delete');

  const [farm, farmLoading] = useLocalRecord('farms', id);
  const [houses] = useLocalQuery('houses', { farm: id });
  const [allBatches] = useLocalQuery('batches');
  const [allDailyLogs, dailyLogsLoading] = useLocalQuery('dailyLogs');
  const [allSaleOrders, saleOrdersLoading] = useLocalQuery('saleOrders');
  const [allExpenses, expensesLoading] = useLocalQuery('expenses');
  const [allSources, sourcesLoading] = useLocalQuery('sources');
  const [allFeedOrders, feedOrdersLoading] = useLocalQuery('feedOrders');

  const [editOpen, setEditOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  // Pager <-> tab state sync. Mirrors the BatchDetail recipe to avoid the
  // feedback loop where a programmatic setPage() echoes a swipe-driven
  // selection back into the pager.
  const pagerRef = useRef(null);
  const pagerIndexRef = useRef(0);
  const pagerProgress = useRef(new Animated.Value(0)).current;
  const handlePageScroll = (e) => {
    const { position, offset } = e.nativeEvent;
    pagerProgress.setValue(position + offset);
  };

  const farmBatches = useMemo(
    () => allBatches.filter((b) => {
      const farmId = typeof b.farm === 'object' ? b.farm?._id : b.farm;
      return farmId === id;
    }),
    [allBatches, id]
  );

  const farmBatchIds = useMemo(
    () => new Set(farmBatches.map((b) => b._id)),
    [farmBatches]
  );

  // Filter helper: a record belongs to this farm if its batch is in our
  // farmBatchIds set. Used for sources / feedOrders / sales / expenses.
  const inFarm = (record) => {
    const batchId = typeof record.batch === 'object' ? record.batch?._id : record.batch;
    return farmBatchIds.has(batchId);
  };

  const farmSources = useMemo(
    () => allSources.filter(inFarm),
    [allSources, farmBatchIds] // eslint-disable-line react-hooks/exhaustive-deps
  );
  const farmFeedOrders = useMemo(
    () => allFeedOrders.filter(inFarm),
    [allFeedOrders, farmBatchIds] // eslint-disable-line react-hooks/exhaustive-deps
  );
  const farmSales = useMemo(
    () => allSaleOrders.filter(inFarm),
    [allSaleOrders, farmBatchIds] // eslint-disable-line react-hooks/exhaustive-deps
  );
  const farmExpenses = useMemo(
    () => allExpenses.filter(inFarm),
    [allExpenses, farmBatchIds] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const batchOptions = useMemo(() => {
    const opts = [{ value: 'ALL', label: t('farms.allBatches', 'All Batches') }];
    farmBatches
      .slice()
      .sort((a, b) => new Date(b.startDate || 0) - new Date(a.startDate || 0))
      .forEach((b) => {
        opts.push({
          value: b._id,
          label: b.batchName || `B${b.sequenceNumber ?? '?'}`,
        });
      });
    return opts;
  }, [farmBatches, t]);

  const visibleTabs = useMemo(() => ([
    { key: 'overview', label: t('farms.overviewTab', 'Overview') },
    { key: 'performance', label: t('farms.performanceTab', 'Performance') },
    { key: 'sources', label: t('farms.sourcesTab', 'Sources') },
    { key: 'feedOrders', label: t('farms.feedOrdersTab', 'Feed Orders') },
    { key: 'sales', label: t('farms.salesTab', 'Sales') },
    { key: 'expenses', label: t('farms.expensesTab', 'Expenses') },
  ]), [t]);

  const [activeKey, setActiveKey] = useState('overview');
  const [sourcesBatchFilter, setSourcesBatchFilter] = useState('ALL');
  const [feedOrdersBatchFilter, setFeedOrdersBatchFilter] = useState('ALL');
  const [salesBatchFilter, setSalesBatchFilter] = useState('ALL');
  const [expensesBatchFilter, setExpensesBatchFilter] = useState('ALL');

  // Seed the pager-index ref + progress with the initial page on mount so
  // the sync effect below doesn't issue a redundant setPage() after mount.
  useEffect(() => {
    const idx = Math.max(0, visibleTabs.findIndex((tab) => tab.key === activeKey));
    pagerIndexRef.current = idx;
    pagerProgress.setValue(idx);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const idx = visibleTabs.findIndex((tab) => tab.key === activeKey);
    if (idx < 0 || !pagerRef.current) return;
    if (idx === pagerIndexRef.current) return;
    pagerIndexRef.current = idx;
    pagerRef.current.setPage(idx);
  }, [activeKey, visibleTabs]);

  if (farmLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: screenBg, paddingTop: insets.top }}>
        <SkeletonFarmDetail />
      </View>
    );
  }

  if (!farm) {
    return (
      <View style={{ flex: 1, backgroundColor: screenBg, paddingTop: insets.top }}>
        <EmptyState
          icon={Warehouse}
          title={t('farms.unknownFarm', 'Farm')}
          actionLabel={t('farms.backToFarms', 'Back to Farms')}
          onAction={() => router.back()}
        />
      </View>
    );
  }

  const handleDelete = async () => {
    if (!farm?._id) return;
    try {
      await remove(farm._id);
      toast({ title: t('farms.farmDeleted', 'Farm removed') });
      setConfirmDeleteOpen(false);
      router.back();
    } catch (e) {
      console.error('[FarmDetail] delete failed', e);
      toast({
        title: t('farms.deleteError', 'Failed to remove farm'),
        variant: 'destructive',
      });
    }
  };

  const initialPage = Math.max(0, visibleTabs.findIndex((tab) => tab.key === activeKey));

  return (
    <View style={{ flex: 1, backgroundColor: screenBg }}>
      <FarmDetailHeader
        farm={farm}
        onEdit={() => setEditOpen(true)}
        canEdit={canEdit}
      />

      <Tabs
        tabs={visibleTabs}
        value={activeKey}
        onChange={setActiveKey}
        position={pagerProgress}
      />

      <PagerView
        ref={pagerRef}
        style={{ flex: 1 }}
        initialPage={initialPage}
        onPageScroll={handlePageScroll}
        onPageSelected={(e) => {
          const idx = e.nativeEvent.position;
          pagerIndexRef.current = idx;
          pagerProgress.setValue(idx);
          const next = visibleTabs[idx]?.key;
          if (next && next !== activeKey) setActiveKey(next);
        }}
      >
        {visibleTabs.map((tab) => (
          <View key={tab.key} style={{ flex: 1 }}>
            {tab.key === 'overview' && (
              <FarmOverviewTab
                farm={farm}
                houses={houses}
                farmBatches={farmBatches}
                allDailyLogs={allDailyLogs}
                allSaleOrders={allSaleOrders}
                allExpenses={allExpenses}
              />
            )}
            {tab.key === 'performance' && (
              <FarmPerformanceTab
                houses={houses}
                farmBatches={farmBatches}
                allDailyLogs={allDailyLogs}
                dailyLogsLoading={dailyLogsLoading}
              />
            )}
            {tab.key === 'sources' && (
              <FarmSourcesTab
                sources={farmSources}
                loading={sourcesLoading}
                batchOptions={batchOptions}
                batchFilter={sourcesBatchFilter}
                onBatchFilterChange={setSourcesBatchFilter}
              />
            )}
            {tab.key === 'feedOrders' && (
              <FarmFeedOrdersTab
                feedOrders={farmFeedOrders}
                loading={feedOrdersLoading}
                batchOptions={batchOptions}
                batchFilter={feedOrdersBatchFilter}
                onBatchFilterChange={setFeedOrdersBatchFilter}
              />
            )}
            {tab.key === 'sales' && (
              <FarmSalesTab
                sales={farmSales}
                loading={saleOrdersLoading}
                batchOptions={batchOptions}
                batchFilter={salesBatchFilter}
                onBatchFilterChange={setSalesBatchFilter}
              />
            )}
            {tab.key === 'expenses' && (
              <FarmExpensesTab
                expenses={farmExpenses}
                loading={expensesLoading}
                batchOptions={batchOptions}
                batchFilter={expensesBatchFilter}
                onBatchFilterChange={setExpensesBatchFilter}
              />
            )}
          </View>
        ))}
      </PagerView>

      <FarmSheet
        open={editOpen}
        onClose={() => setEditOpen(false)}
        editData={farm}
        onDelete={() => setConfirmDeleteOpen(true)}
        canDelete={canDelete}
      />

      <ConfirmDialog
        open={confirmDeleteOpen}
        onOpenChange={setConfirmDeleteOpen}
        title={t('farms.deleteFarmTitle', 'Delete Farm')}
        description={t(
          'farms.deleteFarmWarning',
          'This will permanently delete this farm and cannot be undone.'
        )}
        confirmLabel={t('common.delete', 'Delete')}
        cancelLabel={t('common.cancel', 'Cancel')}
        onConfirm={handleDelete}
      />
    </View>
  );
}
