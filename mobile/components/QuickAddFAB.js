import { useState, useRef, useCallback } from 'react';
import { View, Text, Pressable, Animated, StyleSheet } from 'react-native';
import { Plus } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import useThemeStore from '../stores/themeStore';

const FAB_SIZE = 56;
const MENU_GAP = 10;

export default function QuickAddFAB({ items, bottomInset = 0 }) {
  const { resolvedTheme } = useThemeStore();
  const dark = resolvedTheme === 'dark';
  const primaryColor = dark ? 'hsl(148, 48%, 38%)' : 'hsl(148, 60%, 20%)';

  const [open, setOpen] = useState(false);
  const anim = useRef(new Animated.Value(0)).current;

  const show = useCallback(() => {
    setOpen(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    anim.setValue(0);
    Animated.spring(anim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 160,
      friction: 12,
    }).start();
  }, [anim]);

  const hide = useCallback(() => {
    Animated.timing(anim, {
      toValue: 0,
      duration: 140,
      useNativeDriver: true,
    }).start(() => setOpen(false));
  }, [anim]);

  const toggle = useCallback(() => {
    if (open) hide();
    else show();
  }, [open, show, hide]);

  const handleSelect = useCallback((onPress) => {
    hide();
    setTimeout(onPress, 100);
  }, [hide]);

  const fabRotation = anim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '45deg'],
  });

  // Vertical stretch leads — shoots up tall first (teardrop stem)
  const scaleY = anim.interpolate({
    inputRange: [0, 0.55, 1],
    outputRange: [0, 1, 1],
  });

  // Horizontal follows — stays narrow, then widens into the card
  const scaleX = anim.interpolate({
    inputRange: [0, 0.35, 0.85, 1],
    outputRange: [0.25, 0.25, 0.92, 1],
  });

  // Sweeps upward from FAB
  const translateY = anim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [24, 4, 0],
  });

  // Card container fades in fast
  const cardOpacity = anim.interpolate({
    inputRange: [0, 0.15],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  // Content waits for the card shape to mostly form before showing
  const contentOpacity = anim.interpolate({
    inputRange: [0, 0.5, 0.8],
    outputRange: [0, 0, 1],
    extrapolate: 'clamp',
  });

  return (
    <>
      {open && (
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: 'rgba(0,0,0,0.3)', opacity: anim },
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
            opacity: cardOpacity,
            transform: [{ scaleX }, { scaleY }, { translateY }],
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
            <Animated.View style={{ opacity: contentOpacity }}>
              {items.map((item, index) => {
                const Icon = item.icon;
                return (
                  <Pressable
                    key={item.key}
                    onPress={() => handleSelect(item.onPress)}
                    className="flex-row items-center active:bg-muted/50"
                    style={{
                      paddingHorizontal: 14,
                      paddingVertical: 12,
                      gap: 12,
                      borderTopWidth: index > 0 ? StyleSheet.hairlineWidth : 0,
                      borderTopColor: dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                    }}
                  >
                    <View
                      className="items-center justify-center rounded-lg"
                      style={{
                        width: 30,
                        height: 30,
                        backgroundColor: dark ? 'rgba(76,175,80,0.15)' : 'rgba(30,70,30,0.08)',
                      }}
                    >
                      <Icon size={15} color={primaryColor} />
                    </View>
                    <Text className="text-[13px] font-semibold text-foreground">{item.label}</Text>
                  </Pressable>
                );
              })}
            </Animated.View>
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
