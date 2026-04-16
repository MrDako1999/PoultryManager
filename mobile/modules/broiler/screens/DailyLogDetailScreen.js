import { useState } from 'react';
import { View, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import useThemeStore from '@/stores/themeStore';
import useLocalRecord from '@/hooks/useLocalRecord';
import DailyLogDetail from '@/modules/broiler/details/DailyLogDetail';
import DailyLogSheet from '@/modules/broiler/sheets/DailyLogSheet';

export default function DailyLogScreen() {
  const { id } = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const { resolvedTheme } = useThemeStore();
  const iconColor = resolvedTheme === 'dark' ? '#e0e8e0' : '#1a2e1a';
  const [sheetData, setSheetData] = useState(null);

  const [log] = useLocalRecord('dailyLogs', id);
  const batchId = log?.batch && typeof log.batch === 'object' ? log.batch._id : log?.batch;

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <View className="px-4 pt-2 pb-1 flex-row items-center">
        <Pressable onPress={() => router.back()} className="h-9 w-9 items-center justify-center rounded-md" hitSlop={8}>
          <ArrowLeft size={20} color={iconColor} />
        </Pressable>
      </View>
      <DailyLogDetail logId={id} onEdit={(l) => setSheetData(l)} />
      <DailyLogSheet
        open={!!sheetData}
        onClose={() => setSheetData(null)}
        batchId={batchId}
        houses={[]}
        editData={sheetData}
      />
    </View>
  );
}
