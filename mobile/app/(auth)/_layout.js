import { View, Text, Image, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Slot } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import useThemeStore from '@/stores/themeStore';
import ThemeToggle from '@/components/ThemeToggle';

export default function AuthLayout() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { resolvedTheme } = useThemeStore();

  const logo = resolvedTheme === 'dark'
    ? require('@/assets/images/logo-white.png')
    : require('@/assets/images/logo.png');

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <View className="absolute top-0 right-4 z-10" style={{ top: insets.top + 8 }}>
        <ThemeToggle />
      </View>

      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 16 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View className="w-full max-w-md self-center gap-8">
            <View className="items-center gap-2">
              <Image
                source={logo}
                className="h-14 w-14 rounded-xl"
                resizeMode="contain"
              />
              <Text className="text-2xl font-bold text-foreground tracking-tight">
                {t('app.name')}
              </Text>
              <Text className="text-sm text-muted-foreground">
                {t('app.tagline')}
              </Text>
            </View>

            <Slot />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <View className="py-4 items-center" style={{ paddingBottom: insets.bottom + 8 }}>
        <Text className="text-xs text-muted-foreground">
          &copy; {new Date().getFullYear()} Estera Tech LLC
        </Text>
      </View>
    </View>
  );
}
