import { useState, useEffect } from 'react';
import { View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ShoppingCart, Truck } from 'lucide-react-native';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import useSettings from '@/hooks/useSettings';
import api from '@/lib/api';
import { upsertSettings } from '@/lib/db';
import HeroSheetScreen from '@/components/HeroSheetScreen';
import SheetSection from '@/components/SheetSection';
import { SheetCurrencyInput } from '@/components/SheetInput';

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
  const { toast } = useToast();
  const accounting = useSettings('accounting');
  const defaults = useSettings('saleDefaults');
  const currency = accounting?.currency || 'AED';

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

  const heroExtra = (
    <View
      style={{
        width: 56,
        height: 56,
        borderRadius: 18,
        backgroundColor: 'rgba(255,255,255,0.18)',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <ShoppingCart size={26} color="#ffffff" strokeWidth={2} />
    </View>
  );

  const headerRight = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.18)',
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 5,
      }}
    >
      <Text style={{ fontSize: 11, fontFamily: 'Poppins-SemiBold', color: '#ffffff', letterSpacing: 0.4 }}>
        {currency}
      </Text>
    </View>
  );

  return (
    <HeroSheetScreen
      title={t('settings.saleDefaults', 'Sale Defaults')}
      subtitle={t('settings.saleDefaultsDesc', 'Default portion rates and transport pricing')}
      heroExtra={heroExtra}
      headerRight={headerRight}
      keyboardAvoiding
    >
      <SheetSection
        title={t('settings.portionRatesSection', 'Portion Rates')}
        description={t('settings.portionRatesHint', 'Per-piece rates used as defaults when creating sale invoices')}
      >
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 10, rowGap: 12 }}>
          {PORTION_KEYS.map((key) => (
            <View key={key} style={{ flexBasis: '47%', flexGrow: 1 }}>
              <SheetCurrencyInput
                label={t(`settings.portionLabels.${key}`, PORTION_LABELS[key])}
                value={portionRates[key] || ''}
                onChangeText={(v) => updateRate(key, v)}
                currency={currency}
                dense
              />
            </View>
          ))}
        </View>
      </SheetSection>

      <SheetSection title={t('settings.transportSection', 'Transport')} icon={Truck}>
        <SheetCurrencyInput
          label={t('settings.transportRatePerTruck', 'Rate per Truck')}
          value={transportRate}
          onChangeText={setTransportRate}
          currency={currency}
        />
      </SheetSection>

      <View style={{ paddingHorizontal: 16 }}>
        <Button
          onPress={handleSave}
          loading={saving}
          disabled={saving}
          size="lg"
          className="w-full rounded-2xl"
        >
          <Text style={{ fontFamily: 'Poppins-SemiBold', fontSize: 15, color: '#f5f8f5' }}>
            {t('common.save', 'Save')}
          </Text>
        </Button>
      </View>
    </HeroSheetScreen>
  );
}
