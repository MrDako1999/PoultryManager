import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Skeleton, { SkeletonText } from './ui/Skeleton';

export function SkeletonStatCard() {
  return (
    <View className="flex-1 rounded-lg border border-border bg-card p-3 min-w-[100px] gap-2">
      <SkeletonText width="55%" height={10} />
      <Skeleton width="70%" height={18} borderRadius={4} />
    </View>
  );
}

export function SkeletonRow() {
  return (
    <View className="flex-row items-center px-3 py-2.5 border-b border-border gap-3">
      <View className="flex-1 gap-1.5">
        <SkeletonText width="50%" height={13} />
        <SkeletonText width="35%" height={10} />
      </View>
      <Skeleton width={60} height={14} borderRadius={4} />
    </View>
  );
}

export function SkeletonSectionHeader() {
  return (
    <View className="rounded-lg border border-border bg-card overflow-hidden">
      <View className="flex-row items-center px-3 py-2.5 gap-2">
        <Skeleton width={16} height={16} borderRadius={3} />
        <SkeletonText width="40%" height={13} />
      </View>
      <SkeletonRow />
      <SkeletonRow />
    </View>
  );
}

export function SkeletonBatchDetail() {
  const insets = useSafeAreaInsets();
  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <View className="px-4 pt-2 pb-3 border-b border-border gap-3">
        <View className="flex-row items-center gap-3">
          <Skeleton width={36} height={36} borderRadius={8} />
          <View className="flex-1 gap-1.5">
            <View className="flex-row items-center gap-2">
              <Skeleton width="50%" height={18} borderRadius={4} />
              <Skeleton width={60} height={20} borderRadius={10} />
            </View>
            <SkeletonText width="35%" height={11} />
          </View>
        </View>
        <Skeleton width="100%" height={36} borderRadius={8} />
      </View>

      <View style={{ padding: 16, gap: 12 }}>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <SkeletonStatCard />
          <SkeletonStatCard />
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <SkeletonStatCard />
          <SkeletonStatCard />
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <SkeletonStatCard />
          <SkeletonStatCard />
        </View>
        <View style={{ marginTop: 4 }}>
          <SkeletonSectionHeader />
        </View>
        <SkeletonSectionHeader />
        <SkeletonSectionHeader />
      </View>
    </View>
  );
}

export function SkeletonDetailPage() {
  return (
    <View className="flex-1 py-4 px-4 gap-4">
      <View className="gap-2">
        <View className="flex-row items-center gap-2">
          <Skeleton width={60} height={22} borderRadius={10} />
          <Skeleton width={80} height={22} borderRadius={10} />
        </View>
        <Skeleton width="65%" height={16} borderRadius={4} />
        <SkeletonText width="40%" height={12} />
      </View>

      <View className="rounded-lg border border-border bg-card p-3 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <View key={i} className="flex-row items-center justify-between">
            <SkeletonText width="30%" height={11} />
            <Skeleton width="40%" height={13} borderRadius={4} />
          </View>
        ))}
      </View>

      <View className="rounded-lg border border-border bg-card p-3 gap-3">
        {[1, 2, 3].map((i) => (
          <View key={i} className="flex-row items-center justify-between">
            <SkeletonText width="35%" height={11} />
            <Skeleton width="30%" height={13} borderRadius={4} />
          </View>
        ))}
      </View>
    </View>
  );
}

export function SkeletonListScreen() {
  const insets = useSafeAreaInsets();
  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <View className="px-4 pt-2 pb-3 border-b border-border gap-3">
        <View className="flex-row items-center gap-3">
          <Skeleton width={24} height={24} borderRadius={4} />
          <Skeleton width="40%" height={18} borderRadius={4} />
        </View>
        <Skeleton width="100%" height={38} borderRadius={8} />
      </View>
      <View>
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <SkeletonRow key={i} />
        ))}
      </View>
    </View>
  );
}

export function SkeletonDashboardCards() {
  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <SkeletonStatCard />
        <SkeletonStatCard />
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <SkeletonStatCard />
        <SkeletonStatCard />
      </View>
    </View>
  );
}
