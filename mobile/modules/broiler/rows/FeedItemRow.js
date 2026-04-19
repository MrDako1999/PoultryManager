import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import { Calendar } from 'lucide-react-native';
import { useHeroSheetTokens } from '@/components/HeroSheetScreen';
import { useIsRTL } from '@/stores/localeStore';

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
            { flexDirection: isRTL ? 'row-reverse' : 'row' },
          ]}
        >
          <View style={styles.textCol}>
            <Text
              style={{
                fontSize: 14,
                fontFamily: 'Poppins-SemiBold',
                color: textColor,
                letterSpacing: -0.1,
                textAlign: isRTL ? 'right' : 'left',
              }}
              numberOfLines={1}
            >
              {item.feedDescription || item.companyName || t('feed.feedItem', 'Feed Item')}
            </Text>
            <View
              style={[
                styles.metaRow,
                { flexDirection: isRTL ? 'row-reverse' : 'row' },
              ]}
            >
              {dateLabel ? (
                <View
                  style={[
                    styles.metaPiece,
                    { flexDirection: isRTL ? 'row-reverse' : 'row' },
                  ]}
                >
                  <Calendar size={11} color={mutedColor} strokeWidth={2.2} />
                  <Text
                    style={{
                      fontSize: 12,
                      fontFamily: 'Poppins-Regular',
                      color: mutedColor,
                    }}
                  >
                    {dateLabel}
                  </Text>
                </View>
              ) : null}
              {item.companyName && item.feedDescription ? (
                <Text
                  style={{
                    flex: 1,
                    minWidth: 0,
                    fontSize: 12,
                    fontFamily: 'Poppins-Regular',
                    color: mutedColor,
                  }}
                  numberOfLines={1}
                >
                  {item.companyName}
                </Text>
              ) : null}
            </View>
          </View>

          <View style={[styles.rightCol, { alignItems: isRTL ? 'flex-start' : 'flex-end' }]}>
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
            <Text
              style={{
                fontSize: 11,
                fontFamily: 'Poppins-Regular',
                color: mutedColor,
                fontVariant: ['tabular-nums'],
              }}
              numberOfLines={1}
            >
              {`${fmtInt(bags)} × ${fmtInt(sizePerBag)} kg`}
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
    gap: 4,
  },
  metaRow: {
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  metaPiece: {
    alignItems: 'center',
    gap: 4,
  },
  rightCol: {
    minWidth: 0,
    gap: 3,
  },
});
