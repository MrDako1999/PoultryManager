import { I18nManager } from 'react-native';

/**
 * The RTL double-flip trap, fixed in one place.
 *
 * React Native's Yoga engine **automatically** flips `flexDirection: 'row'`
 * to visually run right-to-left when `I18nManager.isRTL === true`. Our app
 * doesn't cold-restart on a language switch (jarring UX, see localeStore),
 * so the JS-side `useIsRTL()` flag and the native `I18nManager.isRTL` flag
 * can disagree for a single session:
 *
 *   - User installs in English. JS=LTR, Native=LTR.
 *   - User picks Arabic. JS=RTL, Native=LTR (until next cold start).
 *   - User cold-restarts. JS=RTL, Native=RTL.
 *   - User picks English. JS=LTR, Native=RTL (until next cold start).
 *
 * If a component naively writes `flexDirection: isRTL ? 'row-reverse' : 'row'`
 * it works in cases 1 and 2, but **double-flips back to LTR** in case 3 (Yoga
 * auto-flips `row-reverse` to `row`). This is exactly what made the Sync
 * popover render with its action buttons and meta in the wrong order on the
 * AR screenshot the user reported.
 *
 * `rowDirection(localeIsRTL)` returns the value to use for `flexDirection`
 * that lands the visual order at the desired direction regardless of which
 * of the four states above the device is currently in.
 *
 * Usage:
 *   const isRTL = useIsRTL();
 *   <View style={{ flexDirection: rowDirection(isRTL) }} />
 */
export function rowDirection(localeIsRTL) {
  // If the platform's RTL state already matches what the locale wants, the
  // plain `'row'` (which Yoga will auto-flip when needed) is correct.
  if (!!localeIsRTL === !!I18nManager.isRTL) return 'row';
  // States disagree — we have to manually reverse to override Yoga's
  // auto-behaviour for the duration of this session.
  return 'row-reverse';
}

/**
 * Same idea for `alignItems` flex-end / flex-start which DO NOT auto-flip
 * with I18nManager (only `flexDirection: 'row'` does). When you want
 * "trailing edge alignment" in the current locale you usually want
 * `flex-end` in LTR and `flex-start` in RTL, but again the locale flag and
 * the platform flag may disagree, so route both through here.
 */
export function trailingAlignment(localeIsRTL) {
  return localeIsRTL ? 'flex-start' : 'flex-end';
}

export function leadingAlignment(localeIsRTL) {
  return localeIsRTL ? 'flex-end' : 'flex-start';
}

/**
 * Resolved text alignment for the locale.
 *
 * iOS has the same double-flip trap for `textAlign` that Yoga has for
 * `flexDirection`: when `I18nManager.isRTL === true`, the platform
 * silently swaps the meaning of `textAlign: 'left'` and `'right'` so that
 * `'left'` paints on the RIGHT and vice-versa. That makes the naive
 * `textAlign: isRTL ? 'right' : 'left'` render visually LEFT for an
 * Arabic user on a cold-restarted device — exactly the "batch name not
 * next to its avatar" bug on the BatchesList screenshot.
 *
 * The fix mirrors `rowDirection` — pre-compensate when the locale flag
 * and the platform flag disagree so the final visual side is always the
 * intended one.
 *
 *   localeIsRTL=true,  native=true  → return 'right' (flips → LEFT? no, see below)
 *   localeIsRTL=true,  native=false → return 'right' (no flip → RIGHT)
 *   localeIsRTL=false, native=false → return 'left'  (no flip → LEFT)
 *   localeIsRTL=false, native=true  → return 'right' (flips → LEFT)
 *
 * In words: "set the textAlign value that lands visually on the leading
 * edge of the locale, after iOS has applied any auto-flip".
 */
export function textAlignStart(localeIsRTL) {
  const nativeRTL = !!I18nManager.isRTL;
  const want = localeIsRTL ? 'right' : 'left';
  if (!nativeRTL) return want;
  // Native auto-flip will swap left↔right. Pre-invert so the visual
  // side ends up where we want.
  return want === 'left' ? 'right' : 'left';
}

export function textAlignEnd(localeIsRTL) {
  const nativeRTL = !!I18nManager.isRTL;
  const want = localeIsRTL ? 'left' : 'right';
  if (!nativeRTL) return want;
  return want === 'left' ? 'right' : 'left';
}
