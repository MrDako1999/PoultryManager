import { View, Text } from 'react-native';
import { cn } from '@/lib/utils';

export function Card({ className, children, ...props }) {
  return (
    <View
      className={cn('rounded-lg border border-border bg-card', className)}
      {...props}
    >
      {children}
    </View>
  );
}

export function CardHeader({ className, children, ...props }) {
  return (
    <View className={cn('p-4 pb-2', className)} {...props}>
      {children}
    </View>
  );
}

export function CardTitle({ className, children, ...props }) {
  return (
    <Text
      className={cn('text-xl font-semibold text-card-foreground', className)}
      {...props}
    >
      {children}
    </Text>
  );
}

export function CardDescription({ className, children, ...props }) {
  return (
    <Text
      className={cn('text-sm text-muted-foreground', className)}
      {...props}
    >
      {children}
    </Text>
  );
}

export function CardContent({ className, children, ...props }) {
  return (
    <View className={cn('p-4 pt-2', className)} {...props}>
      {children}
    </View>
  );
}

export function CardFooter({ className, children, ...props }) {
  return (
    <View className={cn('p-4 pt-2', className)} {...props}>
      {children}
    </View>
  );
}
