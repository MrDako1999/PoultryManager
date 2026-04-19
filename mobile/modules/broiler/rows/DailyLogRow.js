import { View, Text, Pressable, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { ChevronRight, ChevronLeft } from 'lucide-react-native';
import { LOG_TYPE_ICONS } from '@/lib/constants';
import { useHeroSheetTokens } from '@/components/HeroSheetScreen';
import { useIsRTL } from '@/stores/localeStore';

const NUMERIC_LOCALE = 'en-US';
const fmtInt = (val) => Number(val || 0).toLocaleString(NUMERIC_LOCALE);

/**
 * Single daily-log row used inside the Performance tab's per-house raw
 * data tables. Tokens-only, RTL-safe. Layout in StyleSheet (§9 trap).
 */
export default function DailyLogRow({ log, onClick, t }) {
  const isRTL = useIsRTL();
  const {
    accentColor, mutedColor, textColor, dark,
  } = useHeroSheetTokens();

  const Icon = LOG_TYPE_ICONS[log.logType] || LOG_TYPE_ICONS.DAILY;
  const ChevronGlyph = isRTL ? ChevronLeft : ChevronRight;

  const pills = [];
  if (log.deaths) pills.push(`${fmtInt(log.deaths)} ${t ? t('batches.deathsShort', 'deaths') : 'deaths'}`);
  if (log.feedKg) pills.push(`${fmtInt(log.feedKg)} kg ${t ? t('batches.feedShort', 'feed') : 'feed'}`);
  if (log.averageWeight) pills.push(`${fmtInt(log.averageWeight)} g ${t ? t('batches.avgShort', 'avg') : 'avg'}`);
  if (log.temperature) pills.push(`${log.temperature}°C`);

  return (
    <Pressable
      onPressIn={() => Haptics.selectionAsync().catch(() => {})}
      onPress={onClick}
      android_ripple={{
        color: dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
        borderless: false,
      }}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: pressed
            ? (dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)')
            : 'transparent',
        },
      ]}
    >
      <View
        style={[
          styles.rowInner,
          { flexDirection: isRTL ? 'row-reverse' : 'row' },
        ]}
      >
        <View
          style={[
            styles.iconTile,
            {
              backgroundColor: dark
                ? 'rgba(148,210,165,0.12)'
                : 'hsl(148, 35%, 94%)',
            },
          ]}
        >
          <Icon size={14} color={accentColor} strokeWidth={2.2} />
        </View>
        <View style={styles.textCol}>
          <Text
            style={{
              fontSize: 14,
              fontFamily: 'Poppins-SemiBold',
              color: textColor,
              textAlign: isRTL ? 'right' : 'left',
            }}
            numberOfLines={1}
          >
            {log.logType || (t ? t('batches.logShort', 'Log') : 'Log')}
            {log.cycleDay
              ? ` · ${t ? t('batches.cycleDay', 'Day {{days}}', { days: log.cycleDay }) : `Day ${log.cycleDay}`}`
              : ''}
          </Text>
          {pills.length > 0 ? (
            <Text
              style={{
                fontSize: 12,
                fontFamily: 'Poppins-Regular',
                color: mutedColor,
                marginTop: 2,
                textAlign: isRTL ? 'right' : 'left',
              }}
              numberOfLines={1}
            >
              {pills.join(' · ')}
            </Text>
          ) : null}
        </View>
        <ChevronGlyph size={16} color={mutedColor} strokeWidth={2.2} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  rowInner: {
    alignItems: 'center',
    gap: 12,
  },
  iconTile: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textCol: {
    flex: 1,
    minWidth: 0,
  },
});
