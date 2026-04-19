import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import {
  ChevronLeft, ChevronRight, Pencil, Calendar,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useHeroSheetTokens } from '@/components/HeroSheetScreen';
import { useIsRTL } from '@/stores/localeStore';
import BatchAvatar from './BatchAvatar';
import { getStatusConfig } from '@/modules/broiler/lib/batchStatusConfig';

const CYCLE_TARGET_DAYS = 35;
const NUMERIC_LOCALE = 'en-US';
const fmtInt = (val) => Number(val || 0).toLocaleString(NUMERIC_LOCALE);

/**
 * Compact brand-gradient header strip for the Batch Detail screen.
 *
 * Mirrors the BatchesList header chrome — same gradient, same translucent
 * toolbar buttons (§7), same Calendar + day-of-target meta — so the two
 * pages read as one product. Tabs sit flush below this strip (no rounded
 * bottom). Token-driven, RTL-safe.
 *
 * Layout in StyleSheet (§9 NativeWind trap rule). The functional Pressable
 * style is reserved for press-state visuals only on the back/edit buttons.
 */
export default function BatchDetailHeader({
  batch,
  farmName = '',
  lastSaleDate = null,
  onEdit,
  canEdit = true,
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const isRTL = useIsRTL();
  const { heroGradient } = useHeroSheetTokens();

  if (!batch) return null;

  const status = getStatusConfig(batch.status);
  const avatarLetter = (
    batch.farm?.nickname || batch.farm?.farmName || farmName || batch.batchName || '?'
  )[0].toUpperCase();
  const batchNum = batch.sequenceNumber ?? '';
  const displayName = batch.batchName || `${avatarLetter}${batchNum}`;

  const isInProgress = batch.status === 'IN_PROGRESS';
  const isComplete = batch.status === 'COMPLETE';

  let dayCount = 0;
  let cyclePct = 0;
  if (batch.startDate) {
    const start = new Date(batch.startDate);
    const end = isComplete ? (lastSaleDate || start) : new Date();
    dayCount = Math.max(0, Math.floor((end - start) / 86400000));
    cyclePct = Math.min(100, (dayCount / CYCLE_TARGET_DAYS) * 100);
  }

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
          { flexDirection: isRTL ? 'row-reverse' : 'row' },
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

        <BatchAvatar
          letter={avatarLetter}
          sequence={batchNum}
          status={status}
          size={44}
          radius={14}
        />

        <View style={styles.textCol}>
          <Text
            style={{
              fontSize: 20,
              fontFamily: 'Poppins-Bold',
              color: '#ffffff',
              letterSpacing: -0.3,
              lineHeight: 26,
              textAlign: isRTL ? 'right' : 'left',
              writingDirection: isRTL ? 'rtl' : 'ltr',
            }}
            numberOfLines={1}
          >
            {displayName}
          </Text>
          {batch.startDate ? (
            isInProgress ? (
              <View style={{ marginTop: 6 }}>
                <View
                  style={[
                    styles.metaRow,
                    { flexDirection: isRTL ? 'row-reverse' : 'row' },
                  ]}
                >
                  <Calendar size={11} color="rgba(255,255,255,0.78)" strokeWidth={2.4} />
                  <Text
                    style={{
                      fontSize: 11,
                      fontFamily: 'Poppins-SemiBold',
                      color: 'rgba(255,255,255,0.78)',
                      letterSpacing: 0.6,
                      textTransform: 'uppercase',
                    }}
                  >
                    {t('dashboard.dayOfTarget', 'Day {{day}} of {{target}}', {
                      day: dayCount,
                      target: CYCLE_TARGET_DAYS,
                    })}
                  </Text>
                  <View style={{ flex: 1 }} />
                  <Text
                    style={{
                      fontSize: 11,
                      fontFamily: 'Poppins-SemiBold',
                      color: '#ffffff',
                    }}
                  >
                    {`${Math.round(cyclePct)}%`}
                  </Text>
                </View>
                <View style={styles.progressTrack}>
                  <View
                    style={[
                      styles.progressFill,
                      { width: `${cyclePct}%` },
                    ]}
                  />
                </View>
              </View>
            ) : (
              <Text
                style={{
                  fontSize: 12,
                  fontFamily: 'Poppins-Regular',
                  color: 'rgba(255,255,255,0.78)',
                  marginTop: 4,
                  textAlign: isRTL ? 'right' : 'left',
                }}
                numberOfLines={1}
              >
                {isComplete
                  ? t('batches.completedInDays', 'Completed in {{days}} days', { days: fmtInt(dayCount) })
                  : t('batches.cycleDay', 'Day {{days}}', { days: fmtInt(dayCount) })}
              </Text>
            )
          ) : (
            <Text
              style={{
                fontSize: 12,
                fontFamily: 'Poppins-Regular',
                color: 'rgba(255,255,255,0.78)',
                marginTop: 4,
                textAlign: isRTL ? 'right' : 'left',
              }}
              numberOfLines={1}
            >
              {t('batches.notStarted', 'Not started')}
            </Text>
          )}
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
  textCol: {
    flex: 1,
    minWidth: 0,
  },
  metaRow: {
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
    backgroundColor: '#ffffff',
  },
});
