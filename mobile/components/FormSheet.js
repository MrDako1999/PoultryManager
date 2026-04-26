import { useRef } from 'react';
import {
  View, Text, Pressable, Modal, ScrollView, KeyboardAvoidingView, Platform,
  StyleSheet, Animated, PanResponder, Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X, Trash2 } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useHeroSheetTokens } from '@/components/HeroSheetScreen';
import { useIsRTL } from '@/stores/localeStore';
import CtaButton from '@/components/ui/CtaButton';
import { rowDirection, textAlignStart } from '@/lib/rtl';

/**
 * FormSheet — reusable design-language chrome for create / edit sheets.
 *
 * iOS uses the native UIKit `presentationStyle="pageSheet"` Modal so we get
 * the rounded top corners, parent peek, and OS-managed swipe-to-dismiss for
 * free.
 *
 * Android does NOT have a pageSheet presentation — `presentationStyle` is
 * an iOS-only Modal prop and a stock `<Modal>` always fills the screen with
 * no rounded corners or dismissal gesture. So on Android we render our own
 * sheet inside a transparent Modal:
 *   - Backdrop dims the parent (which is still visible through the
 *     transparent modal, mimicking pageSheet's parent peek).
 *   - Sheet slides up from the bottom with rounded top corners and a top
 *     gap so the user can see ~status bar + 24dp of parent.
 *   - Drag-pill area is wired to a PanResponder so dragging it down past a
 *     threshold (or with enough velocity) closes the sheet, matching iOS.
 *   - Backdrop tap and hardware-back also close.
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
  const tokens = useHeroSheetTokens();
  const {
    dark, screenBg, sheetBg, accentColor, textColor, mutedColor, borderColor,
  } = tokens;

  if (!open) return null;

  const handleClose = () => {
    Haptics.selectionAsync().catch(() => {});
    onClose?.();
  };

  // Inner chrome (drag pill + header + body + footer) is identical on both
  // platforms. We only differ in the wrapping Modal presentation.
  const renderInner = ({ panHandlers } = {}) => (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      enabled={Platform.OS === 'ios'}
      style={{ flex: 1, backgroundColor: screenBg }}
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
        {...scrollViewProps}
      >
        {children}
      </ScrollView>

      {footerExtra}

      {footer ?? (
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
            label={submitLabel || 'Save'}
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
      )}
    </KeyboardAvoidingView>
  );

  if (Platform.OS === 'ios') {
    return (
      <Modal
        visible={open}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={onClose}
      >
        {renderInner()}
      </Modal>
    );
  }

  return (
    <AndroidPageSheet
      open={open}
      onClose={onClose}
      handleClose={handleClose}
      insets={insets}
      sheetBg={sheetBg}
      renderInner={renderInner}
    />
  );
}

/**
 * Android-only "pageSheet" reimplementation. Lives in the same file so the
 * iOS path stays a one-line Modal and we don't ship the gesture machinery
 * to iOS users where UIKit already does it natively.
 *
 * The sheet is an Animated.View we translate down as the user drags the
 * drag-pill region, snapping to either close-velocity or back to 0.
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
  // (which inset the sheet ~status-bar + ~10pt). We use safe-area top to
  // keep gesture-nav and notch devices honest, plus a small extra cushion.
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
});
