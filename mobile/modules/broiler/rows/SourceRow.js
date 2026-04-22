import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import { Calendar } from 'lucide-react-native';
import { useHeroSheetTokens } from '@/components/HeroSheetScreen';
import { useIsRTL } from '@/stores/localeStore';
import { rowDirection, textAlignStart } from '@/lib/rtl';

const NUMERIC_LOCALE = 'en-US';

const fmt = (val) =>
  Number(val || 0).toLocaleString(NUMERIC_LOCALE, {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  });

const fmtInt = (val) => Number(val || 0).toLocaleString(NUMERIC_LOCALE);

/**
 * Source row used inside SourcesListView. Token-driven, RTL-safe; padding
 * on a plain inner View per DL §9.
 */
export default function SourceRow({ source, onClick }) {
  const { t } = useTranslation();
  const isRTL = useIsRTL();
  const { textColor, mutedColor, dark } = useHeroSheetTokens();

  const dateLabel = source.deliveryDate
    ? new Date(source.deliveryDate).toLocaleDateString(NUMERIC_LOCALE, {
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
              {source.sourceFrom?.companyName || t('common.unknown', 'Unknown')}
            </Text>
            <View
              style={[
                styles.metaRow,
                { flexDirection: rowDirection(isRTL) },
              ]}
            >
              {dateLabel ? (
                <View
                  style={[
                    styles.metaPiece,
                    { flexDirection: rowDirection(isRTL) },
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
              <Text
                style={{
                  fontSize: 12,
                  fontFamily: 'Poppins-Regular',
                  color: mutedColor,
                  fontVariant: ['tabular-nums'],
                }}
              >
                {`${fmtInt(source.totalChicks)} ${t('farms.chicks', 'chicks').toLowerCase()}`}
              </Text>
            </View>
          </View>

          <Text
            style={{
              fontSize: 14,
              fontFamily: 'Poppins-SemiBold',
              color: textColor,
              fontVariant: ['tabular-nums'],
            }}
            numberOfLines={1}
          >
            {fmt(source.grandTotal)}
          </Text>
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
    gap: 10,
    flexWrap: 'wrap',
  },
  metaPiece: {
    alignItems: 'center',
    gap: 4,
  },
});
