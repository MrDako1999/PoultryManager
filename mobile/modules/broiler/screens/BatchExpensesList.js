import { useState, useMemo } from 'react';
import { View, Text, ScrollView, Pressable, RefreshControl, LayoutAnimation } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, DollarSign, Plus, ChevronsDownUp, ChevronsUpDown } from 'lucide-react-native';
import useLocalQuery from '@/hooks/useLocalQuery';
import useThemeStore from '@/stores/themeStore';
import SearchInput from '@/components/ui/SearchInput';
import EmptyState from '@/components/ui/EmptyState';
import ExpenseRow from '@/modules/broiler/rows/ExpenseRow';
import ExpenseCategoryGroup from '@/components/rows/ExpenseCategoryGroup';
import { SkeletonRow } from '@/components/skeletons';
import { deltaSync } from '@/lib/syncEngine';
import ExpenseSheet from '@/modules/broiler/sheets/ExpenseSheet';

const fmt = (val) =>
  Number(val || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function BatchExpensesScreen() {
  const { id } = useLocalSearchParams();
  const { t } = useTranslation();
  const { resolvedTheme } = useThemeStore();
  const insets = useSafeAreaInsets();
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [catOpen, setCatOpen] = useState({});
  const [sheet, setSheet] = useState({ open: false, data: null });

  const [expenses, expensesLoading] = useLocalQuery('expenses', { batch: id });
  const primaryColor = resolvedTheme === 'dark' ? 'hsl(148, 48%, 38%)' : 'hsl(148, 60%, 20%)';
  const mutedColor = 'hsl(150, 10%, 45%)';

  const toggleCat = (key) => setCatOpen((p) => ({ ...p, [key]: !(p[key] ?? true) }));

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

  const allExpanded = sortedExpenseCategories.every(([cat]) => catOpen[cat] ?? true);
  const toggleAll = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const next = {};
    sortedExpenseCategories.forEach(([cat]) => { next[cat] = !allExpanded; });
    setCatOpen(next);
  };

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <View className="flex-row items-center px-2 pt-2 pb-3">
        <Pressable onPress={() => router.back()} className="p-2 -ml-1 active:opacity-60">
          <ChevronLeft size={24} color={primaryColor} />
        </Pressable>
        <Text className="text-xl font-bold text-foreground flex-1">
          {t('batches.expensesTab')}
        </Text>
        <Text className="text-sm text-muted-foreground mr-2">{expenses.length}</Text>
      </View>

      <View className="px-4 pb-3 flex-row items-center gap-2">
        <View className="flex-1">
          <SearchInput value={searchQuery} onChangeText={setSearchQuery} placeholder={t('common.search', 'Search...')} />
        </View>
        {sortedExpenseCategories.length > 1 && (
          <Pressable
            onPress={toggleAll}
            className="h-10 w-10 items-center justify-center rounded-md border border-border"
          >
            {allExpanded
              ? <ChevronsDownUp size={18} color={mutedColor} />
              : <ChevronsUpDown size={18} color={mutedColor} />}
          </Pressable>
        )}
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={primaryColor} />}
      >
        {expensesLoading && expenses.length === 0 ? (
          <View className="px-4 gap-3">{[1, 2, 3, 4].map((i) => <SkeletonRow key={i} />)}</View>
        ) : filteredExpenses.length === 0 ? (
          <EmptyState
            icon={DollarSign}
            title={searchQuery ? t('common.noResults', 'No results') : t('batches.noExpenses', 'No expenses')}
          />
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
      </ScrollView>

      <Pressable
        onPress={() => setSheet({ open: true, data: null })}
        className="absolute right-5 h-14 w-14 rounded-full bg-primary items-center justify-center"
        style={{ bottom: insets.bottom + 16, elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4 }}
      >
        <Plus size={24} color="#fff" />
      </Pressable>

      <ExpenseSheet
        open={sheet.open}
        onClose={() => setSheet({ open: false, data: null })}
        batchId={id}
        editData={sheet.data}
      />
    </View>
  );
}
