import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import useAuthStore from '../stores/authStore';
import useThemeStore from '../stores/themeStore';

export default function Index() {
  const { user, isLoading, checkAuth } = useAuthStore();
  const { resolvedTheme } = useThemeStore();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (isLoading) return;
    if (user) {
      router.replace('/(app)/(tabs)/dashboard');
    } else {
      router.replace('/(auth)/login');
    }
  }, [user, isLoading]);

  const spinnerColor = resolvedTheme === 'dark' ? 'hsl(148, 48%, 38%)' : 'hsl(148, 60%, 20%)';

  return (
    <View className="flex-1 items-center justify-center bg-background">
      <ActivityIndicator size="large" color={spinnerColor} />
    </View>
  );
}
