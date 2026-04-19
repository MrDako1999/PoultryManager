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

  const activeIndex = useMemo(
    () => Math.max(0, tabs.findIndex((t) => t.key === value)),
    [tabs, value]
  );

  // Drive a continuous progress value either from the parent (PagerView scroll)
  // or, as a fallback, from our own state via spring.
  useEffect(() => {
    if (position) return;
    Animated.spring(internalProgress, {
      toValue: activeIndex,
      useNativeDriver: false,
      friction: 12,
      tension: 90,
    }).start();
  }, [activeIndex, position, internalProgress]);

  const progress = position || internalProgress;

  const orderedLayouts = useMemo(
    () => tabs.map((t) => layouts[t.key]).filter(Boolean),
    [tabs, layouts]
  );

  const layoutsReady = orderedLayouts.length === tabs.length && tabs.length > 0;

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
    const inputRange = orderedLayouts.map((_, i) => i);
    const translateX = progress.interpolate({
      inputRange,
      outputRange: orderedLayouts.map((l) => l.x + 12),
      extrapolate: 'clamp',
    });
    const width = progress.interpolate({
      inputRange,
      outputRange: orderedLayouts.map((l) => Math.max(0, l.width - 24)),
      extrapolate: 'clamp',
    });
    return { transform: [{ translateX }], width };
  }, [layoutsReady, orderedLayouts, progress]);

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
        <View>
          <View style={[styles.row, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
            {tabs.map((tab, i) => {
              const isActive = i === activeIndex;
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
                      index={i}
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
