import { View, Text } from 'react-native';
import { cva } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const badgeVariants = cva(
  'flex-row items-center rounded-md px-2 py-1',
  {
    variants: {
      variant: {
        default: 'bg-primary',
        secondary: 'bg-secondary',
        destructive: 'bg-destructive',
        outline: 'border border-border bg-background',
        muted: 'bg-muted',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

const textVariants = cva('text-xs font-medium', {
  variants: {
    variant: {
      default: 'text-primary-foreground',
      secondary: 'text-secondary-foreground',
      destructive: 'text-destructive-foreground',
      outline: 'text-foreground',
      muted: 'text-muted-foreground',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
});

export function Badge({ className, textClassName, variant, children, ...props }) {
  return (
    <View className={cn(badgeVariants({ variant }), className)} {...props}>
      {typeof children === 'string' ? (
        <Text className={cn(textVariants({ variant }), textClassName)}>{children}</Text>
      ) : (
        children
      )}
    </View>
  );
}
