import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/components/ui/use-toast';
import { Plus, MoreVertical, Pencil, Trash2, Eye, ShoppingCart, FileText, Truck, ChevronsDownUp, ChevronsUpDown } from 'lucide-react';
import MasterDetail from '@/components/MasterDetail';
import SaleDetail from '@/modules/broiler/details/SaleDetail';
import ExpenseDetail from '@/modules/broiler/details/ExpenseDetail';
import ExpenseCategoryGroup from '@/modules/broiler/rows/ExpenseCategoryGroup';
import SaleOrderSheet from '@/modules/broiler/sheets/SaleOrderSheet';
import ConfirmDeleteDialog from '@/components/ConfirmDeleteDialog';
import { cn } from '@/lib/utils';
import useOfflineMutation from '@/hooks/useOfflineMutation';
import useGroupExpand from '@/hooks/useGroupExpand';

const fmt = (val) =>
  Number(val || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function SalesListView({ items: saleOrders, selectedId, basePath, persistId, batchId }) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { toast } = useToast();

  const [saleSheetOpen, setSaleSheetOpen] = useState(false);
  const [editingSaleOrder, setEditingSaleOrder] = useState(null);
  const [saleToDelete, setSaleToDelete] = useState(null);
  const [subDetail, setSubDetail] = useState(null);

  const { mutate: deleteSale, isPending: isDeleting } = useOfflineMutation('saleOrders');

  const sortedSaleDates = useMemo(() => {
    const groups = {};
    saleOrders.forEach((sale) => {
      const key = sale.saleDate ? new Date(sale.saleDate).toISOString().slice(0, 10) : 'no-date';
      if (!groups[key]) groups[key] = { items: [], revenue: 0, chickens: 0, trucks: 0 };
      groups[key].items.push(sale);
      groups[key].revenue += sale.totals?.grandTotal || 0;
      groups[key].chickens += (sale.counts?.chickensSent || 0) + (sale.live?.birdCount || 0);
      groups[key].trucks += sale.transport?.truckCount || 0;
    });
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [saleOrders]);

  const groupKeys = useMemo(() => sortedSaleDates.map(([k]) => k), [sortedSaleDates]);
  const { isOpen, toggle, toggleAll, allExpanded } = useGroupExpand(groupKeys, `${persistId}-dates`);

  const fmtDateLabel = (key) => {
    if (key === 'no-date') return t('common.noDate', 'No Date');
    return new Date(key + 'T00:00:00').toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const handleSelect = (sid) => navigate(`${basePath}/sales/${sid}`);
  const handleBack = () => navigate(`${basePath}/sales`);
  const handleEdit = (sale) => { setEditingSaleOrder(sale); setSaleSheetOpen(true); };

  const sheetBatchId = batchId || editingSaleOrder?.batch;

  const saleRow = (sale) => {
    const isSlaughtered = sale.saleMethod === 'SLAUGHTERED';
    const chickens = isSlaughtered ? (sale.counts?.chickensSent || 0) : (sale.live?.birdCount || 0);
    const trucks = sale.transport?.truckCount || 0;

    return (
      <div
        key={sale._id}
        onClick={() => handleSelect(sale._id)}
        className={cn(
          'flex items-center gap-3 px-4 py-2.5 border-b cursor-pointer transition-colors hover:bg-accent/50',
          selectedId === sale._id && 'bg-accent',
        )}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-medium truncate">{sale.customer?.companyName || t('batches.unknownSupplier')}</p>
            <Badge variant="outline" className="text-[10px] px-1 py-0 shrink-0">{t(`batches.saleInvoiceTypes.${sale.invoiceType}`)}</Badge>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="secondary" className="text-[9px] px-1 py-0 shrink-0 font-medium">
              {t(`batches.saleMethods.${sale.saleMethod}`)}
            </Badge>
            {sale.saleNumber && <span className="truncate">{sale.saleNumber}</span>}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-sm font-medium tabular-nums">{fmt(sale.totals?.grandTotal)}</p>
          <div className="flex items-center justify-end gap-2 text-[10px] text-muted-foreground tabular-nums">
            {chickens > 0 && (
              <span>{chickens.toLocaleString()} {t('batches.birds', 'birds')}</span>
            )}
            {trucks > 0 && (
              <span className="flex items-center gap-0.5">
                <Truck className="h-2.5 w-2.5" />
                {trucks}
              </span>
            )}
          </div>
        </div>
        {sale.invoiceDocs?.length > 0 && (
          <a href={sale.invoiceDocs[0]?.url || sale.invoiceDocs[0]} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0">
              <FileText className="h-3.5 w-3.5 text-primary" />
            </Button>
          </a>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={(e) => e.stopPropagation()}>
              <MoreVertical className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuItem onClick={() => handleSelect(sale._id)}>
              <Eye className="mr-2 h-4 w-4" /> {t('common.view')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleEdit(sale)}>
              <Pencil className="mr-2 h-4 w-4" /> {t('common.edit')}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive" onClick={() => setSaleToDelete(sale)}>
              <Trash2 className="mr-2 h-4 w-4" /> {t('common.delete')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  };

  const list = (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
        <h2 className="font-semibold text-sm">{t('batches.salesTab')} ({saleOrders.length})</h2>
        <div className="flex items-center gap-1">
          {sortedSaleDates.length > 1 && (
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={toggleAll}>
              {allExpanded
                ? <ChevronsDownUp className="h-3.5 w-3.5" />
                : <ChevronsUpDown className="h-3.5 w-3.5" />}
            </Button>
          )}
          {batchId && (
            <Button size="sm" className="h-7 gap-1 text-xs" onClick={() => { setEditingSaleOrder(null); setSaleSheetOpen(true); }}>
              <Plus className="h-3 w-3" />
              {t('batches.addSale')}
            </Button>
          )}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {saleOrders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center px-4">
            <div className="rounded-full bg-muted p-4 mb-4">
              <ShoppingCart className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-1">{t('batches.noSales')}</h3>
            <p className="text-sm text-muted-foreground mb-4 max-w-sm">{t('batches.noSalesDesc')}</p>
          </div>
        ) : (
          sortedSaleDates.map(([dateKey, { items, revenue, chickens, trucks }]) => (
            <ExpenseCategoryGroup
              key={dateKey}
              label={fmtDateLabel(dateKey)}
              pills={[
                { value: fmt(revenue) },
                { value: `${chickens.toLocaleString()} ${t('batches.birds', 'birds')}` },
                { value: `${trucks} ${t('batches.trucks', 'trucks')}` },
              ]}
              open={isOpen(dateKey)}
              onToggle={() => toggle(dateKey)}
            >
              {items.map((sale) => saleRow(sale))}
            </ExpenseCategoryGroup>
          ))
        )}
      </div>
    </div>
  );

  const selectedSale = saleOrders.find((s) => s._id === selectedId);

  const detail = selectedId ? (
    <SaleDetail
      saleId={selectedId}
      onEdit={handleEdit}
      onViewExpense={(eId) => setSubDetail({ type: 'expense', id: eId })}
    />
  ) : null;

  const subDetailPanel = subDetail?.type === 'expense'
    ? <ExpenseDetail expenseId={subDetail.id} onEdit={() => {}} />
    : null;

  const detailLabel = selectedSale?.saleNumber || t('batches.salesTab', 'Sale');
  const subDetailLabel = subDetail
    ? `${t('batches.expensesTab', 'Expense')} · ${subDetail.id.slice(0, 8)}`
    : undefined;

  const saleIds = useMemo(() => saleOrders.map((s) => s._id), [saleOrders]);
  const currentIdx = selectedId ? saleIds.indexOf(selectedId) : -1;

  return (
    <>
      <MasterDetail
        list={list}
        detail={detail}
        hasSelection={!!selectedId}
        onBack={handleBack}
        emptyIcon={ShoppingCart}
        emptyMessage={t('batches.selectSale', 'Select a sale to view details')}
        subDetail={subDetailPanel}
        hasSubDetail={!!subDetail}
        onCloseSubDetail={() => setSubDetail(null)}
        persistId={persistId}
        detailLabel={detailLabel}
        subDetailLabel={subDetailLabel}
        hasPrev={currentIdx > 0}
        hasNext={currentIdx >= 0 && currentIdx < saleIds.length - 1}
        onPrev={() => currentIdx > 0 && handleSelect(saleIds[currentIdx - 1])}
        onNext={() => currentIdx < saleIds.length - 1 && handleSelect(saleIds[currentIdx + 1])}
      />

      {sheetBatchId && (
        <SaleOrderSheet
          open={saleSheetOpen}
          onOpenChange={(open) => { if (!open) { setSaleSheetOpen(false); setEditingSaleOrder(null); } }}
          batchId={sheetBatchId}
          editingSaleOrder={editingSaleOrder}
        />
      )}

      <ConfirmDeleteDialog
        open={!!saleToDelete}
        onOpenChange={(open) => !open && setSaleToDelete(null)}
        title={t('batches.deleteSaleTitle')}
        description={t('batches.deleteSaleWarning')}
        onConfirm={() => saleToDelete && deleteSale({
          action: 'delete',
          id: saleToDelete._id,
        }, {
          onSuccess: () => {
            setSaleToDelete(null);
            if (selectedId) navigate(`${basePath}/sales`, { replace: true });
            toast({ title: t('batches.saleDeleted') });
          },
        })}
        isPending={isDeleting}
      />
    </>
  );
}
