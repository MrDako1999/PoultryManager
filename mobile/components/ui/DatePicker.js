import {
  useState, useMemo, useCallback, useRef, useEffect,
  forwardRef, useImperativeHandle,
} from 'react';
import {
  View, Text, Pressable, Modal, Dimensions,
  PanResponder, Animated, Keyboard, StyleSheet,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Calendar, ChevronLeft, ChevronRight, X,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useHeroSheetTokens } from '@/components/HeroSheetScreen';
import { useIsRTL } from '@/stores/localeStore';
import { rowDirection, textAlignStart } from '@/lib/rtl';

/**
 * Single-date picker. Trigger matches the SheetInput aesthetic, modal sheet
 * matches the BottomPickerSheet/DateRangePicker chrome (drag pill, icon tile,
 * close X) and uses the calendar grid styling shared with DateRangePicker.
 *
 * All colours come from `useHeroSheetTokens()` so light + dark modes are
 * handled in one place — same pattern as every other field-level component.
 *
 * @param {object} props
 * @param {string} [props.value] - ISO YYYY-MM-DD date string
 * @param {(value: string) => void} props.onChange - Called with ISO string (or '' on Clear)
 * @param {string} [props.placeholder] - Placeholder shown when empty
 * @param {string} [props.label] - Header label inside the modal sheet
 * @param {() => void} [props.onOpen] - Called when the sheet opens
 * @param {string} [props.minDate] - ISO YYYY-MM-DD; days before this are disabled
 * @param {string} [props.maxDate] - ISO YYYY-MM-DD; days after this are disabled
 * @param {Record<string, 'submitted'|'missing'>} [props.markedDates] - Annotations per ISO date
 */
function DatePicker({
  value, onChange, placeholder, label, onOpen,
  minDate, maxDate, markedDates,
}, ref) {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const isRTL = useIsRTL();
  const tokens = useHeroSheetTokens();
  const {
    dark, sheetBg, accentColor, textColor, mutedColor, borderColor,
    inputBg, inputBorderIdle, iconColor,
  } = tokens;

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);
  const parsed = parseDate(value);

  // Pre-parse the bounds once per render so the day cells can do a
  // cheap day-string comparison instead of date math on every cell.
  const minKey = minDate || null;
  const maxKey = maxDate || null;
  // Today is always selectable from the toolbar pill — but only if
  // it's in range. Disable the pill when bounds exclude today (e.g. a
  // completed batch whose endDate was yesterday).
  const todayKey = formatDate(today);
  const todayInRange =
    (!minKey || todayKey >= minKey) && (!maxKey || todayKey <= maxKey);

  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(parsed?.getFullYear() || today.getFullYear());
  const [viewMonth, setViewMonth] = useState(parsed?.getMonth() ?? today.getMonth());

  const slideAnim = useRef(new Animated.Value(SHEET_HEIGHT)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;

  const slideIn = useCallback(() => {
    slideAnim.setValue(SHEET_HEIGHT);
    backdropAnim.setValue(0);
    Animated.parallel([
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 65, friction: 11 }),
      Animated.timing(backdropAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
    ]).start();
  }, [slideAnim, backdropAnim]);

  const slideOut = useCallback(() => {
    Keyboard.dismiss();
    Animated.parallel([
      Animated.timing(slideAnim, { toValue: SHEET_HEIGHT, duration: 200, useNativeDriver: true }),
      Animated.timing(backdropAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => setOpen(false));
  }, [slideAnim, backdropAnim]);

  const openSheet = useCallback(() => {
    Keyboard.dismiss();
    onOpen?.();
    const seed = parseDate(value) || today;
    setViewYear(seed.getFullYear());
    setViewMonth(seed.getMonth());
    setOpen(true);
  }, [value, onOpen, today]);

  // Trigger slideIn after the modal mounts so the spring fires from off-screen
  // rather than 0 (which would skip the entrance animation entirely).
  useEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(() => slideIn());
    return () => cancelAnimationFrame(id);
  }, [open, slideIn]);

  useImperativeHandle(ref, () => ({ open: openSheet, close: slideOut }), [openSheet, slideOut]);

  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, g) => g.dy > 4,
    onPanResponderMove: (_, g) => { if (g.dy > 0) slideAnim.setValue(g.dy); },
    onPanResponderRelease: (_, g) => {
      if (g.dy > DISMISS_THRESHOLD || g.vy > 0.5) {
        slideOut();
      } else {
        Animated.spring(slideAnim, {
          toValue: 0, useNativeDriver: true, tension: 100, friction: 10,
        }).start();
      }
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [slideOut]);

  const prevMonth = useCallback(() => {
    Haptics.selectionAsync().catch(() => {});
    if (viewMonth === 0) { setViewMonth(11); setViewYear((y) => y - 1); }
    else setViewMonth((m) => m - 1);
  }, [viewMonth]);

  const nextMonth = useCallback(() => {
    Haptics.selectionAsync().catch(() => {});
    if (viewMonth === 11) { setViewMonth(0); setViewYear((y) => y + 1); }
    else setViewMonth((m) => m + 1);
  }, [viewMonth]);

  const handleSelect = useCallback((day) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const d = new Date(viewYear, viewMonth, day);
    const key = formatDate(d);
    // Defensive: don't fire onChange for a disabled day even if a
    // press somehow leaks through. The cell renderer also pointer-
    // events-disables disabled cells.
    if ((minKey && key < minKey) || (maxKey && key > maxKey)) return;
    onChange(key);
    slideOut();
  }, [viewYear, viewMonth, onChange, slideOut, minKey, maxKey]);

  const handleToday = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onChange(formatDate(today));
    slideOut();
  }, [onChange, slideOut, today]);

  const handleClear = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onChange('');
    slideOut();
  }, [onChange, slideOut]);

  const calendarDays = useMemo(() => {
    const daysInMonth = getDaysInMonth(viewYear, viewMonth);
    const firstDay = getFirstDayOfWeek(viewYear, viewMonth);
    const cells = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    return cells;
  }, [viewYear, viewMonth]);

  const selectedDay = parsed
    && parsed.getFullYear() === viewYear
    && parsed.getMonth() === viewMonth
    ? parsed.getDate() : null;
  const todayDay = today.getFullYear() === viewYear && today.getMonth() === viewMonth
    ? today.getDate() : null;

  const monthLabel = useMemo(
    () => fmtMonthYear(viewYear, viewMonth, i18n.language),
    [viewYear, viewMonth, i18n.language]
  );
  const localizedWeekdays = useMemo(
    () => buildWeekdayLabels(i18n.language),
    [i18n.language]
  );
  const displayValue = parsed ? fmtChipDate(parsed, i18n.language) : null;

  // Prev/next chevrons swap when the layout is RTL so "previous" stays
  // visually on the leading edge.
  const PrevIcon = isRTL ? ChevronRight : ChevronLeft;
  const NextIcon = isRTL ? ChevronLeft : ChevronRight;
  const onLeadingNav = isRTL ? nextMonth : prevMonth;
  const onTrailingNav = isRTL ? prevMonth : nextMonth;

  return (
    <>
      {/* Compact form-grade trigger. Layout (flexDirection, border, height)
          lives in StyleSheet + on a plain inner <View>; the Pressable's
          style is a STATIC array so NativeWind's css-interop can't strip
          layout from it. See DESIGN_LANGUAGE.md §9. */}
      <Pressable
        onPress={openSheet}
        android_ripple={{
          color: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
          borderless: false,
        }}
        style={[
          styles.trigger,
          { backgroundColor: inputBg, borderColor: inputBorderIdle },
        ]}
      >
        <View
          style={[
            styles.triggerRow,
            { flexDirection: rowDirection(isRTL) },
          ]}
        >
          <Text
            style={{
              flex: 1,
              fontSize: 14,
              fontFamily: 'Poppins-Regular',
              color: displayValue ? textColor : mutedColor,
              textAlign: textAlignStart(isRTL),
              writingDirection: isRTL ? 'rtl' : 'ltr',
            }}
            numberOfLines={1}
          >
            {displayValue || placeholder || t('common.selectDate', 'Select date…')}
          </Text>
          <Calendar size={16} color={iconColor} strokeWidth={2.2} />
        </View>
      </Pressable>

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

            {/* Header — title + actions + close. No icon tile: the calendar
                grid below is itself the visual identity, doubling up with a
                green calendar glyph makes the chrome feel busy. */}
            <View
              style={[
                styles.header,
                { flexDirection: rowDirection(isRTL) },
              ]}
            >
              <View
                {...panResponder.panHandlers}
                style={styles.headerTextCol}
              >
                <Text
                  style={{
                    fontSize: 16,
                    fontFamily: 'Poppins-SemiBold',
                    color: textColor,
                    letterSpacing: -0.2,
                    textAlign: textAlignStart(isRTL),
                  }}
                  numberOfLines={1}
                >
                  {label || t('common.selectDate', 'Select date')}
                </Text>
              </View>

              <View
                style={{
                  flexDirection: rowDirection(isRTL),
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                {todayInRange ? (
                  <Pressable
                    onPress={handleToday}
                    hitSlop={6}
                    android_ripple={{
                      color: dark ? 'rgba(148,210,165,0.22)' : 'hsl(148, 35%, 88%)',
                      borderless: false,
                    }}
                    style={[
                      styles.headerPill,
                      {
                        backgroundColor: dark ? 'rgba(148,210,165,0.14)' : 'hsl(148, 35%, 94%)',
                      },
                    ]}
                  >
                    <Text
                      style={{
                        fontSize: 12.5,
                        fontFamily: 'Poppins-SemiBold',
                        color: accentColor,
                        letterSpacing: 0.1,
                      }}
                    >
                      {t('common.today', 'Today')}
                    </Text>
                  </Pressable>
                ) : null}
                {value ? (
                  <Pressable
                    onPress={handleClear}
                    hitSlop={6}
                    android_ripple={{
                      color: dark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)',
                      borderless: false,
                    }}
                    style={[
                      styles.headerPill,
                      {
                        backgroundColor: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
                      },
                    ]}
                  >
                    <Text
                      style={{
                        fontSize: 12.5,
                        fontFamily: 'Poppins-SemiBold',
                        color: mutedColor,
                        letterSpacing: 0.1,
                      }}
                    >
                      {t('common.clear', 'Clear')}
                    </Text>
                  </Pressable>
                ) : null}
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
            </View>

            <View style={{ height: 1, backgroundColor: borderColor }} />

            {/* Month navigation */}
            <View
              style={[
                styles.monthNav,
                { flexDirection: rowDirection(isRTL) },
              ]}
            >
              <Pressable
                onPress={onLeadingNav}
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
              >
                <PrevIcon size={18} color={textColor} strokeWidth={2.2} />
              </Pressable>
              <Text
                style={{
                  flex: 1,
                  fontSize: 15,
                  fontFamily: 'Poppins-SemiBold',
                  color: textColor,
                  textAlign: 'center',
                  letterSpacing: -0.1,
                }}
                numberOfLines={1}
              >
                {monthLabel}
              </Text>
              <Pressable
                onPress={onTrailingNav}
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
              >
                <NextIcon size={18} color={textColor} strokeWidth={2.2} />
              </Pressable>
            </View>

            {/* Weekday headers */}
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

            {/* Calendar grid */}
            <View style={[styles.calendarGrid, { flexDirection: rowDirection(isRTL) }]}>
              {calendarDays.map((day, i) => {
                if (day === null) {
                  return <View key={`e-${i}`} style={styles.cellWrap} />;
                }
                const isSelected = day === selectedDay;
                const isToday = day === todayDay;

                // Per-cell ISO key drives both bounds enforcement and
                // marker lookup. Marker takes a back seat to "selected"
                // (filled accent disc wins visually), but the ring
                // colour from missing/submitted still beats the
                // default today-only outline.
                const cellKey = formatDate(new Date(viewYear, viewMonth, day));
                const isOutOfRange =
                  (minKey && cellKey < minKey) || (maxKey && cellKey > maxKey);
                const marker = markedDates ? markedDates[cellKey] : null;

                // Marker tone — token-driven so dark mode stays
                // legible. Submitted = accent green (matches the rest
                // of the app's "done" affordance). Missing = amber
                // ring (same warning tone used by WorkerTasks pending
                // rows).
                let ringColor = null;
                let ringFillBg = null;
                if (marker === 'submitted') {
                  ringColor = accentColor;
                  ringFillBg = dark
                    ? 'rgba(148,210,165,0.14)'
                    : 'hsl(148, 35%, 94%)';
                } else if (marker === 'missing') {
                  ringColor = dark ? '#fbbf24' : '#d97706';
                  ringFillBg = dark
                    ? 'rgba(251,191,36,0.14)'
                    : 'hsl(40, 90%, 94%)';
                }

                const showRing = !isSelected && !!ringColor;
                const showTodayOutline = !isSelected && !showRing && isToday;
                const discBg = isSelected
                  ? accentColor
                  : showRing
                    ? ringFillBg
                    : 'transparent';
                const discBorderColor = showRing
                  ? ringColor
                  : showTodayOutline
                    ? accentColor
                    : 'transparent';
                const discBorderWidth = showRing ? 1.5 : showTodayOutline ? 1.5 : 0;
                const dayLabelColor = isOutOfRange
                  ? mutedColor
                  : isSelected
                    ? '#ffffff'
                    : showRing
                      ? ringColor
                      : isToday
                        ? accentColor
                        : textColor;

                return (
                  <View key={day} style={styles.cellWrap}>
                    <Pressable
                      onPress={() => handleSelect(day)}
                      disabled={isOutOfRange}
                      hitSlop={2}
                      android_ripple={
                        isOutOfRange ? undefined : {
                          color: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
                          borderless: true,
                          radius: 18,
                        }
                      }
                      style={[
                        styles.dayDisc,
                        {
                          backgroundColor: discBg,
                          borderWidth: discBorderWidth,
                          borderColor: discBorderColor,
                          opacity: isOutOfRange ? 0.32 : 1,
                          ...(isSelected && !dark
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
                          fontFamily: isSelected ? 'Poppins-Bold' : 'Poppins-Medium',
                          color: dayLabelColor,
                        }}
                      >
                        {day}
                      </Text>
                    </Pressable>
                  </View>
                );
              })}
            </View>

            {/* Marker legend — only shown when callers wire `markedDates`
                so the regular pickers stay uncluttered. */}
            {markedDates && Object.keys(markedDates).length > 0 ? (
              <View
                style={[
                  styles.legend,
                  { flexDirection: rowDirection(isRTL) },
                ]}
              >
                <LegendDot
                  color={accentColor}
                  fill={dark ? 'rgba(148,210,165,0.14)' : 'hsl(148, 35%, 94%)'}
                  label={t('datepicker.legendSubmitted', 'Logged')}
                  textColor={mutedColor}
                />
                <LegendDot
                  color={dark ? '#fbbf24' : '#d97706'}
                  fill={dark ? 'rgba(251,191,36,0.14)' : 'hsl(40, 90%, 94%)'}
                  label={t('datepicker.legendMissing', 'Missing')}
                  textColor={mutedColor}
                />
              </View>
            ) : null}

            {/* Bottom safe area */}
            <View style={{ height: insets.bottom + 12 }} />
          </Animated.View>
        </View>
      </Modal>
    </>
  );
}

export default forwardRef(DatePicker);

function LegendDot({ color, fill, label, textColor }) {
  return (
    <View style={legendStyles.item}>
      <View
        style={[
          legendStyles.dot,
          { borderColor: color, backgroundColor: fill },
        ]}
      />
      <Text
        style={{
          fontSize: 11,
          fontFamily: 'Poppins-Medium',
          color: textColor,
        }}
      >
        {label}
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Helpers / constants
// ---------------------------------------------------------------------------

const SHEET_HEIGHT = Math.min(Dimensions.get('window').height * 0.7, 560);
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

function parseDate(str) {
  if (!str) return null;
  const [y, m, d] = String(str).split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function formatDate(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year, month) {
  return new Date(year, month, 1).getDay();
}

function localeWithLatnDigits(locale) {
  // BCP-47 `-u-nu-latn` extension forces Latin digits even on locales that
  // would otherwise default to native-script numerals (Arabic, Persian,
  // Bengali). The full month/weekday names still come out localized.
  if (!locale) return null;
  return locale.includes('-u-') ? locale : `${locale}-u-nu-latn`;
}

function fmtChipDate(d, locale) {
  const tag = localeWithLatnDigits(locale);
  if (tag) {
    try {
      return d.toLocaleDateString(tag, {
        day: '2-digit', month: 'short', year: 'numeric',
      });
    } catch {
      // Fall through to en-US default.
    }
  }
  return d.toLocaleDateString(NUMERIC_LOCALE, {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

function fmtMonthYear(year, monthIdx, locale) {
  const tag = localeWithLatnDigits(locale) || NUMERIC_LOCALE;
  try {
    return new Date(year, monthIdx, 1).toLocaleDateString(tag, {
      month: 'long', year: 'numeric',
    });
  } catch {
    return `${MONTHS[monthIdx]} ${year}`;
  }
}

function buildWeekdayLabels(locale) {
  const tag = localeWithLatnDigits(locale) || NUMERIC_LOCALE;
  // Use a known Sunday as the seed and walk forward 7 days so the order
  // matches the WEEKDAYS constant. `narrow` style yields the single-letter
  // glyph (S/M/T/...) in English, ح/ن/ث/... in Arabic, which is what the
  // grid expects.
  const formatter = (() => {
    try {
      return new Intl.DateTimeFormat(tag, { weekday: 'narrow' });
    } catch {
      return null;
    }
  })();
  const seed = new Date(2023, 0, 1); // Jan 1 2023 is a Sunday
  return WEEKDAYS.map((wd, i) => {
    const d = new Date(seed);
    d.setDate(seed.getDate() + i);
    const label = formatter ? formatter.format(d) : wd.label;
    return { key: wd.key, label };
  });
}

const styles = StyleSheet.create({
  trigger: {
    height: 48,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  triggerRow: {
    alignItems: 'center',
    gap: 8,
  },
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
  headerTextCol: {
    flex: 1,
    minWidth: 0,
  },
  headerPill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthNav: {
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    marginTop: 14,
    marginBottom: 6,
  },
  monthNavBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekdayRow: {
    paddingHorizontal: 24,
    marginBottom: 4,
  },
  weekdayCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6,
  },
  calendarGrid: {
    flexWrap: 'wrap',
    paddingHorizontal: 20,
  },
  cellWrap: {
    width: `${100 / 7}%`,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayDisc: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  legend: {
    paddingHorizontal: 24,
    paddingTop: 14,
    gap: 16,
    alignItems: 'center',
  },
});

const legendStyles = StyleSheet.create({
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1.5,
  },
});
