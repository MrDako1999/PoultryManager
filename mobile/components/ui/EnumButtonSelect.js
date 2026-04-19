import { View, Text, Pressable, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useHeroSheetTokens } from '@/components/HeroSheetScreen';
import { useIsRTL } from '@/stores/localeStore';

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
 * @param {boolean} [props.compact] - 40pt row, icon left of label
 * @param {boolean} [props.disabled]
 */
export default function EnumButtonSelect({
  options = [],
  value,
  onChange,
  columns,
  compact,
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
        { flexDirection: isRTL ? 'row-reverse' : 'row', marginHorizontal: -(gap / 2) },
      ]}
    >
      {options.map(({ value: optVal, label, icon: Icon }) => {
        const selected = value === optVal;
        const baseTileStyle = compact ? styles.tileCompact : styles.tileTall;
        const iconColor = selected ? accentColor : mutedColor;
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
                  flexDirection: compact
                    ? (isRTL ? 'row-reverse' : 'row')
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
                  size={compact ? 14 : 20}
                  color={iconColor}
                  strokeWidth={selected ? 2.4 : 2}
                />
              ) : null}
              <Text
                style={{
                  fontSize: compact ? 12 : 12.5,
                  fontFamily: selected ? 'Poppins-SemiBold' : 'Poppins-Medium',
                  color: selected ? accentColor : textColor,
                  textAlign: 'center',
                }}
                numberOfLines={compact ? 1 : 2}
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
    height: 42,
    paddingHorizontal: 10,
    borderWidth: 1.5,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  tileTall: {
    minHeight: 76,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderWidth: 1.5,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
});
