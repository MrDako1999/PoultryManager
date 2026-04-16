import { useEffect } from 'react';
import NetInfo from '@react-native-community/netinfo';
import useSyncStore from '@/stores/syncStore';
import { deltaSync, processQueue } from '@/lib/syncEngine';

export default function useNetwork() {
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const wasOffline = !useSyncStore.getState().isOnline;
      useSyncStore.getState().setOnline(!!state.isConnected);

      if (state.isConnected && wasOffline) {
        deltaSync().catch(console.error);
        processQueue().catch(console.error);
      }
    });
    return () => unsubscribe();
  }, []);
}
