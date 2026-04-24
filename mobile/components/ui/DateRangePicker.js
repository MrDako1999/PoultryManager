import { useState, useMemo, useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import {
  View, Text, Pressable, Modal, ScrollView, StyleSheet,
  Dimensions, PanResponder, Animated, Keyboard,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Calendar, ChevronLeft, ChevronRight, X, RotateCcw,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useHeroSheetTokens } from '@/components/HeroSheetScreen';
import { useIsRTL } from '@/stores/localeStore';
import { rowDirection, textAlignStart } from '@/lib/rtl';

/**
 * DateRangePicker — bottom sheet for picking a contiguous start → end date
 * range in a single calendar. Built on the design language (HeroSheet tokens
 * + sheet chrome from BottomPickerSheet). Compact: one calendar shows both
 * endpoints, with twin Start / End chips at the top and a quick-range row.
 *
 * Behavior:
 *   - Tapping a chip switches focus to that endpoint; a day-tap commits to
 *     the focused endpoint, then auto-advances focus.
 *   - If the user picks an end-date earlier than the current start, the
 *     two are swapped automatically (always renders as start ≤ end).
 *   - Selections auto-commit via `onChange({ from, to })` on every change,
 *     so dismissing the sheet (X / swipe / backdrop) leaves the range live.
 *   - Reset clears in place; Apply just closes the sheet (the value is
 *     already committed).
 *
 * Two ways to drive the trigger:
 *   1. Imperative — keep `open`/`onClose` undefined and grab a ref:
 *        const ref = useRef(null);
 *        ref.current?.open();
 *      Useful when the consumer paints its own trigger.
 *   2. Controlled — pass `open` + `onClose` to drive externally.
 *
 * @param {object} props
 * @param {boolean} [props.open] - Controlled open state. If omitted, use ref.open()/.close().
 * @param {() => void} [props.onClose] - Called when the sheet starts dismissing.
 * @param {{from?: string, to?: string} | null} props.value - ISO YYYY-MM-DD range.
 * @param {(next: {from?: string, to?: string} | null) => void} props.onChange
 * @param {string} [props.title] - Sheet title (default: "Date range")
 * @param {string} [props.subtitle] - Sheet subtitle
 */
const DateRangePicker = forwardRef(function DateRangePicker({
  open: controlledOpen,
  onClose,
  value,
  onChange,
  title,
  subtitle,
}, ref) {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const isRTL = useIsRTL();
  const tokens = useHeroSheetTokens();
  const {
    dark, sheetBg, accentColor, textColor, mutedColor, borderColor,
    inputBg, inputBorderIdle,
  } = tokens;

  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = controlledOpen != null ? controlledOpen : uncontrolledOpen;

  const [focus, setFocus] = useState('from'); // 'from' | 'to'
  const [viewYear, setViewYear] = useState(() => {
    const seed = parseIsoDate(value?.from) || parseIsoDate(value?.to) || new Date();
    return seed.getFullYear();
  });
  const [viewMonth, setViewMonth] = useState(() => {
    const seed = parseIsoDate(value?.from) || parseIsoDate(value?.to) || new Date();
    return seed.getMonth();
  });
  // 'days' shows the calendar grid, 'months' a 3x4 grid of months for the
  // active viewYear, 'years' a 3x4 grid of 12 years anchored on viewYear.
  // The user drills in by tapping the month / year header buttons and the
  // chevrons step the unit that matches the active mode.
  const [mode, setMode] = useState('days');

  const slideAnim = useRef(new Animated.Value(SHEET_HEIGHT)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;

  const slideOut = useCallback(() => {
    Keyboard.dismiss();
    Animated.parallel([
      Animated.timing(slideAnim, { toValue: SHEET_HEIGHT, duration: 200, useNativeDriver: true }),
      Animated.timing(backdropAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => {
      if (controlledOpen != null) {
        onClose?.();
      } else {
        setUncontrolledOpen(false);
      }
    });
  }, [slideAnim, backdropAnim, controlledOpen, onClose]);

  const slideIn = useCallback(() => {
    slideAnim.setValue(SHEET_HEIGHT);
    backdropAnim.setValue(0);
    Animated.parallel([
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 65, friction: 11 }),
      Animated.timing(backdropAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
    ]).start();
  }, [slideAnim, backdropAnim]);

  // Reseed view month/year + focus side every time the sheet opens.
  useEffect(() => {
    if (!open) return;
    const seed = parseIsoDate(value?.from) || parseIsoDate(value?.to) || new Date();
    setViewYear(seed.getFullYear());
    setViewMonth(seed.getMonth());
    setFocus(value?.from && !value?.to ? 'to' : 'from');
    setMode('days');
    requestAnimationFrame(() => slideIn());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useImperativeHandle(ref, () => ({
    open: () => {
      Keyboard.dismiss();
      if (controlledOpen != null) return;
      setUncontrolledOpen(true);
    },
    close: slideOut,
  }), [controlledOpen, slideOut]);

  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, g) => g.dy > 4,
    onPanResponderMove: (_, g) => {
      if (g.dy > 0) slideAnim.setValue(g.dy);
    },
    onPanResponderRelease: (_, g) => {
      if (g.dy > DISMISS_THRESHOLD || g.vy > 0.5) {
        slideOut();
      } else {
        Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 100, friction: 10 }).start();
      }
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [slideOut]);

  const fromIso = value?.from || '';
  const toIso = value?.to || '';
  const fromDate = parseIsoDate(fromIso);
  const toDate = parseIsoDate(toIso);
  const hasAny = !!(fromIso || toIso);

  const commit = useCallback((next) => {
    if (!next || (!next.from && !next.to)) {
      onChange?.(null);
      return;
    }
    const out = {};
    if (next.from) out.from = next.from;
    if (next.to) out.to = next.to;
    onChange?.(out);
  }, [onChange]);

  const handleDayPress = useCallback((day) => {
    Haptics.selectionAsync().catch(() => {});
    const picked = new Date(viewYear, viewMonth, day);
    const pickedIso = fmtIsoDate(picked);

    if (focus === 'from') {
      // If end exists and the new start is after it, swap to keep order.
      if (toIso && picked.getTime() > parseIsoDate(toIso).getTime()) {
        commit({ from: toIso, to: pickedIso });
      } else {
        commit({ from: pickedIso, to: toIso || undefined });
      }
      setFocus('to');
    } else {
      // Picking 'to'. If start exists and the new end is before it, swap.
      if (fromIso && picked.getTime() < parseIsoDate(fromIso).getTime()) {
        commit({ from: pickedIso, to: fromIso });
      } else {
        commit({ from: fromIso || undefined, to: pickedIso });
      }
      setFocus('from');
    }
  }, [viewYear, viewMonth, focus, fromIso, toIso, commit]);

  const handleReset = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    commit(null);
    setFocus('from');
  }, [commit]);

  const handlePreset = useCallback((p) => {
    Haptics.selectionAsync().catch(() => {});
    commit({ from: p.from, to: p.to });
    const seed = parseIsoDate(p.from);
    if (seed) {
      setViewYear(seed.getFullYear());
      setViewMonth(seed.getMonth());
    }
    setFocus('from');
  }, [commit]);

  // Side chevrons step the unit the active mode is browsing: a month in
  // days view, a year in months view, a 12-year page in years view.
  const stepBackward = useCallback(() => {
    Haptics.selectionAsync().catch(() => {});
    if (mode === 'months') { setViewYear((y) => y - 1); return; }
    if (mode === 'years') { setViewYear((y) => y - 12); return; }
    if (viewMonth === 0) { setViewMonth(11); setViewYear((y) => y - 1); }
    else setViewMonth((m) => m - 1);
  }, [viewMonth, mode]);

  const stepForward = useCallback(() => {
    Haptics.selectionAsync().catch(() => {});
    if (mode === 'months') { setViewYear((y) => y + 1); return; }
    if (mode === 'years') { setViewYear((y) => y + 12); return; }
    if (viewMonth === 11) { setViewMonth(0); setViewYear((y) => y + 1); }
    else setViewMonth((m) => m + 1);
  }, [viewMonth, mode]);

  const openMonthsMode = useCallback(() => {
    Haptics.selectionAsync().catch(() => {});
    setMode((m) => (m === 'months' ? 'days' : 'months'));
  }, []);

  const openYearsMode = useCallback(() => {
    Haptics.selectionAsync().catch(() => {});
    setMode((m) => (m === 'years' ? 'days' : 'years'));
  }, []);

  const pickMonth = useCallback((monthIdx) => {
    Haptics.selectionAsync().catch(() => {});
    setViewMonth(monthIdx);
    setMode('days');
  }, []);

  const pickYear = useCallback((year) => {
    Haptics.selectionAsync().catch(() => {});
    setViewYear(year);
    // Drop into the months grid so the user can keep zooming in without
    // detouring through the days view.
    setMode('months');
  }, []);

  const presets = useMemo(() => buildPresets(t), [t]);

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const monthLongLabel = useMemo(
    () => fmtMonthName(viewYear, viewMonth, i18n.language),
    [viewYear, viewMonth, i18n.language]
  );
  const yearOnlyLabel = useMemo(
    () => fmtYearOnly(viewYear, i18n.language),
    [viewYear, i18n.language]
  );
  const localizedWeekdays = useMemo(
    () => buildWeekdayLabels(i18n.language),
    [i18n.language]
  );
  const localizedMonthsShort = useMemo(
    () => buildShortMonthLabels(i18n.language),
    [i18n.language]
  );

  // 12-year page anchored on viewYear. Centred so the current year sits
  // close to the middle even when the user opens a far-flung date.
  const yearPageStart = Math.floor((viewYear - 2) / 12) * 12 + 2;
  const yearPageEnd = yearPageStart + 11;
  const yearList = useMemo(
    () => Array.from({ length: 12 }, (_, i) => yearPageStart + i),
    [yearPageStart]
  );

  // Build the calendar as explicit rows of seven cells. iOS would otherwise
  // round up `width: ${100/7}%` just enough to push the 7th cell of every
  // row to the next line, leaving the Saturday column empty. flex:1 cells
  // inside an explicit row divide the row evenly in actual pixels.
  const calendarRows = useMemo(() => {
    const daysInMonth = getDaysInMonth(viewYear, viewMonth);
    const firstDay = getFirstDayOfWeek(viewYear, viewMonth);
    const cells = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);
    const rows = [];
    for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
    return rows;
  }, [viewYear, viewMonth]);

  // Pre-compute day metadata so the loop stays light.
  const fromTs = fromDate ? new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate()).getTime() : null;
  const toTs = toDate ? new Date(toDate.getFullYear(), toDate.getMonth(), toDate.getDate()).getTime() : null;

  const inRangeBg = dark ? 'rgba(148,210,165,0.16)' : 'hsl(148, 35%, 92%)';

  // Prev/next chevrons swap when the layout is RTL so "previous" stays on
  // the leading edge regardless of reading direction.
  const PrevIcon = isRTL ? ChevronRight : ChevronLeft;
  const NextIcon = isRTL ? ChevronLeft : ChevronRight;
  const onLeadingNav = isRTL ? stepForward : stepBackward;
  const onTrailingNav = isRTL ? stepBackward : stepForward;

  const todayYear = today.getFullYear();
  const todayMonth = today.getMonth();

  // ---- Swipe / slide animation for the calendar body ---------------------
  // Mirrors the DatePicker so the two pickers feel identical: horizontal
  // pan or chevron tap slides the current grid out, runs the step at the
  // apex, then springs the new grid in from the opposite edge.
  const bodyTranslateX = useRef(new Animated.Value(0)).current;
  const bodyWidthRef = useRef(0);
  const isSliding = useRef(false);

  const onBodyLayout = useCallback((e) => {
    const w = e.nativeEvent.layout.width;
    if (w && w !== bodyWidthRef.current) bodyWidthRef.current = w;
  }, []);

  const animateSlide = useCallback((visualDirection, action) => {
    const w = bodyWidthRef.current;
    if (!w) { action(); return; }
    if (isSliding.current) bodyTranslateX.stopAnimation();
    isSliding.current = true;
    Animated.timing(bodyTranslateX, {
      toValue: visualDirection * w,
      duration: 160,
      useNativeDriver: true,
    }).start(() => {
      action();
      bodyTranslateX.setValue(-visualDirection * w);
      Animated.spring(bodyTranslateX, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }).start(() => { isSliding.current = false; });
    });
  }, [bodyTranslateX]);

  const animatedLeading = useCallback(() => {
    animateSlide(isRTL ? -1 : +1, onLeadingNav);
  }, [isRTL, onLeadingNav, animateSlide]);

  const animatedTrailing = useCallback(() => {
    animateSlide(isRTL ? +1 : -1, onTrailingNav);
  }, [isRTL, onTrailingNav, animateSlide]);

  const swipePan = useMemo(() => PanResponder.create({
    // Don't claim taps so day / month / year cells get pressed normally.
    onStartShouldSetPanResponder: () => false,
    // Only intercept once the gesture is clearly horizontal — keeps the
    // outer ScrollView free to handle vertical scrolling unimpeded.
    onMoveShouldSetPanResponder: (_, g) =>
      Math.abs(g.dx) > 12 && Math.abs(g.dx) > Math.abs(g.dy) * 1.4,
    onPanResponderGrant: () => {
      bodyTranslateX.stopAnimation();
      isSliding.current = false;
    },
    onPanResponderMove: (_, g) => { bodyTranslateX.setValue(g.dx); },
    onPanResponderRelease: (_, g) => {
      const SWIPE_DIST = 40;
      const SWIPE_VELOCITY = 0.3;
      if (Math.abs(g.dx) < SWIPE_DIST && Math.abs(g.vx) < SWIPE_VELOCITY) {
        Animated.spring(bodyTranslateX, {
          toValue: 0, useNativeDriver: true, tension: 80, friction: 11,
        }).start();
        return;
      }
      const visualDirection = g.dx > 0 ? +1 : -1;
      const swipingNext = isRTL ? g.dx > 0 : g.dx < 0;
      animateSlide(visualDirection, swipingNext ? onTrailingNav : onLeadingNav);
    },
    onPanResponderTerminate: () => {
      Animated.spring(bodyTranslateX, {
        toValue: 0, useNativeDriver: true, tension: 80, friction: 11,
      }).start();
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [isRTL, onLeadingNav, onTrailingNav, animateSlide]);

  return (
    <Modal transparent visible={open} animationType="none" onRequestClose={slideOut}>
      <View style={{ flex: 1 }}>
        <Animated.View
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', opacity: backdropAnim }}
        >
          <Pressable style={{ flex: 1 }} onPress={slideOut} />
        </Animated.View>

        <Animated.View
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: SHEET_HEIGHT,
            transform: [{ translateY: slideAnim }],
            backgroundColor: sheetBg,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            overflow: 'hidden',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -4 },
            shadowOpacity: dark ? 0.4 : 0.12,
            shadowRadius: 20,
            elevation: 16,
          }}
        >
          {/* Drag pill */}
          <View
            {...panResponder.panHandlers}
            style={styles.dragZone}
          >
            <View
              style={[
                styles.dragPill,
                { backgroundColor: dark ? 'hsl(150, 14%, 28%)' : 'hsl(148, 14%, 86%)' },
              ]}
            />
          </View>

          {/* Header — icon tile + title/subtitle + close X */}
          <View
            style={[
              styles.header,
              { flexDirection: rowDirection(isRTL) },
            ]}
          >
            <View
              style={[
                styles.iconTile,
                {
                  backgroundColor: dark ? 'rgba(148,210,165,0.16)' : 'hsl(148, 35%, 92%)',
                },
              ]}
            >
              <Calendar size={20} color={accentColor} strokeWidth={2.2} />
            </View>
            <View style={styles.headerTextCol}>
              <Text
                style={{
                  fontSize: 17,
                  fontFamily: 'Poppins-SemiBold',
                  color: textColor,
                  letterSpacing: -0.2,
                  textAlign: textAlignStart(isRTL),
                }}
                numberOfLines={1}
              >
                {title || t('common.dateRange', 'Date range')}
              </Text>
              {subtitle ? (
                <Text
                  style={{
                    fontSize: 13,
                    fontFamily: 'Poppins-Regular',
                    color: mutedColor,
                    marginTop: 1,
                    textAlign: textAlignStart(isRTL),
                  }}
                  numberOfLines={1}
                >
                  {subtitle}
                </Text>
              ) : null}
            </View>
            <Pressable
              onPress={slideOut}
              hitSlop={8}
              style={[
                styles.closeBtn,
                { backgroundColor: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)' },
              ]}
            >
              <X size={16} color={mutedColor} strokeWidth={2.4} />
            </Pressable>
          </View>

          <View style={{ height: 1, backgroundColor: borderColor }} />

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 16 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Twin endpoint chips */}
            <View
              style={[
                styles.endpointRow,
                { flexDirection: rowDirection(isRTL) },
              ]}
            >
              <EndpointChip
                label={t('common.from', 'From')}
                date={fromDate}
                focused={focus === 'from'}
                tokens={tokens}
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  setFocus('from');
                  if (fromDate) {
                    setViewYear(fromDate.getFullYear());
                    setViewMonth(fromDate.getMonth());
                  }
                }}
                isRTL={isRTL}
              />
              <View style={[styles.dash, { backgroundColor: borderColor }]} />
              <EndpointChip
                label={t('common.to', 'To')}
                date={toDate}
                focused={focus === 'to'}
                tokens={tokens}
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  setFocus('to');
                  if (toDate) {
                    setViewYear(toDate.getFullYear());
                    setViewMonth(toDate.getMonth());
                  } else if (fromDate) {
                    setViewYear(fromDate.getFullYear());
                    setViewMonth(fromDate.getMonth());
                  }
                }}
                isRTL={isRTL}
              />
            </View>

            {/* Quick range chips */}
            <View style={{ marginTop: 16 }}>
              <Text
                style={{
                  fontSize: 11,
                  fontFamily: 'Poppins-SemiBold',
                  color: mutedColor,
                  letterSpacing: 1.2,
                  textTransform: 'uppercase',
                  marginStart: 4,
                  marginBottom: 8,
                  textAlign: textAlignStart(isRTL),
                }}
              >
                {t('common.quickRanges', 'Quick ranges')}
              </Text>
              <View
                style={{
                  flexDirection: rowDirection(isRTL),
                  flexWrap: 'wrap',
                  gap: 8,
                }}
              >
                {presets.map((p) => {
                  const active = p.from === fromIso && p.to === toIso;
                  return (
                    <Pressable
                      key={p.key}
                      onPress={() => handlePreset(p)}
                      android_ripple={{
                        color: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                        borderless: false,
                      }}
                      style={[
                        styles.presetChip,
                        {
                          backgroundColor: active
                            ? accentColor
                            : (dark ? 'rgba(255,255,255,0.04)' : 'hsl(148, 18%, 94%)'),
                          borderColor: active
                            ? accentColor
                            : (dark ? 'hsl(150, 14%, 24%)' : 'hsl(148, 14%, 86%)'),
                        },
                      ]}
                    >
                      <Text
                        style={{
                          fontSize: 13,
                          fontFamily: 'Poppins-SemiBold',
                          color: active ? '#ffffff' : textColor,
                          letterSpacing: 0.1,
                        }}
                      >
                        {p.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Month / year / decade navigation. Chevrons step the unit
                that matches the active mode; tapping the month or year
                button drills into its picker grid. In years mode the
                centre shows the visible 12-year range. */}
            <View
              style={[
                styles.monthNav,
                { flexDirection: rowDirection(isRTL) },
              ]}
            >
              <Pressable
                onPress={animatedLeading}
                hitSlop={6}
                android_ripple={{
                  color: dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                  borderless: true,
                  radius: 18,
                }}
                style={[
                  styles.monthNavBtn,
                  { backgroundColor: dark ? 'rgba(255,255,255,0.04)' : 'hsl(148, 18%, 94%)' },
                ]}
                accessibilityRole="button"
                accessibilityLabel={t('datepicker.previous', 'Previous')}
              >
                <PrevIcon size={18} color={textColor} strokeWidth={2.2} />
              </Pressable>

              <View
                style={[
                  styles.monthNavCenter,
                  { flexDirection: rowDirection(isRTL) },
                ]}
              >
                {mode === 'days' ? (
                  <>
                    <HeaderButton
                      label={monthLongLabel}
                      onPress={openMonthsMode}
                      tokens={tokens}
                      accessibilityLabel={t('datepicker.changeMonth', 'Change month')}
                    />
                    <HeaderButton
                      label={yearOnlyLabel}
                      onPress={openYearsMode}
                      tokens={tokens}
                      accessibilityLabel={t('datepicker.changeYear', 'Change year')}
                    />
                  </>
                ) : null}

                {mode === 'months' ? (
                  <HeaderButton
                    label={yearOnlyLabel}
                    active
                    onPress={openYearsMode}
                    tokens={tokens}
                    accessibilityLabel={t('datepicker.changeYear', 'Change year')}
                  />
                ) : null}

                {mode === 'years' ? (
                  <Text
                    style={{
                      fontSize: 15,
                      fontFamily: 'Poppins-SemiBold',
                      color: textColor,
                      textAlign: 'center',
                      letterSpacing: -0.1,
                    }}
                    numberOfLines={1}
                  >
                    {`${fmtYearOnly(yearPageStart, i18n.language)} – ${fmtYearOnly(yearPageEnd, i18n.language)}`}
                  </Text>
                ) : null}
              </View>

              <Pressable
                onPress={animatedTrailing}
                hitSlop={6}
                android_ripple={{
                  color: dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                  borderless: true,
                  radius: 18,
                }}
                style={[
                  styles.monthNavBtn,
                  { backgroundColor: dark ? 'rgba(255,255,255,0.04)' : 'hsl(148, 18%, 94%)' },
                ]}
                accessibilityRole="button"
                accessibilityLabel={t('datepicker.next', 'Next')}
              >
                <NextIcon size={18} color={textColor} strokeWidth={2.2} />
              </Pressable>
            </View>

            {/* Swipe-aware body. Animated.View's translateX is driven by
                the pan gesture and the chevron buttons, giving each step
                a fluid slide-in instead of a jump-cut. */}
            <Animated.View
              {...swipePan.panHandlers}
              onLayout={onBodyLayout}
              style={[
                styles.swipeBody,
                { transform: [{ translateX: bodyTranslateX }] },
              ]}
            >
              {/* Weekday headers — days mode only */}
              {mode === 'days' ? (
                <View style={[styles.weekdayRow, { flexDirection: rowDirection(isRTL) }]}>
                  {localizedWeekdays.map((wd) => (
                    <View key={wd.key} style={styles.weekdayCell}>
                      <Text
                        style={{
                          fontSize: 11,
                          fontFamily: 'Poppins-SemiBold',
                          color: mutedColor,
                          letterSpacing: 0.6,
                        }}
                      >
                        {wd.label}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}

              {/* Calendar grid — explicit rows of 7 flex:1 cells. Avoids
                  the iOS sub-pixel overflow that wrapped Saturday onto the
                  next line under `width: ${100/7}%`. */}
              {mode === 'days' ? (
                <View style={styles.calendarGrid}>
                  {calendarRows.map((row, rowIdx) => (
                    <View
                      key={`row-${rowIdx}`}
                      style={[styles.calendarRow, { flexDirection: rowDirection(isRTL) }]}
                    >
                      {row.map((day, colIdx) => {
                        if (day === null) {
                          return <View key={`e-${rowIdx}-${colIdx}`} style={styles.cellWrap} />;
                        }
                        const dayDate = new Date(viewYear, viewMonth, day).getTime();
                        const isStart = fromTs != null && dayDate === fromTs;
                        const isEnd = toTs != null && dayDate === toTs;
                        const isInRange = fromTs != null && toTs != null && dayDate > fromTs && dayDate < toTs;
                        const isToday = dayDate === today.getTime();
                        const isSingleDay = isStart && isEnd;

                        return (
                          <View key={`d-${day}`} style={styles.cellWrap}>
                            {/* Range fill — sits behind the day disc, extends to cell edges so adjacent in-range days connect visually */}
                            {(isInRange || (isStart && toTs != null && !isSingleDay) || (isEnd && fromTs != null && !isSingleDay)) ? (
                              <View
                                style={[
                                  styles.rangeFill,
                                  {
                                    backgroundColor: inRangeBg,
                                    // Round the ends of the range strip on the start/end days so the strip
                                    // visually starts/ends at the disc rather than running off the cell edge.
                                    ...(isStart && !isSingleDay
                                      ? (isRTL
                                        ? { borderTopRightRadius: 16, borderBottomRightRadius: 16, end: '50%' }
                                        : { borderTopLeftRadius: 16, borderBottomLeftRadius: 16, start: '50%' })
                                      : null),
                                    ...(isEnd && !isSingleDay
                                      ? (isRTL
                                        ? { borderTopLeftRadius: 16, borderBottomLeftRadius: 16, start: '50%' }
                                        : { borderTopRightRadius: 16, borderBottomRightRadius: 16, end: '50%' })
                                      : null),
                                  },
                                ]}
                              />
                            ) : null}
                            <Pressable
                              onPress={() => handleDayPress(day)}
                              hitSlop={2}
                              android_ripple={{
                                color: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
                                borderless: true,
                                radius: 18,
                              }}
                              style={[
                                styles.dayDisc,
                                {
                                  backgroundColor: (isStart || isEnd) ? accentColor : 'transparent',
                                  borderWidth: !isStart && !isEnd && isToday ? 1.5 : 0,
                                  borderColor: accentColor,
                                  ...((isStart || isEnd) && !dark
                                    ? {
                                        shadowColor: accentColor,
                                        shadowOffset: { width: 0, height: 2 },
                                        shadowOpacity: 0.28,
                                        shadowRadius: 6,
                                        elevation: 4,
                                      }
                                    : {}),
                                },
                              ]}
                            >
                              <Text
                                style={{
                                  fontSize: 14,
                                  fontFamily: (isStart || isEnd) ? 'Poppins-Bold' : 'Poppins-Medium',
                                  color: (isStart || isEnd)
                                    ? '#ffffff'
                                    : isToday
                                      ? accentColor
                                      : textColor,
                                  letterSpacing: 0,
                                }}
                              >
                                {day}
                              </Text>
                            </Pressable>
                          </View>
                        );
                      })}
                    </View>
                  ))}
                </View>
              ) : null}

              {/* Months grid — 3 cols × 4 rows. The "selected" pill tracks
                  active navigation (viewMonth); months that contain either
                  endpoint of the saved range get an accent outline so the
                  user can see where their range sits. */}
              {mode === 'months' ? (
                <View style={styles.gridPad}>
                  <View style={[styles.monthsGrid, { flexDirection: rowDirection(isRTL) }]}>
                    {localizedMonthsShort.map((label, idx) => {
                      const isSelected = idx === viewMonth;
                      const fromHere = fromDate
                        && fromDate.getFullYear() === viewYear
                        && fromDate.getMonth() === idx;
                      const toHere = toDate
                        && toDate.getFullYear() === viewYear
                        && toDate.getMonth() === idx;
                      const isCommitted = !!(fromHere || toHere);
                      const isCurrent = !isCommitted
                        && todayYear === viewYear && todayMonth === idx;
                      return (
                        <View key={`m-${idx}`} style={styles.monthCellWrap}>
                          <Pressable
                            onPress={() => pickMonth(idx)}
                            android_ripple={{
                              color: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
                              borderless: false,
                            }}
                            style={[
                              styles.monthCell,
                              {
                                backgroundColor: isSelected
                                  ? accentColor
                                  : (dark ? 'rgba(255,255,255,0.04)' : 'hsl(148, 18%, 96%)'),
                                borderColor: isSelected
                                  ? accentColor
                                  : (isCommitted || isCurrent)
                                    ? accentColor
                                    : 'transparent',
                                borderWidth: (isSelected || isCommitted || isCurrent) ? 1.5 : 0,
                              },
                            ]}
                          >
                            <Text
                              style={{
                                fontSize: 13.5,
                                fontFamily: isSelected ? 'Poppins-Bold' : 'Poppins-SemiBold',
                                color: isSelected
                                  ? '#ffffff'
                                  : (isCommitted || isCurrent)
                                    ? accentColor
                                    : textColor,
                                letterSpacing: 0.1,
                              }}
                              numberOfLines={1}
                            >
                              {label}
                            </Text>
                          </Pressable>
                        </View>
                      );
                    })}
                  </View>
                </View>
              ) : null}

              {/* Years grid — 12-year page anchored on viewYear. Selected
                  pill tracks navigation; years containing either endpoint
                  get the accent outline. */}
              {mode === 'years' ? (
                <View style={styles.gridPad}>
                  <View style={[styles.monthsGrid, { flexDirection: rowDirection(isRTL) }]}>
                    {yearList.map((year) => {
                      const isSelected = year === viewYear;
                      const fromHere = fromDate && fromDate.getFullYear() === year;
                      const toHere = toDate && toDate.getFullYear() === year;
                      const isCommitted = !!(fromHere || toHere);
                      const isCurrent = !isCommitted && todayYear === year;
                      return (
                        <View key={`y-${year}`} style={styles.monthCellWrap}>
                          <Pressable
                            onPress={() => pickYear(year)}
                            android_ripple={{
                              color: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
                              borderless: false,
                            }}
                            style={[
                              styles.monthCell,
                              {
                                backgroundColor: isSelected
                                  ? accentColor
                                  : (dark ? 'rgba(255,255,255,0.04)' : 'hsl(148, 18%, 96%)'),
                                borderColor: isSelected
                                  ? accentColor
                                  : (isCommitted || isCurrent)
                                    ? accentColor
                                    : 'transparent',
                                borderWidth: (isSelected || isCommitted || isCurrent) ? 1.5 : 0,
                              },
                            ]}
                          >
                            <Text
                              style={{
                                fontSize: 13.5,
                                fontFamily: isSelected ? 'Poppins-Bold' : 'Poppins-SemiBold',
                                color: isSelected
                                  ? '#ffffff'
                                  : (isCommitted || isCurrent)
                                    ? accentColor
                                    : textColor,
                                letterSpacing: 0.1,
                              }}
                              numberOfLines={1}
                            >
                              {fmtYearOnly(year, i18n.language)}
                            </Text>
                          </Pressable>
                        </View>
                      );
                    })}
                  </View>
                </View>
              ) : null}
            </Animated.View>
          </ScrollView>

          {/* Footer — Reset (leading) + Apply (trailing) */}
          <View
            style={[
              styles.footer,
              {
                flexDirection: rowDirection(isRTL),
                paddingBottom: insets.bottom + 12,
                borderTopColor: borderColor,
                backgroundColor: sheetBg,
              },
            ]}
          >
            <Pressable
              onPress={handleReset}
              disabled={!hasAny}
              android_ripple={{
                color: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                borderless: false,
              }}
              style={[
                styles.resetBtn,
                {
                  borderColor: dark ? 'hsl(150, 14%, 24%)' : 'hsl(148, 14%, 88%)',
                  opacity: hasAny ? 1 : 0.5,
                },
              ]}
            >
              <View
                style={[
                  styles.resetInner,
                  { flexDirection: rowDirection(isRTL) },
                ]}
              >
                <RotateCcw size={15} color={mutedColor} strokeWidth={2.2} />
                <Text
                  style={{
                    fontSize: 14,
                    fontFamily: 'Poppins-SemiBold',
                    color: mutedColor,
                  }}
                >
                  {t('common.reset', 'Reset')}
                </Text>
              </View>
            </Pressable>
            <Pressable
              onPress={slideOut}
              android_ripple={{ color: 'rgba(255,255,255,0.18)', borderless: false }}
              style={[styles.applyBtn, { backgroundColor: accentColor }]}
            >
              <Text
                style={{
                  fontSize: 15,
                  fontFamily: 'Poppins-SemiBold',
                  color: '#ffffff',
                  letterSpacing: 0.1,
                }}
              >
                {t('common.apply', 'Apply')}
              </Text>
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
});

export default DateRangePicker;

// -----------------------------------------------------------------------------
// EndpointChip — twin Start / End trigger at the top of the sheet. Tapping
// switches focus to that endpoint; the calendar then commits taps to it.
// -----------------------------------------------------------------------------

function EndpointChip({ label, date, focused, tokens, onPress, isRTL }) {
  const { dark, accentColor, textColor, mutedColor, inputBg, inputBorderIdle } = tokens;
  const dateStr = date ? fmtChipDate(date) : null;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.endpointChip,
        {
          backgroundColor: focused
            ? (dark ? 'rgba(148,210,165,0.10)' : 'hsl(148, 35%, 96%)')
            : (pressed
              ? (dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)')
              : inputBg),
          borderColor: focused ? accentColor : inputBorderIdle,
        },
      ]}
    >
      <View style={styles.endpointInner}>
        <Text
          style={{
            fontSize: 10,
            fontFamily: 'Poppins-SemiBold',
            color: focused ? accentColor : mutedColor,
            letterSpacing: 1.2,
            textTransform: 'uppercase',
            textAlign: textAlignStart(isRTL),
          }}
        >
          {label}
        </Text>
        <Text
          style={{
            fontSize: 15,
            fontFamily: 'Poppins-SemiBold',
            color: dateStr ? textColor : mutedColor,
            marginTop: 2,
            textAlign: textAlignStart(isRTL),
          }}
          numberOfLines={1}
        >
          {dateStr || '—'}
        </Text>
      </View>
    </Pressable>
  );
}

// -----------------------------------------------------------------------------
// HeaderButton — pressable label for the month and year drill-down controls
// in the calendar header. Styled to match the side chevrons so all four
// header controls read as one consistent button family.
// -----------------------------------------------------------------------------

function HeaderButton({ label, active, onPress, tokens, accessibilityLabel }) {
  const { dark, accentColor, textColor } = tokens;
  const idleBg = dark ? 'rgba(255,255,255,0.04)' : 'hsl(148, 18%, 94%)';
  const activeBg = dark ? 'rgba(148,210,165,0.18)' : 'hsl(148, 35%, 90%)';
  return (
    <Pressable
      onPress={onPress}
      hitSlop={4}
      android_ripple={{
        color: dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
        borderless: false,
      }}
      style={[
        styles.headerBtn,
        { backgroundColor: active ? activeBg : idleBg },
      ]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      <Text
        style={{
          fontSize: 14,
          fontFamily: 'Poppins-SemiBold',
          color: active ? accentColor : textColor,
          letterSpacing: -0.1,
        }}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}

// -----------------------------------------------------------------------------
// Helpers / constants
// -----------------------------------------------------------------------------

const SHEET_HEIGHT = Math.min(Dimensions.get('window').height * 0.88, 740);
const DISMISS_THRESHOLD = 80;
const NUMERIC_LOCALE = 'en-US';

const WEEKDAYS = [
  { key: 'sun', label: 'S' },
  { key: 'mon', label: 'M' },
  { key: 'tue', label: 'T' },
  { key: 'wed', label: 'W' },
  { key: 'thu', label: 'T' },
  { key: 'fri', label: 'F' },
  { key: 'sat', label: 'S' },
];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function pad(n) { return n < 10 ? `0${n}` : `${n}`; }
function fmtIsoDate(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function parseIsoDate(s) {
  if (!s) return null;
  const parts = s.split('-').map(Number);
  if (parts.length < 3) return null;
  const [y, m, d] = parts;
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}
function fmtChipDate(d) {
  return d.toLocaleDateString(NUMERIC_LOCALE, { day: '2-digit', month: 'short', year: 'numeric' });
}

function localeWithLatnDigits(locale) {
  // BCP-47 `-u-nu-latn` extension forces Latin digits even on locales that
  // would otherwise default to native-script numerals (Arabic, Persian,
  // Bengali). The full month/weekday names still come out localized.
  if (!locale) return null;
  return locale.includes('-u-') ? locale : `${locale}-u-nu-latn`;
}

function fmtMonthName(year, monthIdx, locale) {
  const tag = localeWithLatnDigits(locale) || NUMERIC_LOCALE;
  try {
    return new Date(year, monthIdx, 1).toLocaleDateString(tag, { month: 'long' });
  } catch {
    return MONTHS[monthIdx];
  }
}

function fmtYearOnly(year, locale) {
  const tag = localeWithLatnDigits(locale) || NUMERIC_LOCALE;
  try {
    return new Date(year, 0, 1).toLocaleDateString(tag, { year: 'numeric' });
  } catch {
    return String(year);
  }
}

function buildShortMonthLabels(locale) {
  const tag = localeWithLatnDigits(locale) || NUMERIC_LOCALE;
  let formatter = null;
  try { formatter = new Intl.DateTimeFormat(tag, { month: 'short' }); }
  catch { formatter = null; }
  return MONTHS.map((name, i) => {
    if (formatter) {
      try { return formatter.format(new Date(2000, i, 1)); }
      catch { return name.slice(0, 3); }
    }
    return name.slice(0, 3);
  });
}

function buildWeekdayLabels(locale) {
  const tag = localeWithLatnDigits(locale) || NUMERIC_LOCALE;
  // Use a known Sunday as the seed and walk forward 7 days so the order
  // matches the WEEKDAYS constant. `narrow` style yields the single-letter
  // glyph (S/M/T/...) in English, ح/ن/ث/... in Arabic.
  const formatter = (() => {
    try { return new Intl.DateTimeFormat(tag, { weekday: 'narrow' }); }
    catch { return null; }
  })();
  const seed = new Date(2023, 0, 1); // Jan 1 2023 is a Sunday
  return WEEKDAYS.map((wd, i) => {
    const d = new Date(seed);
    d.setDate(seed.getDate() + i);
    const label = formatter ? formatter.format(d) : wd.label;
    return { key: wd.key, label };
  });
}

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}
function getFirstDayOfWeek(year, month) {
  return new Date(year, month, 1).getDay();
}

function buildPresets(t) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  const startOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const endOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
  const startOfYear = new Date(today.getFullYear(), 0, 1);
  const endOfYear = new Date(today.getFullYear(), 11, 31);
  const last30 = new Date(today);
  last30.setDate(last30.getDate() - 29);
  return [
    { key: 'thisMonth', label: t('common.thisMonth', 'This Month'), from: fmtIsoDate(startOfMonth), to: fmtIsoDate(endOfMonth) },
    { key: 'lastMonth', label: t('common.lastMonth', 'Last Month'), from: fmtIsoDate(startOfLastMonth), to: fmtIsoDate(endOfLastMonth) },
    { key: 'last30', label: t('common.last30Days', 'Last 30 Days'), from: fmtIsoDate(last30), to: fmtIsoDate(today) },
    { key: 'thisYear', label: t('common.thisYear', 'This Year'), from: fmtIsoDate(startOfYear), to: fmtIsoDate(endOfYear) },
  ];
}

const styles = StyleSheet.create({
  dragZone: {
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 6,
  },
  dragPill: {
    width: 36,
    height: 4,
    borderRadius: 2,
  },
  header: {
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 14,
  },
  iconTile: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTextCol: {
    flex: 1,
    minWidth: 0,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  endpointRow: {
    alignItems: 'stretch',
    gap: 8,
  },
  endpointChip: {
    flex: 1,
    minWidth: 0,
    minHeight: 60,
    borderRadius: 14,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    paddingVertical: 10,
    justifyContent: 'center',
  },
  endpointInner: {
    minWidth: 0,
  },
  dash: {
    width: 12,
    height: 1.5,
    alignSelf: 'center',
    borderRadius: 1,
  },
  monthNav: {
    alignItems: 'center',
    gap: 10,
    marginTop: 18,
    marginBottom: 6,
  },
  monthNavCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    // Generous gap so month / year header buttons read as separate
    // controls instead of one squashed pair.
    gap: 18,
  },
  monthNavBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBtn: {
    minWidth: 72,
    paddingHorizontal: 14,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swipeBody: {
    alignSelf: 'stretch',
  },
  weekdayRow: {
    paddingHorizontal: 4,
    marginBottom: 4,
  },
  weekdayCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6,
  },
  calendarGrid: {
    paddingHorizontal: 4,
  },
  calendarRow: {
    // Each row owns its own flexbox so the seven cells share the row width
    // exactly via flex:1 — no `${100/7}%` rounding overflow that wrapped
    // the 7th cell to the next line.
    alignSelf: 'stretch',
  },
  cellWrap: {
    flex: 1,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  gridPad: {
    paddingHorizontal: 4,
    paddingTop: 8,
  },
  monthsGrid: {
    flexWrap: 'wrap',
  },
  monthCellWrap: {
    width: `${100 / 3}%`,
    paddingHorizontal: 4,
    paddingVertical: 6,
  },
  monthCell: {
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rangeFill: {
    position: 'absolute',
    top: 5,
    bottom: 5,
    start: 0,
    end: 0,
  },
  dayDisc: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  presetChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1.5,
  },
  footer: {
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  resetBtn: {
    height: 48,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    backgroundColor: 'transparent',
    justifyContent: 'center',
  },
  resetInner: {
    alignItems: 'center',
    gap: 8,
  },
  applyBtn: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
