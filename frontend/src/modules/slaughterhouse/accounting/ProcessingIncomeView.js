import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/components/ui/card';
import { Receipt, Building2 } from 'lucide-react';
import PageTitle from '@/components/ui/page-title';
import useLocalQuery from '@/hooks/useLocalQuery';
import useSettings from '@/hooks/useSettings';

const fmtMoney = (v) => Number(v || 0).toLocaleString('en-US', {
  minimumFractionDigits: 2, maximumFractionDigits: 2,
});

// Slaughterhouse processing income summary — sums processingInvoices
// across visible jobs, grouped by customer. Mirrors the broiler
// accounting tab layout (PageTitle + Card stack).
export default function ProcessingIncomeView() {
  const { t } = useTranslation();
  const accounting = useSettings('accounting');
  const currency = accounting?.currency || 'AED';

  const invoices = useLocalQuery('processingInvoices');
  const businesses = useLocalQuery('businesses');

  const businessesById = useMemo(
    () => Object.fromEntries(businesses.map((b) => [b._id, b])),
    [businesses],
  );

  const live = useMemo(
    () => invoices.filter((i) => !i.deletedAt),
    [invoices],
  );

  const totals = useMemo(() => {
    let subtotal = 0;
    let vat = 0;
    let grand = 0;
    for (const inv of live) {
      subtotal += Number(inv.subtotal) || 0;
      vat += Number(inv.vat) || 0;
      grand += Number(inv.grandTotal) || 0;
    }
    return { subtotal, vat, grand };
  }, [live]);

  const byCustomer = useMemo(() => {
    const acc = {};
    for (const inv of live) {
      const cid = typeof inv.customer === 'object' ? inv.customer?._id : inv.customer;
      if (!cid) continue;
      if (!acc[cid]) acc[cid] = { customerId: cid, total: 0, count: 0 };
      acc[cid].total += Number(inv.grandTotal) || 0;
      acc[cid].count += 1;
    }
    return Object.values(acc).sort((a, b) => b.total - a.total);
  }, [live]);

  return (
    <div className="space-y-4">
      <PageTitle
        title={t('accountingTabs.processingIncome', 'Processing Income')}
        subtitle={t('accountingTabs.processingIncomeDesc', 'All processing invoices.')}
      />

      <Card>
        <CardContent className="p-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">{t('invoice.subtotal', 'Sub-total')}</span>
            <span className="tabular-nums font-medium">{currency} {fmtMoney(totals.subtotal)}</span>
          </div>
          {totals.vat > 0 ? (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t('invoice.vat', 'VAT')}</span>
              <span className="tabular-nums font-medium">{currency} {fmtMoney(totals.vat)}</span>
            </div>
          ) : null}
          <div className="flex justify-between bg-primary text-primary-foreground rounded-md px-3 py-2 mt-2">
            <span className="text-[10px] font-bold uppercase tracking-wider">
              {t('invoice.grandTotal', 'Grand Total')}
            </span>
            <span className="text-sm font-bold tabular-nums">{currency} {fmtMoney(totals.grand)}</span>
          </div>
        </CardContent>
      </Card>

      {byCustomer.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <div className="mx-auto mb-4 inline-flex rounded-full bg-muted p-4">
              <Receipt className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="mb-1 text-lg font-semibold">{t('accountingTabs.noInvoices', 'No invoices yet')}</h3>
            <p className="mx-auto mb-4 max-w-sm text-sm text-muted-foreground">
              {t('accountingTabs.noInvoicesDesc', 'Invoices appear here once jobs close with billing data.')}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0 divide-y">
            {byCustomer.map((row) => {
              const customer = businessesById[row.customerId];
              return (
                <div key={row.customerId} className="flex items-center gap-3 px-4 py-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted shrink-0">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{customer?.companyName || '—'}</p>
                    <p className="text-xs text-muted-foreground tabular-nums mt-0.5">
                      {row.count} {t('processingJobs.title', 'invoices').toLowerCase()}
                    </p>
                  </div>
                  <div className="shrink-0 text-right text-sm font-medium tabular-nums">
                    {currency} {fmtMoney(row.total)}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
