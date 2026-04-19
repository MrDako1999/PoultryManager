import { useTranslation } from 'react-i18next';
import { Truck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import EntityRowBase from '@/shared/rows/EntityRowBase';

const fmt = (val) =>
  Number(val || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function SaleRow({ sale, onClick, selected, actions }) {
  const { t } = useTranslation();

  const isSlaughtered = sale.saleMethod === 'SLAUGHTERED';
  const chickens = isSlaughtered
    ? (sale.counts?.chickensSent || 0)
    : (sale.live?.birdCount || 0);
  const trucks = sale.transport?.truckCount || 0;

  return (
    <EntityRowBase onClick={onClick} selected={selected} actions={actions}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="font-medium truncate">{sale.customer?.companyName || '—'}</p>
          <Badge variant="outline" className="text-[10px] px-1 py-0 shrink-0">
            {t(`batches.saleInvoiceTypes.${sale.invoiceType}`)}
          </Badge>
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
            <span>{chickens.toLocaleString('en-US')} {t('batches.birds', 'birds')}</span>
          )}
          {trucks > 0 && (
            <span className="flex items-center gap-0.5">
              <Truck className="h-2.5 w-2.5" />
              {trucks}
            </span>
          )}
        </div>
      </div>
    </EntityRowBase>
  );
}
