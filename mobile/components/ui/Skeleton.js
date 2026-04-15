import { useEffect, useRef } from 'react';
import { View, Animated } from 'react-native';

function usePulse() {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return opacity;
}

export default function Skeleton({ width, height = 14, borderRadius = 6, style, className }) {
  const opacity = usePulse();

  return (
    <Animated.View
      className={`bg-muted ${className || ''}`}
      style={[{ width, height, borderRadius, opacity }, style]}
    />
  );
}

export function SkeletonText({ width = '60%', height = 12, style }) {
  const opacity = usePulse();
  return (
    <Animated.View
      className="bg-muted"
      style={[{ width, height, borderRadius: 4, opacity }, style]}
    />
  );
}

export function SkeletonCircle({ size = 32, style }) {
  const opacity = usePulse();
  return (
    <Animated.View
      className="bg-muted"
      style={[{ width: size, height: size, borderRadius: size / 2, opacity }, style]}
    />
  );
}
