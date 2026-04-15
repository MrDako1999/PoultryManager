import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { useTranslation } from 'react-i18next';
import { Camera, Loader2, Upload, X } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import api from '@/lib/api';

export default function AvatarUpload({
  value,
  onUpload,
  onRemove,
  entityType,
  entityId,
  category,
  fallback,
  disabled,
  className,
}) {
  const { t } = useTranslation();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);

  const onDrop = useCallback(
    async (acceptedFiles) => {
      if (acceptedFiles.length === 0) return;
      const file = acceptedFiles[0];
      setUploading(true);
      setError(null);

      try {
        const formData = new FormData();
        formData.append('file', file);
        if (entityType) formData.append('entityType', entityType);
        if (entityId) formData.append('entityId', entityId);
        if (category) formData.append('category', category);
        formData.append('mediaType', 'image');

        const { data } = await api.post('/media/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        onUpload?.(data);
      } catch (err) {
        setError(err.response?.data?.message || t('documents.uploadError'));
      } finally {
        setUploading(false);
      }
    },
    [entityType, entityId, category, onUpload, t]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.jpg', '.jpeg', '.png', '.webp'] },
    maxFiles: 1,
    disabled: uploading || disabled,
  });

  const handleRemove = async (e) => {
    e.stopPropagation();
    if (!value?._id) return;
    try {
      await api.delete(`/media/${value._id}`);
      onRemove?.();
    } catch (err) {
      setError(err.response?.data?.message || t('documents.deleteError'));
    }
  };

  const hasPhoto = !!value?.url;

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative group">
        <div
          {...(disabled ? {} : getRootProps())}
          className={cn(
            'relative rounded-full',
            !disabled && 'cursor-pointer',
            !disabled && !hasPhoto && 'border-2 border-dashed border-muted-foreground/30 p-1 hover:border-primary/50 transition-colors',
            isDragActive && 'ring-2 ring-primary ring-offset-2 border-primary',
          )}
        >
          {!disabled && <input {...getInputProps()} />}
          <Avatar key={value?._id || 'no-photo'} className={cn('h-20 w-20', className)}>
            {hasPhoto && <AvatarImage src={value.url} alt="Photo" />}
            <AvatarFallback className="text-lg bg-primary/10 text-primary">
              {fallback}
            </AvatarFallback>
          </Avatar>

          {!disabled && !uploading && !hasPhoto && (
            <div className="absolute inset-0 flex items-center justify-center rounded-full">
              <Upload className="h-4 w-4 text-muted-foreground/60 absolute bottom-1.5 right-1.5" />
            </div>
          )}

          {!disabled && !uploading && hasPhoto && (
            <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/0 group-hover:bg-black/40 transition-colors">
              <Camera className="h-5 w-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          )}

          {uploading && (
            <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40">
              <Loader2 className="h-5 w-5 text-white animate-spin" />
            </div>
          )}
        </div>

        {hasPhoto && !disabled && !uploading && (
          <button
            type="button"
            onClick={handleRemove}
            className="absolute -top-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>
      {!disabled && !hasPhoto && (
        <p className="text-[11px] text-muted-foreground">{t('documents.dragOrClick')}</p>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
