import { create } from 'zustand';
import { I18nManager } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import i18n, { SUPPORTED_LANGUAGES, isRtlLanguage } from '@/i18n';

const LANG_KEY = 'pm-language';

/**
 * Application-level locale store.
 *
 * IMPORTANT: components should read `isRTL` from this store (or call
 * `useIsRTL()`) and NEVER read `I18nManager.isRTL` directly. The platform
 * RTL flag only flips on a full native cold-start, so on a JS reload after
 * the user picks Arabic the flag is still `false`. Driving layout from the
 * store value lets every component reflow immediately.
 *
 * For native-side RTL (system gestures, keyboard chrome, default
 * `flexDirection: row` reversal) we still call `I18nManager.forceRTL` so
 * that on the next cold start the platform aligns. We do NOT auto-reload —
 * a JS reload would not actually re-create UIKit surfaces and would just
 * cause a confusing flash for the user.
 */
const useLocaleStore = create((set) => ({
  language: 'en',
  isRTL: false,

  setLanguage: async (code) => {
    if (!SUPPORTED_LANGUAGES.find((l) => l.code === code)) return;

    const nextIsRTL = isRtlLanguage(code);

    await SecureStore.setItemAsync(LANG_KEY, code);
    await i18n.changeLanguage(code);

    // Tell the platform what we want for the next cold start. Safe to call
    // even when nothing changed — the values are persisted natively.
    I18nManager.allowRTL(nextIsRTL);
    I18nManager.forceRTL(nextIsRTL);

    set({ language: code, isRTL: nextIsRTL });
  },

  initLocale: async () => {
    const stored = await SecureStore.getItemAsync(LANG_KEY);
    const code = stored && SUPPORTED_LANGUAGES.find((l) => l.code === stored)
      ? stored
      : (i18n.language || 'en');

    if (i18n.language !== code) {
      await i18n.changeLanguage(code);
    }

    const wantRTL = isRtlLanguage(code);
    I18nManager.allowRTL(wantRTL);
    I18nManager.forceRTL(wantRTL);

    set({ language: code, isRTL: wantRTL });
  },
}));

export default useLocaleStore;

/**
 * Convenience hook that returns the current RTL flag — driven by the
 * persisted language, NOT `I18nManager.isRTL`.
 */
export function useIsRTL() {
  return useLocaleStore((s) => s.isRTL);
}

export { SUPPORTED_LANGUAGES };
