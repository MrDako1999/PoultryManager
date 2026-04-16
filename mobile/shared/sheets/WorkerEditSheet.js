import { useEffect, useState } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { X, Check } from 'lucide-react-native';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { Label } from '@/components/ui/Label';
import useLocalQuery from '@/hooks/useLocalQuery';
import useOfflineMutation from '@/hooks/useOfflineMutation';
import useThemeStore from '@/stores/themeStore';
import api from '@/lib/api';

export default function WorkerEditSheet({ open, onClose, worker }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { resolvedTheme } = useThemeStore();
  const [farms] = useLocalQuery('farms');
  const [houses] = useLocalQuery('houses');
  const [assignedHouseIds, setAssignedHouseIds] = useState([]);
  const [saving, setSaving] = useState(false);
  const { update } = useOfflineMutation('workers');
  const iconColor = resolvedTheme === 'dark' ? '#e0e8e0' : '#1a2e1a';

  useEffect(() => {
    if (!open) return;
    const initial = Array.isArray(worker?.houseAssignments) ? worker.houseAssignments : [];
    setAssignedHouseIds(
      initial.map((h) => (typeof h === 'object' ? h._id : h))
    );
  }, [open, worker]);

  const toggleHouse = (houseId) => {
    setAssignedHouseIds((prev) =>
      prev.includes(houseId) ? prev.filter((id) => id !== houseId) : [...prev, houseId]
    );
  };

  const save = async () => {
    if (!worker?._id) {
      onClose?.();
      return;
    }
    setSaving(true);
    try {
      await update(worker._id, { ...worker, houseAssignments: assignedHouseIds });
      if (worker.linkedUser) {
        try {
          await api.put(`/users/${typeof worker.linkedUser === 'object' ? worker.linkedUser._id : worker.linkedUser}`, {
            houseAssignments: assignedHouseIds,
          });
        } catch (err) {
          console.warn('[WorkerEditSheet] failed to sync user houseAssignments', err?.message);
        }
      }
      onClose?.();
    } catch (err) {
      console.error('[WorkerEditSheet] save failed', err);
    } finally {
      setSaving(false);
    }
  };

  const farmById = Object.fromEntries(farms.map((f) => [f._id, f]));
  const byFarm = new Map();
  for (const h of houses) {
    const fid = String(typeof h.farm === 'object' ? h.farm?._id : h.farm || '');
    if (!byFarm.has(fid)) byFarm.set(fid, []);
    byFarm.get(fid).push(h);
  }

  return (
    <Modal visible={open} onRequestClose={onClose} animationType="slide" transparent>
      <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
        <View className="px-4 pt-2 pb-3 border-b border-border flex-row items-center justify-between">
          <Pressable onPress={onClose} hitSlop={8}>
            <X size={22} color={iconColor} />
          </Pressable>
          <Text className="text-base font-semibold text-foreground">
            {t('workers.editAssignments', 'House assignments')}
          </Text>
          <View style={{ width: 22 }} />
        </View>

        <KeyboardAvoidingView
          className="flex-1"
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            className="flex-1"
            contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 88 }}
          >
            <View className="mb-4">
              <Text className="text-sm text-muted-foreground">
                {t(
                  'workers.editAssignmentsHelp',
                  'Select the houses this worker is responsible for. They will only see daily logs and houses in these locations.'
                )}
              </Text>
            </View>

            {[...byFarm.entries()].map(([farmId, list]) => {
              const farm = farmById[farmId];
              return (
                <View key={farmId} className="mb-4">
                  <Text className="text-xs font-semibold text-muted-foreground uppercase mb-2">
                    {farm?.farmName || t('farms.unknownFarm', 'Farm')}
                  </Text>
                  <View className="rounded-lg border border-border bg-card overflow-hidden">
                    {list.map((house) => {
                      const checked = assignedHouseIds.includes(house._id);
                      return (
                        <Pressable
                          key={house._id}
                          onPress={() => toggleHouse(house._id)}
                          className="flex-row items-center px-4 py-3 border-b border-border/60 last:border-b-0"
                        >
                          <Checkbox checked={checked} onCheckedChange={() => toggleHouse(house._id)} />
                          <Label className="ml-3 flex-1">{house.name}</Label>
                          {checked && <Check size={16} color="hsl(148, 60%, 20%)" />}
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              );
            })}
          </ScrollView>
        </KeyboardAvoidingView>

        <View className="absolute left-0 right-0 bottom-0 px-4 pt-3 border-t border-border bg-background" style={{ paddingBottom: insets.bottom + 12 }}>
          <Button onPress={save} loading={saving} disabled={saving}>
            {t('common.save', 'Save')}
          </Button>
        </View>
      </View>
    </Modal>
  );
}
