import { TextInput } from 'react-native';
import { cn } from '../../lib/utils';
import useThemeStore from '../../stores/themeStore';

export default function Textarea({ className, ...props }) {
  const { resolvedTheme } = useThemeStore();
  const textColor = resolvedTheme === 'dark' ? '#e0e8e0' : '#1a2e1a';

  return (
    <TextInput
      multiline
      textAlignVertical="top"
      className={cn(
        'min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm',
        className
      )}
      style={{ color: textColor, fontFamily: 'Poppins-Regular' }}
      placeholderTextColor="hsl(150, 10%, 45%)"
      {...props}
    />
  );
}
