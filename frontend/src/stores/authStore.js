import { create } from 'zustand';
import api from '@/lib/api';
import { fullSync, deltaSync, clearAll, startPeriodicSync, stopPeriodicSync } from '@/lib/syncEngine';
import db from '@/lib/db';
import useModuleStore from '@/stores/moduleStore';
import { MODULE_ORDER } from '@/modules/registry';

function resolveVisibleModules(user) {
  if (!user) return [];
  const userModules = Array.isArray(user.modules) ? user.modules : [];
  return MODULE_ORDER.filter((m) => userModules.includes(m));
}

function syncModuleStoreFromUser(user) {
  const visible = resolveVisibleModules(user);
  useModuleStore.getState().initFromUser(visible);
}

const useAuthStore = create((set) => ({
  user: null,
  isLoading: true,

  checkAuth: async () => {
    try {
      const { data } = await api.get('/auth/me');
      set({ user: data, isLoading: false });
      syncModuleStoreFromUser(data);
      const hasMeta = (await db.syncMeta.count()) > 0;
      if (hasMeta) {
        deltaSync().catch(console.error);
      } else {
        fullSync().catch(console.error);
      }
      startPeriodicSync();
    } catch {
      useModuleStore.getState().reset();
      set({ user: null, isLoading: false });
    }
  },

  login: async (credentials) => {
    const { data } = await api.post('/auth/login', credentials);
    set({ user: data.user });
    syncModuleStoreFromUser(data.user);
    await clearAll();
    fullSync().catch(console.error);
    startPeriodicSync();
    return data;
  },

  register: async (userData) => {
    const { data } = await api.post('/auth/register', userData);
    set({ user: data.user });
    syncModuleStoreFromUser(data.user);
    await clearAll();
    fullSync().catch(console.error);
    startPeriodicSync();
    return data;
  },

  logout: async () => {
    stopPeriodicSync();
    await clearAll();
    try { await api.post('/auth/logout'); } catch {}
    useModuleStore.getState().reset();
    set({ user: null });
  },

  refreshUser: async () => {
    try {
      const { data } = await api.get('/auth/me');
      set({ user: data });
      syncModuleStoreFromUser(data);
      return data;
    } catch (err) {
      console.error('refreshUser failed', err);
      return null;
    }
  },
}));

export default useAuthStore;
