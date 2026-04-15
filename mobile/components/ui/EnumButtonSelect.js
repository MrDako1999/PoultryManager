import { View, Text, Pressable } from 'react-native';
import * as Haptics from 'expo-haptics';
import useThemeStore from '../../stores/themeStore';

export default function EnumButtonSelect({
  options = [],
  value,
  onChange,
  columns,
  compact,
  disabled,
}) {
  const cols = columns || options.length;
  const { resolvedTheme } = useThemeStore();
  const primaryColor = resolvedTheme === 'dark' ? 'hsl(148, 48%, 38%)' : 'hsl(148, 60%, 20%)';
  const mutedColor = 'hsl(150, 10%, 45%)';

  const gap = 8;
  const itemWidth = `${(100 / cols).toFixed(4)}%`;

  const handlePress = (val) => {
    if (disabled) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onChange?.(val);
  };

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -(gap / 2) }}>
      {options.map(({ value: optVal, label, icon: Icon }) => {
        const selected = value === optVal;
        return (
          <View key={optVal} style={{ width: itemWidth, paddingHorizontal: gap / 2, marginBottom: gap }}>
            <Pressable
              onPress={() => handlePress(optVal)}
              disabled={disabled}
              className={`items-center justify-center rounded-lg border ${
                selected
                  ? 'border-primary bg-primary/10'
                  : 'border-border bg-background'
              } ${disabled ? 'opacity-50' : ''}`}
              style={compact
                ? { flexDirection: 'row', height: 40, paddingHorizontal: 8, gap: 6 }
                : { flexDirection: 'column', minHeight: 72, paddingVertical: 10, paddingHorizontal: 8, gap: 4 }
              }
            >
              {Icon && (
                <Icon
                  size={compact ? 14 : 20}
                  color={selected ? primaryColor : mutedColor}
                />
              )}
              <Text
                className={`font-medium ${selected ? 'text-primary' : 'text-foreground'}`}
                style={{ fontSize: compact ? 11 : 12, textAlign: 'center' }}
                numberOfLines={compact ? 1 : 2}
              >
                {label}
              </Text>
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}
