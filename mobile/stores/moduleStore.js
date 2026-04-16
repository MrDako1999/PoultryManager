import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';

const STORAGE_KEY = 'pm-active-module';

const useModuleStore = create((set, get) => ({
  activeModule: null,
  availableModules: [],
  initialized: false,

  initFromUser: async (visibleModules) => {
    const list = Array.isArray(visibleModules) ? visibleModules : [];
    let stored = null;
    try {
      stored = await SecureStore.getItemAsync(STORAGE_KEY);
    } catch {}

    const resolved = list.includes(stored) ? stored : (list[0] || null);

    if (resolved && resolved !== stored) {
      try { await SecureStore.setItemAsync(STORAGE_KEY, resolved); } catch {}
    }

    set({
      activeModule: resolved,
      availableModules: list,
      initialized: true,
    });
  },

  setActiveModule: async (moduleId) => {
    const { availableModules } = get();
    if (!availableModules.includes(moduleId)) return;
    try { await SecureStore.setItemAsync(STORAGE_KEY, moduleId); } catch {}
    set({ activeModule: moduleId });
  },

  reset: async () => {
    try { await SecureStore.deleteItemAsync(STORAGE_KEY); } catch {}
    set({ activeModule: null, availableModules: [], initialized: false });
  },
}));

export default useModuleStore;
