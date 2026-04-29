import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import EnumButtonSelect from '@/components/EnumButtonSelect';
import useSettings from '@/hooks/useSettings';

const ALL_PART_TYPES = [
  'BREAST', 'WHOLE_LEG', 'DRUMSTICK', 'SKIN_THIGHS', 'WINGS',
  'BONELESS_THIGH', 'NECK', 'BONE', 'MEAT_MINCE', 'BRAAI', 'CUT_PIC',
];

const ALL_GIBLETS = ['LIVER', 'GIZZARD', 'HEART'];

// Quick-add chip strip for part types. Same composition rule as
// WeightBandChips: wraps EnumButtonSelect rather than inventing a new
// chip primitive. `kind="portion"` reads enabledPartTypes from settings,
// `kind="giblet"` reads enabledGiblets.
export default function PartTypeChips({ kind = 'portion', value, onChange, className }) {
  const { t } = useTranslation();
  const settings = useSettings('slaughterhouse');

  const enabled = useMemo(() => {
    if (kind === 'giblet') {
      return Array.isArray(settings?.enabledGiblets) ? settings.enabledGiblets : ALL_GIBLETS;
    }
    return Array.isArray(settings?.enabledPartTypes) ? settings.enabledPartTypes : ALL_PART_TYPES;
  }, [kind, settings]);

  const options = useMemo(
    () => enabled.map((key) => ({
      value: key,
      label: kind === 'giblet'
        ? t(`production.giblets.${key}`, key)
        : t(`production.partTypes.${key}`, key),
    })),
    [enabled, kind, t],
  );

  return (
    <EnumButtonSelect
      options={options}
      value={value || ''}
      onChange={onChange}
      columns={Math.min(4, options.length)}
      compact
      className={className}
    />
  );
}
