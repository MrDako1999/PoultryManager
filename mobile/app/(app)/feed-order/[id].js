import { useState } from 'react';
import { View, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import useThemeStore from '../../../stores/themeStore';
import useLocalRecord from '../../../hooks/useLocalRecord';
import FeedOrderDetail from '../../../components/details/FeedOrderDetail';
import FeedOrderSheet from '../../../components/sheets/FeedOrderSheet';

export default function FeedOrderScreen() {
  const { id } = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const { resolvedTheme } = useThemeStore();
  const iconColor = resolvedTheme === 'dark' ? '#e0e8e0' : '#1a2e1a';
  const [sheetData, setSheetData] = useState(null);

  const [order] = useLocalRecord('feedOrders', id);
  const batchId = order?.batch && typeof order.batch === 'object' ? order.batch._id : order?.batch;

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <View className="px-4 pt-2 pb-1 flex-row items-center">
        <Pressable onPress={() => router.back()} className="h-9 w-9 items-center justify-center rounded-md" hitSlop={8}>
          <ArrowLeft size={20} color={iconColor} />
        </Pressable>
      </View>
      <FeedOrderDetail feedOrderId={id} onEdit={(o) => setSheetData(o)} />
      <FeedOrderSheet
        open={!!sheetData}
        onClose={() => setSheetData(null)}
        batchId={batchId}
        editData={sheetData}
      />
    </View>
  );
}
