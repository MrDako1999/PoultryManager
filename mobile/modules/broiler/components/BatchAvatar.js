import { View, Text } from 'react-native';
import useThemeStore from '@/stores/themeStore';

export default function BatchAvatar({
  letter,
  sequence,
  status,
  size = 44,
}) {
  const { resolvedTheme } = useThemeStore();
  const cardColor = resolvedTheme === 'dark' ? 'hsl(150, 20%, 8%)' : 'hsl(0, 0%, 100%)';

  const StatusIcon = status?.icon || null;
  const pinSize = Math.round(size * 0.4);
  const iconSize = Math.max(8, Math.round(pinSize * 0.55));

  return (
    <View style={{ width: size, height: size }}>
      <View
        className="bg-primary/10 items-center justify-center rounded-lg"
        style={{ width: size, height: size }}
      >
        <Text className="text-[11px] font-bold text-primary leading-none">
          {letter}{sequence}
        </Text>
      </View>
      {status && (
        <View
          className={`absolute items-center justify-center rounded-full ${status.bg}`}
          style={{
            width: pinSize,
            height: pinSize,
            bottom: -3,
            right: -3,
            borderWidth: 2,
            borderColor: cardColor,
          }}
        >
          {StatusIcon && (
            <StatusIcon size={iconSize} color={status.iconColor} strokeWidth={2.5} />
          )}
        </View>
      )}
    </View>
  );
}
