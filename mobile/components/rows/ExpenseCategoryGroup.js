import { useCallback } from 'react';
import { View, Text, Pressable, LayoutAnimation, UIManager, Platform } from 'react-native';
import { ChevronDown, ChevronRight } from 'lucide-react-native';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const fmt = (val) =>
  Number(val || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function ExpenseCategoryGroup({ label, total, count, pills, open = true, onToggle, children }) {
  const iconColor = 'hsl(150, 10%, 45%)';

  const handleToggle = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    onToggle?.();
  }, [onToggle]);

  return (
    <View>
      <Pressable
        onPress={handleToggle}
        className="flex-row items-center px-3 py-2 bg-muted/30 border-b border-border"
      >
        {open
          ? <ChevronDown size={14} color={iconColor} />
          : <ChevronRight size={14} color={iconColor} />
        }
        <Text className="text-xs font-semibold text-muted-foreground ml-1.5 flex-1 uppercase" numberOfLines={1}>
          {label}
        </Text>
        {pills ? (
          <View className="flex-row items-center gap-2">
            {pills.map((pill, i) => (
              <Text key={i} className="text-[10px] text-muted-foreground font-medium">{pill.value}</Text>
            ))}
          </View>
        ) : (
          <View className="flex-row items-center gap-2">
            {total != null && <Text className="text-[10px] text-muted-foreground font-medium">{fmt(total)}</Text>}
            {count != null && <Text className="text-[10px] text-muted-foreground font-medium">{count}</Text>}
          </View>
        )}
      </Pressable>
      {open && children}
    </View>
  );
}
