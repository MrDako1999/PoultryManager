import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useHeroSheetTokens } from '@/components/HeroSheetScreen';
import { useIsRTL } from '@/stores/localeStore';
import { rowDirection } from '@/lib/rtl';

/**
 * Horizontal scrollable chip row used by the accounting list views.
 *
 * Tokens-only, RTL-safe. Active chip is accent-filled with white label;
 * inactive chip uses inputBg + inputBorderIdle. Layout in StyleSheet (§9).
 *
 * @param {object} props
 * @param {string} props.value - Current selected option value
 * @param {(value: string) => void} props.onChange
 * @param {Array<{value, label, icon?}>} props.options
 */
export default function FilterChips({ value, onChange, options }) {
  const isRTL = useIsRTL();
  const tokens = useHeroSheetTokens();
  const {
    accentColor, dark, mutedColor, textColor, inputBg, inputBorderIdle,
  } = tokens;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[
        styles.row,
        { flexDirection: rowDirection(isRTL) },
      ]}
    >
      {options.map((opt) => {
        const Icon = opt.icon;
        const active = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => {
              if (active) return;
              Haptics.selectionAsync().catch(() => {});
              onChange?.(opt.value);
            }}
            android_ripple={{
              color: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
              borderless: false,
            }}
            style={[
              styles.chip,
              {
                backgroundColor: active ? accentColor : inputBg,
                borderColor: active ? accentColor : inputBorderIdle,
              },
            ]}
            hitSlop={4}
          >
            <View
              style={[
                styles.chipInner,
                { flexDirection: rowDirection(isRTL) },
              ]}
            >
              {Icon ? (
                <Icon
                  size={13}
                  color={active ? '#ffffff' : mutedColor}
                  strokeWidth={2.4}
                />
              ) : null}
              <Text
                style={{
                  fontSize: 12,
                  fontFamily: 'Poppins-SemiBold',
                  color: active ? '#ffffff' : textColor,
                  letterSpacing: 0.1,
                }}
                numberOfLines={1}
              >
                {opt.label}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingHorizontal: 16,
    gap: 8,
    alignItems: 'center',
  },
  chip: {
    borderRadius: 999,
    borderWidth: 1.5,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  chipInner: {
    alignItems: 'center',
    gap: 6,
  },
});
