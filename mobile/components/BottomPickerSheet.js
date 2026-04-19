import { useState, useCallback, useMemo, useRef, forwardRef, useImperativeHandle } from 'react';
import {
  View, Text, Pressable, Modal, FlatList, TextInput,
  Dimensions, PanResponder, Animated, Keyboard, StyleSheet,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check, X, Search, RotateCcw } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useHeroSheetTokens } from '@/components/HeroSheetScreen';
import { useIsRTL } from '@/stores/localeStore';

const DISMISS_THRESHOLD = 80;

const toArray = (v) => (Array.isArray(v) ? v : []);

/**
 * Bottom picker sheet primitive.
 *
 * Owns: the modal, slide+backdrop animation, swipe-to-dismiss PanResponder,
 * keyboard dismiss-on-close, and a ref-driven `open()` / `close()` API.
 *
 * Does NOT render its own trigger — consumers paint the trigger above and
 * call `ref.open()`. This keeps the primitive composable across very
 * different consumers (form Selects, hero pills, etc).
 *
 * Header layout (eliminates the "big empty top gap" complaint):
 *   - 24pt drag zone with a 5pt grab pill that scales up while held
 *   - Optional 40pt accent-tinted icon tile
 *   - Title (Poppins-SemiBold 17) + subtitle (Poppins-Regular 13)
 *   - Optional headerRight slot (used by Select for "Add New" / "Clear")
 *   - Circular close button on the trailing edge
 *
 * Drag-to-dismiss surface mirrors FileViewer: the SAME panResponder is
 * attached to both the drag pill zone AND the leading icon/title block,
 * so the entire informational chrome acts as one big swipe handle. The
 * trailing actions (`headerRight` + close X) sit outside the panResponder
 * Views as flex siblings so their Pressables stay tappable.
 *
 * Search:
 *   - Uses the SheetInput aesthetic (soft-fill, animated focus border)
 *   - Filters across `searchFields` (default: ['label', 'description'])
 *
 * Multi-select mode (`multiple={true}`):
 *   - `value` becomes an array of selected values (null/undefined treated as [])
 *   - Every toggle auto-commits via `onValueChange(nextArray)` — there is no
 *     Apply gate. The sheet stays open so the user can pick more, and
 *     dismissing (X / swipe / backdrop) just closes the sheet with the
 *     selections already applied to the underlying list.
 *   - A small Reset pill appears in the header when at least one item is
 *     selected; tapping it clears the selection in-place.
 *   - Default row renderer swaps the trailing check for a checkbox
 *
 * @param {object} props
 * @param {string} props.title - Sheet title
 * @param {string} [props.subtitle] - Sheet subtitle (under the title)
 * @param {Component} [props.icon] - Lucide icon for the leading tile
 * @param {ReactNode} [props.headerRight] - Optional element shown before the close button
 * @param {boolean} [props.searchable=true] - Show the search input
 * @param {boolean} [props.forceSearchable=false] - Show search even with <= 5 options
 * @param {string} [props.searchPlaceholder]
 * @param {string[]} [props.searchFields=['label','description']] - Option fields to filter on
 * @param {Array} props.options - { value, label, description?, ... }
 * @param {*} props.value - Single value, or array of values when `multiple` is true
 * @param {(value) => void} props.onValueChange - Called with the new value (single) or array (multi, on Apply)
 * @param {(args) => ReactNode} [props.renderItem] - Custom row renderer. In multi mode, args.isSelected reflects the live committed state, and args.onPress toggles immediately.
 * @param {boolean} [props.multiple=false] - Multi-select mode (see notes above)
 * @param {string} [props.resetLabel] - Override the Reset pill label (multi mode)
 * @param {number} [props.sheetHeightFraction=0.65]
 * @param {() => void} [props.onOpen]
 * @param {(query: string) => void} [props.onSearchChange] - Called when the user types in the search box
 * @param {ReactNode} [props.emptyState] - Custom empty-state node (replaces default copy)
 */
const BottomPickerSheet = forwardRef(function BottomPickerSheet({
  title,
  subtitle,
  icon: Icon,
  headerRight,
  searchable = true,
  forceSearchable = false,
  searchPlaceholder,
  searchFields = ['label', 'description'],
  options = [],
  value,
  onValueChange,
  renderItem,
  multiple = false,
  resetLabel,
  sheetHeightFraction = 0.65,
  onOpen,
  onSearchChange,
  emptyState,
}, ref) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const insetsBottom = insets.bottom;
  const tokens = useHeroSheetTokens();
  const {
    dark, sheetBg, accentColor, textColor, mutedColor, borderColor,
    inputBg, inputBorderIdle, inputBorderFocus, iconColor,
  } = tokens;
  const isRTL = useIsRTL();

  const sheetHeight = Dimensions.get('window').height * sheetHeightFraction;
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);

  const slideAnim = useRef(new Animated.Value(sheetHeight)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;
  const pillScale = useRef(new Animated.Value(1)).current;

  // For multi-select, the live selection IS the parent's value — every toggle
  // commits immediately. The sheet stays open so the user can pick more, and
  // closing (X / swipe / backdrop) just dismisses without any "discard"
  // semantics. This matches the user's instruction: "when I select I should
  // be able to swipe the filter away and see it's already pre-applied."
  const selectedSet = useMemo(
    () => (multiple ? new Set(toArray(value)) : null),
    [multiple, value]
  );
  const selectedCount = multiple ? toArray(value).length : 0;

  const slideIn = useCallback(() => {
    slideAnim.setValue(sheetHeight);
    backdropAnim.setValue(0);
    Animated.parallel([
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 65, friction: 11 }),
      Animated.timing(backdropAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
    ]).start();
  }, [slideAnim, backdropAnim, sheetHeight]);

  const slideOut = useCallback(() => {
    Keyboard.dismiss();
    Animated.parallel([
      Animated.timing(slideAnim, { toValue: sheetHeight, duration: 200, useNativeDriver: true }),
      Animated.timing(backdropAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => {
      setOpen(false);
      setSearch('');
      onSearchChange?.('');
    });
  }, [slideAnim, backdropAnim, sheetHeight, onSearchChange]);

  const openSheet = useCallback(() => {
    Keyboard.dismiss();
    onOpen?.();
    setSearch('');
    setOpen(true);
    requestAnimationFrame(() => slideIn());
  }, [slideIn, onOpen]);

  useImperativeHandle(ref, () => ({ open: openSheet, close: slideOut }), [openSheet, slideOut]);

  // Drag-to-dismiss responder — same handlers are attached to BOTH the drag
  // pill zone AND the icon/title block of the header so the entire
  // informational chrome (pill + leading icon + title + subtitle) acts as one
  // big swipe surface (matching FileViewer's chrome). The trailing actions
  // (`headerRight` + close X) live OUTSIDE the panResponder Views as flex
  // siblings, so they keep receiving their own taps without any hoisting.
  //
  // Claim-on-START fires `onPanResponderGrant` the instant the user touches,
  // letting us scale the drag pill up immediately for tactile feedback.
  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, g) => g.dy > 4,
    onPanResponderGrant: () => {
      Animated.spring(pillScale, {
        toValue: 1.4, useNativeDriver: true, tension: 200, friction: 8,
      }).start();
    },
    onPanResponderMove: (_, g) => {
      if (g.dy > 0) slideAnim.setValue(g.dy);
    },
    onPanResponderRelease: (_, g) => {
      Animated.spring(pillScale, {
        toValue: 1, useNativeDriver: true, tension: 200, friction: 8,
      }).start();
      if (g.dy > DISMISS_THRESHOLD || g.vy > 0.5) {
        slideOut();
      } else {
        Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 100, friction: 10 }).start();
      }
    },
    onPanResponderTerminate: () => {
      Animated.spring(pillScale, {
        toValue: 1, useNativeDriver: true, tension: 200, friction: 8,
      }).start();
      Animated.spring(slideAnim, {
        toValue: 0, useNativeDriver: true, tension: 100, friction: 10,
      }).start();
    },
    // Recreate when slideOut identity changes so the responder always has the
    // latest sheetHeight closure.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [slideOut]);

  const handleSelect = useCallback((val) => {
    if (multiple) {
      Haptics.selectionAsync().catch(() => {});
      const cur = toArray(value);
      const next = cur.includes(val) ? cur.filter((x) => x !== val) : [...cur, val];
      onValueChange?.(next);
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onValueChange?.(val);
    slideOut();
  }, [multiple, onValueChange, slideOut, value]);

  const resetMulti = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onValueChange?.([]);
  }, [onValueChange]);

  const filtered = useMemo(() => {
    if (!search.trim()) return options;
    const q = search.toLowerCase();
    return options.filter((o) =>
      searchFields.some((field) => {
        const v = o?.[field];
        return typeof v === 'string' && v.toLowerCase().includes(q);
      })
    );
  }, [options, search, searchFields]);

  const showEmpty = search.trim().length > 0 && filtered.length === 0;
  const showSearch = searchable && (forceSearchable || options.length > 5);

  // Default row renderer used when `renderItem` is not supplied.
  // NOTE: NativeWind's react-native-css-interop drops `flexDirection` from
  // functional `style={({ pressed }) => ({...})}` on Pressable. So we use a
  // static style array on the Pressable and put the row layout on an inner
  // plain View (which the interop layer leaves alone).
  const renderDefaultRow = useCallback(({ item, isSelected, onPress }) => {
    const bg = isSelected
      ? (dark ? 'rgba(148,210,165,0.10)' : 'hsl(148, 35%, 96%)')
      : 'transparent';
    return (
      <Pressable
        onPress={onPress}
        style={[defaultRowStyles.outer, { backgroundColor: bg }]}
      >
        <View style={[defaultRowStyles.row, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
          {multiple ? (
            <View
              style={{
                width: 22,
                height: 22,
                borderRadius: 6,
                borderWidth: 1.5,
                borderColor: isSelected ? accentColor : (dark ? 'hsl(150, 14%, 28%)' : 'hsl(148, 14%, 80%)'),
                backgroundColor: isSelected ? accentColor : 'transparent',
                alignItems: 'center',
                justifyContent: 'center',
                marginEnd: 14,
              }}
            >
              {isSelected ? <Check size={14} color="#ffffff" strokeWidth={3} /> : null}
            </View>
          ) : null}
          <View style={defaultRowStyles.textCol}>
            <Text
              style={{
                fontSize: 14,
                fontFamily: isSelected ? 'Poppins-SemiBold' : 'Poppins-Medium',
                color: isSelected ? accentColor : textColor,
                textAlign: isRTL ? 'right' : 'left',
              }}
              numberOfLines={1}
            >
              {item.label}
            </Text>
            {item.description ? (
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
                {item.description}
              </Text>
            ) : null}
          </View>
          {!multiple && isSelected ? <Check size={18} color={accentColor} strokeWidth={2.6} /> : null}
        </View>
      </Pressable>
    );
  }, [accentColor, dark, isRTL, mutedColor, multiple, textColor]);

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
            height: sheetHeight,
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
          {/* Drag pill zone — the entire ~24pt strip across the top is a
              swipe surface. Pill scales up the instant the user touches, so
              the chrome telegraphs "I'm being grabbed" exactly like
              FileViewer's chrome. */}
          <View
            {...panResponder.panHandlers}
            style={{
              height: 24,
              alignItems: 'center',
              justifyContent: 'center',
              paddingTop: 10,
            }}
          >
            <Animated.View
              style={{
                width: 44,
                height: 5,
                borderRadius: 3,
                backgroundColor: dark ? 'hsl(150, 14%, 28%)' : 'hsl(148, 14%, 80%)',
                transform: [{ scaleX: pillScale }],
              }}
            />
          </View>

          {/* Header — icon tile + title/subtitle column + headerRight + close.
              The leading block (icon + text col) ALSO gets the panResponder
              handlers so the whole informational chrome is one big swipe
              surface. The trailing block (`headerRight` + close X) sits
              OUTSIDE the panResponder Views as flex siblings, so its
              Pressables keep receiving their own taps cleanly. */}
          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'center',
              gap: 12,
              paddingHorizontal: 20,
              paddingTop: 6,
              paddingBottom: 14,
            }}
          >
            <View
              {...panResponder.panHandlers}
              style={{
                flex: 1,
                flexDirection: isRTL ? 'row-reverse' : 'row',
                alignItems: 'center',
                gap: 12,
                minWidth: 0,
              }}
            >
              {Icon ? (
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 12,
                    backgroundColor: dark ? 'rgba(148,210,165,0.16)' : 'hsl(148, 35%, 92%)',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Icon size={20} color={accentColor} strokeWidth={2.2} />
                </View>
              ) : null}

              <View style={{ flex: 1, minWidth: 0 }}>
                {title ? (
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
                    {title}
                  </Text>
                ) : null}
                {subtitle ? (
                  <Text
                    style={{
                      fontSize: 13,
                      fontFamily: 'Poppins-Regular',
                      color: mutedColor,
                      marginTop: 1,
                      textAlign: isRTL ? 'right' : 'left',
                    }}
                    numberOfLines={1}
                  >
                    {subtitle}
                  </Text>
                ) : null}
              </View>
            </View>

            {headerRight ? (
              <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 8 }}>
                {headerRight}
              </View>
            ) : null}

            <Pressable
              onPress={slideOut}
              hitSlop={8}
              style={{
                width: 32,
                height: 32,
                borderRadius: 16,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
              }}
            >
              <X size={16} color={mutedColor} strokeWidth={2.4} />
            </Pressable>
          </View>

          {/* Search — soft-fill SheetInput aesthetic */}
          {showSearch ? (
            <View style={{ paddingHorizontal: 20, paddingBottom: 14 }}>
              <View
                style={{
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                  alignItems: 'center',
                  backgroundColor: inputBg,
                  borderWidth: 1.5,
                  borderColor: searchFocused ? inputBorderFocus : inputBorderIdle,
                  borderRadius: 14,
                  paddingHorizontal: 14,
                  height: 48,
                }}
              >
                <Search size={17} color={searchFocused ? inputBorderFocus : iconColor} strokeWidth={2.2} />
                <TextInput
                  value={search}
                  onChangeText={(v) => {
                    setSearch(v);
                    onSearchChange?.(v);
                  }}
                  onFocus={() => setSearchFocused(true)}
                  onBlur={() => setSearchFocused(false)}
                  placeholder={searchPlaceholder || 'Search…'}
                  placeholderTextColor={mutedColor}
                  autoCorrect={false}
                  autoCapitalize="none"
                  returnKeyType="search"
                  style={{
                    flex: 1,
                    marginLeft: isRTL ? 0 : 10,
                    marginRight: isRTL ? 10 : 0,
                    fontFamily: 'Poppins-Regular',
                    fontSize: 14,
                    color: textColor,
                    height: '100%',
                    textAlign: isRTL ? 'right' : 'left',
                    writingDirection: isRTL ? 'rtl' : 'ltr',
                  }}
                />
                {search.length > 0 ? (
                  <Pressable
                    onPress={() => {
                      setSearch('');
                      onSearchChange?.('');
                    }}
                    hitSlop={8}
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 11,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                    }}
                  >
                    <X size={12} color={mutedColor} strokeWidth={2.6} />
                  </Pressable>
                ) : null}
              </View>
            </View>
          ) : null}

          {/* Hairline divider between chrome and list */}
          <View style={{ height: 1, backgroundColor: borderColor }} />

          {/* Options list */}
          <FlatList
            data={filtered}
            keyExtractor={(item) => String(item.value)}
            keyboardShouldPersistTaps="handled"
            style={{ flex: 1 }}
            contentContainerStyle={
              filtered.length === 0
                ? { flex: 1 }
                : { paddingBottom: 12 }
            }
            renderItem={({ item }) => {
              const isSelected = multiple
                ? selectedSet.has(item.value)
                : value === item.value;
              const onPress = () => handleSelect(item.value);
              if (renderItem) {
                return renderItem({ item, isSelected, primaryColor: accentColor, onPress });
              }
              return renderDefaultRow({ item, isSelected, onPress });
            }}
            extraData={value}
            ListEmptyComponent={showEmpty ? (
              emptyState !== undefined ? emptyState : (
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20, gap: 6 }}>
                  <Text
                    style={{
                      fontSize: 14,
                      fontFamily: 'Poppins-Medium',
                      color: textColor,
                    }}
                  >
                    No results
                  </Text>
                  <Text
                    style={{
                      fontSize: 12,
                      fontFamily: 'Poppins-Regular',
                      color: mutedColor,
                    }}
                  >
                    Nothing matches &ldquo;{search}&rdquo;
                  </Text>
                </View>
              )
            ) : null}
          />

          {/* Multi-select footer: Reset (leading) + Apply (trailing).
              CRITICAL: layout (flex, width, height, border, bg) lives in
              StyleSheet — NativeWind's css-interop strips layout from
              Pressable's functional style. See DESIGN_LANGUAGE.md §9. */}
          {multiple ? (
            <View
              style={[
                footerStyles.bar,
                {
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                  paddingBottom: insetsBottom + 12,
                  borderTopColor: borderColor,
                  backgroundColor: sheetBg,
                },
              ]}
            >
              <Pressable
                onPress={resetMulti}
                disabled={selectedCount === 0}
                android_ripple={{
                  color: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                  borderless: false,
                }}
                style={[
                  footerStyles.resetBtn,
                  {
                    borderColor: dark ? 'hsl(150, 14%, 24%)' : 'hsl(148, 14%, 88%)',
                    opacity: selectedCount === 0 ? 0.5 : 1,
                  },
                ]}
              >
                <View
                  style={[
                    footerStyles.resetInner,
                    { flexDirection: isRTL ? 'row-reverse' : 'row' },
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
                    {resetLabel || t('common.reset', 'Reset')}
                  </Text>
                </View>
              </Pressable>
              <Pressable
                onPress={slideOut}
                android_ripple={{ color: 'rgba(255,255,255,0.18)', borderless: false }}
                style={[
                  footerStyles.applyBtn,
                  { backgroundColor: accentColor },
                ]}
              >
                <Text
                  style={{
                    fontSize: 15,
                    fontFamily: 'Poppins-SemiBold',
                    color: '#ffffff',
                    letterSpacing: 0.1,
                  }}
                >
                  {selectedCount > 0
                    ? `${t('common.apply', 'Apply')} (${selectedCount})`
                    : t('common.done', 'Done')}
                </Text>
              </Pressable>
            </View>
          ) : null}
        </Animated.View>
      </View>
    </Modal>
  );
});

const defaultRowStyles = StyleSheet.create({
  outer: {
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  row: {
    alignItems: 'center',
  },
  textCol: {
    flex: 1,
    minWidth: 0,
  },
});

const footerStyles = StyleSheet.create({
  bar: {
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

export default BottomPickerSheet;
