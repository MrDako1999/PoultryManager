/**
 * MultiFileUpload — reusable multi-file upload widget.
 *
 * Wraps the FileUpload component to support lists of attached documents
 * with add/remove. Used by SourceSheet, ExpenseSheet, FeedOrderSheet,
 * and any future entity sheet that handles document uploads.
 */
import { Label } from '@/components/ui/label';
import FileUpload from '@/components/FileUpload';
import { DOC_ACCEPT } from '@/lib/constants';

export default function MultiFileUpload({ label, files, onAdd, onRemove, entityType, entityId, category, guardMarkDirty, readOnly }) {
  return (
    <div className="space-y-2">
      {files.map((media, i) => (
        <FileUpload
          key={media._id}
          label={i === 0 ? label : undefined}
          value={media}
          onRemove={readOnly ? undefined : () => { onRemove(i); guardMarkDirty(); }}
          entityType={entityType}
          entityId={entityId}
          category={category}
          mediaType="document"
          accept={DOC_ACCEPT}
          readOnly={readOnly}
        />
      ))}
      {!readOnly && (
        <FileUpload
          label={files.length === 0 ? label : undefined}
          value={null}
          multiple
          onUpload={(media) => { onAdd(media); guardMarkDirty(); }}
          entityType={entityType}
          entityId={entityId}
          category={category}
          mediaType="document"
          accept={DOC_ACCEPT}
        />
      )}
      {readOnly && files.length === 0 && (
        <div>
          <Label className="text-sm font-medium">{label}</Label>
          <p className="text-sm text-muted-foreground mt-1">—</p>
        </div>
      )}
    </div>
  );
}
