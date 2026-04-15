import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { Loader2 } from 'lucide-react';
import SearchableSelect from '@/components/SearchableSelect';
import api from '@/lib/api';
import db from '@/lib/db';
import useSettings from '@/hooks/useSettings';
import { COUNTRY_VAT_MAP } from '@/lib/constants';

const countryOptions = Object.entries(COUNTRY_VAT_MAP).map(([code, info]) => ({
  value: code,
  label: info.name,
  description: `VAT: ${info.vatRate}% · ${info.currency}`,
}));

const invoiceLanguageOptions = [
  { value: 'en', label: 'English' },
];

export default function AccountingSettings() {
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
      await db.settings.put({ key: 'accounting', value: data });
      toast({ title: t('settings.accountingUpdated') });
    } catch (err) {
      toast({
        title: t('common.error'),
        description: err.response?.data?.message || t('settings.accountingUpdateError'),
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('settings.accountingTitle')}</CardTitle>
        <CardDescription>{t('settings.accountingDesc')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label>{t('settings.country')}</Label>
          <SearchableSelect
            options={countryOptions}
            value={country}
            onChange={handleCountryChange}
            placeholder={t('settings.selectCountry')}
            searchPlaceholder={t('settings.searchCountry')}
            emptyMessage={t('common.noResults')}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>{t('settings.vatRate')}</Label>
            <Input
              value={vatRate !== '' ? `${vatRate}%` : ''}
              disabled
              className="opacity-60"
            />
          </div>
          <div className="space-y-2">
            <Label>{t('settings.currency')}</Label>
            <Input
              value={currency}
              disabled
              className="opacity-60"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label>{t('settings.invoiceLanguage')}</Label>
          <p className="text-xs text-muted-foreground">{t('settings.invoiceLanguageDesc')}</p>
          <SearchableSelect
            options={invoiceLanguageOptions}
            value={invoiceLanguage}
            onChange={setInvoiceLanguage}
            placeholder={t('settings.invoiceLanguage')}
            emptyMessage={t('common.noResults')}
          />
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {t('common.save')}
        </Button>
      </CardContent>
    </Card>
  );
}
