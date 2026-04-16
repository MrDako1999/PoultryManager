import { View, Text, ScrollView, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, HardHat, Phone, CreditCard, Globe } from 'lucide-react-native';
import useThemeStore from '@/stores/themeStore';
import useLocalRecord from '@/hooks/useLocalRecord';
import useSettings from '@/hooks/useSettings';
import Separator from '@/components/ui/Separator';
import { Section, Row, fmtDate, fmt } from '@/components/details/shared';
import { SkeletonDetailPage } from '@/components/skeletons';

export default function WorkerScreen() {
  const { id } = useLocalSearchParams();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { resolvedTheme } = useThemeStore();
  const iconColor = resolvedTheme === 'dark' ? '#e0e8e0' : '#1a2e1a';
  const mutedColor = 'hsl(150, 10%, 45%)';

  const [worker, workerLoading] = useLocalRecord('workers', id);
  const accounting = useSettings('accounting');
  const currency = accounting?.currency || 'AED';

  if (workerLoading || !worker) {
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

  const initials = `${worker.firstName?.[0] || ''}${worker.lastName?.[0] || ''}`;

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <View className="px-4 pt-2 pb-1 flex-row items-center gap-3">
        <Pressable onPress={() => router.back()} className="h-9 w-9 items-center justify-center rounded-md" hitSlop={8}>
          <ArrowLeft size={20} color={iconColor} />
        </Pressable>
      </View>

      <ScrollView className="flex-1" contentContainerClassName="px-4 py-4 gap-4" contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}>
        <View className="items-center gap-2 py-4">
          <View className="h-16 w-16 rounded-full bg-muted items-center justify-center">
            <Text className="text-2xl font-bold text-muted-foreground">{initials}</Text>
          </View>
          <Text className="text-lg font-semibold text-foreground">
            {worker.firstName} {worker.lastName}
          </Text>
          {worker.role && (
            <Text className="text-sm text-muted-foreground">
              {t(`workers.workerRoles.${worker.role}`, worker.role)}
            </Text>
          )}
        </View>

        <Section>
          <View className="px-3 py-2.5 gap-0.5">
            {worker.role && (
              <Row label={t('workers.role')} value={t(`workers.workerRoles.${worker.role}`, worker.role)} />
            )}
            {worker.compensation > 0 && (
              <Row label={t('workers.compensation')} value={`${currency} ${fmt(worker.compensation)}`} />
            )}
            {worker.phone && <Row label={t('workers.phone')} value={worker.phone} />}
          </View>
        </Section>

        {(worker.emiratesIdNumber || worker.passportNumber) && (
          <Section>
            <View className="px-3 py-2.5 gap-0.5">
              {worker.emiratesIdNumber && (
                <Row label={t('workers.emiratesIdNumber')} value={worker.emiratesIdNumber} />
              )}
              {worker.emiratesIdExpiry && (
                <Row label={t('workers.emiratesIdExpiry')} value={fmtDate(worker.emiratesIdExpiry)} />
              )}
              {worker.passportNumber && (
                <Row label={t('workers.passportNumber')} value={worker.passportNumber} />
              )}
              {worker.passportCountry && (
                <Row label={t('workers.passportCountry')} value={worker.passportCountry} />
              )}
              {worker.passportExpiry && (
                <Row label={t('workers.passportExpiry')} value={fmtDate(worker.passportExpiry)} />
              )}
            </View>
          </Section>
        )}

        <Text className="text-xs text-muted-foreground text-center pt-2">
          Created {fmtDate(worker.createdAt)}
        </Text>
      </ScrollView>
    </View>
  );
}
