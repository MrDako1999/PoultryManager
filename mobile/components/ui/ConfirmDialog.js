import { Modal, View, Text, Pressable } from 'react-native';
import { Button } from './Button';

export default function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  onConfirm,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  variant = 'destructive',
  isPending = false,
}) {
  if (!open) return null;

  return (
    <Modal transparent visible={open} animationType="fade" onRequestClose={() => onOpenChange(false)}>
      <Pressable
        className="flex-1 items-center justify-center bg-black/50"
        onPress={() => onOpenChange(false)}
      >
        <Pressable className="bg-card rounded-xl p-6 mx-8 w-full max-w-[320px] border border-border">
          {title && (
            <Text className="text-lg font-semibold text-foreground mb-2">{title}</Text>
          )}
          {description && (
            <Text className="text-sm text-muted-foreground mb-5">{description}</Text>
          )}
          <View className="flex-row gap-3 justify-end">
            <Button variant="outline" onPress={() => onOpenChange(false)} disabled={isPending}>
              {cancelLabel}
            </Button>
            <Button
              variant={variant}
              onPress={onConfirm}
              loading={isPending}
              disabled={isPending}
            >
              {confirmLabel}
            </Button>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
