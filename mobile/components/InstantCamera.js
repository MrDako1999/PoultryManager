import { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, Alert, Modal, StyleSheet } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X, Zap, ZapOff, RotateCcw } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';

/**
 * Full-screen camera modal that captures a photo on a single tap and resolves
 * with `{ uri, width, height }` immediately. Skips the iOS "Use Photo / Retake"
 * preview that `expo-image-picker` shows by default.
 *
 * Usage:
 *   const [open, setOpen] = useState(false);
 *   <InstantCamera visible={open} onClose={() => setOpen(false)} onCapture={(asset) => ...} />
 */
export default function InstantCamera({ visible, onClose, onCapture }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const cameraRef = useRef(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState('back');
  const [flash, setFlash] = useState('off');
  const [capturing, setCapturing] = useState(false);

  useEffect(() => {
    if (!visible) return;
    if (!permission) return;
    if (permission.status === 'undetermined') {
      requestPermission();
    }
  }, [visible, permission, requestPermission]);

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
      onCapture?.({
        uri: photo.uri,
        width: photo.width,
        height: photo.height,
      });
      onClose?.();
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

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="fade" presentationStyle="fullScreen" onRequestClose={onClose} statusBarTranslucent>
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
            <Text style={styles.permissionText}>
              {t('documents.cameraPermissionPrompt', 'Allow camera access to take photos.')}
            </Text>
            <Pressable
              onPress={requestPermission}
              style={styles.permissionButton}
            >
              <Text style={styles.permissionButtonText}>
                {t('documents.grantPermission', 'Grant Permission')}
              </Text>
            </Pressable>
          </View>
        )}

        <View style={[styles.topBar, { top: insets.top + 8 }]}>
          <Pressable onPress={onClose} style={styles.iconButton} hitSlop={8}>
            <X size={22} color="#fff" />
          </Pressable>
          {permission?.granted && (
            <Pressable onPress={toggleFlash} style={styles.iconButton} hitSlop={8}>
              {flash === 'on' ? <Zap size={20} color="#fff" /> : <ZapOff size={20} color="#fff" />}
            </Pressable>
          )}
        </View>

        {permission?.granted && (
          <View style={[styles.bottomBar, { bottom: insets.bottom + 24 }]}>
            <View style={styles.bottomSlot} />
            <Pressable
              onPress={handleCapture}
              disabled={capturing}
              style={({ pressed }) => [
                styles.shutter,
                pressed && { transform: [{ scale: 0.92 }] },
                capturing && { opacity: 0.6 },
              ]}
            >
              <View style={styles.shutterInner}>
                {capturing ? <ActivityIndicator color="#000" /> : null}
              </View>
            </Pressable>
            <View style={styles.bottomSlot}>
              <Pressable onPress={toggleFacing} style={styles.iconButton} hitSlop={8}>
                <RotateCcw size={20} color="#fff" />
              </Pressable>
            </View>
          </View>
        )}
      </View>
    </Modal>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 10,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomBar: {
    position: 'absolute',
    left: 24,
    right: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 10,
  },
  bottomSlot: {
    width: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutter: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderWidth: 4,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  permissionView: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 16,
  },
  permissionText: {
    color: '#fff',
    fontSize: 14,
    textAlign: 'center',
  },
  permissionButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: 'hsl(148, 60%, 25%)',
  },
  permissionButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
});
