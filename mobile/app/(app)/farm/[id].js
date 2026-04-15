import { View, Text, ScrollView, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Warehouse, Home, Building2 } from 'lucide-react-native';
import useThemeStore from '../../../stores/themeStore';
import useLocalRecord from '../../../hooks/useLocalRecord';
import useLocalQuery from '../../../hooks/useLocalQuery';
import { Badge } from '../../../components/ui/Badge';
import Separator from '../../../components/ui/Separator';
import { Section, Row, PartyCard, fmtDate } from '../../../components/details/shared';
import { SkeletonDetailPage } from '../../../components/skeletons';

export default function FarmScreen() {
  const { id } = useLocalSearchParams();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { resolvedTheme } = useThemeStore();
  const iconColor = resolvedTheme === 'dark' ? '#e0e8e0' : '#1a2e1a';
  const primaryColor = resolvedTheme === 'dark' ? 'hsl(148, 48%, 38%)' : 'hsl(148, 60%, 20%)';
  const mutedColor = 'hsl(150, 10%, 45%)';

  const [farm, farmLoading] = useLocalRecord('farms', id);
  const [houses] = useLocalQuery('houses', { farm: id });

  if (farmLoading || !farm) {
    return (
      <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
        <View className="px-4 pt-2 pb-1 flex-row items-center">
          <Pressable onPress={() => router.back()} className="h-9 w-9 items-center justify-center rounded-md" hitSlop={8}>
            <ArrowLeft size={20} color={iconColor} />
          </Pressable>
        </View>
        <SkeletonDetailPage />
      </View>
    );
  }

  const totalCapacity = houses.reduce((s, h) => s + (h.capacity || 0), 0);
  const businessName = typeof farm.business === 'object' ? farm.business?.companyName : null;
  const businessId = typeof farm.business === 'object' ? farm.business?._id : farm.business;

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <View className="px-4 pt-2 pb-1 flex-row items-center gap-3">
        <Pressable onPress={() => router.back()} className="h-9 w-9 items-center justify-center rounded-md" hitSlop={8}>
          <ArrowLeft size={20} color={iconColor} />
        </Pressable>
        <View className="flex-1 min-w-0">
          <Text className="text-lg font-bold text-foreground" numberOfLines={1}>{farm.farmName}</Text>
          {farm.nickname && <Text className="text-xs text-muted-foreground">{farm.nickname}</Text>}
        </View>
      </View>

      <Separator className="mt-2" />

      <ScrollView className="flex-1" contentContainerClassName="px-4 py-4 gap-4" contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}>
        <Section>
          <View className="px-3 py-2.5 gap-0.5">
            <Row label={t('farms.farmName')} value={farm.farmName} />
            {farm.nickname && <Row label={t('farms.nickname')} value={farm.nickname} />}
            {farm.farmType && (
              <Row label={t('farms.farmType')} value={t(`farms.farmTypes.${farm.farmType}`, farm.farmType)} />
            )}
          </View>
        </Section>

        {businessName && (
          <Pressable onPress={() => { if (businessId) router.push(`/(app)/business/${businessId}`); }}>
            <PartyCard label={t('farms.linkedBusiness')} name={businessName} onPress />
          </Pressable>
        )}

        {houses.length > 0 && (
          <View>
            <View className="flex-row items-center gap-2 mb-2">
              <Home size={14} color={mutedColor} />
              <Text className="text-sm font-medium text-foreground">{t('farms.houses')}</Text>
              <Text className="text-xs text-muted-foreground">
                ({totalCapacity.toLocaleString()} {t('farms.birds', 'capacity')})
              </Text>
            </View>
            <View className="gap-2">
              {houses.map((house) => (
                <View key={house._id} className="flex-row items-center gap-3 rounded-lg border border-border px-3 py-2.5">
                  <View className="h-8 w-8 rounded-md bg-primary/10 items-center justify-center">
                    <Home size={14} color={primaryColor} />
                  </View>
                  <View className="flex-1">
                    <Text className="text-sm font-medium text-foreground">{house.name}</Text>
                    {house.capacity > 0 && (
                      <Text className="text-xs text-muted-foreground">
                        {house.capacity.toLocaleString()} {t('farms.birds')}
                      </Text>
                    )}
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        <Text className="text-xs text-muted-foreground text-center pt-2">
          Created {fmtDate(farm.createdAt)}
        </Text>
      </ScrollView>
    </View>
  );
}
