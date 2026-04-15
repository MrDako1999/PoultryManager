import { View, Text, Pressable } from 'react-native';
import { Calendar } from 'lucide-react-native';

const fmt = (val) =>
  Number(val || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function SourceRow({ source, onClick }) {
  return (
    <Pressable onPress={onClick} className="flex-row items-center px-3 py-2.5 border-b border-border active:bg-accent/50">
      <View className="flex-1 min-w-0">
        <Text className="text-sm font-medium text-foreground" numberOfLines={1}>
          {source.sourceFrom?.companyName || 'Unknown Supplier'}
        </Text>
        <View className="flex-row items-center gap-2">
          <View className="flex-row items-center gap-1">
            <Calendar size={11} color="hsl(150, 10%, 45%)" />
            <Text className="text-xs text-muted-foreground">
              {source.deliveryDate ? new Date(source.deliveryDate).toLocaleDateString() : '—'}
            </Text>
          </View>
          <Text className="text-xs text-muted-foreground">
            {(source.totalChicks || 0).toLocaleString()} chicks
          </Text>
        </View>
      </View>
      <Text className="text-sm font-medium text-foreground ml-2">{fmt(source.grandTotal)}</Text>
    </Pressable>
  );
}
