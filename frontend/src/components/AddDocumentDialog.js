import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { useTranslation } from 'react-i18next';
import { Upload, File, Loader2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { storeBlob } from '@/lib/mediaQueue';

function formatFileSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function AddDocumentDialog({
  open,
  onOpenChange,
  entityType,
  entityId,
  category,
  onAdded,
}) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);

  const resetState = () => {
    setName('');
    setFile(null);
    setError(null);
    setUploading(false);
  };

  const handleOpenChange = (isOpen) => {
    if (!isOpen && !uploading) resetState();
    onOpenChange(isOpen);
  };

  const onDrop = useCallback((acceptedFiles) => {
    if (acceptedFiles.length > 0) {
      setFile(acceptedFiles[0]);
      setError(null);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxFiles: 1,
    disabled: uploading,
  });

  const handleRemoveFile = () => {
    setFile(null);
  };

  const handleUpload = async () => {
    if (!file) return;
    const docName = name.trim() || file.name;
    setUploading(true);
    setError(null);

    try {
      const localMedia = await storeBlob(file);
      localMedia.metadata = {};
      if (entityType) localMedia.metadata.entityType = entityType;
      if (entityId) localMedia.metadata.entityId = entityId;
      if (category) localMedia.metadata.category = category;
      localMedia.metadata.mediaType = 'document';

      onAdded?.({ name: docName, media_id: localMedia._id }, localMedia);
      resetState();
      onOpenChange(false);
    } catch (err) {
      setError(err.response?.data?.message || err.message || t('documents.uploadError'));
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('documents.addDoc')}</DialogTitle>
          <DialogDescription>{t('documents.addDocDesc')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="doc-name">{t('documents.docName')}</Label>
            <Input
              id="doc-name"
              placeholder={t('documents.docNamePlaceholder')}
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={uploading}
            />
          </div>

          {file ? (
            <div className="flex items-center gap-3 rounded-md border p-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted">
                <File className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{file.name}</p>
                <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={handleRemoveFile}
                disabled={uploading}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div
              {...getRootProps()}
              className={cn(
                'flex flex-col items-center justify-center rounded-md border-2 border-dashed p-8 transition-colors cursor-pointer',
                isDragActive
                  ? 'border-primary bg-primary/5'
                  : 'border-muted-foreground/25 hover:border-primary/50'
              )}
            >
              <input {...getInputProps()} />
              <Upload className="h-8 w-8 text-muted-foreground" />
              <p className="mt-2 text-sm text-muted-foreground">
                {isDragActive ? t('documents.dropHere') : t('documents.dragOrClick')}
              </p>
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={uploading}>
            {t('common.cancel')}
          </Button>
          <Button type="button" onClick={handleUpload} disabled={!file || uploading}>
            {uploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t('documents.upload')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
