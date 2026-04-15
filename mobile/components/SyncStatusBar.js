import { useEffect, useRef } from 'react';
import { Pressable, Text, View, Animated, Easing } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WifiOff, RefreshCw, AlertCircle, Loader2 } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import useSyncStore from '../stores/syncStore';
import useThemeStore from '../stores/themeStore';
import { deltaSync, processQueue } from '../lib/syncEngine';

export default function SyncStatusBar() {
  const { isOnline, isSyncing, pendingCount, failedCount } = useSyncStore();
  const { resolvedTheme } = useThemeStore();
  const insets = useSafeAreaInsets();

  const dark = resolvedTheme === 'dark';
  const translateY = useRef(new Animated.Value(-60)).current;
  const pulseOpacity = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(null);

  const isOffline = !isOnline;
  const hasContent = isOffline || failedCount > 0;

  useEffect(() => {
    Animated.timing(translateY, {
      toValue: hasContent ? 0 : -60,
      duration: 300,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [hasContent]);

  useEffect(() => {
    if (pulseAnim.current) {
      pulseAnim.current.stop();
      pulseAnim.current = null;
    }

    if (isOffline) {
      pulseAnim.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseOpacity, { toValue: 0.6, duration: 1200, useNativeDriver: true }),
          Animated.timing(pulseOpacity, { toValue: 1, duration: 1200, useNativeDriver: true }),
        ]),
      );
      pulseAnim.current.start();
    } else {
      Animated.timing(pulseOpacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    }

    return () => {
      if (pulseAnim.current) pulseAnim.current.stop();
    };
  }, [isOffline]);

  if (!hasContent) return null;

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (isOnline && !isSyncing) {
      deltaSync().catch(() => {});
      processQueue().catch(() => {});
    }
  };

  let bgColor, iconColor, label, Icon;

  if (isOffline) {
    bgColor = dark ? 'rgba(239, 68, 68, 0.15)' : 'rgba(239, 68, 68, 0.1)';
    iconColor = dark ? '#f87171' : '#dc2626';
    Icon = WifiOff;
    label = pendingCount > 0
      ? `Offline \u00B7 ${pendingCount} change${pendingCount !== 1 ? 's' : ''} queued`
      : 'You\'re offline';
  } else {
    bgColor = dark ? 'rgba(239, 68, 68, 0.12)' : 'rgba(239, 68, 68, 0.08)';
    iconColor = dark ? '#f87171' : '#dc2626';
    Icon = AlertCircle;
    label = `${failedCount} failed sync${failedCount !== 1 ? 's' : ''} \u00B7 Tap to retry`;
  }

  return (
    <Animated.View
      style={{
        position: 'absolute',
        top: insets.top,
        left: 0,
        right: 0,
        zIndex: 100,
        transform: [{ translateY }],
      }}
      pointerEvents="box-none"
    >
      <Pressable onPress={handlePress}>
        <Animated.View
          style={{
            backgroundColor: bgColor,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            paddingVertical: 8,
            paddingHorizontal: 16,
            marginHorizontal: 12,
            marginTop: 4,
            borderRadius: 10,
            gap: 8,
            opacity: isOffline ? pulseOpacity : 1,
          }}
        >
          <Icon size={14} color={iconColor} />
          <Text
            style={{
              fontSize: 13,
              fontFamily: 'Poppins-Medium',
              color: iconColor,
            }}
          >
            {label}
          </Text>
          {(failedCount > 0 || (isOffline && pendingCount > 0)) && (
            <View
              style={{
                backgroundColor: iconColor,
                borderRadius: 10,
                minWidth: 20,
                height: 20,
                alignItems: 'center',
                justifyContent: 'center',
                paddingHorizontal: 6,
                marginLeft: 2,
              }}
            >
              <Text
                style={{
                  fontSize: 11,
                  fontFamily: 'Poppins-Bold',
                  color: '#fff',
                }}
              >
                {failedCount > 0 ? failedCount : pendingCount}
              </Text>
            </View>
          )}
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}
