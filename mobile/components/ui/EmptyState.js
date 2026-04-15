import { View, Text } from 'react-native';
import { Button } from './Button';

export default function EmptyState({ icon: Icon, title, description, actionLabel, onAction }) {
  return (
    <View className="flex-1 items-center justify-center py-16 px-6">
      {Icon && (
        <View className="rounded-full bg-muted p-5 mb-4">
          <Icon size={32} color="hsl(150, 10%, 45%)" />
        </View>
      )}
      {title && (
        <Text className="text-lg font-semibold text-foreground mb-1 text-center">{title}</Text>
      )}
      {description && (
        <Text className="text-sm text-muted-foreground mb-4 text-center max-w-[280px]">{description}</Text>
      )}
      {actionLabel && onAction && (
        <Button onPress={onAction}>{actionLabel}</Button>
      )}
    </View>
  );
}
