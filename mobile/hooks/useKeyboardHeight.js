import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

/**
 * Track the on-screen keyboard's height in pixels.
 *
 * Returns 0 when the keyboard is hidden, otherwise the current keyboard
 * frame height as reported by the native event.
 *
 * iOS uses `keyboardWillShow/Hide` so the value updates in lockstep with
 * the keyboard's spring animation. Android uses `keyboardDidShow/Hide`
 * (the `Will*` variants are iOS-only).
 *
 * Why this hook exists instead of `KeyboardAvoidingView`:
 *   - On Android, `FormSheet` lives inside a translucent `<Modal>`. The
 *     modal's window does not honour `windowSoftInputMode: adjustResize`,
 *     so KAV measurements come back wrong and the focused field ends up
 *     hidden behind the keyboard.
 *   - On iOS, `presentationStyle="pageSheet"` modals don't auto-resize
 *     for the keyboard either; KAV with `behavior="padding"` works but
 *     mixing it with manual scroll-into-view caused double-padding.
 *
 * Reading the height directly and applying `paddingBottom` ourselves
 * gives us one consistent code path on both platforms.
 */
export default function useKeyboardHeight() {
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvt, (e) => {
      setHeight(e?.endCoordinates?.height || 0);
    });
    const hideSub = Keyboard.addListener(hideEvt, () => setHeight(0));

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  return height;
}
