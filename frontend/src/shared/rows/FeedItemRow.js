import { Calendar } from 'lucide-react';
import EntityRowBase from './EntityRowBase';

const fmtDate = (d) => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString();
};

export default function FeedItemRow({ item, onClick, selected, actions }) {
  const desc = item.feedDescription || item.feedItem?.feedDescription || '';
  const bags = item.bags || 0;
  const sizePerBag = item.quantitySize || 50;
  const totalKg = bags * sizePerBag;

  return (
    <EntityRowBase onClick={onClick} selected={selected} actions={actions}>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">
          {desc || item.companyName || '—'}
        </p>
        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
          <span className="flex items-center gap-0.5">
            <Calendar className="h-3 w-3" />
            {fmtDate(item.orderDate)}
          </span>
          {item.companyName && desc && (
            <span className="truncate">· {item.companyName}</span>
          )}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-sm font-medium tabular-nums">{totalKg.toLocaleString()} KG</p>
        <p className="text-[10px] text-muted-foreground tabular-nums">{bags} × {sizePerBag}KG</p>
      </div>
    </EntityRowBase>
  );
}
