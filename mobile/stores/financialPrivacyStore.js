import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';

/**
 * Persistent user preference for whether financial figures (revenue,
 * expenses, profit, etc.) are masked on the dashboard and other
 * money-bearing surfaces. Mirrors the pattern used by `feedDisplayStore`:
 * Zustand for in-memory state, `expo-secure-store` for persistence,
 * and an `initFinancialPrivacy` action called once from `app/_layout.js`
 * to hydrate the saved value on app start.
 *
 * The toggle lives in the dashboard hero toolbar (eye / eye-off icon).
 * Any surface that wants to honour it should subscribe with
 * `useFinancialPrivacyStore((s) => s.hidden)` and render the
 * `MASKED_VALUE` placeholder in place of the real figure when true.
 *
 * Why we mask the value rather than unmount the card: the layout —
 * card eyebrow, headline placement, three-cell stat grid — is what
 * tells the user the dashboard "has" a finance section. Replacing the
 * digits keeps that mental model intact while denying the over-the-
 * shoulder reader the actual numbers.
 */

const PRIVACY_KEY = 'pm-financial-privacy';

export const MASKED_VALUE = '••••';

const useFinancialPrivacyStore = create((set, get) => ({
  hidden: false,

  setHidden: (next) => {
    const value = !!next;
    set({ hidden: value });
    SecureStore.setItemAsync(PRIVACY_KEY, value ? '1' : '0').catch(() => {});
  },

  toggleHidden: () => {
    const next = !get().hidden;
    set({ hidden: next });
    SecureStore.setItemAsync(PRIVACY_KEY, next ? '1' : '0').catch(() => {});
  },

  initFinancialPrivacy: async () => {
    try {
      const stored = await SecureStore.getItemAsync(PRIVACY_KEY);
      if (stored === '1') set({ hidden: true });
      else if (stored === '0') set({ hidden: false });
    } catch (_) {
      // Fall back to default (not hidden) silently.
    }
  },
}));

export default useFinancialPrivacyStore;
