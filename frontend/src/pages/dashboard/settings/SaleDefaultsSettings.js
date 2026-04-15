import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/components/ui/use-toast';
import { Loader2 } from 'lucide-react';
import api from '@/lib/api';
import db from '@/lib/db';
import useSettings from '@/hooks/useSettings';

const PORTION_KEYS = [
  'LIVER', 'GIZZARD', 'HEART', 'BREAST', 'LEG', 'WING',
  'BONE', 'THIGH', 'DRUMSTICK', 'BONELESS_THIGH', 'NECK', 'MINCE',
];

export default function SaleDefaultsSettings() {
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
      await db.settings.put({ key: 'saleDefaults', value: data });
      toast({ title: t('settings.saleDefaultsUpdated') });
    } catch (err) {
      toast({
        title: t('common.error'),
        description: err.response?.data?.message || t('settings.saleDefaultsUpdateError'),
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const updateRate = (key, value) => {
    setPortionRates((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('settings.saleDefaultsTitle')}</CardTitle>
        <CardDescription>{t('settings.saleDefaultsDesc')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <h3 className="text-sm font-medium mb-3">{t('settings.portionRatesSection')}</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {PORTION_KEYS.map((key) => (
              <div key={key} className="space-y-1">
                <Label className="text-xs">{t(`settings.portionLabels.${key}`)}</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                    {currency}
                  </span>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={portionRates[key] || ''}
                    onChange={(e) => updateRate(key, e.target.value)}
                    className="pl-12"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <Separator />

        <div>
          <h3 className="text-sm font-medium mb-3">{t('settings.transportSection')}</h3>
          <div className="max-w-xs space-y-1">
            <Label className="text-xs">{t('settings.transportRatePerTruck')}</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                {currency}
              </span>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={transportRate}
                onChange={(e) => setTransportRate(e.target.value)}
                className="pl-12"
              />
            </div>
          </div>
        </div>

        <Button onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {t('common.save')}
        </Button>
      </CardContent>
    </Card>
  );
}
