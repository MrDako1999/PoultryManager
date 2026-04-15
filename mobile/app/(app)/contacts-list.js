import { useState } from 'react';
import { View, Text, ScrollView, Pressable, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import useLocalQuery from '../../hooks/useLocalQuery';
import useThemeStore from '../../stores/themeStore';
import SearchInput from '../../components/ui/SearchInput';
import EmptyState from '../../components/ui/EmptyState';
import { SkeletonRow } from '../../components/skeletons';
import { deltaSync } from '../../lib/syncEngine';

export default function ContactsListScreen() {
  const { t } = useTranslation();
  const { resolvedTheme } = useThemeStore();
  const insets = useSafeAreaInsets();
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const [contacts, contactsLoading] = useLocalQuery('contacts');
  const primaryColor = resolvedTheme === 'dark' ? 'hsl(148, 48%, 38%)' : 'hsl(148, 60%, 20%)';
  const mutedColor = 'hsl(150, 10%, 45%)';

  const onRefresh = async () => {
    setRefreshing(true);
    try { await deltaSync(); } catch (e) { console.error(e); }
    setRefreshing(false);
  };

  const q = searchQuery.toLowerCase();
  const filtered = q ? contacts.filter((c) => `${c.firstName} ${c.lastName}`.toLowerCase().includes(q)) : contacts;

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <View className="flex-row items-center px-2 pt-2 pb-3">
        <Pressable onPress={() => router.back()} className="p-2 -ml-1 active:opacity-60">
          <ChevronLeft size={24} color={primaryColor} />
        </Pressable>
        <Text className="text-xl font-bold text-foreground flex-1">
          {t('nav.contacts', 'Contacts')}
        </Text>
        <Text className="text-sm text-muted-foreground mr-2">{contacts.length}</Text>
      </View>

      <View className="px-4 pb-3">
        <SearchInput value={searchQuery} onChangeText={setSearchQuery} placeholder={t('common.search', 'Search...')} />
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={primaryColor} />}
      >
        {contactsLoading && contacts.length === 0 ? (
          <View>{[1,2,3,4,5,6].map(i => <SkeletonRow key={i} />)}</View>
        ) : filtered.length === 0 ? (
          <EmptyState
            title={searchQuery ? t('common.noResults', 'No results') : t('contacts.noContacts', 'No contacts')}
            description={!searchQuery ? t('contacts.noContactsDesc', 'Sync your data to see contacts here.') : undefined}
          />
        ) : (
          filtered.map((contact) => (
            <Pressable
              key={contact._id}
              onPress={() => router.push(`/(app)/contact/${contact._id}`)}
              className="flex-row items-center px-4 py-3 border-b border-border active:bg-accent/50"
            >
              <View className="h-10 w-10 rounded-full bg-muted items-center justify-center mr-3">
                <Text className="text-sm font-semibold text-muted-foreground">
                  {(contact.firstName?.[0] || '')}{(contact.lastName?.[0] || '')}
                </Text>
              </View>
              <View className="flex-1 min-w-0">
                <Text className="text-sm font-medium text-foreground" numberOfLines={1}>
                  {contact.firstName} {contact.lastName}
                </Text>
                {contact.phone && <Text className="text-xs text-muted-foreground mt-0.5">{contact.phone}</Text>}
              </View>
              <ChevronRight size={16} color={mutedColor} />
            </Pressable>
          ))
        )}
      </ScrollView>
    </View>
  );
}
