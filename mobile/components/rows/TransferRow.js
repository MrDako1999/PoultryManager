import { View, Text, Pressable } from 'react-native';

const fmt = (val) =>
  Number(val || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function TransferRow({ transfer, onClick }) {
  return (
    <Pressable onPress={onClick} className="flex-row items-center px-3 py-2.5 border-b border-border active:bg-accent/50">
      <View className="flex-1 min-w-0">
        <Text className="text-sm font-medium text-foreground" numberOfLines={1}>
          {transfer.transferType || 'Transfer'}
        </Text>
        <Text className="text-xs text-muted-foreground">
          {transfer.transferDate ? new Date(transfer.transferDate).toLocaleDateString() : '—'}
        </Text>
      </View>
      <Text className="text-sm font-medium text-foreground ml-2">{fmt(transfer.amount)}</Text>
    </Pressable>
  );
}
