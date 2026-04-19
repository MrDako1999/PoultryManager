import { View, Text, Pressable, StyleSheet } from 'react-native';
import { ChevronRight, ChevronLeft } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useHeroSheetTokens } from '@/components/HeroSheetScreen';
import { useIsRTL } from '@/stores/localeStore';

/**
 * BatchKpiCard — single reusable KPI card used across Batch Detail tabs.
 *
 * Architecture (rewritten flat — no nested cards):
 *   - Uppercase eyebrow ("CYCLE PERFORMANCE") rendered ABOVE the card,
 *     matching the SheetSection pattern but inlined so we don't double-up
 *     surfaces.
 *   - One card body with `sectionBg` background, rounded 18, shadow (light)
 *     or hairline border (dark) — the design language §6 SheetSection
 *     recipe applied directly.
 *   - All content sits inside the card with consistent 18pt horizontal
 *     padding so nothing ever clips against the rounded corners.
 *   - Optional headline + subline + free-form children + 3-cell stat grid.
 *
 * Layout in StyleSheet (§9 NativeWind trap rule). The functional Pressable
 * style is reserved for press-state visuals only (background + border
 * shift, tiny scale + opacity).
 */
export default function BatchKpiCard({
  title,
  icon: Icon,
  headline,
  headlinePrefix,
  headlineColor,
  subline,
  sublineColor,
  children,
  stats,
  onPress,
}) {
  const isRTL = useIsRTL();
  const tokens = useHeroSheetTokens();
  const {
    mutedColor, textColor, borderColor, dark,
    sectionBg, sectionBorder,
  } = tokens;

  const ChevronGlyph = isRTL ? ChevronLeft : ChevronRight;
  const tappable = typeof onPress === 'function';

  // Inner content rendered inside the card body. Lives in a single Padding
  // wrapper so every block (headline, subline, children, stats) shares the
  // same horizontal indentation.
  const Inner = (
    <>
      {/* Headline + chevron row */}
      {(headline != null || headlinePrefix || tappable) ? (
        <View
          style={[
            styles.headlineRow,
            { flexDirection: isRTL ? 'row-reverse' : 'row' },
          ]}
        >
          <View
            style={[
              styles.headlineTextRow,
              { flexDirection: isRTL ? 'row-reverse' : 'row' },
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
            {headline != null ? (
              <Text
                style={{
                  flex: 1,
                  fontSize: 28,
                  lineHeight: 34,
                  fontFamily: 'Poppins-Bold',
                  color: headlineColor || textColor,
                  letterSpacing: -0.4,
                  textAlign: isRTL ? 'right' : 'left',
                }}
                numberOfLines={1}
              >
                {headline}
              </Text>
            ) : null}
          </View>
          {tappable ? (
            <ChevronGlyph
              size={18}
              color={mutedColor}
              strokeWidth={2.2}
              style={{ marginStart: 12 }}
            />
          ) : null}
        </View>
      ) : null}

      {/* Subline */}
      {subline ? (
        <Text
          style={{
            fontSize: 12,
            lineHeight: 16,
            fontFamily: 'Poppins-Medium',
            color: sublineColor || mutedColor,
            marginTop: 4,
            textAlign: isRTL ? 'right' : 'left',
          }}
          numberOfLines={1}
        >
          {subline}
        </Text>
      ) : null}

      {/* Free-form body (progress bar, per-house list, feed bars, etc.) */}
      {children ? <View style={{ marginTop: 14 }}>{children}</View> : null}

      {/* Stat grid — 3 cells with hairline dividers, separated from the
          body above by a top hairline + clear top padding. */}
      {Array.isArray(stats) && stats.length > 0 ? (
        <View
          style={[
            styles.statsRow,
            {
              flexDirection: isRTL ? 'row-reverse' : 'row',
              borderTopColor: borderColor,
              marginTop: (children || subline || headline != null) ? 16 : 0,
            },
          ]}
        >
          {stats.map((stat, i) => (
            <View
              key={stat.label || `s${i}`}
              style={[
                styles.statsCellWrap,
                { flexDirection: isRTL ? 'row-reverse' : 'row' },
              ]}
            >
              {i > 0 ? (
                <View
                  style={[
                    styles.statsDivider,
                    { backgroundColor: borderColor },
                  ]}
                />
              ) : null}
              <StatCell
                icon={stat.icon}
                label={stat.label}
                value={stat.value}
                valueColor={stat.valueColor}
                subValue={stat.subValue}
                subValueColor={stat.subValueColor}
                isRTL={isRTL}
                mutedColor={mutedColor}
                textColor={textColor}
              />
            </View>
          ))}
        </View>
      ) : null}
    </>
  );

  // Card body styling — flat, no nested elevated layer. Both themes get a
  // 1px `sectionBorder` outline; light mode also gets a soft shadow for
  // depth, dark mode skips it (the brighter border carries the edge).
  //
  // CRITICAL (DESIGN_LANGUAGE.md §9): all layout-bearing styles
  // (padding, borderRadius, shadow, background) live in StyleSheet so
  // NativeWind's react-native-css-interop doesn't strip them on the
  // tappable Pressable variant. The functional `style={({ pressed }) =>}`
  // is reserved for press-state visual deltas only (scale, opacity).
  const cardBaseStyle = [
    styles.card,
    {
      backgroundColor: sectionBg,
      borderColor: sectionBorder,
      borderWidth: 1,
    },
    dark ? null : styles.cardShadowLight,
  ];

  return (
    <View style={styles.section}>
      {/* Eyebrow ABOVE the card — uppercase label + optional icon */}
      {title ? (
        <View
          style={[
            styles.eyebrow,
            { flexDirection: isRTL ? 'row-reverse' : 'row' },
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

      {/* CRITICAL (DESIGN_LANGUAGE.md §9): Pressable's `style` MUST be a
          static reference, never the functional `({pressed}) => [...]`
          form, otherwise NativeWind's css-interop strips layout-bearing
          properties (padding, borderRadius, backgroundColor, shadow…) and
          the card renders as an invisible content-only block.

          For press feedback we lean on `android_ripple` (Android) and the
          immediate navigation tap-through (iOS) instead of a press-state
          background swap. */}
      {tappable ? (
        <Pressable
          onPressIn={() => Haptics.selectionAsync().catch(() => {})}
          onPress={onPress}
          android_ripple={{
            color: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
            borderless: false,
          }}
          style={cardBaseStyle}
        >
          {Inner}
        </Pressable>
      ) : (
        <View style={cardBaseStyle}>{Inner}</View>
      )}
    </View>
  );
}

/**
 * StatCell — single column inside a 3-cell grid. Exported so other tabs can
 * compose their own stat rows without going through BatchKpiCard.
 *
 * Optional `subValue` stacks below the headline value (smaller, muted) —
 * useful for "House 3 / 18.96%" style cells where one line would truncate.
 */
export function StatCell({
  icon: Icon, label, value, valueColor, subValue, subValueColor,
  isRTL, mutedColor, textColor,
}) {
  return (
    <View style={statStyles.cell}>
      <View
        style={[
          statStyles.labelRow,
          { flexDirection: isRTL ? 'row-reverse' : 'row' },
        ]}
      >
        {Icon ? <Icon size={11} color={mutedColor} strokeWidth={2.4} /> : null}
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
          {label}
        </Text>
      </View>
      <Text
        style={{
          fontSize: 14,
          lineHeight: 18,
          fontFamily: 'Poppins-SemiBold',
          color: valueColor || textColor,
          textAlign: isRTL ? 'right' : 'left',
        }}
        numberOfLines={1}
      >
        {value}
      </Text>
      {subValue ? (
        <Text
          style={{
            fontSize: 11,
            lineHeight: 15,
            fontFamily: 'Poppins-Medium',
            color: subValueColor || mutedColor,
            textAlign: isRTL ? 'right' : 'left',
            marginTop: 2,
          }}
          numberOfLines={1}
        >
          {subValue}
        </Text>
      ) : null}
    </View>
  );
}

// -----------------------------------------------------------------------------
// Tone helpers — shared so every tab colors numbers consistently.
// -----------------------------------------------------------------------------

export function profitToneColor(val, tokens) {
  if (val == null) return tokens.textColor;
  return val < 0 ? tokens.errorColor : tokens.accentColor;
}

export function mortalityToneColor(pct, tokens) {
  if (pct >= 5) return tokens.errorColor;
  if (pct >= 2) return tokens.dark ? '#fbbf24' : '#d97706';
  return tokens.accentColor;
}

const styles = StyleSheet.create({
  // Outer section wrapper — provides the screen gutter. Matches the
  // SheetSection contract (marginHorizontal: 16, marginBottom: 16) so
  // multiple stacked cards align with everything else on the page.
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
  // Card body — single flat surface. Padding values exceed borderRadius
  // (16) so inner text has clear room from the corner curves on every edge.
  card: {
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 18,
    overflow: 'hidden',
  },
  // Light-mode shadow held in a separate static style so NativeWind's
  // interop layer doesn't strip it when applied via the array form.
  cardShadowLight: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  headlineRow: {
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headlineTextRow: {
    flex: 1,
    alignItems: 'baseline',
  },
  statsRow: {
    paddingTop: 14,
    borderTopWidth: 1,
  },
  statsCellWrap: {
    flex: 1,
    alignItems: 'stretch',
  },
  statsDivider: {
    width: 1,
    alignSelf: 'stretch',
    marginHorizontal: 8,
  },
});

const statStyles = StyleSheet.create({
  cell: {
    flex: 1,
    minWidth: 0,
    alignItems: 'flex-start',
  },
  labelRow: {
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
});
