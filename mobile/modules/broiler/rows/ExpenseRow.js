import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import { Link2 } from 'lucide-react-native';
import { useHeroSheetTokens } from '@/components/HeroSheetScreen';
import { useIsRTL } from '@/stores/localeStore';
import { rowDirection, textAlignStart } from '@/lib/rtl';

const NUMERIC_LOCALE = 'en-US';

const fmt = (val) =>
  Number(val || 0).toLocaleString(NUMERIC_LOCALE, {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  });

/**
 * Expense row used inside ExpensesListView's category groups.
 * Token-driven, RTL-safe; padding on a plain inner View per DL §9.
 */
export default function ExpenseRow({ expense, categoryLabel, onClick }) {
  const { t } = useTranslation();
  const isRTL = useIsRTL();
  const { textColor, mutedColor, dark } = useHeroSheetTokens();

  const hasLink = !!(expense.source || expense.feedOrder || expense.saleOrder);
  const dateLabel = expense.expenseDate
    ? new Date(expense.expenseDate).toLocaleDateString(NUMERIC_LOCALE, {
        day: '2-digit', month: 'short', year: 'numeric',
      })
    : null;
  const supplier = expense.tradingCompany?.companyName;

  // Compose the meta line as `date · supplier` only when both are present;
  // otherwise just one of them. Avoids the awkward `— · supplier` legacy.
  const metaPieces = [dateLabel, supplier].filter(Boolean);
  const meta = metaPieces.join('  ·  ');

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
            <View
              style={[
                styles.titleRow,
                { flexDirection: rowDirection(isRTL) },
              ]}
            >
              <Text
                style={{
                  flex: 1,
                  minWidth: 0,
                  fontSize: 14,
                  fontFamily: 'Poppins-SemiBold',
                  color: textColor,
                  letterSpacing: -0.1,
                  textAlign: textAlignStart(isRTL),
                }}
                numberOfLines={1}
              >
                {expense.description || categoryLabel || t('common.expense', 'Expense')}
              </Text>
              {hasLink ? (
                <Link2 size={12} color={mutedColor} strokeWidth={2.2} />
              ) : null}
            </View>
            {meta ? (
              <Text
                style={{
                  fontSize: 12,
                  fontFamily: 'Poppins-Regular',
                  color: mutedColor,
                  textAlign: textAlignStart(isRTL),
                }}
                numberOfLines={1}
              >
                {meta}
              </Text>
            ) : null}
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
            {fmt(expense.totalAmount)}
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
  titleRow: {
    alignItems: 'center',
    gap: 6,
  },
});
