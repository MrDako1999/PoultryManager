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

  const heroPaddingTop = insets.top + (showBack || headerRight ? 8 : 28);
  const BackIcon = isRTL ? ChevronRight : ChevronLeft;

  // The hero rendered as a content block — used both as the fixed hero (default)
  // and as the first item inside the ScrollView when `scrollableHero` is on.
  const HeroBlock = (
    <LinearGradient
      colors={heroGradient}
      start={isRTL ? { x: 1, y: 0 } : { x: 0, y: 0 }}
      end={isRTL ? { x: 0, y: 1 } : { x: 1, y: 1 }}
      style={{
        paddingTop: heroPaddingTop,
        paddingBottom: 56,
        paddingHorizontal: 20,
      }}
    >
      {(showBack || headerRight) && (
        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 18,
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

      {heroExtra && (
        <View style={{ marginBottom: 14, alignItems: isRTL ? 'flex-end' : 'flex-start' }}>
          {heroExtra}
        </View>
      )}

      <View style={{ gap: 6 }}>
        <Text
          style={{
            fontSize: 28,
            fontFamily: 'Poppins-Bold',
            color: '#ffffff',
            letterSpacing: -0.5,
            lineHeight: 34,
            textAlign: isRTL ? 'right' : 'left',
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
              textAlign: isRTL ? 'right' : 'left',
              writingDirection: isRTL ? 'rtl' : 'ltr',
            }}
          >
            {subtitle}
          </Text>
        )}
      </View>

      {heroBelow && <View style={{ marginTop: 18 }}>{heroBelow}</View>}
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

  // SCROLLABLE-HERO MODE: hero scrolls inside the same ScrollView as the
  // sheet, and a compact pinned toolbar fades in once the user scrolls past
  // the gradient. Used by the dashboard and detail screens.
  if (scrollableHero) {
    // The compact toolbar height (status bar + 8pt + 36pt content + 8pt).
    const compactBarContentHeight = 36;
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

    // Two stacked backgrounds behind the ScrollView so each bounce edge
    // continues the colour of the layer the user is looking at:
    //   - top bounce reveals the gradient overlay (matches the hero)
    //   - bottom bounce reveals the wrapper (matches the sheet)
    // Without this split, bouncing past the end of the content exposes a
    // strip of brand green below the white/dark sheet, which reads as a
    // broken background. Both colours are theme-aware via tokens.
    const Body = (
      <View style={{ flex: 1, backgroundColor: sheetBg }}>
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: '50%',
            backgroundColor: heroGradient[0],
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
                flexDirection: isRTL ? 'row-reverse' : 'row',
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
                  textAlign: isRTL ? 'right' : 'left',
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
