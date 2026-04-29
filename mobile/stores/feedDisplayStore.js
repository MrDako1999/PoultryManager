import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';

/**
 * Persistent user preference for how feed quantities are displayed
 * across the app — kilograms (the canonical unit) or 50 kg bags
 * (the shed-floor unit). Mirrors the pattern used by `themeStore`:
 * Zustand for in-memory state, `expo-secure-store` for persistence,
 * and an `init*` action called once from `app/_layout.js` to hydrate
 * the saved value on app start.
 *
 * Only the FeedInventoryCard's headline / subline / per-phase row
 * text reads this preference today; future feed-related surfaces
 * should subscribe to the same store so toggling once flips
 * everything together.
 */

const FEED_UNIT_KEY = 'pm-feed-unit';
const VALID_UNITS = ['kg', 'bags'];
const isValidUnit = (u) => VALID_UNITS.includes(u);

const useFeedDisplayStore = create((set, get) => ({
  unit: 'kg',

  setUnit: (unit) => {
    if (!isValidUnit(unit)) return;
    set({ unit });
    // Best-effort persistence — failure shouldn't break the toggle,
    // the value will just reset to default on next launch.
    SecureStore.setItemAsync(FEED_UNIT_KEY, unit).catch(() => {});
  },

  toggleUnit: () => {
    const next = get().unit === 'kg' ? 'bags' : 'kg';
    set({ unit: next });
    SecureStore.setItemAsync(FEED_UNIT_KEY, next).catch(() => {});
  },

  initFeedDisplay: async () => {
    try {
      const stored = await SecureStore.getItemAsync(FEED_UNIT_KEY);
      if (stored && isValidUnit(stored)) set({ unit: stored });
    } catch (_) {
      // Fall back to the default 'kg' silently — a SecureStore read
      // failure isn't worth surfacing to the user.
    }
  },
}));

export default useFeedDisplayStore;
