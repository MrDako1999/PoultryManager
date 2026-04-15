import { useState, useMemo, useCallback, useRef } from 'react';
import {
  View, Text, Pressable, Modal, Dimensions,
  PanResponder, Animated,
} from 'react-native';
import { Calendar, ChevronLeft, ChevronRight, X } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { cn } from '../../lib/utils';
import useThemeStore from '../../stores/themeStore';

const SCREEN_HEIGHT = Dimensions.get('window').height;
const SHEET_HEIGHT = 460;
const DISMISS_THRESHOLD = 80;
const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function pad(n) { return n < 10 ? `0${n}` : `${n}`; }

function parseDate(str) {
  if (!str) return null;
  const [y, m, d] = str.split('-').map(Number);
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

export default function DatePicker({ value, onChange, placeholder, label }) {
  const [open, setOpen] = useState(false);
  const { resolvedTheme } = useThemeStore();
  const mutedColor = 'hsl(150, 10%, 45%)';
  const primaryColor = resolvedTheme === 'dark' ? 'hsl(148, 48%, 38%)' : 'hsl(148, 60%, 20%)';

  const today = new Date();
  const parsed = parseDate(value);
  const [viewYear, setViewYear] = useState(parsed?.getFullYear() || today.getFullYear());
  const [viewMonth, setViewMonth] = useState(parsed?.getMonth() ?? today.getMonth());

  const slideAnim = useRef(new Animated.Value(SHEET_HEIGHT)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;

  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, g) => g.dy > 4,
    onPanResponderMove: (_, g) => { if (g.dy > 0) slideAnim.setValue(g.dy); },
    onPanResponderRelease: (_, g) => {
      if (g.dy > DISMISS_THRESHOLD || g.vy > 0.5) {
        slideOut();
      } else {
        Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 100, friction: 10 }).start();
      }
    },
  }), []);

  const slideIn = useCallback(() => {
    slideAnim.setValue(SHEET_HEIGHT);
    backdropAnim.setValue(0);
    Animated.parallel([
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 65, friction: 11 }),
      Animated.timing(backdropAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
    ]).start();
  }, [slideAnim, backdropAnim]);

  const slideOut = useCallback(() => {
    Animated.parallel([
      Animated.timing(slideAnim, { toValue: SHEET_HEIGHT, duration: 200, useNativeDriver: true }),
      Animated.timing(backdropAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => {
      setOpen(false);
    });
  }, [slideAnim, backdropAnim]);

  const openSheet = useCallback(() => {
    const d = parseDate(value) || today;
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
    setOpen(true);
    requestAnimationFrame(() => slideIn());
  }, [value, slideIn]);

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear((y) => y - 1); }
    else setViewMonth((m) => m - 1);
  };

  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear((y) => y + 1); }
    else setViewMonth((m) => m + 1);
  };

  const handleSelect = (day) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const d = new Date(viewYear, viewMonth, day);
    onChange(formatDate(d));
    slideOut();
  };

  const handleToday = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onChange(formatDate(today));
    slideOut();
  };

  const calendarDays = useMemo(() => {
    const daysInMonth = getDaysInMonth(viewYear, viewMonth);
    const firstDay = getFirstDayOfWeek(viewYear, viewMonth);
    const cells = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    return cells;
  }, [viewYear, viewMonth]);

  const selectedDay = parsed && parsed.getFullYear() === viewYear && parsed.getMonth() === viewMonth
    ? parsed.getDate() : null;
  const todayDay = today.getFullYear() === viewYear && today.getMonth() === viewMonth
    ? today.getDate() : null;

  const displayValue = parsed
    ? `${MONTHS[parsed.getMonth()].slice(0, 3)} ${parsed.getDate()}, ${parsed.getFullYear()}`
    : null;

  return (
    <>
      <Pressable
        onPress={openSheet}
        className="flex-row items-center justify-between border border-border rounded-md bg-background px-3 h-12"
      >
        <Text
          className={cn('text-sm flex-1', displayValue ? 'text-foreground' : 'text-muted-foreground')}
          numberOfLines={1}
        >
          {displayValue || placeholder || 'Select date...'}
        </Text>
        <Calendar size={16} color={mutedColor} />
      </Pressable>

      <Modal transparent visible={open} animationType="none" onRequestClose={slideOut}>
        <View className="flex-1">
          <Animated.View
            style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', opacity: backdropAnim }}
          >
            <Pressable style={{ flex: 1 }} onPress={slideOut} />
          </Animated.View>

          <Animated.View
            style={[{ height: SHEET_HEIGHT, transform: [{ translateY: slideAnim }] }]}
            className="absolute bottom-0 left-0 right-0 bg-card rounded-t-2xl"
          >
            {/* Drag zone — generous 44pt touch target */}
            <View
              {...panResponder.panHandlers}
              className="items-center justify-center"
              style={{ height: 44 }}
            >
              <View className="w-10 h-1 rounded-full bg-border" />
            </View>

            {/* Header */}
            <View className="flex-row items-center justify-between px-4 pb-2">
              <Text className="text-base font-semibold text-foreground flex-1" numberOfLines={1}>
                {label || 'Select Date'}
              </Text>
              <View className="flex-row items-center gap-2">
                <Pressable onPress={handleToday} className="px-3 py-1.5 rounded-lg bg-primary/10" hitSlop={4}>
                  <Text className="text-xs font-semibold text-primary">Today</Text>
                </Pressable>
                {value ? (
                  <Pressable onPress={() => { onChange(''); slideOut(); }} className="px-3 py-1.5 rounded-lg bg-muted" hitSlop={4}>
                    <Text className="text-xs font-semibold text-muted-foreground">Clear</Text>
                  </Pressable>
                ) : null}
                <Pressable onPress={slideOut} className="h-8 w-8 items-center justify-center rounded-full bg-muted" hitSlop={8}>
                  <X size={16} color={mutedColor} />
                </Pressable>
              </View>
            </View>

            {/* Month navigation */}
            <View className="flex-row items-center justify-between px-4 py-2">
              <Pressable onPress={prevMonth} className="h-9 w-9 items-center justify-center rounded-lg bg-muted" hitSlop={4}>
                <ChevronLeft size={18} color={resolvedTheme === 'dark' ? '#e0e8e0' : '#1a2e1a'} />
              </Pressable>
              <Text className="text-sm font-semibold text-foreground">
                {MONTHS[viewMonth]} {viewYear}
              </Text>
              <Pressable onPress={nextMonth} className="h-9 w-9 items-center justify-center rounded-lg bg-muted" hitSlop={4}>
                <ChevronRight size={18} color={resolvedTheme === 'dark' ? '#e0e8e0' : '#1a2e1a'} />
              </Pressable>
            </View>

            {/* Weekday headers */}
            <View className="flex-row px-3 mt-1">
              {WEEKDAYS.map((wd) => (
                <View key={wd} className="flex-1 items-center py-1.5">
                  <Text className="text-xs font-medium text-muted-foreground">{wd}</Text>
                </View>
              ))}
            </View>

            {/* Calendar grid */}
            <View className="flex-row flex-wrap px-3 pb-2">
              {calendarDays.map((day, i) => {
                if (day === null) {
                  return <View key={`e-${i}`} style={{ width: '14.285%', height: 42 }} />;
                }
                const isSelected = day === selectedDay;
                const isToday = day === todayDay;
                return (
                  <View key={day} style={{ width: '14.285%', height: 42, alignItems: 'center', justifyContent: 'center' }}>
                    <Pressable
                      onPress={() => handleSelect(day)}
                      className={cn(
                        'w-9 h-9 items-center justify-center rounded-full',
                        isSelected && 'bg-primary',
                        !isSelected && isToday && 'border border-primary',
                      )}
                    >
                      <Text
                        className={cn(
                          'text-sm',
                          isSelected ? 'text-primary-foreground font-bold' : 'text-foreground',
                          isToday && !isSelected && 'text-primary font-semibold',
                        )}
                      >
                        {day}
                      </Text>
                    </Pressable>
                  </View>
                );
              })}
            </View>

            {/* Bottom safe area */}
            <View className="h-6" />
          </Animated.View>
        </View>
      </Modal>
    </>
  );
}
