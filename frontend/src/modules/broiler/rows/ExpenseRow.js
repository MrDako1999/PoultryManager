import { Link2 } from 'lucide-react';
import EntityRowBase from '@/shared/rows/EntityRowBase';

const fmt = (val) =>
  Number(val || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function ExpenseRow({ expense, onClick, selected, actions, categoryLabel }) {
  const hasLink = expense.source || expense.feedOrder || expense.saleOrder;

  return (
    <EntityRowBase onClick={onClick} selected={selected} actions={actions}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm truncate">
            {expense.description || categoryLabel || '—'}
          </p>
          {hasLink && <Link2 className="h-3 w-3 text-muted-foreground shrink-0" />}
        </div>
        <p className="text-xs text-muted-foreground">
          {expense.expenseDate ? new Date(expense.expenseDate).toLocaleDateString() : '—'}
          {expense.tradingCompany?.companyName && ` · ${expense.tradingCompany.companyName}`}
        </p>
      </div>
      <span className="text-sm tabular-nums shrink-0">{fmt(expense.totalAmount)}</span>
    </EntityRowBase>
  );
}
