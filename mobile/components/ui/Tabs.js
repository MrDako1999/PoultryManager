import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, ScrollView, Animated, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useHeroSheetTokens } from '@/components/HeroSheetScreen';
import { useIsRTL } from '@/stores/localeStore';

/**
 * Tabs strip — design-language tokenized.
 *
 * Drop-in replacement for the legacy NativeWind tabs. Same props, same
 * `position` Animated.Value contract for PagerView-driven indicator slides.
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
  position,
}) {
  const tokens = useHeroSheetTokens();
  const { sheetBg, borderColor, mutedColor, accentColor } = tokens;
  const isRTL = useIsRTL();

  const scrollRef = useRef(null);
  const [layouts, setLayouts] = useState({});
  const containerWidth = useRef(0);
  const internalProgress = useRef(new Animated.Value(0)).current;

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

  // Drive a continuous progress value either from the parent (PagerView scroll)
  // or, as a fallback, from our own state via spring. The progress value is
  // ALWAYS in source order — we map it to render order at interpolation time.
  useEffect(() => {
    if (position) return;
    Animated.spring(internalProgress, {
      toValue: sourceActiveIndex,
      useNativeDriver: false,
      friction: 12,
      tension: 90,
    }).start();
  }, [sourceActiveIndex, position, internalProgress]);

  const progress = position || internalProgress;

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

  const indicatorStyle = useMemo(() => {
    if (!layoutsReady) return null;

    // Single-tab strip can't be interpolated (interpolate needs >= 2
    // points). Fall back to a static underline anchored under the only
    // tab. Same defensive case as before — capability-restricted users
    // can land on a 1-tab strip, e.g. ground_staff with only Overview.
    if (renderTabs.length < 2) {
      const only = layouts[renderTabs[0].key];
      return {
        transform: [{ translateX: only.x + 12 }],
        width: Math.max(0, only.width - 24),
      };
    }

    // Build inputRange in source order [0..N-1], outputRange holds the
    // RENDER-order layout.x of the corresponding source-order tab.
    // That way `progress = sourceIdx` always maps to the visual x of
    // the tab the user actually wants to highlight.
    const inputRange = tabs.map((_, sIdx) => sIdx);
    const xOutput = tabs.map((sourceTab) => {
      const layout = layouts[sourceTab.key];
      return (layout?.x ?? 0) + 12;
    });
    const widthOutput = tabs.map((sourceTab) => {
      const layout = layouts[sourceTab.key];
      return Math.max(0, (layout?.width ?? 0) - 24);
    });

    const translateX = progress.interpolate({
      inputRange,
      outputRange: xOutput,
      extrapolate: 'clamp',
    });
    const width = progress.interpolate({
      inputRange,
      outputRange: widthOutput,
      extrapolate: 'clamp',
    });
    return { transform: [{ translateX }], width };
  }, [layoutsReady, tabs, renderTabs, layouts, progress]);

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

          {indicatorStyle && (
            <Animated.View
              pointerEvents="none"
              style={[
                styles.indicator,
                { backgroundColor: accentColor },
                indicatorStyle,
              ]}
            />
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function AnimatedTabLabel({ progress, index, label, mutedColor, accentColor }) {
  // Active text fades in around `index`, fully visible at `index`, fades out
  // toward neighbors. Inactive text does the inverse.
  const activeOpacity = progress.interpolate({
    inputRange: [index - 1, index, index + 1],
    outputRange: [0, 1, 0],
    extrapolate: 'clamp',
  });
  const inactiveOpacity = progress.interpolate({
    inputRange: [index - 1, index, index + 1],
    outputRange: [1, 0, 1],
    extrapolate: 'clamp',
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
          {
            position: 'absolute',
            top: 0, left: 0, right: 0,
            opacity: inactiveOpacity,
            color: mutedColor,
          },
        ]}
        numberOfLines={1}
      >
        {label}
      </Animated.Text>
      <Animated.Text
        style={[
          styles.label,
          styles.labelActive,
          {
            position: 'absolute',
            top: 0, left: 0, right: 0,
            opacity: activeOpacity,
            color: accentColor,
          },
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
  indicator: {
    position: 'absolute',
    left: 0,
    bottom: 0,
    height: 2.5,
    borderRadius: 1.5,
  },
});
