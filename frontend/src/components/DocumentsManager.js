import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  File,
  X,
  Loader2,
  Download,
  Plus,
  Pencil,
  Check,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import AddDocumentDialog from '@/components/AddDocumentDialog';
import api from '@/lib/api';
import { isLocalId, deleteLocalBlob } from '@/lib/mediaQueue';

function formatFileSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function DocRow({ doc, media, onRename, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(doc.name);
  const [deleting, setDeleting] = useState(false);

  const handleSave = () => {
    onRename(doc.media_id, name);
    setEditing(false);
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      if (isLocalId(doc.media_id)) {
        await deleteLocalBlob(doc.media_id);
      } else {
        await api.delete(`/media/${doc.media_id}`);
      }
      onDelete(doc.media_id);
    } catch {
      setDeleting(false);
    }
  };

  return (
    <div className="flex items-center gap-3 rounded-md border p-3 transition-colors hover:bg-accent/50 overflow-hidden w-full">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted">
        <File className="h-4 w-4 text-muted-foreground" />
      </div>

      <div className="flex-1 min-w-0 overflow-hidden">
        {editing ? (
          <div className="flex items-center gap-1">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-7 text-sm"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0"
              onClick={handleSave}
            >
              <Check className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : (
          <>
            <p className="text-sm font-medium truncate">{doc.name}</p>
            <p className="text-xs text-muted-foreground truncate">
              {media?.original_filename || media?.filename}
              {media?.file_size ? ` · ${formatFileSize(media.file_size)}` : ''}
            </p>
          </>
        )}
      </div>

      <div className="flex items-center gap-0.5 shrink-0">
        {!editing && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setEditing(true)}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        )}
        {media?.url && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            asChild
          >
            <a href={media.url} target="_blank" rel="noopener noreferrer">
              <Download className="h-3.5 w-3.5" />
            </a>
          </Button>
        )}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-destructive hover:text-destructive"
          onClick={handleDelete}
          disabled={deleting}
        >
          {deleting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <X className="h-3.5 w-3.5" />
          )}
        </Button>
      </div>
    </div>
  );
}

export default function DocumentsManager({
  entityType,
  entityId,
  category,
  documents = [],
  mediaMap = {},
  onDocumentsChange,
  className,
}) {
  const { t } = useTranslation();
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleAdded = (docEntry, mediaDoc) => {
    onDocumentsChange([...documents, docEntry], {
      ...mediaMap,
      [mediaDoc._id]: mediaDoc,
    });
  };

  const handleRename = (mediaId, newName) => {
    onDocumentsChange(
      documents.map((d) =>
        d.media_id === mediaId ? { ...d, name: newName } : d
      ),
      mediaMap
    );
  };

  const handleDelete = (mediaId) => {
    onDocumentsChange(
      documents.filter((d) => d.media_id !== mediaId),
      mediaMap
    );
  };

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">{t('documents.otherDocs')}</p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => setDialogOpen(true)}
        >
          <Plus className="h-3.5 w-3.5" />
          {t('documents.addDoc')}
        </Button>
      </div>

      {documents.length > 0 ? (
        <div className="space-y-2">
          {documents.map((doc) => (
            <DocRow
              key={doc.media_id}
              doc={doc}
              media={mediaMap[doc.media_id]}
              onRename={handleRename}
              onDelete={handleDelete}
            />
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground py-3 text-center">
          {t('documents.noDocs')}
        </p>
      )}

      <AddDocumentDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        entityType={entityType}
        entityId={entityId}
        category={category}
        onAdded={handleAdded}
      />
    </div>
  );
}
