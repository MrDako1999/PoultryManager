import { View, Text, ScrollView, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Mail, Phone, Briefcase, Building2 } from 'lucide-react-native';
import useThemeStore from '../../../stores/themeStore';
import useLocalRecord from '../../../hooks/useLocalRecord';
import Separator from '../../../components/ui/Separator';
import { Section, Row, fmtDate } from '../../../components/details/shared';
import { SkeletonDetailPage } from '../../../components/skeletons';

export default function ContactScreen() {
  const { id } = useLocalSearchParams();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { resolvedTheme } = useThemeStore();
  const iconColor = resolvedTheme === 'dark' ? '#e0e8e0' : '#1a2e1a';
  const primaryColor = resolvedTheme === 'dark' ? 'hsl(148, 48%, 38%)' : 'hsl(148, 60%, 20%)';
  const mutedColor = 'hsl(150, 10%, 45%)';

  const [contact, contactLoading] = useLocalRecord('contacts', id);

  if (contactLoading || !contact) {
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

  const businesses = contact.businesses || [];
  const initials = `${contact.firstName?.[0] || ''}${contact.lastName?.[0] || ''}`;

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <View className="px-4 pt-2 pb-1 flex-row items-center gap-3">
        <Pressable onPress={() => router.back()} className="h-9 w-9 items-center justify-center rounded-md" hitSlop={8}>
          <ArrowLeft size={20} color={iconColor} />
        </Pressable>
      </View>

      <ScrollView className="flex-1" contentContainerClassName="px-4 py-4 gap-4" contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}>
        <View className="items-center gap-2 py-4">
          <View className="h-16 w-16 rounded-full bg-primary/10 items-center justify-center">
            <Text className="text-2xl font-bold text-primary">{initials}</Text>
          </View>
          <Text className="text-lg font-semibold text-foreground">
            {contact.firstName} {contact.lastName}
          </Text>
          {contact.jobTitle && <Text className="text-sm text-muted-foreground">{contact.jobTitle}</Text>}
        </View>

        <Section>
          <View className="px-3 py-2.5 gap-2">
            {contact.email && (
              <View className="flex-row items-center gap-2">
                <Mail size={14} color={mutedColor} />
                <Text className="text-sm text-foreground flex-1">{contact.email}</Text>
              </View>
            )}
            {contact.phone && (
              <View className="flex-row items-center gap-2">
                <Phone size={14} color={mutedColor} />
                <Text className="text-sm text-foreground flex-1">{contact.phone}</Text>
              </View>
            )}
            {contact.jobTitle && (
              <View className="flex-row items-center gap-2">
                <Briefcase size={14} color={mutedColor} />
                <Text className="text-sm text-foreground flex-1">{contact.jobTitle}</Text>
              </View>
            )}
          </View>
        </Section>

        {businesses.length > 0 && (
          <View>
            <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              {t('contacts.associatedBusinesses')}
            </Text>
            {businesses.map((biz) => {
              const bizId = typeof biz === 'object' ? biz._id : biz;
              const bizName = typeof biz === 'object' ? biz.companyName : biz;
              return (
                <Pressable
                  key={bizId}
                  onPress={() => router.push(`/(app)/business/${bizId}`)}
                  className="flex-row items-center gap-3 rounded-lg border border-border px-3 py-2.5 mb-2 active:bg-accent/50"
                >
                  <View className="h-8 w-8 rounded-md bg-primary/10 items-center justify-center">
                    <Building2 size={14} color={primaryColor} />
                  </View>
                  <Text className="text-sm font-medium text-foreground flex-1" numberOfLines={1}>{bizName}</Text>
                </Pressable>
              );
            })}
          </View>
        )}

        {contact.notes && (
          <View className="rounded-lg bg-muted/30 border border-border px-3 py-2.5">
            <Text className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
              {t('contacts.notes')}
            </Text>
            <Text className="text-sm text-foreground">{contact.notes}</Text>
          </View>
        )}

        <Text className="text-xs text-muted-foreground text-center pt-2">
          Created {fmtDate(contact.createdAt)}
        </Text>
      </ScrollView>
    </View>
  );
}
