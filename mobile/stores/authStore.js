import { create } from 'zustand';
import api from '../lib/api';
import { getToken, setToken, clearToken } from '../lib/storage';
import { fullSync, deltaSync, clearAll, startPeriodicSync, stopPeriodicSync } from '../lib/syncEngine';
import { getSyncMetaCount } from '../lib/db';

const useAuthStore = create((set) => ({
  user: null,
  isLoading: true,

  checkAuth: async () => {
    try {
      const token = await getToken();
      if (!token) {
        set({ user: null, isLoading: false });
        return;
      }
      const { data } = await api.get('/auth/me');
      set({ user: data, isLoading: false });
      const hasMeta = (await getSyncMetaCount()) > 0;
      if (hasMeta) {
        deltaSync().catch(console.error);
      } else {
        fullSync().catch(console.error);
      }
      startPeriodicSync();
    } catch {
      await clearToken();
      set({ user: null, isLoading: false });
    }
  },

  login: async (credentials) => {
    const { data } = await api.post('/auth/login', credentials);
    await setToken(data.token);
    set({ user: data.user });
    await clearAll();
    fullSync().catch(console.error);
    startPeriodicSync();
    return data;
  },

  register: async (userData) => {
    const { data } = await api.post('/auth/register', userData);
    await setToken(data.token);
    set({ user: data.user });
    await clearAll();
    fullSync().catch(console.error);
    startPeriodicSync();
    return data;
  },

  logout: async () => {
    stopPeriodicSync();
    await clearAll();
    try {
      await api.post('/auth/logout');
    } catch {}
    await clearToken();
    set({ user: null });
  },
}));

export default useAuthStore;
