import { create } from 'zustand';
import api from '@/lib/api';
import { fullSync, deltaSync, clearAll, startPeriodicSync, stopPeriodicSync } from '@/lib/syncEngine';
import db from '@/lib/db';

const useAuthStore = create((set) => ({
  user: null,
  isLoading: true,

  checkAuth: async () => {
    try {
      const { data } = await api.get('/auth/me');
      set({ user: data, isLoading: false });
      const hasMeta = (await db.syncMeta.count()) > 0;
      if (hasMeta) {
        deltaSync().catch(console.error);
      } else {
        fullSync().catch(console.error);
      }
      startPeriodicSync();
    } catch {
      set({ user: null, isLoading: false });
    }
  },

  login: async (credentials) => {
    const { data } = await api.post('/auth/login', credentials);
    set({ user: data.user });
    await clearAll();
    fullSync().catch(console.error);
    startPeriodicSync();
    return data;
  },

  register: async (userData) => {
    const { data } = await api.post('/auth/register', userData);
    set({ user: data.user });
    await clearAll();
    fullSync().catch(console.error);
    startPeriodicSync();
    return data;
  },

  logout: async () => {
    stopPeriodicSync();
    await clearAll();
    await api.post('/auth/logout');
    set({ user: null });
  },
}));

export default useAuthStore;
