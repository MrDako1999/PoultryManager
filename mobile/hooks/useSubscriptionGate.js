import { useEffect, useState } from 'react';
import useAuthStore from '@/stores/authStore';
import { dbEvents } from '@/lib/db';
import { getCachedSubscription } from '@/lib/syncEngine';

/**
 * Single source of truth for the subscription gate on mobile.
 *
 * Returns { policy, reason, isOwner, status, currentPeriodEnd }.
 * Policy is 'allow' or 'block' — there's no read-only mode.
 *
 * Source priority:
 *   1. /auth/me payload from the auth store (freshest, hydrated by
 *      checkAuth and refreshAuthAndSubscription)
 *   2. Local SQLite cache (sync_meta '__subscription__') if the auth
 *      store hasn't loaded yet
 *   3. Default to 'allow' on first launch (pre-cache); the first
 *      sync round will hydrate and the gate will flip if needed
 *
 * No staleness lockout: a device offline for weeks keeps working until
 * reconnect. SUBSCRIPTION.md §"Goals" #4.
 */
export default function useSubscriptionGate() {
  const user = useAuthStore((s) => s.user);
  const subFromAuth = user?.workspace?.subscription || null;
  const [cachedSub, setCachedSub] = useState(null);

  useEffect(() => {
    let cancelled = false;
    if (subFromAuth) return;
    getCachedSubscription().then((s) => {
      if (!cancelled) setCachedSub(s);
    });
    const onChange = () => {
      getCachedSubscription().then((s) => {
        if (!cancelled) setCachedSub(s);
      });
    };
    dbEvents.on('change', onChange);
    return () => {
      cancelled = true;
      dbEvents.off('change', onChange);
    };
  }, [subFromAuth]);

  const sub = subFromAuth || cachedSub;
  const isOwner = !!user && !user.createdBy;

  if (!sub) {
    // No state at all (fresh install pre-first-sync). Default to allow
    // so the first /auth/me can hydrate; the gate will flip on the
    // very next sync if the workspace turns out to be blocked.
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
