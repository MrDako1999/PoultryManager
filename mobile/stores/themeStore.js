import { create } from 'zustand';
import { Appearance } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const THEME_KEY = 'pm-theme';

function getSystemTheme() {
  return Appearance.getColorScheme() === 'dark' ? 'dark' : 'light';
}

function resolve(theme) {
  return theme === 'system' ? getSystemTheme() : theme;
}

const useThemeStore = create((set) => ({
  theme: 'system',
  resolvedTheme: getSystemTheme(),

  setTheme: async (theme) => {
    await SecureStore.setItemAsync(THEME_KEY, theme);
    const resolvedTheme = resolve(theme);
    set({ theme, resolvedTheme });
  },

  initTheme: async () => {
    const t = (await SecureStore.getItemAsync(THEME_KEY)) || 'system';
    const resolvedTheme = resolve(t);
    set({ theme: t, resolvedTheme });
  },
}));

export default useThemeStore;
