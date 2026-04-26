import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { useHeroSheetTokens } from '@/components/HeroSheetScreen';
import { useIsRTL } from '@/stores/localeStore';

/**
 * Tabs strip — design-language tokenized.
 *
 * Drop-in replacement for the legacy NativeWind tabs. Same props, except the
 * pager integration now uses a reanimated `SharedValue` (`progress`) instead
 * of an `Animated.Value` (`position`) so the indicator and label fades run
 * on the UI thread.
 *
 * Before the migration every `onPageScroll` event had to bridge native → JS,
 * fire a `setValue()` on a plain `Animated.Value`, rerun every bound
 * `interpolate()` on the JS thread, and bridge every style update back to
 * native. On Android under load (e.g. the batch detail screen during data
 * hydration) that loop dropped the tab indicator to ~2 fps even though the
 * underlying pager swipe stayed smooth — the exact "highlighter lags the
 * swipe" complaint users were hitting.
 *
 * Now `progress.value` is written from a pager worklet on the UI thread and
 * every `useAnimatedStyle` reader runs there too; the JS thread is out of
 * the hot path entirely.
 *
 * Visual:
 *   - Strip background: sheetBg, hairline bottom border (borderColor)
 *   - Inactive label: Poppins-Medium 14pt, mutedColor
 *   - Active label: Poppins-SemiBold 14pt, accentColor
 *   - Indicator: 2.5pt accent-colored bar, rounded ends, slides smoothly
 */
export default function Tabs({
  tabs,
  value,
  onChange,
  progress: externalProgress,
}) {
  const tokens = useHeroSheetTokens();
  const { sheetBg, borderColor, mutedColor, accentColor } = tokens;
  const isRTL = useIsRTL();

  const scrollRef = useRef(null);
  const [layouts, setLayouts] = useState({});
  const containerWidth = useRef(0);
  // When the parent doesn't supply a pager-driven SharedValue (e.g. the
  // Accounting tab strip with no swipe pager) we drive the indicator with a
  // local spring on a SharedValue of our own. The contract — "progress is a
  // reanimated SharedValue whose numeric value is the source-order index" —
  // is identical either way, so the rest of the component doesn't need to
  // branch on where it came from.
  const internalProgress = useSharedValue(0);
  const progress = externalProgress || internalProgress;

  // The strip lays out children in the SAME order they appear in `tabs`,
  // but we render them in reversed order when the locale is RTL. Why
  // reverse instead of relying on `flexDirection: row-reverse`?
  //
  // Because Yoga reports `onLayout.x` differently in `row-reverse` than
  // in plain `row`, AND iOS auto-flips `row` when `I18nManager.isRTL`
  // is true — those two behaviours combined have edge cases where the
  // reported `x` for tab[i] doesn't match the visual position of that
  // tab. The tab indicator (driven by an Animated interpolation against
  // `layout.x`) ends up landing on a totally different tab than the one
  // you tapped — exactly the "indicator on الأداء while السجلات اليومية
  // is highlighted" bug the user screenshotted.
  //
  // Reversing the children explicitly + keeping `flexDirection: 'row'`
  // makes the layout 100% deterministic in both directions: tab[0] in
  // render order is always the leftmost, regardless of locale or native
  // RTL state.
  const renderTabs = useMemo(
    () => (isRTL ? [...tabs].reverse() : tabs),
    [tabs, isRTL]
  );

  const sourceActiveIndex = useMemo(
    () => Math.max(0, tabs.findIndex((t) => t.key === value)),
    [tabs, value]
  );

  // Drive our internal progress via spring when no external (pager) progress
  // was supplied. `withSpring` runs fully on the UI thread.
  useEffect(() => {
    if (externalProgress) return;
    internalProgress.value = withSpring(sourceActiveIndex, {
      damping: 18,
      stiffness: 180,
      mass: 1,
    });
  }, [sourceActiveIndex, externalProgress, internalProgress]);

  const layoutsReady = renderTabs.every((t) => layouts[t.key]) && renderTabs.length > 0;

  // Auto-scroll the tab strip so the active tab is centered.
  useEffect(() => {
    const layout = layouts[value];
    if (layout && scrollRef.current && containerWidth.current > 0) {
      const target = Math.max(0, layout.x - (containerWidth.current - layout.width) / 2);
      scrollRef.current.scrollTo({ x: target, animated: true });
    }
  }, [value, layouts]);

  const handlePress = (key) => {
    if (key === value) return;
    Haptics.selectionAsync().catch(() => {});
    onChange?.(key);
  };

  // Pre-compute the interpolation input/output arrays in source order. We
  // snapshot them into numeric arrays so the worklet below can capture them
  // cleanly (reanimated rebuilds the worklet when the deps change).
  const { inputRange, xOutput, widthOutput } = useMemo(() => {
    if (!layoutsReady || renderTabs.length < 2) {
      return { inputRange: [], xOutput: [], widthOutput: [] };
    }
    const input = tabs.map((_, sIdx) => sIdx);
    const x = tabs.map((sourceTab) => {
      const layout = layouts[sourceTab.key];
      return (layout?.x ?? 0) + 12;
    });
    const w = tabs.map((sourceTab) => {
      const layout = layouts[sourceTab.key];
      return Math.max(0, (layout?.width ?? 0) - 24);
    });
    return { inputRange: input, xOutput: x, widthOutput: w };
  }, [layoutsReady, tabs, renderTabs, layouts]);

  const animatedIndicatorStyle = useAnimatedStyle(() => {
    if (inputRange.length < 2) {
      return { transform: [{ translateX: 0 }], width: 0, opacity: 0 };
    }
    const translateX = interpolate(
      progress.value,
      inputRange,
      xOutput,
      Extrapolation.CLAMP
    );
    const width = interpolate(
      progress.value,
      inputRange,
      widthOutput,
      Extrapolation.CLAMP
    );
    return {
      transform: [{ translateX }],
      width,
      opacity: 1,
    };
  }, [inputRange, xOutput, widthOutput]);

  // Single-tab strip can't be interpolated. Fall back to a static underline
  // anchored under the only tab. Same defensive case as before —
  // capability-restricted users can land on a 1-tab strip.
  const staticIndicatorStyle = useMemo(() => {
    if (!layoutsReady || renderTabs.length !== 1) return null;
    const only = layouts[renderTabs[0].key];
    return {
      transform: [{ translateX: only.x + 12 }],
      width: Math.max(0, only.width - 24),
    };
  }, [layoutsReady, renderTabs, layouts]);

  return (
    <View
      style={[
        styles.shell,
        {
          backgroundColor: sheetBg,
          borderBottomColor: borderColor,
        },
      ]}
      onLayout={(e) => { containerWidth.current = e.nativeEvent.layout.width; }}
    >
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View
          style={{
            // Force the strip's internal layout to LTR. We've already
            // reversed `renderTabs` for RTL above; doing it via a real
            // `row-reverse` would re-introduce the layout.x ambiguity
            // that broke the indicator. Pinning to LTR makes onLayout
            // report x from the left in pixel order, which is what the
            // indicator math relies on.
            direction: 'ltr',
          }}
        >
          <View style={[styles.row, { flexDirection: 'row' }]}>
            {renderTabs.map((tab) => {
              const sourceIdx = tabs.findIndex((t) => t.key === tab.key);
              const isActive = tab.key === value;
              return (
                <Pressable
                  key={tab.key}
                  onPress={() => handlePress(tab.key)}
                  onLayout={(e) => {
                    const { x, width } = e.nativeEvent.layout;
                    setLayouts((prev) => {
                      const existing = prev[tab.key];
                      if (existing && existing.x === x && existing.width === width) return prev;
                      return { ...prev, [tab.key]: { x, width } };
                    });
                  }}
                  style={styles.tab}
                  hitSlop={6}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: isActive }}
                >
                  <View style={styles.tabInner}>
                    <AnimatedTabLabel
                      progress={progress}
                      index={sourceIdx}
                      label={tab.label}
                      mutedColor={mutedColor}
                      accentColor={accentColor}
                    />
                  </View>
                </Pressable>
              );
            })}
          </View>

          {staticIndicatorStyle ? (
            <View
              pointerEvents="none"
              style={[
                styles.indicator,
                { backgroundColor: accentColor },
                staticIndicatorStyle,
              ]}
            />
          ) : layoutsReady ? (
            <Animated.View
              pointerEvents="none"
              style={[
                styles.indicator,
                { backgroundColor: accentColor },
                animatedIndicatorStyle,
              ]}
            />
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

function AnimatedTabLabel({ progress, index, label, mutedColor, accentColor }) {
  // Active text fades in around `index`, fully visible at `index`, fades out
  // toward neighbors. Inactive text does the inverse. Both opacities are
  // derived on the UI thread — before the reanimated migration this block
  // was two JS-side `Animated.Value.interpolate()` calls per tab, which is
  // what tanked the frame rate on Android during a swipe.
  const activeStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      progress.value,
      [index - 1, index, index + 1],
      [0, 1, 0],
      Extrapolation.CLAMP
    );
    return { opacity };
  });
  const inactiveStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      progress.value,
      [index - 1, index, index + 1],
      [1, 0, 1],
      Extrapolation.CLAMP
    );
    return { opacity };
  });

  return (
    <View>
      {/* Invisible spacer locks the width to the wider (semibold) label so
          neither the active nor inactive text gets truncated. */}
      <Text
        style={[styles.label, styles.labelActive, { opacity: 0, color: accentColor }]}
        numberOfLines={1}
      >
        {label}
      </Text>
      <Animated.Text
        style={[
          styles.label,
          styles.labelInactive,
          styles.labelOverlay,
          { color: mutedColor },
          inactiveStyle,
        ]}
        numberOfLines={1}
      >
        {label}
      </Animated.Text>
      <Animated.Text
        style={[
          styles.label,
          styles.labelActive,
          styles.labelOverlay,
          { color: accentColor },
          activeStyle,
        ]}
        numberOfLines={1}
      >
        {label}
      </Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  scrollContent: {
    paddingHorizontal: 8,
  },
  row: {
    alignItems: 'flex-end',
  },
  tab: {
    paddingHorizontal: 14,
    minHeight: 44,
  },
  tabInner: {
    flex: 1,
    justifyContent: 'center',
    paddingBottom: 10,
    paddingTop: 6,
  },
  label: {
    fontSize: 14,
    letterSpacing: 0.1,
  },
  labelInactive: {
    fontFamily: 'Poppins-Medium',
  },
  labelActive: {
    fontFamily: 'Poppins-SemiBold',
  },
  labelOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  indicator: {
    position: 'absolute',
    left: 0,
    bottom: 0,
    height: 2.5,
    borderRadius: 1.5,
  },
});
