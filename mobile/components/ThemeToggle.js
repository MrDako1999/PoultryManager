import { Pressable } from 'react-native';
import { Sun, Moon } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import useThemeStore from '../stores/themeStore';

export default function ThemeToggle() {
  const { resolvedTheme, setTheme } = useThemeStore();

  const toggle = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
  };

  const Icon = resolvedTheme === 'dark' ? Sun : Moon;
  const iconColor = resolvedTheme === 'dark' ? '#e0e8e0' : '#1a2e1a';

  return (
    <Pressable
      onPress={toggle}
      className="h-10 w-10 items-center justify-center rounded-md active:bg-accent"
      hitSlop={8}
    >
      <Icon size={20} color={iconColor} />
    </Pressable>
  );
}
