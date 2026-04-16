import { useMemo, useState } from 'react';
import { View, ScrollView, RefreshControl } from 'react-native';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import { DollarSign } from 'lucide-react-native';
import useLocalQuery from '@/hooks/useLocalQuery';
import useThemeStore from '@/stores/themeStore';
import SearchInput from '@/components/ui/SearchInput';
import EmptyState from '@/components/ui/EmptyState';
import StatCard from '@/components/ui/StatCard';
import ExpenseRow from '@/modules/broiler/rows/ExpenseRow';
import ExpenseCategoryGroup from '@/components/rows/ExpenseCategoryGroup';
import { deltaSync } from '@/lib/syncEngine';
import { SkeletonRow, SkeletonStatCard } from '@/components/skeletons';

const fmt = (val) =>
  Number(val || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function BroilerExpensesView() {
  const { t } = useTranslation();
  const { resolvedTheme } = useThemeStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [catOpen, setCatOpen] = useState({});

  const [expenses, expensesLoading] = useLocalQuery('expenses');
  const primaryColor = resolvedTheme === 'dark' ? 'hsl(148, 48%, 38%)' : 'hsl(148, 60%, 20%)';

  const onRefresh = async () => {
    setRefreshing(true);
    try { await deltaSync(); } catch (e) { console.error(e); }
    setRefreshing(false);
  };

  const q = searchQuery.toLowerCase();

  const filteredExpenses = useMemo(() => {
    if (!q) return expenses;
    return expenses.filter((e) =>
      (e.description || '').toLowerCase().includes(q) ||
      (e.tradingCompany?.companyName || '').toLowerCase().includes(q)
    );
  }, [expenses, q]);

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

  const toggleCat = (key) => setCatOpen((p) => ({ ...p, [key]: !(p[key] ?? true) }));

  return (
    <View className="flex-1 bg-background">
      <View className="px-4 pb-3">
        <SearchInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder={t('accounting.searchExpenses', 'Search expenses...')}
        />
      </View>

      <ScrollView
        className="flex-1"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={primaryColor} />}
      >
        {expensesLoading && expenses.length === 0 ? (
          <View className="px-4 gap-3">
            <View className="flex-row gap-2"><SkeletonStatCard /><SkeletonStatCard /></View>
            {[1, 2, 3, 4].map((i) => <SkeletonRow key={i} />)}
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
        )}
      </ScrollView>
    </View>
  );
}
