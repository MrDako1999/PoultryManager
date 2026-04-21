import { useState } from 'react';
import { View, Text, StyleSheet, Linking, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { CreditCard, Lock, RotateCw, LogOut } from 'lucide-react-native';
import { Button } from '@/components/ui/Button';
import api from '@/lib/api';
import useAuthStore from '@/stores/authStore';
import useThemeStore from '@/stores/themeStore';
import { retrySubscription } from '@/lib/syncEngine';

const REASON_LABELS = {
  paymentFailed: 'Payment failed',
  canceled: 'Subscription canceled',
  incomplete: 'Subscription incomplete',
  paused: 'Subscription paused',
  unknown: 'Subscription inactive',
  noState: 'Subscription inactive',
};

/**
 * Full-screen, non-dismissable billing lock. Two variants per
 * SUBSCRIPTION.md §"UX":
 *
 *   - Owner sees credit-card icon, "Subscription needs attention",
 *     reason text, plus three actions: Fix Billing (opens portal),
 *     Retry, Sign Out.
 *
 *   - Sub-user sees a generic lock icon, "No active subscription"
 *     copy, plus Retry and Sign Out only. Deliberately no owner name
 *     or contact info — the relationship between the sub-user and
 *     their employer lives outside the app.
 *
 * A 30s /auth/me heartbeat already runs in the syncEngine while the
 * gate is 'block', so the screen unlocks itself in the background.
 * The Retry button is just a faster path to the same check.
 */
export default function BillingLockScreen({ isOwner, reason }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { resolvedTheme } = useThemeStore();
  const dark = resolvedTheme === 'dark';
  const { logout } = useAuthStore();

  const [retrying, setRetrying] = useState(false);
  const [openingPortal, setOpeningPortal] = useState(false);

  const bg = dark ? 'hsl(150, 22%, 11%)' : 'hsl(140, 20%, 97%)';
  const cardBg = dark ? 'hsl(150, 18%, 14%)' : '#ffffff';
  const textColor = dark ? '#f0f5f0' : '#0f1f10';
  const mutedColor = dark ? 'hsl(148, 12%, 65%)' : 'hsl(150, 10%, 45%)';
  const accentColor = dark ? 'hsl(148, 55%, 55%)' : 'hsl(148, 60%, 28%)';
  const errorColor = dark ? '#fca5a5' : '#dc2626';
  const borderColor = dark ? 'hsl(150, 14%, 22%)' : 'hsl(148, 14%, 90%)';

  const Icon = isOwner ? CreditCard : Lock;
  const reasonLabel = REASON_LABELS[reason] || REASON_LABELS.unknown;

  const handleRetry = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setRetrying(true);
    try {
      const sub = await retrySubscription();
      if (sub?.policy !== 'allow') {
        // Still blocked — give a tiny haptic so the user knows we tried.
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      }
    } finally {
      setRetrying(false);
    }
  };

  const handleFixBilling = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setOpeningPortal(true);
    try {
      const { data } = await api.get('/billing/portal-url');
      if (data?.url) {
        await Linking.openURL(data.url);
      } else {
        Alert.alert(
          t('billing.portalUnavailableTitle', 'Billing not yet available'),
          t(
            'billing.portalUnavailableDesc',
            'The billing portal will be enabled once Stripe is connected. Please contact support.'
          )
        );
      }
    } catch (err) {
      // Backend currently returns 501 from the placeholder route. Show
      // a friendly message until Stripe lands.
      Alert.alert(
        t('billing.portalUnavailableTitle', 'Billing not yet available'),
        t(
          'billing.portalUnavailableDesc',
          'The billing portal will be enabled once Stripe is connected. Please contact support.'
        )
      );
    } finally {
      setOpeningPortal(false);
    }
  };

  const handleSignOut = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    await logout();
    router.replace('/(auth)/login');
  };

  return (
    <View style={[styles.root, { backgroundColor: bg, paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.container}>
        <View
          style={[
            styles.card,
            {
              backgroundColor: cardBg,
              borderColor,
            },
          ]}
        >
          <View
            style={[
              styles.iconTile,
              {
                backgroundColor: isOwner
                  ? (dark ? 'rgba(252,165,165,0.12)' : 'rgba(220,38,38,0.08)')
                  : (dark ? 'rgba(148,210,165,0.12)' : 'hsl(148, 30%, 95%)'),
              },
            ]}
          >
            <Icon
              size={32}
              color={isOwner ? errorColor : accentColor}
              strokeWidth={2}
            />
          </View>

          <Text style={[styles.title, { color: textColor }]}>
            {isOwner
              ? t('billing.ownerTitle', 'Your subscription needs attention')
              : t('billing.subUserTitle', 'No active subscription')}
          </Text>

          {isOwner ? (
            <Text style={[styles.statusLine, { color: errorColor }]}>
              {t(`billing.reason.${reason || 'unknown'}`, reasonLabel)}
            </Text>
          ) : null}

          <Text style={[styles.body, { color: mutedColor }]}>
            {isOwner
              ? t(
                  'billing.ownerBody',
                  'Your most recent payment didn\'t go through. To keep your team working, please update your payment method.'
                )
              : t(
                  'billing.subUserBody',
                  'This workspace doesn\'t have an active subscription right now, so the app is unavailable. Your work is saved and will resume the moment access is restored.'
                )}
          </Text>

          <View style={{ gap: 10, width: '100%' }}>
            {isOwner ? (
              <Button
                onPress={handleFixBilling}
                loading={openingPortal}
                disabled={openingPortal}
              >
                <CreditCard size={16} color="#ffffff" />
                <Text style={{ fontFamily: 'Poppins-SemiBold', color: '#ffffff', marginLeft: 6 }}>
                  {t('billing.fixBilling', 'Fix Billing')}
                </Text>
              </Button>
            ) : null}

            <Button
              onPress={handleRetry}
              loading={retrying}
              disabled={retrying}
              variant="outline"
            >
              <RotateCw size={16} color={textColor} />
              <Text style={{ fontFamily: 'Poppins-SemiBold', color: textColor, marginLeft: 6 }}>
                {t('billing.retry', 'Retry')}
              </Text>
            </Button>

            <Button onPress={handleSignOut} variant="ghost">
              <LogOut size={16} color={mutedColor} />
              <Text style={{ fontFamily: 'Poppins-SemiBold', color: mutedColor, marginLeft: 6 }}>
                {t('auth.logout', 'Sign Out')}
              </Text>
            </Button>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  container: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 22,
    borderWidth: 1,
    padding: 28,
    alignItems: 'center',
    gap: 14,
  },
  iconTile: {
    width: 72,
    height: 72,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  title: {
    fontSize: 22,
    fontFamily: 'Poppins-Bold',
    letterSpacing: -0.4,
    textAlign: 'center',
  },
  statusLine: {
    fontSize: 13,
    fontFamily: 'Poppins-SemiBold',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  body: {
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 12,
  },
});
