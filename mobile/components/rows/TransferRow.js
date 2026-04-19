import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import {
  Landmark, Banknote, FileCheck, CreditCard, ArrowLeftRight,
} from 'lucide-react-native';
import { useHeroSheetTokens } from '@/components/HeroSheetScreen';
import { useIsRTL } from '@/stores/localeStore';

const NUMERIC_LOCALE = 'en-US';

const fmt = (val) =>
  Number(val || 0).toLocaleString(NUMERIC_LOCALE, {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  });

const TYPE_ICONS = {
  BANK_TRANSFER: Landmark,
  CASH: Banknote,
  CHEQUE: FileCheck,
  CREDIT: CreditCard,
};

/**
 * Transfer row used inside TransfersListView's date groups. Token-driven
 * and RTL-safe. Padding lives on a plain inner View per DL §9 trap.
 *
 * Replaces the previous Tailwind-classed row whose `text-foreground` /
 * `text-muted-foreground` resolved to a washed-out gray in dark mode.
 * Renders a leading type-icon tile (accent-tinted), the business name
 * with a type pill, optional notes preview, and a right-aligned amount.
 */
export default function TransferRow({ transfer, onClick }) {
  const { t } = useTranslation();
  const isRTL = useIsRTL();
  const {
    accentColor, textColor, mutedColor, dark,
  } = useHeroSheetTokens();

  const transferType = transfer.transferType || 'CASH';
  const TypeIcon = TYPE_ICONS[transferType] || ArrowLeftRight;
  const tileBg = dark ? 'rgba(148,210,165,0.16)' : 'hsl(148, 35%, 92%)';
  const pillBg = dark ? 'rgba(255,255,255,0.08)' : 'hsl(148, 18%, 94%)';
  const pillBorder = dark ? 'rgba(255,255,255,0.12)' : 'hsl(148, 14%, 88%)';

  const businessName = transfer.business?.companyName
    || t('common.unknown', 'Unknown');
  const typeLabel = t(`transfers.types.${transferType}`, transferType);
  const notes = (transfer.notes || '').trim();

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
          <View style={[styles.iconTile, { backgroundColor: tileBg }]}>
            <TypeIcon size={16} color={accentColor} strokeWidth={2.4} />
          </View>

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
              {businessName}
            </Text>
            <View
              style={[
                styles.metaRow,
                { flexDirection: isRTL ? 'row-reverse' : 'row' },
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
                  {typeLabel}
                </Text>
              </View>
              {notes ? (
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
                  {notes}
                </Text>
              ) : null}
            </View>
          </View>

          <Text
            style={{
              fontSize: 14,
              fontFamily: 'Poppins-SemiBold',
              color: textColor,
              fontVariant: ['tabular-nums'],
              textAlign: isRTL ? 'left' : 'right',
            }}
            numberOfLines={1}
          >
            {fmt(transfer.amount)}
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
  iconTile: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
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
});
