import { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { ChevronRight, FileText, File, Image as ImageIcon, Receipt } from 'lucide-react-native';
import { cn } from '../../lib/utils';
import { SkeletonDetailPage } from '../skeletons';
import FileViewer, { detectFileType } from '../FileViewer';

export const fmt = (val) =>
  Number(val || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const fmtDate = (d) => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
};

export const fmtDateTime = (d) => {
  if (!d) return '—';
  return new Date(d).toLocaleString(undefined, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

export function Row({ label, value, bold, negative, highlight }) {
  return (
    <View className="flex-row items-center justify-between py-0.5">
      <Text className={cn('text-xs text-muted-foreground', bold && 'font-semibold')}>
        {label}
      </Text>
      <Text
        className={cn(
          'text-sm',
          bold && 'font-semibold',
          negative && 'text-red-500',
          highlight && 'text-primary',
          !negative && !highlight && 'text-foreground'
        )}
        style={{ fontVariant: ['tabular-nums'] }}
      >
        {value}
      </Text>
    </View>
  );
}

export function Section({ children, className }) {
  return (
    <View className={cn('rounded-lg border border-border bg-card overflow-hidden', className)}>
      {children}
    </View>
  );
}

export function SectionHeader({ children, icon: Icon }) {
  return (
    <View className="flex-row items-center gap-2 px-3 py-2 bg-muted/50">
      {Icon && <Icon size={14} color="hsl(150, 10%, 45%)" />}
      <Text className="text-sm font-medium text-foreground">{children}</Text>
    </View>
  );
}

export function TotalBar({ label, value }) {
  return (
    <View className="flex-row items-center justify-between bg-primary px-3 py-2">
      <Text className="text-[10px] font-bold uppercase tracking-wider text-primary-foreground">
        {label}
      </Text>
      <Text className="text-sm font-bold text-primary-foreground" style={{ fontVariant: ['tabular-nums'] }}>
        {value}
      </Text>
    </View>
  );
}

export function DetailLoading() {
  return <SkeletonDetailPage />;
}

export function PartyCard({ label, name, onPress }) {
  return (
    <View className="rounded-lg bg-primary/5 border border-primary/10 px-3 py-2.5">
      <Text className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-0.5">
        {label}
      </Text>
      <View className="flex-row items-center justify-between">
        <Text className="text-sm font-semibold text-foreground flex-1 mr-2" numberOfLines={1}>
          {name}
        </Text>
        {onPress && <ChevronRight size={14} color="hsl(150, 10%, 45%)" />}
      </View>
    </View>
  );
}

const TYPE_ICON = { image: ImageIcon, pdf: FileText, file: File };

function formatSize(bytes) {
  if (!bytes) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function DocRow({ label, doc }) {
  const [viewerOpen, setViewerOpen] = useState(false);
  if (!doc?.url) return null;

  const type = detectFileType(doc);
  const Icon = TYPE_ICON[type] || File;
  const filename = doc.original_filename || doc.filename || '';
  const size = formatSize(doc.file_size || doc.size);

  return (
    <>
      <Pressable
        onPress={() => setViewerOpen(true)}
        className="flex-row items-center gap-2.5 px-3 py-2.5 active:bg-muted/30"
      >
        <Icon size={14} color="hsl(150, 10%, 45%)" />
        <View className="flex-1 min-w-0">
          <Text className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            {label}
          </Text>
          {filename ? (
            <Text className="text-xs text-muted-foreground/70" numberOfLines={1}>{filename}</Text>
          ) : null}
        </View>
        {size && (
          <Text className="text-[10px] text-muted-foreground" style={{ fontVariant: ['tabular-nums'] }}>
            {size}
          </Text>
        )}
        <ChevronRight size={13} color="hsl(150, 10%, 45%)" />
      </Pressable>
      <FileViewer visible={viewerOpen} media={doc} onClose={() => setViewerOpen(false)} />
    </>
  );
}

export function DocsList({ docs, label }) {
  if (!docs || docs.length === 0) return null;
  return docs.filter(Boolean).map((doc, i) => {
    const media = doc.media_id || doc;
    const name = label || media?.original_filename || media?.filename || doc.name || 'File';
    return <DocRow key={media?._id || i} label={name} doc={media} />;
  });
}

export function DocumentsSection({ record, docGroups, t }) {
  const groups = docGroups.filter(({ docs }) => docs && docs.length > 0);
  if (groups.length === 0) return null;

  return (
    <Section>
      <SectionHeader icon={Receipt}>
        {t ? t('batches.sourceDetail.documents', 'Documents') : 'Documents'}
      </SectionHeader>
      <View className="divide-y divide-border">
        {groups.map(({ key, label, docs }) => (
          <DocsList key={key} docs={docs} label={label} />
        ))}
      </View>
    </Section>
  );
}
