import { useMemo } from 'react';
import EnumButtonSelect from '@/components/EnumButtonSelect';
import useSettings from '@/hooks/useSettings';
import {
  generateWeightBands, formatBandLabel, DEFAULT_WEIGHT_BANDS,
} from '@/modules/slaughterhouse/lib/defaultWeightBands';

// Quick-add chip strip for weight bands. Reuses EnumButtonSelect
// rather than building a new chip primitive (per plan §0.3). The
// strip is configurable via useSettings('slaughterhouse').weightBands;
// owners can add custom bands or change the min/max/step.
export default function WeightBandChips({ value, onChange, className }) {
  const settings = useSettings('slaughterhouse');
  const bands = useMemo(
    () => generateWeightBands(settings?.weightBands || DEFAULT_WEIGHT_BANDS),
    [settings],
  );

  const options = useMemo(
    () => bands.map((g) => ({ value: String(g), label: formatBandLabel(g) })),
    [bands],
  );

  return (
    <EnumButtonSelect
      options={options}
      value={value != null ? String(value) : ''}
      onChange={(v) => onChange?.(Number(v))}
      columns={Math.min(8, options.length)}
      compact
      className={className}
    />
  );
}
