import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/components/ui/use-toast';
import { Plus, MoreVertical, Pencil, Trash2, Eye, DollarSign, Link2, ChevronsDownUp, ChevronsUpDown } from 'lucide-react';
import MasterDetail from '@/components/MasterDetail';
import ExpenseDetail from '@/components/details/ExpenseDetail';
import SourceDetail from '@/components/details/SourceDetail';
import FeedOrderDetail from '@/components/details/FeedOrderDetail';
import SaleDetail from '@/components/details/SaleDetail';
import ExpenseSheet from '@/components/ExpenseSheet';
import ExpenseCategoryGroup from '@/components/rows/ExpenseCategoryGroup';
import ConfirmDeleteDialog from '@/components/ConfirmDeleteDialog';
import { cn } from '@/lib/utils';
import useOfflineMutation from '@/hooks/useOfflineMutation';
import useGroupExpand from '@/hooks/useGroupExpand';

const fmt = (val) =>
  Number(val || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function ExpensesListView({ items: expenses, selectedId, basePath, persistId, batchId }) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { toast } = useToast();

  const [expenseSheetOpen, setExpenseSheetOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [expenseToDelete, setExpenseToDelete] = useState(null);
  const [subDetail, setSubDetail] = useState(null);

  const grouped = useMemo(() => {
    const groups = {};
    expenses.forEach((e) => {
      const cat = e.category || 'OTHER';
      if (!groups[cat]) groups[cat] = { items: [], total: 0 };
      groups[cat].items.push(e);
      groups[cat].total += e.totalAmount || 0;
    });
    return Object.entries(groups).sort(([a], [b]) =>
      t(`batches.expenseCategories.${a}`).localeCompare(t(`batches.expenseCategories.${b}`)),
    );
  }, [expenses, t]);

  const groupKeys = useMemo(() => grouped.map(([cat]) => cat), [grouped]);
  const { isOpen, toggle, toggleAll, allExpanded } = useGroupExpand(groupKeys, `${persistId}-cats`);

  const { mutate: deleteExpense, isPending: isDeleting } = useOfflineMutation('expenses');

  const handleSelect = (expenseId) => navigate(`${basePath}/expenses/${expenseId}`);
  const handleBack = () => navigate(`${basePath}/expenses`);
  const handleEdit = (expense) => { setEditingExpense(expense); setExpenseSheetOpen(true); };

  const sheetBatchId = batchId || editingExpense?.batch;

  const list = (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
        <h2 className="font-semibold text-sm">{t('batches.expensesTab')} ({expenses.length})</h2>
        <div className="flex items-center gap-1">
          {grouped.length > 1 && (
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={toggleAll}>
              {allExpanded
                ? <ChevronsDownUp className="h-3.5 w-3.5" />
                : <ChevronsUpDown className="h-3.5 w-3.5" />}
            </Button>
          )}
          {batchId && (
            <Button size="sm" className="h-7 gap-1 text-xs" onClick={() => { setEditingExpense(null); setExpenseSheetOpen(true); }}>
              <Plus className="h-3 w-3" />
              {t('batches.addExpense')}
            </Button>
          )}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {expenses.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center px-4">
            <div className="rounded-full bg-muted p-4 mb-4">
              <DollarSign className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-1">{t('batches.noExpenses')}</h3>
            <p className="text-sm text-muted-foreground mb-4 max-w-sm">{t('batches.noExpensesDesc')}</p>
          </div>
        ) : (
          grouped.map(([category, { items, total }]) => (
            <ExpenseCategoryGroup
              key={category}
              label={t(`batches.expenseCategories.${category}`)}
              total={total}
              count={items.length}
              open={isOpen(category)}
              onToggle={() => toggle(category)}
            >
              {items.map((expense) => (
                <div
                  key={expense._id}
                  onClick={() => handleSelect(expense._id)}
                  className={cn(
                    'flex items-center gap-3 px-4 py-2.5 border-b cursor-pointer transition-colors hover:bg-accent/50',
                    selectedId === expense._id && 'bg-accent',
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate">
                        {expense.description || t(`batches.expenseCategories.${expense.category}`)}
                      </p>
                      {(expense.source || expense.feedOrder || expense.saleOrder) && (
                        <Link2 className="h-3 w-3 text-muted-foreground shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {expense.expenseDate ? new Date(expense.expenseDate).toLocaleDateString() : '—'}
                      {expense.tradingCompany?.companyName && ` · ${expense.tradingCompany.companyName}`}
                    </p>
                  </div>
                  <span className="text-sm font-medium tabular-nums shrink-0">{fmt(expense.totalAmount)}</span>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={(e) => e.stopPropagation()}>
                        <MoreVertical className="h-3.5 w-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenuItem onClick={() => handleSelect(expense._id)}>
                        <Eye className="mr-2 h-4 w-4" /> {t('common.view')}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleEdit(expense)}>
                        <Pencil className="mr-2 h-4 w-4" /> {t('common.edit')}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-destructive" onClick={() => setExpenseToDelete(expense)}>
                        <Trash2 className="mr-2 h-4 w-4" /> {t('common.delete')}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}
            </ExpenseCategoryGroup>
          ))
        )}
      </div>
    </div>
  );

  const selectedExpense = expenses.find((e) => e._id === selectedId);

  const detail = selectedId ? (
    <ExpenseDetail
      expenseId={selectedId}
      onEdit={handleEdit}
      onViewSource={(sid) => setSubDetail({ type: 'source', id: sid })}
      onViewFeedOrder={(fid) => setSubDetail({ type: 'feedOrder', id: fid })}
      onViewSaleOrder={(sid) => setSubDetail({ type: 'saleOrder', id: sid })}
    />
  ) : null;

  const subDetailPanel = subDetail?.type === 'source'
    ? <SourceDetail sourceId={subDetail.id} onEdit={() => {}} />
    : subDetail?.type === 'feedOrder'
    ? <FeedOrderDetail feedOrderId={subDetail.id} onEdit={() => {}} />
    : subDetail?.type === 'saleOrder'
    ? <SaleDetail saleId={subDetail.id} onEdit={() => {}} />
    : null;

  const detailLabel = selectedExpense?.description
    || t(`batches.expenseCategories.${selectedExpense?.category || 'OTHER'}`);

  const subDetailTypeLabels = {
    source: t('batches.sourcesTab', 'Source'),
    feedOrder: t('batches.feedOrdersTab', 'Feed Order'),
    saleOrder: t('batches.salesTab', 'Sale'),
  };
  const subDetailLabel = subDetail
    ? `${subDetailTypeLabels[subDetail.type] || subDetail.type} · ${subDetail.id.slice(0, 8)}`
    : undefined;

  const flatExpenseIds = useMemo(() => grouped.flatMap(([, { items }]) => items.map((e) => e._id)), [grouped]);
  const currentIdx = selectedId ? flatExpenseIds.indexOf(selectedId) : -1;

  return (
    <>
      <MasterDetail
        list={list}
        detail={detail}
        hasSelection={!!selectedId}
        onBack={handleBack}
        emptyIcon={DollarSign}
        emptyMessage={t('batches.selectExpense', 'Select an expense to view details')}
        subDetail={subDetailPanel}
        hasSubDetail={!!subDetail}
        onCloseSubDetail={() => setSubDetail(null)}
        persistId={persistId}
        detailLabel={detailLabel}
        subDetailLabel={subDetailLabel}
        hasPrev={currentIdx > 0}
        hasNext={currentIdx >= 0 && currentIdx < flatExpenseIds.length - 1}
        onPrev={() => currentIdx > 0 && handleSelect(flatExpenseIds[currentIdx - 1])}
        onNext={() => currentIdx < flatExpenseIds.length - 1 && handleSelect(flatExpenseIds[currentIdx + 1])}
      />

      {sheetBatchId && (
        <ExpenseSheet
          open={expenseSheetOpen}
          onOpenChange={(open) => { if (!open) { setExpenseSheetOpen(false); setEditingExpense(null); } }}
          batchId={sheetBatchId}
          editingExpense={editingExpense}
          onSuccess={() => {}}
        />
      )}

      <ConfirmDeleteDialog
        open={!!expenseToDelete}
        onOpenChange={(open) => !open && setExpenseToDelete(null)}
        title={t('batches.deleteExpenseTitle')}
        description={expenseToDelete?.source ? t('batches.deleteExpenseSourceWarning') : expenseToDelete?.feedOrder ? t('batches.deleteExpenseFeedOrderWarning') : expenseToDelete?.saleOrder ? t('batches.deleteExpenseSaleOrderWarning') : t('batches.deleteExpenseWarning')}
        onConfirm={() => expenseToDelete && deleteExpense({
          action: 'delete',
          id: expenseToDelete._id,
        }, {
          onSuccess: () => {
            setExpenseToDelete(null);
            if (selectedId) navigate(`${basePath}/expenses`, { replace: true });
            toast({ title: t('batches.expenseDeleted') });
          },
        })}
        isPending={isDeleting}
      />
    </>
  );
}
