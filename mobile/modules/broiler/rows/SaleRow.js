import { View, Text, Pressable } from 'react-native';
import { Truck } from 'lucide-react-native';
import { Badge } from '@/components/ui/Badge';

const fmt = (val) =>
  Number(val || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function SaleRow({ sale, onClick, t }) {
  const chickens = sale.saleMethod === 'SLAUGHTERED'
    ? (sale.counts?.chickensSent || 0)
    : (sale.live?.birdCount || 0);
  const trucks = sale.transport?.truckCount || 0;

  return (
    <Pressable onPress={onClick} className="flex-row items-center px-3 py-2.5 border-b border-border active:bg-accent/50">
      <View className="flex-1 min-w-0">
        <View className="flex-row items-center gap-1.5">
          <Text className="text-sm font-medium text-foreground" numberOfLines={1}>
            {sale.customer?.companyName || 'Unknown Customer'}
          </Text>
        </View>
        <View className="flex-row items-center gap-1.5 mt-0.5">
          <Badge variant="secondary" className="px-1 py-0">
            <Text className="text-[9px] font-medium text-muted-foreground">
              {sale.saleMethod || 'SALE'}
            </Text>
          </Badge>
          {sale.saleNumber && (
            <Text className="text-xs text-muted-foreground" numberOfLines={1}>{sale.saleNumber}</Text>
          )}
        </View>
      </View>
      <View className="items-end ml-2">
        <Text className="text-sm font-medium text-foreground">{fmt(sale.totals?.grandTotal)}</Text>
        <View className="flex-row items-center gap-2">
          {chickens > 0 && (
            <Text className="text-[10px] text-muted-foreground">{chickens.toLocaleString()} birds</Text>
          )}
          {trucks > 0 && (
            <View className="flex-row items-center gap-0.5">
              <Truck size={10} color="hsl(150, 10%, 45%)" />
              <Text className="text-[10px] text-muted-foreground">{trucks}</Text>
            </View>
          )}
        </View>
      </View>
    </Pressable>
  );
}
