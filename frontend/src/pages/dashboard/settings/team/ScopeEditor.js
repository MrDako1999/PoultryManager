import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Loader2, MapPin } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import api from '@/lib/api';

/**
 * Flat farm multi-select. Replaces the older farm/house tree picker —
 * scope is farm-level only for this iteration (see WORKERS.md). Same
 * data contract as the mobile ScopeEditor so flows mirror across
 * platforms.
 *
 * Props:
 *   value     - array of farm ids currently selected
 *   onChange  - (nextIds: string[]) => void
 *   disabled  - boolean, disables interaction
 */
export default function ScopeEditor({ value = [], onChange, disabled = false }) {
  const { t } = useTranslation();

  const { data: farms = [], isLoading } = useQuery({
    queryKey: ['farms'],
    queryFn: async () => {
      const { data } = await api.get('/farms');
      return data;
    },
  });

  const selected = new Set(value.map(String));

  const toggle = (farmId) => {
    if (disabled) return;
    const next = new Set(selected);
    const id = String(farmId);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(Array.from(next));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (farms.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-center">
        <MapPin className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
        <p className="text-sm font-medium">{t('settings.scopeNoFarmsTitle', 'No farms yet')}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {t('settings.scopeNoFarmsDesc', 'Create farms first; you can assign them once they exist.')}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {t('settings.scopeSelected', '{{n}} of {{total}} farms', {
            n: value.length,
            total: farms.length,
          })}
        </span>
        <button
          type="button"
          className="text-primary hover:underline disabled:opacity-50"
          disabled={disabled}
          onClick={() => {
            if (selected.size === farms.length) onChange([]);
            else onChange(farms.map((f) => String(f._id)));
          }}
        >
          {selected.size === farms.length
            ? t('common.clearAll', 'Clear all')
            : t('common.selectAll', 'Select all')}
        </button>
      </div>
      <div className="overflow-hidden rounded-md border">
        {farms.map((farm, idx) => {
          const id = String(farm._id);
          const checked = selected.has(id);
          return (
            <Label
              key={id}
              htmlFor={`farm-scope-${id}`}
              className={`flex cursor-pointer items-center gap-3 px-3 py-3 text-sm transition-colors hover:bg-accent/50 ${
                idx > 0 ? 'border-t' : ''
              } ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
            >
              <Checkbox
                id={`farm-scope-${id}`}
                checked={checked}
                onCheckedChange={() => toggle(id)}
                disabled={disabled}
              />
              <div className="flex-1 min-w-0">
                <p className="truncate font-medium">{farm.farmName}</p>
                {farm.nickname ? (
                  <p className="truncate text-xs text-muted-foreground">{farm.nickname}</p>
                ) : null}
              </div>
            </Label>
          );
        })}
      </div>
    </div>
  );
}
