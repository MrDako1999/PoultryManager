import { create } from 'zustand';

const STORAGE_KEY = 'pm-active-module';

function readStored() {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStored(value) {
  try {
    if (value) localStorage.setItem(STORAGE_KEY, value);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {}
}

const useModuleStore = create((set, get) => ({
  activeModule: null,
  availableModules: [],
  initialized: false,

  initFromUser: (visibleModules) => {
    const list = Array.isArray(visibleModules) ? visibleModules : [];
    const stored = readStored();
    const resolved = list.includes(stored) ? stored : (list[0] || null);
    if (resolved && resolved !== stored) writeStored(resolved);
    set({ activeModule: resolved, availableModules: list, initialized: true });
  },

  setActiveModule: (moduleId) => {
    const { availableModules } = get();
    if (!availableModules.includes(moduleId)) return;
    writeStored(moduleId);
    set({ activeModule: moduleId });
  },

  reset: () => {
    writeStored(null);
    set({ activeModule: null, availableModules: [], initialized: false });
  },
}));

export default useModuleStore;
