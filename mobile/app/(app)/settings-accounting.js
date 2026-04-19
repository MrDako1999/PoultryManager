import { useState, useEffect } from 'react';
import { View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Calculator, Globe, Languages, Percent, DollarSign } from 'lucide-react-native';
import { Button } from '@/components/ui/Button';
import Select from '@/components/ui/Select';
import { useToast } from '@/components/ui/Toast';
import useSettings from '@/hooks/useSettings';
import api from '@/lib/api';
import { upsertSettings } from '@/lib/db';
import { COUNTRY_VAT_MAP } from '@/lib/constants';
import HeroSheetScreen, { useHeroSheetTokens } from '@/components/HeroSheetScreen';
import SheetSection from '@/components/SheetSection';
import SheetInput from '@/components/SheetInput';

const countryOptions = Object.entries(COUNTRY_VAT_MAP).map(([code, info]) => ({
  value: code,
  label: `${info.name} (${info.currency})`,
}));

const invoiceLanguageOptions = [
  { value: 'en', label: 'English' },
];

function FieldGroup({ label, icon: Icon, children }) {
  const { textColor, mutedColor } = useHeroSheetTokens();
  return (
    <View style={{ gap: 8, marginBottom: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginLeft: 4 }}>
        {Icon && <Icon size={13} color={mutedColor} />}
        <Text
          style={{
            fontSize: 13,
            fontFamily: 'Poppins-Medium',
            color: textColor,
          }}
        >
          {label}
        </Text>
      </View>
      {children}
    </View>
  );
}

export default function SettingsAccountingScreen() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const accounting = useSettings('accounting');

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
      <Calculator size={26} color="#ffffff" strokeWidth={2} />
    </View>
  );

  const headerRight = currency ? (
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
  ) : null;

  return (
    <HeroSheetScreen
      title={t('settings.accounting', 'Accounting')}
      subtitle={t('settings.accountingDesc', 'Country, VAT, and invoice settings')}
      heroExtra={heroExtra}
      headerRight={headerRight}
      keyboardAvoiding
    >
      <SheetSection title={t('settings.regionVat', 'Region & VAT')}>
        <FieldGroup label={t('settings.country', 'Country')} icon={Globe}>
          <Select
            value={country}
            onValueChange={handleCountryChange}
            options={countryOptions}
            placeholder={t('settings.selectCountry', 'Select country...')}
            label={t('settings.country', 'Country')}
          />
        </FieldGroup>

        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <SheetInput
              label={t('settings.vatRate', 'VAT Rate')}
              value={vatRate !== '' ? `${vatRate}%` : ''}
              editable={false}
              icon={Percent}
            />
          </View>
          <View style={{ flex: 1 }}>
            <SheetInput
              label={t('settings.currency', 'Currency')}
              value={currency}
              editable={false}
              icon={DollarSign}
            />
          </View>
        </View>
      </SheetSection>

      <SheetSection
        title={t('settings.invoicing', 'Invoicing')}
        description={t('settings.invoiceLanguageDesc', 'Language used on generated invoices')}
      >
        <FieldGroup label={t('settings.invoiceLanguage', 'Invoice Language')} icon={Languages}>
          <Select
            value={invoiceLanguage}
            onValueChange={setInvoiceLanguage}
            options={invoiceLanguageOptions}
            placeholder="Select language..."
            label={t('settings.invoiceLanguage', 'Invoice Language')}
          />
        </FieldGroup>
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
