import '../global.css';
import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'nativewind';
import { ToastProvider } from '@/components/ui/Toast';
import useThemeStore from '@/stores/themeStore';
import useLocaleStore from '@/stores/localeStore';
import useFeedDisplayStore from '@/stores/feedDisplayStore';
import useFinancialPrivacyStore from '@/stores/financialPrivacyStore';
import useNetwork from '@/hooks/useNetwork';
import FullResyncOverlay from '@/components/FullResyncOverlay';
import LanguageChangeOverlay from '@/components/LanguageChangeOverlay';
import '../i18n';

SplashScreen.preventAutoHideAsync();
// Smooth crossfade (instead of a hard pop) when the splash hides. This
// is a JS-side API in expo-splash-screen v31+ — no EAS / plugin config
// needed. The duration applies on the next `hideAsync()` call.
SplashScreen.setOptions({ duration: 400, fade: true });

export default function RootLayout() {
  const { resolvedTheme } = useThemeStore();
  const { setColorScheme } = useColorScheme();

  const [fontsLoaded] = useFonts({
    'Poppins-Light': require('@/assets/fonts/Poppins-Light.ttf'),
    'Poppins-Regular': require('@/assets/fonts/Poppins-Regular.ttf'),
    'Poppins-Medium': require('@/assets/fonts/Poppins-Medium.ttf'),
    'Poppins-SemiBold': require('@/assets/fonts/Poppins-SemiBold.ttf'),
    'Poppins-Bold': require('@/assets/fonts/Poppins-Bold.ttf'),
    Poppins: require('@/assets/fonts/Poppins-Regular.ttf'),
  });

  const { initTheme } = useThemeStore();
  const initLocale = useLocaleStore((s) => s.initLocale);
  const initFeedDisplay = useFeedDisplayStore((s) => s.initFeedDisplay);
  const initFinancialPrivacy = useFinancialPrivacyStore((s) => s.initFinancialPrivacy);

  useNetwork();

  useEffect(() => {
    initTheme();
    initLocale();
    initFeedDisplay();
    initFinancialPrivacy();
  }, []);

  useEffect(() => {
    setColorScheme(resolvedTheme);
  }, [resolvedTheme, setColorScheme]);

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ToastProvider>
          <StatusBar style={resolvedTheme === 'dark' ? 'light' : 'dark'} />
          <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(app)" />
          </Stack>
          <FullResyncOverlay />
          <LanguageChangeOverlay />
        </ToastProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
