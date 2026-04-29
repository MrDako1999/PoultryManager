import { useEffect, useRef } from 'react';
import { View, Animated } from 'react-native';
import { useHeroSheetTokens } from '@/components/HeroSheetScreen';

/**
 * FeedProgressBar — universal feed progress primitive with optional
 * 3-zone target visualization.
 *
 * Two display modes, controlled by whether `targetKg` is supplied:
 *
 *   2-state (no targetKg) — backwards-compatible visual:
 *     - Track    = ordered envelope (translucent accent)
 *     - Solid    = consumed (accent)
 *     The bar's full extent IS the ordered amount — no third zone.
 *
 *   3-state (targetKg > 0):
 *     - Track    = TARGET envelope (palest accent) — full bar = target
 *     - Mid fill = ordered position relative to target (medium accent)
 *     - Solid    = consumed position relative to target (solid accent)
 *     The contrast between the three opacities reads at a glance:
 *         solid    → consumed so far
 *         medium   → ordered so far (consumed + on-the-shelf)
 *         palest   → still to order to hit target
 *     The gap between the medium fill and the right edge of the bar
 *     IS the kg the operator should still purchase.
 *
 * Width transitions are spring-free `Animated.timing` (500ms, easeInOut)
 * so values landing from a sync feel measured rather than snapping.
 *
 * @param {object} props
 * @param {number} [props.consumedKg=0]
 * @param {number} [props.orderedKg=0]
 * @param {number} [props.targetKg] - When > 0 enables the 3-zone visual.
 * @param {number} [props.height=6]
 */
export default function FeedProgressBar({
  consumedKg = 0,
  orderedKg = 0,
  targetKg,
  height = 6,
}) {
  const { accentColor, dark } = useHeroSheetTokens();

  const hasTarget = typeof targetKg === 'number' && targetKg > 0;
  const denominator = hasTarget ? targetKg : orderedKg;

  const consumedPct = denominator > 0
    ? Math.min(100, Math.max(0, (consumedKg / denominator) * 100))
    : 0;
  const orderedPct = denominator > 0
    ? Math.min(100, Math.max(0, (orderedKg / denominator) * 100))
    : 0;

  // Always start at 0 so the bars "pour in" on mount. Subsequent
  // value changes (data sync, filter change) animate from current to
  // target via the same Animated.timing call below.
  const consumedAnim = useRef(new Animated.Value(0)).current;
  const orderedAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(consumedAnim, {
      toValue: consumedPct,
      duration: 500,
      // Width animations can't run on the native driver — RN
      // restricts useNativeDriver to transform/opacity. The bars are
      // light enough on the JS thread that this isn't a concern.
      useNativeDriver: false,
    }).start();
    Animated.timing(orderedAnim, {
      toValue: orderedPct,
      duration: 500,
      useNativeDriver: false,
    }).start();
  }, [consumedPct, orderedPct, consumedAnim, orderedAnim]);

  const consumedWidth = consumedAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });
  const orderedWidth = orderedAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });

  // Three accent shades on the same hue (148°). Hardcoded HSL/A so
  // the bar's visual hierarchy holds across every surface that
  // renders it without depending on the theme tokens for these
  // intermediates.
  //
  // Tuned for *contrast* between the three zones — the previous
  // (0.20 / 0.42) and (91% / 78%) pairings blurred together at this
  // height. The track is now nearly the card background (very low
  // alpha / near-95% lightness) so the empty-to-fill transition
  // reads as "filled vs empty" rather than two flavours of green;
  // the medium fill is meaningfully darker so the consumed → ordered
  // boundary is unambiguous.
  const trackColor = dark
    ? 'rgba(148,210,165,0.12)'
    : 'hsl(148, 30%, 95%)';
  const orderedFillColor = dark
    ? 'rgba(148,210,165,0.58)'
    : 'hsl(148, 38%, 68%)';

  return (
    <View
      style={{
        height,
        borderRadius: height / 2,
        backgroundColor: trackColor,
        overflow: 'hidden',
      }}
    >
      {hasTarget ? (
        <Animated.View
          style={{
            width: orderedWidth,
            height: '100%',
            backgroundColor: orderedFillColor,
            borderRadius: height / 2,
          }}
        />
      ) : null}
      <Animated.View
        style={{
          position: 'absolute',
          top: 0,
          // `start` is the RTL-safe alias for `left` — auto-flips
          // to the right edge in RTL locales so the bar always
          // fills from the inline-start side regardless of
          // direction.
          start: 0,
          width: consumedWidth,
          height: '100%',
          backgroundColor: accentColor,
          borderRadius: height / 2,
        }}
      />
    </View>
  );
}
