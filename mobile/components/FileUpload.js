import { useEffect, useState } from 'react';
import {
  View, Text, Pressable, ActivityIndicator, StyleSheet,
} from 'react-native';
import {
  FileText, Image as ImageIcon, X, Camera, FolderOpen,
} from 'lucide-react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { useHeroSheetTokens } from '@/components/HeroSheetScreen';
import { useIsRTL } from '@/stores/localeStore';
import { rowDirection, textAlignStart } from '@/lib/rtl';
import api from '@/lib/api';
import {
  uploadMedia, uploadPreflight, getUploadErrorMessage,
} from '@/lib/uploadMedia';
import FileViewer from './FileViewer';
import InstantCamera from './InstantCamera';

function formatFileSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isImageMedia(media) {
  if (!media) return false;
  const mime = media.mime_type || '';
  if (mime.startsWith('image/')) return true;
  const url = media.url || media.original_filename || media.filename || '';
  return /\.(jpe?g|png|webp|gif|heic)$/i.test(url);
}

function FileRow({ media, onView, onRemove, removeLabel }) {
  const {
    elevatedCardBg, elevatedCardBorder, elevatedCardPressedBg,
    accentColor, textColor, mutedColor, errorColor, dark,
  } = useHeroSheetTokens();
  const isRTL = useIsRTL();
  const Icon = isImageMedia(media) ? ImageIcon : FileText;
  const filename = media.original_filename || media.filename || media.name || 'File';
  const size = formatFileSize(media.file_size || media.size);
  const tintBg = dark ? 'rgba(148,210,165,0.16)' : 'hsl(148, 35%, 92%)';

  return (
    <Pressable
      onPressIn={() => Haptics.selectionAsync().catch(() => {})}
      onPress={onView}
      android_ripple={{
        color: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
        borderless: false,
      }}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: pressed ? elevatedCardPressedBg : elevatedCardBg,
          borderColor: elevatedCardBorder,
        },
      ]}
      accessibilityRole="button"
    >
      <View style={[styles.rowInner, { flexDirection: rowDirection(isRTL) }]}>
        <View style={[styles.iconTile, { backgroundColor: tintBg }]}>
          <Icon size={16} color={accentColor} strokeWidth={2.4} />
        </View>
        <View style={styles.textCol}>
          <Text
            style={{
              fontSize: 13,
              fontFamily: 'Poppins-SemiBold',
              color: textColor,
              textAlign: textAlignStart(isRTL),
            }}
            numberOfLines={1}
          >
            {filename}
          </Text>
          {size ? (
            <Text
              style={{
                fontSize: 11,
                fontFamily: 'Poppins-Regular',
                color: mutedColor,
                marginTop: 2,
                textAlign: textAlignStart(isRTL),
              }}
              numberOfLines={1}
            >
              {size}
            </Text>
          ) : null}
        </View>
        <Pressable
          onPressIn={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})}
          onPress={onRemove}
          hitSlop={8}
          style={styles.removeBtn}
          accessibilityRole="button"
          accessibilityLabel={removeLabel}
        >
          <X size={14} color={errorColor} strokeWidth={2.6} />
        </Pressable>
      </View>
    </Pressable>
  );
}

function TileButton({ icon: Icon, label, onPress, loading, disabled }) {
  const {
    accentColor, textColor, mutedColor, inputBg, inputBorderIdle, dark,
  } = useHeroSheetTokens();
  const [pressed, setPressed] = useState(false);

  const isBlocked = !!(disabled || loading);
  const activeBg = dark ? 'rgba(148,210,165,0.16)' : 'hsl(148, 35%, 93%)';
  const isAccent = pressed || loading;

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
      android_ripple={{
        color: dark ? 'rgba(148,210,165,0.18)' : 'rgba(20,83,45,0.10)',
        borderless: false,
      }}
      style={[
        styles.tile,
        {
          backgroundColor: isAccent ? activeBg : inputBg,
          borderColor: isAccent ? accentColor : inputBorderIdle,
          opacity: isBlocked && !loading ? 0.5 : 1,
        },
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: isBlocked, busy: !!loading }}
    >
      {loading ? (
        <ActivityIndicator size="small" color={accentColor} />
      ) : Icon ? (
        <Icon
          size={20}
          color={isAccent ? accentColor : mutedColor}
          strokeWidth={isAccent ? 2.4 : 2}
        />
      ) : null}
      <Text
        style={{
          fontSize: 11.5,
          fontFamily: isAccent ? 'Poppins-SemiBold' : 'Poppins-Medium',
          color: isAccent ? accentColor : textColor,
          textAlign: 'center',
        }}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.8}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * Single-file upload slot. Shows a Camera + Upload button row when empty
 * and a tappable file row (with preview + delete) when filled.
 *
 * Camera uses `InstantCamera` in single-shot mode (`multi={false}`) — the
 * first capture closes the modal and uploads immediately.
 */
export default function FileUpload({
  value,
  onUpload,
  onRemove,
  label,
  entityType,
  entityId,
  category,
  mediaType = 'document',
}) {
  const { t } = useTranslation();
  const tokens = useHeroSheetTokens();
  const { textColor, errorColor } = tokens;
  const isRTL = useIsRTL();

  const [uploadSource, setUploadSource] = useState(null);
  const uploading = !!uploadSource;
  const [error, setError] = useState(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);

  useEffect(() => {
    uploadPreflight().catch(() => {});
  }, []);

  const doUpload = (uri, filename, mimeType) =>
    uploadMedia({
      uri,
      name: filename,
      mimeType,
      entityType,
      entityId,
      category,
      mediaType,
    });

  const handleCamera = () => {
    setError(null);
    setCameraOpen(true);
  };

  const handleCameraCapture = async (assets) => {
    const asset = Array.isArray(assets) ? assets[0] : assets;
    if (!asset?.uri) return;
    setUploadSource('camera');
    try {
      const fname = asset.uri.split('/').pop() || 'photo.jpg';
      const match = /\.(\w+)$/.exec(fname);
      const mimeType = match ? `image/${match[1]}` : 'image/jpeg';
      const data = await doUpload(asset.uri, fname, mimeType);
      onUpload?.(data);
    } catch (err) {
      setError(getUploadErrorMessage(err, t('documents.uploadError', 'Upload failed')));
    } finally {
      setUploadSource(null);
    }
  };

  const handleUploadFile = async () => {
    setError(null);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.length) return;

      const asset = result.assets[0];
      setUploadSource('upload');
      const fname = asset.name || asset.uri.split('/').pop() || 'file';
      const data = await doUpload(asset.uri, fname, asset.mimeType);
      onUpload?.(data);
    } catch (err) {
      setError(getUploadErrorMessage(err, t('documents.uploadError', 'Upload failed')));
    } finally {
      setUploadSource(null);
    }
  };

  const handleRemove = async () => {
    if (!value?._id) {
      onRemove?.();
      return;
    }
    try {
      await api.delete(`/media/${value._id}`);
      onRemove?.();
    } catch (err) {
      setError(err.response?.data?.message || t('documents.deleteError', 'Delete failed'));
    }
  };

  const removeLabel = t('common.delete', 'Delete');

  return (
    <View style={{ gap: 10 }}>
      {label ? (
        <Text
          style={{
            fontSize: 13,
            fontFamily: 'Poppins-Medium',
            color: textColor,
            marginHorizontal: 4,
            textAlign: textAlignStart(isRTL),
          }}
        >
          {label}
        </Text>
      ) : null}

      {value ? (
        <FileRow
          media={value}
          onView={() => setViewerOpen(true)}
          onRemove={handleRemove}
          removeLabel={removeLabel}
        />
      ) : (
        <View style={[styles.actionRow, { flexDirection: rowDirection(isRTL) }]}>
          <TileButton
            icon={Camera}
            label={t('documents.camera', 'Camera')}
            onPress={handleCamera}
            loading={uploadSource === 'camera'}
            disabled={uploading}
          />
          <TileButton
            icon={FolderOpen}
            label={t('documents.files', 'Files')}
            onPress={handleUploadFile}
            loading={uploadSource === 'upload'}
            disabled={uploading}
          />
        </View>
      )}

      {error ? (
        <Text
          style={{
            fontSize: 12,
            fontFamily: 'Poppins-Regular',
            color: errorColor,
            marginHorizontal: 4,
            textAlign: textAlignStart(isRTL),
          }}
        >
          {error}
        </Text>
      ) : null}

      <InstantCamera
        visible={cameraOpen}
        multi={false}
        onClose={() => setCameraOpen(false)}
        onCapture={handleCameraCapture}
      />

      <FileViewer
        visible={viewerOpen}
        media={value}
        onClose={() => setViewerOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  rowInner: {
    alignItems: 'center',
    gap: 12,
  },
  iconTile: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textCol: {
    flex: 1,
    minWidth: 0,
  },
  removeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionRow: {
    gap: 8,
    alignItems: 'stretch',
  },
  tile: {
    flex: 1,
    minHeight: 68,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderWidth: 1.5,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
});
