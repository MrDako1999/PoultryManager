import { View, Text, Pressable } from 'react-native';
import { Calendar } from 'lucide-react-native';

export default function FeedItemRow({ item, onClick }) {
  const bags = item.bags || 0;
  const sizePerBag = item.quantitySize || 50;
  const totalKg = bags * sizePerBag;

  return (
    <Pressable onPress={onClick} className="flex-row items-center px-3 py-2.5 border-b border-border active:bg-accent/50">
      <View className="flex-1 min-w-0">
        <Text className="text-sm font-medium text-foreground" numberOfLines={1}>
          {item.feedDescription || item.companyName || 'Feed Item'}
        </Text>
        <View className="flex-row items-center gap-1">
          <Calendar size={11} color="hsl(150, 10%, 45%)" />
          <Text className="text-xs text-muted-foreground">
            {item.orderDate ? new Date(item.orderDate).toLocaleDateString() : '—'}
          </Text>
          {item.companyName && item.feedDescription && (
            <Text className="text-xs text-muted-foreground" numberOfLines={1}> · {item.companyName}</Text>
          )}
        </View>
      </View>
      <View className="items-end ml-2">
        <Text className="text-sm font-medium text-foreground">{totalKg.toLocaleString()} KG</Text>
        <Text className="text-[10px] text-muted-foreground">{bags} × {sizePerBag}KG</Text>
      </View>
    </Pressable>
  );
}
