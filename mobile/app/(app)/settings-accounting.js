import { useState, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { Input } from '../../components/ui/Input';
import { Label } from '../../components/ui/Label';
import { Button } from '../../components/ui/Button';
import Select from '../../components/ui/Select';
import { useToast } from '../../components/ui/Toast';
import useThemeStore from '../../stores/themeStore';
import useSettings from '../../hooks/useSettings';
import api from '../../lib/api';
import { upsertSettings } from '../../lib/db';
import { COUNTRY_VAT_MAP } from '../../lib/constants';

const countryOptions = Object.entries(COUNTRY_VAT_MAP).map(([code, info]) => ({
  value: code,
  label: `${info.name} (${info.currency})`,
}));

const invoiceLanguageOptions = [
  { value: 'en', label: 'English' },
];

export default function SettingsAccountingScreen() {
  const { t } = useTranslation();
  const { resolvedTheme } = useThemeStore();
  const insets = useSafeAreaInsets();
  const { toast } = useToast();
  const accounting = useSettings('accounting');

  const primaryColor = resolvedTheme === 'dark' ? 'hsl(148, 48%, 38%)' : 'hsl(148, 60%, 20%)';

  const [country, setCountry] = useState('');
  const [vatRate, setVatRate] = useState('');
  const [currency, setCurrency] = useState('');
  const [invoiceLanguage, setInvoiceLanguage] = useState('en');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (accounting) {
      setCountry(accounting.country || '');
      setVatRate(accounting.vatRate != null ? String(accounting.vatRate) : '');
      setCurrency(accounting.currency || '');
      setInvoiceLanguage(accounting.invoiceLanguage || 'en');
    }
  }, [accounting]);

  const handleCountryChange = (val) => {
    setCountry(val);
    const info = COUNTRY_VAT_MAP[val];
    if (info) {
      setVatRate(String(info.vatRate));
      setCurrency(info.currency);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        country: country || null,
        vatRate: vatRate !== '' ? Number(vatRate) : null,
        currency: currency || null,
        invoiceLanguage,
      };
      const { data } = await api.put('/settings/accounting', payload);
      await upsertSettings([{ key: 'accounting', value: data }]);
      toast({ title: t('settings.accountingUpdated', 'Accounting settings updated') });
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
            {t('settings.accounting', 'Accounting')}
          </Text>
          <Text className="text-xs text-muted-foreground">
            {t('settings.accountingDesc', 'Country, VAT, and invoice settings')}
          </Text>
        </View>
      </View>

      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32 }}
          keyboardShouldPersistTaps="handled"
        >
          <View className="rounded-xl border border-border bg-card p-4">
            <View className="gap-2 mb-4">
              <Label>{t('settings.country', 'Country')}</Label>
              <Select
                value={country}
                onValueChange={handleCountryChange}
                options={countryOptions}
                placeholder={t('settings.selectCountry', 'Select country...')}
                label={t('settings.country', 'Country')}
              />
            </View>

            <View className="flex-row gap-3 mb-4">
              <View className="flex-1 gap-2">
                <Label>{t('settings.vatRate', 'VAT Rate')}</Label>
                <Input
                  value={vatRate !== '' ? `${vatRate}%` : ''}
                  editable={false}
                  className="opacity-60"
                />
              </View>
              <View className="flex-1 gap-2">
                <Label>{t('settings.currency', 'Currency')}</Label>
                <Input
                  value={currency}
                  editable={false}
                  className="opacity-60"
                />
              </View>
            </View>

            <View className="gap-2 mb-6">
              <Label>{t('settings.invoiceLanguage', 'Invoice Language')}</Label>
              <Text className="text-xs text-muted-foreground">
                {t('settings.invoiceLanguageDesc', 'Language used on generated invoices')}
              </Text>
              <Select
                value={invoiceLanguage}
                onValueChange={setInvoiceLanguage}
                options={invoiceLanguageOptions}
                placeholder="Select language..."
                label={t('settings.invoiceLanguage', 'Invoice Language')}
              />
            </View>

            <Button onPress={handleSave} loading={saving} disabled={saving}>
              {t('common.save', 'Save')}
            </Button>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
