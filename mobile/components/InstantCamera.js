import { useEffect, useRef, useState } from 'react';
import {
  View, Text, Pressable, ActivityIndicator, Alert, Modal, StyleSheet,
  Image, ScrollView,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  X, Zap, ZapOff, RotateCcw, Trash2, Check, Camera as CameraIcon,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { useIsRTL } from '@/stores/localeStore';
import { rowDirection } from '@/lib/rtl';

const REVIEW_THUMB_SIZE = 56;
const REVIEW_THUMB_GAP = 8;

/**
 * Full-screen camera modal.
 *
 * Two modes:
 *   - `multi={true}` (default): capture as many photos as desired in one
 *     session. Each capture lands in a thumbnail strip above the shutter.
 *     Tap a thumbnail to review fullscreen and delete. Tap the green
 *     "Use N" pill to call `onCapture(assets)` with the full batch and
 *     close.
 *   - `multi={false}`: single-shot. The first capture immediately calls
 *     `onCapture([asset])` and closes — used by FileUpload (single-file
 *     slots like avatars / single receipts).
 *
 * Asset shape: `{ uri, width, height }`. `onCapture` always receives an
 * array, even in single-shot mode, so call sites have a unified API.
 */
export default function InstantCamera({ visible, onClose, onCapture, multi = true }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const isRTL = useIsRTL();
  const cameraRef = useRef(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState('back');
  const [flash, setFlash] = useState('off');
  const [capturing, setCapturing] = useState(false);
  const [captured, setCaptured] = useState([]);
  const [reviewIndex, setReviewIndex] = useState(null);

  useEffect(() => {
    if (!visible) return;
    if (!permission) return;
    if (permission.status === 'undetermined') {
      requestPermission();
    }
  }, [visible, permission, requestPermission]);

  useEffect(() => {
    if (!visible) {
      setCaptured([]);
      setReviewIndex(null);
      setCapturing(false);
    }
  }, [visible]);

  const handleCapture = async () => {
    if (capturing || !cameraRef.current) return;
    setCapturing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.7,
        skipProcessing: true,
        exif: false,
      });
      const asset = { uri: photo.uri, width: photo.width, height: photo.height };
      if (multi) {
        setCaptured((prev) => [...prev, asset]);
      } else {
        onCapture?.([asset]);
        onClose?.();
      }
    } catch (err) {
      Alert.alert(t('common.error', 'Error'), err?.message || t('documents.uploadError', 'Capture failed'));
    } finally {
      setCapturing(false);
    }
  };

  const toggleFacing = () => {
    Haptics.selectionAsync().catch(() => {});
    setFacing((f) => (f === 'back' ? 'front' : 'back'));
  };

  const toggleFlash = () => {
    Haptics.selectionAsync().catch(() => {});
    setFlash((f) => (f === 'off' ? 'on' : 'off'));
  };

  const handleDone = () => {
    if (!captured.length) {
      onClose?.();
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    onCapture?.(captured);
    onClose?.();
  };

  const handleCancel = () => {
    if (!captured.length) {
      onClose?.();
      return;
    }
    const photoLabel = captured.length === 1
      ? t('documents.photoSingular', 'photo')
      : t('documents.photoPlural', 'photos');
    Alert.alert(
      t('documents.discardCapturesTitle', 'Discard photos?'),
      `${captured.length} ${photoLabel} ${t('documents.willBeLost', 'will be discarded.')}`,
      [
        { text: t('common.cancel', 'Cancel'), style: 'cancel' },
        {
          text: t('documents.discard', 'Discard'),
          style: 'destructive',
          onPress: () => onClose?.(),
        },
      ],
    );
  };

  const removeAt = (index) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setCaptured((prev) => {
      const next = prev.filter((_, i) => i !== index);
      // Stay in review on the next sibling so the user can keep pruning
      // without bouncing back to the shoot screen between every delete.
      // When the last photo is gone, fall back to the camera.
      if (next.length === 0) {
        setReviewIndex(null);
      } else {
        setReviewIndex((cur) => (cur === null ? null : Math.min(cur, next.length - 1)));
      }
      return next;
    });
  };

  if (!visible) return null;

  const reviewing = reviewIndex !== null && captured[reviewIndex];
  const showThumbStrip = multi && captured.length > 0;
  const showDonePill = multi && captured.length > 0;
  const showCameraChrome = !reviewing;

  return (
    <Modal visible={visible} animationType="fade" presentationStyle="fullScreen" onRequestClose={handleCancel} statusBarTranslucent>
      <View style={[styles.root, { backgroundColor: '#000' }]}>
        {permission?.granted ? (
          <CameraView
            ref={cameraRef}
            style={StyleSheet.absoluteFill}
            facing={facing}
            flash={flash}
            mode="picture"
            mute
            responsiveOrientationWhenOrientationLocked
          />
        ) : (
          <View style={styles.permissionView}>
            <View style={styles.permissionIconTile}>
              <CameraIcon size={28} color="#fff" strokeWidth={2.2} />
            </View>
            <Text style={styles.permissionTitle}>
              {t('documents.cameraNeededTitle', 'Camera access needed')}
            </Text>
            <Text style={styles.permissionText}>
              {t('documents.cameraPermissionPrompt', 'Allow camera access to take photos.')}
            </Text>
            <Pressable
              onPressIn={() => Haptics.selectionAsync().catch(() => {})}
              onPress={requestPermission}
              style={styles.permissionButton}
            >
              <Text style={styles.permissionButtonText}>
                {t('documents.grantPermission', 'Grant Permission')}
              </Text>
            </Pressable>
          </View>
        )}

        {/* Top toolbar — hidden during photo review (the review overlay
            paints its own top bar with delete + counter). */}
        {showCameraChrome ? (
        <View style={[styles.topBar, { top: insets.top + 8, flexDirection: rowDirection(isRTL) }]}>
          <Pressable
            onPressIn={() => Haptics.selectionAsync().catch(() => {})}
            onPress={handleCancel}
            style={styles.iconButton}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t('common.close', 'Close')}
          >
            <X size={20} color="#fff" strokeWidth={2.4} />
          </Pressable>

          <View style={[styles.topRightGroup, { flexDirection: rowDirection(isRTL) }]}>
            {multi && captured.length > 0 ? (
              <View style={styles.countPill}>
                <Text style={styles.countPillText}>
                  {`${captured.length} ${captured.length === 1
                    ? t('documents.photoSingular', 'photo')
                    : t('documents.photoPlural', 'photos')}`}
                </Text>
              </View>
            ) : null}
            {permission?.granted ? (
              <Pressable
                onPressIn={() => Haptics.selectionAsync().catch(() => {})}
                onPress={toggleFlash}
                style={[styles.iconButton, flash === 'on' && styles.iconButtonActive]}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={t('documents.flash', 'Flash')}
              >
                {flash === 'on' ? <Zap size={18} color="#facc15" strokeWidth={2.4} /> : <ZapOff size={18} color="#fff" strokeWidth={2.4} />}
              </Pressable>
            ) : null}
          </View>
        </View>
        ) : null}

        {/* Bottom controls — hidden during photo review. */}
        {permission?.granted && showCameraChrome ? (
          <View style={[styles.bottomWrap, { paddingBottom: insets.bottom + 18 }]}>
            {showThumbStrip ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={[styles.thumbStripContent, { flexDirection: rowDirection(isRTL) }]}
                style={styles.thumbStrip}
              >
                {captured.map((asset, i) => (
                  <Pressable
                    key={`${asset.uri}-${i}`}
                    onPressIn={() => Haptics.selectionAsync().catch(() => {})}
                    onPress={() => setReviewIndex(i)}
                    style={styles.thumb}
                  >
                    <Image
                      source={{ uri: asset.uri }}
                      style={StyleSheet.absoluteFill}
                      resizeMode="cover"
                    />
                  </Pressable>
                ))}
              </ScrollView>
            ) : null}

            {multi && captured.length === 0 ? (
              <Text style={[styles.helperHint, { textAlign: 'center' }]}>
                {t('documents.tapShutterHint', 'Tap the shutter to capture. Stack up multiple photos and submit them all together.')}
              </Text>
            ) : null}

            <View style={[styles.bottomBar, { flexDirection: rowDirection(isRTL) }]}>
              <View style={styles.bottomSlot}>
                <Pressable
                  onPressIn={() => Haptics.selectionAsync().catch(() => {})}
                  onPress={toggleFacing}
                  style={styles.iconButton}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={t('documents.flipCamera', 'Flip camera')}
                >
                  <RotateCcw size={20} color="#fff" strokeWidth={2.2} />
                </Pressable>
              </View>

              <Pressable
                onPress={handleCapture}
                disabled={capturing}
                style={({ pressed }) => [
                  styles.shutter,
                  pressed && { transform: [{ scale: 0.92 }] },
                  capturing && { opacity: 0.6 },
                ]}
                accessibilityRole="button"
                accessibilityLabel={t('documents.capture', 'Capture')}
              >
                <View style={styles.shutterRing}>
                  <View style={styles.shutterInner}>
                    {capturing ? <ActivityIndicator color="#000" /> : null}
                  </View>
                </View>
              </Pressable>

              <View style={[styles.bottomSlot, { alignItems: 'center', justifyContent: 'center' }]}>
                {showDonePill ? (
                  <Pressable
                    onPressIn={() => Haptics.selectionAsync().catch(() => {})}
                    onPress={handleDone}
                    style={({ pressed }) => [
                      styles.donePill,
                      pressed && { opacity: 0.92, transform: [{ scale: 0.97 }] },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={t('documents.usePhotos', 'Use photos')}
                  >
                    <View style={[styles.donePillInner, { flexDirection: rowDirection(isRTL) }]}>
                      <Check size={18} color="#fff" strokeWidth={3} />
                      <Text style={styles.donePillText}>
                        {`${t('documents.use', 'Use')} ${captured.length}`}
                      </Text>
                    </View>
                  </Pressable>
                ) : null}
              </View>
            </View>
          </View>
        ) : null}

        {/* Review overlay — full-screen photo with delete + thumb strip
            navigation. Fully opaque so it cleanly hides the camera + chrome
            beneath; sits on top via JSX order + zIndex. */}
        {reviewing ? (
          <ReviewOverlay
            captured={captured}
            index={reviewIndex}
            onClose={() => setReviewIndex(null)}
            onDelete={() => removeAt(reviewIndex)}
            onJump={(i) => {
              Haptics.selectionAsync().catch(() => {});
              setReviewIndex(i);
            }}
            isRTL={isRTL}
            insets={insets}
            t={t}
          />
        ) : null}
      </View>
    </Modal>
  );
}

function ReviewOverlay({ captured, index, onClose, onDelete, onJump, isRTL, insets, t }) {
  const asset = captured[index];
  const total = captured.length;
  const stripRef = useRef(null);

  // Auto-scroll the thumb strip so the active thumb is comfortably visible
  // when the user jumps via delete (which advances index) or taps a thumb
  // that's only partially in view.
  useEffect(() => {
    if (!stripRef.current) return;
    const itemSpan = REVIEW_THUMB_SIZE + REVIEW_THUMB_GAP;
    const x = Math.max(0, index * itemSpan - itemSpan);
    stripRef.current.scrollTo({ x, animated: true });
  }, [index]);

  return (
    <View style={[StyleSheet.absoluteFill, styles.reviewRoot]}>
      <View style={[styles.reviewTopBar, { top: insets.top + 8, flexDirection: rowDirection(isRTL) }]}>
        <Pressable
          onPressIn={() => Haptics.selectionAsync().catch(() => {})}
          onPress={onClose}
          style={styles.iconButton}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t('common.close', 'Close')}
        >
          <X size={20} color="#fff" strokeWidth={2.4} />
        </Pressable>

        <View style={styles.countPill}>
          <Text style={styles.countPillText}>
            {`${index + 1} / ${total}`}
          </Text>
        </View>

        <Pressable
          onPressIn={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})}
          onPress={onDelete}
          style={[styles.iconButton, styles.iconButtonDanger]}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t('common.delete', 'Delete')}
        >
          <Trash2 size={18} color="#fca5a5" strokeWidth={2.4} />
        </Pressable>
      </View>

      <View style={styles.reviewImageWrap}>
        <Image
          source={{ uri: asset.uri }}
          style={styles.reviewImage}
          resizeMode="contain"
        />
      </View>

      <View style={[styles.reviewBottom, { paddingBottom: insets.bottom + 18 }]}>
        <ScrollView
          ref={stripRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[styles.reviewStripContent, { flexDirection: rowDirection(isRTL) }]}
        >
          {captured.map((a, i) => {
            const isActive = i === index;
            return (
              <Pressable
                key={`${a.uri}-${i}`}
                onPressIn={() => Haptics.selectionAsync().catch(() => {})}
                onPress={() => onJump(i)}
                style={[
                  styles.reviewThumb,
                  isActive && styles.reviewThumbActive,
                ]}
                accessibilityRole="button"
                accessibilityLabel={`${i + 1} / ${total}`}
                accessibilityState={{ selected: isActive }}
              >
                <Image
                  source={{ uri: a.uri }}
                  style={StyleSheet.absoluteFill}
                  resizeMode="cover"
                />
                {isActive ? (
                  <View pointerEvents="none" style={styles.reviewThumbActiveTint} />
                ) : null}
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  topBar: {
    position: 'absolute',
    left: 16,
    right: 16,
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 10,
  },
  topRightGroup: {
    alignItems: 'center',
    gap: 8,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButtonActive: {
    backgroundColor: 'rgba(250,204,21,0.20)',
  },
  iconButtonDanger: {
    backgroundColor: 'rgba(220,38,38,0.18)',
  },
  countPill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.55)',
    minWidth: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countPillText: {
    color: '#fff',
    fontSize: 12,
    fontFamily: 'Poppins-SemiBold',
    letterSpacing: 0.4,
  },
  bottomWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    zIndex: 10,
    gap: 14,
  },
  thumbStrip: {
    maxHeight: 76,
  },
  thumbStripContent: {
    gap: 8,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  thumb: {
    width: 60,
    height: 60,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.85)',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  bottomBar: {
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
  bottomSlot: {
    width: 92,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutter: {
    width: 76,
    height: 76,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterRing: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 3,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
  shutterInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  donePill: {
    paddingHorizontal: 16,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#22c55e',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.30)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.45,
    shadowRadius: 8,
    elevation: 6,
  },
  donePillInner: {
    alignItems: 'center',
    gap: 6,
  },
  donePillText: {
    color: '#fff',
    fontSize: 14,
    fontFamily: 'Poppins-SemiBold',
    letterSpacing: 0.2,
  },
  helperHint: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    fontFamily: 'Poppins-Regular',
    paddingHorizontal: 24,
  },
  permissionView: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 14,
  },
  permissionIconTile: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  permissionTitle: {
    color: '#fff',
    fontSize: 18,
    fontFamily: 'Poppins-SemiBold',
    textAlign: 'center',
  },
  permissionText: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
    textAlign: 'center',
    lineHeight: 20,
  },
  permissionButton: {
    marginTop: 8,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: 'hsl(148, 60%, 35%)',
  },
  permissionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontFamily: 'Poppins-SemiBold',
  },
  reviewRoot: {
    backgroundColor: '#000',
    zIndex: 30,
  },
  reviewTopBar: {
    position: 'absolute',
    left: 16,
    right: 16,
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 20,
  },
  reviewImageWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewImage: {
    width: '100%',
    height: '100%',
  },
  reviewBottom: {
    paddingTop: 12,
  },
  reviewStripContent: {
    gap: REVIEW_THUMB_GAP,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  reviewThumb: {
    width: REVIEW_THUMB_SIZE,
    height: REVIEW_THUMB_SIZE,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.20)',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  reviewThumbActive: {
    borderColor: '#22c55e',
    borderWidth: 3,
    transform: [{ scale: 1.06 }],
    shadowColor: '#22c55e',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 6,
    elevation: 6,
  },
  reviewThumbActiveTint: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
});
