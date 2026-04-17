import { useMemo } from 'react';
import { View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ShoppingCart, Receipt } from 'lucide-react-native';
import useLocalQuery from '@/hooks/useLocalQuery';
import useSettings from '@/hooks/useSettings';

const fmt = (val) =>
  Number(val || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function BroilerFinancials() {
  const { t } = useTranslation();
  const accounting = useSettings('accounting');
  const currency = accounting?.currency || 'AED';

  const [saleOrders] = useLocalQuery('saleOrders');
  const [expenses] = useLocalQuery('expenses');

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

  const profitPositive = financials.profit >= 0;

  return (
    <View>
      <Text className="text-base font-semibold text-foreground mb-3">
        {t('dashboard.financialOverview')}
      </Text>

      <View className="gap-2">
        <View className="rounded-lg border border-border bg-card p-4">
          <View className="flex-row items-center gap-2 mb-2">
            <View className="h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
              <ShoppingCart size={16} color="#059669" />
            </View>
            <View className="flex-1 min-w-0">
              <Text className="text-sm font-medium text-foreground">
                {t('dashboard.totalRevenue')}
              </Text>
              <Text className="text-xs text-muted-foreground">
                {financials.salesCount} {t('dashboard.salesOrders')}
              </Text>
            </View>
          </View>
          <Text className="text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
            {currency} {fmt(financials.revenue)}
          </Text>
        </View>

        <View className="rounded-lg border border-border bg-card p-4">
          <View className="flex-row items-center gap-2 mb-2">
            <View className="h-9 w-9 items-center justify-center rounded-lg bg-red-100 dark:bg-red-900/30">
              <Receipt size={16} color="#dc2626" />
            </View>
            <View className="flex-1 min-w-0">
              <Text className="text-sm font-medium text-foreground">
                {t('dashboard.totalExpenses')}
              </Text>
              <Text className="text-xs text-muted-foreground">
                {financials.expensesCount} {t('dashboard.expenseRecords')}
              </Text>
            </View>
          </View>
          <Text className="text-2xl font-bold tabular-nums text-red-600 dark:text-red-400">
            {currency} {fmt(financials.expenses)}
          </Text>
        </View>

        <View className="rounded-lg border border-border bg-card p-4 flex-row items-center justify-between">
          <Text className="text-sm font-medium text-foreground">
            {t('dashboard.netProfitLoss')}
          </Text>
          <Text
            className={`text-xl font-bold tabular-nums ${
              profitPositive
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-red-600 dark:text-red-400'
            }`}
          >
            {profitPositive ? '+' : ''}{currency} {fmt(financials.profit)}
          </Text>
        </View>
      </View>
    </View>
  );
}
