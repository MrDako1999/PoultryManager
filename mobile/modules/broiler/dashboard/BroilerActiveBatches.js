import { useState, useMemo } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import { Layers, Bird, Skull, Wheat, Calendar, Warehouse } from 'lucide-react-native';
import useLocalQuery from '@/hooks/useLocalQuery';
import useCapabilities from '@/hooks/useCapabilities';
import EmptyState from '@/components/ui/EmptyState';
import BatchSheet from '@/modules/broiler/sheets/BatchSheet';
import BatchAvatar from '@/modules/broiler/components/BatchAvatar';
import { getStatusConfig } from '@/modules/broiler/lib/batchStatusConfig';

const MUTED = 'hsl(150, 10%, 45%)';

const IN_PROGRESS_STATUS = getStatusConfig('IN_PROGRESS');

function MiniStat({ icon: Icon, label, value }) {
  return (
    <View className="flex-row items-center gap-1.5 flex-1 min-w-0">
      <Icon size={14} color={MUTED} />
      <View className="flex-1 min-w-0">
        <Text className="text-[10px] text-muted-foreground leading-none" numberOfLines={1}>
          {label}
        </Text>
        <Text className="text-sm font-semibold text-foreground tabular-nums mt-0.5" numberOfLines={1}>
          {value}
        </Text>
      </View>
    </View>
  );
}

export default function BroilerActiveBatches() {
  const { t } = useTranslation();
  const { can } = useCapabilities();
  const canCreate = can('batch:create');
  const [batchSheet, setBatchSheet] = useState({ open: false, data: null });

  const [batches] = useLocalQuery('batches');
  const [dailyLogs] = useLocalQuery('dailyLogs');

  const activeBatches = useMemo(
    () => batches.filter((b) => b.status === 'IN_PROGRESS'),
    [batches]
  );

  const batchCards = useMemo(() => {
    const activeBatchIds = new Set(activeBatches.map((b) => b._id));
    const deathsByBatch = {};
    const feedByBatch = {};

    dailyLogs.forEach((log) => {
      const batchId = typeof log.batch === 'object' ? log.batch?._id : log.batch;
      if (!activeBatchIds.has(batchId)) return;
      if (log.deaths) deathsByBatch[batchId] = (deathsByBatch[batchId] || 0) + log.deaths;
      if (log.feedKg) feedByBatch[batchId] = (feedByBatch[batchId] || 0) + log.feedKg;
    });

    return activeBatches.map((b) => {
      const initial = (b.houses || []).reduce((s, h) => s + (h.quantity || 0), 0);
      const deaths = deathsByBatch[b._id] || 0;
      const remaining = initial - deaths;
      const mortality = initial > 0 ? ((deaths / initial) * 100).toFixed(1) : '0.0';
      const feed = feedByBatch[b._id] || 0;
      const dayCount = b.startDate
        ? Math.max(0, Math.floor((Date.now() - new Date(b.startDate)) / 86400000))
        : 0;
      const farm = b.farm;
      const avatarLetter = (farm?.nickname || farm?.farmName || b.batchName || '?')[0].toUpperCase();
      const batchNum = b.sequenceNumber ?? '';
      return {
        _id: b._id,
        batchName: b.batchName,
        farmName: farm?.farmName || farm?.nickname || '',
        avatarLetter,
        batchNum,
        dayCount,
        remaining,
        mortality,
        feed,
      };
    });
  }, [activeBatches, dailyLogs]);

  if (batchCards.length === 0) {
    return (
      <View>
        <Text className="text-base font-semibold text-foreground mb-3">
          {t('dashboard.activeBatchesTitle')}
        </Text>
        <EmptyState
          icon={Layers}
          title={t('dashboard.noActiveBatches')}
          description={t('dashboard.noActiveBatchesDesc')}
          actionLabel={canCreate ? t('dashboard.createFirstBatch') : undefined}
          onAction={canCreate ? () => setBatchSheet({ open: true, data: null }) : undefined}
        />
        <BatchSheet
          open={batchSheet.open}
          onClose={() => setBatchSheet({ open: false, data: null })}
          editData={batchSheet.data}
        />
      </View>
    );
  }

  return (
    <View>
      <Text className="text-base font-semibold text-foreground mb-3">
        {t('dashboard.activeBatchesTitle')}
      </Text>

      <View className="gap-2">
        {batchCards.map((b) => (
          <Pressable
            key={b._id}
            onPress={() => router.push(`/(app)/batch/${b._id}`)}
            className="rounded-lg border border-border bg-card px-3 py-3 active:bg-accent/40"
            style={{ minHeight: 96 }}
          >
            <View className="flex-row items-start justify-between mb-3 gap-2">
              <View className="flex-row items-start gap-3 flex-1 min-w-0">
                <BatchAvatar
                  letter={b.avatarLetter}
                  sequence={b.batchNum}
                  status={IN_PROGRESS_STATUS}
                  size={40}
                />
                <View className="flex-1 min-w-0">
                  <Text className="text-sm font-semibold text-foreground" numberOfLines={1}>
                    {b.batchName}
                  </Text>
                  {!!b.farmName && (
                    <View className="flex-row items-center gap-1 mt-0.5">
                      <Warehouse size={11} color={MUTED} />
                      <Text className="text-xs text-muted-foreground" numberOfLines={1}>
                        {b.farmName}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
              <View className="flex-row items-center gap-1 rounded-full border border-border px-2 py-0.5">
                <Calendar size={11} color={MUTED} />
                <Text className="text-[11px] font-medium text-foreground tabular-nums">
                  {t('dashboard.dayN', { n: b.dayCount })}
                </Text>
              </View>
            </View>

            <View className="flex-row gap-2">
              <MiniStat icon={Bird} label={t('dashboard.birds')} value={b.remaining.toLocaleString()} />
              <MiniStat icon={Skull} label={t('dashboard.mortality')} value={`${b.mortality}%`} />
              <MiniStat icon={Wheat} label={t('dashboard.feedConsumed')} value={`${b.feed.toLocaleString()} kg`} />
            </View>
          </Pressable>
        ))}
      </View>

      <BatchSheet
        open={batchSheet.open}
        onClose={() => setBatchSheet({ open: false, data: null })}
        editData={batchSheet.data}
      />
    </View>
  );
}
