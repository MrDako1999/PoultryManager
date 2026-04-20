import { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, Pressable, Modal, Image, ScrollView,
  ActivityIndicator, Dimensions, PanResponder, Animated,
  Platform, Linking, StyleSheet,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  X, Share2, ExternalLink, FileText, File as FileIcon,
  Image as ImageIcon,
} from 'lucide-react-native';
import { WebView } from 'react-native-webview';
import { File as ExpoFile, Directory, Paths } from 'expo-file-system/next';
import * as Sharing from 'expo-sharing';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useHeroSheetTokens } from '@/components/HeroSheetScreen';
import { useIsRTL } from '@/stores/localeStore';

const SCREEN_HEIGHT = Dimensions.get('window').height;
const SCREEN_WIDTH = Dimensions.get('window').width;

// Single sheet height. Footer (Share + Open in Browser) lives at the
// bottom of the sheet and must always be on-screen, so we deliberately
// avoid a second "expanded" snap point — that would push the footer below
// the viewport.
const SHEET_HEIGHT = SCREEN_HEIGHT * 0.85;
const DISMISS_THRESHOLD = 100;

const TYPE_ICON = { image: ImageIcon, pdf: FileText, file: FileIcon };

export function detectFileType(media) {
  if (!media?.url && !media?.mime_type) return 'file';
  if (media.mime_type?.startsWith('image/') || /\.(jpe?g|png|webp|gif)$/i.test(media.url || '')) return 'image';
  if (media.mime_type === 'application/pdf' || /\.pdf$/i.test(media.url || '')) return 'pdf';
  return 'file';
}

function getFilename(media) {
  return media?.original_filename || media?.filename || media?.name || 'File';
}

function formatSize(bytes) {
  if (!bytes) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Sheet-from-bottom file preview matching the design language.
 *
 * - Neutral dimmed backdrop so the screen behind stays visible (tap to close).
 * - Single sheet size; drag down on the chrome to dismiss with spring
 *   snap-back if released early. Drag pill scales up while the gesture is
 *   active for visual feedback.
 * - Asymmetric footer always visible at the bottom of the sheet: ghost
 *   "Open in Browser" on the leading edge, filled-accent "Share" pill on
 *   the trailing edge.
 *
 * External API unchanged: `{ visible, media, onClose }` — `MultiFileUpload`,
 * `FileUpload`, and `SaleDetail` all keep working without modification.
 *
 * NB: this component DELIBERATELY uses RN's PanResponder + Animated rather
 * than react-native-gesture-handler / reanimated. The latter breaks under
 * Expo Go due to a worklets version mismatch (worklets 0.8 installed, 0.5
 * expected) and we don't want to gate this on a development build.
 */
export default function FileViewer({ visible, media, onClose }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const isRTL = useIsRTL();
  const tokens = useHeroSheetTokens();
  const {
    sheetBg, accentColor, textColor, mutedColor,
    borderColor, dark,
  } = tokens;

  const [open, setOpen] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);
  const cachedFileRef = useRef(null);

  // 0 = sheet fully visible at the bottom; SHEET_HEIGHT = pushed off-screen.
  const slideAnim = useRef(new Animated.Value(SHEET_HEIGHT)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;
  const pillScale = useRef(new Animated.Value(1)).current;

  // Keep the latest onClose in a ref so the PanResponder closure doesn't
  // need to be recreated when the parent passes a fresh `onClose` (e.g.
  // SaleDetail passes `() => setViewerDoc(null)` which is a new function
  // on every render — without this ref, useMemo'd PanResponders thrash on
  // every parent render and the responder lock can drop in-flight gestures).
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  // PanResponder needs to call slideOut from inside its closure. Stash it
  // in a ref so we can keep the PanResponder itself completely stable
  // (created once, never recreated).
  const slideOutRef = useRef(null);

  const type = detectFileType(media);
  const filename = getFilename(media);
  const url = media?.url;
  const sizeStr = formatSize(media?.file_size || media?.size);
  const subtitle = sizeStr || media?.mime_type || (
    type === 'pdf' ? 'PDF Document'
      : type === 'image' ? 'Image'
        : 'Document'
  );

  // Android can't render PDFs natively in a WebView, so route through the
  // Google Docs viewer for those (existing behaviour).
  const pdfUrl = url && Platform.OS === 'android'
    ? `https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(url)}`
    : url;

  const TypeIcon = TYPE_ICON[type] || FileIcon;

  const slideIn = useCallback(() => {
    slideAnim.setValue(SHEET_HEIGHT);
    backdropAnim.setValue(0);
    Animated.parallel([
      Animated.spring(slideAnim, {
        toValue: 0, useNativeDriver: true, tension: 65, friction: 11,
      }),
      Animated.timing(backdropAnim, {
        toValue: 1, duration: 250, useNativeDriver: true,
      }),
    ]).start();
  }, [slideAnim, backdropAnim]);

  const slideOut = useCallback(() => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: SHEET_HEIGHT, duration: 220, useNativeDriver: true,
      }),
      Animated.timing(backdropAnim, {
        toValue: 0, duration: 200, useNativeDriver: true,
      }),
    ]).start(() => {
      setOpen(false);
      onCloseRef.current?.();
    });
  }, [slideAnim, backdropAnim]);

  // Keep the slideOut ref pointing at the latest slideOut so the
  // never-recreated PanResponder can always call the right one.
  useEffect(() => { slideOutRef.current = slideOut; }, [slideOut]);

  const handleClose = useCallback(() => {
    Haptics.selectionAsync().catch(() => {});
    slideOut();
  }, [slideOut]);

  // Created ONCE via useRef. Reads slideAnim / pillScale / slideOutRef
  // from the surrounding closure — those are all refs, so the values they
  // expose stay current without ever reassigning the PanResponder.
  //
  // `onStartShouldSetPanResponder: () => true` is critical: claiming the
  // responder on START (not just on move) is the only way a parent View
  // reliably receives gestures when the touch lands on a plain (non-
  // Pressable) child. The previous "claim on move" approach only worked
  // when the touch initially landed on a Pressable descendant (the close
  // X), which is why the user saw drag working ONLY from the close button.
  //
  // The close X has been hoisted out of this View's subtree (absolute
  // sibling rendered on top) so it doesn't conflict with the start claim.
  const panResponderRef = useRef(null);
  if (panResponderRef.current === null) {
    panResponderRef.current = PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: () => true,
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
          slideOutRef.current?.();
        } else {
          Animated.spring(slideAnim, {
            toValue: 0, useNativeDriver: true, tension: 100, friction: 10,
          }).start();
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
      onShouldBlockNativeResponder: () => false,
    });
  }

  useEffect(() => {
    if (visible && media) {
      setImageLoading(true);
      cachedFileRef.current = null;
      setOpen(true);
      Haptics.selectionAsync().catch(() => {});
      requestAnimationFrame(() => slideIn());

      // Pre-warm a cached copy in the background so Share is instant.
      if (url) {
        const shareDir = new Directory(Paths.cache, `share_${Date.now()}`);
        try { shareDir.create(); } catch {}
        ExpoFile.downloadFileAsync(url, shareDir)
          .then((file) => { cachedFileRef.current = file; })
          .catch(() => {});
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, media]);

  // Unsupported file types — defer to the OS browser and bail out of the
  // viewer entirely (preserves existing behaviour).
  useEffect(() => {
    if (visible && type === 'file' && url) {
      Linking.openURL(url).catch(() => {});
      onClose?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, type, url]);

  const handleShare = async () => {
    if (!url) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setSharing(true);
    try {
      let file = cachedFileRef.current;
      if (!file || !file.exists) {
        const shareDir = new Directory(Paths.cache, `share_${Date.now()}`);
        try { shareDir.create(); } catch {}
        file = await ExpoFile.downloadFileAsync(url, shareDir);
        cachedFileRef.current = file;
      }
      await Sharing.shareAsync(file.uri);
    } catch (err) {
      console.error('Share failed:', err);
    } finally {
      setSharing(false);
    }
  };

  const handleOpenInBrowser = () => {
    if (!url) return;
    Haptics.selectionAsync().catch(() => {});
    Linking.openURL(url).catch(() => {});
  };

  if (!open) return null;

  const iconTileBg = dark ? 'rgba(148,210,165,0.16)' : 'hsl(148, 35%, 92%)';

  return (
    <Modal
      transparent
      visible={open}
      animationType="none"
      statusBarTranslucent
      presentationStyle={Platform.OS === 'ios' ? 'overFullScreen' : undefined}
      onRequestClose={slideOut}
    >
      {/* Wrap everything in a single flex:1 View — this matches the
          structure of the original (working) FileViewer; React Native's
          touch system seems to behave more reliably with a real flex
          parent than with two absolute-positioned siblings of Modal. */}
      <View style={{ flex: 1 }}>
        {/* Dim only — no brand gradient — so the route underneath stays visible. */}
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: backdropAnim }]}>
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.5)' }]} />
          <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
        </Animated.View>

        {/* Sheet */}
        <Animated.View
          style={[
            sheetStyles.sheet,
            {
              height: SHEET_HEIGHT,
              backgroundColor: sheetBg,
              transform: [{ translateY: slideAnim }],
              shadowOpacity: dark ? 0.4 : 0.06,
            },
          ]}
        >
          {/* Chrome: drag pill + header. PanResponder owns ALL touches in
              this region (claims on start). The close X has been hoisted
              out of this subtree and rendered as an absolute sibling
              below — see <Pressable> with sheetStyles.closeBtnAbsolute.
              The 32x32 spacer in the header reserves space so the layout
              math still works. */}
          <View {...panResponderRef.current.panHandlers}>
            <View style={sheetStyles.dragZone}>
              <Animated.View
                style={[
                  sheetStyles.dragPill,
                  {
                    backgroundColor: dark ? 'hsl(150, 14%, 32%)' : 'hsl(148, 14%, 80%)',
                    transform: [{ scaleX: pillScale }],
                  },
                ]}
              />
            </View>

            <View style={[sheetStyles.header, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
              <View style={[sheetStyles.iconTile, { backgroundColor: iconTileBg }]}>
                <TypeIcon size={20} color={accentColor} strokeWidth={2.2} />
              </View>
              <View style={sheetStyles.headerTextCol}>
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
                  {filename}
                </Text>
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
              {/* Spacer reserving the close X's 32x32 footprint so the
                  text column doesn't run under the absolute close button. */}
              <View style={{ width: 32, height: 32 }} />
            </View>
          </View>

          {/* Close X — absolute sibling layered on top of the panResponder
              View. Lives outside the panResponder's child tree so it can
              still receive its own taps despite the parent grabbing
              touches on start. `end` flips correctly for RTL. */}
          <Pressable
            onPress={handleClose}
            hitSlop={6}
            style={[
              sheetStyles.closeBtnAbsolute,
              { backgroundColor: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)' },
            ]}
            accessibilityRole="button"
            accessibilityLabel={t('common.close', 'Close')}
          >
            <X size={16} color={mutedColor} strokeWidth={2.4} />
          </Pressable>

          {/* Hairline between chrome and content */}
          <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: borderColor }} />

          {/* Content */}
          <View style={{ flex: 1, backgroundColor: sheetBg }}>
            {type === 'image' ? (
              <View style={{ flex: 1 }}>
                {imageLoading ? (
                  <View style={[StyleSheet.absoluteFill, sheetStyles.contentCenter, { zIndex: 10 }]}>
                    <ActivityIndicator size="large" color={accentColor} />
                  </View>
                ) : null}
                <ScrollView
                  style={{ flex: 1 }}
                  contentContainerStyle={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center' }}
                  maximumZoomScale={5}
                  minimumZoomScale={1}
                  showsHorizontalScrollIndicator={false}
                  showsVerticalScrollIndicator={false}
                  bouncesZoom
                >
                  <Image
                    source={{ uri: url }}
                    style={{ width: SCREEN_WIDTH, height: SHEET_HEIGHT * 0.65 }}
                    resizeMode="contain"
                    onLoadEnd={() => setImageLoading(false)}
                  />
                </ScrollView>
              </View>
            ) : type === 'pdf' ? (
              <View style={{ flex: 1 }}>
                <WebView
                  source={{ uri: pdfUrl }}
                  style={{ flex: 1, backgroundColor: sheetBg }}
                  startInLoadingState
                  renderLoading={() => (
                    <View style={[StyleSheet.absoluteFill, sheetStyles.contentCenter]}>
                      <ActivityIndicator size="large" color={accentColor} />
                    </View>
                  )}
                  scalesPageToFit
                  javaScriptEnabled
                />
              </View>
            ) : (
              <View style={[sheetStyles.contentCenter, { flex: 1 }]}>
                <Text
                  style={{
                    fontSize: 14,
                    fontFamily: 'Poppins-Regular',
                    color: mutedColor,
                    textAlign: 'center',
                  }}
                >
                  {t('common.cannotPreview', 'Cannot preview this file type')}
                </Text>
              </View>
            )}
          </View>

          {/* Footer — symmetric ghost buttons: Open in Browser (leading)
              + Share (trailing). Same dark-on-light styling so neither
              button drowns the other; differentiated by icon + label. */}
          {url ? (
            <View
              style={[
                sheetStyles.footer,
                {
                  backgroundColor: sheetBg,
                  borderTopColor: borderColor,
                  paddingBottom: Math.max(insets.bottom, 14),
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                },
              ]}
            >
              <Pressable
                onPressIn={() => Haptics.selectionAsync().catch(() => {})}
                onPress={handleOpenInBrowser}
                hitSlop={6}
                android_ripple={{
                  color: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                  borderless: true,
                  radius: 90,
                }}
                style={({ pressed }) => [
                  footerStyles.ghostBtn,
                  { opacity: pressed ? 0.7 : 1 },
                ]}
                accessibilityRole="button"
                accessibilityLabel={t('common.openInBrowser', 'Open in Browser')}
              >
                <View style={[footerStyles.btnInner, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                  <ExternalLink size={16} color={mutedColor} strokeWidth={2.2} />
                  <Text
                    style={{
                      fontSize: 14,
                      fontFamily: 'Poppins-SemiBold',
                      color: textColor,
                    }}
                    numberOfLines={1}
                  >
                    {t('common.openInBrowser', 'Open in Browser')}
                  </Text>
                </View>
              </Pressable>

              <Pressable
                onPressIn={() => Haptics.selectionAsync().catch(() => {})}
                onPress={handleShare}
                disabled={sharing}
                hitSlop={6}
                android_ripple={{
                  color: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                  borderless: true,
                  radius: 90,
                }}
                style={({ pressed }) => [
                  footerStyles.ghostBtn,
                  { opacity: sharing ? 0.5 : pressed ? 0.7 : 1 },
                ]}
                accessibilityRole="button"
                accessibilityLabel={t('common.share', 'Share')}
              >
                <View style={[footerStyles.btnInner, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                  {sharing ? (
                    <ActivityIndicator size="small" color={mutedColor} />
                  ) : (
                    <Share2 size={16} color={mutedColor} strokeWidth={2.2} />
                  )}
                  <Text
                    style={{
                      fontSize: 14,
                      fontFamily: 'Poppins-SemiBold',
                      color: textColor,
                    }}
                    numberOfLines={1}
                  >
                    {t('common.share', 'Share')}
                  </Text>
                </View>
              </Pressable>
            </View>
          ) : null}
        </Animated.View>
      </View>
    </Modal>
  );
}

/* ───────────────────── StyleSheets ───────────────────── */

const sheetStyles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowRadius: 12,
    elevation: 8,
  },
  dragZone: {
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 10,
  },
  dragPill: {
    width: 44,
    height: 5,
    borderRadius: 3,
  },
  header: {
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 6,
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
  closeBtnAbsolute: {
    position: 'absolute',
    // dragZone height (24) + header paddingTop (6) + ((iconTile 40 - btn 32) / 2) = 34
    top: 34,
    end: 20, // matches header paddingHorizontal; flips automatically in RTL
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contentCenter: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 14,
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});

const footerStyles = StyleSheet.create({
  ghostBtn: {
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  btnInner: {
    alignItems: 'center',
    gap: 8,
  },
});
