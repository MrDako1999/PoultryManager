import { Text } from 'react-native';
import { cn } from '@/lib/utils';

export function Label({ className, children, ...props }) {
  return (
    <Text
      className={cn('text-sm font-medium text-foreground', className)}
      {...props}
    >
      {children}
    </Text>
  );
}
