import { useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Receipt } from 'lucide-react';
import useSettings from '@/hooks/useSettings';
import useLocalQuery from '@/hooks/useLocalQuery';
import {
  computeInvoiceLines, applyVatTotals, resolvePriceList,
} from '@/modules/slaughterhouse/lib/pricing';

const fmtMoney = (v) => Number(v || 0).toLocaleString('en-US', {
  minimumFractionDigits: 2, maximumFractionDigits: 2,
});
const fmtQty = (v, unit) => {
  if (v == null) return '—';
  const n = Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return unit ? `${n} ${unit}` : n;
};

// Live invoice preview computed from the job's production rows + the
// applicable price list. When the job is closed and a processingInvoice
// has been generated, swap to that snapshot. For now (no close sheet
// wired) we always show the live preview.
export default function JobInvoiceView() {
  const { t } = useTranslation();
  const ctx = useOutletContext() || {};
  const {
    job, productionBoxes = [], productionPortions = [], productionGiblets = [],
  } = ctx;

  const accounting = useSettings('accounting');
  const slaughterhouse = useSettings('slaughterhouse');
  const priceLists = useLocalQuery('priceLists');
  const currency = accounting?.currency || 'AED';
  const vatRate = job?.invoiceType === 'TAX_INVOICE' ? (accounting?.vatRate || 0) : 0;

  const customerId = useMemo(
    () => (typeof job?.customer === 'object' ? job.customer?._id : job?.customer),
    [job],
  );

  const pricing = useMemo(
    () => resolvePriceList({
      customerBusinessId: customerId,
      priceLists,
      fallbackPricing: slaughterhouse?.pricing,
    }),
    [customerId, priceLists, slaughterhouse],
  );

  const { lineItems, subtotal } = useMemo(
    () => computeInvoiceLines({
      pricing,
      productionBoxes,
      productionPortions,
      productionGiblets,
      lumpSums: job?.lumpSums || null,
    }),
    [pricing, productionBoxes, productionPortions, productionGiblets, job?.lumpSums],
  );

  const totals = useMemo(
    () => applyVatTotals({ subtotal, vatRate }),
    [subtotal, vatRate],
  );

  if (lineItems.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <div className="mx-auto mb-4 inline-flex rounded-full bg-muted p-4">
            <Receipt className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="mb-1 text-lg font-semibold">{t('invoice.title', 'Invoice')}</h3>
          <p className="mx-auto mb-4 max-w-sm text-sm text-muted-foreground">
            {t('invoice.noInvoice', 'Invoice will be generated when the job is closed.')}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <h2 className="text-sm font-semibold">{t('invoice.title', 'Invoice')}</h2>

        <div className="rounded-md border overflow-hidden">
          <div className="grid grid-cols-[1fr_80px_64px_90px] gap-0 px-3 py-2 bg-muted/50 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            <span>{t('production.partTypes.BREAST', 'Item')}</span>
            <span className="text-right">{t('processingJobs.balance', 'Qty')}</span>
            <span className="text-right">{t('settings.tierRate', 'Rate')}</span>
            <span className="text-right">{t('invoice.subtotal', 'Amount')}</span>
          </div>
          {lineItems.map((li) => (
            <div key={li.tier} className="grid grid-cols-[1fr_80px_64px_90px] gap-0 px-3 py-2 text-sm border-t">
              <span className="truncate">{li.label}</span>
              <span className="text-right tabular-nums text-muted-foreground">{fmtQty(li.quantity, li.unit)}</span>
              <span className="text-right tabular-nums text-muted-foreground">{li.rate != null ? fmtMoney(li.rate) : '—'}</span>
              <span className="text-right tabular-nums font-medium">{fmtMoney(li.amount)}</span>
            </div>
          ))}
        </div>

        <div className="space-y-1">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">{t('invoice.subtotal', 'Sub-total')}</span>
            <span className="tabular-nums font-medium">{currency} {fmtMoney(totals.subtotal)}</span>
          </div>
          {totals.vat != null ? (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                {t('invoice.vat', 'VAT')} ({(vatRate * 100).toFixed(0)}%)
              </span>
              <span className="tabular-nums font-medium">{currency} {fmtMoney(totals.vat)}</span>
            </div>
          ) : null}
          <Separator className="my-1" />
          <div className="flex justify-between items-center bg-primary text-primary-foreground rounded-md px-3 py-2">
            <span className="text-[10px] font-bold uppercase tracking-wider">
              {t('invoice.grandTotal', 'Grand Total')}
            </span>
            <span className="text-sm font-bold tabular-nums">
              {currency} {fmtMoney(totals.grandTotal)}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
