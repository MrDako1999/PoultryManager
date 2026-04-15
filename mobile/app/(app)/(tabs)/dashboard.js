import { useState, useMemo } from 'react';
import { View, Text, ScrollView, Pressable, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import { Layers, Egg, DollarSign, TrendingUp, ArrowRight, Plus } from 'lucide-react-native';
import useAuthStore from '../../../stores/authStore';
import useThemeStore from '../../../stores/themeStore';
import useLocalQuery from '../../../hooks/useLocalQuery';
import SyncIconButton from '../../../components/SyncIconButton';
import StatCard from '../../../components/ui/StatCard';
import EmptyState from '../../../components/ui/EmptyState';
import BatchSheet from '../../../components/sheets/BatchSheet';
import { SkeletonDashboardCards } from '../../../components/skeletons';

const logoLight = require('../../../assets/images/logo.png');
const logoDark = require('../../../assets/images/logo-white.png');

const fmt = (val) =>
  Number(val || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function DashboardScreen() {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const { resolvedTheme } = useThemeStore();
  const insets = useSafeAreaInsets();
  const [batchSheet, setBatchSheet] = useState({ open: false, data: null });

  const [batches, batchesLoading] = useLocalQuery('batches');
  const [expenses] = useLocalQuery('expenses');
  const [saleOrders] = useLocalQuery('saleOrders');
  const [sources] = useLocalQuery('sources');

  const activeBatches = useMemo(
    () => batches.filter((b) => b.status !== 'COMPLETE'),
    [batches]
  );

  const totalBirds = useMemo(
    () => activeBatches.reduce((sum, b) =>
      sum + (b.houses || []).reduce((s, h) => s + (h.quantity || 0), 0), 0),
    [activeBatches]
  );

  const totalExpenses = useMemo(
    () => expenses.reduce((sum, e) => sum + (e.totalAmount || 0), 0),
    [expenses]
  );

  const totalRevenue = useMemo(
    () => saleOrders.reduce((sum, s) => sum + (s.totals?.grandTotal || 0), 0),
    [saleOrders]
  );

  const iconColor = resolvedTheme === 'dark' ? '#e0e8e0' : '#1a2e1a';
  const primaryColor = resolvedTheme === 'dark' ? 'hsl(148, 48%, 38%)' : 'hsl(148, 60%, 20%)';
  const hasBatches = batches.length > 0;

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 16 }}
    >
      <View className="px-4 mb-4">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center flex-1 gap-3">
            <Image
              source={resolvedTheme === 'dark' ? logoDark : logoLight}
              className="h-9 w-9 rounded-xl"
              resizeMode="contain"
            />
            <View className="flex-1">
              <Text className="text-2xl font-bold text-foreground">
                {t('dashboard.welcome', { name: user?.firstName || '' })}
              </Text>
              <Text className="text-sm text-muted-foreground">{t('dashboard.overview')}</Text>
            </View>
          </View>
          <SyncIconButton />
        </View>
      </View>

      <View className="px-4 mb-4">
        {batchesLoading ? (
          <SkeletonDashboardCards />
        ) : (
          <>
            <View className="flex-row gap-2 mb-2">
              <StatCard label={t('dashboard.activeBatches')} value={activeBatches.length} icon={Layers} />
              <StatCard label={t('dashboard.totalBirds')} value={totalBirds.toLocaleString()} icon={Egg} />
            </View>
            <View className="flex-row gap-2">
              <StatCard label={t('dashboard.totalExpenses', 'Total Cost')} value={fmt(totalExpenses)} icon={DollarSign} />
              <StatCard label={t('dashboard.revenue')} value={fmt(totalRevenue)} icon={TrendingUp} />
            </View>
          </>
        )}
      </View>

      {hasBatches ? (
        <View className="px-4">
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

          <View className="flex-row gap-2 mt-4">
            <Pressable
              onPress={() => setBatchSheet({ open: true, data: null })}
              className="flex-1 flex-row items-center justify-center rounded-lg border border-primary/20 bg-primary/5 py-3"
            >
              <Plus size={16} color={primaryColor} />
              <Text className="text-sm font-medium text-primary ml-1.5">{t('batches.addBatch', 'New Batch')}</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <View className="px-4">
          <EmptyState
            icon={Layers}
            title={t('dashboard.noData')}
            description={t('dashboard.noDataDesc')}
            actionLabel={t('dashboard.createFirstBatch')}
            onAction={() => setBatchSheet({ open: true, data: null })}
          />
        </View>
      )}

      <BatchSheet
        open={batchSheet.open}
        onClose={() => setBatchSheet({ open: false, data: null })}
        editData={batchSheet.data}
      />
    </ScrollView>
  );
}
