import { View, Text, ScrollView, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Pencil, Home, User } from 'lucide-react-native';
import { Badge } from '../ui/Badge';
import Separator from '../ui/Separator';
import useLocalRecord from '../../hooks/useLocalRecord';
import { LOG_TYPE_ICONS } from '../../lib/constants';
import { fmtDate, fmtDateTime, Row, Section, DetailLoading, DocumentsSection } from './shared';

const TYPE_BADGE_VARIANTS = {
  DAILY: 'default',
  WEIGHT: 'secondary',
  ENVIRONMENT: 'outline',
};

function formatUserName(user) {
  if (!user) return '—';
  if (typeof user === 'object') return `${user.firstName || ''} ${user.lastName || ''}`.trim() || '—';
  return String(user);
}

export default function DailyLogDetail({ logId, onEdit }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [log] = useLocalRecord('dailyLogs', logId);

  if (!log) return <DetailLoading />;

  const TypeIcon = LOG_TYPE_ICONS[log.logType];
  const houseName = typeof log.house === 'object' ? log.house?.name : t('batches.house');

  const docGroups = [
    { key: 'photos', label: t('batches.operations.photo', 'Photo'), docs: log.photos },
  ];

  return (
    <View className="flex-1">
      <View className="px-4 pt-4 pb-3">
        <View className="flex-row items-start justify-between gap-3">
          <View className="flex-1 min-w-0 gap-1.5">
            <View className="flex-row items-center gap-1.5 flex-wrap">
              <Badge variant={TYPE_BADGE_VARIANTS[log.logType] || 'secondary'}>
                <View className="flex-row items-center gap-1">
                  {TypeIcon && <TypeIcon size={12} color="#fff" />}
                  <Text className="text-[10px] font-semibold uppercase tracking-wider text-primary-foreground">
                    {t(`batches.operations.logTypes.${log.logType}`)}
                  </Text>
                </View>
              </Badge>
              {log.cycleDay && (
                <Badge variant="outline">
                  <Text className="text-[10px] font-mono text-foreground">
                    {t('batches.operations.cycleDay', { day: log.cycleDay })}
                  </Text>
                </Badge>
              )}
            </View>
            <Text className="text-sm font-semibold text-foreground">{fmtDate(log.date)}</Text>
            <View className="flex-row items-center gap-1.5">
              <Home size={12} color="hsl(150, 10%, 45%)" />
              <Text className="text-xs text-muted-foreground">{houseName}</Text>
            </View>
          </View>
          <Pressable
            onPress={() => onEdit?.(log)}
            className="h-8 w-8 items-center justify-center rounded-md border border-border"
            hitSlop={8}
          >
            <Pencil size={16} color="hsl(150, 10%, 45%)" />
          </Pressable>
        </View>
      </View>

      <Separator />

      <ScrollView className="flex-1" contentContainerClassName="px-4 py-4 gap-4">
        {log.logType === 'DAILY' && (
          <Section>
            <View className="px-3 py-2.5 gap-0.5">
              <Row label={t('batches.operations.deaths')} value={log.deaths != null ? `${log.deaths} ${t('batches.operations.deathsUnit')}` : '—'} />
              <Row label={t('batches.operations.feedKg')} value={log.feedKg != null ? `${log.feedKg} kg` : '—'} />
              <Row label={t('batches.operations.waterLiters')} value={log.waterLiters != null ? `${log.waterLiters} L` : '—'} />
            </View>
          </Section>
        )}

        {log.logType === 'WEIGHT' && (
          <Section>
            <View className="px-3 py-2.5 gap-0.5">
              <Row
                label={t('batches.operations.averageWeight')}
                value={log.averageWeight != null ? `${log.averageWeight.toLocaleString()} g` : '—'}
                bold
              />
            </View>
          </Section>
        )}

        {log.logType === 'ENVIRONMENT' && (
          <Section>
            <View className="px-3 py-2.5 gap-0.5">
              <Row label={t('batches.operations.temperature')} value={log.temperature != null ? `${log.temperature}°C` : '—'} />
              <Row label={t('batches.operations.humidity')} value={log.humidity != null ? `${log.humidity}%` : '—'} />
              <Row label={t('batches.operations.waterTDS')} value={log.waterTDS != null ? `${log.waterTDS} ppm` : '—'} />
              <Row label={t('batches.operations.waterPH')} value={log.waterPH != null ? `${log.waterPH}` : '—'} />
            </View>
          </Section>
        )}

        {log.notes && (
          <View className="rounded-lg bg-muted/30 border border-border px-3 py-2.5">
            <Text className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
              {t('batches.operations.notes')}
            </Text>
            <Text className="text-sm text-foreground">{log.notes}</Text>
          </View>
        )}

        <Section>
          <View className="px-3 py-2.5 gap-2">
            <View className="flex-row items-center gap-2">
              <User size={12} color="hsl(150, 10%, 45%)" />
              <Text className="text-xs text-muted-foreground">{t('batches.operations.createdByLabel')}</Text>
              <Text className="text-sm text-foreground ml-auto">{formatUserName(log.createdBy)}</Text>
            </View>
            {log.updatedBy && (
              <View className="flex-row items-center gap-2">
                <User size={12} color="hsl(150, 10%, 45%)" />
                <Text className="text-xs text-muted-foreground">{t('batches.operations.updatedByLabel')}</Text>
                <Text className="text-sm text-foreground ml-auto">{formatUserName(log.updatedBy)}</Text>
              </View>
            )}
          </View>
        </Section>

        <DocumentsSection docGroups={docGroups} t={t} />

        <Text className="text-xs text-muted-foreground text-center pt-1 pb-2">
          {t('batches.operations.createdLabel', 'Created')} {fmtDateTime(log.createdAt)}
          {' · '}
          {t('batches.operations.updatedLabel', 'Last Updated')} {fmtDateTime(log.updatedAt)}
        </Text>
      </ScrollView>

      <View className="flex-row items-center justify-end pt-2 border-t border-border px-4" style={{ paddingBottom: Math.max(16, insets.bottom + 8) }}>
        <Pressable
          onPress={() => onEdit?.(log)}
          className="flex-row items-center rounded-lg bg-primary px-4 py-2.5"
        >
          <Pencil size={14} color="#fff" />
          <Text className="text-sm font-medium text-primary-foreground ml-2">{t('batches.operations.editEntry')}</Text>
        </Pressable>
      </View>
    </View>
  );
}
