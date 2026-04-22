import { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, Pressable, Animated, Modal, StyleSheet, Easing,
  useWindowDimensions, Platform, I18nManager,
} from 'react-native';
import { Plus } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import useThemeStore from '@/stores/themeStore';

const FAB_SIZE = 56;
const MENU_GAP = 10;
const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1);

/**
 * Floating action button. Two modes:
 *
 * - **Direct action** (`directAction` prop set) — single-tap fires `directAction`
 *   immediately. The dim/menu modal is never shown. Used by BatchDetail's
 *   non-quick-add tabs (Sources/Sales/etc.) where there's only one create flow.
 *
 * - **Menu** (`items` prop) — tapping the FAB opens a small card of choices.
 *   The card and its dim backdrop render inside a native `<Modal>` so they
 *   sit on their own native window above EVERYTHING (tab bars, status bars,
 *   anything with `overflow: hidden` in the parent tree). This is the
 *   §8.h.1 popout pattern — without the Modal the dim would be clipped by
 *   the tab bar on tab-landing screens (Directory, BatchesList).
 *
 * The FAB pill stays visually still on open/close. The in-tree pill goes
 * to `opacity: 0` while the menu modal is open, and an identical clone is
 * rendered inside the Modal at the EXACT same screen coordinates (captured
 * via `measureInWindow()`). This avoids the bug where `bottom: bottomInset
 * + 16` resolves to different physical positions in the in-tree parent
 * (which may be clipped by a tab bar) versus the Modal's full-screen
 * native window.
 */
export default function QuickAddFAB({ items, bottomInset = 0, directAction = null }) {
  const { resolvedTheme } = useThemeStore();
  const dark = resolvedTheme === 'dark';
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();

  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState(null); // { x, y, width, height } in window coords
  const triggerRef = useRef(null);
  // Selected item's onPress is deferred until AFTER the FAB modal is fully
  // dismissed. Opening a second iOS Modal (pageSheet) while this one is
  // still mid-dismiss locks up the UI / crashes (you tap an item and
  // nothing happens, or the app freezes).
  const pendingActionRef = useRef(null);

  const card = useRef(new Animated.Value(0)).current;
  const rowsRef = useRef(null);
  if (!rowsRef.current) rowsRef.current = (items || []).map(() => new Animated.Value(0));
  const rows = rowsRef.current;
  const primaryColor = dark ? 'hsl(148, 48%, 38%)' : 'hsl(148, 60%, 20%)';

  const startOpenAnimation = useCallback(() => {
    card.setValue(0);
    rows.forEach((r) => r.setValue(0));
    Animated.parallel([
      Animated.timing(card, {
        toValue: 1,
        duration: 240,
        easing: EASE_OUT,
        useNativeDriver: true,
      }),
      Animated.stagger(
        35,
        [...rows].reverse().map((r) =>
          Animated.timing(r, {
            toValue: 1,
            duration: 280,
            easing: EASE_OUT,
            useNativeDriver: true,
          }),
        ),
      ),
    ]).start();
  }, [card, rows]);

  const show = useCallback(() => {
    triggerRef.current?.measureInWindow?.((x, y, width, height) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      setAnchor({ x, y, width, height });
      setOpen(true);
      requestAnimationFrame(startOpenAnimation);
    });
  }, [startOpenAnimation]);

  const hide = useCallback(() => {
    Animated.timing(card, {
      toValue: 0,
      duration: 130,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      rows.forEach((r) => r.setValue(0));
      setOpen(false);
    });
  }, [card, rows]);

  const toggle = useCallback(() => {
    if (directAction) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      directAction();
      return;
    }
    if (open) hide();
    else show();
  }, [open, show, hide, directAction]);

  const handleSelect = useCallback(
    (onPress) => {
      // Queue the action and start dismissing. The action fires from the
      // Modal's onDismiss (iOS) or from the open->false effect (Android).
      pendingActionRef.current = onPress;
      hide();
    },
    [hide],
  );

  const flushPendingAction = useCallback(() => {
    const fn = pendingActionRef.current;
    if (!fn) return;
    pendingActionRef.current = null;
    fn();
  }, []);

  // Android Modal has no onDismiss; the close is effectively immediate, so
  // run the queued action one frame after the open flag flips false.
  useEffect(() => {
    if (open || Platform.OS === 'ios') return;
    if (!pendingActionRef.current) return;
    const id = setTimeout(flushPendingAction, 50);
    return () => clearTimeout(id);
  }, [open, flushPendingAction]);

  const fabRotation = card.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '45deg'],
  });

  const cardScale = card.interpolate({
    inputRange: [0, 1],
    outputRange: [0.4, 1],
  });
  const cardTranslateY = card.interpolate({
    inputRange: [0, 1],
    outputRange: [40, 0],
  });

  const fabBg = dark ? 'hsl(148, 48%, 38%)' : 'hsl(148, 60%, 20%)';

  // Menu position derived purely from the FAB's window-anchor. Since the
  // Modal's window IS the full screen, convert the FAB's window-y (top
  // edge from window top) into a `bottom` offset from the window bottom,
  // then add MENU_GAP to lift the card off the FAB. Using `bottom` lets
  // the card grow upward naturally without needing its own height.
  const menuBottom = anchor ? windowHeight - anchor.y + MENU_GAP : 0;

  // The in-tree FAB pins itself with `right: 20`, which iOS Yoga auto-
  // flips to `left: 20` whenever `I18nManager.isRTL` is true. So the
  // captured `anchor.x` reflects the *physical* screen position (eg. ~20
  // from the screen's left edge in RTL).
  //
  // The Modal lives in its own native window where `left` and `right`
  // also get auto-flipped. If we just write `left: anchor.x` on the
  // clone, that ~20 gets re-mirrored to "20 from the right edge" — and
  // the FAB visibly jumps to the opposite side the moment the user opens
  // the menu (exactly the bug in the user's screenshots).
  //
  // Pre-mirror the x-coordinate when native RTL is active so the auto-
  // flip lands the clone right back on top of the in-tree FAB. Same idea
  // as `rowDirection` — we'd rather counteract Yoga than fight it.
  const cloneLeft = anchor
    ? (I18nManager.isRTL ? windowWidth - anchor.x - anchor.width : anchor.x)
    : 0;

  return (
    <>
      {/* In-tree FAB. Anchored to the bottom-right of its parent (which is
          the page, not the modal). Goes invisible while the menu is open;
          the modal renders an identical clone at the captured coords. */}
      <Pressable
        ref={triggerRef}
        onPress={toggle}
        style={[
          styles.fab,
          {
            backgroundColor: fabBg,
            right: 20,
            bottom: bottomInset + 16,
            opacity: open ? 0 : 1,
          },
        ]}
      >
        <Animated.View style={{ transform: [{ rotate: fabRotation }] }}>
          <Plus size={24} color="#fff" />
        </Animated.View>
      </Pressable>

      {!directAction && (
        <Modal
          transparent
          visible={open}
          statusBarTranslucent
          animationType="none"
          onRequestClose={hide}
          onDismiss={Platform.OS === 'ios' ? flushPendingAction : undefined}
        >
          {/* Dim backdrop — fills the Modal's native window which spans the
              entire screen, including the tab bar. */}
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: 'rgba(0,0,0,0.45)', opacity: card },
            ]}
          >
            <Pressable style={StyleSheet.absoluteFill} onPress={hide} />
          </Animated.View>

          {anchor && (
            <>
              {/* Menu — positioned via `bottom` so it grows upward from
                  MENU_GAP above the FAB's top edge. */}
              <Animated.View
                style={{
                  position: 'absolute',
                  right: 20,
                  bottom: menuBottom,
                  opacity: card,
                  transform: [{ scale: cardScale }, { translateY: cardTranslateY }],
                  transformOrigin: 'bottom right',
                }}
              >
                <View
                  style={{
                    backgroundColor: dark ? 'hsl(150, 16%, 16%)' : '#ffffff',
                    borderColor: dark ? 'hsl(150, 12%, 28%)' : 'hsl(148, 14%, 90%)',
                    borderWidth: dark ? 1 : 0,
                    borderRadius: 16,
                    minWidth: 200,
                    overflow: 'hidden',
                    elevation: 12,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 6 },
                    shadowOpacity: 0.22,
                    shadowRadius: 16,
                  }}
                >
                  {items.map((item, index) => {
                    const r = rows[index];
                    const rowTranslateX = r.interpolate({
                      inputRange: [0, 1],
                      outputRange: [24, 0],
                    });
                    const rowOpacity = r.interpolate({
                      inputRange: [0, 0.4, 1],
                      outputRange: [0, 0.6, 1],
                    });

                    const Icon = item.icon;
                    return (
                      <Animated.View
                        key={item.key}
                        style={{
                          opacity: rowOpacity,
                          transform: [{ translateX: rowTranslateX }],
                        }}
                      >
                        <Pressable
                          onPress={() => handleSelect(item.onPress)}
                          style={({ pressed }) => ({
                            backgroundColor: pressed
                              ? (dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)')
                              : 'transparent',
                          })}
                        >
                          <View
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              paddingHorizontal: 14,
                              paddingVertical: 12,
                              gap: 12,
                              borderTopWidth: index > 0 ? StyleSheet.hairlineWidth : 0,
                              borderTopColor: dark
                                ? 'rgba(255,255,255,0.08)'
                                : 'rgba(0,0,0,0.06)',
                            }}
                          >
                            <View
                              style={{
                                width: 30,
                                height: 30,
                                borderRadius: 8,
                                alignItems: 'center',
                                justifyContent: 'center',
                                backgroundColor: dark
                                  ? 'rgba(76,175,80,0.15)'
                                  : 'rgba(30,70,30,0.08)',
                              }}
                            >
                              <Icon size={15} color={primaryColor} />
                            </View>
                            <Text
                              style={{
                                fontSize: 13,
                                fontFamily: 'Poppins-SemiBold',
                                color: dark ? '#f0f5f0' : '#0f1f10',
                              }}
                            >
                              {item.label}
                            </Text>
                          </View>
                        </Pressable>
                      </Animated.View>
                    );
                  })}
                </View>
              </Animated.View>

              {/* FAB clone — pinned to the captured screen coordinates so
                  it overlays the in-tree FAB pixel-perfect. Tappable while
                  the dim backdrop is showing. `cloneLeft` is pre-mirrored
                  in RTL mode so the Modal's auto-flip puts the clone back
                  exactly where the in-tree FAB lives. */}
              <Pressable
                onPress={toggle}
                style={[
                  styles.fab,
                  {
                    backgroundColor: fabBg,
                    left: cloneLeft,
                    top: anchor.y,
                  },
                ]}
              >
                <Animated.View style={{ transform: [{ rotate: fabRotation }] }}>
                  <Plus size={24} color="#fff" />
                </Animated.View>
              </Pressable>
            </>
          )}
        </Modal>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
  },
});
