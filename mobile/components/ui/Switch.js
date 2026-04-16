import { Switch as RNSwitch } from 'react-native';
import useThemeStore from '@/stores/themeStore';

export default function Switch({ value, onValueChange, disabled }) {
  const { resolvedTheme } = useThemeStore();
  const trackActive = resolvedTheme === 'dark' ? 'hsl(148, 48%, 38%)' : 'hsl(148, 60%, 20%)';
  const trackInactive = resolvedTheme === 'dark' ? 'hsl(150, 14%, 20%)' : 'hsl(148, 14%, 87%)';

  return (
    <RNSwitch
      value={value}
      onValueChange={onValueChange}
      disabled={disabled}
      trackColor={{ false: trackInactive, true: trackActive }}
      thumbColor="#ffffff"
    />
  );
}
