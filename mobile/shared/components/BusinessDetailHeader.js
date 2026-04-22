import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import {
  ChevronLeft, ChevronRight, Pencil, Building2,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useHeroSheetTokens } from '@/components/HeroSheetScreen';
import { useIsRTL } from '@/stores/localeStore';
import { rowDirection, textAlignStart } from '@/lib/rtl';

/**
 * Compact brand-gradient header strip for the Business Detail screen.
 *
 * Mirrors BatchDetailHeader's chrome — same gradient, same translucent
 * toolbar buttons (DL §7) — so the two pages read as one product. Tabs
 * sit flush below this strip (no rounded bottom). Token-driven, RTL-safe.
 *
 * Layout in StyleSheet (§9 NativeWind trap rule). The functional
 * Pressable style is reserved for press-state visuals only on the
 * back/edit/delete buttons (none here — they all use static style + an
 * android_ripple).
 */
export default function BusinessDetailHeader({
  biz,
  onEdit,
  canEdit = true,
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const isRTL = useIsRTL();
  const { heroGradient, accentColor, dark } = useHeroSheetTokens();

  if (!biz) return null;

  const isTrader = biz.businessType !== 'SUPPLIER';
  const BackIcon = isRTL ? ChevronRight : ChevronLeft;
  const tileBg = dark ? 'rgba(148,210,165,0.20)' : 'hsl(148, 35%, 92%)';

  const handleBack = () => {
    Haptics.selectionAsync().catch(() => {});
    router.back();
  };

  const handleEdit = () => {
    Haptics.selectionAsync().catch(() => {});
    onEdit?.();
  };

  return (
    <LinearGradient
      colors={heroGradient}
      start={isRTL ? { x: 1, y: 0 } : { x: 0, y: 0 }}
      end={isRTL ? { x: 0, y: 1 } : { x: 1, y: 1 }}
      style={{
        paddingTop: insets.top + 12,
        paddingBottom: 18,
        paddingHorizontal: 16,
      }}
    >
      <View
        style={[
          styles.row,
          { flexDirection: rowDirection(isRTL) },
        ]}
      >
        <Pressable
          onPress={handleBack}
          hitSlop={6}
          android_ripple={{ color: 'rgba(255,255,255,0.18)', borderless: true, radius: 20 }}
          style={styles.iconBtn}
          accessibilityRole="button"
          accessibilityLabel={t('common.back', 'Back')}
        >
          <BackIcon size={22} color="#ffffff" strokeWidth={2.4} />
        </Pressable>

        {/* Building avatar tile — accent-tinted, since "person identity"
            white-circle treatment is reserved for contacts / workers per
            DL §7.a. */}
        <View style={[styles.avatarTile, { backgroundColor: tileBg }]}>
          <Building2 size={22} color={accentColor} strokeWidth={2.4} />
        </View>

        <View style={styles.textCol}>
          <Text
            style={{
              fontSize: 20,
              fontFamily: 'Poppins-Bold',
              color: '#ffffff',
              letterSpacing: -0.3,
              lineHeight: 26,
              textAlign: textAlignStart(isRTL),
              writingDirection: isRTL ? 'rtl' : 'ltr',
            }}
            numberOfLines={1}
          >
            {biz.companyName}
          </Text>
          <View
            style={[
              styles.pillsRow,
              { flexDirection: rowDirection(isRTL) },
            ]}
          >
            <View style={styles.pill}>
              <Text style={styles.pillText} numberOfLines={1}>
                {isTrader
                  ? t('businesses.trader', 'Trader')
                  : t('businesses.supplier', 'Supplier')}
              </Text>
            </View>
            {biz.isAccountBusiness ? (
              <View style={[styles.pill, styles.pillOutline]}>
                <Text style={styles.pillText} numberOfLines={1}>
                  {t('businesses.yourBusiness', 'Your Business')}
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* Edit action — capability-gated, translucent-circle treatment
            matching every other tabbed detail screen (BatchDetailHeader,
            FarmDetailHeader). Delete lives inside QuickAddBusinessSheet's
            destructive footer button per the tabbed-detail convention. */}
        {canEdit ? (
          <Pressable
            onPress={handleEdit}
            hitSlop={6}
            android_ripple={{ color: 'rgba(255,255,255,0.18)', borderless: true, radius: 20 }}
            style={styles.iconBtn}
            accessibilityRole="button"
            accessibilityLabel={t('common.edit', 'Edit')}
          >
            <Pencil size={18} color="#ffffff" strokeWidth={2.4} />
          </Pressable>
        ) : (
          <View style={{ width: 36 }} />
        )}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    gap: 12,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarTile: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textCol: {
    flex: 1,
    minWidth: 0,
  },
  pillsRow: {
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
    flexWrap: 'wrap',
  },
  pill: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  pillOutline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.30)',
  },
  pillText: {
    fontSize: 10,
    fontFamily: 'Poppins-SemiBold',
    color: '#ffffff',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
});
