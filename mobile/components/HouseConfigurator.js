import { View, Text, Pressable, TextInput } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2, Home } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { textInputFit } from '@/lib/textInputFit';

const MUTED = 'hsl(150, 10%, 45%)';

const fmtInt = (val) => {
  const n = Number(val || 0);
  if (Number.isNaN(n)) return '';
  return n.toLocaleString();
};

const parseCapacity = (raw) => {
  const cleaned = String(raw || '').replace(/[^0-9]/g, '');
  if (!cleaned) return 0;
  const n = parseInt(cleaned, 10);
  return Number.isNaN(n) ? 0 : n;
};

/**
 * Inline editable list of houses for a farm.
 *
 * value: Array<{ _id?: string, name: string, capacity: number }>
 *   _id present = existing house, missing = new local-only entry
 * onChange: (nextValue) => void
 */
export default function HouseConfigurator({ value = [], onChange }) {
  const { t } = useTranslation();

  const update = (idx, patch) => {
    const next = value.map((h, i) => (i === idx ? { ...h, ...patch } : h));
    onChange?.(next);
  };

  const remove = (idx) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const next = value.filter((_, i) => i !== idx);
    onChange?.(next);
  };

  const add = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const nextIdx = value.length + 1;
    onChange?.([
      ...value,
      { name: t('farms.houseN', 'House {{n}}', { n: nextIdx }), capacity: 0 },
    ]);
  };

  return (
    <View className="gap-2">
      {value.length === 0 ? (
        <View className="rounded-md border border-dashed border-border p-4 items-center">
          <Home size={18} color={MUTED} />
          <Text className="text-xs text-muted-foreground mt-2 text-center">
            {t('farms.noHousesYet', 'No houses yet. Add one below.')}
          </Text>
        </View>
      ) : (
        value.map((house, idx) => (
          <View
            key={house._id || `new-${idx}`}
            className="flex-row items-center gap-2 rounded-md border border-border bg-card px-2 py-2"
          >
            <View className="h-8 w-8 rounded-md bg-primary/10 items-center justify-center">
              <Home size={14} color="hsl(148, 60%, 20%)" />
            </View>
            <TextInput
              value={house.name || ''}
              onChangeText={(v) => update(idx, { name: v })}
              placeholder={t('farms.houseName', 'House name')}
              placeholderTextColor={MUTED}
              className="flex-1 text-sm text-foreground"
              style={[{ paddingVertical: 0 }, textInputFit]}
              numberOfLines={1}
            />
            <TextInput
              value={house.capacity > 0 ? fmtInt(house.capacity) : ''}
              onChangeText={(v) => update(idx, { capacity: parseCapacity(v) })}
              keyboardType="number-pad"
              placeholder={t('farms.houseCapacity', 'Capacity')}
              placeholderTextColor={MUTED}
              className="w-24 text-sm text-foreground tabular-nums text-right"
              style={[{ paddingVertical: 0 }, textInputFit]}
              numberOfLines={1}
            />
            <Pressable
              onPress={() => remove(idx)}
              hitSlop={6}
              className="h-7 w-7 items-center justify-center rounded-md active:bg-red-500/10"
              accessibilityRole="button"
              accessibilityLabel={t('farms.removeHouse', 'Remove house')}
            >
              <Trash2 size={14} color="#dc2626" />
            </Pressable>
          </View>
        ))
      )}

      <Pressable
        onPress={add}
        className="flex-row items-center justify-center gap-1.5 rounded-md border border-dashed border-border px-3 py-2.5 active:bg-accent/40"
      >
        <Plus size={14} color={MUTED} />
        <Text className="text-xs font-medium text-muted-foreground">
          {t('farms.addHouse', 'Add house')}
        </Text>
      </Pressable>
    </View>
  );
}
