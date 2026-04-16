import { Calendar } from 'lucide-react';
import EntityRowBase from '@/shared/rows/EntityRowBase';

const fmtDate = (d) => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString();
};

export default function SourceRow({ source, onClick, selected, actions }) {
  return (
    <EntityRowBase onClick={onClick} selected={selected} actions={actions}>
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{source.sourceFrom?.companyName || '—'}</p>
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <Calendar className="h-3 w-3" />
          {fmtDate(source.deliveryDate)}
        </p>
      </div>
      <span className="text-sm font-medium tabular-nums shrink-0">
        {(source.totalChicks || 0).toLocaleString()}
      </span>
    </EntityRowBase>
  );
}
