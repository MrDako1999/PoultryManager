import { useState } from 'react';
import { FileText, File, Image as ImageIcon, ChevronDown, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';

export const fmt = (val) =>
  Number(val || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const fmtDate = (d) => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
};

export const LABEL_CLS = 'text-xs text-muted-foreground';
export const VALUE_CLS = 'text-sm tabular-nums';
export const ROW_CLS = 'flex items-center justify-between py-0.5';
export const CARD_CLS = 'rounded-md border overflow-hidden';
export const PARTY_CLS = 'w-full text-left rounded-md bg-primary/5 dark:bg-primary/10 border border-primary/10 px-3 py-2.5 hover:bg-primary/10 dark:hover:bg-primary/15 transition-colors group';
export const LINK_ROW_CLS = 'flex items-center justify-between w-full text-left px-3 py-2 text-sm hover:bg-muted/30 transition-colors';
export const TABLE_HEADER_CLS = 'bg-primary text-primary-foreground px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider';
export const TABLE_ROW_CLS = 'px-3 py-1.5 text-sm border-b last:border-b-0';

export function Row({ label, value, bold, negative, highlight }) {
  return (
    <div className={cn(
      ROW_CLS,
      bold && 'font-semibold',
      negative && 'text-red-600 dark:text-red-400',
      highlight && 'text-primary',
    )}>
      <span className={LABEL_CLS}>{label}</span>
      <span className={VALUE_CLS}>{value}</span>
    </div>
  );
}

function detectType(doc) {
  if (!doc?.url) return 'file';
  if (doc.mime_type?.startsWith('image/') || /\.(jpe?g|png|webp|gif)$/i.test(doc.url)) return 'image';
  if (doc.mime_type === 'application/pdf' || /\.pdf$/i.test(doc.url)) return 'pdf';
  return 'file';
}

const TYPE_ICON = { image: ImageIcon, pdf: FileText, file: File };

export function DocRow({ label, doc }) {
  const [open, setOpen] = useState(false);
  const type = detectType(doc);
  const canPreview = type === 'image' || type === 'pdf';
  const filename = doc?.original_filename || doc?.filename || '';
  const sizeKb = doc?.size > 0 ? (doc.size / 1024).toFixed(1) : null;
  const Icon = TYPE_ICON[type];

  const handleRowClick = canPreview
    ? () => setOpen((v) => !v)
    : doc?.url ? () => window.open(doc.url, '_blank', 'noopener,noreferrer') : undefined;

  return (
    <div className="overflow-hidden w-full">
      <div
        role={handleRowClick ? 'button' : undefined}
        tabIndex={handleRowClick ? 0 : undefined}
        onClick={handleRowClick}
        onKeyDown={handleRowClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleRowClick(); } } : undefined}
        className={cn('flex items-center gap-2.5 px-3 py-2 text-sm overflow-hidden', handleRowClick && 'cursor-pointer hover:bg-muted/30 transition-colors')}
      >
        <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <div className="flex-1 min-w-0 overflow-hidden">
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{label}</span>
          {filename && <p className="text-xs text-muted-foreground/70 truncate">{filename}</p>}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {sizeKb && <span className="text-[10px] text-muted-foreground tabular-nums">{sizeKb} KB</span>}
          {doc?.url && (
            <a
              href={doc.url}
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
            <ChevronDown className={cn('h-3 w-3 text-muted-foreground transition-transform duration-200', open && 'rotate-180')} />
          )}
        </div>
      </div>
      {open && canPreview && (
        <div className="px-3 pb-2.5">
          {type === 'image' ? (
            <a href={doc.url} target="_blank" rel="noopener noreferrer" className="block">
              <img
                src={doc.url}
                alt={label}
                className="w-full max-h-96 object-contain rounded-md border bg-muted/20"
              />
            </a>
          ) : (
            <iframe
              src={doc.url}
              title={label}
              className="w-full h-96 rounded-md border bg-white"
            />
          )}
        </div>
      )}
    </div>
  );
}

export function OtherDocsList({ docs }) {
  if (!docs || docs.length === 0) return null;
  return docs.map((doc, i) => {
    const media = doc.media_id || doc;
    const name = media?.original_filename || media?.filename || doc.name || 'File';
    return <DocRow key={media?._id || i} label={name} doc={media} />;
  });
}
