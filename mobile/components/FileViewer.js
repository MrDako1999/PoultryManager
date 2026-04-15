import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import {
  View, Text, Pressable, Modal, Image, ScrollView,
  ActivityIndicator, Dimensions, PanResponder, Animated,
  Platform, Linking,
} from 'react-native';
import { X, Share2 } from 'lucide-react-native';
import { WebView } from 'react-native-webview';
import { File as ExpoFile, Directory, Paths } from 'expo-file-system/next';
import * as Sharing from 'expo-sharing';
import * as Haptics from 'expo-haptics';
import useThemeStore from '../stores/themeStore';

const SCREEN_HEIGHT = Dimensions.get('window').height;
const SCREEN_WIDTH = Dimensions.get('window').width;
const SHEET_HEIGHT = SCREEN_HEIGHT * 0.75;
const DISMISS_THRESHOLD = 100;

export function detectFileType(media) {
  if (!media?.url && !media?.mime_type) return 'file';
  if (media.mime_type?.startsWith('image/') || /\.(jpe?g|png|webp|gif)$/i.test(media.url || '')) return 'image';
  if (media.mime_type === 'application/pdf' || /\.pdf$/i.test(media.url || '')) return 'pdf';
  return 'file';
}

function getFilename(media) {
  return media?.original_filename || media?.filename || media?.name || 'File';
}

export default function FileViewer({ visible, media, onClose }) {
  const { resolvedTheme } = useThemeStore();
  const dark = resolvedTheme === 'dark';
  const mutedColor = dark ? 'hsl(148, 10%, 55%)' : 'hsl(150, 10%, 45%)';

  const [open, setOpen] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);
  const cachedFileRef = useRef(null);

  const slideAnim = useRef(new Animated.Value(SHEET_HEIGHT)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;

  const type = detectFileType(media);
  const filename = getFilename(media);
  const url = media?.url;

  const pdfUrl = url && Platform.OS === 'android'
    ? `https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(url)}`
    : url;

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
      onClose?.();
    });
  }, [slideAnim, backdropAnim, onClose]);

  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_, g) => g.dy > 6,
    onMoveShouldSetPanResponderCapture: (_, g) => g.dy > 6,
    onPanResponderMove: (_, g) => {
      if (g.dy > 0) slideAnim.setValue(g.dy);
    },
    onPanResponderRelease: (_, g) => {
      if (g.dy > DISMISS_THRESHOLD || g.vy > 0.5) {
        slideOut();
      } else {
        Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 100, friction: 10 }).start();
      }
    },
  }), [slideOut]);

  useEffect(() => {
    if (visible && media) {
      setImageLoading(true);
      cachedFileRef.current = null;
      setOpen(true);
      requestAnimationFrame(() => slideIn());

      if (url) {
        const shareDir = new Directory(Paths.cache, `share_${Date.now()}`);
        try { shareDir.create(); } catch {}
        ExpoFile.downloadFileAsync(url, shareDir)
          .then((file) => { cachedFileRef.current = file; })
          .catch(() => {});
      }
    }
  }, [visible, media]);

  useEffect(() => {
    if (visible && type === 'file' && url) {
      Linking.openURL(url).catch(() => {});
      onClose?.();
    }
  }, [visible, type, url]);

  const handleShare = async () => {
    if (!url) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
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

  if (!open) return null;

  return (
    <Modal transparent visible={open} animationType="none" onRequestClose={slideOut}>
      <View className="flex-1">
        {/* Backdrop */}
        <Animated.View
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', opacity: backdropAnim }}
        >
          <Pressable style={{ flex: 1 }} onPress={slideOut} />
        </Animated.View>

        {/* Sheet */}
        <Animated.View
          style={[{ height: SHEET_HEIGHT, transform: [{ translateY: slideAnim }] }]}
          className="absolute bottom-0 left-0 right-0 bg-card rounded-t-2xl overflow-hidden"
        >
          {/* Drag handle + Header (unified touch area) */}
          <View {...panResponder.panHandlers}>
            <View className="items-center pt-2.5 pb-1.5">
              <View className="w-9 h-1 rounded-full bg-border" />
            </View>
            <View className="flex-row items-center justify-between px-4 pb-2.5">
              <Pressable
                onPress={handleShare}
                disabled={sharing}
                hitSlop={8}
                style={{ opacity: sharing ? 0.5 : 1 }}
              >
                {sharing
                  ? <ActivityIndicator size={18} color={mutedColor} />
                  : <Share2 size={18} color={mutedColor} />
                }
              </Pressable>
              <Pressable onPress={slideOut} className="flex-1 mx-3">
                <Text className="text-base font-semibold text-foreground text-center" numberOfLines={1}>
                  {filename}
                </Text>
              </Pressable>
              <Pressable
                onPress={slideOut}
                className="h-7 w-7 items-center justify-center rounded-full bg-muted"
                hitSlop={8}
              >
                <X size={14} color={mutedColor} />
              </Pressable>
            </View>
          </View>

          {/* Divider */}
          <View className="h-px bg-border" />

          {/* Content */}
          {type === 'image' ? (
            <View className="flex-1">
              {imageLoading && (
                <View className="absolute inset-0 items-center justify-center z-10">
                  <ActivityIndicator size="large" color={mutedColor} />
                </View>
              )}
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
                  style={{ width: SCREEN_WIDTH, height: SHEET_HEIGHT * 0.8 }}
                  resizeMode="contain"
                  onLoadEnd={() => setImageLoading(false)}
                />
              </ScrollView>
            </View>
          ) : type === 'pdf' ? (
            <View className="flex-1">
              <WebView
                source={{ uri: pdfUrl }}
                style={{ flex: 1 }}
                startInLoadingState
                renderLoading={() => (
                  <View className="absolute inset-0 items-center justify-center">
                    <ActivityIndicator size="large" color={mutedColor} />
                  </View>
                )}
                scalesPageToFit
                javaScriptEnabled
              />
            </View>
          ) : (
            <View className="flex-1 items-center justify-center">
              <Text className="text-sm text-muted-foreground">Cannot preview this file type</Text>
            </View>
          )}

          {/* Bottom safe area */}
          <View className="h-8" />
        </Animated.View>
      </View>
    </Modal>
  );
}
