import { useRef } from 'react';
import { View, Text, Pressable } from 'react-native';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import { ChevronRight, Pencil, Trash2 } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import BatchAvatar from './BatchAvatar';

const MUTED = 'hsl(150, 10%, 45%)';
const ACTION_WIDTH = 76;

function ActionButton({ onPress, icon: Icon, label, bgClass }) {
  return (
    <Pressable
      onPress={onPress}
      className={`${bgClass} items-center justify-center active:opacity-80`}
      style={{ width: ACTION_WIDTH }}
    >
      <Icon size={20} color="#ffffff" strokeWidth={2.2} />
      <Text className="text-[11px] font-semibold text-white mt-1">{label}</Text>
    </Pressable>
  );
}

export default function BatchRow({
  batch,
  status,
  avatarLetter,
  batchNum,
  displayName,
  daySubline,
  cycleProgress,
  onPress,
  onEdit,
  onDelete,
  isLast = false,
}) {
  const ref = useRef(null);

  const close = () => ref.current?.close?.();

  const handleEdit = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    close();
    setTimeout(() => onEdit?.(batch), 150);
  };

  const handleDelete = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    close();
    setTimeout(() => onDelete?.(batch), 150);
  };

  const handlePress = () => {
    Haptics.selectionAsync().catch(() => {});
    onPress?.(batch);
  };

  const renderRightActions = () => (
    <View className="flex-row">
      <ActionButton
        onPress={handleEdit}
        icon={Pencil}
        label="Edit"
        bgClass="bg-amber-500"
      />
      <ActionButton
        onPress={handleDelete}
        icon={Trash2}
        label="Delete"
        bgClass="bg-destructive"
      />
    </View>
  );

  return (
    <Swipeable
      ref={ref}
      friction={2}
      rightThreshold={40}
      overshootRight={false}
      renderRightActions={renderRightActions}
    >
      <Pressable
        onPress={handlePress}
        className={`flex-row items-center gap-3 px-4 bg-card active:bg-accent/40 ${isLast ? '' : 'border-b border-border'}`}
        style={{ minHeight: 68, paddingVertical: 12 }}
      >
        <BatchAvatar
          letter={avatarLetter}
          sequence={batchNum}
          status={status}
          size={44}
        />
        <View className="flex-1 min-w-0">
          <Text
            className="text-[14px] font-medium text-foreground"
            numberOfLines={1}
          >
            {displayName}
          </Text>
          {cycleProgress ? (
            <View className="mt-1.5">
              <View className="flex-row items-center justify-between mb-0.5">
                <Text className="text-[10px] text-muted-foreground tabular-nums">
                  {cycleProgress.label}
                </Text>
                <Text className="text-[10px] font-medium text-muted-foreground tabular-nums">
                  {Math.round(cycleProgress.pct)}%
                </Text>
              </View>
              <View className="h-1 rounded-full bg-muted overflow-hidden">
                <View
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${cycleProgress.pct}%` }}
                />
              </View>
            </View>
          ) : daySubline ? (
            <Text className="text-[12px] text-muted-foreground tabular-nums mt-0.5">
              {daySubline}
            </Text>
          ) : null}
        </View>
        <ChevronRight size={18} color={MUTED} />
      </Pressable>
    </Swipeable>
  );
}
