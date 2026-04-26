import { useEffect, useState } from 'react';
import {
  View, Text, Pressable, ActivityIndicator, Alert, Image, StyleSheet,
} from 'react-native';
import {
  FileText, Image as ImageIcon, X, Camera, FolderOpen, Info,
} from 'lucide-react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { useHeroSheetTokens } from '@/components/HeroSheetScreen';
import { useIsRTL } from '@/stores/localeStore';
import { rowDirection, textAlignStart } from '@/lib/rtl';
import api from '@/lib/api';
import { uploadMedia, uploadPreflight, getUploadErrorMessage } from '@/lib/uploadMedia';
import FileViewer from './FileViewer';
import InstantCamera from './InstantCamera';

// Photo grid lays out as a responsive column grid: the row's measured
// width is split evenly into N columns minus the gaps between them, so
// thumbs always fill the available width without trailing dead space.
const GRID_COLUMNS = 3;
const GRID_GAP = 8;

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
  const url = media.url || media.original_filename || media.filename || media.name || '';
  return /\.(jpe?g|png|webp|gif|heic)$/i.test(url);
}

/* ------------------------ subcomponents ------------------------ */

function getFileExtensionLabel(media) {
  const source = media?.original_filename || media?.filename || media?.name || media?.url || '';
  const m = /\.([a-z0-9]{2,5})(?:\?|$)/i.exec(source);
  if (m) return m[1].toUpperCase();
  if (media?.mime_type === 'application/pdf') return 'PDF';
  return 'FILE';
}

/**
 * Square media thumbnail with an X overlay for delete and tap-to-preview.
 * Image media renders as a cover-fit photo; non-image media (PDFs etc.)
 * render as an accent-tinted file tile with the extension label so the
 * grid can mix photos and documents without breaking visually.
 *
 * `size` is computed by the parent grid via `onLayout` so the tile fills
 * its share of the row exactly; default fallback keeps the component
 * resilient if it's ever rendered before the grid has measured.
 */
function MediaThumb({ media, onView, onRemove, removeLabel, size }) {
  const {
    sectionBorder, accentColor, mutedColor, dark,
  } = useHeroSheetTokens();
  const isImage = isImageMedia(media);
  const tintBg = dark ? 'hsl(150, 16%, 18%)' : 'hsl(148, 22%, 95%)';
  const fileTint = dark ? 'rgba(148,210,165,0.14)' : 'hsl(148, 35%, 92%)';
  const dim = size > 0 ? size : 96;

  return (
    <View style={[thumbStyles.outer, { width: dim, height: dim }]}>
      <Pressable
        onPressIn={() => Haptics.selectionAsync().catch(() => {})}
        onPress={onView}
        style={[
          thumbStyles.imageBtn,
          {
            borderColor: sectionBorder,
            backgroundColor: tintBg,
          },
        ]}
        accessibilityRole="imagebutton"
      >
        {isImage && media.url ? (
          <Image source={{ uri: media.url }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: fileTint, alignItems: 'center', justifyContent: 'center', gap: 6, padding: 8 }]}>
            <FileText size={26} color={accentColor} strokeWidth={2.2} />
            <Text
              style={{
                fontSize: 9,
                fontFamily: 'Poppins-SemiBold',
                color: mutedColor,
                letterSpacing: 0.6,
              }}
              numberOfLines={1}
            >
              {getFileExtensionLabel(media)}
            </Text>
          </View>
        )}
      </Pressable>

      <Pressable
        onPressIn={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})}
        onPress={onRemove}
        style={thumbStyles.deleteBtn}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel={removeLabel}
      >
        <X size={11} color="#fff" strokeWidth={3} />
      </Pressable>
    </View>
  );
}

/**
 * Translucent placeholder thumbnail rendered while a capture is uploading.
 */
function UploadingThumb({ size }) {
  const { sectionBorder, accentColor, dark } = useHeroSheetTokens();
  const dim = size > 0 ? size : 96;
  return (
    <View
      style={[
        thumbStyles.outer,
        {
          width: dim,
          height: dim,
        },
      ]}
    >
      <View
        style={[
          thumbStyles.imageBtn,
          {
            borderColor: sectionBorder,
            backgroundColor: dark ? 'hsl(150, 14%, 22%)' : 'hsl(148, 22%, 95%)',
            alignItems: 'center',
            justifyContent: 'center',
          },
        ]}
      >
        <ActivityIndicator size="small" color={accentColor} />
      </View>
    </View>
  );
}

/**
 * Pretty file row used in document mode. Tap previews, X removes.
 */
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
    <View style={fileRowStyles.wrap}>
      <Pressable
        onPressIn={() => Haptics.selectionAsync().catch(() => {})}
        onPress={onView}
        android_ripple={{
          color: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
          borderless: false,
        }}
        style={({ pressed }) => [
          fileRowStyles.outer,
          {
            backgroundColor: pressed ? elevatedCardPressedBg : elevatedCardBg,
            borderColor: elevatedCardBorder,
          },
        ]}
      >
        <View style={[fileRowStyles.row, { flexDirection: rowDirection(isRTL) }]}>
          <View style={[fileRowStyles.iconTile, { backgroundColor: tintBg }]}>
            <Icon size={16} color={accentColor} strokeWidth={2.4} />
          </View>
          <View style={fileRowStyles.textCol}>
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
            style={fileRowStyles.removeBtn}
            accessibilityRole="button"
            accessibilityLabel={removeLabel}
          >
            <X size={14} color={errorColor} strokeWidth={2.6} />
          </Pressable>
        </View>
      </Pressable>
    </View>
  );
}

/**
 * Source picker tile — card-style button that mirrors `EnumButtonSelect`
 * (the "Entry Type" segmented selector used elsewhere in forms). Three
 * tiles share the row equally via `flex: 1` + an 8pt gap; each tile is
 * a 68pt min-height rounded card with a centered icon on top and a
 * label underneath.
 *
 * Idle: soft `inputBg` fill + hairline `inputBorderIdle`, muted icon
 * and body-text label. Pressed: accent-tinted fill, accent border,
 * accent icon + label so the button visibly "lights up" while held —
 * same press-state palette `EnumButtonSelect` uses for `selected`.
 *
 * Press state is tracked with `useState` (not Pressable's functional
 * style) per DESIGN_LANGUAGE.md §9 to dodge NativeWind's layout-strip
 * trap on press-style returns.
 */
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
        tileStyles.tile,
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

/* ----------------------------- main ----------------------------- */

/**
 * Multi-attachment uploader that adapts its presentation to the file
 * kind:
 *
 *   - **Image mode** (`pickType === 'image'` or `mediaType === 'image'`):
 *     attached files render as a wrapping grid of square thumbnails. The
 *     "Take Photo" button opens the camera in batch mode (snap many,
 *     review, then submit all at once). "Choose from Gallery" opens the
 *     OS gallery with multi-select.
 *
 *   - **Document mode**: attached files render as elevated card rows
 *     with a tinted icon tile, filename, size, and a destructive X. The
 *     buttons are "Take Photo" + "Upload File" (PDF or image).
 *
 * Both modes share the same chrome below: a sticky two-button row, an
 * upload-progress hint while a batch is uploading, and an inline error
 * line when something goes wrong.
 *
 * @param {object} props
 * @param {string}   [props.label]
 * @param {Array}    [props.files=[]]
 * @param {Function} [props.onAdd]
 * @param {Function} [props.onRemove]
 * @param {string}   [props.entityType]
 * @param {string}   [props.entityId]
 * @param {string}   [props.category]
 * @param {string}   [props.mediaType='document']
 * @param {string}   [props.pickType='document'] - 'image' switches to the
 *   photo-grid layout and routes to the image library; otherwise
 *   documents (PDF or image) via the document picker.
 */
export default function MultiFileUpload({
  label, files = [], onAdd, onRemove,
  entityType, entityId, category,
  mediaType = 'document', pickType = 'document',
}) {
  const { t } = useTranslation();
  const tokens = useHeroSheetTokens();
  const {
    accentColor, textColor, mutedColor, errorColor,
  } = tokens;
  const isRTL = useIsRTL();

  const [uploadSource, setUploadSource] = useState(null);
  const uploading = !!uploadSource;
  const [progress, setProgress] = useState(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [error, setError] = useState(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [viewerMedia, setViewerMedia] = useState(null);
  const [gridWidth, setGridWidth] = useState(0);

  const isImageMode = pickType === 'image' || mediaType === 'image';
  const tileSize = gridWidth > 0
    ? Math.floor((gridWidth - GRID_GAP * (GRID_COLUMNS - 1)) / GRID_COLUMNS)
    : 0;

  useEffect(() => {
    uploadPreflight().catch(() => {});
  }, []);

  const uploadFile = (uri, filename, mimeType) =>
    uploadMedia({
      uri,
      name: filename,
      mimeType,
      entityType,
      entityId,
      category,
      mediaType,
    });

  const uploadAssetSequentially = async (assets) => {
    setError(null);
    setPendingCount(assets.length);
    let succeeded = 0;
    for (let i = 0; i < assets.length; i += 1) {
      setProgress({ current: i + 1, total: assets.length });
      const a = assets[i];
      try {
        const fname = a.name
          || a.uri.split('/').pop()
          || `photo-${Date.now()}-${i}.jpg`;
        const match = /\.(\w+)$/.exec(fname);
        const mimeType = a.mimeType
          || (match ? `image/${match[1].toLowerCase()}` : 'image/jpeg');
        const media = await uploadFile(a.uri, fname, mimeType);
        onAdd?.(media);
        succeeded += 1;
        setPendingCount((p) => Math.max(0, p - 1));
      } catch (err) {
        const msg = getUploadErrorMessage(err, t('documents.uploadError', 'Upload failed'));
        setError(succeeded > 0
          ? `${msg} (${succeeded}/${assets.length} ${t('documents.uploaded', 'uploaded')})`
          : msg);
        setPendingCount(0);
        break;
      }
    }
    setProgress(null);
    setPendingCount(0);
    if (succeeded > 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
  };

  const handleCamera = () => {
    setError(null);
    setCameraOpen(true);
  };

  const handleCameraCapture = async (assets) => {
    if (!assets?.length) return;
    setUploadSource('camera');
    try {
      await uploadAssetSequentially(assets);
    } finally {
      setUploadSource(null);
    }
  };

  const handlePickFromGallery = async () => {
    setError(null);
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        t('common.error', 'Error'),
        t('documents.permissionDenied', 'Permission required.'),
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsMultipleSelection: true,
      selectionLimit: 0,
    });
    if (result.canceled || !result.assets?.length) return;

    setUploadSource('upload');
    try {
      await uploadAssetSequentially(
        result.assets.map((a) => ({ uri: a.uri, name: a.fileName })),
      );
    } finally {
      setUploadSource(null);
    }
  };

  const handlePickFiles = async () => {
    setError(null);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
        multiple: true,
      });
      if (result.canceled || !result.assets?.length) return;

      setUploadSource('files');
      const assets = result.assets.map((a) => ({
        uri: a.uri,
        name: a.name,
        mimeType: a.mimeType,
      }));
      await uploadAssetSequentially(assets);
    } catch (err) {
      setError(getUploadErrorMessage(err, t('documents.uploadError', 'Upload failed')));
    } finally {
      setUploadSource(null);
    }
  };

  const handleRemove = async (index) => {
    const media = files[index];
    if (media?._id) {
      try {
        await api.delete(`/media/${media._id}`);
      } catch (_) { /* best-effort delete */ }
    }
    onRemove?.(index);
  };

  const removeLabel = t('documents.removePhoto', 'Remove');
  const isUploadingSomething = uploading && !!progress;
  const placeholdersToRender = isUploadingSomething ? pendingCount : 0;

  return (
    <View style={{ gap: 12 }}>
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

      {/* Existing files */}
      {isImageMode ? (
        <View
          onLayout={(e) => setGridWidth(e.nativeEvent.layout.width)}
          style={[
            gridStyles.grid,
            { flexDirection: rowDirection(isRTL) },
          ]}
        >
          {tileSize > 0 ? (
            <>
              {files.map((media, i) => (
                <MediaThumb
                  key={media._id || `${media.url}-${i}`}
                  media={media}
                  onView={() => setViewerMedia(media)}
                  onRemove={() => handleRemove(i)}
                  removeLabel={removeLabel}
                  size={tileSize}
                />
              ))}
              {placeholdersToRender > 0
                ? Array.from({ length: placeholdersToRender }).map((_, i) => (
                  <UploadingThumb key={`placeholder-${i}`} size={tileSize} />
                ))
                : null}
            </>
          ) : null}
        </View>
      ) : (
        <View style={{ gap: 8 }}>
          {files.map((media, i) => (
            <FileRow
              key={media._id || `${media.url}-${i}`}
              media={media}
              onView={() => setViewerMedia(media)}
              onRemove={() => handleRemove(i)}
              removeLabel={removeLabel}
            />
          ))}
        </View>
      )}

      {/* Upload progress */}
      {isUploadingSomething ? (
        <View style={[progressStyles.bar, { flexDirection: rowDirection(isRTL) }]}>
          <ActivityIndicator size="small" color={accentColor} />
          <Text
            style={{
              fontSize: 12,
              fontFamily: 'Poppins-Medium',
              color: accentColor,
            }}
            numberOfLines={1}
          >
            {`${t('documents.uploading', 'Uploading')} ${progress.current} / ${progress.total}`}
          </Text>
        </View>
      ) : null}

      {/* Inline hint — softly explains the source picker that follows. */}
      <View style={[hintStyles.row, { flexDirection: rowDirection(isRTL) }]}>
        <Info size={13} color={mutedColor} strokeWidth={2.2} />
        <Text
          style={[hintStyles.text, { color: mutedColor, textAlign: textAlignStart(isRTL) }]}
        >
          {isImageMode
            ? t('documents.uploadHintImage', 'Add photos via the camera, your gallery, or pick any local file using the buttons below.')
            : t('documents.uploadHintFile', 'Capture with the camera or pick any local file using the buttons below.')}
        </Text>
      </View>

      {/* Source picker — Camera | Gallery (image mode only) | Files */}
      <View style={[tileStyles.row, { flexDirection: rowDirection(isRTL) }]}>
        <TileButton
          icon={Camera}
          label={t('documents.camera', 'Camera')}
          onPress={handleCamera}
          loading={uploadSource === 'camera'}
          disabled={uploading}
        />
        {isImageMode ? (
          <TileButton
            icon={ImageIcon}
            label={t('documents.gallery', 'Gallery')}
            onPress={handlePickFromGallery}
            loading={uploadSource === 'upload'}
            disabled={uploading}
          />
        ) : null}
        <TileButton
          icon={FolderOpen}
          label={t('documents.files', 'Files')}
          onPress={handlePickFiles}
          loading={uploadSource === 'files'}
          disabled={uploading}
        />
      </View>

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
        multi={isImageMode}
        onClose={() => setCameraOpen(false)}
        onCapture={handleCameraCapture}
      />

      <FileViewer
        visible={!!viewerMedia}
        media={viewerMedia}
        onClose={() => setViewerMedia(null)}
      />
    </View>
  );
}

/* ----------------------------- styles ----------------------------- */

const gridStyles = StyleSheet.create({
  grid: {
    flexWrap: 'wrap',
    gap: GRID_GAP,
    minHeight: 1,
  },
});

const hintStyles = StyleSheet.create({
  row: {
    alignItems: 'flex-start',
    gap: 8,
    paddingHorizontal: 4,
    paddingTop: 2,
  },
  text: {
    flex: 1,
    fontSize: 12,
    fontFamily: 'Poppins-Regular',
    lineHeight: 17,
  },
});

const thumbStyles = StyleSheet.create({
  outer: {
    position: 'relative',
  },
  imageBtn: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtn: {
    position: 'absolute',
    top: -6,
    end: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(15,31,16,0.92)',
    borderWidth: 1.5,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
});

const fileRowStyles = StyleSheet.create({
  wrap: {
    overflow: 'hidden',
  },
  outer: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  row: {
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
});

const progressStyles = StyleSheet.create({
  bar: {
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 4,
  },
});

const tileStyles = StyleSheet.create({
  row: {
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
