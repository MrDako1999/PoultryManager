import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, Pressable, ActivityIndicator, ScrollView, Alert, Animated, Easing,
  Dimensions, Modal, StyleSheet,
} from 'react-native';
import {
  RefreshCw, WifiOff, Wifi, AlertCircle, Check, X, Trash2, RotateCcw, DatabaseZap,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import useSyncStore from '@/stores/syncStore';
import { useHeroSheetTokens } from '@/components/HeroSheetScreen';
import { useIsRTL } from '@/stores/localeStore';
import { deltaSync, processQueue, fullResync } from '@/lib/syncEngine';
import { getFailedEntries, retryFailed, discardFailed } from '@/lib/mutationQueue';
import { formatTimeAgo } from '@/lib/relativeDate';
import { rowDirection, trailingAlignment, textAlignStart } from '@/lib/rtl';

const SCREEN_WIDTH = Dimensions.get('window').width;
const POPOVER_WIDTH = Math.min(SCREEN_WIDTH - 32, 320);
const POPOVER_GAP = 8;            // distance from trigger to the popover top
const POPOVER_EDGE_PADDING = 16;  // minimum gap from the screen edge

/**
 * Compact action button for the popout floater.
 *
 * Inlined here (not in `ui/Button.js`) because the global `Button` uses
 * NativeWind / CSS-variable colour tokens that don't reliably swap between
 * light and dark mode on RN — the `outline` variant in particular renders
 * with the light-mode `bg-background` (≈ off-white) even when the rest of
 * the app is in dark mode, leaving the label invisible. See DL §2 (colours
 * must flow through `useHeroSheetTokens`) and §13 (no ad-hoc colours).
 *
 * Variants:
 *   - `primary`   — filled accent green, white content. Sync Now.
 *   - `secondary` — `elevatedCardBg` + `elevatedCardBorder` + `textColor`.
 *                   The button sits on `sectionBg` (the popover surface),
 *                   so "elevated card" is the documented one-layer-up
 *                   tappable surface (DL §2 lightness ladder).
 *
 * Layout lives in `StyleSheet.create` and on a plain inner `<View>`, never
 * inside a Pressable functional `style`. See DL §9 "NativeWind / Pressable
 * functional-style trap."
 */
function PopoverActionButton({
  variant = 'primary',
  icon: Icon,
  label,
  onPress,
  disabled = false,
  loading = false,
  isRTL,
  tokens,
}) {
  const {
    dark, accentColor, textColor,
    elevatedCardBg, elevatedCardBorder, elevatedCardPressedBg,
  } = tokens;
  const [pressed, setPressed] = useState(false);

  const palette = variant === 'secondary'
    ? {
      idleBg: elevatedCardBg,
      pressedBg: elevatedCardPressedBg,
      border: pressed ? accentColor : elevatedCardBorder,
      fg: textColor,
      ripple: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
    }
    : {
      idleBg: accentColor,
      pressedBg: dark ? 'hsl(148, 55%, 48%)' : 'hsl(148, 60%, 24%)',
      // Filled buttons paint the border in the fill colour so the 1pt
      // edge doesn't show — keeps the height pixel-identical to the
      // secondary variant which needs a visible border.
      border: accentColor,
      fg: '#f5f8f5',
      ripple: 'rgba(255,255,255,0.18)',
    };

  const isBlocked = disabled || loading;

  return (
    <Pressable
      onPressIn={() => {
        if (isBlocked) return;
        setPressed(true);
        Haptics.selectionAsync().catch(() => {});
      }}
      onPressOut={() => setPressed(false)}
      onPress={onPress}
      disabled={isBlocked}
      android_ripple={{ color: palette.ripple, borderless: false }}
      style={[
        popButtonStyles.btn,
        {
          backgroundColor: pressed ? palette.pressedBg : palette.idleBg,
          borderColor: palette.border,
          opacity: isBlocked ? 0.55 : 1,
        },
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: isBlocked, busy: loading }}
    >
      <View style={[popButtonStyles.inner, { flexDirection: rowDirection(isRTL) }]}>
        {loading ? (
          <ActivityIndicator size="small" color={palette.fg} />
        ) : Icon ? (
          <Icon size={13} color={palette.fg} strokeWidth={2.4} />
        ) : null}
        <Text
          style={{
            fontSize: 13,
            fontFamily: 'Poppins-SemiBold',
            color: palette.fg,
          }}
          numberOfLines={1}
        >
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

const popButtonStyles = StyleSheet.create({
  btn: {
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inner: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
});

/**
 * Sync icon trigger + popout floater.
 *
 * Visual:
 *   - 36pt translucent-white circular icon button (badge bubble for pending /
 *     failed counts, spinner when syncing). Sits in the hero toolbar.
 *   - On tap, a small floating card pops out below the icon with a spring
 *     bounce (`Easing.back(1.4)`) and an arrow nub pointing back at the
 *     trigger. The card carries the sync status, action buttons, and any
 *     failed-entries list.
 *
 * The popover renders inside a `<Modal>` so it can never be clipped by the
 * hero gradient or any other parent's `overflow: hidden`. Its on-screen
 * position is derived from the trigger's `measureInWindow()` coords plus a
 * fixed offset, so it visually still lives "right under" the icon.
 */
export default function SyncIconButton() {
  const { t } = useTranslation();
  const tokens = useHeroSheetTokens();
  const {
    dark, sectionBg, sectionBorder, textColor, mutedColor, accentColor, errorColor,
  } = tokens;
  const isRTL = useIsRTL();

  const { isOnline, isSyncing, pendingCount, failedCount, lastSyncAt } = useSyncStore();

  const triggerRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState(null); // { x, y, width, height } in window coords
  const [failedEntries, setFailedEntries] = useState([]);
  const [syncing, setSyncing] = useState(false);
  const [retryingId, setRetryingId] = useState(null);

  const scaleAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  const dangerColor = errorColor;
  const amberColor = dark ? '#fbbf24' : '#d97706';

  // ---- Trigger glyph + badge state ---------------------------------------
  // Mirrors the web `SyncIndicator`: the glyph expresses the dominant
  // state (offline trumps everything; syncing trumps idle), but the
  // badge count is computed independently so the user keeps seeing how
  // many changes are waiting / failed even while offline. Without this,
  // going into airplane mode would erase the queue depth indicator and
  // make it look like the app silently dropped the work.
  let TriggerIcon = Check;
  if (!isOnline) {
    TriggerIcon = WifiOff;
  } else if (isSyncing) {
    TriggerIcon = null;
  } else if (failedCount > 0) {
    TriggerIcon = AlertCircle;
  } else if (pendingCount > 0) {
    TriggerIcon = RefreshCw;
  }

  // Failed always wins over pending — once a mutation has hit a
  // permanent error, surfacing that takes priority over "still has
  // queued work."
  const badgeCount = failedCount > 0 ? failedCount : pendingCount;
  const badgeColor = failedCount > 0 ? dangerColor : amberColor;

  // ---- Open / close ------------------------------------------------------
  const loadFailed = useCallback(async () => {
    try {
      const entries = await getFailedEntries();
      setFailedEntries(entries);
    } catch {
      setFailedEntries([]);
    }
  }, []);

  useEffect(() => {
    if (open) loadFailed();
  }, [open, isSyncing, pendingCount, failedCount, loadFailed]);

  const show = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    triggerRef.current?.measureInWindow?.((x, y, width, height) => {
      setAnchor({ x, y, width, height });
      setOpen(true);
      requestAnimationFrame(() => {
        scaleAnim.setValue(0);
        opacityAnim.setValue(0);
        Animated.parallel([
          Animated.timing(scaleAnim, {
            toValue: 1,
            duration: 220,
            easing: Easing.out(Easing.back(1.4)),
            useNativeDriver: true,
          }),
          Animated.timing(opacityAnim, {
            toValue: 1,
            duration: 180,
            useNativeDriver: true,
          }),
        ]).start();
      });
    });
  };

  const hide = useCallback(() => {
    Animated.parallel([
      Animated.timing(scaleAnim, {
        toValue: 0,
        duration: 150,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start(() => setOpen(false));
  }, [scaleAnim, opacityAnim]);

  // ---- Position math (window-coord based, locale-agnostic) --------------
  // The popover is positioned by the trigger's *actual* screen position,
  // not by `isRTL`. Earlier we tried to be clever and align the popover's
  // "trailing" edge to the trigger's trailing edge based on the locale —
  // but `headerRight` slots in some screens don't get auto-mirrored, so
  // the trigger can sit on the right edge in Arabic too. The result was a
  // popover that drifted to the wrong side of the screen with the arrow
  // pointing at empty space (see the user's RTL screenshot).
  //
  // The robust recipe used by every native popover system: place the
  // popover so its arrow center sits as close to the trigger center as
  // possible, then clamp the popover horizontally so it stays on screen.
  // The arrow is then re-clamped relative to the popover.
  let popLeft = 0;
  let popTop = 0;
  let arrowLeft = 0;
  if (anchor) {
    const triggerCenter = anchor.x + anchor.width / 2;
    const minLeft = POPOVER_EDGE_PADDING;
    const maxLeft = SCREEN_WIDTH - POPOVER_WIDTH - POPOVER_EDGE_PADDING;

    // Prefer aligning the popover edge to the trigger edge that is
    // *farthest* from the screen edge — this keeps the bulk of the
    // popover toward the screen interior and minimises clamping.
    const screenMid = SCREEN_WIDTH / 2;
    if (triggerCenter > screenMid) {
      // Trigger on the right half — align popover's right edge with the
      // trigger's right edge so it grows leftwards into screen.
      popLeft = anchor.x + anchor.width - POPOVER_WIDTH;
    } else {
      // Trigger on the left half — align left edges so it grows rightwards.
      popLeft = anchor.x;
    }
    popLeft = Math.max(minLeft, Math.min(maxLeft, popLeft));

    // Arrow nub points back at the trigger center, but never closer than
    // 12pt to either popover corner so the rounded corner doesn't clip
    // the diamond.
    arrowLeft = Math.max(12, Math.min(POPOVER_WIDTH - 24, triggerCenter - popLeft - 6));
    popTop = anchor.y + anchor.height + POPOVER_GAP;
  }

  // ---- Status (header line) -----------------------------------------------
  let statusIcon;
  let statusLabel;
  let statusColor;
  if (!isOnline) {
    statusIcon = <WifiOff size={16} color={dangerColor} />;
    statusLabel = t('sync.offline', 'Offline');
    statusColor = dangerColor;
  } else if (isSyncing || syncing) {
    statusIcon = <ActivityIndicator size={14} color={accentColor} />;
    statusLabel = t('sync.syncing', 'Syncing\u2026');
    statusColor = accentColor;
  } else if (failedCount > 0) {
    statusIcon = <AlertCircle size={16} color={dangerColor} />;
    statusLabel = t('sync.failedCount', '{{n}} Failed', { n: failedCount });
    statusColor = dangerColor;
  } else if (pendingCount > 0) {
    statusIcon = <RefreshCw size={16} color={amberColor} />;
    statusLabel = t('sync.pendingCount', '{{n}} Pending', { n: pendingCount });
    statusColor = amberColor;
  } else {
    statusIcon = <Check size={16} color={accentColor} />;
    statusLabel = t('sync.allSynced', 'All Synced');
    statusColor = accentColor;
  }

  // ---- Actions -----------------------------------------------------------
  const handleSyncNow = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setSyncing(true);
    try {
      await deltaSync();
      await processQueue();
    } catch {
      /* surfaced via syncStore */
    } finally {
      setSyncing(false);
      await loadFailed();
    }
  };

  const handleFullResync = () => {
    hide();
    setTimeout(() => {
      Alert.alert(
        t('sync.fullResyncTitle', 'Full Resync'),
        pendingCount > 0
          ? t(
              'sync.fullResyncBodyPending',
              'This will clear all local data and re-download from the server.\n\nYou have {{count}} unsynced changes that will be lost.',
              { count: pendingCount }
            )
          : t(
              'sync.fullResyncBodyClean',
              'This will clear all local data and re-download everything from the server.'
            ),
        [
          { text: t('common.cancel', 'Cancel'), style: 'cancel' },
          {
            text: t('sync.resync', 'Resync'),
            style: 'destructive',
            onPress: () => fullResync(),
          },
        ]
      );
    }, 200);
  };

  const handleRetry = async (id) => {
    setRetryingId(id);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    try {
      await retryFailed(id);
      await processQueue();
      await loadFailed();
    } finally {
      setRetryingId(null);
    }
  };

  const handleDiscard = (id, entityType, action) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    Alert.alert(
      t('sync.discardChangeTitle', 'Discard Change'),
      t(
        'sync.discardChangeBody',
        'Discard this failed {{action}} on {{entity}}? This cannot be undone.',
        { action, entity: entityType }
      ),
      [
        { text: t('common.cancel', 'Cancel'), style: 'cancel' },
        {
          text: t('sync.discard', 'Discard'),
          style: 'destructive',
          onPress: async () => {
            await discardFailed(id);
            await loadFailed();
          },
        },
      ]
    );
  };

  return (
    <View>
      {/* Trigger — translucent-white circle on the hero gradient */}
      <Pressable
        ref={triggerRef}
        onPress={open ? hide : show}
        hitSlop={8}
        style={{
          width: 36,
          height: 36,
          borderRadius: 18,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'rgba(255,255,255,0.18)',
        }}
      >
        {TriggerIcon ? (
          <TriggerIcon size={18} color="#ffffff" strokeWidth={2.2} />
        ) : (
          <ActivityIndicator size="small" color="#ffffff" />
        )}
        {badgeCount > 0 ? (
          <View
            style={{
              position: 'absolute',
              top: -3,
              right: -3,
              backgroundColor: badgeColor,
              borderRadius: 8,
              minWidth: 16,
              height: 16,
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: 4,
              borderWidth: 1.5,
              borderColor: dark ? 'hsl(148, 65%, 14%)' : 'hsl(148, 60%, 22%)',
            }}
          >
            <Text
              style={{
                fontSize: 9,
                fontFamily: 'Poppins-Bold',
                color: '#ffffff',
                lineHeight: 12,
              }}
            >
              {badgeCount > 9 ? '9+' : badgeCount}
            </Text>
          </View>
        ) : null}
      </Pressable>

      {/* Popout floater — lives inside a Modal so it can never be clipped
          by the hero gradient or any parent overflow:hidden. */}
      <Modal
        transparent
        visible={open}
        animationType="none"
        statusBarTranslucent
        onRequestClose={hide}
      >
        {/* Invisible full-screen backdrop — taps anywhere outside the
            popover dismiss it. */}
        <Pressable
          onPress={hide}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        />

        {anchor ? (
          <Animated.View
            style={{
              position: 'absolute',
              top: popTop,
              left: popLeft,
              width: POPOVER_WIDTH,
              opacity: opacityAnim,
              transform: [
                {
                  scale: scaleAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.85, 1],
                  }),
                },
                {
                  translateY: scaleAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-8, 0],
                  }),
                },
              ],
            }}
          >
            {/* Arrow nub pointing back at the trigger icon */}
            <View
              style={{
                position: 'absolute',
                top: -6,
                left: arrowLeft,
                width: 12,
                height: 12,
                backgroundColor: sectionBg,
                borderTopWidth: 1,
                borderLeftWidth: 1,
                borderColor: sectionBorder,
                transform: [{ rotate: '45deg' }],
                zIndex: 0,
              }}
            />

            {/* Card */}
            <View
              style={{
                backgroundColor: sectionBg,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: sectionBorder,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: dark ? 0.4 : 0.14,
                shadowRadius: 22,
                elevation: 16,
                overflow: 'hidden',
              }}
            >
              {/* Header */}
              <View
                style={{
                  flexDirection: rowDirection(isRTL),
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingHorizontal: 16,
                  paddingTop: 14,
                  paddingBottom: 10,
                }}
              >
                <Text
                  style={{
                    fontSize: 15,
                    fontFamily: 'Poppins-SemiBold',
                    color: textColor,
                  }}
                >
                  {t('sync.title', 'Sync Status')}
                </Text>
                <Pressable onPress={hide} hitSlop={12}>
                  <X size={18} color={mutedColor} strokeWidth={2.2} />
                </Pressable>
              </View>

              <ScrollView
                style={{ maxHeight: 360, paddingHorizontal: 16 }}
                showsVerticalScrollIndicator={false}
                bounces={false}
              >
                {/* Status meta card */}
                <View
                  style={{
                    borderRadius: 12,
                    padding: 12,
                    backgroundColor: dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.025)',
                    borderWidth: 1,
                    borderColor: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
                    marginBottom: 12,
                  }}
                >
                  <View
                    style={{
                      flexDirection: rowDirection(isRTL),
                      alignItems: 'center',
                      gap: 8,
                      marginBottom: 8,
                    }}
                  >
                    {statusIcon}
                    <Text
                      style={{
                        fontSize: 14,
                        fontFamily: 'Poppins-SemiBold',
                        color: statusColor,
                      }}
                    >
                      {statusLabel}
                    </Text>
                  </View>

                  <View
                    style={{
                      flexDirection: rowDirection(isRTL),
                      justifyContent: 'space-between',
                    }}
                  >
                    <View>
                      <Text
                        style={{
                          fontSize: 10,
                          fontFamily: 'Poppins-Regular',
                          color: mutedColor,
                        }}
                      >
                        {t('sync.connection', 'Connection')}
                      </Text>
                      <View
                        style={{
                          flexDirection: rowDirection(isRTL),
                          alignItems: 'center',
                          gap: 4,
                          marginTop: 2,
                        }}
                      >
                        {isOnline ? (
                          <Wifi size={11} color={accentColor} />
                        ) : (
                          <WifiOff size={11} color={dangerColor} />
                        )}
                        <Text
                          style={{
                            fontSize: 12,
                            fontFamily: 'Poppins-Medium',
                            color: textColor,
                          }}
                        >
                          {isOnline
                            ? t('sync.connected', 'Connected')
                            : t('sync.noConnection', 'No connection')}
                        </Text>
                      </View>
                    </View>

                    <View style={{ alignItems: trailingAlignment(isRTL) }}>
                      <Text
                        style={{
                          fontSize: 10,
                          fontFamily: 'Poppins-Regular',
                          color: mutedColor,
                        }}
                      >
                        {t('sync.lastSynced', 'Last synced')}
                      </Text>
                      <Text
                        style={{
                          fontSize: 12,
                          fontFamily: 'Poppins-Medium',
                          color: textColor,
                          marginTop: 2,
                        }}
                      >
                        {formatTimeAgo(lastSyncAt, t)}
                      </Text>
                    </View>
                  </View>

                  {pendingCount > 0 ? (
                    <View
                      style={{
                        marginTop: 10,
                        paddingTop: 10,
                        borderTopWidth: 1,
                        borderTopColor: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
                        flexDirection: rowDirection(isRTL),
                        alignItems: 'center',
                        gap: 5,
                      }}
                    >
                      <RefreshCw size={12} color={amberColor} />
                      <Text
                        style={{
                          fontSize: 12,
                          fontFamily: 'Poppins-Medium',
                          color: amberColor,
                        }}
                      >
                        {t('sync.pendingChanges', '{{count}} pending changes', {
                          count: pendingCount,
                        })}
                      </Text>
                    </View>
                  ) : null}
                </View>

                {/* Action buttons — use the local PopoverActionButton so
                    colours flow through useHeroSheetTokens (DL §2). The
                    global Button's `outline` variant uses NativeWind CSS
                    variables that don't reliably swap to dark mode on RN. */}
                <View
                  style={{
                    flexDirection: rowDirection(isRTL),
                    gap: 8,
                    marginBottom: 12,
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <PopoverActionButton
                      variant="primary"
                      icon={RefreshCw}
                      label={t('sync.syncNow', 'Sync Now')}
                      onPress={handleSyncNow}
                      disabled={!isOnline || isSyncing || syncing}
                      loading={syncing}
                      isRTL={isRTL}
                      tokens={tokens}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <PopoverActionButton
                      variant="secondary"
                      icon={DatabaseZap}
                      label={t('sync.fullResync', 'Full Resync')}
                      onPress={handleFullResync}
                      isRTL={isRTL}
                      tokens={tokens}
                    />
                  </View>
                </View>

                {/* Failed entries */}
                {failedEntries.length > 0 ? (
                  <View style={{ marginBottom: 12 }}>
                    <View
                      style={{
                        flexDirection: rowDirection(isRTL),
                        alignItems: 'center',
                        gap: 5,
                        marginBottom: 8,
                      }}
                    >
                      <AlertCircle size={13} color={dangerColor} />
                      <Text
                        style={{
                          fontSize: 13,
                          fontFamily: 'Poppins-SemiBold',
                          color: dangerColor,
                        }}
                      >
                        {t('sync.failedHeader', 'Failed ({{n}})', { n: failedEntries.length })}
                      </Text>
                    </View>
                    {failedEntries.map((entry) => (
                      <View
                        key={entry.id}
                        style={{
                          borderRadius: 10,
                          padding: 10,
                          backgroundColor: dark ? 'rgba(248,113,113,0.08)' : 'rgba(220,38,38,0.04)',
                          borderWidth: 1,
                          borderColor: dark ? 'rgba(248,113,113,0.16)' : 'rgba(220,38,38,0.10)',
                          marginBottom: 6,
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 12,
                            fontFamily: 'Poppins-SemiBold',
                            color: textColor,
                            textAlign: textAlignStart(isRTL),
                          }}
                          numberOfLines={1}
                        >
                          {entry.entityType} \u2014 {entry.action}
                        </Text>
                        {entry.error ? (
                          <Text
                            style={{
                              fontSize: 11,
                              fontFamily: 'Poppins-Regular',
                              color: mutedColor,
                              marginTop: 2,
                              textAlign: textAlignStart(isRTL),
                            }}
                            numberOfLines={2}
                          >
                            {entry.error}
                          </Text>
                        ) : null}
                        <View
                          style={{
                            flexDirection: rowDirection(isRTL),
                            gap: 14,
                            marginTop: 6,
                          }}
                        >
                          <Pressable
                            onPress={() => handleRetry(entry.id)}
                            disabled={retryingId === entry.id}
                            style={{
                              flexDirection: rowDirection(isRTL),
                              alignItems: 'center',
                              gap: 3,
                              opacity: retryingId === entry.id ? 0.5 : 1,
                            }}
                          >
                            {retryingId === entry.id ? (
                              <ActivityIndicator size={11} color={accentColor} />
                            ) : (
                              <RotateCcw size={12} color={accentColor} />
                            )}
                            <Text
                              style={{
                                fontSize: 12,
                                fontFamily: 'Poppins-Medium',
                                color: accentColor,
                              }}
                            >
                              {t('sync.retry', 'Retry')}
                            </Text>
                          </Pressable>
                          <Pressable
                            onPress={() => handleDiscard(entry.id, entry.entityType, entry.action)}
                            style={{
                              flexDirection: rowDirection(isRTL),
                              alignItems: 'center',
                              gap: 3,
                            }}
                          >
                            <Trash2 size={12} color={dangerColor} />
                            <Text
                              style={{
                                fontSize: 12,
                                fontFamily: 'Poppins-Medium',
                                color: dangerColor,
                              }}
                            >
                              {t('sync.discard', 'Discard')}
                            </Text>
                          </Pressable>
                        </View>
                      </View>
                    ))}
                  </View>
                ) : null}
              </ScrollView>

              {/* Bottom safe padding */}
              <View style={{ height: 6 }} />
            </View>
          </Animated.View>
        ) : null}
      </Modal>
    </View>
  );
}
