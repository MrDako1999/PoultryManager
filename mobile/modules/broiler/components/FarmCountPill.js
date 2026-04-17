import { View, Text, Pressable } from 'react-native';
import { ArrowUpRight } from 'lucide-react-native';

const MUTED = 'hsl(150, 10%, 45%)';

export default function FarmCountPill({ count, link = false, onLinkPress }) {
  return (
    <View className="flex-row items-center rounded-full border border-border bg-background/80">
      <Text className="px-2 py-0.5 text-[11px] font-semibold text-muted-foreground tabular-nums">
        {count}
      </Text>
      {link && (
        <>
          <View className="w-px self-stretch bg-border" />
          <Pressable
            onPress={onLinkPress}
            hitSlop={10}
            className="px-2 py-1 rounded-r-full active:bg-muted/60"
          >
            <ArrowUpRight size={12} color={MUTED} />
          </Pressable>
        </>
      )}
    </View>
  );
}
