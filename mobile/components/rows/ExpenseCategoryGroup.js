import { useCallback } from 'react';
import {
  View, Text, Pressable, LayoutAnimation, UIManager, Platform, StyleSheet,
} from 'react-native';
import { ChevronDown, ChevronRight, ChevronLeft } from 'lucide-react-native';
import { useHeroSheetTokens } from '@/components/HeroSheetScreen';
import { useIsRTL } from '@/stores/localeStore';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const NUMERIC_LOCALE = 'en-US';
const fmt = (val) => Number(val || 0).toLocaleString(NUMERIC_LOCALE, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Group header used inside list-view sections (date groups in Sales,
 * category groups in Expenses, etc.). Tappable to collapse/expand;
 * tokens-only; RTL-safe.
 */
export default function ExpenseCategoryGroup({
  label,
  total,
  count,
  pills,
  open = true,
  onToggle,
  children,
}) {
  const isRTL = useIsRTL();
  const { mutedColor, dark } = useHeroSheetTokens();

  const ClosedChevron = isRTL ? ChevronLeft : ChevronRight;
  const Glyph = open ? ChevronDown : ClosedChevron;

  const handleToggle = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    onToggle?.();
  }, [onToggle]);

  return (
    <View>
      <Pressable
        onPress={handleToggle}
        android_ripple={{
          color: dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
          borderless: false,
        }}
        style={[
          styles.header,
          {
            backgroundColor: dark ? 'rgba(255,255,255,0.03)' : 'hsl(148, 18%, 96%)',
          },
        ]}
      >
        <View
          style={[
            styles.headerInner,
            { flexDirection: isRTL ? 'row-reverse' : 'row' },
          ]}
        >
          <Glyph size={14} color={mutedColor} strokeWidth={2.4} />
          <Text
            style={{
              flex: 1,
              fontSize: 11,
              fontFamily: 'Poppins-SemiBold',
              color: mutedColor,
              letterSpacing: 1.2,
              textTransform: 'uppercase',
              textAlign: isRTL ? 'right' : 'left',
            }}
            numberOfLines={1}
          >
            {label}
          </Text>
          {pills ? (
            <View
              style={[
                styles.pillRow,
                { flexDirection: isRTL ? 'row-reverse' : 'row' },
              ]}
            >
              {pills.map((pill, i) => (
                <Text
                  key={`${pill.value}-${i}`}
                  style={{
                    fontSize: 11,
                    fontFamily: 'Poppins-SemiBold',
                    color: mutedColor,
                  }}
                >
                  {pill.value}
                </Text>
              ))}
            </View>
          ) : (
            <View
              style={[
                styles.pillRow,
                { flexDirection: isRTL ? 'row-reverse' : 'row' },
              ]}
            >
              {total != null ? (
                <Text
                  style={{
                    fontSize: 11,
                    fontFamily: 'Poppins-SemiBold',
                    color: mutedColor,
                  }}
                >
                  {fmt(total)}
                </Text>
              ) : null}
              {count != null ? (
                <Text
                  style={{
                    fontSize: 11,
                    fontFamily: 'Poppins-SemiBold',
                    color: mutedColor,
                  }}
                >
                  {count}
                </Text>
              ) : null}
            </View>
          )}
        </View>
      </Pressable>
      {open ? children : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'transparent',
  },
  headerInner: {
    alignItems: 'center',
    gap: 8,
  },
  pillRow: {
    alignItems: 'center',
    gap: 10,
  },
});
