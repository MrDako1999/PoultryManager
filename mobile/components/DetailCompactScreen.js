import {
  View, Text, Pressable, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useHeroSheetTokens } from '@/components/HeroSheetScreen';
import { useIsRTL } from '@/stores/localeStore';
import { rowDirection, textAlignStart } from '@/lib/rtl';

const COMPACT_BAR_MIN_HEIGHT = 36;

/**
 * Slim brand-gradient toolbar + full-page scroll (no HeroSheetScreen sheet shell,
 * no large hero). Matches the scroll-pinned compact bar from HeroSheetScreen.
 */
export default function DetailCompactScreen({
  title,
  headerRight,
  children,
  onBack,
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const tokens = useHeroSheetTokens();
  const isRTL = useIsRTL();
  const { heroGradient, screenBg, dark } = tokens;
  const BackIcon = isRTL ? ChevronRight : ChevronLeft;

  const handleBack = () => {
    Haptics.selectionAsync().catch(() => {});
    if (onBack) onBack();
    else router.back();
  };

  return (
    <View style={{ flex: 1, backgroundColor: screenBg }}>
      <LinearGradient
        colors={heroGradient}
        start={isRTL ? { x: 1, y: 0 } : { x: 0, y: 0 }}
        end={isRTL ? { x: 0, y: 1 } : { x: 1, y: 1 }}
        style={{
          paddingTop: insets.top + 8,
          paddingBottom: 8,
          paddingHorizontal: 20,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: dark ? 0.4 : 0.12,
          shadowRadius: 6,
          elevation: 6,
        }}
      >
        <View
          style={{
            flexDirection: rowDirection(isRTL),
            alignItems: 'center',
            gap: 12,
            minHeight: COMPACT_BAR_MIN_HEIGHT,
          }}
        >
          <Pressable
            onPress={handleBack}
            hitSlop={10}
            style={{
              height: 36,
              width: 36,
              borderRadius: 18,
              backgroundColor: 'rgba(255,255,255,0.18)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            accessibilityRole="button"
            accessibilityLabel={t('common.back', 'Back')}
          >
            <BackIcon size={20} color="#ffffff" strokeWidth={2.4} />
          </Pressable>
          <Text
            style={{
              flex: 1,
              fontSize: 16,
              fontFamily: 'Poppins-SemiBold',
              color: '#ffffff',
              letterSpacing: -0.2,
              textAlign: textAlignStart(isRTL),
              writingDirection: isRTL ? 'rtl' : 'ltr',
            }}
            numberOfLines={1}
          >
            {title}
          </Text>
          {headerRight ? <View>{headerRight}</View> : null}
        </View>
      </LinearGradient>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingTop: 16,
          paddingBottom: insets.bottom + 24,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    </View>
  );
}
