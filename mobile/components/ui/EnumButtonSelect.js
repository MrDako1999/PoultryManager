import { View, Text, Pressable, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useHeroSheetTokens } from '@/components/HeroSheetScreen';
import { useIsRTL } from '@/stores/localeStore';
import { rowDirection } from '@/lib/rtl';

/**
 * Grid of enum-value buttons with optional icon.
 * Restyled on design-language tokens (HeroSheet) - accent border + tint when
 * active, soft input-fill when idle. Layout lives in StyleSheet to avoid the
 * NativeWind functional-style trap (DESIGN_LANGUAGE.md §9).
 *
 * @param {object} props
 * @param {Array<{value: string, label: string, icon?: Component}>} props.options
 * @param {string} props.value
 * @param {(v: string) => void} props.onChange
 * @param {number} [props.columns]
 * @param {boolean} [props.compact] - shorter row, icon left of label
 * @param {number} [props.compactLabelLines=1] - max lines for label in compact mode (use 2 to avoid clipping)
 * @param {boolean} [props.disabled]
 */
export default function EnumButtonSelect({
  options = [],
  value,
  onChange,
  columns,
  compact,
  compactLabelLines = 1,
  disabled,
}) {
  const { accentColor, mutedColor, textColor, inputBg, inputBorderIdle, dark } = useHeroSheetTokens();
  const isRTL = useIsRTL();

  const cols = columns || options.length || 1;
  const gap = 8;
  const itemWidth = `${(100 / cols).toFixed(4)}%`;

  const activeBg = dark ? 'rgba(148,210,165,0.16)' : 'hsl(148, 35%, 93%)';
  const activeBorder = accentColor;
  const idleBg = inputBg;
  const idleBorder = inputBorderIdle;

  const handlePress = (val) => {
    if (disabled) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onChange?.(val);
  };

  return (
    <View
      style={[
        styles.grid,
        { flexDirection: rowDirection(isRTL), marginHorizontal: -(gap / 2) },
      ]}
    >
      {options.map(({ value: optVal, label, icon: Icon }) => {
        const selected = value === optVal;
        const baseTileStyle = compact
          ? (compactLabelLines > 1 ? styles.tileCompactMultiline : styles.tileCompact)
          : styles.tileTall;
        const iconColor = selected ? accentColor : mutedColor;
        // Tall (non-compact) tiles render icon-on-top, label-below in a
        // narrow column. Forcing single-line + auto-shrink keeps every
        // tile in the row visually balanced even when one translation
        // is noticeably longer than another (the original wrapping
        // turned "Daily Log" / "Weight Sample" into stacked two-line
        // labels next to a single-line "Environment", which looked
        // ragged). Compact tiles keep the caller's `compactLabelLines`
        // contract.
        const labelLines = compact ? compactLabelLines : 1;
        const shrinkLabel = !compact;
        return (
          <View
            key={optVal}
            style={{
              width: itemWidth,
              paddingHorizontal: gap / 2,
              marginBottom: gap,
            }}
          >
            <Pressable
              onPress={() => handlePress(optVal)}
              disabled={disabled}
              style={[
                baseTileStyle,
                {
                  width: '100%',
                  flexDirection: compact
                    ? rowDirection(isRTL)
                    : 'column',
                  backgroundColor: selected ? activeBg : idleBg,
                  borderColor: selected ? activeBorder : idleBorder,
                  opacity: disabled ? 0.5 : 1,
                },
              ]}
              accessibilityRole="button"
              accessibilityState={{ selected }}
            >
              {Icon ? (
                <Icon
                  size={compact ? 15 : 20}
                  color={iconColor}
                  strokeWidth={selected ? 2.4 : 2}
                />
              ) : null}
              <Text
                style={{
                  flex: compact ? 1 : undefined,
                  width: compact ? undefined : '100%',
                  minWidth: 0,
                  // Compact tiles have more horizontal room (icon next
                  // to label, often laid out in 2+ columns). Tall
                  // tiles share the row 3-up so we have to drop the
                  // base size a hair to keep two-word labels like
                  // "Weight Sample" / "Daily Log" on a single line.
                  fontSize: compact ? 12.5 : 11.5,
                  fontFamily: selected ? 'Poppins-SemiBold' : 'Poppins-Medium',
                  color: selected ? accentColor : textColor,
                  textAlign: compact ? (isRTL ? 'right' : 'left') : 'center',
                }}
                numberOfLines={labelLines}
                adjustsFontSizeToFit={shrinkLabel}
                minimumFontScale={shrinkLabel ? 0.8 : undefined}
                ellipsizeMode="tail"
              >
                {label}
              </Text>
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexWrap: 'wrap',
  },
  tileCompact: {
    minHeight: 44,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderWidth: 1.5,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  tileCompactMultiline: {
    minHeight: 52,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderWidth: 1.5,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  tileTall: {
    minHeight: 68,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderWidth: 1.5,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
});
