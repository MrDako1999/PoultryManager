import { Calendar } from 'lucide-react';
import EntityRowBase from '@/shared/rows/EntityRowBase';

const fmt = (val) =>
  Number(val || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtDate = (d) => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString();
};

export default function FeedOrderRow({ order, onClick, selected, actions }) {
  return (
    <EntityRowBase onClick={onClick} selected={selected} actions={actions}>
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{order.feedCompany?.companyName || '—'}</p>
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <Calendar className="h-3 w-3" />
          {fmtDate(order.orderDate)}
        </p>
      </div>
      <span className="text-sm font-medium tabular-nums shrink-0">{fmt(order.grandTotal)}</span>
    </EntityRowBase>
  );
}
