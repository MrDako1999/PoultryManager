import { View, Text, StyleSheet } from 'react-native';
import { useHeroSheetTokens } from '@/components/HeroSheetScreen';
import { useIsRTL } from '@/stores/localeStore';
import { rowDirection, textAlignStart } from '@/lib/rtl';

/**
 * Compact KPI hero block used at the top of every accounting list view.
 *
 * Architecture (rewritten flat — no nested cards):
 *   - Uppercase eyebrow ABOVE the card
 *   - One card body with `sectionBg` background + soft shadow / hairline
 *     border. Inner content (headline, subline, stats grid) shares the
 *     same 18pt horizontal padding so nothing clips against the corners.
 *
 * Layout in StyleSheet (§9). Pure-presentational — no Pressable.
 */
export default function ListViewHeroKpi({
  title,
  icon: Icon,
  headline,
  headlinePrefix,
  headlineColor,
  subline,
  sublineColor,
  stats,
}) {
  const isRTL = useIsRTL();
  const tokens = useHeroSheetTokens();
  const {
    sectionBg, sectionBorder, mutedColor, textColor, borderColor, dark,
  } = tokens;

  return (
    <View style={styles.section}>
      {/* Eyebrow ABOVE the card */}
      {title ? (
        <View
          style={[
            styles.eyebrow,
            { flexDirection: rowDirection(isRTL) },
          ]}
        >
          {Icon ? <Icon size={13} color={mutedColor} strokeWidth={2.2} /> : null}
          <Text
            style={{
              fontSize: 11,
              lineHeight: 16,
              fontFamily: 'Poppins-SemiBold',
              color: mutedColor,
              letterSpacing: 1.2,
              textTransform: 'uppercase',
            }}
          >
            {title}
          </Text>
        </View>
      ) : null}

      <View
        style={[
          styles.card,
          {
            backgroundColor: sectionBg,
            borderColor: sectionBorder,
            borderWidth: 1,
            ...(dark
              ? {}
              : {
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.04,
                  shadowRadius: 8,
                  elevation: 1,
                }),
          },
        ]}
      >
        {(headline != null || headlinePrefix) ? (
          <View
            style={[
              styles.headlineRow,
              { flexDirection: rowDirection(isRTL) },
            ]}
          >
            {headlinePrefix ? (
              <Text
                style={{
                  fontSize: 18,
                  lineHeight: 32,
                  fontFamily: 'Poppins-SemiBold',
                  color: headlineColor || mutedColor,
                  marginEnd: 6,
                }}
              >
                {headlinePrefix}
              </Text>
            ) : null}
            <Text
              style={{
                flex: 1,
                fontSize: 28,
                lineHeight: 34,
                fontFamily: 'Poppins-Bold',
                color: headlineColor || textColor,
                letterSpacing: -0.4,
                textAlign: textAlignStart(isRTL),
              }}
              numberOfLines={1}
            >
              {headline}
            </Text>
          </View>
        ) : null}

        {subline ? (
          <Text
            style={{
              fontSize: 12,
              lineHeight: 16,
              fontFamily: 'Poppins-Medium',
              color: sublineColor || mutedColor,
              marginTop: 4,
              textAlign: textAlignStart(isRTL),
            }}
            numberOfLines={1}
          >
            {subline}
          </Text>
        ) : null}

        {Array.isArray(stats) && stats.length > 0 ? (
          <View
            style={[
              styles.statsRow,
              {
                flexDirection: rowDirection(isRTL),
                borderTopColor: borderColor,
                marginTop: (subline || headline != null) ? 16 : 0,
              },
            ]}
          >
            {stats.map((stat, i) => (
              <View
                key={stat.label || `s${i}`}
                style={[
                  styles.cellWrap,
                  { flexDirection: rowDirection(isRTL) },
                ]}
              >
                {i > 0 ? (
                  <View style={[styles.divider, { backgroundColor: borderColor }]} />
                ) : null}
                <View style={styles.cell}>
                  <View
                    style={[
                      styles.cellLabelRow,
                      { flexDirection: rowDirection(isRTL) },
                    ]}
                  >
                    {stat.icon ? (
                      <stat.icon size={11} color={mutedColor} strokeWidth={2.4} />
                    ) : null}
                    <Text
                      style={{
                        fontSize: 10,
                        lineHeight: 13,
                        fontFamily: 'Poppins-SemiBold',
                        color: mutedColor,
                        letterSpacing: 0.8,
                        textTransform: 'uppercase',
                      }}
                      numberOfLines={1}
                    >
                      {stat.label}
                    </Text>
                  </View>
                  <Text
                    style={{
                      fontSize: 14,
                      lineHeight: 18,
                      fontFamily: 'Poppins-SemiBold',
                      color: stat.valueColor || textColor,
                      textAlign: textAlignStart(isRTL),
                    }}
                    numberOfLines={1}
                  >
                    {stat.value}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
  eyebrow: {
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
    marginStart: 6,
  },
  card: {
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 18,
    overflow: 'hidden',
  },
  headlineRow: {
    alignItems: 'baseline',
  },
  statsRow: {
    paddingTop: 14,
    borderTopWidth: 1,
  },
  cellWrap: {
    flex: 1,
    alignItems: 'stretch',
  },
  divider: {
    width: 1,
    alignSelf: 'stretch',
    marginHorizontal: 8,
  },
  cell: {
    flex: 1,
    minWidth: 0,
    alignItems: 'flex-start',
  },
  cellLabelRow: {
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
});
