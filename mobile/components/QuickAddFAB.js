import { useState, useRef, useCallback } from 'react';
import { View, Text, Pressable, Animated, StyleSheet, Easing } from 'react-native';
import { Plus } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import useThemeStore from '@/stores/themeStore';

const FAB_SIZE = 56;
const MENU_GAP = 10;
const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1);

export default function QuickAddFAB({ items, bottomInset = 0 }) {
  const { resolvedTheme } = useThemeStore();
  const dark = resolvedTheme === 'dark';
  const primaryColor = dark ? 'hsl(148, 48%, 38%)' : 'hsl(148, 60%, 20%)';

  const [open, setOpen] = useState(false);
  const card = useRef(new Animated.Value(0)).current;
  const rowsRef = useRef(null);
  if (!rowsRef.current) rowsRef.current = items.map(() => new Animated.Value(0));
  const rows = rowsRef.current;

  const show = useCallback(() => {
    setOpen(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    card.setValue(0);
    rows.forEach((r) => r.setValue(0));

    Animated.parallel([
      Animated.timing(card, {
        toValue: 1,
        duration: 240,
        easing: EASE_OUT,
        useNativeDriver: true,
      }),
      // Bottom row first (closest to FAB), cascading upward
      Animated.stagger(
        35,
        [...rows].reverse().map((r) =>
          Animated.timing(r, {
            toValue: 1,
            duration: 280,
            easing: EASE_OUT,
            useNativeDriver: true,
          }),
        ),
      ),
    ]).start();
  }, [card, rows]);

  const hide = useCallback(() => {
    Animated.timing(card, {
      toValue: 0,
      duration: 130,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      rows.forEach((r) => r.setValue(0));
      setOpen(false);
    });
  }, [card, rows]);

  const toggle = useCallback(() => {
    if (open) hide();
    else show();
  }, [open, show, hide]);

  const handleSelect = useCallback(
    (onPress) => {
      hide();
      setTimeout(onPress, 100);
    },
    [hide],
  );

  // FAB icon rotation
  const fabRotation = card.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '45deg'],
  });

  // Card: scales up from bottom-right corner + slides up from behind FAB
  const cardScale = card.interpolate({
    inputRange: [0, 1],
    outputRange: [0.4, 1],
  });
  const cardTranslateY = card.interpolate({
    inputRange: [0, 1],
    outputRange: [40, 0],
  });

  return (
    <>
      {open && (
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: 'rgba(0,0,0,0.3)', opacity: card },
          ]}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={hide} />
        </Animated.View>
      )}

      {open && (
        <Animated.View
          style={{
            position: 'absolute',
            right: 20,
            bottom: bottomInset + 16 + FAB_SIZE + MENU_GAP,
            opacity: card,
            transform: [{ scale: cardScale }, { translateY: cardTranslateY }],
            transformOrigin: 'bottom right',
          }}
        >
          <View
            className="bg-card border border-border overflow-hidden"
            style={{
              borderRadius: 16,
              minWidth: 180,
              elevation: 8,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.18,
              shadowRadius: 12,
            }}
          >
            {items.map((item, index) => {
              const r = rows[index];
              const rowTranslateX = r.interpolate({
                inputRange: [0, 1],
                outputRange: [24, 0],
              });
              const rowOpacity = r.interpolate({
                inputRange: [0, 0.4, 1],
                outputRange: [0, 0.6, 1],
              });

              const Icon = item.icon;
              return (
                <Animated.View
                  key={item.key}
                  style={{
                    opacity: rowOpacity,
                    transform: [{ translateX: rowTranslateX }],
                  }}
                >
                  <Pressable
                    onPress={() => handleSelect(item.onPress)}
                    className="flex-row items-center active:bg-muted/50"
                    style={{
                      paddingHorizontal: 14,
                      paddingVertical: 12,
                      gap: 12,
                      borderTopWidth: index > 0 ? StyleSheet.hairlineWidth : 0,
                      borderTopColor: dark
                        ? 'rgba(255,255,255,0.08)'
                        : 'rgba(0,0,0,0.06)',
                    }}
                  >
                    <View
                      className="items-center justify-center rounded-lg"
                      style={{
                        width: 30,
                        height: 30,
                        backgroundColor: dark
                          ? 'rgba(76,175,80,0.15)'
                          : 'rgba(30,70,30,0.08)',
                      }}
                    >
                      <Icon size={15} color={primaryColor} />
                    </View>
                    <Text className="text-[13px] font-semibold text-foreground">
                      {item.label}
                    </Text>
                  </Pressable>
                </Animated.View>
              );
            })}
          </View>
        </Animated.View>
      )}

      <Pressable
        onPress={toggle}
        className="absolute h-14 w-14 rounded-full bg-primary items-center justify-center"
        style={{
          right: 20,
          bottom: bottomInset + 16,
          elevation: 6,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 3 },
          shadowOpacity: 0.25,
          shadowRadius: 5,
        }}
      >
        <Animated.View style={{ transform: [{ rotate: fabRotation }] }}>
          <Plus size={24} color="#fff" />
        </Animated.View>
      </Pressable>
    </>
  );
}
