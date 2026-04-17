import { View, Text, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import { ArrowLeft, Pencil, Trash2, Warehouse, Calendar } from 'lucide-react-native';
import useThemeStore from '@/stores/themeStore';
import BatchAvatar from './BatchAvatar';
import { getStatusConfig } from '@/modules/broiler/lib/batchStatusConfig';

const MUTED = 'hsl(150, 10%, 45%)';

export default function BatchHeader({
  batch,
  farmName = '',
  lastSaleDate = null,
  onEdit,
  onDelete,
  canEdit = true,
  canDelete = true,
}) {
  const { t } = useTranslation();
  const { resolvedTheme } = useThemeStore();
  const iconColor = resolvedTheme === 'dark' ? '#e0e8e0' : '#1a2e1a';
  const dangerColor = '#dc2626';

  if (!batch) return null;

  const status = getStatusConfig(batch.status);
  const avatarLetter = (
    batch.farm?.nickname || batch.farm?.farmName || farmName || batch.batchName || '?'
  )[0].toUpperCase();
  const batchNum = batch.sequenceNumber ?? '';
  const resolvedFarmName = batch.farm?.farmName || batch.farm?.nickname || farmName;

  let dayLabel = '';
  if (batch.startDate) {
    const start = new Date(batch.startDate);
    const end = batch.status === 'COMPLETE'
      ? (lastSaleDate ? new Date(lastSaleDate) : start)
      : new Date();
    const days = Math.max(0, Math.floor((end - start) / 86400000));
    dayLabel = batch.status === 'COMPLETE' ? `${days} days` : `Day ${days}`;
  }

  return (
    <View className="px-3 pt-2 pb-3 border-b border-border bg-background">
      <View className="flex-row items-center gap-2">
        <Pressable
          onPress={() => router.back()}
          className="items-center justify-center rounded-md active:bg-muted/50"
          style={{ width: 44, height: 44 }}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={t('common.back', 'Back')}
        >
          <ArrowLeft size={22} color={iconColor} />
        </Pressable>

        <BatchAvatar
          letter={avatarLetter}
          sequence={batchNum}
          status={status}
          size={48}
        />

        <View className="flex-1 min-w-0 ml-1">
          <Text
            className="text-base font-bold text-foreground"
            numberOfLines={1}
          >
            {batch.batchName || `${avatarLetter}${batchNum}`}
          </Text>
          <View className="flex-row items-center gap-3 mt-0.5">
            {!!resolvedFarmName && (
              <View className="flex-row items-center gap-1 flex-shrink min-w-0">
                <Warehouse size={11} color={MUTED} />
                <Text className="text-[11px] text-muted-foreground" numberOfLines={1}>
                  {resolvedFarmName}
                </Text>
              </View>
            )}
            {!!dayLabel && (
              <View className="flex-row items-center gap-1">
                <Calendar size={11} color={MUTED} />
                <Text className="text-[11px] text-muted-foreground tabular-nums">
                  {dayLabel}
                </Text>
              </View>
            )}
          </View>
        </View>

        <View className="flex-row items-center">
          {canEdit && (
            <Pressable
              onPress={onEdit}
              className="items-center justify-center rounded-md active:bg-muted/50"
              style={{ width: 44, height: 44 }}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel={t('common.edit', 'Edit')}
            >
              <Pencil size={20} color={iconColor} />
            </Pressable>
          )}
          {canDelete && (
            <Pressable
              onPress={onDelete}
              className="items-center justify-center rounded-md active:bg-red-500/10"
              style={{ width: 44, height: 44 }}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel={t('common.delete', 'Delete')}
            >
              <Trash2 size={20} color={dangerColor} />
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
}
