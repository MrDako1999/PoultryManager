import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/components/ui/use-toast';
import { Plus, MoreVertical, Pencil, Trash2, Eye, Wheat, Calendar, ChevronsDownUp, ChevronsUpDown } from 'lucide-react';
import MasterDetail from '@/components/MasterDetail';
import FeedOrderDetail from '@/modules/broiler/details/FeedOrderDetail';
import FeedOrderSheet from '@/modules/broiler/sheets/FeedOrderSheet';
import ExpenseCategoryGroup from '@/modules/broiler/rows/ExpenseCategoryGroup';
import ConfirmDeleteDialog from '@/components/ConfirmDeleteDialog';
import { cn } from '@/lib/utils';
import useOfflineMutation from '@/hooks/useOfflineMutation';
import useGroupExpand from '@/hooks/useGroupExpand';

const fmt = (val) =>
  Number(val || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const FEED_TYPE_ORDER = { STARTER: 0, GROWER: 1, FINISHER: 2, OTHER: 3 };

export default function FeedOrdersListView({ items: feedOrders, selectedId, basePath, persistId, batchId }) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { toast } = useToast();

  const [feedOrderSheetOpen, setFeedOrderSheetOpen] = useState(false);
  const [editingFeedOrder, setEditingFeedOrder] = useState(null);
  const [feedOrderToDelete, setFeedOrderToDelete] = useState(null);

  const { mutate: deleteFeedOrder, isPending: isDeleting } = useOfflineMutation('feedOrders');

  const handleSelect = (feedOrderId) => navigate(`${basePath}/feed-orders/${feedOrderId}`);
  const handleBack = () => navigate(`${basePath}/feed-orders`);
  const handleEdit = (order) => { setEditingFeedOrder(order); setFeedOrderSheetOpen(true); };

  const sheetBatchId = batchId || editingFeedOrder?.batch;

  const grouped = useMemo(() => {
    const groups = {};
    feedOrders.forEach((order) => {
      (order.items || []).forEach((item) => {
        const type = item.feedType || 'OTHER';
        const itemKg = (item.bags || 0) * (item.quantitySize || 50);
        const itemCost = (item.bags || 0) * (item.pricePerBag || 0);
        if (!groups[type]) groups[type] = { items: [], totalKg: 0, totalCost: 0 };
        groups[type].items.push({
          ...item,
          orderDate: order.orderDate,
          companyName: order.feedCompany?.companyName,
          orderId: order._id,
          _order: order,
        });
        groups[type].totalKg += itemKg;
        groups[type].totalCost += itemCost;
      });
    });
    const sorted = Object.entries(groups).sort(
      ([a], [b]) => (FEED_TYPE_ORDER[a] ?? 99) - (FEED_TYPE_ORDER[b] ?? 99),
    );
    sorted.forEach(([, g]) => g.items.sort((a, b) => new Date(a.orderDate || 0) - new Date(b.orderDate || 0)));
    return sorted;
  }, [feedOrders]);

  const totalItems = grouped.reduce((s, [, g]) => s + g.items.length, 0);

  const groupKeys = useMemo(() => grouped.map(([cat]) => cat), [grouped]);
  const { isOpen, toggle, toggleAll, allExpanded } = useGroupExpand(groupKeys, `${persistId}-cats`);

  const list = (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
        <h2 className="font-semibold text-sm">{t('batches.feedOrdersTab')} ({totalItems})</h2>
        <div className="flex items-center gap-1">
          {grouped.length > 1 && (
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={toggleAll}>
              {allExpanded
                ? <ChevronsDownUp className="h-3.5 w-3.5" />
                : <ChevronsUpDown className="h-3.5 w-3.5" />}
            </Button>
          )}
          {batchId && (
            <Button size="sm" className="h-7 gap-1 text-xs" onClick={() => { setEditingFeedOrder(null); setFeedOrderSheetOpen(true); }}>
              <Plus className="h-3 w-3" />
              {t('batches.addFeedOrder')}
            </Button>
          )}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {feedOrders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center px-4">
            <div className="rounded-full bg-muted p-4 mb-4">
              <Wheat className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-1">{t('batches.noFeedOrders')}</h3>
            <p className="text-sm text-muted-foreground mb-4 max-w-sm">{t('batches.noFeedOrdersDesc')}</p>
          </div>
        ) : (
          grouped.map(([type, { items, totalKg, totalCost }]) => (
            <ExpenseCategoryGroup
              key={type}
              label={t(`feed.feedTypes.${type}`)}
              pills={[
                { value: fmt(totalCost) },
                { value: `${totalKg.toLocaleString('en-US')} KG` },
                { value: items.length },
              ]}
              open={isOpen(type)}
              onToggle={() => toggle(type)}
            >
              {items.map((item, i) => {
                const desc = item.feedDescription || item.feedItem?.feedDescription || '';
                const bags = item.bags || 0;
                const sizePerBag = item.quantitySize || 50;
                const itemTotalKg = bags * sizePerBag;
                const isSelected = selectedId === item.orderId;
                return (
                  <div
                    key={item._id || i}
                    onClick={() => handleSelect(item.orderId)}
                    className={cn(
                      'flex items-center gap-3 px-4 py-2.5 border-b cursor-pointer transition-colors hover:bg-accent/50',
                      isSelected && 'bg-accent',
                    )}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{desc || item.companyName || t('batches.unknownSupplier')}</p>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span className="flex items-center gap-0.5">
                          <Calendar className="h-3 w-3" />
                          {item.orderDate ? new Date(item.orderDate).toLocaleDateString() : '—'}
                        </span>
                        {item.companyName && desc && (
                          <span className="truncate">· {item.companyName}</span>
                        )}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-medium tabular-nums">{itemTotalKg.toLocaleString('en-US')} KG</p>
                      <p className="text-[10px] text-muted-foreground tabular-nums">{bags} × {sizePerBag}KG</p>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={(e) => e.stopPropagation()}>
                          <MoreVertical className="h-3.5 w-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenuItem onClick={() => handleSelect(item.orderId)}>
                          <Eye className="mr-2 h-4 w-4" /> {t('common.view')}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleEdit(item._order)}>
                          <Pencil className="mr-2 h-4 w-4" /> {t('common.edit')}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive" onClick={() => setFeedOrderToDelete(item._order)}>
                          <Trash2 className="mr-2 h-4 w-4" /> {t('common.delete')}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                );
              })}
            </ExpenseCategoryGroup>
          ))
        )}
      </div>
    </div>
  );

  const detail = selectedId ? <FeedOrderDetail feedOrderId={selectedId} onEdit={handleEdit} /> : null;

  const flatOrderIds = useMemo(() => {
    const ids = [];
    grouped.forEach(([, { items }]) => items.forEach((item) => {
      if (!ids.includes(item.orderId)) ids.push(item.orderId);
    }));
    return ids;
  }, [grouped]);

  const currentIdx = selectedId ? flatOrderIds.indexOf(selectedId) : -1;

  return (
    <>
      <MasterDetail
        list={list}
        detail={detail}
        hasSelection={!!selectedId}
        onBack={handleBack}
        emptyIcon={Wheat}
        emptyMessage={t('batches.selectFeedOrder', 'Select a feed order to view details')}
        persistId={persistId}
        hasPrev={currentIdx > 0}
        hasNext={currentIdx >= 0 && currentIdx < flatOrderIds.length - 1}
        onPrev={() => currentIdx > 0 && handleSelect(flatOrderIds[currentIdx - 1])}
        onNext={() => currentIdx < flatOrderIds.length - 1 && handleSelect(flatOrderIds[currentIdx + 1])}
      />

      {sheetBatchId && (
        <FeedOrderSheet
          open={feedOrderSheetOpen}
          onOpenChange={(open) => { if (!open) { setFeedOrderSheetOpen(false); setEditingFeedOrder(null); } }}
          batchId={sheetBatchId}
          editingFeedOrder={editingFeedOrder}
          onSuccess={() => {}}
        />
      )}

      <ConfirmDeleteDialog
        open={!!feedOrderToDelete}
        onOpenChange={(open) => !open && setFeedOrderToDelete(null)}
        title={t('batches.deleteFeedOrderTitle')}
        description={t('batches.deleteFeedOrderWarning')}
        onConfirm={() => feedOrderToDelete && deleteFeedOrder({
          action: 'delete',
          id: feedOrderToDelete._id,
        }, {
          onSuccess: () => {
            setFeedOrderToDelete(null);
            if (selectedId) navigate(`${basePath}/feed-orders`, { replace: true });
            toast({ title: t('batches.feedOrderDeleted') });
          },
        })}
        isPending={isDeleting}
      />
    </>
  );
}
