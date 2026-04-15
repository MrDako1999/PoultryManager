import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import EntityRowBase from './EntityRowBase';

const fmt = (val) =>
  Number(val || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function TransferRow({ transfer, onClick, selected, actions }) {
  const { t } = useTranslation();
  const businessName = transfer.business?.companyName || '';

  return (
    <EntityRowBase onClick={onClick} selected={selected} actions={actions}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm truncate">
            {businessName || '—'}
          </p>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">
            {t(`transfers.types.${transfer.transferType}`)}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          {transfer.transferDate ? new Date(transfer.transferDate).toLocaleDateString() : '—'}
        </p>
      </div>
      <span className="text-sm font-medium tabular-nums shrink-0">{fmt(transfer.amount)}</span>
    </EntityRowBase>
  );
}
