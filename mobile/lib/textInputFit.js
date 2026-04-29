import { Platform } from 'react-native';

/**
 * Style fragment that makes a React Native `TextInput` actually fit
 * inside a fixed-height container on Android.
 *
 * Why this exists:
 *   On Android, `TextInput` ships with three defaults that bite us at
 *   small heights (e.g. 40-52pt search bars / form fields):
 *     1. `includeFontPadding: true` — adds extra ascent/descent space
 *        for diacritics, which inflates the rendered text box.
 *     2. `textAlignVertical: 'top'` — pins text to the top of the box,
 *        leaving uneven gaps and clipping the bottom on certain fonts
 *        (Poppins in particular).
 *     3. ~8-10pt internal vertical padding on the native EditText.
 *   The combined effect on a 40pt container is that the placeholder
 *   gets visibly clipped — most reliably on Huawei / EMUI builds where
 *   the EditText padding is even more aggressive.
 *
 * Apply this to ANY single-line TextInput where the container has a
 * fixed `height`. For multi-line / Textarea fields use
 * `textInputFitMultiline` instead, which keeps the top alignment.
 *
 * Both objects are no-ops on iOS (the props are Android-only or
 * already do the right thing), so they're safe to spread
 * unconditionally.
 */
export const textInputFit = Platform.select({
  android: {
    includeFontPadding: false,
    textAlignVertical: 'center',
    paddingTop: 0,
    paddingBottom: 0,
  },
  default: {},
});

export const textInputFitMultiline = Platform.select({
  android: {
    includeFontPadding: false,
    textAlignVertical: 'top',
  },
  default: {},
});
