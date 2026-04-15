import { useState } from 'react';
import { View, Text, ScrollView, Pressable, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import { Building2, ChevronLeft, ChevronRight } from 'lucide-react-native';
import useLocalQuery from '../../hooks/useLocalQuery';
import useThemeStore from '../../stores/themeStore';
import SearchInput from '../../components/ui/SearchInput';
import EmptyState from '../../components/ui/EmptyState';
import { SkeletonRow } from '../../components/skeletons';
import { deltaSync } from '../../lib/syncEngine';

export default function BusinessesListScreen() {
  const { t } = useTranslation();
  const { resolvedTheme } = useThemeStore();
  const insets = useSafeAreaInsets();
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const [businesses, businessesLoading] = useLocalQuery('businesses');
  const primaryColor = resolvedTheme === 'dark' ? 'hsl(148, 48%, 38%)' : 'hsl(148, 60%, 20%)';
  const mutedColor = 'hsl(150, 10%, 45%)';

  const onRefresh = async () => {
    setRefreshing(true);
    try { await deltaSync(); } catch (e) { console.error(e); }
    setRefreshing(false);
  };

  const q = searchQuery.toLowerCase();
  const filtered = q ? businesses.filter((b) => b.companyName?.toLowerCase().includes(q)) : businesses;

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <View className="flex-row items-center px-2 pt-2 pb-3">
        <Pressable onPress={() => router.back()} className="p-2 -ml-1 active:opacity-60">
          <ChevronLeft size={24} color={primaryColor} />
        </Pressable>
        <Text className="text-xl font-bold text-foreground flex-1">
          {t('nav.businesses', 'Businesses')}
        </Text>
        <Text className="text-sm text-muted-foreground mr-2">{businesses.length}</Text>
      </View>

      <View className="px-4 pb-3">
        <SearchInput value={searchQuery} onChangeText={setSearchQuery} placeholder={t('common.search', 'Search...')} />
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={primaryColor} />}
      >
        {businessesLoading && businesses.length === 0 ? (
          <View>{[1,2,3,4,5,6].map(i => <SkeletonRow key={i} />)}</View>
        ) : filtered.length === 0 ? (
          <EmptyState
            title={searchQuery ? t('common.noResults', 'No results') : t('businesses.noBusinesses', 'No businesses')}
            description={!searchQuery ? t('businesses.noBusinessesDesc', 'Sync your data to see businesses here.') : undefined}
          />
        ) : (
          filtered.map((biz) => (
            <Pressable
              key={biz._id}
              onPress={() => router.push(`/(app)/business/${biz._id}`)}
              className="flex-row items-center px-4 py-3 border-b border-border active:bg-accent/50"
            >
              <View className="h-10 w-10 rounded-xl bg-primary/10 items-center justify-center mr-3">
                <Building2 size={18} color={primaryColor} />
              </View>
              <View className="flex-1 min-w-0">
                <Text className="text-sm font-medium text-foreground" numberOfLines={1}>{biz.companyName}</Text>
                {biz.businessType && <Text className="text-xs text-muted-foreground mt-0.5">{biz.businessType}</Text>}
              </View>
              <ChevronRight size={16} color={mutedColor} />
            </Pressable>
          ))
        )}
      </ScrollView>
    </View>
  );
}
