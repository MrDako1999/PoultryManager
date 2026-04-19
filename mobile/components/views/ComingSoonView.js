import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Construction } from 'lucide-react-native';
import { useHeroSheetTokens } from '@/components/HeroSheetScreen';

/**
 * Coming Soon placeholder used by accounting tabs (and any future area)
 * that's wired into the navigation but not yet implemented. Mirrors the
 * frontend's `PlaceholderPage` recipe but token-driven and DL-compliant.
 *
 * Visual recipe:
 *   - Centered 72pt accent-tinted icon tile with the entity icon (or the
 *     default `Construction` glyph).
 *   - 17pt Poppins-SemiBold title (textColor) + small "Coming Soon" eyebrow.
 *   - 13pt Poppins-Regular description (mutedColor), max-width 320pt.
 */
export default function ComingSoonView({
  title,
  description,
  icon: Icon = Construction,
}) {
  const { t } = useTranslation();
  const { textColor, mutedColor, accentColor, dark, screenBg } = useHeroSheetTokens();

  const tileBg = dark ? 'rgba(148,210,165,0.18)' : 'hsl(148, 35%, 92%)';
  const eyebrowBg = dark ? 'rgba(148,210,165,0.14)' : 'hsl(148, 35%, 94%)';

  return (
    <View style={[styles.container, { backgroundColor: screenBg }]}>
      <View style={[styles.iconTile, { backgroundColor: tileBg }]}>
        <Icon size={32} color={accentColor} strokeWidth={2} />
      </View>

      <View style={[styles.eyebrow, { backgroundColor: eyebrowBg }]}>
        <Text
          style={{
            fontSize: 11,
            fontFamily: 'Poppins-SemiBold',
            color: accentColor,
            letterSpacing: 0.8,
            textTransform: 'uppercase',
          }}
        >
          {t('modules.comingSoon', 'Coming Soon')}
        </Text>
      </View>

      {title ? (
        <Text style={[styles.title, { color: textColor }]}>{title}</Text>
      ) : null}

      <Text style={[styles.description, { color: mutedColor }]}>
        {description
          || t(
            'common.featureUnderDevelopment',
            'This feature is currently under development and will be available in a future update.'
          )}
      </Text>
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
    width: 72,
    height: 72,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  eyebrow: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    marginBottom: 12,
  },
  title: {
    fontSize: 20,
    lineHeight: 26,
    fontFamily: 'Poppins-Bold',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  description: {
    fontSize: 13,
    lineHeight: 19,
    fontFamily: 'Poppins-Regular',
    textAlign: 'center',
    maxWidth: 320,
  },
});
