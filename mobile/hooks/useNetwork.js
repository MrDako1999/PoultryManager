import { useEffect } from 'react';
import NetInfo from '@react-native-community/netinfo';
import useSyncStore from '@/stores/syncStore';
import { deltaSync, processQueue } from '@/lib/syncEngine';

/**
 * Mirror the desktop's `window.addEventListener('online'/'offline')` model:
 * the OS link-layer signal is the only authoritative source of truth for
 * connectivity. We deliberately IGNORE NetInfo's `isInternetReachable`
 * — its reachability probe is unreliable (returns false on iOS simulator,
 * captive portals, and flaky LTE) and was the cause of the "Offline +
 * Last synced just now" bug.
 *
 * `state.isConnected` is the precise NetInfo equivalent of the browser's
 * `navigator.onLine`. It only flips false when the OS reports there is no
 * network interface available (airplane mode, no wifi + no cell, etc.).
 *
 * Two safety nets the web doesn't need but mobile does:
 *   1. on offline transition, clear `isSyncing` so the spinner can't stay
 *      stuck while a 30s axios call dies in the background
 *   2. on online transition, run `deltaSync` + `processQueue` to flush
 *      anything that was queued while offline (matches desktop's
 *      `window.addEventListener('online', ...)` in syncEngine.js)
 */
export default function useNetwork() {
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      // null (still being determined) → treat as online, matching the
      // browser's `navigator.onLine` which defaults to true.
      const nextOnline = state.isConnected !== false;
      const store = useSyncStore.getState();
      if (nextOnline === store.isOnline) return;

      store.setOnline(nextOnline);

      if (!nextOnline) {
        if (store.isSyncing) store.setSyncing(false);
        return;
      }

      deltaSync().catch(console.error);
      processQueue().catch(console.error);
    });
    return () => unsubscribe();
  }, []);
}
