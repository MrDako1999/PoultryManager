import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import PagerView from 'react-native-pager-view';
import {
  Layers, Egg, DollarSign, Wheat, ShoppingCart, ClipboardList,
} from 'lucide-react-native';
import useLocalRecord from '@/hooks/useLocalRecord';
import useLocalQuery from '@/hooks/useLocalQuery';
import useCapabilities from '@/hooks/useCapabilities';
import useOfflineMutation from '@/hooks/useOfflineMutation';
import { useToast } from '@/components/ui/Toast';
import EmptyState from '@/components/ui/EmptyState';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import Tabs from '@/components/ui/Tabs';
import { SkeletonBatchDetail } from '@/components/skeletons';
import QuickAddFAB from '@/components/QuickAddFAB';
import { useHeroSheetTokens } from '@/components/HeroSheetScreen';
import BatchDetailHeader from '@/modules/broiler/components/BatchDetailHeader';
import BatchSheet from '@/modules/broiler/sheets/BatchSheet';
import SourceSheet from '@/modules/broiler/sheets/SourceSheet';
import FeedOrderSheet from '@/modules/broiler/sheets/FeedOrderSheet';
import ExpenseSheet from '@/modules/broiler/sheets/ExpenseSheet';
import SaleOrderSheet from '@/modules/broiler/sheets/SaleOrderSheet';
import DailyLogSheet from '@/modules/broiler/sheets/DailyLogSheet';
import BatchOverviewTab from './batchTabs/BatchOverviewTab';
import BatchPerformanceTab from './batchTabs/BatchPerformanceTab';
import BatchSourcesTab from './batchTabs/BatchSourcesTab';
import BatchFeedOrdersTab from './batchTabs/BatchFeedOrdersTab';
import BatchExpensesTab from './batchTabs/BatchExpensesTab';
import BatchSalesTab from './batchTabs/BatchSalesTab';

export default function BatchDetailScreen() {
  const { id, tab: deepTab } = useLocalSearchParams();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { can } = useCapabilities();
  const { toast } = useToast();
  const { remove } = useOfflineMutation('batches');
  const { screenBg } = useHeroSheetTokens();

  const pagerRef = useRef(null);
  const pagerProgress = useRef(new Animated.Value(0)).current;
  // Tracks the page index the pager itself most recently reported. Used to
  // suppress programmatic `setPage` calls in response to state updates that
  // originated from the pager (which would otherwise create a feedback loop
  // of selections and produce the runaway swipe seen on fast gestures).
  const pagerIndexRef = useRef(0);
  const handlePageScroll = (e) => {
    const { position, offset } = e.nativeEvent;
    pagerProgress.setValue(position + offset);
  };
  const handlePageSelected = (e) => {
    const idx = e.nativeEvent.position;
    pagerIndexRef.current = idx;
    pagerProgress.setValue(idx);
  };

  const [batch, batchLoading] = useLocalRecord('batches', id);
  const [farms] = useLocalQuery('farms');
  const [saleOrders] = useLocalQuery('saleOrders', { batch: id });

  const [editOpen, setEditOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [sourceSheet, setSourceSheet] = useState(false);
  const [feedOrderSheet, setFeedOrderSheet] = useState(false);
  const [expenseSheet, setExpenseSheet] = useState(false);
  const [saleSheet, setSaleSheet] = useState(false);
  const [dailyLogSheet, setDailyLogSheet] = useState(false);

  const allTabs = useMemo(
    () => [
      { key: 'overview', label: t('batches.overviewTab', 'Overview'), capability: 'batch:read' },
      { key: 'performance', label: t('batches.performanceTab', 'Performance'), capability: 'dailyLog:read' },
      { key: 'sources', label: t('batches.sourcesTab', 'Sources'), capability: 'source:read' },
      { key: 'feedOrders', label: t('batches.feedOrdersTab', 'Feed Orders'), capability: 'feedOrder:read' },
      { key: 'expenses', label: t('batches.expensesTab', 'Expenses'), capability: 'expense:read' },
      { key: 'sales', label: t('batches.salesTab', 'Sales'), capability: 'saleOrder:read' },
    ],
    [t]
  );

  const visibleTabs = useMemo(
    () => allTabs.filter((tab) => !tab.capability || can(tab.capability)),
    [allTabs, can]
  );

  const initialKey = useMemo(() => {
    if (typeof deepTab === 'string') {
      const found = visibleTabs.find((t) => t.key === deepTab);
      if (found) return found.key;
    }
    return visibleTabs[0]?.key || 'overview';
  }, [deepTab, visibleTabs]);

  const [activeKey, setActiveKey] = useState(initialKey);

  // Seed the pager-index ref and progress with the initial page on mount so
  // the sync effect below doesn't issue a redundant `setPage` after mount.
  useEffect(() => {
    const idx = Math.max(0, visibleTabs.findIndex((t) => t.key === initialKey));
    pagerIndexRef.current = idx;
    pagerProgress.setValue(idx);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!visibleTabs.find((t) => t.key === activeKey)) {
      setActiveKey(visibleTabs[0]?.key || 'overview');
    }
  }, [visibleTabs, activeKey]);

  useEffect(() => {
    const idx = visibleTabs.findIndex((t) => t.key === activeKey);
    if (idx < 0 || !pagerRef.current) return;
    // Only drive the pager when state diverges from where the pager already
    // is. This prevents echoing a swipe-driven selection back into the pager.
    if (idx === pagerIndexRef.current) return;
    pagerIndexRef.current = idx;
    pagerRef.current.setPage(idx);
  }, [activeKey, visibleTabs]);

  const farmName = useMemo(() => {
    if (!batch) return '';
    if (typeof batch.farm === 'object') return batch.farm?.farmName || '';
    const farm = farms.find((f) => f._id === batch.farm);
    return farm?.farmName || '';
  }, [batch, farms]);

  const lastSaleDate = useMemo(() => {
    if (!saleOrders.length) return null;
    return saleOrders.reduce((max, sale) => {
      if (!sale.saleDate) return max;
      const d = new Date(sale.saleDate);
      return !max || d > max ? d : max;
    }, null);
  }, [saleOrders]);

  const onJumpTab = (key) => {
    if (visibleTabs.find((t) => t.key === key)) {
      setActiveKey(key);
    }
  };

  const handleDelete = async () => {
    if (!batch?._id) return;
    try {
      await remove(batch._id);
      toast({ title: t('batches.batchDeleted', 'Batch deleted') });
      setConfirmDeleteOpen(false);
      router.back();
    } catch (e) {
      console.error(e);
      toast({ title: t('batches.deleteError', 'Failed to delete batch'), variant: 'destructive' });
    }
  };

  if (batchLoading) return <SkeletonBatchDetail />;

  if (!batch) {
    return (
      <View style={{ flex: 1, backgroundColor: screenBg, paddingTop: insets.top }}>
        <EmptyState
          icon={Layers}
          title={t('batches.notFound', 'Batch not found')}
          actionLabel={t('batches.backToBatches', 'Back to Batches')}
          onAction={() => router.back()}
        />
      </View>
    );
  }

  const canEdit = can('batch:update');
  const canDelete = can('batch:delete');
  const initialPage = Math.max(0, visibleTabs.findIndex((t) => t.key === initialKey));

  const quickAddItems = [
    can('source:create') && {
      key: 'source',
      icon: Egg,
      label: t('batches.sourcesTab', 'Sources'),
      onPress: () => setSourceSheet(true),
    },
    can('feedOrder:create') && {
      key: 'feed',
      icon: Wheat,
      label: t('batches.feedOrdersTab', 'Feed Orders'),
      onPress: () => setFeedOrderSheet(true),
    },
    can('expense:create') && {
      key: 'expense',
      icon: DollarSign,
      label: t('batches.expensesTab', 'Expenses'),
      onPress: () => setExpenseSheet(true),
    },
    can('saleOrder:create') && {
      key: 'sale',
      icon: ShoppingCart,
      label: t('batches.salesTab', 'Sales'),
      onPress: () => setSaleSheet(true),
    },
    can('dailyLog:create') && {
      key: 'dailyLog',
      icon: ClipboardList,
      label: t('batches.performanceTab', 'Performance'),
      onPress: () => setDailyLogSheet(true),
    },
  ].filter(Boolean);

  // On non-overview tabs the FAB becomes a single-action button that opens
  // the create sheet for the currently visible content.
  const tabDirectAction = {
    sources: can('source:create') ? () => setSourceSheet(true) : null,
    feedOrders: can('feedOrder:create') ? () => setFeedOrderSheet(true) : null,
    expenses: can('expense:create') ? () => setExpenseSheet(true) : null,
    sales: can('saleOrder:create') ? () => setSaleSheet(true) : null,
    performance: can('dailyLog:create') ? () => setDailyLogSheet(true) : null,
  }[activeKey] || null;
  const showDirectFab = activeKey !== 'overview' && Boolean(tabDirectAction);
  const showMenuFab = activeKey === 'overview' && quickAddItems.length > 0;

  return (
    <View style={{ flex: 1, backgroundColor: screenBg }}>
      <BatchDetailHeader
        batch={batch}
        farmName={farmName}
        lastSaleDate={lastSaleDate}
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
          handlePageSelected(e);
          const idx = e.nativeEvent.position;
          const next = visibleTabs[idx]?.key;
          if (next && next !== activeKey) setActiveKey(next);
        }}
      >
        {visibleTabs.map((tab) => (
          <View key={tab.key} style={{ flex: 1 }}>
            {tab.key === 'overview' && (
              <BatchOverviewTab batch={batch} batchId={id} onJumpTab={onJumpTab} />
            )}
            {tab.key === 'performance' && (
              <BatchPerformanceTab batch={batch} batchId={id} />
            )}
            {tab.key === 'sources' && (
              <BatchSourcesTab batchId={id} />
            )}
            {tab.key === 'feedOrders' && (
              <BatchFeedOrdersTab batchId={id} />
            )}
            {tab.key === 'expenses' && (
              <BatchExpensesTab batchId={id} />
            )}
            {tab.key === 'sales' && (
              <BatchSalesTab batchId={id} />
            )}
          </View>
        ))}
      </PagerView>

      {showMenuFab && (
        <QuickAddFAB items={quickAddItems} bottomInset={insets.bottom} />
      )}
      {showDirectFab && (
        <QuickAddFAB
          items={[]}
          directAction={tabDirectAction}
          bottomInset={insets.bottom}
        />
      )}

      <BatchSheet
        open={editOpen}
        onClose={() => setEditOpen(false)}
        editData={batch}
        onDelete={() => setConfirmDeleteOpen(true)}
        canDelete={canDelete}
      />

      <SourceSheet
        open={sourceSheet}
        onClose={() => setSourceSheet(false)}
        batchId={id}
        editData={null}
      />
      <FeedOrderSheet
        open={feedOrderSheet}
        onClose={() => setFeedOrderSheet(false)}
        batchId={id}
        editData={null}
      />
      <ExpenseSheet
        open={expenseSheet}
        onClose={() => setExpenseSheet(false)}
        batchId={id}
        editData={null}
      />
      <SaleOrderSheet
        open={saleSheet}
        onClose={() => setSaleSheet(false)}
        batchId={id}
        editData={null}
      />
      <DailyLogSheet
        open={dailyLogSheet}
        onClose={() => setDailyLogSheet(false)}
        batchId={id}
        batch={batch}
        editData={null}
      />

      <ConfirmDialog
        open={confirmDeleteOpen}
        onOpenChange={setConfirmDeleteOpen}
        title={t('batches.deleteTitle', 'Delete Batch')}
        description={t('batches.deleteWarning', 'This will permanently delete this batch. This action cannot be undone.')}
        confirmLabel={t('common.delete', 'Delete')}
        cancelLabel={t('common.cancel', 'Cancel')}
        onConfirm={handleDelete}
      />
    </View>
  );
}
