import { View, Text, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import { ArrowLeft, Pencil } from 'lucide-react-native';
import useThemeStore from '@/stores/themeStore';
import BatchAvatar from './BatchAvatar';
import { getStatusConfig } from '@/modules/broiler/lib/batchStatusConfig';

const CYCLE_TARGET_DAYS = 35;

export default function BatchHeader({
  batch,
  farmName = '',
  onEdit,
  canEdit = true,
}) {
  const { t } = useTranslation();
  const { resolvedTheme } = useThemeStore();
  const iconColor = resolvedTheme === 'dark' ? '#e0e8e0' : '#1a2e1a';

  if (!batch) return null;

  const status = getStatusConfig(batch.status);
  const avatarLetter = (
    batch.farm?.nickname || batch.farm?.farmName || farmName || batch.batchName || '?'
  )[0].toUpperCase();
  const batchNum = batch.sequenceNumber ?? '';

  let cycleProgress = null;
  if (batch.startDate && batch.status === 'IN_PROGRESS') {
    const start = new Date(batch.startDate);
    const days = Math.max(0, Math.floor((new Date() - start) / 86400000));
    cycleProgress = {
      days,
      pct: Math.min(100, (days / CYCLE_TARGET_DAYS) * 100),
    };
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
          {cycleProgress && (
            <View className="mt-1.5">
              <View className="flex-row items-center justify-between mb-0.5">
                <Text className="text-[10px] text-muted-foreground tabular-nums">
                  {t('dashboard.dayOfTarget', 'Day {{day}} of {{target}}', {
                    day: cycleProgress.days,
                    target: CYCLE_TARGET_DAYS,
                  })}
                </Text>
                <Text className="text-[10px] font-medium text-muted-foreground tabular-nums">
                  {Math.round(cycleProgress.pct)}%
                </Text>
              </View>
              <View className="h-1 rounded-full bg-muted overflow-hidden">
                <View
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${cycleProgress.pct}%` }}
                />
              </View>
            </View>
          )}
        </View>

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
      </View>
    </View>
  );
}
