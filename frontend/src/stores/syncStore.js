import { create } from 'zustand';
import db from '@/lib/db';

const useSyncStore = create((set, get) => ({
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  isSyncing: false,
  isFullResyncing: false,
  pendingCount: 0,
  lastSyncAt: null,
  syncErrors: [],

  syncProgress: null,

  setOnline: (val) => set({ isOnline: val }),
  setSyncing: (val) => set({ isSyncing: val }),
  setFullResyncing: (val) => set({ isFullResyncing: val }),
  setLastSyncAt: (val) => set({ lastSyncAt: val }),
  addSyncError: (err) => set((s) => ({ syncErrors: [...s.syncErrors, err] })),
  clearErrors: () => set({ syncErrors: [] }),

  setSyncProgress: (progress) => set({ syncProgress: progress }),
  clearSyncProgress: () => set({ syncProgress: null }),

  refreshPendingCount: async () => {
    try {
      const count = await db.mutationQueue.where('status').equals('pending').count();
      set({ pendingCount: count });
    } catch {
      set({ pendingCount: 0 });
    }
  },
}));

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => useSyncStore.getState().setOnline(true));
  window.addEventListener('offline', () => useSyncStore.getState().setOnline(false));
}

export default useSyncStore;
