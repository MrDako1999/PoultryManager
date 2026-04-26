import {
  useCallback, useId, useMemo, useRef, useState,
} from 'react';
import {
  View, Text, Pressable, Modal, ScrollView, Platform,
  StyleSheet, Animated, PanResponder, Dimensions, Keyboard,
  InputAccessoryView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import {
  X, Trash2, ChevronUp, ChevronDown,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useHeroSheetTokens } from '@/components/HeroSheetScreen';
import { useIsRTL } from '@/stores/localeStore';
import CtaButton from '@/components/ui/CtaButton';
import { rowDirection, textAlignStart } from '@/lib/rtl';
import useKeyboardHeight from '@/hooks/useKeyboardHeight';
import FormSheetContext from '@/components/FormSheetContext';

/**
 * FormSheet — reusable design-language chrome for create / edit sheets.
 *
 * iOS uses the native UIKit `presentationStyle="pageSheet"` Modal so we
 * get rounded top corners, parent peek, and OS-managed swipe-to-dismiss
 * for free.
 *
 * Android does NOT have a pageSheet presentation — `presentationStyle`
 * is iOS-only and a stock `<Modal>` always fills the screen with no
 * rounded corners or dismissal gesture. So on Android we render our own
 * sheet inside a transparent Modal:
 *   - Backdrop dims the parent (which is still visible through the
 *     transparent modal, mimicking pageSheet's parent peek).
 *   - Sheet slides up from the bottom with rounded top corners and a
 *     top gap so the user can see ~status bar + 24dp of parent.
 *   - Drag-pill area is wired to a PanResponder so dragging it down past
 *     a threshold (or with enough velocity) closes the sheet, matching
 *     iOS.
 *   - Backdrop tap and hardware-back also close.
 *
 * Keyboard handling is unified across both platforms via
 * `useKeyboardHeight` + `paddingBottom: keyboardHeight` on the inner
 * wrapper. We do NOT use `KeyboardAvoidingView` because:
 *   - On Android, the translucent modal's window does not honour
 *     `adjustResize`, so KAV's measurements are wrong and focused fields
 *     get hidden by the keyboard (what triggered this rewrite).
 *   - On iOS, `KAV behavior="padding"` works, but doing the padding
 *     ourselves keeps both platforms on one code path and lets us also
 *     render a keyboard accessory toolbar (Prev / Next / Done) right
 *     above the keyboard. That toolbar is essential on iOS where
 *     `decimal-pad` / `number-pad` keyboards have no Return key — the
 *     user otherwise has no way to advance between numeric fields.
 *
 * Layout in StyleSheet (§9 NativeWind trap rule). Tokens-only colors;
 * RTL-safe.
 *
 * @param {object} props
 * @param {boolean} props.open
 * @param {() => void} props.onClose
 * @param {string} props.title
 * @param {string} [props.subtitle]
 * @param {Component} [props.icon] - Lucide icon for the header tile
 * @param {ReactNode} [props.headerExtra] - Optional element under the header (e.g. step progress bar)
 * @param {ReactNode} props.children - Form body content
 * @param {ReactNode} [props.footerExtra] - Sticky footer slot above the primary button
 * @param {ReactNode} [props.footer] - Custom footer overrides the default Button entirely
 * @param {string} [props.submitLabel='Save']
 * @param {() => void} [props.onSubmit]
 * @param {boolean} [props.loading=false]
 * @param {boolean} [props.disabled=false]
 * @param {string} [props.deleteLabel] - Optional destructive text button under the primary
 * @param {() => void} [props.onDelete]
 * @param {object} [props.scrollViewProps] - Spread onto the inner ScrollView (ref, onLayout, etc.)
 * @param {object} [props.scrollContentStyle] - Extra style for the ScrollView contentContainer
 */
export default function FormSheet({
  open,
  onClose,
  title,
  subtitle,
  icon: Icon,
  headerExtra,
  children,
  footerExtra,
  footer,
  submitLabel,
  onSubmit,
  loading = false,
  disabled = false,
  deleteLabel,
  onDelete,
  scrollViewProps,
  scrollContentStyle,
}) {
  const insets = useSafeAreaInsets();
  const isRTL = useIsRTL();
  const { t } = useTranslation();
  const tokens = useHeroSheetTokens();
  const {
    dark, screenBg, sheetBg, accentColor, textColor, mutedColor, borderColor,
  } = tokens;

  const keyboardHeight = useKeyboardHeight();

  // Stable per-FormSheet id used as iOS InputAccessoryView's
  // nativeID. Tying SheetInputs to this ID via `inputAccessoryViewID`
  // makes iOS render OUR toolbar above the keyboard instead of its
  // automatic Next/Done pill (which was the duplicate Next button you
  // saw in the screenshot).
  const accessoryID = useId();

  // ScrollView ref + measurements — used by `scrollIntoView` so an
  // input can ask the sheet to bring it above the keyboard on focus.
  // We compose with a caller-provided ref/onLayout/onScroll on
  // `scrollViewProps` (e.g. ExpenseSheet uses these for its sticky
  // summary scroll-jump) so existing call sites keep working.
  const scrollRef = useRef(null);
  const scrollOffsetRef = useRef(0);

  // Input registry for keyboard navigation. Stored on a ref so
  // focusNext/Prev see fresh values without re-renders, plus a counter
  // state so the keyboard toolbar's enabled-state visuals update when
  // the registry changes (e.g. a conditional field mounts).
  const inputsRef = useRef([]);
  const [, setRegistryVersion] = useState(0);
  const [activeId, setActiveIdState] = useState(null);

  const setActive = useCallback((next) => {
    setActiveIdState((cur) => (typeof next === 'function' ? next(cur) : next));
  }, []);

  const register = useCallback((entry) => {
    inputsRef.current = [...inputsRef.current, entry];
    setRegistryVersion((v) => v + 1);
    return () => {
      inputsRef.current = inputsRef.current.filter((e) => e.id !== entry.id);
      setRegistryVersion((v) => v + 1);
    };
  }, []);

  const navigableEntries = useCallback(
    () => inputsRef.current.filter((e) => !e.multiline),
    []
  );

  const positionForId = useCallback((id) => {
    const list = navigableEntries();
    const index = list.findIndex((e) => e.id === id);
    return { index, count: list.length };
  }, [navigableEntries]);

  const focusByOffset = useCallback((id, dir) => {
    const list = navigableEntries();
    const idx = list.findIndex((e) => e.id === id);
    if (idx < 0) return false;
    const next = list[idx + dir];
    const node = next?.ref?.current;
    if (node?.focus) {
      node.focus();
      return true;
    }
    return false;
  }, [navigableEntries]);

  const focusNext = useCallback((id) => {
    const advanced = focusByOffset(id, 1);
    if (!advanced) Keyboard.dismiss();
  }, [focusByOffset]);

  const focusPrev = useCallback((id) => {
    focusByOffset(id, -1);
  }, [focusByOffset]);

  // Bring an input above the keyboard on focus.
  //
  // We use `measure` + `measureInWindow` instead of `measureLayout` —
  // on Fabric/new arch `measureLayout` requires either a numeric tag
  // (via `findNodeHandle`) or a host-component ref, and our previous
  // call into `sv.getInnerViewNode()` was returning `undefined`,
  // which is what triggered the
  //   "ref.measureLayout must be called with a ref to a native component"
  // dev warning. Window-coordinate maths here is straightforward and
  // works identically across both architectures.
  const scrollIntoView = useCallback((wrapperRef, opts = {}) => {
    const sv = scrollRef.current;
    const node = wrapperRef?.current;
    if (!sv || !node) return;
    const padding = opts.padding ?? 24;
    // Defer past the keyboard's appearance so the viewport
    // measurement reflects the keyboard-shrunk frame. ~200ms covers
    // iOS's ~250ms spring; on Android the keyboard is effectively
    // instant so this is a no-op delay.
    setTimeout(() => {
      if (typeof node.measure !== 'function') return;
      if (typeof sv.measureInWindow !== 'function') return;
      node.measure((nx, ny, nw, nh, npx, npy) => {
        if (typeof npy !== 'number' || typeof nh !== 'number') return;
        sv.measureInWindow((sx, sy, sw, sh) => {
          if (typeof sy !== 'number' || typeof sh !== 'number') return;
          const inputTop = npy;
          const inputBottom = npy + nh;
          const viewportTop = sy;
          const viewportBottom = sy + sh;
          let delta = 0;
          if (inputBottom + padding > viewportBottom) {
            delta = (inputBottom + padding) - viewportBottom;
          } else if (inputTop - padding < viewportTop) {
            delta = (inputTop - padding) - viewportTop;
          }
          if (delta !== 0) {
            const newY = Math.max(0, scrollOffsetRef.current + delta);
            sv.scrollTo({ y: newY, animated: true });
          }
        });
      });
    }, 200);
  }, []);

  const ctxValue = useMemo(() => ({
    register,
    focusNext,
    focusPrev,
    positionForId,
    scrollIntoView,
    setActive,
    scrollRef,
    accessoryID,
  }), [register, focusNext, focusPrev, positionForId, scrollIntoView, setActive, accessoryID]);

  if (!open) return null;

  const handleClose = () => {
    Haptics.selectionAsync().catch(() => {});
    onClose?.();
  };

  // Separate caller's ref/onLayout/onScroll from the rest of
  // scrollViewProps so we can compose them with our own measurement
  // wiring instead of having the spread overwrite us.
  const {
    ref: callerScrollRef,
    onLayout: callerOnLayout,
    onScroll: callerOnScroll,
    ...restScrollViewProps
  } = scrollViewProps || {};

  const setScrollRef = (node) => {
    scrollRef.current = node;
    if (typeof callerScrollRef === 'function') callerScrollRef(node);
    else if (callerScrollRef) callerScrollRef.current = node;
  };

  const navInfo = activeId ? positionForId(activeId) : { index: -1, count: 0 };
  const showToolbar = keyboardHeight > 0 && navInfo.count > 0;
  const canPrev = showToolbar && navInfo.index > 0;
  const canNext = showToolbar && navInfo.index >= 0 && navInfo.index < navInfo.count - 1;

  // Inner chrome (drag pill + header + body + footer + keyboard toolbar)
  // is identical on both platforms. We only differ in the wrapping
  // Modal presentation. The inner wrapper uses `paddingBottom:
  // keyboardHeight` so when the keyboard is up everything (footer +
  // toolbar) lifts above it without `KeyboardAvoidingView`.
  const renderInner = ({ panHandlers } = {}) => (
    <View
      style={{
        flex: 1,
        backgroundColor: screenBg,
        paddingBottom: keyboardHeight,
      }}
    >
      {/* Drag pill — on iOS pageSheet handles the gesture itself; on
          Android we attach panHandlers so dragging this strip dismisses
          the sheet. We pad the touch target so the user can grab it
          even though the visible pill is small. */}
      <View style={styles.dragZone} {...(panHandlers || {})}>
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
          { flexDirection: rowDirection(isRTL), backgroundColor: sheetBg },
        ]}
      >
        {Icon ? (
          <View
            style={[
              styles.iconTile,
              {
                backgroundColor: dark ? 'rgba(148,210,165,0.16)' : 'hsl(148, 35%, 92%)',
              },
            ]}
          >
            <Icon size={20} color={accentColor} strokeWidth={2.2} />
          </View>
        ) : null}
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
            {title}
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
          onPress={handleClose}
          hitSlop={8}
          style={[
            styles.closeBtn,
            { backgroundColor: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)' },
          ]}
          accessibilityRole="button"
        >
          <X size={16} color={mutedColor} strokeWidth={2.4} />
        </Pressable>
      </View>

      {headerExtra ? (
        <View style={{ backgroundColor: sheetBg, paddingHorizontal: 20, paddingBottom: 12 }}>
          {headerExtra}
        </View>
      ) : null}

      <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: borderColor }} />

      <ScrollView
        style={{ flex: 1, backgroundColor: screenBg }}
        contentContainerStyle={[
          { paddingTop: 16, paddingBottom: 24 },
          scrollContentStyle,
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        {...restScrollViewProps}
        ref={setScrollRef}
        onLayout={(e) => {
          callerOnLayout?.(e);
        }}
        onScroll={(e) => {
          scrollOffsetRef.current = e.nativeEvent.contentOffset.y;
          callerOnScroll?.(e);
        }}
      >
        {children}
      </ScrollView>

      {footerExtra}

      {/* Hide the primary submit footer while the keyboard is up.
          With it visible we ended up with three stacked bars (Create
          + accessory toolbar + keyboard) eating most of the form's
          vertical space. The user dismisses with the toolbar's Done
          and the Create button reappears underneath. This matches
          the iOS Mail / Notes / Reminders pattern. */}
      {keyboardHeight > 0 ? null : (footer ?? (
        <View
          style={[
            styles.footer,
            {
              backgroundColor: sheetBg,
              borderTopColor: borderColor,
              paddingBottom: Math.max(insets.bottom, 16),
            },
          ]}
        >
          <CtaButton
            variant="primary"
            label={submitLabel || t('common.save', 'Save')}
            onPress={onSubmit}
            loading={loading}
            disabled={disabled}
          />
          {deleteLabel && onDelete ? (
            <View style={{ marginTop: 10 }}>
              <CtaButton
                variant="destructive"
                icon={Trash2}
                label={deleteLabel}
                onPress={onDelete}
                disabled={loading}
              />
            </View>
          ) : null}
        </View>
      ))}

      {/* Android-only manual keyboard accessory toolbar. We render it
          inside the sheet's content area; with the wrapper's
          `paddingBottom: keyboardHeight` it lands right above the
          keyboard. iOS uses a real `InputAccessoryView` instead (see
          below) so iOS's UIKit doesn't render its own automatic
          Next/Done pill on top of ours. */}
      {Platform.OS === 'android' && showToolbar ? (
        <KeyboardToolbar
          isRTL={isRTL}
          tokens={tokens}
          onPrev={canPrev ? () => focusPrev(activeId) : null}
          onNext={canNext ? () => focusNext(activeId) : null}
          onDone={() => Keyboard.dismiss()}
          doneLabel={t('common.done', 'Done')}
        />
      ) : null}
    </View>
  );

  // iOS keyboard accessory — rendered via UIKit's
  // `UIInputAccessoryView`, attached to every SheetInput inside this
  // sheet via `inputAccessoryViewID`. This is what stops iOS from
  // also rendering its own automatic "Next" pill above the keyboard
  // (the duplicate Next button in the screenshot was that automatic
  // pill — once UIKit sees an explicit accessory view it stops
  // synthesising one). The accessory's contents are the same toolbar
  // we use on Android, so the behaviour is identical across platforms.
  const iosAccessory = (
    <InputAccessoryView nativeID={accessoryID}>
      <KeyboardToolbar
        isRTL={isRTL}
        tokens={tokens}
        onPrev={canPrev ? () => focusPrev(activeId) : null}
        onNext={canNext ? () => focusNext(activeId) : null}
        onDone={() => Keyboard.dismiss()}
        doneLabel={t('common.done', 'Done')}
      />
    </InputAccessoryView>
  );

  if (Platform.OS === 'ios') {
    return (
      <FormSheetContext.Provider value={ctxValue}>
        <Modal
          visible={open}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={onClose}
        >
          {renderInner()}
          {iosAccessory}
        </Modal>
      </FormSheetContext.Provider>
    );
  }

  return (
    <FormSheetContext.Provider value={ctxValue}>
      <AndroidPageSheet
        open={open}
        onClose={onClose}
        handleClose={handleClose}
        insets={insets}
        sheetBg={sheetBg}
        renderInner={renderInner}
      />
    </FormSheetContext.Provider>
  );
}

/**
 * Android-only "pageSheet" reimplementation. Lives in the same file so
 * the iOS path stays a one-line Modal and we don't ship the gesture
 * machinery to iOS users where UIKit already does it natively.
 *
 * The sheet is an Animated.View we translate down as the user drags
 * the drag-pill region, snapping to either close-velocity or back to 0.
 */
function AndroidPageSheet({ open, onClose, handleClose, insets, sheetBg, renderInner }) {
  const screenHeight = Dimensions.get('window').height;
  const dragY = useRef(new Animated.Value(0)).current;

  // Threshold and velocity thresholds match the iOS pageSheet feel.
  // ~25% of screen height OR a fast downward flick triggers dismissal.
  const DISMISS_DISTANCE = screenHeight * 0.25;
  const DISMISS_VELOCITY = 0.8;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 4,
      onPanResponderMove: (_, g) => {
        if (g.dy > 0) dragY.setValue(g.dy);
      },
      onPanResponderRelease: (_, g) => {
        if (g.dy > DISMISS_DISTANCE || g.vy > DISMISS_VELOCITY) {
          Animated.timing(dragY, {
            toValue: screenHeight,
            duration: 200,
            useNativeDriver: true,
          }).start(() => {
            dragY.setValue(0);
            handleClose();
          });
        } else {
          Animated.spring(dragY, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 4,
          }).start();
        }
      },
      onPanResponderTerminate: () => {
        Animated.spring(dragY, {
          toValue: 0,
          useNativeDriver: true,
        }).start();
      },
    })
  ).current;

  // Top gap leaves the parent peeking through, matching iOS pageSheet
  // (which insets the sheet ~status-bar + ~10pt). We use safe-area top
  // to keep gesture-nav and notch devices honest, plus a small extra
  // cushion.
  const topGap = insets.top + 12;

  return (
    <Modal
      visible={open}
      animationType="slide"
      transparent
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={StyleSheet.absoluteFill}>
        {/* Backdrop — tap closes. The transparency lets the underlying
            screen show through, the same way iOS pageSheet does. */}
        <Pressable
          onPress={handleClose}
          style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.35)' }]}
        />
        <Animated.View
          style={{
            position: 'absolute',
            top: topGap,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: sheetBg,
            borderTopLeftRadius: 14,
            borderTopRightRadius: 14,
            overflow: 'hidden',
            transform: [{ translateY: dragY }],
            elevation: 16,
          }}
        >
          {renderInner({ panHandlers: panResponder.panHandlers })}
        </Animated.View>
      </View>
    </Modal>
  );
}

/**
 * Sticky band rendered just above the keyboard with Prev / Next /
 * Done. Prev and Next jump between single-line inputs registered
 * through `FormSheetContext`; multiline fields are intentionally
 * skipped so Return keeps inserting a newline in them. Done dismisses
 * the keyboard.
 */
function KeyboardToolbar({ isRTL, tokens, onPrev, onNext, onDone, doneLabel }) {
  const {
    sheetBg, borderColor, textColor, accentColor,
  } = tokens;
  return (
    <View
      style={[
        styles.toolbar,
        {
          backgroundColor: sheetBg,
          borderTopColor: borderColor,
          flexDirection: rowDirection(isRTL),
        },
      ]}
    >
      <Pressable
        onPress={onPrev || undefined}
        disabled={!onPrev}
        hitSlop={6}
        style={[styles.toolbarBtn, { opacity: onPrev ? 1 : 0.3 }]}
        accessibilityRole="button"
        accessibilityLabel="Previous field"
      >
        <ChevronUp size={20} color={textColor} strokeWidth={2.2} />
      </Pressable>
      <Pressable
        onPress={onNext || undefined}
        disabled={!onNext}
        hitSlop={6}
        style={[styles.toolbarBtn, { opacity: onNext ? 1 : 0.3 }]}
        accessibilityRole="button"
        accessibilityLabel="Next field"
      >
        <ChevronDown size={20} color={textColor} strokeWidth={2.2} />
      </Pressable>
      <View style={{ flex: 1 }} />
      <Pressable
        onPress={onDone}
        hitSlop={8}
        style={styles.toolbarDone}
        accessibilityRole="button"
      >
        <Text
          style={{
            color: accentColor,
            fontSize: 15,
            fontFamily: 'Poppins-SemiBold',
          }}
        >
          {doneLabel}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  dragZone: {
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 8,
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
  footer: {
    paddingHorizontal: 20,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  toolbar: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    gap: 4,
  },
  toolbarBtn: {
    width: 40,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolbarDone: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
});
