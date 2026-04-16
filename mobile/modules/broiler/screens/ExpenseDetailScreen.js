import { useState } from 'react';
import { View, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import useThemeStore from '@/stores/themeStore';
import useLocalRecord from '@/hooks/useLocalRecord';
import ExpenseDetail from '@/modules/broiler/details/ExpenseDetail';
import ExpenseSheet from '@/modules/broiler/sheets/ExpenseSheet';

export default function ExpenseScreen() {
  const { id } = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const { resolvedTheme } = useThemeStore();
  const iconColor = resolvedTheme === 'dark' ? '#e0e8e0' : '#1a2e1a';
  const [sheetData, setSheetData] = useState(null);

  const [expense] = useLocalRecord('expenses', id);
  const batchId = expense?.batch && typeof expense.batch === 'object' ? expense.batch._id : expense?.batch;

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <View className="px-4 pt-2 pb-1 flex-row items-center">
        <Pressable onPress={() => router.back()} className="h-9 w-9 items-center justify-center rounded-md" hitSlop={8}>
          <ArrowLeft size={20} color={iconColor} />
        </Pressable>
      </View>
      <ExpenseDetail expenseId={id} onEdit={(e) => setSheetData(e)} />
      <ExpenseSheet
        open={!!sheetData}
        onClose={() => setSheetData(null)}
        batchId={batchId}
        editData={sheetData}
      />
    </View>
  );
}
