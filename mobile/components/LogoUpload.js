import { useState } from 'react';
import { View, Text, Pressable, Image, ActivityIndicator, Alert } from 'react-native';
import { Camera, ImagePlus, X } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { useTranslation } from 'react-i18next';
import useThemeStore from '@/stores/themeStore';
import api from '@/lib/api';
import { uploadMedia, getUploadErrorMessage } from '@/lib/uploadMedia';

export default function LogoUpload({ value, onUpload, onRemove, entityType, entityId, category }) {
  const { t } = useTranslation();
  const { resolvedTheme } = useThemeStore();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);

  const isDark = resolvedTheme === 'dark';
  const mutedColor = isDark ? 'hsl(148, 10%, 55%)' : 'hsl(150, 10%, 45%)';
  const hasLogo = !!value?.url;

  const pickImage = async (useCamera) => {
    setError(null);

    const permMethod = useCamera
      ? ImagePicker.requestCameraPermissionsAsync
      : ImagePicker.requestMediaLibraryPermissionsAsync;
    const { status } = await permMethod();
    if (status !== 'granted') {
      Alert.alert(t('common.error', 'Error'), t('documents.permissionDenied', 'Permission required to access photos.'));
      return;
    }

    const launchMethod = useCamera
      ? ImagePicker.launchCameraAsync
      : ImagePicker.launchImageLibraryAsync;

    const result = await launchMethod({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (result.canceled || !result.assets?.length) return;

    const asset = result.assets[0];
    setUploading(true);
    try {
      const data = await uploadMedia({
        uri: asset.uri,
        name: asset.uri.split('/').pop() || 'logo.jpg',
        entityType,
        entityId,
        category,
        mediaType: 'image',
      });
      onUpload?.(data);
    } catch (err) {
      setError(getUploadErrorMessage(err, t('documents.uploadError', 'Upload failed')));
    } finally {
      setUploading(false);
    }
  };

  const handlePress = () => {
    Alert.alert(
      t('businesses.logo', 'Brand / Logo'),
      null,
      [
        { text: t('documents.takePhoto', 'Take Photo'), onPress: () => pickImage(true) },
        { text: t('documents.chooseFromLibrary', 'Choose from Library'), onPress: () => pickImage(false) },
        ...(hasLogo ? [{ text: t('common.remove', 'Remove'), style: 'destructive', onPress: handleRemove }] : []),
        { text: t('common.cancel', 'Cancel'), style: 'cancel' },
      ]
    );
  };

  const handleRemove = async () => {
    if (!value?._id) return;
    try {
      await api.delete(`/media/${value._id}`);
      onRemove?.();
    } catch (err) {
      setError(err.response?.data?.message || t('documents.deleteError', 'Delete failed'));
    }
  };

  return (
    <View className="gap-1.5">
      <Pressable onPress={uploading ? undefined : handlePress} className="relative self-start">
        <View
          className={`h-24 w-24 rounded-xl overflow-hidden items-center justify-center ${
            hasLogo ? 'border border-border' : 'border-2 border-dashed border-muted-foreground/30'
          }`}
        >
          {uploading ? (
            <ActivityIndicator color={mutedColor} />
          ) : hasLogo ? (
            <Image source={{ uri: value.url }} className="h-full w-full" resizeMode="contain" />
          ) : (
            <View className="items-center gap-1">
              <ImagePlus size={24} color={mutedColor} />
              <Text className="text-[10px] text-muted-foreground">{t('farms.logoPlaceholder', 'Add Logo')}</Text>
            </View>
          )}
        </View>

        {hasLogo && !uploading && (
          <Pressable
            onPress={handleRemove}
            className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-destructive items-center justify-center"
          >
            <X size={12} color="#fff" />
          </Pressable>
        )}
      </Pressable>

      {error && <Text className="text-xs text-destructive">{error}</Text>}
    </View>
  );
}
