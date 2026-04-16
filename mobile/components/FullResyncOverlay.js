import { useEffect, useRef } from 'react';
import { View, Text, Modal, Animated } from 'react-native';
import { DatabaseZap } from 'lucide-react-native';
import useSyncStore from '@/stores/syncStore';
import useThemeStore from '@/stores/themeStore';

export default function FullResyncOverlay() {
  const { isFullResyncing, syncProgress } = useSyncStore();
  const { resolvedTheme } = useThemeStore();

  const dark = resolvedTheme === 'dark';
  const primaryColor = dark ? 'hsl(148, 48%, 38%)' : 'hsl(148, 60%, 20%)';
  const mutedColor = dark ? 'hsl(148, 10%, 55%)' : 'hsl(150, 10%, 45%)';

  const pct = syncProgress
    ? Math.round((syncProgress.current / syncProgress.total) * 100)
    : 0;

  const animatedWidth = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(animatedWidth, {
      toValue: pct,
      duration: 400,
      useNativeDriver: false,
    }).start();
  }, [pct]);

  if (!isFullResyncing) return null;

  const widthInterpolation = animatedWidth.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });

  return (
    <Modal
      visible={isFullResyncing}
      transparent
      animationType="fade"
      statusBarTranslucent
    >
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: dark ? 'rgba(0,0,0,0.85)' : 'rgba(255,255,255,0.88)',
          paddingHorizontal: 32,
        }}
      >
        <View
          style={{
            width: '100%',
            maxWidth: 320,
            borderRadius: 16,
            padding: 24,
            backgroundColor: dark ? 'hsl(150, 20%, 8%)' : '#fff',
            borderWidth: 1,
            borderColor: dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.15,
            shadowRadius: 24,
            elevation: 12,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <DatabaseZap size={20} color={primaryColor} />
            <Text
              style={{
                fontSize: 16,
                fontFamily: 'Poppins-SemiBold',
                color: dark ? '#e8ede8' : '#1a2e1a',
              }}
            >
              Full Resync
            </Text>
          </View>

          {/* Progress bar */}
          <View
            style={{
              height: 6,
              borderRadius: 3,
              backgroundColor: dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
              overflow: 'hidden',
              marginBottom: 12,
            }}
          >
            <Animated.View
              style={{
                height: '100%',
                borderRadius: 3,
                backgroundColor: primaryColor,
                width: widthInterpolation,
              }}
            />
          </View>

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text
              style={{
                fontSize: 13,
                fontFamily: 'Poppins-Regular',
                color: mutedColor,
              }}
            >
              {syncProgress
                ? `Fetching ${syncProgress.label}\u2026`
                : 'Preparing\u2026'}
            </Text>
            <Text
              style={{
                fontSize: 13,
                fontFamily: 'Poppins-Medium',
                color: dark ? '#e8ede8' : '#1a2e1a',
              }}
            >
              {pct}%
            </Text>
          </View>

          {syncProgress && (
            <Text
              style={{
                fontSize: 12,
                fontFamily: 'Poppins-Regular',
                color: mutedColor,
                textAlign: 'center',
                marginTop: 8,
              }}
            >
              Step {syncProgress.current} of {syncProgress.total}
            </Text>
          )}
        </View>
      </View>
    </Modal>
  );
}
