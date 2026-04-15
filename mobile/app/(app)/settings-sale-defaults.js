import { useState, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { Input } from '../../components/ui/Input';
import { Label } from '../../components/ui/Label';
import { Button } from '../../components/ui/Button';
import Separator from '../../components/ui/Separator';
import { useToast } from '../../components/ui/Toast';
import useThemeStore from '../../stores/themeStore';
import useSettings from '../../hooks/useSettings';
import api from '../../lib/api';
import { upsertSettings } from '../../lib/db';

const PORTION_KEYS = [
  'LIVER', 'GIZZARD', 'HEART', 'BREAST', 'LEG', 'WING',
  'BONE', 'THIGH', 'DRUMSTICK', 'BONELESS_THIGH', 'NECK', 'MINCE',
];

const PORTION_LABELS = {
  LIVER: 'Liver', GIZZARD: 'Gizzard', HEART: 'Heart',
  BREAST: 'Breast', LEG: 'Leg', WING: 'Wing',
  BONE: 'Bone', THIGH: 'Thigh', DRUMSTICK: 'Drumstick',
  BONELESS_THIGH: 'Boneless Thigh', NECK: 'Neck', MINCE: 'Mince',
};

export default function SettingsSaleDefaultsScreen() {
  const { t } = useTranslation();
  const { resolvedTheme } = useThemeStore();
  const insets = useSafeAreaInsets();
  const { toast } = useToast();
  const accounting = useSettings('accounting');
  const defaults = useSettings('saleDefaults');
  const currency = accounting?.currency || 'AED';

  const primaryColor = resolvedTheme === 'dark' ? 'hsl(148, 48%, 38%)' : 'hsl(148, 60%, 20%)';

  const [portionRates, setPortionRates] = useState({});
  const [transportRate, setTransportRate] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (defaults) {
      const rates = {};
      PORTION_KEYS.forEach((key) => {
        rates[key] = defaults.portionRates?.[key] != null ? String(defaults.portionRates[key]) : '0';
      });
      setPortionRates(rates);
      setTransportRate(defaults.transportRatePerTruck != null ? String(defaults.transportRatePerTruck) : '0');
    }
  }, [defaults]);

  const updateRate = (key, value) => {
    setPortionRates((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const rates = {};
      PORTION_KEYS.forEach((key) => {
        rates[key] = Number(portionRates[key]) || 0;
      });
      const payload = {
        portionRates: rates,
        transportRatePerTruck: Number(transportRate) || 0,
      };
      const { data } = await api.put('/settings/sale-defaults', payload);
      await upsertSettings([{ key: 'saleDefaults', value: data }]);
      toast({ title: t('settings.saleDefaultsUpdated', 'Sale defaults updated') });
    } catch (err) {
      toast({
        variant: 'destructive',
        title: err.response?.data?.message || t('common.error', 'Error'),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <View className="flex-row items-center px-2 pt-2 pb-3 border-b border-border">
        <Pressable onPress={() => router.back()} className="p-2 -ml-1 active:opacity-60">
          <ChevronLeft size={24} color={primaryColor} />
        </Pressable>
        <View className="flex-1">
          <Text className="text-lg font-bold text-foreground">
            {t('settings.saleDefaults', 'Sale Defaults')}
          </Text>
          <Text className="text-xs text-muted-foreground">
            {t('settings.saleDefaultsDesc', 'Default portion rates and transport pricing')}
          </Text>
        </View>
      </View>

      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32 }}
          keyboardShouldPersistTaps="handled"
        >
          <View className="rounded-xl border border-border bg-card p-4 mb-4">
            <Text className="text-sm font-semibold text-foreground mb-3">
              {t('settings.portionRatesSection', 'Portion Rates')}
            </Text>

            <View className="flex-row flex-wrap" style={{ gap: 12 }}>
              {PORTION_KEYS.map((key) => (
                <View key={key} className="gap-1" style={{ width: '47%' }}>
                  <Label className="text-xs">
                    {t(`settings.portionLabels.${key}`, PORTION_LABELS[key])}
                  </Label>
                  <View className="flex-row items-center">
                    <Text className="text-xs text-muted-foreground mr-1.5">{currency}</Text>
                    <View className="flex-1">
                      <Input
                        value={portionRates[key] || ''}
                        onChangeText={(v) => updateRate(key, v)}
                        keyboardType="decimal-pad"
                        className="text-sm"
                      />
                    </View>
                  </View>
                </View>
              ))}
            </View>
          </View>

          <View className="rounded-xl border border-border bg-card p-4 mb-4">
            <Text className="text-sm font-semibold text-foreground mb-3">
              {t('settings.transportSection', 'Transport')}
            </Text>
            <View className="gap-1">
              <Label className="text-xs">
                {t('settings.transportRatePerTruck', 'Rate per Truck')}
              </Label>
              <View className="flex-row items-center">
                <Text className="text-xs text-muted-foreground mr-1.5">{currency}</Text>
                <View className="flex-1">
                  <Input
                    value={transportRate}
                    onChangeText={setTransportRate}
                    keyboardType="decimal-pad"
                    className="text-sm"
                  />
                </View>
              </View>
            </View>
          </View>

          <Button onPress={handleSave} loading={saving} disabled={saving}>
            {t('common.save', 'Save')}
          </Button>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
