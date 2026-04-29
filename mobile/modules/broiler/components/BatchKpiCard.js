import { View, Text, Pressable, StyleSheet } from 'react-native';
import { ChevronRight, ChevronLeft } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useHeroSheetTokens } from '@/components/HeroSheetScreen';
import { useIsRTL } from '@/stores/localeStore';
import { rowDirection, textAlignStart } from '@/lib/rtl';

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
 *
 * @param {boolean} [headlinePrefixSubscript] - Renders `headlinePrefix` small
 *   and lowered (subscript-style) in `mutedColor`; headline keeps `headlineColor`.
 * @param {string} [headlineSuffix] - e.g. ISO currency after the amount (dashboard PNL).
 * @param {boolean} [headlineSuffixSubscript] - Same treatment as prefix subscript, after the figure.
 */
export default function BatchKpiCard({
  title,
  icon: Icon,
  headline,
  headlinePrefix,
  headlinePrefixSubscript = false,
  headlineSuffix,
  headlineSuffixSubscript = false,
  headlineColor,
  subline,
  sublineColor,
  children,
  stats,
  onPress,
  // Optional ReactNode rendered in the chevron's position (top
  // right of the headline row). When provided, the navigation
  // chevron is suppressed even if the card is tappable — the
  // consumer has explicitly claimed the slot for an inline
  // affordance (e.g. the kg/bags toggle on the Feed card). The
  // card-level `onPress` still fires when the user taps elsewhere
  // on the card; the inner Pressable in `headlineRight` consumes
  // its own touches via RN's responder system.
  headlineRight,
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
      {/* Headline + chevron / inline-action row */}
      {(headline != null || headlinePrefix || headlineSuffix || tappable || headlineRight) ? (
        <View
          style={[
            styles.headlineRow,
            { flexDirection: rowDirection(isRTL) },
          ]}
        >
          <View
            style={[
              styles.headlineTextRow,
              { flexDirection: rowDirection(isRTL) },
              (headlinePrefixSubscript || headlineSuffixSubscript)
                ? styles.headlineTextRowSubscript
                : null,
            ]}
          >
            {headlinePrefix ? (
              <Text
                style={
                  headlinePrefixSubscript
                    ? [styles.headlinePrefixSubscript, { color: mutedColor }]
                    : {
                        fontSize: 18,
                        lineHeight: 32,
                        fontFamily: 'Poppins-SemiBold',
                        color: headlineColor || mutedColor,
                        marginEnd: 6,
                      }
                }
              >
                {headlinePrefix}
              </Text>
            ) : null}
            <View
              style={[
                styles.headlineAmountCluster,
                headlineSuffix ? styles.headlineAmountClusterLTR : null,
              ]}
            >
              {headline != null ? (
                <Text
                  style={{
                    flex: headlineSuffix ? 0 : 1,
                    flexShrink: 1,
                    minWidth: 0,
                    fontSize: 28,
                    lineHeight: 34,
                    fontFamily: 'Poppins-Bold',
                    color: headlineColor || textColor,
                    letterSpacing: -0.4,
                    textAlign: headlineSuffix ? 'left' : (isRTL ? 'right' : 'left'),
                  }}
                  numberOfLines={1}
                >
                  {headline}
                </Text>
              ) : null}
              {headlineSuffix ? (
                <Text
                  style={
                    headlineSuffixSubscript
                      ? [styles.headlineSuffixSubscript, { color: mutedColor }]
                      : {
                          fontSize: 18,
                          lineHeight: 32,
                          fontFamily: 'Poppins-SemiBold',
                          color: headlineColor || mutedColor,
                          marginStart: 6,
                        }
                  }
                >
                  {headlineSuffix}
                </Text>
              ) : null}
            </View>
          </View>
          {headlineRight ? (
            // Pressable wrapper consumes touches in the 12px gap
            // between the headline cluster and the inline action so
            // the card-level `onPress` doesn't fire when the user
            // is aiming at the toggle and lands a hair to the side.
            // RN's responder system gives this no-op handler the
            // touch before it bubbles to the outer card.
            <Pressable
              onPress={() => {}}
              style={{ paddingStart: 12 }}
            >
              {headlineRight}
            </Pressable>
          ) : tappable ? (
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
            textAlign: textAlignStart(isRTL),
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
              flexDirection: rowDirection(isRTL),
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
                { flexDirection: rowDirection(isRTL) },
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
          { flexDirection: rowDirection(isRTL) },
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
          textAlign: textAlignStart(isRTL),
        }}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.82}
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
            textAlign: textAlignStart(isRTL),
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

// Maps a feed-inventory status (see computeFeedInventory) to the tone
// the KPI card should render the headline / subline / banner in.
//
//   ok        — comfortable runway, paint with accent (positive).
//   low       — 3–7 days runway, amber so it's noticed but not alarming.
//   critical  — under 3 days runway, red.
//   over      — consumed already exceeds tracked orders, also red — the
//               inventory math is under-water and the farmer needs to
//               either log more orders or accept the reorder cue.
//   untracked — no orders entered yet; muted because there's nothing
//               to project against.
export function feedStockToneColor(status, tokens) {
  switch (status) {
    case 'critical':
    case 'over':
      return tokens.errorColor;
    case 'low':
      return tokens.dark ? '#fbbf24' : '#d97706';
    case 'untracked':
      return tokens.mutedColor;
    case 'ok':
    default:
      return tokens.accentColor;
  }
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
  headlineTextRowSubscript: {
    alignItems: 'flex-end',
  },
  headlineAmountCluster: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    minWidth: 0,
  },
  headlineAmountClusterLTR: {
    direction: 'ltr',
  },
  headlinePrefixSubscript: {
    fontSize: 11,
    lineHeight: 13,
    fontFamily: 'Poppins-SemiBold',
    marginEnd: 5,
    marginBottom: 2,
    letterSpacing: 0.35,
    transform: [{ translateY: 3 }],
  },
  headlineSuffixSubscript: {
    fontSize: 11,
    lineHeight: 13,
    fontFamily: 'Poppins-SemiBold',
    marginStart: 5,
    marginBottom: 2,
    letterSpacing: 0.35,
    transform: [{ translateY: 3 }],
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
