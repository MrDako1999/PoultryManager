import { View, Text, Pressable } from 'react-native';
import { LOG_TYPE_ICONS } from '../../lib/constants';

export default function DailyLogRow({ log, onClick, t }) {
  const Icon = LOG_TYPE_ICONS[log.logType] || LOG_TYPE_ICONS.DAILY;
  const iconColor = 'hsl(150, 10%, 45%)';

  const pills = [];
  if (log.deaths) pills.push(`${log.deaths} deaths`);
  if (log.feedKg) pills.push(`${log.feedKg} kg feed`);
  if (log.averageWeight) pills.push(`${log.averageWeight} g avg`);
  if (log.temperature) pills.push(`${log.temperature}°C`);

  return (
    <Pressable onPress={onClick} className="flex-row items-center px-3 py-2.5 border-b border-border active:bg-accent/50">
      <View className="h-7 w-7 rounded-md bg-primary/10 items-center justify-center mr-2.5">
        <Icon size={14} color={iconColor} />
      </View>
      <View className="flex-1 min-w-0">
        <Text className="text-sm font-medium text-foreground" numberOfLines={1}>
          {log.logType || 'Log'}
          {log.cycleDay ? ` · Day ${log.cycleDay}` : ''}
        </Text>
        {pills.length > 0 && (
          <Text className="text-xs text-muted-foreground" numberOfLines={1}>
            {pills.join(' · ')}
          </Text>
        )}
      </View>
    </Pressable>
  );
}
