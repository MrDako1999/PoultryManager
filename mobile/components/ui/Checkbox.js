import { Pressable, View } from 'react-native';
import { Check } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { cn } from '@/lib/utils';

export function Checkbox({ checked, onCheckedChange, disabled, className }) {
  const handlePress = () => {
    if (disabled) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onCheckedChange?.(!checked);
  };

  return (
    <Pressable onPress={handlePress} disabled={disabled} hitSlop={8}>
      <View
        className={cn(
          'h-5 w-5 rounded border items-center justify-center',
          checked ? 'bg-primary border-primary' : 'border-input bg-background',
          disabled && 'opacity-50',
          className
        )}
      >
        {checked && <Check size={14} color="#f5f8f5" strokeWidth={3} />}
      </View>
    </Pressable>
  );
}
