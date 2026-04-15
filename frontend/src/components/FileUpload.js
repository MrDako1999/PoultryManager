import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { useTranslation } from 'react-i18next';
import { Upload, File, Image as ImageIcon, X, ExternalLink, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import api from '@/lib/api';
import { storeBlob, isLocalId, deleteLocalBlob } from '@/lib/mediaQueue';

function formatFileSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function detectType(media) {
  if (!media?.url && !media?.mime_type) return 'file';
  if (media.mime_type?.startsWith('image/') || /\.(jpe?g|png|webp|gif)$/i.test(media.url || '')) return 'image';
  if (media.mime_type === 'application/pdf' || /\.pdf$/i.test(media.url || '')) return 'pdf';
  return 'file';
}

const TYPE_ICON = { image: ImageIcon, pdf: File, file: File };

function FilePreview({ value, onRemove, readOnly }) {
  const [expanded, setExpanded] = useState(false);
  const type = detectType(value);
  const canPreview = type === 'image' || type === 'pdf';
  const filename = value.original_filename || value.filename || 'File';
  const size = formatFileSize(value.file_size || value.size);
  const Icon = TYPE_ICON[type];

  const handleRowClick = canPreview
    ? () => setExpanded((v) => !v)
    : value.url ? () => window.open(value.url, '_blank', 'noopener,noreferrer') : undefined;

  return (
    <div className="rounded-md border overflow-hidden w-full">
      <div
        role={handleRowClick ? 'button' : undefined}
        tabIndex={handleRowClick ? 0 : undefined}
        onClick={handleRowClick}
        onKeyDown={handleRowClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleRowClick(); } } : undefined}
        className={cn('flex items-center gap-2.5 px-3 py-2 text-sm overflow-hidden', handleRowClick && 'cursor-pointer hover:bg-muted/30 transition-colors')}
      >
        <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <div className="flex-1 min-w-0 overflow-hidden">
          <p className="text-xs truncate" title={filename}>{filename}</p>
          {size && <p className="text-[10px] text-muted-foreground/70 tabular-nums">{size}</p>}
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          {value.url && (
            <a
              href={value.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="p-1 rounded hover:bg-muted/50 transition-colors text-muted-foreground hover:text-foreground"
              title="Open"
            >
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
          {canPreview && (
            <ChevronDown className={cn('h-3 w-3 text-muted-foreground transition-transform duration-200', expanded && 'rotate-180')} />
          )}
          {!readOnly && onRemove && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onRemove(); }}
              className="p-1 rounded hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>
      {expanded && canPreview && (
        <div className="px-3 pb-2.5">
          {type === 'image' ? (
            <a href={value.url} target="_blank" rel="noopener noreferrer" className="block">
              <img
                src={value.url}
                alt={filename}
                className="w-full max-h-96 object-contain rounded-md border bg-muted/20"
              />
            </a>
          ) : (
            <iframe
              src={value.url}
              title={filename}
              className="w-full h-96 rounded-md border bg-white"
            />
          )}
        </div>
      )}
    </div>
  );
}

export default function FileUpload({
  value,
  onUpload,
  onRemove,
  accept,
  entityType,
  entityId,
  category,
  mediaType = 'document',
  customPrefix,
  label,
  className,
  multiple = false,
  readOnly = false,
}) {
  const { t } = useTranslation();
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploadCount, setUploadCount] = useState({ done: 0, total: 0 });
  const [error, setError] = useState(null);

  const uploadSingleFile = useCallback(
    async (file) => {
      const localMedia = await storeBlob(file);
      localMedia.metadata = {};
      if (entityType) localMedia.metadata.entityType = entityType;
      if (entityId) localMedia.metadata.entityId = entityId;
      if (category) localMedia.metadata.category = category;
      if (mediaType) localMedia.metadata.mediaType = mediaType;
      if (customPrefix) localMedia.metadata.customPrefix = customPrefix;
      setProgress(100);
      return localMedia;
    },
    [entityType, entityId, category, mediaType, customPrefix]
  );

  const onDrop = useCallback(
    async (acceptedFiles) => {
      if (acceptedFiles.length === 0) return;
      setUploading(true);
      setProgress(0);
      setError(null);

      if (multiple) {
        setUploadCount({ done: 0, total: acceptedFiles.length });
        for (let i = 0; i < acceptedFiles.length; i++) {
          try {
            setProgress(0);
            const media = await uploadSingleFile(acceptedFiles[i]);
            onUpload?.(media);
            setUploadCount((prev) => ({ ...prev, done: prev.done + 1 }));
          } catch (err) {
            setError(err.response?.data?.message || t('documents.uploadError'));
          }
        }
      } else {
        try {
          const media = await uploadSingleFile(acceptedFiles[0]);
          onUpload?.(media);
        } catch (err) {
          setError(err.response?.data?.message || t('documents.uploadError'));
        }
      }

      setUploading(false);
      setProgress(0);
      setUploadCount({ done: 0, total: 0 });
    },
    [multiple, uploadSingleFile, onUpload, t]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept,
    maxFiles: multiple ? undefined : 1,
    multiple,
    disabled: uploading,
  });

  const handleRemove = async () => {
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

  if (value) {
    return (
      <div className={cn(className)}>
        {label && <p className="text-sm font-medium mb-2">{label}</p>}
        <FilePreview value={value} onRemove={readOnly ? undefined : handleRemove} readOnly={readOnly} />
      </div>
    );
  }

  const progressLabel = multiple && uploadCount.total > 1
    ? `${t('documents.uploading')} ${uploadCount.done + 1}/${uploadCount.total} — ${progress}%`
    : `${t('documents.uploading')} ${progress}%`;

  return (
    <div className={cn(className)}>
      {label && <p className="text-sm font-medium mb-2">{label}</p>}
      <div
        {...getRootProps()}
        className={cn(
          'flex flex-col items-center justify-center rounded-md border-2 border-dashed p-6 transition-colors cursor-pointer',
          isDragActive
            ? 'border-primary bg-primary/5'
            : 'border-muted-foreground/25 hover:border-primary/50',
          uploading && 'pointer-events-none'
        )}
      >
        <input {...getInputProps()} />
        {uploading ? (
          <div className="w-full space-y-2">
            <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all duration-300 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground text-center">
              {progressLabel}
            </p>
          </div>
        ) : (
          <>
            <Upload className="h-8 w-8 text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">
              {isDragActive ? t('documents.dropHere') : t('documents.dragOrClick')}
            </p>
          </>
        )}
      </div>
      {error && (
        <p className="mt-1 text-sm text-destructive">{error}</p>
      )}
    </div>
  );
}
