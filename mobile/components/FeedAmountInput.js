import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import SheetInput from '@/components/SheetInput';
import SlidingSegmentedControl from '@/components/SlidingSegmentedControl';
import { useHeroSheetTokens } from '@/components/HeroSheetScreen';
import { useIsRTL } from '@/stores/localeStore';
import { textAlignStart } from '@/lib/rtl';

// Standard feed sack weight in kg. Hardcoded for now — every supplier
// we ship to bags feed at 50 kg. If a region ever switches we'll
// promote this to a per-batch / per-feed-item setting. Until then the
// constant keeps the math obvious at the call site.
const BAG_KG = 50;

const UNIT_BAG = 'BAG';
const UNIT_KG = 'KG';

const parseNumber = (text) => {
  if (text == null) return null;
  const cleaned = String(text).replace(/,/g, '').trim();
  if (!cleaned) return null;
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
};

// Strip trailing zeros after the decimal so "5.00" displays as "5"
// while "4.90" still becomes "4.9". Avoids the "5.0 bags" papercut.
const trimZeros = (str) => {
  if (!str.includes('.')) return str;
  return str.replace(/0+$/, '').replace(/\.$/, '');
};

// Bag count is always rounded UP to one decimal place. The product
// rule from the field: workers should never under-state feed
// consumption — if they used 243 kg that's 4.86 bags, we display 4.9
// not 4.8. The underlying kg value is preserved untouched; this is
// purely a display convention.
const kgToBags = (kg) => {
  if (!Number.isFinite(kg)) return 0;
  return Math.ceil((kg / BAG_KG) * 10) / 10;
};

const formatBagsDisplay = (kg) => {
  if (kg === null) return '';
  return trimZeros(kgToBags(kg).toFixed(1));
};

const formatKgDisplay = (kg) => {
  if (kg === null) return '';
  // Two-decimal precision is enough for feed weights — partial-kg
  // dust below 0.01 doesn't move FCR meaningfully.
  return trimZeros((Math.round(kg * 100) / 100).toFixed(2));
};

/**
 * Feed amount entry with an inline Bag / KG unit toggle.
 *
 * The component owns the visible text and the active unit, but the
 * canonical value handed back to the parent form is *always* in kg
 * (string, matching the rest of the daily-log inputs). Toggling units
 * never mutates the stored kg value — it only re-formats the display
 * for the new unit. Editing the input does mutate the stored value:
 *
 *   - In BAG mode, "5" → onChange("250") (5 × 50 kg)
 *   - In KG mode,  "230" → onChange("230")
 *
 * Round-trips: opening an entry with kg=243 in BAG mode shows "4.9"
 * (ceil), but the kg stays 243 unless the worker re-enters the
 * displayed bag count, at which point it's committed (4.9 × 50 = 245).
 *
 * @param {string} value - Current feed amount in kg, as a string. Empty for no value.
 * @param {(next: string) => void} onChange - Receives the new kg value (string) or '' to clear.
 * @param {string} [label] - Field label. Rendered above the unit toggle.
 * @param {string} [error] - Validation error for the field, if any.
 */
export default function FeedAmountInput({ value, onChange, label, error }) {
  const { t } = useTranslation();
  const { textColor, mutedColor, dark } = useHeroSheetTokens();
  const isRTL = useIsRTL();

  const [unit, setUnit] = useState(UNIT_BAG);
  const [display, setDisplay] = useState('');

  // The kg value we last wrote via onChange. We compare incoming
  // `value` props against this to decide whether the change came from
  // *us* (echo — ignore, otherwise we'd clobber partial input like
  // "4.") or from outside (e.g. parent form reset on edit — resync
  // display).
  const ourLastKg = useRef(null);

  useEffect(() => {
    const externalKg = parseNumber(value);
    if (externalKg === ourLastKg.current) return;
    if (externalKg === null) {
      setDisplay('');
      ourLastKg.current = null;
      return;
    }
    setDisplay(unit === UNIT_BAG ? formatBagsDisplay(externalKg) : formatKgDisplay(externalKg));
    ourLastKg.current = externalKg;
    // `unit` intentionally omitted — toggling unit is handled by
    // handleUnitChange directly, this effect is only for syncing
    // with externally-driven `value` changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const unitOptions = useMemo(() => [
    { value: UNIT_BAG, label: t('batches.operations.feedUnitBag', 'Per Bag (50 kg)') },
    { value: UNIT_KG, label: t('batches.operations.feedUnitKg', 'KG') },
  ], [t]);

  const handleUnitChange = (next) => {
    if (next === unit) return;
    setUnit(next);
    const kg = parseNumber(value);
    if (kg === null) {
      setDisplay('');
      return;
    }
    setDisplay(next === UNIT_BAG ? formatBagsDisplay(kg) : formatKgDisplay(kg));
    ourLastKg.current = kg;
  };

  const handleDisplayChange = (text) => {
    setDisplay(text);
    const num = parseNumber(text);
    if (num === null) {
      ourLastKg.current = null;
      onChange('');
      return;
    }
    const kg = unit === UNIT_BAG ? num * BAG_KG : num;
    const kgRounded = Math.round(kg * 100) / 100;
    ourLastKg.current = kgRounded;
    onChange(String(kgRounded));
  };

  const kgValue = parseNumber(value);
  const hintText = useMemo(() => {
    if (kgValue === null) return undefined;
    if (unit === UNIT_BAG) {
      return t('batches.operations.feedHintKg', '≈ {{kg}} kg', {
        kg: formatKgDisplay(kgValue),
      });
    }
    return t('batches.operations.feedHintBags', '≈ {{bags}} bags', {
      bags: trimZeros(kgToBags(kgValue).toFixed(1)),
    });
  }, [kgValue, unit, t]);

  const unitBadge = (
    <View
      style={{
        backgroundColor: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
        borderRadius: 8,
        paddingHorizontal: 8,
        paddingVertical: 3,
      }}
    >
      <Text
        style={{
          fontSize: 11,
          fontFamily: 'Poppins-SemiBold',
          color: mutedColor,
          letterSpacing: 0.4,
        }}
      >
        {unit === UNIT_BAG
          ? t('batches.operations.bagsUnit', 'bags')
          : t('batches.operations.kgUnit', 'kg')}
      </Text>
    </View>
  );

  return (
    <View style={{ gap: 8 }}>
      {label ? (
        <Text
          style={{
            fontSize: 13,
            fontFamily: 'Poppins-Medium',
            color: textColor,
            marginHorizontal: 4,
            textAlign: textAlignStart(isRTL),
          }}
        >
          {label}
        </Text>
      ) : null}
      <SlidingSegmentedControl
        value={unit}
        onChange={handleUnitChange}
        options={unitOptions}
        bordered
      />
      <SheetInput
        value={display}
        onChangeText={handleDisplayChange}
        keyboardType="decimal-pad"
        placeholder="0"
        suffix={unitBadge}
        error={error}
        hint={!error ? hintText : undefined}
      />
    </View>
  );
}
