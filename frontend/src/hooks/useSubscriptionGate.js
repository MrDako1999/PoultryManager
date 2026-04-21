import useAuthStore from '@/stores/authStore';

/**
 * Single source of truth for the subscription gate on web.
 *
 * Same shape as the mobile hook so the BillingLockScreen logic can be
 * shared in spirit between platforms. Returns
 *   { policy: 'allow' | 'block', reason, isOwner, status, currentPeriodEnd }
 *
 * Trusts the auth store's `user.workspace.subscription` block (hydrated
 * by /auth/me on every mount and on every refreshUser call). No
 * staleness rule — the web app has no offline mode worth gating.
 */
export default function useSubscriptionGate() {
  const user = useAuthStore((s) => s.user);
  const sub = user?.workspace?.subscription || null;
  const isOwner = !!user && !user.createdBy;

  if (!sub) {
    return { policy: 'allow', reason: null, isOwner, status: null, currentPeriodEnd: null };
  }

  return {
    policy: sub.policy || 'allow',
    reason: sub.reason || null,
    isOwner,
    status: sub.status || null,
    currentPeriodEnd: sub.currentPeriodEnd || null,
  };
}
