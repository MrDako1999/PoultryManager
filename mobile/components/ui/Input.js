import { forwardRef } from 'react';
import { TextInput } from 'react-native';
import { cn } from '@/lib/utils';

const Input = forwardRef(({ className, ...props }, ref) => {
  return (
    <TextInput
      ref={ref}
      className={cn(
        'h-12 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground',
        'placeholder:text-muted-foreground',
        props.editable === false && 'opacity-50',
        className
      )}
      placeholderTextColor="hsl(150, 10%, 45%)"
      {...props}
    />
  );
});

Input.displayName = 'Input';

export { Input };
