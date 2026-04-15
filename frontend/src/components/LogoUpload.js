import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { useTranslation } from 'react-i18next';
import { Camera, ImagePlus, Loader2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import api from '@/lib/api';
import { isLocalId, deleteLocalBlob } from '@/lib/mediaQueue';

const MIN_DIMENSION = 128;
const MAX_DIMENSION = 2056;
const RATIO_TOLERANCE = 0.05;
const ALLOWED_RATIOS = [
  { w: 1, h: 1, label: '1:1' },
  { w: 2, h: 1, label: '2:1' },
];

function validateDimensions(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(img.src);
      const { width, height } = img;

      if (width < MIN_DIMENSION || height < MIN_DIMENSION) {
        reject(new Error(`Image must be at least ${MIN_DIMENSION}×${MIN_DIMENSION}px`));
        return;
      }
      if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        reject(new Error(`Image must be no larger than ${MAX_DIMENSION}px on any side`));
        return;
      }

      const ratio = width / height;
      const matched = ALLOWED_RATIOS.some(
        (r) => Math.abs(ratio - r.w / r.h) <= RATIO_TOLERANCE
      );
      if (!matched) {
        const labels = ALLOWED_RATIOS.map((r) => r.label).join(' or ');
        reject(new Error(`Image aspect ratio must be ${labels}`));
        return;
      }

      resolve();
    };
    img.onerror = () => {
      URL.revokeObjectURL(img.src);
      reject(new Error('Could not read image'));
    };
    img.src = URL.createObjectURL(file);
  });
}

export default function LogoUpload({
  value,
  onUpload,
  onRemove,
  entityType,
  entityId,
  category,
  customPrefix,
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
      setError(null);

      const isSvg = file.type === 'image/svg+xml' || file.name?.endsWith('.svg');
      if (!isSvg) {
        try {
          await validateDimensions(file);
        } catch (err) {
          setError(err.message);
          return;
        }
      }

      setUploading(true);
      try {
        const formData = new FormData();
        formData.append('file', file);
        if (entityType) formData.append('entityType', entityType);
        if (entityId) formData.append('entityId', entityId);
        if (category) formData.append('category', category);
        if (customPrefix) formData.append('customPrefix', customPrefix);
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
    [entityType, entityId, category, customPrefix, onUpload, t]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.jpg', '.jpeg', '.png', '.webp', '.svg'] },
    maxFiles: 1,
    disabled: uploading || disabled,
  });

  const handleRemove = async (e) => {
    e.stopPropagation();
    if (!value?._id) return;
    try {
      if (isLocalId(value._id)) {
        await deleteLocalBlob(value._id);
      } else {
        await api.delete(`/media/${value._id}`);
      }
      onRemove?.();
    } catch (err) {
      setError(err.response?.data?.message || t('documents.deleteError'));
    }
  };

  const hasLogo = !!value?.url;

  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="relative group inline-block">
        <div
          {...(disabled ? {} : getRootProps())}
          className={cn(
            'relative flex items-center justify-center rounded-lg overflow-hidden transition-colors',
            'h-24 w-24',
            !disabled && 'cursor-pointer',
            !hasLogo && !disabled && 'border-2 border-dashed border-muted-foreground/30 hover:border-primary/50',
            hasLogo && 'border border-border',
            isDragActive && 'ring-2 ring-primary ring-offset-2 border-primary',
          )}
        >
          {!disabled && <input {...getInputProps()} />}

          {hasLogo ? (
            <img
              src={value.url}
              alt="Logo"
              className="h-full w-full object-contain p-1"
            />
          ) : (
            !uploading && (
              <div className="flex flex-col items-center gap-1 text-muted-foreground/60">
                <ImagePlus className="h-6 w-6" />
                <span className="text-[10px] font-medium">{t('farms.logoPlaceholder')}</span>
              </div>
            )
          )}

          {!disabled && !uploading && hasLogo && (
            <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/0 group-hover:bg-black/40 transition-colors">
              <Camera className="h-5 w-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          )}

          {uploading && (
            <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/40">
              <Loader2 className="h-5 w-5 text-white animate-spin" />
            </div>
          )}
        </div>

        {hasLogo && !disabled && !uploading && (
          <button
            type="button"
            onClick={handleRemove}
            className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>

      {!disabled && !hasLogo && (
        <p className="text-[11px] text-muted-foreground">
          {t('farms.logoHint')}
        </p>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
