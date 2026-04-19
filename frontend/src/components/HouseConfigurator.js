import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Trash2, Home } from 'lucide-react';

export default function HouseConfigurator({ houses = [], onChange, disabled = false }) {
  const { t } = useTranslation();

  const addHouse = () => {
    const nextNum = houses.length + 1;
    onChange([...houses, { name: `House ${nextNum}`, capacity: '' }]);
  };

  const removeHouse = (index) => {
    onChange(houses.filter((_, i) => i !== index));
  };

  const updateHouse = (index, field, value) => {
    const updated = houses.map((h, i) => {
      if (i !== index) return h;
      return { ...h, [field]: value };
    });
    onChange(updated);
  };

  const totalCapacity = houses.reduce((sum, h) => {
    const cap = parseInt(String(h.capacity).replace(/[^0-9]/g, ''), 10);
    return sum + (isNaN(cap) ? 0 : cap);
  }, 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Label className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            {t('farms.houses', 'Houses')}
          </Label>
        </div>
        {houses.length > 0 && (
          <span className="text-xs text-muted-foreground tabular-nums">
            {t('farms.totalCapacity', 'Total')}: {totalCapacity.toLocaleString('en-US')} {t('farms.birds', 'birds')}
          </span>
        )}
      </div>

      {houses.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-6 text-center">
          <Home className="h-6 w-6 text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground mb-3">{t('farms.noHouses', 'No houses configured')}</p>
          <Button type="button" variant="outline" size="sm" onClick={addHouse} disabled={disabled} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" />
            {t('farms.addHouse', 'Add House')}
          </Button>
        </div>
      )}

      {houses.map((house, index) => (
        <div key={index} className="flex items-center gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10">
            <Home className="h-3.5 w-3.5 text-primary" />
          </div>
          <Input
            value={house.name}
            onChange={(e) => updateHouse(index, 'name', e.target.value)}
            placeholder={t('farms.houseName', 'House name')}
            disabled={disabled}
            className="flex-1 h-9"
          />
          <Input
            inputMode="numeric"
            value={house.capacity === '' ? '' : Number(house.capacity).toLocaleString('en-US')}
            onChange={(e) => {
              const raw = e.target.value.replace(/[^0-9]/g, '');
              updateHouse(index, 'capacity', raw ? parseInt(raw, 10) : '');
            }}
            placeholder={t('farms.houseCapacity', 'Capacity')}
            disabled={disabled}
            className="w-28 h-9 tabular-nums"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive"
            onClick={() => removeHouse(index)}
            disabled={disabled}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}

      {houses.length > 0 && (
        <Button type="button" variant="outline" size="sm" onClick={addHouse} disabled={disabled} className="w-full gap-1.5">
          <Plus className="h-3.5 w-3.5" />
          {t('farms.addHouse', 'Add House')}
        </Button>
      )}
    </div>
  );
}
