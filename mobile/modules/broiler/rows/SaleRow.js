import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import { Truck } from 'lucide-react-native';
import { useHeroSheetTokens } from '@/components/HeroSheetScreen';
import { useIsRTL } from '@/stores/localeStore';
import { rowDirection, trailingAlignment, textAlignStart } from '@/lib/rtl';

const NUMERIC_LOCALE = 'en-US';

const fmt = (val) =>
  Number(val || 0).toLocaleString(NUMERIC_LOCALE, {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  });

const fmtInt = (val) => Number(val || 0).toLocaleString(NUMERIC_LOCALE);

/**
 * Sale row used inside SalesListView's date groups. Token-driven and
 * RTL-safe. Padding lives on a plain inner View per DL §9 trap.
 *
 * Replaces the previous Tailwind-classed row whose `text-foreground` /
 * `text-muted-foreground` resolved to a washed-out gray in dark mode (the
 * NativeWind css-interop drops the proper themed value in some Pressable
 * contexts), which made the customer name and total amount unreadable.
 */
export default function SaleRow({ sale, onClick }) {
  const { t } = useTranslation();
  const isRTL = useIsRTL();
  const { textColor, mutedColor, dark } = useHeroSheetTokens();

  const chickens = sale.saleMethod === 'SLAUGHTERED'
    ? (sale.counts?.chickensSent || 0)
    : (sale.live?.birdCount || 0);
  const trucks = sale.transport?.truckCount || 0;

  const pillBg = dark ? 'rgba(255,255,255,0.08)' : 'hsl(148, 18%, 94%)';
  const pillBorder = dark ? 'rgba(255,255,255,0.12)' : 'hsl(148, 14%, 88%)';

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
              {sale.customer?.companyName || t('common.unknown', 'Unknown')}
            </Text>
            <View
              style={[
                styles.metaRow,
                { flexDirection: rowDirection(isRTL) },
              ]}
            >
              <View style={[styles.pill, { backgroundColor: pillBg, borderColor: pillBorder }]}>
                <Text
                  style={{
                    fontSize: 10,
                    fontFamily: 'Poppins-SemiBold',
                    color: mutedColor,
                    letterSpacing: 0.6,
                    textTransform: 'uppercase',
                  }}
                  numberOfLines={1}
                >
                  {sale.saleMethod || 'SALE'}
                </Text>
              </View>
              {sale.saleNumber ? (
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
                  {sale.saleNumber}
                </Text>
              ) : null}
            </View>
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
              {fmt(sale.totals?.grandTotal)}
            </Text>
            {(chickens > 0 || trucks > 0) ? (
              <View
                style={[
                  styles.subRow,
                  { flexDirection: rowDirection(isRTL) },
                ]}
              >
                {chickens > 0 ? (
                  <Text
                    style={{
                      fontSize: 11,
                      fontFamily: 'Poppins-Regular',
                      color: mutedColor,
                      fontVariant: ['tabular-nums'],
                    }}
                  >
                    {`${fmtInt(chickens)} ${t('farms.birds', 'birds').toLowerCase()}`}
                  </Text>
                ) : null}
                {trucks > 0 ? (
                  <View
                    style={[
                      styles.truckPiece,
                      { flexDirection: rowDirection(isRTL) },
                    ]}
                  >
                    <Truck size={11} color={mutedColor} strokeWidth={2.2} />
                    <Text
                      style={{
                        fontSize: 11,
                        fontFamily: 'Poppins-Regular',
                        color: mutedColor,
                        fontVariant: ['tabular-nums'],
                      }}
                    >
                      {fmtInt(trucks)}
                    </Text>
                  </View>
                ) : null}
              </View>
            ) : null}
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
  },
  pill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  rightCol: {
    minWidth: 0,
    gap: 3,
  },
  subRow: {
    alignItems: 'center',
    gap: 6,
  },
  truckPiece: {
    alignItems: 'center',
    gap: 3,
  },
});
