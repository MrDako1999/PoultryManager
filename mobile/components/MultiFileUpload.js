import { useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, Alert } from 'react-native';
import { Upload, FileText, Image as ImageIcon, X, Camera } from 'lucide-react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useTranslation } from 'react-i18next';
import useThemeStore from '@/stores/themeStore';
import api from '@/lib/api';
import FileViewer from './FileViewer';

function formatFileSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(media) {
  if (media?.mime_type?.startsWith('image/') || /\.(jpe?g|png|webp)$/i.test(media?.url || '')) return ImageIcon;
  return FileText;
}

function FileRow({ media, index, onRemove, mutedColor }) {
  const [viewerOpen, setViewerOpen] = useState(false);
  const Icon = getFileIcon(media);
  const filename = media.original_filename || media.filename || media.name || 'File';
  const size = formatFileSize(media.file_size || media.size);
  const canPreview = !!media.url;

  return (
    <>
      <Pressable
        onPress={canPreview ? () => setViewerOpen(true) : undefined}
        className="flex-row items-center rounded-lg border border-border px-3 py-2 bg-card active:bg-muted/30"
      >
        <Icon size={14} color={mutedColor} />
        <View className="flex-1 ml-2 mr-2 min-w-0">
          <Text className="text-xs text-foreground" numberOfLines={1}>{filename}</Text>
          {size ? <Text className="text-[10px] text-muted-foreground">{size}</Text> : null}
        </View>
        <Pressable onPress={() => onRemove(index)} className="p-1 rounded active:bg-destructive/10" hitSlop={8}>
          <X size={13} color="hsl(0, 72%, 51%)" />
        </Pressable>
      </Pressable>
      {canPreview && (
        <FileViewer visible={viewerOpen} media={media} onClose={() => setViewerOpen(false)} />
      )}
    </>
  );
}

export default function MultiFileUpload({
  label, files = [], onAdd, onRemove,
  entityType, entityId, category,
  mediaType = 'document', pickType = 'document',
}) {
  const { t } = useTranslation();
  const { resolvedTheme } = useThemeStore();
  const [uploadSource, setUploadSource] = useState(null);
  const uploading = !!uploadSource;
  const [error, setError] = useState(null);

  const isDark = resolvedTheme === 'dark';
  const mutedColor = isDark ? 'hsl(148, 10%, 55%)' : 'hsl(150, 10%, 45%)';
  const primaryColor = isDark ? 'hsl(148, 48%, 38%)' : 'hsl(148, 60%, 20%)';

  const uploadFile = async (uri, filename, mimeType) => {
    const type = mimeType || 'application/octet-stream';
    const formData = new FormData();
    formData.append('file', { uri, name: filename, type });
    if (entityType) formData.append('entityType', entityType);
    if (entityId) formData.append('entityId', entityId);
    if (category) formData.append('category', category);
    formData.append('mediaType', mediaType);

    const { data } = await api.post('/media/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  };

  const handleCamera = async () => {
    setError(null);
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(t('common.error', 'Error'), t('documents.permissionDenied', 'Permission required.'));
        return;
      }
    } catch {
      Alert.alert(t('common.error', 'Error'), t('documents.cameraUnavailable', 'Camera is not available on this device.'));
      return;
    }
    let result;
    try {
      result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8 });
    } catch {
      Alert.alert(t('common.error', 'Error'), t('documents.cameraUnavailable', 'Camera is not available on this device.'));
      return;
    }
    if (result.canceled || !result.assets?.length) return;

    const asset = result.assets[0];
    setUploadSource('camera');
    try {
      const fname = asset.uri.split('/').pop() || 'photo.jpg';
      const match = /\.(\w+)$/.exec(fname);
      const mimeType = match ? `image/${match[1]}` : 'image/jpeg';
      const media = await uploadFile(asset.uri, fname, mimeType);
      onAdd?.(media);
    } catch (err) {
      setError(err.response?.data?.message || t('documents.uploadError', 'Upload failed'));
    } finally {
      setUploadSource(null);
    }
  };

  const handleUpload = async () => {
    setError(null);
    if (pickType === 'image') {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(t('common.error', 'Error'), t('documents.permissionDenied', 'Permission required.'));
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
      if (result.canceled || !result.assets?.length) return;

      const asset = result.assets[0];
      setUploadSource('upload');
      try {
        const fname = asset.uri.split('/').pop() || 'photo.jpg';
        const match = /\.(\w+)$/.exec(fname);
        const mimeType = match ? `image/${match[1]}` : 'image/jpeg';
        const media = await uploadFile(asset.uri, fname, mimeType);
        onAdd?.(media);
      } catch (err) {
        setError(err.response?.data?.message || t('documents.uploadError', 'Upload failed'));
      } finally {
        setUploadSource(null);
      }
    } else {
      try {
        const result = await DocumentPicker.getDocumentAsync({
          type: ['application/pdf', 'image/*'],
          copyToCacheDirectory: true,
          multiple: false,
        });
        if (result.canceled || !result.assets?.length) return;

        const asset = result.assets[0];
        setUploadSource('upload');
        const fname = asset.name || asset.uri.split('/').pop() || 'file';
        const media = await uploadFile(asset.uri, fname, asset.mimeType);
        onAdd?.(media);
      } catch (err) {
        setError(err.response?.data?.message || t('documents.uploadError', 'Upload failed'));
      } finally {
        setUploadSource(null);
      }
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

  return (
    <View className="gap-2">
      {label && <Text className="text-sm font-medium text-foreground">{label}</Text>}

      {files.map((media, i) => (
        <FileRow key={media._id || i} media={media} index={i} onRemove={handleRemove} mutedColor={mutedColor} />
      ))}

      <View className="flex-row gap-2">
        <Pressable
          onPress={uploading ? undefined : handleCamera}
          className="flex-1 flex-row items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/25 py-3 active:border-primary/50 gap-2"
        >
          {uploadSource === 'camera' ? (
            <ActivityIndicator color={primaryColor} size="small" />
          ) : (
            <>
              <Camera size={18} color={uploading ? mutedColor + '60' : mutedColor} />
              <Text className={`text-xs ${uploading ? 'text-muted-foreground/40' : 'text-muted-foreground'}`}>
                {t('documents.takePhoto', 'Take Photo')}
              </Text>
            </>
          )}
        </Pressable>
        <Pressable
          onPress={uploading ? undefined : handleUpload}
          className="flex-1 flex-row items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/25 py-3 active:border-primary/50 gap-2"
        >
          {uploadSource === 'upload' ? (
            <ActivityIndicator color={primaryColor} size="small" />
          ) : (
            <>
              <Upload size={18} color={uploading ? mutedColor + '60' : mutedColor} />
              <Text className={`text-xs ${uploading ? 'text-muted-foreground/40' : 'text-muted-foreground'}`}>
                {t('documents.tapToUpload', 'Upload File')}
              </Text>
            </>
          )}
        </Pressable>
      </View>

      {error && <Text className="text-xs text-destructive">{error}</Text>}
    </View>
  );
}
