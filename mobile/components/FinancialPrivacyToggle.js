import { useRef, useEffect } from 'react';
import { Pressable, Animated, Easing } from 'react-native';
import { Eye, EyeOff } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import useFinancialPrivacyStore from '@/stores/financialPrivacyStore';

/**
 * Eye / eye-off icon toggle for the dashboard hero toolbar.
 *
 * Shape & palette match `SyncIconButton` (36pt translucent-white circle
 * sitting on the green hero gradient, white glyph) so the row reads as
 * a single cohesive cluster of header actions.
 *
 * Behaviour: tap toggles `useFinancialPrivacyStore.hidden`. The icon
 * cross-fades + scale-springs between Eye and EyeOff so the state
 * change is unmistakable without a label. A light haptic fires on tap.
 */
export default function FinancialPrivacyToggle() {
  const { t } = useTranslation();
  const hidden = useFinancialPrivacyStore((s) => s.hidden);
  const toggleHidden = useFinancialPrivacyStore((s) => s.toggleHidden);

  // Drive a single 0..1 progress value from the boolean. Both icons are
  // rendered stacked; we cross-fade their opacities and run a tiny
  // scale spring on the incoming icon so the swap feels tactile.
  const progress = useRef(new Animated.Value(hidden ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: hidden ? 1 : 0,
      duration: 180,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [hidden, progress]);

  const eyeOpacity = progress.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });
  const eyeOffOpacity = progress.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });
  const eyeScale = progress.interpolate({ inputRange: [0, 1], outputRange: [1, 0.85] });
  const eyeOffScale = progress.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] });

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    toggleHidden();
  };

  return (
    <Pressable
      onPress={handlePress}
      hitSlop={8}
      accessibilityRole="switch"
      accessibilityState={{ checked: hidden }}
      accessibilityLabel={
        hidden
          ? t('dashboard.showFinancials', 'Show financial data')
          : t('dashboard.hideFinancials', 'Hide financial data')
      }
      style={{
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255,255,255,0.18)',
      }}
    >
      <Animated.View
        style={{
          position: 'absolute',
          opacity: eyeOpacity,
          transform: [{ scale: eyeScale }],
        }}
      >
        <Eye size={18} color="#ffffff" strokeWidth={2.2} />
      </Animated.View>
      <Animated.View
        style={{
          position: 'absolute',
          opacity: eyeOffOpacity,
          transform: [{ scale: eyeOffScale }],
        }}
      >
        <EyeOff size={18} color="#ffffff" strokeWidth={2.2} />
      </Animated.View>
    </Pressable>
  );
}
