import { create } from 'zustand';
import { I18nManager } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as Updates from 'expo-updates';
import { router } from 'expo-router';
import i18n, { SUPPORTED_LANGUAGES, isRtlLanguage } from '@/i18n';

const LANG_KEY = 'pm-language';
// Stash key for the last route the user was on when a direction-flip
// reload happened, so we can pop them back there after the JS bridge
// restarts. Without this they always land on the dashboard after a
// language change, which feels like the app forgot what it was doing.
const POST_RELOAD_ROUTE_KEY = 'pm-post-reload-route';

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
    // A "direction flip" means the new locale needs the opposite Yoga
    // RTL setting from what's currently active in the native bridge.
    // Crossing this line is what triggers all the layout corruption
    // (icons jammed against labels, theme pill drifting off the right
    // edge, settings rows squished) because logical-side properties
    // and `flexDirection: 'row'` keep resolving against the stale
    // platform flag until the next cold start.
    //
    // Same-script switches (e.g. EN ↔ ES, AR ↔ FA) need NO bridge
    // reload — they only swap strings.
    const directionFlipping = !!nextIsRTL !== !!I18nManager.isRTL;

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

      if (directionFlipping) {
        // Only the JS bridge actually re-reads I18nManager when it
        // restarts, so on a cross-direction switch we hard-reload the
        // bundle while the overlay still covers the screen. The user
        // sees the same fade animation; they don't see the reload
        // boundary. Without this they'd live with auto-flipped
        // `flexDirection: 'row'` / mis-resolved `marginEnd` / drifted
        // SlidingSegmentedControl pill until they next cold-launched
        // the app — exactly the "switching from Arabic back to
        // English gets cooked" complaint.

        // Stash the user's current route so the next session can pop
        // them back there. Without this they always land on the home
        // tab after a language change, which feels like the app lost
        // their place. expo-router's `pathname` is the live URL of the
        // currently-rendered route (incl. dynamic segments), so it
        // round-trips through `router.push` cleanly.
        try {
          const pathname = router?.pathname;
          if (pathname && pathname !== '/') {
            await SecureStore.setItemAsync(POST_RELOAD_ROUTE_KEY, pathname);
          }
        } catch {
          // Don't block the language change on a route-stash failure;
          // worst case the user lands on dashboard after reload.
        }

        try {
          await Updates.reloadAsync();
          // reloadAsync resolves only after a successful reload kicks
          // in; the JS context is destroyed so anything below this line
          // never runs in the new session. Belt-and-braces: if it
          // somehow returns instead of nuking the bridge, fall through
          // to the post-change hold so the overlay still dismisses.
        } catch (err) {
          // expo-updates throws in some odd corner cases (e.g. a stale
          // dev client without the native module). Swallow and continue
          // — the language has still been persisted and i18n strings
          // are now correct, only the layout-drift fix is skipped.
          console.warn('[locale] Updates.reloadAsync failed; layout may need a manual app restart:', err?.message);
        }
      }

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

    // If the previous JS session stashed a "where I was" route before
    // calling Updates.reloadAsync (i.e. a language-change reload), pop
    // the user back there. We always clear the key first so a partial
    // failure can't loop them back to the same screen forever.
    //
    // Routed AFTER the locale is applied so the destination renders in
    // the correct writing direction on first paint. Slight defer so the
    // root navigator has time to mount before we push.
    try {
      const stashedRoute = await SecureStore.getItemAsync(POST_RELOAD_ROUTE_KEY);
      if (stashedRoute) {
        await SecureStore.deleteItemAsync(POST_RELOAD_ROUTE_KEY);
        // requestAnimationFrame isn't enough on iOS — the (app)/(tabs)
        // navigator can still be in the middle of its mount. A 0ms
        // setTimeout queues the navigation after the current render
        // commit, which is reliable in practice.
        setTimeout(() => {
          try {
            router.replace(stashedRoute);
          } catch {
            /* destination invalid in new session — fall back to home */
          }
        }, 0);
      }
    } catch {
      /* SecureStore noise is non-fatal */
    }
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
