import { View, Text, Pressable } from 'react-native';

export default function StatCard({
  label,
  value,
  valueClassName,
  icon: Icon,
  onPress,
}) {
  const content = (
    <>
      {Icon && (
        <View className="flex-row items-center justify-between mb-1">
          <Text className="text-xs text-muted-foreground flex-1" numberOfLines={1}>{label}</Text>
          <Icon size={14} color="hsl(150, 10%, 45%)" />
        </View>
      )}
      {!Icon && label && (
        <Text className="text-xs text-muted-foreground mb-1" numberOfLines={1}>{label}</Text>
      )}
      <Text className={`text-lg font-bold text-foreground ${valueClassName || ''}`} numberOfLines={1}>
        {value}
      </Text>
    </>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        className="flex-1 rounded-lg border border-border bg-card p-3 min-w-[100px] active:bg-accent/40"
        style={{ minHeight: 72 }}
      >
        {content}
      </Pressable>
    );
  }

  return (
    <View className="flex-1 rounded-lg border border-border bg-card p-3 min-w-[100px]">
      {content}
    </View>
  );
}
