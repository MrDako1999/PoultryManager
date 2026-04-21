import { create } from 'zustand';
import api from '@/lib/api';
import { getToken, setToken, clearToken } from '@/lib/storage';
import {
  fullSync, deltaSync, clearAll, startPeriodicSync, stopPeriodicSync,
  stopBillingHeartbeat,
} from '@/lib/syncEngine';
import { getSyncMetaCount } from '@/lib/db';
import useModuleStore from '@/stores/moduleStore';
import useSyncStore from '@/stores/syncStore';

async function runInitialSync() {
  const syncStore = useSyncStore.getState();
  syncStore.setInitialSyncing(true);
  try {
    await fullSync({ reportProgress: true });
  } catch (err) {
    console.error('Initial sync failed:', err);
  } finally {
    useSyncStore.getState().setInitialSyncing(false);
    useSyncStore.getState().clearSyncProgress();
  }
}

// Lazy-load the registry to break the require cycle:
// authStore -> syncEngine -> registry -> broiler/index -> WorkerHome -> authStore.
function getModuleOrder() {
  const { MODULE_ORDER } = require('@/modules/registry');
  return MODULE_ORDER;
}

function resolveVisibleModules(user) {
  if (!user) return [];
  const userModules = Array.isArray(user.modules) ? user.modules : [];
  return getModuleOrder().filter((m) => userModules.includes(m));
}

async function syncModuleStoreFromUser(user) {
  const visible = resolveVisibleModules(user);
  await useModuleStore.getState().initFromUser(visible);
}

const useAuthStore = create((set) => ({
  user: null,
  isLoading: true,

  checkAuth: async () => {
    try {
      const token = await getToken();
      if (!token) {
        set({ user: null, isLoading: false });
        await useModuleStore.getState().reset();
        return;
      }
      const { data } = await api.get('/auth/me');
      set({ user: data, isLoading: false });
      await syncModuleStoreFromUser(data);
      const hasMeta = (await getSyncMetaCount()) > 0;
      if (hasMeta) {
        deltaSync().catch(console.error);
      } else {
        runInitialSync();
      }
      startPeriodicSync();
    } catch {
      await clearToken();
      await useModuleStore.getState().reset();
      set({ user: null, isLoading: false });
    }
  },

  login: async (credentials) => {
    const { data } = await api.post('/auth/login', credentials);
    await setToken(data.token);
    set({ user: data.user });
    await syncModuleStoreFromUser(data.user);
    await clearAll();
    runInitialSync();
    startPeriodicSync();
    return data;
  },

  register: async (userData) => {
    const { data } = await api.post('/auth/register', userData);
    await setToken(data.token);
    set({ user: data.user });
    await syncModuleStoreFromUser(data.user);
    await clearAll();
    runInitialSync();
    startPeriodicSync();
    return data;
  },

  logout: async () => {
    stopPeriodicSync();
    stopBillingHeartbeat();
    await clearAll();
    try {
      await api.post('/auth/logout');
    } catch {}
    await clearToken();
    await useModuleStore.getState().reset();
    set({ user: null });
  },

  refreshUser: async () => {
    try {
      const { data } = await api.get('/auth/me');
      set({ user: data });
      await syncModuleStoreFromUser(data);
      return data;
    } catch (err) {
      console.error('refreshUser failed', err);
      return null;
    }
  },
}));

export default useAuthStore;
