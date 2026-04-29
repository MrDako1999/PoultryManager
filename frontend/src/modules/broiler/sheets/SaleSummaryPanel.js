import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';

export default function SaleSummaryPanel({
  wholeChickenTotal = 0,
  portionsTotal = 0,
  liveSalesTotal = 0,
  grossSalesAmount = 0,
  transportDeduction = 0,
  discountsTotal = 0,
  subtotal = 0,
  vatAmount = 0,
  grandTotal = 0,
  processingCost = 0,
  netRevenue = 0,
  currency = 'AED',
  showVat = false,
}) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(true);

  const fmt = (val) =>
    Number(val || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const hasSlaughteredBreakdown = wholeChickenTotal > 0 || portionsTotal > 0;
  const hasLiveBreakdown = liveSalesTotal > 0;
  const totalDeductions = transportDeduction + discountsTotal;

  return (
    <div className="rounded-lg border bg-card text-card-foreground">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium hover:bg-accent/50 transition-colors rounded-t-lg"
      >
        <span>{t('batches.saleForm.summaryTitle')}</span>
        <div className="flex items-center gap-3">
          {!expanded && (
            <span className="text-xs text-muted-foreground">
              {t('batches.saleForm.grandTotal')}: {currency} {fmt(grandTotal)}
            </span>
          )}
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-1">
          <Separator className="mb-3" />

          {hasSlaughteredBreakdown && (
            <>
              <Row label={t('batches.saleForm.wholeChickenTotal')} value={fmt(wholeChickenTotal)} currency={currency} />
              <Row label={t('batches.saleForm.portionsTotal')} value={fmt(portionsTotal)} currency={currency} />
            </>
          )}

          {hasLiveBreakdown && (
            <Row label={t('batches.saleForm.liveSalesTotal')} value={fmt(liveSalesTotal)} currency={currency} />
          )}

          <Separator className="my-2" />

          <Row label={t('batches.saleForm.grossSales')} value={fmt(grossSalesAmount)} currency={currency} bold />

          {transportDeduction !== 0 && (
            <Row
              label={t('batches.saleForm.transportDeduction')}
              value={`-${fmt(Math.abs(transportDeduction))}`}
              currency={currency}
              negative
            />
          )}

          {discountsTotal !== 0 && (
            <Row
              label={t('batches.saleForm.totalDiscounts')}
              value={`-${fmt(Math.abs(discountsTotal))}`}
              currency={currency}
              negative
            />
          )}

          <Separator className="my-2" />

          <Row label={t('batches.saleForm.invoiceTotal')} value={fmt(subtotal)} currency={currency} bold />

          {showVat && (
            <Row label={t('batches.saleForm.vat')} value={fmt(vatAmount)} currency={currency} />
          )}

          <Row
            label={t('batches.saleForm.grandTotal')}
            value={fmt(grandTotal)}
            currency={currency}
            bold
            highlight
          />

          {processingCost > 0 && (
            <>
              <Separator className="my-2" />
              <p className="text-xs text-muted-foreground font-medium mt-2 mb-1">
                {t('batches.saleForm.farmersView')}
              </p>
              <Row
                label={t('batches.saleForm.processingFee')}
                value={`-${fmt(processingCost)}`}
                currency={currency}
                negative
              />
              <Row
                label={t('batches.saleForm.netRevenue')}
                value={fmt(netRevenue)}
                currency={currency}
                bold
                highlight
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Row({ label, value, currency, bold, negative, highlight }) {
  return (
    <div
      className={cn(
        'flex items-center justify-between text-sm py-0.5',
        bold && 'font-semibold',
        negative && 'text-destructive',
        highlight && 'text-primary',
      )}
    >
      <span>{label}</span>
      <span>
        {currency} {value}
      </span>
    </div>
  );
}
