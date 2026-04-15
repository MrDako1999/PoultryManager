import { View, Text, Pressable } from 'react-native';
import { Link2 } from 'lucide-react-native';

const fmt = (val) =>
  Number(val || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function ExpenseRow({ expense, categoryLabel, onClick }) {
  const hasLink = expense.source || expense.feedOrder || expense.saleOrder;
  return (
    <Pressable onPress={onClick} className="flex-row items-center px-3 py-2.5 border-b border-border active:bg-accent/50">
      <View className="flex-1 min-w-0">
        <View className="flex-row items-center gap-1.5">
          <Text className="text-sm font-medium text-foreground" numberOfLines={1}>
            {expense.description || categoryLabel || 'Expense'}
          </Text>
          {hasLink && <Link2 size={12} color="hsl(150, 10%, 45%)" />}
        </View>
        <Text className="text-xs text-muted-foreground" numberOfLines={1}>
          {expense.expenseDate ? new Date(expense.expenseDate).toLocaleDateString() : '—'}
          {expense.tradingCompany?.companyName ? ` · ${expense.tradingCompany.companyName}` : ''}
        </Text>
      </View>
      <Text className="text-sm font-medium text-foreground ml-2">{fmt(expense.totalAmount)}</Text>
    </Pressable>
  );
}
