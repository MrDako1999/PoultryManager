import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import { useHeroSheetTokens } from '@/components/HeroSheetScreen';
import { useIsRTL } from '@/stores/localeStore';
import { rowDirection, trailingAlignment, textAlignStart } from '@/lib/rtl';

const NUMERIC_LOCALE = 'en-US';

const fmtInt = (val) => Number(val || 0).toLocaleString(NUMERIC_LOCALE);

/**
 * Feed item row used inside FeedOrdersListView. Token-driven, RTL-safe;
 * padding on a plain inner View per DL §9.
 */
export default function FeedItemRow({ item, onClick }) {
  const { t } = useTranslation();
  const isRTL = useIsRTL();
  const { textColor, mutedColor, dark } = useHeroSheetTokens();

  const bags = item.bags || 0;
  const sizePerBag = item.quantitySize || 50;
  const totalKg = bags * sizePerBag;

  const dateLabel = item.orderDate
    ? new Date(item.orderDate).toLocaleDateString(NUMERIC_LOCALE, {
        day: '2-digit', month: 'short', year: 'numeric',
      })
    : null;

  return (
    <Pressable
      onPressIn={() => Haptics.selectionAsync().catch(() => {})}
      onPress={onClick}
      android_ripple={{
        color: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
        borderless: false,
      }}
      style={({ pressed }) => ({
        backgroundColor: pressed
          ? (dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)')
          : 'transparent',
      })}
    >
      <View style={styles.rowInner}>
        <View
          style={[
            styles.row,
            { flexDirection: rowDirection(isRTL) },
          ]}
        >
          <View style={styles.textCol}>
            <Text
              style={{
                fontSize: 14,
                fontFamily: 'Poppins-SemiBold',
                color: textColor,
                letterSpacing: -0.1,
                textAlign: textAlignStart(isRTL),
              }}
              numberOfLines={1}
            >
              {item.feedDescription || item.companyName || t('feed.feedItem', 'Feed Item')}
            </Text>
            {/* Single secondary line — just the order date. Company name
                and bag breakdown ("150 × 50 kg") are intentionally
                dropped from the row and live on the detail screen
                instead, where they have room to breathe. */}
            {dateLabel ? (
              <Text
                style={{
                  fontSize: 12,
                  fontFamily: 'Poppins-Regular',
                  color: mutedColor,
                  textAlign: textAlignStart(isRTL),
                }}
                numberOfLines={1}
              >
                {dateLabel}
              </Text>
            ) : null}
          </View>

          <View style={[styles.rightCol, { alignItems: trailingAlignment(isRTL) }]}>
            <Text
              style={{
                fontSize: 14,
                fontFamily: 'Poppins-SemiBold',
                color: textColor,
                fontVariant: ['tabular-nums'],
              }}
              numberOfLines={1}
            >
              {`${fmtInt(totalKg)} kg`}
            </Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  rowInner: {
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  row: {
    alignItems: 'center',
    gap: 12,
  },
  textCol: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  rightCol: {
    minWidth: 0,
  },
});
