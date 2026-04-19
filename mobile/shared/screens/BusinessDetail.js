import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import PagerView from 'react-native-pager-view';
import { Building2 } from 'lucide-react-native';
import useLocalRecord from '@/hooks/useLocalRecord';
import useLocalQuery from '@/hooks/useLocalQuery';
import useCapabilities from '@/hooks/useCapabilities';
import useOfflineMutation from '@/hooks/useOfflineMutation';
import { useToast } from '@/components/ui/Toast';
import EmptyState from '@/components/ui/EmptyState';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import Tabs from '@/components/ui/Tabs';
import QuickAddFAB from '@/components/QuickAddFAB';
import { SkeletonBusinessDetail } from '@/components/skeletons';
import { useHeroSheetTokens } from '@/components/HeroSheetScreen';
import BusinessDetailHeader from '@/shared/components/BusinessDetailHeader';
import QuickAddBusinessSheet from '@/shared/sheets/QuickAddBusinessSheet';
import TransferSheet from '@/modules/broiler/sheets/TransferSheet';
import BusinessOverviewTab from './businessTabs/BusinessOverviewTab';
import BusinessStatementsTab from './businessTabs/BusinessStatementsTab';
import BusinessTransfersTab from './businessTabs/BusinessTransfersTab';
import BusinessSalesTab from './businessTabs/BusinessSalesTab';
import BusinessExpensesTab from './businessTabs/BusinessExpensesTab';

/**
 * BusinessDetail — slim orchestrator, modeled on BatchDetail / FarmDetail.
 *
 * Responsibilities:
 *   1. Load the business + every related collection (farms, sales,
 *      expenses, feed orders, sources, transfers).
 *   2. Compute derived data: linked farms, related lists per type,
 *      balance/totals (trader vs supplier), de-duped contacts.
 *   3. Wire the brand-gradient header (BusinessDetailHeader), the
 *      capability-gated tab strip, the PagerView, and the per-tab
 *      content components.
 *   4. Own all sheets / confirm dialogs (edit business, transfer
 *      add/edit, delete confirms) at the screen level so the tab
 *      components stay presentational.
 *   5. Render a contextual FAB on the Transfers tab when the user can
 *      create transfers — same recipe as BatchDetail's `tabDirectAction`
 *      pattern.
 */
export default function BusinessScreen() {
  const { id } = useLocalSearchParams();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { can } = useCapabilities();
  const { toast } = useToast();
  const { remove } = useOfflineMutation('businesses');
  const { remove: removeTransfer } = useOfflineMutation('transfers');
  const { screenBg } = useHeroSheetTokens();

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

  const [biz, bizLoading] = useLocalRecord('businesses', id);
  const [allFarms] = useLocalQuery('farms');
  const [allSales, salesLoading] = useLocalQuery('saleOrders');
  const [allExpenses, expensesLoading] = useLocalQuery('expenses');
  const [allFeedOrders] = useLocalQuery('feedOrders');
  const [allSources] = useLocalQuery('sources');
  const [allTransfers, transfersLoading] = useLocalQuery('transfers');

  const [editOpen, setEditOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [transferSheet, setTransferSheet] = useState({ open: false, data: null });
  const [confirmDeleteTransferOpen, setConfirmDeleteTransferOpen] = useState(false);
  const [transferToDeleteId, setTransferToDeleteId] = useState(null);

  const isTrader = biz?.businessType !== 'SUPPLIER';

  const linkedFarms = useMemo(
    () => allFarms.filter((f) => {
      const bId = typeof f.business === 'object' ? f.business?._id : f.business;
      return bId === id;
    }),
    [allFarms, id]
  );

  const relatedSales = useMemo(
    () => allSales.filter((s) => {
      const c = typeof s.customer === 'object' ? s.customer?._id : s.customer;
      return c === id;
    }),
    [allSales, id]
  );

  const relatedExpenses = useMemo(
    () => allExpenses.filter((e) => {
      const tc = typeof e.tradingCompany === 'object' ? e.tradingCompany?._id : e.tradingCompany;
      return tc === id;
    }),
    [allExpenses, id]
  );

  const relatedFeedOrders = useMemo(
    () => allFeedOrders.filter((f) => {
      const fc = typeof f.feedCompany === 'object' ? f.feedCompany?._id : f.feedCompany;
      return fc === id;
    }),
    [allFeedOrders, id]
  );

  const relatedSources = useMemo(
    () => allSources.filter((s) => {
      const sf = typeof s.sourceFrom === 'object' ? s.sourceFrom?._id : s.sourceFrom;
      return sf === id;
    }),
    [allSources, id]
  );

  const relatedTransfers = useMemo(
    () => allTransfers.filter((tr) => {
      const bizId = typeof tr.business === 'object' ? tr.business?._id : tr.business;
      return bizId === id;
    }),
    [allTransfers, id]
  );

  const totals = useMemo(() => {
    const totalSales = relatedSales.reduce((s, o) => s + (o.totals?.grandTotal || 0), 0);
    const totalExpenses = relatedExpenses.reduce((s, e) => s + (e.totalAmount || 0), 0);
    const totalFeedCost = relatedFeedOrders.reduce((s, o) => s + (o.grandTotal || 0), 0);
    const totalSourceCost = relatedSources.reduce((s, o) => s + (o.grandTotal || 0), 0);
    const totalTransfers = relatedTransfers.reduce((s, tr) => s + (tr.amount || 0), 0);
    const totalPurchases = totalExpenses + totalFeedCost + totalSourceCost;
    const balance = isTrader
      ? totalSales - totalExpenses - totalTransfers
      : totalPurchases - totalTransfers;
    return {
      totalSales,
      totalExpenses,
      totalFeedCost,
      totalSourceCost,
      totalPurchases,
      totalTransfers,
      balance,
    };
  }, [
    relatedSales, relatedExpenses, relatedFeedOrders,
    relatedSources, relatedTransfers, isTrader,
  ]);

  const contacts = useMemo(() => {
    if (!Array.isArray(biz?.contacts)) return [];
    const seen = new Set();
    return biz.contacts.reduce((acc, c) => {
      const contact = typeof c === 'object' ? c : null;
      if (!contact?._id || seen.has(contact._id)) return acc;
      seen.add(contact._id);
      acc.push(contact);
      return acc;
    }, []);
  }, [biz?.contacts]);

  // Capability-gated tab list. Overview + Statements are always visible;
  // Sales is hidden for suppliers (since suppliers don't sell to us).
  const visibleTabs = useMemo(() => {
    const tabs = [
      { key: 'overview', label: t('businesses.overviewTab', 'Overview') },
      { key: 'statements', label: t('businesses.statementsTab', 'Statements') },
    ];
    if (can('transfer:read')) {
      tabs.push({ key: 'transfers', label: t('businesses.transfersTab', 'Transfers') });
    }
    if (isTrader && can('saleOrder:read')) {
      tabs.push({ key: 'sales', label: t('businesses.salesTab', 'Sales') });
    }
    if (can('expense:read')) {
      tabs.push({ key: 'expenses', label: t('businesses.expensesTab', 'Expenses') });
    }
    return tabs;
  }, [isTrader, can, t]);

  const [activeKey, setActiveKey] = useState('overview');

  // Seed the pager-index ref + progress with the initial page on mount so
  // the sync effect below doesn't issue a redundant setPage() after mount.
  useEffect(() => {
    const idx = Math.max(0, visibleTabs.findIndex((tab) => tab.key === activeKey));
    pagerIndexRef.current = idx;
    pagerProgress.setValue(idx);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!visibleTabs.find((tab) => tab.key === activeKey)) {
      setActiveKey(visibleTabs[0]?.key || 'overview');
    }
  }, [visibleTabs, activeKey]);

  useEffect(() => {
    const idx = visibleTabs.findIndex((tab) => tab.key === activeKey);
    if (idx < 0 || !pagerRef.current) return;
    if (idx === pagerIndexRef.current) return;
    pagerIndexRef.current = idx;
    pagerRef.current.setPage(idx);
  }, [activeKey, visibleTabs]);

  if (bizLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: screenBg, paddingTop: insets.top }}>
        <SkeletonBusinessDetail />
      </View>
    );
  }

  if (!biz) {
    return (
      <View style={{ flex: 1, backgroundColor: screenBg, paddingTop: insets.top }}>
        <EmptyState
          icon={Building2}
          title={t('businesses.notFound', 'Business not found')}
          actionLabel={t('businesses.backToBusinesses', 'Back to Businesses')}
          onAction={() => router.back()}
        />
      </View>
    );
  }

  const canEdit = can('business:update');
  // Account business (the user's own company) can never be deleted.
  const canDelete = can('business:delete') && !biz.isAccountBusiness;
  const canCreateTransfer = can('transfer:create');

  const handleDelete = async () => {
    if (!biz?._id) return;
    try {
      await remove(biz._id);
      toast({ title: t('businesses.businessDeleted', 'Business deleted') });
      setConfirmDeleteOpen(false);
      router.back();
    } catch (e) {
      console.error('[BusinessDetail] delete failed', e);
      toast({
        title: t('businesses.deleteError', 'Failed to delete business'),
        variant: 'destructive',
      });
    }
  };

  const handleDeleteTransfer = async () => {
    if (!transferToDeleteId) return;
    try {
      await removeTransfer(transferToDeleteId);
      toast({ title: t('transfers.transferDeleted', 'Transfer deleted') });
      setConfirmDeleteTransferOpen(false);
      setTransferToDeleteId(null);
    } catch (e) {
      console.error('[BusinessDetail] delete transfer failed', e);
      toast({
        title: t('transfers.deleteError', 'Failed to delete transfer'),
        variant: 'destructive',
      });
    }
  };

  const initialPage = Math.max(0, visibleTabs.findIndex((tab) => tab.key === activeKey));

  // FAB context — only on the Transfers tab when the user can create.
  const showTransferFab = activeKey === 'transfers' && canCreateTransfer;

  return (
    <View style={{ flex: 1, backgroundColor: screenBg }}>
      <BusinessDetailHeader
        biz={biz}
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
              <BusinessOverviewTab
                biz={biz}
                totals={totals}
                isTrader={isTrader}
                contacts={contacts}
                linkedFarms={linkedFarms}
              />
            )}
            {tab.key === 'statements' && <BusinessStatementsTab />}
            {tab.key === 'transfers' && (
              <BusinessTransfersTab
                transfers={relatedTransfers}
                loading={transfersLoading}
                onAdd={canCreateTransfer
                  ? () => setTransferSheet({ open: true, data: null })
                  : undefined}
                onRowPress={(transfer) => setTransferSheet({ open: true, data: transfer })}
              />
            )}
            {tab.key === 'sales' && (
              <BusinessSalesTab
                sales={relatedSales}
                loading={salesLoading}
              />
            )}
            {tab.key === 'expenses' && (
              <BusinessExpensesTab
                expenses={relatedExpenses}
                loading={expensesLoading}
              />
            )}
          </View>
        ))}
      </PagerView>

      {/* Standalone FAB on the Transfers tab — uses QuickAddFAB's
          single-action mode so the chrome matches every other detail
          screen instead of the hand-rolled pressable in the previous
          BusinessDetail. */}
      {showTransferFab ? (
        <QuickAddFAB
          items={[]}
          directAction={() => setTransferSheet({ open: true, data: null })}
          bottomInset={insets.bottom}
        />
      ) : null}

      <QuickAddBusinessSheet
        open={editOpen}
        onClose={() => setEditOpen(false)}
        editData={biz}
        onDelete={canDelete ? () => setConfirmDeleteOpen(true) : undefined}
        canDelete={canDelete}
      />

      <TransferSheet
        open={transferSheet.open}
        onClose={() => setTransferSheet({ open: false, data: null })}
        editData={transferSheet.data}
        preselectedBusinessId={id}
        onDelete={() => {
          setTransferToDeleteId(transferSheet.data?._id || null);
          setConfirmDeleteTransferOpen(true);
        }}
        canDelete={!!transferSheet.data?._id}
      />

      <ConfirmDialog
        open={confirmDeleteOpen}
        onOpenChange={setConfirmDeleteOpen}
        title={t('businesses.deleteBusinessTitle', 'Delete Business')}
        description={t(
          'businesses.deleteBusinessWarning',
          'This will permanently delete this business and cannot be undone.'
        )}
        confirmLabel={t('common.delete', 'Delete')}
        cancelLabel={t('common.cancel', 'Cancel')}
        onConfirm={handleDelete}
      />

      <ConfirmDialog
        open={confirmDeleteTransferOpen}
        onOpenChange={(open) => {
          setConfirmDeleteTransferOpen(open);
          if (!open) setTransferToDeleteId(null);
        }}
        title={t('transfers.deleteTransferTitle', 'Delete Transfer')}
        description={t(
          'transfers.deleteTransferWarning',
          'This will permanently delete this transfer and cannot be undone.'
        )}
        confirmLabel={t('common.delete', 'Delete')}
        cancelLabel={t('common.cancel', 'Cancel')}
        onConfirm={handleDeleteTransfer}
      />
    </View>
  );
}
