import { useState } from 'react';
import {
  View, Text, Pressable, ActivityIndicator, StyleSheet,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useHeroSheetTokens } from '@/components/HeroSheetScreen';
import { useIsRTL } from '@/stores/localeStore';

/**
 * Polished design-language CTA button used by the form sheets and the
 * detail-screen bottom CTA strips.
 *
 * Three variants:
 *   - `primary`     — filled accent green, white text. Save / Create / Next.
 *   - `secondary`   — soft accent-tinted fill, accent border, accent text.
 *                     View Invoice / Back / outline-style actions.
 *   - `destructive` — soft error-tinted fill, error border, error text.
 *                     Delete / destructive cascades.
 *
 * IMPORTANT: this MUST use a STATIC `style` array on the Pressable. The
 * functional `style={({ pressed }) => [...]}` form triggers DL §9
 * "NativeWind / Pressable functional-style trap" which silently strips
 * layout props (height, border, bg). Press feedback is tracked via
 * local state instead.
 *
 * @param {object} props
 * @param {'primary'|'secondary'|'destructive'} [props.variant='primary']
 * @param {Component} [props.icon] - Optional lucide icon component
 * @param {string} props.label
 * @param {() => void} props.onPress
 * @param {boolean} [props.loading=false] - Swaps the icon for an
 *   ActivityIndicator and blocks taps
 * @param {boolean} [props.disabled=false] - Greys out and blocks taps
 */
export default function CtaButton({
  variant = 'primary',
  icon: Icon,
  label,
  onPress,
  loading = false,
  disabled = false,
}) {
  const tokens = useHeroSheetTokens();
  const isRTL = useIsRTL();
  const { dark, accentColor, errorColor } = tokens;
  const [pressed, setPressed] = useState(false);

  // Variant-driven colour palette.
  const palette = (() => {
    if (variant === 'destructive') {
      return {
        idleBg: dark ? 'rgba(252,165,165,0.10)' : 'rgba(220,38,38,0.06)',
        pressedBg: dark ? 'rgba(252,165,165,0.18)' : 'rgba(220,38,38,0.12)',
        border: errorColor,
        fg: errorColor,
        ripple: dark ? 'rgba(252,165,165,0.16)' : 'rgba(220,38,38,0.10)',
      };
    }
    if (variant === 'secondary') {
      return {
        idleBg: dark ? 'rgba(148,210,165,0.16)' : 'hsl(148, 35%, 92%)',
        pressedBg: dark ? 'rgba(148,210,165,0.26)' : 'hsl(148, 35%, 86%)',
        border: accentColor,
        fg: accentColor,
        ripple: dark ? 'rgba(148,210,165,0.18)' : 'rgba(20,83,45,0.12)',
      };
    }
    // primary
    return {
      idleBg: accentColor,
      pressedBg: dark ? 'hsl(148, 55%, 48%)' : 'hsl(148, 60%, 24%)',
      // Filled buttons set the border to the same colour as the fill so
      // the 1.5pt border doesn't read as a visible outline; the unified
      // border keeps the 56pt height pixel-identical across variants.
      border: accentColor,
      fg: '#f5f8f5',
      ripple: 'rgba(255,255,255,0.18)',
    };
  })();

  const isBlocked = disabled || loading;

  return (
    <Pressable
      onPressIn={() => {
        if (isBlocked) return;
        setPressed(true);
        Haptics.selectionAsync().catch(() => {});
      }}
      onPressOut={() => setPressed(false)}
      onPress={onPress}
      disabled={isBlocked}
      android_ripple={{ color: palette.ripple, borderless: false }}
      style={[
        styles.btn,
        {
          backgroundColor: pressed ? palette.pressedBg : palette.idleBg,
          borderColor: palette.border,
          opacity: isBlocked ? 0.55 : (pressed ? 0.95 : 1),
        },
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: isBlocked, busy: loading }}
    >
      <View style={[styles.inner, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        {loading ? (
          <ActivityIndicator size="small" color={palette.fg} />
        ) : Icon ? (
          <Icon size={18} color={palette.fg} strokeWidth={2.4} />
        ) : null}
        <Text
          style={{
            fontSize: 15,
            fontFamily: 'Poppins-SemiBold',
            color: palette.fg,
          }}
          numberOfLines={1}
        >
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: '100%',
    height: 56,
    borderRadius: 16,
    borderWidth: 1.5,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inner: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
});
