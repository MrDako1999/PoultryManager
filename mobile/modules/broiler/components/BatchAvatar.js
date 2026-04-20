import { View, Text } from 'react-native';
import useThemeStore from '@/stores/themeStore';

export default function BatchAvatar({
  letter,
  sequence,
  status,
  size = 44,
  radius,
}) {
  const { resolvedTheme } = useThemeStore();
  const dark = resolvedTheme === 'dark';

  // The status pin's outline needs to match whatever surface the avatar is
  // sitting on. In dark mode that's now an elevated card surface, not the
  // raw screen, so we use the elevated tone (close to `elevatedCardBg`).
  const cardColor = dark ? 'hsl(150, 14%, 22%)' : 'hsl(0, 0%, 100%)';

  // The default `bg-primary/10` and `text-primary` collapse in dark mode —
  // both end up around hsl(148, 48%, 38%) which gives ~1.5:1 contrast. Use
  // a stronger tinted tile + a much brighter text colour so the label
  // (T2 / K2 / G10) stays legible on every background.
  const tileBg = dark ? 'hsl(148, 38%, 26%)' : 'hsl(148, 50%, 92%)';
  const labelColor = dark ? 'hsl(148, 60%, 80%)' : 'hsl(148, 60%, 22%)';

  const StatusIcon = status?.icon || null;
  const pinSize = Math.round(size * 0.4);
  const iconSize = Math.max(8, Math.round(pinSize * 0.55));
  const labelFontSize = Math.max(11, Math.round(size * 0.34));
  // Default to ~27% of size so the avatar harmonizes with the rounded card
  // surfaces it sits inside (group cards 20pt, elevated cards 16pt). 8pt
  // looked too sharp against any new design-language surface.
  const tileRadius = radius ?? Math.round(size * 0.27);

  return (
    <View style={{ width: size, height: size }}>
      <View
        style={{
          width: size,
          height: size,
          backgroundColor: tileBg,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: tileRadius,
        }}
      >
        <Text
          style={{
            fontSize: labelFontSize,
            color: labelColor,
            fontFamily: 'Poppins-Bold',
            lineHeight: labelFontSize + 1,
          }}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.7}
        >
          {letter}{sequence}
        </Text>
      </View>
      {status && (
        <View
          style={{
            position: 'absolute',
            width: pinSize,
            height: pinSize,
            bottom: -3,
            right: -3,
            borderRadius: pinSize / 2,
            alignItems: 'center',
            justifyContent: 'center',
            // Solid, fully opaque background so the pin reads as a
            // proper filled circle on every surface. NativeWind
            // `dark:bg-*-900/40` was 40% alpha and let the avatar
            // tile bleed through, which is what made the pin look
            // hollow / transparent in dark mode.
            backgroundColor: dark ? status.pinBgDark : status.pinBgLight,
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
