import { create } from 'zustand';
import { getPendingCount, getFailedCount as _getFailedCount } from '@/lib/mutationQueue';

const useSyncStore = create((set) => ({
  isOnline: true,
  isSyncing: false,
  isFullResyncing: false,
  pendingCount: 0,
  failedCount: 0,
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
      const count = await getPendingCount();
      set({ pendingCount: count });
    } catch {
      set({ pendingCount: 0 });
    }
  },

  refreshFailedCount: async () => {
    try {
      const count = await _getFailedCount();
      set({ failedCount: count });
    } catch {
      set({ failedCount: 0 });
    }
  },

  refreshCounts: async () => {
    try {
      const [pending, failed] = await Promise.all([getPendingCount(), _getFailedCount()]);
      set({ pendingCount: pending, failedCount: failed });
    } catch {
      set({ pendingCount: 0, failedCount: 0 });
    }
  },
}));

export default useSyncStore;
