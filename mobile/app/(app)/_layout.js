import { View, ActivityIndicator } from 'react-native';
import { Redirect, Stack } from 'expo-router';
import useAuthStore from '@/stores/authStore';
import useThemeStore from '@/stores/themeStore';
import useSubscriptionGate from '@/hooks/useSubscriptionGate';
import BillingLockScreen from '@/components/BillingLockScreen';
import { useIsRTL } from '@/stores/localeStore';

export default function AppLayout() {
  const { user, isLoading } = useAuthStore();
  const { resolvedTheme } = useThemeStore();
  const spinnerColor = resolvedTheme === 'dark' ? 'hsl(148, 48%, 38%)' : 'hsl(148, 60%, 20%)';
  const gate = useSubscriptionGate();
  const isRTL = useIsRTL();

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

  if (gate.policy === 'block') {
    return <BillingLockScreen isOwner={gate.isOwner} reason={gate.reason} />;
  }

  return (
    <View style={{ flex: 1 }}>
      <Stack
        screenOptions={{
          headerShown: false,
          // In RTL the new screen should slide in from the LEFT (the
          // direction the user "moves forward" when reading right-to-left).
          //
          // For the back-swipe gesture: react-native-screens only accepts
          // 'horizontal' | 'vertical' on iOS — `'horizontal-inverted'`
          // crashes the native layer at app launch ("PoultryManager quit
          // unexpectedly" because the iOS bridge can't decode the unknown
          // enum value). The native side already mirrors the gesture
          // edge automatically when `I18nManager.isRTL === true`, so a
          // plain 'horizontal' is the correct value in both directions.
          //
          // `fullScreenGestureEnabled` lets the user start the swipe
          // from anywhere in the screen rather than only the leading
          // edge — important because the 20pt edge target is too narrow
          // to feel reliable, especially for RTL users reaching from the
          // opposite side.
          animation: isRTL ? 'slide_from_left' : 'slide_from_right',
          gestureDirection: 'horizontal',
          gestureEnabled: true,
          fullScreenGestureEnabled: true,
        }}
      >
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
        <Stack.Screen name="feed-item/[id]" />
        <Stack.Screen name="sale/[id]" />
        {/* The daily-log detail screen owns its own horizontal swipe
            (prev/next entry navigator). The native full-screen back
            gesture would compete with that — a casual horizontal drag
            in the middle of the screen would race between "go back to
            the list" and "next entry" and frequently win the wrong
            one. Disable the full-screen variant here; the edge-swipe
            (~20pt from the leading edge) stays alive so users can
            still gesture back when they actually mean to. */}
        <Stack.Screen
          name="daily-log/[id]"
          options={{ fullScreenGestureEnabled: false }}
        />
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
        <Stack.Screen name="settings-security" />
        <Stack.Screen name="settings-team" />
        <Stack.Screen name="settings-modules" />
        <Stack.Screen name="settings-accounting" />
        <Stack.Screen name="settings-sale-defaults" />
      </Stack>
    </View>
  );
}
