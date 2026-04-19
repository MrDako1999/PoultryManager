import { View, Text, Pressable, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useHeroSheetTokens } from '@/components/HeroSheetScreen';

/**
 * Token-driven empty-state placeholder. Used everywhere a list / view has
 * no data yet (or filters returned nothing).
 *
 * Previously used Tailwind `text-muted-foreground` + `bg-muted` + a
 * hardcoded `hsl(150, 10%, 45%)` icon color that was effectively invisible
 * against the dark-mode muted surface. Now everything pulls from
 * useHeroSheetTokens() so both themes render with proper contrast.
 *
 * Visual recipe (matches DL §6 + §8.b icon-tile pattern):
 *   - 64pt accent-tinted icon tile with the entity's lucide glyph in
 *     accent color (high-contrast in both themes).
 *   - 17pt Poppins-SemiBold title (textColor).
 *   - 13pt Poppins-Regular description (mutedColor).
 *   - Optional accent-filled CTA (white text, Poppins-SemiBold, 14pt radius).
 */
export default function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
}) {
  const { textColor, mutedColor, accentColor, dark } = useHeroSheetTokens();
  // Tile bg uses the same accent-tinted recipe as Settings rows / list
  // avatars — readable in both themes without needing per-theme color
  // overrides on the icon glyph.
  const tileBg = dark ? 'rgba(148,210,165,0.18)' : 'hsl(148, 35%, 92%)';

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onAction?.();
  };

  return (
    <View style={styles.container}>
      {Icon ? (
        <View style={[styles.iconTile, { backgroundColor: tileBg }]}>
          <Icon size={28} color={accentColor} strokeWidth={2} />
        </View>
      ) : null}
      {title ? (
        <Text style={[styles.title, { color: textColor }]}>{title}</Text>
      ) : null}
      {description ? (
        <Text style={[styles.description, { color: mutedColor }]}>
          {description}
        </Text>
      ) : null}
      {actionLabel && onAction ? (
        <Pressable
          onPress={handlePress}
          android_ripple={{ color: 'rgba(255,255,255,0.18)', borderless: false }}
          style={({ pressed }) => [
            styles.cta,
            {
              backgroundColor: accentColor,
              opacity: pressed ? 0.9 : 1,
              transform: [{ scale: pressed ? 0.98 : 1 }],
            },
          ]}
          accessibilityRole="button"
        >
          <Text style={styles.ctaText}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 56,
  },
  iconTile: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  title: {
    fontSize: 17,
    lineHeight: 22,
    fontFamily: 'Poppins-SemiBold',
    textAlign: 'center',
    marginBottom: 6,
    letterSpacing: -0.2,
  },
  description: {
    fontSize: 13,
    lineHeight: 19,
    fontFamily: 'Poppins-Regular',
    textAlign: 'center',
    maxWidth: 300,
    marginBottom: 24,
  },
  cta: {
    minHeight: 48,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: {
    fontSize: 15,
    fontFamily: 'Poppins-SemiBold',
    color: '#ffffff',
    letterSpacing: 0.1,
  },
});
