import { View, Pressable } from 'react-native';
import { Sun, Moon } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import useThemeStore from '@/stores/themeStore';
import { useIsRTL } from '@/stores/localeStore';
import LanguageSelector from '@/components/LanguageSelector';
import { rowDirection } from '@/lib/rtl';

/**
 * Hero toolbar for auth screens — language selector pill + theme toggle chip.
 * Designed to sit on the gradient hero of `HeroSheetScreen`.
 */
export default function AuthHeroToolbar() {
  const isRTL = useIsRTL();
  return (
    <View
      style={{
        flexDirection: rowDirection(isRTL),
        alignItems: 'center',
        gap: 8,
      }}
    >
      <LanguageSelector variant="hero" />
      <ThemeToggleHeroChip />
    </View>
  );
}

function ThemeToggleHeroChip() {
  const { resolvedTheme, setTheme } = useThemeStore();
  const Icon = resolvedTheme === 'dark' ? Sun : Moon;
  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync().catch(() => {});
        setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
      }}
      hitSlop={6}
      style={{
        backgroundColor: 'rgba(255,255,255,0.18)',
        borderRadius: 999,
        height: 32,
        width: 32,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Icon size={15} color="#ffffff" strokeWidth={2.2} />
    </Pressable>
  );
}
