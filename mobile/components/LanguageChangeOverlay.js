import { useEffect, useMemo, useRef } from 'react';
import { View, Text, Modal, Animated, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Languages, ArrowRight, ArrowLeft } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import useLocaleStore, { SUPPORTED_LANGUAGES } from '@/stores/localeStore';
import { isRtlLanguage } from '@/i18n';
import { useHeroSheetTokens } from '@/components/HeroSheetScreen';
import FlagTile, { getFlagComponent } from '@/components/flags';

/**
 * Full-screen overlay shown for ~1 second while the locale store flips
 * `i18n.language` and `I18nManager.forceRTL` underneath. Without it, the
 * picker closes and the page underneath snaps from English LTR to Arabic
 * RTL in a single frame — strings change, layouts mirror, scroll positions
 * jump. The eye reads it as a glitch.
 *
 * The overlay covers exactly that moment:
 *   1. Picker `handleSelect` fires → `setLanguage(code)` is invoked.
 *   2. The store sets `isChangingLanguage: true` synchronously, this Modal
 *      mounts, and the brand gradient + dim layer fade in over ~300ms.
 *   3. The store waits for the fade-in to complete, then runs the actual
 *      i18n + I18nManager change. The reflow happens completely behind
 *      this overlay — the user never sees the snap.
 *   4. The overlay holds for another ~700ms so the change reads as a
 *      deliberate beat, then fades out revealing the new language.
 *
 * Visual recipe is the §8.h.3 progress overlay from DESIGN_LANGUAGE.md —
 * same gradient backdrop, drag pill, big accent-tinted icon tile, and
 * indeterminate sliding-bar pattern as `FullResyncOverlay`. The flag-pair
 * tells the user *what* is changing without relying on translated copy
 * (which is itself in flux mid-overlay).
 */
export default function LanguageChangeOverlay() {
  const { t } = useTranslation();
  const tokens = useHeroSheetTokens();
  const {
    dark, accentColor, textColor, mutedColor, sectionBg, sectionBorder,
    heroGradient, borderColor,
  } = tokens;

  const isChangingLanguage = useLocaleStore((s) => s.isChangingLanguage);
  const pendingFrom = useLocaleStore((s) => s.pendingFrom);
  const pendingTo = useLocaleStore((s) => s.pendingTo);

  const visible = isChangingLanguage;

  const fromLang = useMemo(
    () => SUPPORTED_LANGUAGES.find((l) => l.code === pendingFrom) || SUPPORTED_LANGUAGES[0],
    [pendingFrom]
  );
  const toLang = useMemo(
    () => SUPPORTED_LANGUAGES.find((l) => l.code === pendingTo) || fromLang,
    [pendingTo, fromLang]
  );

  // Visually lock the overlay's own layout to the *starting* language's
  // direction. If we read `useIsRTL()` here, the gradient corner, chip-row
  // order, and arrow would all flip mid-flight when `set({isRTL: true})`
  // fires — the user would see the overlay itself mirror underneath them
  // and that's exactly the kind of glitch this overlay exists to hide.
  // `pendingFrom` is captured before the change and stays stable for the
  // overlay's whole lifetime, so deriving from it gives us a steady frame.
  const overlayRTL = isRtlLanguage(pendingFrom);

  // Progress-bar direction is locked to the *destination* language's reading
  // direction, not the source. This way the bar visually flows toward where
  // the user is going: switching to Arabic, the bar slides right → left
  // (Arabic reading flow); switching back to English, it slides left → right.
  // We can't use `useIsRTL()` for this either — that flips mid-overlay and
  // the bar would change direction in front of the user. `pendingTo` is
  // stable for the overlay's whole lifetime.
  const targetRTL = isRtlLanguage(pendingTo);

  // Indeterminate progress bar — same pattern as FullResyncOverlay so the
  // two transition overlays feel like siblings, not two unrelated UIs.
  const indeterminateAnim = useRef(new Animated.Value(0)).current;

  // Gentle 1.0 ↔ 1.06 pulse on the icon tile so the overlay reads as
  // "actively working" rather than a frozen modal. Soft enough that it
  // doesn't compete with the progress bar for attention.
  const iconPulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return undefined;

    indeterminateAnim.setValue(0);
    const barLoop = Animated.loop(
      Animated.timing(indeterminateAnim, {
        toValue: 1,
        duration: 1100,
        useNativeDriver: false,
      })
    );

    iconPulse.setValue(0);
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(iconPulse, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(iconPulse, {
          toValue: 0,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );

    barLoop.start();
    pulseLoop.start();

    return () => {
      barLoop.stop();
      pulseLoop.stop();
    };
  }, [indeterminateAnim, iconPulse, visible]);

  if (!visible) return null;

  // Note: the chunk slides in the *opposite* direction of the keyed edge.
  // With `left: indeterminateOffset` the chunk starts at left:100% (off the
  // right edge) and slides to left:-40% (off the left edge), i.e. R→L.
  // With `right: indeterminateOffset` it slides L→R. The `targetRTL`
  // ternary below picks the keyed edge, then this outputRange determines
  // whether the chunk's motion goes with or against the destination's
  // reading direction.
  const indeterminateOffset = indeterminateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['100%', '-40%'],
  });
  const iconScale = iconPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.06],
  });

  // Arrow points from leading to trailing edge in the *starting* direction,
  // so the visual reads "we're going from old → new" without flipping when
  // the page mirrors behind the overlay mid-flight.
  const Arrow = overlayRTL ? ArrowLeft : ArrowRight;

  const fromHasFlag = !!getFlagComponent(fromLang.code);
  const toHasFlag = !!getFlagComponent(toLang.code);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => {}}
    >
      {/* Brand-tinted backdrop — same recipe as FullResyncOverlay. The
          gradient sits behind a translucent screen-coloured layer so the
          brand reads through but the rest of the app stays soft. */}
      <View style={StyleSheet.absoluteFill}>
        <LinearGradient
          colors={heroGradient}
          start={overlayRTL ? { x: 1, y: 0 } : { x: 0, y: 0 }}
          end={overlayRTL ? { x: 0, y: 1 } : { x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: dark ? 'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.55)' },
          ]}
        />
      </View>

      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 32,
        }}
      >
        <View
          style={{
            width: '100%',
            maxWidth: 360,
            borderRadius: 24,
            paddingTop: 8,
            paddingBottom: 24,
            paddingHorizontal: 24,
            backgroundColor: sectionBg,
            borderWidth: 1,
            borderColor: sectionBorder,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 12 },
            shadowOpacity: dark ? 0.5 : 0.18,
            shadowRadius: 24,
            elevation: 16,
            overflow: 'hidden',
          }}
        >
          {/* Slim grab pill — purely decorative, echoes the bottom-sheet
              vocabulary so the overlay feels familiar. */}
          <View style={styles.dragPillRow}>
            <View
              style={{
                width: 36,
                height: 4,
                borderRadius: 2,
                backgroundColor: dark ? 'hsl(150, 14%, 28%)' : 'hsl(148, 14%, 86%)',
              }}
            />
          </View>

          {/* Pulsing accent-tinted icon tile — matches §7 icon-tile hero. */}
          <Animated.View
            style={[
              styles.iconTile,
              {
                backgroundColor: dark ? 'rgba(148,210,165,0.18)' : 'hsl(148, 35%, 92%)',
                transform: [{ scale: iconScale }],
              },
            ]}
          >
            <Languages size={28} color={accentColor} strokeWidth={2.2} />
          </Animated.View>

          <Text
            style={{
              fontSize: 18,
              fontFamily: 'Poppins-SemiBold',
              color: textColor,
              letterSpacing: -0.2,
              textAlign: 'center',
              marginTop: 16,
            }}
          >
            {t('settings.changingLanguageTitle', 'Changing language')}
          </Text>

          {/* Visual FROM → TO transition. Uses flags + native names so the
              meaning is unambiguous even while the i18n strings around it
              are mid-flip. */}
          <View
            style={{
              flexDirection: overlayRTL ? 'row-reverse' : 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 12,
              marginTop: 14,
            }}
          >
            <LanguageChip
              lang={fromLang}
              hasFlag={fromHasFlag}
              dark={dark}
              accentColor={accentColor}
              textColor={textColor}
              mutedColor={mutedColor}
              borderColor={borderColor}
              isTarget={false}
            />
            <Arrow size={16} color={mutedColor} strokeWidth={2.2} />
            <LanguageChip
              lang={toLang}
              hasFlag={toHasFlag}
              dark={dark}
              accentColor={accentColor}
              textColor={textColor}
              mutedColor={mutedColor}
              borderColor={borderColor}
              isTarget
            />
          </View>

          {/* Indeterminate progress bar — same sliding-accent animation as
              FullResyncOverlay so the two overlays feel like siblings.
              The chunk slides toward the *destination* reading direction
              (R→L when going to Arabic, L→R when going to English) so the
              motion visually flows toward the language the user is entering. */}
          <View
            style={{
              height: 6,
              borderRadius: 3,
              backgroundColor: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
              overflow: 'hidden',
              marginTop: 22,
              marginBottom: 12,
              position: 'relative',
            }}
          >
            <Animated.View
              style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                [targetRTL ? 'right' : 'left']: indeterminateOffset,
                width: '40%',
                borderRadius: 3,
                backgroundColor: accentColor,
              }}
            />
          </View>

          <Text
            style={{
              fontSize: 12,
              fontFamily: 'Poppins-Regular',
              color: mutedColor,
              textAlign: 'center',
              letterSpacing: 0.1,
            }}
          >
            {t(
              'settings.changingLanguageHint',
              'Updating layout and translations'
            )}
          </Text>
        </View>
      </View>
    </Modal>
  );
}

/**
 * Compact pill that shows a language as `[flag] NATIVE_NAME`. The target
 * variant has a soft accent ring so the user's eye lands on where they
 * are going, not where they came from.
 */
function LanguageChip({
  lang,
  hasFlag,
  dark,
  accentColor,
  textColor,
  mutedColor,
  borderColor,
  isTarget,
}) {
  const bg = isTarget
    ? (dark ? 'rgba(148,210,165,0.14)' : 'hsl(148, 35%, 95%)')
    : (dark ? 'rgba(255,255,255,0.04)' : 'hsl(148, 12%, 96%)');
  const border = isTarget
    ? accentColor
    : borderColor;
  const labelColor = isTarget ? accentColor : textColor;

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 12,
        backgroundColor: bg,
        borderWidth: isTarget ? 1.2 : StyleSheet.hairlineWidth,
        borderColor: border,
      }}
    >
      {hasFlag ? (
        <FlagTile code={lang.code} size={16} width={24} radius={4} />
      ) : (
        <View
          style={{
            width: 24,
            height: 16,
            borderRadius: 4,
            backgroundColor: dark ? 'rgba(255,255,255,0.08)' : 'hsl(148, 14%, 92%)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text
            style={{
              fontFamily: 'Poppins-Bold',
              fontSize: 9,
              color: mutedColor,
              letterSpacing: 0.4,
            }}
          >
            {lang.code.toUpperCase()}
          </Text>
        </View>
      )}
      <Text
        style={{
          fontSize: 13,
          fontFamily: 'Poppins-SemiBold',
          color: labelColor,
          letterSpacing: 0.1,
        }}
        numberOfLines={1}
      >
        {lang.native}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  dragPillRow: {
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 6,
    marginHorizontal: -24,
  },
  iconTile: {
    alignSelf: 'center',
    marginTop: 14,
    width: 64,
    height: 64,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

