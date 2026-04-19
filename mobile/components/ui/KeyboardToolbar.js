import { Platform, View, Text, Pressable, Keyboard, InputAccessoryView } from 'react-native';
import { ChevronUp, ChevronDown } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

export const KEYBOARD_TOOLBAR_ID = 'pm-keyboard-toolbar';

/**
 * iOS-only floating toolbar above the keyboard with Prev / Next / Done.
 * Renders nothing on Android (the soft keyboard's `next` returnKey already
 * covers the common case there).
 *
 * Pair every text input with `inputAccessoryViewID={KEYBOARD_TOOLBAR_ID}` so
 * the toolbar pins itself above the keyboard for that input.
 */
export default function KeyboardToolbar({
  onPrev, onNext, onDone, canGoPrev = true, canGoNext = true, label,
}) {
  if (Platform.OS !== 'ios') return null;

  const handlePrev = () => {
    if (!canGoPrev) return;
    Haptics.selectionAsync().catch(() => {});
    onPrev?.();
  };
  const handleNext = () => {
    if (!canGoNext) return;
    Haptics.selectionAsync().catch(() => {});
    onNext?.();
  };
  const handleDone = () => {
    Haptics.selectionAsync().catch(() => {});
    onDone?.();
    Keyboard.dismiss();
  };

  return (
    <InputAccessoryView nativeID={KEYBOARD_TOOLBAR_ID}>
      <View className="flex-row items-center justify-between border-t border-border bg-card px-2 py-1.5">
        <View className="flex-row items-center">
          <Pressable
            onPress={handlePrev}
            disabled={!canGoPrev}
            hitSlop={6}
            className={`h-9 w-10 items-center justify-center rounded-md ${canGoPrev ? 'active:bg-muted' : 'opacity-30'}`}
          >
            <ChevronUp size={20} color="hsl(150, 10%, 35%)" />
          </Pressable>
          <Pressable
            onPress={handleNext}
            disabled={!canGoNext}
            hitSlop={6}
            className={`h-9 w-10 items-center justify-center rounded-md ${canGoNext ? 'active:bg-muted' : 'opacity-30'}`}
          >
            <ChevronDown size={20} color="hsl(150, 10%, 35%)" />
          </Pressable>
        </View>

        {label ? (
          <Text className="text-xs text-muted-foreground flex-1 text-center px-2" numberOfLines={1}>
            {label}
          </Text>
        ) : <View className="flex-1" />}

        <Pressable
          onPress={handleDone}
          hitSlop={6}
          className="h-9 px-3 items-center justify-center rounded-md active:bg-muted"
        >
          <Text className="text-sm font-semibold text-primary">Done</Text>
        </Pressable>
      </View>
    </InputAccessoryView>
  );
}
