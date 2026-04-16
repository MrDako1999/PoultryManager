import { View, ActivityIndicator } from 'react-native';
import { Redirect, Stack } from 'expo-router';
import useAuthStore from '@/stores/authStore';
import useThemeStore from '@/stores/themeStore';
import SyncStatusBar from '@/components/SyncStatusBar';
import FullResyncOverlay from '@/components/FullResyncOverlay';

export default function AppLayout() {
  const { user, isLoading } = useAuthStore();
  const { resolvedTheme } = useThemeStore();
  const spinnerColor = resolvedTheme === 'dark' ? 'hsl(148, 48%, 38%)' : 'hsl(148, 60%, 20%)';

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" color={spinnerColor} />
      </View>
    );
  }

  if (!user) {
    return <Redirect href="/(auth)/login" />;
  }

  if (user.mustChangePassword) {
    return <Redirect href="/(auth)/first-login" />;
  }

  return (
    <View style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right', gestureEnabled: true, fullScreenGestureEnabled: true }}>
        <Stack.Screen name="(tabs)" options={{ animation: 'none', gestureEnabled: false }} />
        <Stack.Screen name="batch/[id]/index" />
        <Stack.Screen name="batch/[id]/sources" />
        <Stack.Screen name="batch/[id]/feed-orders" />
        <Stack.Screen name="batch/[id]/expenses" />
        <Stack.Screen name="batch/[id]/sales" />
        <Stack.Screen name="batch/[id]/daily-logs" />
        <Stack.Screen name="expense/[id]" />
        <Stack.Screen name="source/[id]" />
        <Stack.Screen name="feed-order/[id]" />
        <Stack.Screen name="sale/[id]" />
        <Stack.Screen name="daily-log/[id]" />
        <Stack.Screen name="farm/[id]" />
        <Stack.Screen name="business/[id]" />
        <Stack.Screen name="contact/[id]" />
        <Stack.Screen name="worker/[id]" />
        <Stack.Screen name="farms-list" />
        <Stack.Screen name="businesses-list" />
        <Stack.Screen name="contacts-list" />
        <Stack.Screen name="workers-list" />
        <Stack.Screen name="feed-catalogue" />
        <Stack.Screen name="settings-profile" />
        <Stack.Screen name="settings-modules" />
        <Stack.Screen name="settings-accounting" />
        <Stack.Screen name="settings-sale-defaults" />
      </Stack>
      <SyncStatusBar />
      <FullResyncOverlay />
    </View>
  );
}
