import { useRef, useState } from 'react';
import {
  View, Text, Pressable, KeyboardAvoidingView, Platform, ScrollView, Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import useThemeStore from '@/stores/themeStore';
import { useIsRTL } from '@/stores/localeStore';
import { rowDirection, leadingAlignment, textAlignStart } from '@/lib/rtl';

export function useHeroSheetTokens() {
  const { resolvedTheme } = useThemeStore();
  const dark = resolvedTheme === 'dark';

  return {
    dark,
    heroGradient: dark
      ? ['hsl(148, 65%, 14%)', 'hsl(148, 55%, 22%)', 'hsl(148, 48%, 30%)']
      : ['hsl(148, 60%, 22%)', 'hsl(148, 55%, 28%)', 'hsl(148, 48%, 36%)'],
    screenBg: dark ? 'hsl(150, 22%, 11%)' : 'hsl(140, 20%, 97%)',
    sheetBg: dark ? 'hsl(150, 18%, 14%)' : '#ffffff',
    cardBg: dark ? 'hsl(150, 16%, 18%)' : '#ffffff',
    inputBg: dark ? 'hsl(150, 16%, 18%)' : 'hsl(148, 18%, 96%)',
    inputBorderIdle: dark ? 'hsl(150, 14%, 24%)' : 'hsl(148, 14%, 88%)',
    inputBorderFocus: dark ? 'hsl(148, 55%, 50%)' : 'hsl(148, 60%, 30%)',
    textColor: dark ? '#f0f5f0' : '#0f1f10',
    mutedColor: dark ? 'hsl(148, 12%, 65%)' : 'hsl(150, 10%, 45%)',
    iconColor: dark ? 'hsl(148, 22%, 70%)' : 'hsl(148, 30%, 35%)',
    accentColor: dark ? 'hsl(148, 55%, 55%)' : 'hsl(148, 60%, 28%)',
    errorColor: dark ? '#fca5a5' : '#dc2626',
    borderColor: dark ? 'hsl(150, 14%, 22%)' : 'hsl(148, 14%, 90%)',
    sectionBg: dark ? 'hsl(150, 16%, 16%)' : '#ffffff',
    // Used by SheetSection's outer border in BOTH themes. In dark mode we
    // need a stronger edge than `borderColor` because sectionBg vs screenBg
    // only differ ~5% in lightness; without a visible outline the section
    // bleeds into the page. In light mode the white card vs the off-white
    // screen (#ffffff vs hsl(140,20%,97%)) is only a ~3% lightness step,
    // so the soft 0.04 shadow alone wasn't enough — section cards (and the
    // tables inside them on detail screens like SaleDetail) read as
    // floating, edgeless blobs. We bump the light-mode token to a 12% L
    // gap from white so the outline is unambiguous without feeling heavy.
    sectionBorder: dark ? 'hsl(150, 12%, 28%)' : 'hsl(148, 14%, 88%)',

    // Elevated surfaces (cards stacked inside a SheetSection / on top of
    // sectionBg). These need real contrast against sectionBg in *both*
    // themes, otherwise cards melt into the section in dark mode.
    elevatedCardBg: dark ? 'hsl(150, 14%, 22%)' : 'hsl(148, 22%, 95%)',
    elevatedCardBorder: dark ? 'hsl(150, 12%, 30%)' : 'hsl(148, 16%, 84%)',
    elevatedCardPressedBg: dark ? 'hsl(150, 16%, 28%)' : 'hsl(148, 22%, 89%)',
  };
}

const AnimatedScrollView = Animated.createAnimatedComponent(ScrollView);
const AnimatedLinearGradient = Animated.createAnimatedComponent(LinearGradient);

/**
 * Hero gradient + bottom sheet layout.
 *
 * Two scroll modes:
 *
 * - **Default (fixed hero)** — `scrollableHero={false}`. Hero is rendered as
 *   a fixed sibling of the sheet's ScrollView. The hero never scrolls. Use
 *   this for every form, sub-page, and detail screen. This is the design
 *   language's default rule (see DESIGN_LANGUAGE.md §1 "Critical scroll rule").
 *
 * - **Scrollable hero** — `scrollableHero={true}`. The full hero scrolls
 *   away with the content. A compact pinned toolbar (small title + the
 *   `headerRight` slot) fades in once the user scrolls past the gradient.
 *   Use this ONLY for tab landing screens that benefit from the "feed" feel
 *   (currently: dashboard). Sub-pages and forms must keep the fixed hero so
 *   the title and back button never collide with the status bar.
 *
 * @param {object} props
 * @param {string} props.title - Hero heading
 * @param {string} [props.subtitle] - Hero subtitle below the heading
 * @param {boolean} [props.showBack=true] - Show the back chevron
 * @param {() => void} [props.onBack] - Custom back handler (defaults to router.back())
 * @param {ReactNode} [props.headerRight] - Optional element rendered top-right of the hero
 * @param {ReactNode} [props.heroExtra] - Optional element rendered above the title (avatar, banner, etc.)
 * @param {ReactNode} [props.heroBelow] - Optional element rendered below the title inside the hero
 * @param {boolean} [props.scrollable=true] - Wrap children in ScrollView
 * @param {boolean} [props.scrollableHero=false] - Make the hero scroll with content (see notes above)
 * @param {boolean} [props.keyboardAvoiding=false] - Wrap in KeyboardAvoidingView for forms
 * @param {object} [props.contentStyle] - Style overrides for the sheet content padding
 * @param {ReactNode} [props.refreshControl] - RefreshControl element passed to the inner ScrollView (only used when scrollable)
 * @param {'default'|'relaxed'} [props.heroComfort='default'] - `relaxed` adds air in the green hero (auth screens). Tab dashboards stay `default`.
 */
export default function HeroSheetScreen({
  title,
  subtitle,
  showBack = true,
  onBack,
  headerRight,
  heroExtra,
  heroBelow,
  scrollable = true,
  scrollableHero = false,
  keyboardAvoiding = false,
  heroComfort = 'default',
  contentStyle,
  refreshControl,
  children,
}) {
  const insets = useSafeAreaInsets();
  const tokens = useHeroSheetTokens();
  const { heroGradient, screenBg, sheetBg, dark } = tokens;
  const isRTL = useIsRTL();

  const scrollY = useRef(new Animated.Value(0)).current;

  // Tracks the scroll viewport / content height so scrollableHero mode can
  // suppress the compact pinned toolbar on short pages where the user
  // would otherwise see it half-faded over the still-visible full hero.
  const [viewportH, setViewportH] = useState(0);
  const [contentH, setContentH] = useState(0);

  const handleBack = () => {
    Haptics.selectionAsync();
    if (onBack) {
      onBack();
    } else {
      router.back();
    }
  };

  const relaxedHero = heroComfort === 'relaxed';

  // Dashboard-style hero: no back button but `heroExtra` + `headerRight` share
  // one row so the sync / module controls align with the icon tile. Tighter
  // top inset pulls the cluster up under the status bar slightly (`default`).
  // Auth flows pass `heroComfort="relaxed"` for more breathing room.
  const heroExtraHeaderMerged = !showBack && !!headerRight && !!heroExtra;
  const heroPaddingTop = insets.top + (
    heroExtraHeaderMerged
      ? (relaxedHero ? 18 : 4)
      : (showBack || headerRight ? (relaxedHero ? 16 : 8) : (relaxedHero ? 32 : 28))
  );
  const heroGradientPaddingBottom = relaxedHero ? 68 : 56;
  // Auth: extra air below the logo/toolbar row before the headline; headline
  // + subtitle stay a tight pair via `heroTitleBlockGap`.
  const mergedToolbarMarginBottom = relaxedHero ? 40 : 12;
  const classicToolbarMarginBottom = relaxedHero ? 22 : 18;
  const heroExtraMarginBottom = relaxedHero ? 30 : 14;
  const heroTitleBlockGap = relaxedHero ? 4 : 6;
  const BackIcon = isRTL ? ChevronRight : ChevronLeft;

  // The hero is built as two pieces:
  //   1. `heroInner` — the toolbar + heroExtra + title block + heroBelow
  //      content. Always the same regardless of mode.
  //   2. `HeroBlock` — wraps `heroInner` in either a LinearGradient
  //      (default fixed-hero mode) or a transparent View
  //      (scrollableHero mode). In scrollableHero mode the gradient is
  //      drawn ONCE by a static layer behind the ScrollView, sized to
  //      extend above and across the hero content. The hero text then
  //      floats on top of that single gradient. With only one gradient
  //      surface in play, overscroll-bouncing reveals the same gradient
  //      continuously instead of stitching two differently-projected
  //      LinearGradients together at a visible seam.
  const heroInner = (
    <>
      {heroExtraHeaderMerged ? (
        <View
          style={{
            flexDirection: rowDirection(isRTL),
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: mergedToolbarMarginBottom,
            gap: 12,
          }}
        >
          <View style={{ alignItems: leadingAlignment(isRTL) }}>
            {heroExtra}
          </View>
          <View
            style={{
              flexDirection: rowDirection(isRTL),
              alignItems: 'center',
              gap: 8,
            }}
          >
            {headerRight}
          </View>
        </View>
      ) : (
        <>
          {(showBack || headerRight) && (
            <View
              style={{
                flexDirection: rowDirection(isRTL),
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: classicToolbarMarginBottom,
                minHeight: 36,
              }}
            >
              {showBack ? (
                <Pressable
                  onPress={handleBack}
                  hitSlop={10}
                  style={{
                    height: 36,
                    width: 36,
                    borderRadius: 18,
                    backgroundColor: 'rgba(255,255,255,0.18)',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <BackIcon size={22} color="#ffffff" strokeWidth={2.4} />
                </Pressable>
              ) : (
                <View style={{ width: 36 }} />
              )}
              {headerRight ? <View>{headerRight}</View> : <View />}
            </View>
          )}

          {heroExtra ? (
            <View
              style={{
                marginBottom: heroExtraMarginBottom,
                alignItems: leadingAlignment(isRTL),
              }}
            >
              {heroExtra}
            </View>
          ) : null}
        </>
      )}

      <View style={{ gap: heroTitleBlockGap }}>
        <Text
          style={{
            fontSize: 28,
            fontFamily: 'Poppins-Bold',
            color: '#ffffff',
            letterSpacing: -0.5,
            lineHeight: 34,
            textAlign: textAlignStart(isRTL),
            writingDirection: isRTL ? 'rtl' : 'ltr',
          }}
        >
          {title}
        </Text>
        {subtitle && (
          <Text
            style={{
              fontSize: 14,
              fontFamily: 'Poppins-Regular',
              color: 'rgba(255,255,255,0.85)',
              lineHeight: 20,
              textAlign: textAlignStart(isRTL),
              writingDirection: isRTL ? 'rtl' : 'ltr',
            }}
          >
            {subtitle}
          </Text>
        )}
      </View>

      {heroBelow && <View style={{ marginTop: 18 }}>{heroBelow}</View>}
    </>
  );

  const heroPadding = {
    paddingTop: heroPaddingTop,
    paddingBottom: heroGradientPaddingBottom,
    paddingHorizontal: 20,
  };

  const HeroBlock = scrollableHero ? (
    <View style={[heroPadding, { backgroundColor: 'transparent' }]}>
      {heroInner}
    </View>
  ) : (
    <LinearGradient
      colors={heroGradient}
      start={isRTL ? { x: 1, y: 0 } : { x: 0, y: 0 }}
      end={isRTL ? { x: 0, y: 1 } : { x: 1, y: 1 }}
      style={heroPadding}
    >
      {heroInner}
    </LinearGradient>
  );

  // Outer wrapper (the rounded sheet shell) — handles bg, radius, shadow,
  // and the negative margin overlap with the gradient.
  const sheetShellStyle = {
    flex: 1,
    backgroundColor: sheetBg,
    marginTop: -24,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: dark ? 0.4 : 0.06,
    shadowRadius: 12,
    elevation: 8,
    overflow: 'hidden',
  };

  // Inner content container — holds children. `contentStyle` from callers
  // applies here so things like `paddingHorizontal` and `gap` work as
  // expected on the actual content stack rather than the sheet shell.
  const sheetContentStyle = {
    paddingTop: 24,
    paddingBottom: insets.bottom + 24,
  };

  const compactBarContentHeight = 36;

  // SCROLLABLE-HERO MODE: hero scrolls inside the same ScrollView as the
  // sheet, and a compact pinned toolbar fades in once the user scrolls past
  // the gradient. Used by the dashboard and detail screens.
  if (scrollableHero) {
    const compactBarHeight = insets.top + 8 + compactBarContentHeight + 8;

    // Distance the user must scroll before the compact bar fully fades in.
    // Calibrated to roughly the height of the title block; the user pulls the
    // greeting up under the status bar before the compact bar takes over.
    const FADE_START = 80;
    const FADE_END = 140;

    // The compact toolbar is only useful when the user can actually scroll
    // far enough to push the hero past the fade window. On short pages
    // (think an Expense Detail with no docs) the content fits in one
    // viewport and bouncing/over-scrolling would otherwise reveal the
    // toolbar half-faded over the still-visible hero — looks broken. Wait
    // until we've measured both viewport + content before deciding so the
    // first paint never flashes the toolbar.
    const measured = viewportH > 0 && contentH > 0;
    const canCompact = measured && (contentH - viewportH) >= FADE_END;

    const compactOpacity = scrollY.interpolate({
      inputRange: [FADE_START, FADE_END],
      outputRange: [0, 1],
      extrapolate: 'clamp',
    });
    const compactTranslateY = scrollY.interpolate({
      inputRange: [FADE_START, FADE_END],
      outputRange: [-compactBarHeight * 0.25, 0],
      extrapolate: 'clamp',
    });

    // Single gradient layer behind the ScrollView. It serves THREE
    // purposes simultaneously:
    //   1. Paints the visual hero (the in-flow HeroBlock above is now
    //      transparent in scrollableHero mode — the text floats on this
    //      layer).
    //   2. Fills any overscroll-bounce pull-down area with the same
    //      gradient continuously (no seam — there's only one gradient).
    //   3. Covered by the sheet's solid `sheetBg` once the user scrolls
    //      past the hero, so it never bleeds into the page below.
    // The layer covers the top ~65% of the parent so a hard pull-down
    // never reveals the bare sheet colour underneath, even on smaller
    // viewports.
    const Body = (
      <View style={{ flex: 1, backgroundColor: sheetBg }}>
        <LinearGradient
          pointerEvents="none"
          colors={heroGradient}
          start={isRTL ? { x: 1, y: 0 } : { x: 0, y: 0 }}
          end={isRTL ? { x: 0, y: 1 } : { x: 1, y: 1 }}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: '25%',
          }}
        />
        <AnimatedScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={!!refreshControl}
          refreshControl={refreshControl}
          scrollEventThrottle={16}
          onLayout={(e) => setViewportH(e.nativeEvent.layout.height)}
          onContentSizeChange={(_, h) => setContentH(h)}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: true }
          )}
        >
          {HeroBlock}
          <View style={[sheetShellStyle, sheetContentStyle, contentStyle]}>
            {children}
          </View>
        </AnimatedScrollView>

        {/* Compact pinned toolbar — fades in once the gradient hero scrolls
            past the fade window. Sits above the scroll view via absolute
            positioning. Uses the same brand gradient so it visually feels
            like the hero collapsing into a bar.

            Only rendered when the content is actually tall enough to scroll
            past the fade window — otherwise short pages (e.g. an Expense
            Detail with no docs) would show the compact bar partially faded
            on top of the still-visible full hero, which looks broken. */}
        {canCompact ? (
        <Animated.View
          pointerEvents="box-none"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            opacity: compactOpacity,
            transform: [{ translateY: compactTranslateY }],
          }}
        >
          <AnimatedLinearGradient
            colors={heroGradient}
            start={isRTL ? { x: 1, y: 0 } : { x: 0, y: 0 }}
            end={isRTL ? { x: 0, y: 1 } : { x: 1, y: 1 }}
            style={{
              paddingTop: insets.top + 8,
              paddingBottom: 8,
              paddingHorizontal: 20,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: dark ? 0.4 : 0.12,
              shadowRadius: 6,
              elevation: 6,
            }}
          >
            <View
              style={{
                flexDirection: rowDirection(isRTL),
                alignItems: 'center',
                gap: 12,
                minHeight: compactBarContentHeight,
              }}
            >
              {showBack ? (
                <Pressable
                  onPress={handleBack}
                  hitSlop={10}
                  style={{
                    height: 36,
                    width: 36,
                    borderRadius: 18,
                    backgroundColor: 'rgba(255,255,255,0.18)',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <BackIcon size={20} color="#ffffff" strokeWidth={2.4} />
                </Pressable>
              ) : null}
              <Text
                style={{
                  flex: 1,
                  fontSize: 16,
                  fontFamily: 'Poppins-SemiBold',
                  color: '#ffffff',
                  letterSpacing: -0.2,
                  textAlign: textAlignStart(isRTL),
                  writingDirection: isRTL ? 'rtl' : 'ltr',
                }}
                numberOfLines={1}
              >
                {title}
              </Text>
              {headerRight ? <View>{headerRight}</View> : null}
            </View>
          </AnimatedLinearGradient>
        </Animated.View>
        ) : null}
      </View>
    );

    const Inner = keyboardAvoiding ? (
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {Body}
      </KeyboardAvoidingView>
    ) : (
      Body
    );

    return <View style={{ flex: 1, backgroundColor: screenBg }}>{Inner}</View>;
  }

  // DEFAULT (FIXED HERO) MODE: hero is anchored, only the sheet scrolls.
  const Sheet = scrollable ? (
    <View style={sheetShellStyle}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[sheetContentStyle, contentStyle]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        bounces={!!refreshControl}
        refreshControl={refreshControl}
      >
        {children}
      </ScrollView>
    </View>
  ) : (
    <View style={[sheetShellStyle, sheetContentStyle, contentStyle]}>
      {children}
    </View>
  );

  const Body = (
    <View style={{ flex: 1 }}>
      {HeroBlock}
      {Sheet}
    </View>
  );

  const Inner = keyboardAvoiding ? (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {Body}
    </KeyboardAvoidingView>
  ) : (
    Body
  );

  return <View style={{ flex: 1, backgroundColor: screenBg }}>{Inner}</View>;
}
