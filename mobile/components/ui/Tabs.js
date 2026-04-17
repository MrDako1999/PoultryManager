import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, ScrollView, Animated } from 'react-native';
import * as Haptics from 'expo-haptics';

export default function Tabs({
  tabs,
  value,
  onChange,
  position,
  className = '',
}) {
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
      className={`border-b border-border bg-background ${className}`}
      onLayout={(e) => { containerWidth.current = e.nativeEvent.layout.width; }}
    >
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 8 }}
      >
        <View>
          <View className="flex-row">
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
                  className="px-3"
                  style={{ minHeight: 44 }}
                  hitSlop={6}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: isActive }}
                >
                  <View className="flex-1 justify-center" style={{ paddingBottom: 8 }}>
                    <AnimatedTabLabel
                      progress={progress}
                      index={i}
                      label={tab.label}
                    />
                  </View>
                </Pressable>
              );
            })}
          </View>

          {indicatorStyle && (
            <Animated.View
              pointerEvents="none"
              className="bg-primary rounded-full"
              style={[
                {
                  position: 'absolute',
                  left: 0,
                  bottom: 0,
                  height: 2,
                },
                indicatorStyle,
              ]}
            />
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function AnimatedTabLabel({ progress, index, label }) {
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
      <Animated.Text
        className="text-sm font-medium text-muted-foreground"
        numberOfLines={1}
        style={{ opacity: inactiveOpacity }}
      >
        {label}
      </Animated.Text>
      <Animated.Text
        className="text-sm font-semibold text-primary"
        numberOfLines={1}
        style={{
          position: 'absolute',
          top: 0, left: 0, right: 0,
          opacity: activeOpacity,
        }}
      >
        {label}
      </Animated.Text>
    </View>
  );
}
