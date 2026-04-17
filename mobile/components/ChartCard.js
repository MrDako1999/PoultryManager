import { View, Text, Pressable } from 'react-native';
import * as Haptics from 'expo-haptics';

function MiniSegmented({ options, value, onChange }) {
  return (
    <View className="flex-row rounded-md border border-border bg-muted/30 p-0.5">
      {options.map((opt) => {
        const Icon = opt.icon;
        const active = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => {
              if (active) return;
              Haptics.selectionAsync().catch(() => {});
              onChange?.(opt.value);
            }}
            className={`flex-row items-center gap-1 px-2.5 py-1 rounded ${active ? 'bg-card' : ''}`}
            style={{ minHeight: 32 }}
            hitSlop={4}
          >
            {Icon && <Icon size={12} color={active ? 'hsl(148, 60%, 20%)' : 'hsl(150, 10%, 45%)'} />}
            {opt.label && (
              <Text
                className={`text-[11px] font-medium ${active ? 'text-primary' : 'text-muted-foreground'}`}
                numberOfLines={1}
              >
                {opt.label}
              </Text>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

export default function ChartCard({
  title,
  subtitle,
  segments,
  segmentValue,
  onSegmentChange,
  segmentsRow2,
  segmentValue2,
  onSegmentChange2,
  children,
  className = '',
}) {
  return (
    <View className={`rounded-lg border border-border bg-card p-3 ${className}`}>
      <View className="flex-row items-center justify-between gap-2 mb-3">
        <View className="flex-1 min-w-0">
          {!!title && (
            <Text className="text-sm font-semibold text-foreground" numberOfLines={1}>{title}</Text>
          )}
          {!!subtitle && (
            <Text className="text-[11px] text-muted-foreground mt-0.5" numberOfLines={1}>{subtitle}</Text>
          )}
        </View>
        {segments && (
          <MiniSegmented options={segments} value={segmentValue} onChange={onSegmentChange} />
        )}
      </View>

      {segmentsRow2 && (
        <View className="flex-row justify-end mb-3">
          <MiniSegmented options={segmentsRow2} value={segmentValue2} onChange={onSegmentChange2} />
        </View>
      )}

      {children}
    </View>
  );
}
