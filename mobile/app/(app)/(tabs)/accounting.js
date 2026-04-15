import { useState, useMemo } from 'react';
import { View, Text, ScrollView, Pressable, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import { ShoppingCart, DollarSign } from 'lucide-react-native';
import useLocalQuery from '../../../hooks/useLocalQuery';
import useThemeStore from '../../../stores/themeStore';
import SearchInput from '../../../components/ui/SearchInput';
import EmptyState from '../../../components/ui/EmptyState';
import StatCard from '../../../components/ui/StatCard';
import ExpenseRow from '../../../components/rows/ExpenseRow';
import SaleRow from '../../../components/rows/SaleRow';
import ExpenseCategoryGroup from '../../../components/rows/ExpenseCategoryGroup';
import { deltaSync } from '../../../lib/syncEngine';
import { SkeletonRow, SkeletonStatCard } from '../../../components/skeletons';

const fmt = (val) =>
  Number(val || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function AccountingScreen() {
  const { t } = useTranslation();
  const { resolvedTheme } = useThemeStore();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState('sales');
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const [saleOrders, salesLoading] = useLocalQuery('saleOrders');
  const [expenses, expensesLoading] = useLocalQuery('expenses');

  const primaryColor = resolvedTheme === 'dark' ? 'hsl(148, 48%, 38%)' : 'hsl(148, 60%, 20%)';

  const onRefresh = async () => {
    setRefreshing(true);
    try { await deltaSync(); } catch (e) { console.error(e); }
    setRefreshing(false);
  };

  const q = searchQuery.toLowerCase();

  const filteredSales = useMemo(() => {
    if (!q) return saleOrders;
    return saleOrders.filter((s) =>
      (s.customer?.companyName || '').toLowerCase().includes(q) ||
      (s.saleNumber || '').toLowerCase().includes(q)
    );
  }, [saleOrders, q]);

  const filteredExpenses = useMemo(() => {
    if (!q) return expenses;
    return expenses.filter((e) =>
      (e.description || '').toLowerCase().includes(q) ||
      (e.tradingCompany?.companyName || '').toLowerCase().includes(q)
    );
  }, [expenses, q]);

  const totalRevenue = useMemo(
    () => filteredSales.reduce((s, o) => s + (o.totals?.grandTotal || 0), 0),
    [filteredSales]
  );

  const totalExpense = useMemo(
    () => filteredExpenses.reduce((s, e) => s + (e.totalAmount || 0), 0),
    [filteredExpenses]
  );

  const sortedExpenseCategories = useMemo(() => {
    const groups = {};
    filteredExpenses.forEach((e) => {
      const cat = e.category || 'OTHER';
      if (!groups[cat]) groups[cat] = { items: [], total: 0 };
      groups[cat].items.push(e);
      groups[cat].total += e.totalAmount || 0;
    });
    return Object.entries(groups).sort(([a], [b]) =>
      t(`batches.expenseCategories.${a}`).localeCompare(t(`batches.expenseCategories.${b}`))
    );
  }, [filteredExpenses, t]);

  const [catOpen, setCatOpen] = useState({});
  const toggleCat = (key) => setCatOpen((p) => ({ ...p, [key]: !(p[key] ?? true) }));

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <View className="px-4 pt-2 pb-3">
        <Text className="text-xl font-bold text-foreground mb-3">{t('nav.accounting', 'Accounting')}</Text>

        <View className="flex-row rounded-lg border border-border bg-muted/30 p-0.5 mb-3">
          <Pressable
            onPress={() => { setTab('sales'); setSearchQuery(''); }}
            className={`flex-1 py-2 rounded-md items-center ${tab === 'sales' ? 'bg-card' : ''}`}
          >
            <Text className={`text-sm font-medium ${tab === 'sales' ? 'text-foreground' : 'text-muted-foreground'}`}>
              {t('nav.sales', 'Sales')}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => { setTab('expenses'); setSearchQuery(''); }}
            className={`flex-1 py-2 rounded-md items-center ${tab === 'expenses' ? 'bg-card' : ''}`}
          >
            <Text className={`text-sm font-medium ${tab === 'expenses' ? 'text-foreground' : 'text-muted-foreground'}`}>
              {t('nav.expenses', 'Expenses')}
            </Text>
          </Pressable>
        </View>

        <SearchInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder={tab === 'sales' ? 'Search sales...' : 'Search expenses...'}
        />
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={primaryColor} />}
      >
        {tab === 'sales' ? (
          salesLoading && saleOrders.length === 0 ? (
            <View className="px-4 gap-3">
              <View className="flex-row gap-2"><SkeletonStatCard /><SkeletonStatCard /></View>
              {[1,2,3,4].map(i => <SkeletonRow key={i} />)}
            </View>
          ) : (
          <>
            <View className="px-4 mb-3">
              <View className="flex-row gap-2">
                <StatCard label={t('accounting.totalRevenue', 'Total Revenue')} value={fmt(totalRevenue)} icon={ShoppingCart} />
                <StatCard label={t('accounting.salesCount', 'Sales')} value={filteredSales.length} />
              </View>
            </View>
            {filteredSales.length === 0 ? (
              <EmptyState icon={ShoppingCart} title={t('batches.noSales', 'No sales')} />
            ) : (
              <View className="px-4">
                {filteredSales
                  .sort((a, b) => new Date(b.saleDate || 0) - new Date(a.saleDate || 0))
                  .map((sale) => (
                    <View key={sale._id} className="rounded-lg border border-border bg-card mb-2 overflow-hidden">
                      <SaleRow sale={sale} onClick={() => router.push(`/(app)/sale/${sale._id}`)} />
                    </View>
                  ))
                }
              </View>
            )}
          </>
          )
        ) : (
          expensesLoading && expenses.length === 0 ? (
            <View className="px-4 gap-3">
              <View className="flex-row gap-2"><SkeletonStatCard /><SkeletonStatCard /></View>
              {[1,2,3,4].map(i => <SkeletonRow key={i} />)}
            </View>
          ) : (
          <>
            <View className="px-4 mb-3">
              <View className="flex-row gap-2">
                <StatCard label={t('accounting.totalSpend', 'Total Spend')} value={fmt(totalExpense)} icon={DollarSign} />
                <StatCard label={t('accounting.expenseCount', 'Expenses')} value={filteredExpenses.length} />
              </View>
            </View>
            {filteredExpenses.length === 0 ? (
              <EmptyState icon={DollarSign} title={t('batches.noExpenses', 'No expenses')} />
            ) : (
              <View className="px-4">
                <View className="rounded-lg border border-border bg-card overflow-hidden">
                  {sortedExpenseCategories.map(([category, { items, total }]) => (
                    <ExpenseCategoryGroup
                      key={category}
                      label={t(`batches.expenseCategories.${category}`, category)}
                      total={total}
                      count={items.length}
                      open={catOpen[category] ?? true}
                      onToggle={() => toggleCat(category)}
                    >
                      {items.map((expense) => (
                        <ExpenseRow
                          key={expense._id}
                          expense={expense}
                          categoryLabel={t(`batches.expenseCategories.${expense.category}`, expense.category)}
                          onClick={() => router.push(`/(app)/expense/${expense._id}`)}
                        />
                      ))}
                    </ExpenseCategoryGroup>
                  ))}
                </View>
              </View>
            )}
          </>
          )
        )}
      </ScrollView>
    </View>
  );
}
