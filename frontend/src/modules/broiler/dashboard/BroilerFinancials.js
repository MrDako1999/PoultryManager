import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ShoppingCart, Receipt } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import useLocalQuery from '@/hooks/useLocalQuery';
import useSettings from '@/hooks/useSettings';

const fmt = (val) =>
  Number(val || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function BroilerFinancials() {
  const { t } = useTranslation();
  const accounting = useSettings('accounting');
  const currency = accounting?.currency || 'AED';

  const saleOrders = useLocalQuery('saleOrders');
  const expenses = useLocalQuery('expenses');

  const financials = useMemo(() => {
    const totalRevenue = saleOrders.reduce((s, o) => s + (o.totals?.grandTotal || 0), 0);
    const totalExpenses = expenses.reduce((s, e) => s + (e.totalAmount || 0), 0);
    return {
      revenue: totalRevenue,
      salesCount: saleOrders.length,
      expenses: totalExpenses,
      expensesCount: expenses.length,
      profit: totalRevenue - totalExpenses,
    };
  }, [saleOrders, expenses]);

  return (
    <div>
      <h2 className="text-lg font-semibold mb-3">{t('dashboard.financialOverview')}</h2>
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                <ShoppingCart className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-sm font-medium">{t('dashboard.totalRevenue')}</p>
                <p className="text-xs text-muted-foreground">
                  {financials.salesCount} {t('dashboard.salesOrders')}
                </p>
              </div>
            </div>
            <p className="text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
              {currency} {fmt(financials.revenue)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-100 dark:bg-red-900/30">
                <Receipt className="h-4 w-4 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <p className="text-sm font-medium">{t('dashboard.totalExpenses')}</p>
                <p className="text-xs text-muted-foreground">
                  {financials.expensesCount} {t('dashboard.expenseRecords')}
                </p>
              </div>
            </div>
            <p className="text-2xl font-bold tabular-nums text-red-600 dark:text-red-400">
              {currency} {fmt(financials.expenses)}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardContent className="pt-5 pb-4 flex items-center justify-between">
          <p className="text-sm font-medium">{t('dashboard.netProfitLoss')}</p>
          <p className={`text-xl font-bold tabular-nums ${
            financials.profit >= 0
              ? 'text-emerald-600 dark:text-emerald-400'
              : 'text-red-600 dark:text-red-400'
          }`}>
            {financials.profit >= 0 ? '+' : ''}{currency} {fmt(financials.profit)}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
