import { useMemo } from 'react';
import { View, Text, Pressable, ScrollView, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import { Home, ClipboardList, ChevronRight } from 'lucide-react-native';
import useAuthStore from '@/stores/authStore';
import useThemeStore from '@/stores/themeStore';
import useLocalQuery from '@/hooks/useLocalQuery';
import EmptyState from '@/components/ui/EmptyState';
import SyncIconButton from '@/components/SyncIconButton';

const logoLight = require('@/assets/images/logo.png');
const logoDark = require('@/assets/images/logo-white.png');

function isSameLocalDay(a, b) {
  if (!a || !b) return false;
  const da = new Date(a);
  const db = new Date(b);
  return da.toDateString() === db.toDateString();
}

export default function WorkerHome() {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const { resolvedTheme } = useThemeStore();
  const insets = useSafeAreaInsets();

  const [houses] = useLocalQuery('houses');
  const [batches] = useLocalQuery('batches');
  const [dailyLogs] = useLocalQuery('dailyLogs');
  const [workers] = useLocalQuery('workers');

  const primaryColor = resolvedTheme === 'dark' ? 'hsl(148, 48%, 38%)' : 'hsl(148, 60%, 20%)';
  const mutedColor = 'hsl(150, 10%, 45%)';

  const worker = useMemo(
    () => workers.find((w) => String(w.linkedUser || w.user_id_ref) === String(user?._id) || String(w.linkedUser?._id) === String(user?._id)),
    [workers, user?._id]
  );

  const assignedHouseIds = useMemo(() => {
    const arr = Array.isArray(worker?.houseAssignments) ? worker.houseAssignments : [];
    return arr.map((h) => (typeof h === 'object' ? h._id : h));
  }, [worker]);

  const myHouses = useMemo(() => {
    if (assignedHouseIds.length === 0) return [];
    return houses.filter((h) => assignedHouseIds.includes(h._id));
  }, [houses, assignedHouseIds]);

  const activeBatchByHouse = useMemo(() => {
    const m = new Map();
    for (const batch of batches) {
      if (batch.status === 'COMPLETE') continue;
      for (const entry of batch.houses || []) {
        const hid = typeof entry.house === 'object' ? entry.house?._id : entry.house;
        if (hid) m.set(String(hid), batch);
      }
    }
    return m;
  }, [batches]);

  const todaySubmittedByHouse = useMemo(() => {
    const now = new Date();
    const set = new Set();
    for (const log of dailyLogs) {
      if (log.logType !== 'DAILY') continue;
      const authorId = typeof log.createdBy === 'object' ? log.createdBy?._id : log.createdBy;
      const isMine = String(authorId) === String(user?._id);
      if (!isMine) continue;
      const hid = typeof log.house === 'object' ? log.house?._id : log.house;
      if (isSameLocalDay(log.date, now)) set.add(String(hid));
    }
    return set;
  }, [dailyLogs, user?._id]);

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
              <Text className="text-sm text-muted-foreground">
                {t('worker.assignedHousesSubtitle', 'Your assigned houses')}
              </Text>
            </View>
          </View>
          <SyncIconButton />
        </View>
      </View>

      <View className="px-4">
        {myHouses.length === 0 ? (
          <EmptyState
            icon={Home}
            title={t('worker.noAssignmentsTitle', 'No houses assigned')}
            description={t(
              'worker.noAssignmentsDesc',
              'Ask your supervisor to assign you to one or more houses to start recording daily logs.'
            )}
          />
        ) : (
          myHouses.map((house) => {
            const batch = activeBatchByHouse.get(String(house._id));
            const submitted = todaySubmittedByHouse.has(String(house._id));
            const status = submitted ? 'submitted' : 'pending';

            const bgClass =
              status === 'submitted'
                ? 'border-green-500/30 bg-green-500/5'
                : 'border-primary/20 bg-card';

            return (
              <Pressable
                key={house._id}
                onPress={() => {
                  if (batch?._id) router.push(`/(app)/batch/${batch._id}`);
                }}
                className={`flex-row items-center rounded-lg border p-4 mb-3 active:opacity-70 ${bgClass}`}
              >
                <View className="h-11 w-11 rounded-lg bg-primary/10 items-center justify-center mr-3">
                  <Home size={22} color={primaryColor} />
                </View>
                <View className="flex-1 min-w-0">
                  <Text className="text-base font-semibold text-foreground">{house.name}</Text>
                  <Text className="text-xs text-muted-foreground" numberOfLines={1}>
                    {batch ? batch.batchName : t('worker.noActiveBatch', 'No active batch')}
                  </Text>
                  <View className="flex-row items-center gap-1 mt-1">
                    <ClipboardList size={12} color={mutedColor} />
                    <Text className="text-xs text-muted-foreground">
                      {submitted
                        ? t('worker.submittedToday', 'Daily log submitted')
                        : t('worker.dailyLogPending', 'Daily log pending')}
                    </Text>
                  </View>
                </View>
                <ChevronRight size={16} color={mutedColor} />
              </Pressable>
            );
          })
        )}
      </View>
    </ScrollView>
  );
}
