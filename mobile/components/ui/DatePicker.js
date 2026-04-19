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
 */
function DatePicker({ value, onChange, placeholder, label, onOpen }, ref) {
  const { t } = useTranslation();
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
    onChange(formatDate(d));
    slideOut();
  }, [viewYear, viewMonth, onChange, slideOut]);

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

  const monthLabel = `${MONTHS[viewMonth]} ${viewYear}`;
  const displayValue = parsed ? fmtChipDate(parsed) : null;

  // Prev/next chevrons swap when the layout is RTL so "previous" stays
  // visually on the leading edge.
  const PrevIcon = isRTL ? ChevronRight : ChevronLeft;
  const NextIcon = isRTL ? ChevronLeft : ChevronRight;
  const onLeadingNav = isRTL ? nextMonth : prevMonth;
  const onTrailingNav = isRTL ? prevMonth : nextMonth;

  return (
    <>
      <Pressable
        onPress={openSheet}
        style={({ pressed }) => [
          styles.trigger,
          {
            flexDirection: isRTL ? 'row-reverse' : 'row',
            backgroundColor: pressed
              ? (dark ? 'rgba(255,255,255,0.04)' : 'hsl(148, 18%, 92%)')
              : inputBg,
            borderColor: open ? accentColor : inputBorderIdle,
          },
        ]}
      >
        <Text
          style={{
            flex: 1,
            fontSize: 15,
            fontFamily: 'Poppins-Regular',
            color: displayValue ? textColor : mutedColor,
            textAlign: isRTL ? 'right' : 'left',
            writingDirection: isRTL ? 'rtl' : 'ltr',
          }}
          numberOfLines={1}
        >
          {displayValue || placeholder || t('common.selectDate', 'Select date…')}
        </Text>
        <Calendar size={18} color={iconColor} strokeWidth={2.2} />
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

            {/* Header — icon tile + title + actions + close */}
            <View
              style={[
                styles.header,
                { flexDirection: isRTL ? 'row-reverse' : 'row' },
              ]}
            >
              <View
                {...panResponder.panHandlers}
                style={[
                  styles.headerLead,
                  { flexDirection: isRTL ? 'row-reverse' : 'row' },
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
                      textAlign: isRTL ? 'right' : 'left',
                    }}
                    numberOfLines={1}
                  >
                    {label || t('common.selectDate', 'Select date')}
                  </Text>
                </View>
              </View>

              <View
                style={{
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <Pressable
                  onPress={handleToday}
                  hitSlop={6}
                  style={({ pressed }) => [
                    styles.headerPill,
                    {
                      backgroundColor: pressed
                        ? (dark ? 'rgba(148,210,165,0.22)' : 'hsl(148, 35%, 88%)')
                        : (dark ? 'rgba(148,210,165,0.14)' : 'hsl(148, 35%, 94%)'),
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
                {value ? (
                  <Pressable
                    onPress={handleClear}
                    hitSlop={6}
                    style={({ pressed }) => [
                      styles.headerPill,
                      {
                        backgroundColor: pressed
                          ? (dark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)')
                          : (dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'),
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
                { flexDirection: isRTL ? 'row-reverse' : 'row' },
              ]}
            >
              <Pressable
                onPress={onLeadingNav}
                hitSlop={6}
                style={({ pressed }) => [
                  styles.monthNavBtn,
                  {
                    backgroundColor: pressed
                      ? (dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)')
                      : (dark ? 'rgba(255,255,255,0.04)' : 'hsl(148, 18%, 94%)'),
                  },
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
                style={({ pressed }) => [
                  styles.monthNavBtn,
                  {
                    backgroundColor: pressed
                      ? (dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)')
                      : (dark ? 'rgba(255,255,255,0.04)' : 'hsl(148, 18%, 94%)'),
                  },
                ]}
              >
                <NextIcon size={18} color={textColor} strokeWidth={2.2} />
              </Pressable>
            </View>

            {/* Weekday headers */}
            <View style={[styles.weekdayRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
              {WEEKDAYS.map((wd) => (
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
            <View style={[styles.calendarGrid, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
              {calendarDays.map((day, i) => {
                if (day === null) {
                  return <View key={`e-${i}`} style={styles.cellWrap} />;
                }
                const isSelected = day === selectedDay;
                const isToday = day === todayDay;
                return (
                  <View key={day} style={styles.cellWrap}>
                    <Pressable
                      onPress={() => handleSelect(day)}
                      hitSlop={2}
                      android_ripple={{
                        color: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
                        borderless: true,
                        radius: 18,
                      }}
                      style={[
                        styles.dayDisc,
                        {
                          backgroundColor: isSelected ? accentColor : 'transparent',
                          borderWidth: !isSelected && isToday ? 1.5 : 0,
                          borderColor: accentColor,
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
                          color: isSelected
                            ? '#ffffff'
                            : isToday ? accentColor : textColor,
                        }}
                      >
                        {day}
                      </Text>
                    </Pressable>
                  </View>
                );
              })}
            </View>

            {/* Bottom safe area */}
            <View style={{ height: insets.bottom + 12 }} />
          </Animated.View>
        </View>
      </Modal>
    </>
  );
}

export default forwardRef(DatePicker);

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

function fmtChipDate(d) {
  return d.toLocaleDateString(NUMERIC_LOCALE, {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

const styles = StyleSheet.create({
  trigger: {
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 52,
    gap: 10,
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
  headerLead: {
    flex: 1,
    alignItems: 'center',
    gap: 12,
    minWidth: 0,
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
});
