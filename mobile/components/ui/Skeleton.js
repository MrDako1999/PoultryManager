import { useEffect, useRef } from 'react';
import { View, Animated } from 'react-native';
import { useHeroSheetTokens } from '@/components/HeroSheetScreen';

function usePulse() {
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 800, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return opacity;
}

function useSkeletonBg() {
  const { dark } = useHeroSheetTokens();
  return dark ? 'rgba(255,255,255,0.08)' : 'hsl(148, 14%, 88%)';
}

/**
 * Skeleton — token-driven loading placeholder. Pulses opacity 0.4↔1.0.
 * `borderRadius` defaults to 8 to match the rounded-pill / rounded-tile feel
 * of the design language.
 */
export default function Skeleton({ width, height = 14, borderRadius = 8, style }) {
  const opacity = usePulse();
  const bg = useSkeletonBg();

  return (
    <Animated.View
      style={[
        { width, height, borderRadius, opacity, backgroundColor: bg },
        style,
      ]}
    />
  );
}

export function SkeletonText({ width = '60%', height = 12, style }) {
  const opacity = usePulse();
  const bg = useSkeletonBg();
  return (
    <Animated.View
      style={[
        { width, height, borderRadius: 4, opacity, backgroundColor: bg },
        style,
      ]}
    />
  );
}

export function SkeletonCircle({ size = 32, style }) {
  const opacity = usePulse();
  const bg = useSkeletonBg();
  return (
    <Animated.View
      style={[
        { width: size, height: size, borderRadius: size / 2, opacity, backgroundColor: bg },
        style,
      ]}
    />
  );
}
