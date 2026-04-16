import { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import { Layers, ArrowRight, Plus } from 'lucide-react-native';
import useLocalQuery from '@/hooks/useLocalQuery';
import useThemeStore from '@/stores/themeStore';
import useCapabilities from '@/hooks/useCapabilities';
import EmptyState from '@/components/ui/EmptyState';
import BatchSheet from '@/modules/broiler/sheets/BatchSheet';

export default function BroilerRecentBatches() {
  const { t } = useTranslation();
  const { resolvedTheme } = useThemeStore();
  const { can } = useCapabilities();
  const [batchSheet, setBatchSheet] = useState({ open: false, data: null });

  const [batches] = useLocalQuery('batches');
  const primaryColor = resolvedTheme === 'dark' ? 'hsl(148, 48%, 38%)' : 'hsl(148, 60%, 20%)';
  const canCreate = can('batch:create');

  if (batches.length === 0) {
    return (
      <EmptyState
        icon={Layers}
        title={t('dashboard.noData')}
        description={t('dashboard.noDataDesc')}
        actionLabel={canCreate ? t('dashboard.createFirstBatch') : undefined}
        onAction={canCreate ? () => setBatchSheet({ open: true, data: null }) : undefined}
      />
    );
  }

  return (
    <View>
      <View className="flex-row items-center justify-between mb-3">
        <Text className="text-base font-semibold text-foreground">{t('nav.batches')}</Text>
        <Pressable onPress={() => router.push('/(app)/(tabs)/batches')} className="flex-row items-center">
          <Text className="text-xs text-primary font-medium mr-1">{t('common.viewAll', 'View All')}</Text>
          <ArrowRight size={12} color={primaryColor} />
        </Pressable>
      </View>
      {batches.slice(0, 5).map((batch) => (
        <Pressable
          key={batch._id}
          onPress={() => router.push(`/(app)/batch/${batch._id}`)}
          className="flex-row items-center rounded-lg border border-border bg-card p-3 mb-2 active:bg-accent/50"
        >
          <View className="h-9 w-9 rounded-md bg-primary/10 items-center justify-center mr-3">
            <Layers size={18} color={primaryColor} />
          </View>
          <View className="flex-1 min-w-0">
            <Text className="text-sm font-medium text-foreground" numberOfLines={1}>{batch.batchName}</Text>
            <Text className="text-xs text-muted-foreground" numberOfLines={1}>
              {batch.farm?.farmName || ''} · {batch.status}
            </Text>
          </View>
          <View className="items-end">
            <Text className="text-xs text-muted-foreground">
              {(batch.houses || []).reduce((s, h) => s + (h.quantity || 0), 0).toLocaleString()} birds
            </Text>
          </View>
        </Pressable>
      ))}

      {canCreate && (
        <View className="flex-row gap-2 mt-4">
          <Pressable
            onPress={() => setBatchSheet({ open: true, data: null })}
            className="flex-1 flex-row items-center justify-center rounded-lg border border-primary/20 bg-primary/5 py-3"
          >
            <Plus size={16} color={primaryColor} />
            <Text className="text-sm font-medium text-primary ml-1.5">{t('batches.addBatch', 'New Batch')}</Text>
          </Pressable>
        </View>
      )}

      <BatchSheet
        open={batchSheet.open}
        onClose={() => setBatchSheet({ open: false, data: null })}
        editData={batchSheet.data}
      />
    </View>
  );
}
