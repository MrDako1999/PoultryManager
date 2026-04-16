import { forwardRef, useState } from 'react';
import { View, TextInput, Pressable } from 'react-native';
import { Eye, EyeOff } from 'lucide-react-native';
import { cn } from '@/lib/utils';

const PasswordInput = forwardRef(({ className, ...props }, ref) => {
  const [visible, setVisible] = useState(false);

  return (
    <View className="relative">
      <TextInput
        ref={ref}
        secureTextEntry={!visible}
        className={cn(
          'h-12 w-full rounded-md border border-input bg-background px-3 pr-12 text-sm text-foreground',
          className
        )}
        placeholderTextColor="hsl(150, 10%, 45%)"
        {...props}
      />
      <Pressable
        onPress={() => setVisible((v) => !v)}
        className="absolute right-3 top-0 h-12 justify-center"
        hitSlop={8}
      >
        {visible ? (
          <EyeOff size={18} color="hsl(150, 10%, 45%)" />
        ) : (
          <Eye size={18} color="hsl(150, 10%, 45%)" />
        )}
      </Pressable>
    </View>
  );
});

PasswordInput.displayName = 'PasswordInput';

export default PasswordInput;
