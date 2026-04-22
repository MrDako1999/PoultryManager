import { useEffect, useRef } from 'react';
import { View, Text, Modal, Animated, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { DatabaseZap, CloudDownload } from 'lucide-react-native';
import useSyncStore from '@/stores/syncStore';
import { useHeroSheetTokens } from '@/components/HeroSheetScreen';
import { useIsRTL } from '@/stores/localeStore';
import { rowDirection } from '@/lib/rtl';

/**
 * Full-screen overlay shown during initial sync (after login) and the
 * "Full Resync" flow. Blocks interaction with the rest of the app while
 * the sync engine downloads everything.
 *
 * Visual: brand-tinted backdrop (the gradient behind a translucent screen)
 * + a centred card that uses the design-language tokens (icon tile, accent
 * progress bar, Poppins type stack). Matches the look of the rest of the
 * sheets so the user feels like the app is doing something on their behalf,
 * not that an old-fashioned dialog popped up.
 */
export default function FullResyncOverlay() {
  const { t } = useTranslation();
  const { isFullResyncing, isInitialSyncing, syncProgress } = useSyncStore();
  const tokens = useHeroSheetTokens();
  const {
    dark, accentColor, textColor, mutedColor, sectionBg, sectionBorder,
    heroGradient, borderColor,
  } = tokens;
  const isRTL = useIsRTL();

  const visible = isFullResyncing || isInitialSyncing;
  const isInitial = !isFullResyncing && isInitialSyncing;

  const pct = syncProgress
    ? Math.round((syncProgress.current / syncProgress.total) * 100)
    : 0;

  const animatedWidth = useRef(new Animated.Value(0)).current;
  const indeterminateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(animatedWidth, {
      toValue: pct,
      duration: 400,
      useNativeDriver: false,
    }).start();
  }, [animatedWidth, pct]);

  useEffect(() => {
    if (!visible || syncProgress) return undefined;
    indeterminateAnim.setValue(0);
    const loop = Animated.loop(
      Animated.timing(indeterminateAnim, {
        toValue: 1,
        duration: 1200,
        useNativeDriver: false,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [indeterminateAnim, visible, syncProgress]);

  if (!visible) return null;

  const widthInterpolation = animatedWidth.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });
  const indeterminateLeft = indeterminateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['-40%', '100%'],
  });

  const Icon = isInitial ? CloudDownload : DatabaseZap;
  const title = isInitial
    ? t('sync.overlayInitialTitle', 'Setting up your account')
    : t('sync.overlayResyncTitle', 'Full Resync');
  const subtitle = isInitial
    ? t(
        'sync.overlayInitialSubtitle',
        'Downloading your data so it works offline. This only happens once.'
      )
    : t(
        'sync.overlayResyncSubtitle',
        'Clearing local cache and re-downloading from the server.'
      );

  const textAlign = isRTL ? 'right' : 'left';

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={() => {}}>
      {/* Brand-tinted backdrop — the gradient sits behind a translucent
          screen-coloured layer so the brand reads through but the rest of
          the app stays soft. */}
      <View style={StyleSheet.absoluteFill}>
        <LinearGradient
          colors={heroGradient}
          start={isRTL ? { x: 1, y: 0 } : { x: 0, y: 0 }}
          end={isRTL ? { x: 0, y: 1 } : { x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: dark ? 'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.55)' },
          ]}
        />
      </View>

      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 32,
        }}
      >
        <View
          style={{
            width: '100%',
            maxWidth: 360,
            borderRadius: 24,
            paddingTop: 8,
            paddingBottom: 24,
            paddingHorizontal: 24,
            backgroundColor: sectionBg,
            borderWidth: 1,
            borderColor: sectionBorder,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 12 },
            shadowOpacity: dark ? 0.5 : 0.18,
            shadowRadius: 24,
            elevation: 16,
            overflow: 'hidden',
          }}
        >
          {/* Slim grab pill — purely decorative, echoes the bottom-sheet
              vocabulary so the overlay feels familiar. */}
          <View style={styles.dragPillRow}>
            <View
              style={{
                width: 36,
                height: 4,
                borderRadius: 2,
                backgroundColor: dark ? 'hsl(150, 14%, 28%)' : 'hsl(148, 14%, 86%)',
              }}
            />
          </View>

          {/* Big accent-tinted icon tile — matches §7 icon-tile hero. */}
          <View
            style={[
              styles.iconTile,
              {
                backgroundColor: dark ? 'rgba(148,210,165,0.18)' : 'hsl(148, 35%, 92%)',
              },
            ]}
          >
            <Icon size={28} color={accentColor} strokeWidth={2.2} />
          </View>

          <Text
            style={{
              fontSize: 18,
              fontFamily: 'Poppins-SemiBold',
              color: textColor,
              letterSpacing: -0.2,
              textAlign: 'center',
              marginTop: 16,
            }}
          >
            {title}
          </Text>
          <Text
            style={{
              fontSize: 13,
              fontFamily: 'Poppins-Regular',
              color: mutedColor,
              textAlign: 'center',
              marginTop: 6,
              lineHeight: 18,
            }}
          >
            {subtitle}
          </Text>

          {/* Progress bar */}
          <View
            style={{
              height: 6,
              borderRadius: 3,
              backgroundColor: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
              overflow: 'hidden',
              marginTop: 22,
              marginBottom: 12,
              position: 'relative',
            }}
          >
            {syncProgress ? (
              <Animated.View
                style={{
                  height: '100%',
                  borderRadius: 3,
                  backgroundColor: accentColor,
                  width: widthInterpolation,
                }}
              />
            ) : (
              <Animated.View
                style={{
                  position: 'absolute',
                  top: 0,
                  bottom: 0,
                  left: indeterminateLeft,
                  width: '40%',
                  borderRadius: 3,
                  backgroundColor: accentColor,
                }}
              />
            )}
          </View>

          {/* Status row */}
          <View
            style={{
              flexDirection: rowDirection(isRTL),
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Text
              style={{
                fontSize: 12,
                fontFamily: 'Poppins-Regular',
                color: mutedColor,
                flex: 1,
                textAlign,
              }}
              numberOfLines={1}
            >
              {syncProgress
                ? t('sync.overlayFetching', 'Fetching {{label}}\u2026', {
                    label: localiseSyncLabel(syncProgress.label, t),
                  })
                : t('sync.overlayPreparing', 'Preparing\u2026')}
            </Text>
            {syncProgress ? (
              <Text
                style={{
                  fontSize: 12,
                  fontFamily: 'Poppins-SemiBold',
                  color: accentColor,
                  marginStart: 8,
                }}
              >
                {pct}%
              </Text>
            ) : null}
          </View>

          {syncProgress ? (
            <View
              style={{
                marginTop: 12,
                paddingTop: 10,
                borderTopWidth: 1,
                borderTopColor: borderColor,
              }}
            >
              <Text
                style={{
                  fontSize: 11,
                  fontFamily: 'Poppins-Medium',
                  color: mutedColor,
                  textAlign: 'center',
                  letterSpacing: 0.4,
                }}
              >
                {t('sync.overlayStep', 'Step {{current}} of {{total}}', {
                  current: syncProgress.current,
                  total: syncProgress.total,
                })}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

/**
 * Map the raw entity-type identifier the sync engine reports
 * (e.g. `expenses`, `feedOrders`, `Settings`) to its localised
 * label via the `sync.entities.*` namespace. Defensive: if a new
 * entity is added to SYNC_ORDER and we forget to translate it,
 * the fallback returns the raw identifier so progress text still
 * renders something legible instead of crashing.
 *
 * The sync engine sends `Settings` capitalised (legacy), but
 * everything else is camelCase exactly as declared in
 * `mobile/lib/db.js → SYNC_ORDER` — so we lower-case only the
 * very first character to match our key schema.
 */
function localiseSyncLabel(label, t) {
  if (!label) return '';
  const key = label.charAt(0).toLowerCase() + label.slice(1);
  return t(`sync.entities.${key}`, label);
}

const styles = StyleSheet.create({
  dragPillRow: {
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 6,
    marginHorizontal: -24,
  },
  iconTile: {
    alignSelf: 'center',
    marginTop: 14,
    width: 64,
    height: 64,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
