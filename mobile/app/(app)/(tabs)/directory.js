import { View, Text, ScrollView, Pressable, RefreshControl, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import { Warehouse, Building2, ContactRound, Users, Wheat } from 'lucide-react-native';
import useLocalQuery from '@/hooks/useLocalQuery';
import useThemeStore from '@/stores/themeStore';
import { deltaSync } from '@/lib/syncEngine';
import { useState } from 'react';

const GAP = 12;
const PAD = 16;

function CategoryCard({ icon: Icon, label, count, onPress, primaryColor, width }) {
  return (
    <Pressable
      onPress={onPress}
      className="bg-card rounded-2xl border border-border active:opacity-70"
      style={{ width, paddingVertical: 28 }}
    >
      <View className="items-center">
        <Icon size={30} color={primaryColor} strokeWidth={1.6} />
        <Text className="text-[15px] font-semibold text-foreground mt-3">{label}</Text>
        <Text className="text-sm text-muted-foreground mt-1">{count}</Text>
      </View>
    </Pressable>
  );
}

export default function DirectoryScreen() {
  const { t } = useTranslation();
  const { resolvedTheme } = useThemeStore();
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);
  const { width: screenWidth } = useWindowDimensions();

  const [farms] = useLocalQuery('farms');
  const [businesses] = useLocalQuery('businesses');
  const [contacts] = useLocalQuery('contacts');
  const [workers] = useLocalQuery('workers');
  const [feedItems] = useLocalQuery('feedItems');

  const primaryColor = resolvedTheme === 'dark' ? 'hsl(148, 48%, 38%)' : 'hsl(148, 60%, 20%)';

  const onRefresh = async () => {
    setRefreshing(true);
    try { await deltaSync(); } catch (e) { console.error(e); }
    setRefreshing(false);
  };

  const cardWidth = Math.floor((screenWidth - PAD * 2 - GAP) / 2);

  const categories = [
    { icon: Warehouse, label: t('nav.farms', 'Farms'), count: farms.length, route: '/(app)/farms-list' },
    { icon: Building2, label: t('nav.businesses', 'Businesses'), count: businesses.length, route: '/(app)/businesses-list' },
    { icon: ContactRound, label: t('nav.contacts', 'Contacts'), count: contacts.length, route: '/(app)/contacts-list' },
    { icon: Users, label: t('nav.workers', 'Workers'), count: workers.length, route: '/(app)/workers-list' },
    { icon: Wheat, label: t('nav.feedCatalogue', 'Feed Catalogue'), count: feedItems.length, route: '/(app)/feed-catalogue' },
  ];

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <View className="px-4 pt-2 pb-4">
        <Text className="text-xl font-bold text-foreground">{t('nav.directory', 'Directory')}</Text>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: PAD, paddingBottom: insets.bottom + 16 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={primaryColor} />}
      >
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: GAP }}>
          {categories.map((cat) => (
            <CategoryCard
              key={cat.route}
              icon={cat.icon}
              label={cat.label}
              count={cat.count}
              primaryColor={primaryColor}
              width={cardWidth}
              onPress={() => router.push(cat.route)}
            />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
