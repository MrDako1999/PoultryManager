import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import { ChevronLeft, ChevronRight, Pencil } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useHeroSheetTokens } from '@/components/HeroSheetScreen';
import { useIsRTL } from '@/stores/localeStore';
import { rowDirection, textAlignStart } from '@/lib/rtl';

/**
 * Compact brand-gradient header strip for the Farm Detail screen.
 *
 * Mirrors BatchDetailHeader so Farm Detail and Batch Detail read as one
 * product: same gradient, same translucent toolbar buttons (§7), same
 * avatar + title + meta layout. Tabs sit flush below this strip (no
 * rounded bottom). Token-driven, RTL-safe.
 *
 * Differs from BatchDetailHeader by skipping the day-of-cycle progress
 * bar — farms aren't single-cycle entities, so the meta line surfaces a
 * stack of farm-level identifiers (nickname / type / business) instead.
 */
export default function FarmDetailHeader({
  farm,
  onEdit,
  canEdit = true,
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const isRTL = useIsRTL();
  const { heroGradient, accentColor } = useHeroSheetTokens();

  if (!farm) return null;

  const initial = (farm.nickname || farm.farmName || '?')[0].toUpperCase();

  // Single classifier — keeps the header strip uncluttered. Nickname
  // is already telegraphed by the avatar tile letter, and the linked
  // business name was getting truncated next to long farm names. The
  // farm type (Broiler / Layer / …) is the one piece of context worth
  // surfacing right under the title.
  const meta = farm.farmType
    ? t(`farms.farmTypes.${farm.farmType}`, farm.farmType)
    : '';

  const BackIcon = isRTL ? ChevronRight : ChevronLeft;

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

        <View style={styles.avatarTile}>
          <Text
            style={{
              fontSize: 18,
              fontFamily: 'Poppins-Bold',
              color: accentColor,
            }}
          >
            {initial}
          </Text>
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
            {farm.farmName}
          </Text>
          {meta ? (
            <Text
              style={{
                fontSize: 12,
                fontFamily: 'Poppins-Regular',
                color: 'rgba(255,255,255,0.78)',
                marginTop: 4,
                textAlign: textAlignStart(isRTL),
                writingDirection: isRTL ? 'rtl' : 'ltr',
              }}
              numberOfLines={1}
            >
              {meta}
            </Text>
          ) : null}
        </View>

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
    backgroundColor: 'rgba(255,255,255,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textCol: {
    flex: 1,
    minWidth: 0,
  },
});
