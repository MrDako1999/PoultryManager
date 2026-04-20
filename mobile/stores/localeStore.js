import { create } from 'zustand';
import { I18nManager } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import i18n, { SUPPORTED_LANGUAGES, isRtlLanguage } from '@/i18n';

const LANG_KEY = 'pm-language';

// Timing for the language-change transition overlay (see LanguageChangeOverlay).
//
// The picker is dismissed instantly by `LanguagePickerSheet.onValueChange`
// (via `BottomPickerSheet.dismissImmediate`) BEFORE we reach this fn, so
// there's no Modal-stacking conflict and we can mount the overlay's Modal
// straight away. See LanguageSelector.js for the picker-side handoff.
//
// We still need to wait for our overlay's `animationType="fade"` to fully
// cover the screen (~300ms) BEFORE flipping i18n + I18nManager, otherwise
// the user would catch the strings/RTL snap mid-fade. Then we hold so the
// change reads as a deliberate beat, not a flash.
//
// Rough budget (t = ms after user taps a language row):
//   t=0       picker dismissed instantly + setLanguage(code) starts
//             → set({isChangingLanguage: true}) → overlay Modal mounts
//   0–350     overlay fades in (~300ms native fade + small buffer)
//   350       actual i18n.changeLanguage + I18nManager.forceRTL + set()
//             → all useTranslation() / useIsRTL() subscribers re-render
//             behind the now-opaque overlay; the user never sees the flip.
//   1050      overlay fades out, revealing the new language
//   1350      done
const FADE_IN_HOLD_MS = 350;
const POST_CHANGE_HOLD_MS = 700;

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
const useLocaleStore = create((set, get) => ({
  language: 'en',
  isRTL: false,

  // Transition state for the LanguageChangeOverlay. `pendingFrom` /
  // `pendingTo` are captured at the start of `setLanguage` and held for the
  // entire transition (we can't derive them from `language` because we mutate
  // `language` mid-flight). They are null when the overlay is not visible.
  isChangingLanguage: false,
  pendingFrom: null,
  pendingTo: null,

  setLanguage: async (code) => {
    if (!SUPPORTED_LANGUAGES.find((l) => l.code === code)) return;

    const fromCode = get().language;
    if (fromCode === code) return;
    if (get().isChangingLanguage) return;

    const nextIsRTL = isRtlLanguage(code);

    // The picker (if open) was already dismissed instantly by the caller,
    // so we can mount the overlay's Modal right away — no Modal-stacking
    // wait needed.
    set({
      isChangingLanguage: true,
      pendingFrom: fromCode,
      pendingTo: code,
    });

    try {
      // Wait for the overlay's fade-in to fully cover the screen before
      // flipping anything. This is what hides the abrupt strings/RTL snap.
      await new Promise((resolve) => setTimeout(resolve, FADE_IN_HOLD_MS));

      await SecureStore.setItemAsync(LANG_KEY, code);
      await i18n.changeLanguage(code);

      // Tell the platform what we want for the next cold start. Safe to call
      // even when nothing changed — the values are persisted natively.
      I18nManager.allowRTL(nextIsRTL);
      I18nManager.forceRTL(nextIsRTL);

      set({ language: code, isRTL: nextIsRTL });

      // Hold the overlay so the change reads as deliberate. Without this,
      // the overlay would dismiss the moment React renders the new state
      // and the user would barely register that anything happened.
      await new Promise((resolve) => setTimeout(resolve, POST_CHANGE_HOLD_MS));
    } finally {
      // Always clear the transition flags, even if the change errored — we
      // never want the overlay to stick on screen and wedge the UI.
      set({ isChangingLanguage: false, pendingFrom: null, pendingTo: null });
    }
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
