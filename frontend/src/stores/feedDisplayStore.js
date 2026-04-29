import { create } from 'zustand';

/**
 * Persistent user preference for how feed quantities are displayed
 * across the app — kilograms (the canonical unit) or 50 kg bags
 * (the shed-floor unit).
 *
 * Web port of mobile/stores/feedDisplayStore.js. Same in-memory
 * Zustand state, but persistence runs through `localStorage`
 * (synchronous) instead of the mobile `expo-secure-store` async
 * pattern — so we hydrate eagerly at module load instead of via an
 * `init*` action called from a layout effect.
 */

const FEED_UNIT_KEY = 'pm-feed-unit';
const VALID_UNITS = ['kg', 'bags'];
const isValidUnit = (u) => VALID_UNITS.includes(u);

function readStored() {
  if (typeof window === 'undefined') return 'kg';
  try {
    const stored = localStorage.getItem(FEED_UNIT_KEY);
    if (stored && isValidUnit(stored)) return stored;
  } catch (_) {
    // localStorage may throw under restrictive privacy settings
    // (private mode in Safari historically); fall back to the
    // default rather than break the toggle entirely.
  }
  return 'kg';
}

function writeStored(unit) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(FEED_UNIT_KEY, unit);
  } catch (_) {
    // Best-effort persistence — see readStored() for the rationale.
  }
}

const useFeedDisplayStore = create((set, get) => ({
  unit: readStored(),

  setUnit: (unit) => {
    if (!isValidUnit(unit)) return;
    set({ unit });
    writeStored(unit);
  },

  toggleUnit: () => {
    const next = get().unit === 'kg' ? 'bags' : 'kg';
    set({ unit: next });
    writeStored(next);
  },
}));

export default useFeedDisplayStore;
