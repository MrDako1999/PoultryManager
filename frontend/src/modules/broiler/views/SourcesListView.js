import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/components/ui/use-toast';
import { Plus, MoreVertical, Pencil, Trash2, Eye, Egg, Calendar } from 'lucide-react';
import MasterDetail from '@/components/MasterDetail';
import SourceDetail from '@/modules/broiler/details/SourceDetail';
import SourceSheet from '@/modules/broiler/sheets/SourceSheet';
import ConfirmDeleteDialog from '@/components/ConfirmDeleteDialog';
import { cn } from '@/lib/utils';
import useOfflineMutation from '@/hooks/useOfflineMutation';

const fmt = (val) =>
  Number(val || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function SourcesListView({ items: sources, selectedId, basePath, persistId, batchId }) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { toast } = useToast();

  const [sourceSheetOpen, setSourceSheetOpen] = useState(false);
  const [editingSource, setEditingSource] = useState(null);
  const [sourceToDelete, setSourceToDelete] = useState(null);

  const { mutate: deleteSource, isPending: isDeleting } = useOfflineMutation('sources');

  const handleSelect = (sourceId) => navigate(`${basePath}/sources/${sourceId}`);
  const handleBack = () => navigate(`${basePath}/sources`);
  const handleEdit = (source) => { setEditingSource(source); setSourceSheetOpen(true); };

  const sheetBatchId = batchId || editingSource?.batch;

  const list = (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
        <h2 className="font-semibold text-sm">{t('batches.sourcesTab')} ({sources.length})</h2>
        {batchId && (
          <Button size="sm" className="h-7 gap-1 text-xs" onClick={() => { setEditingSource(null); setSourceSheetOpen(true); }}>
            <Plus className="h-3 w-3" />
            {t('batches.addSource')}
          </Button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto">
        {sources.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center px-4">
            <div className="rounded-full bg-muted p-4 mb-4">
              <Egg className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-1">{t('batches.noSources')}</h3>
            <p className="text-sm text-muted-foreground mb-4 max-w-sm">{t('batches.noSourcesDesc')}</p>
          </div>
        ) : (
          sources.map((source) => (
            <div
              key={source._id}
              onClick={() => handleSelect(source._id)}
              className={cn(
                'flex items-center gap-3 px-4 py-2.5 border-b cursor-pointer transition-colors hover:bg-accent/50',
                selectedId === source._id && 'bg-accent',
              )}
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{source.sourceFrom?.companyName || t('batches.unknownSupplier')}</p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {source.deliveryDate ? new Date(source.deliveryDate).toLocaleDateString() : '—'}
                  </span>
                  <Badge variant="secondary" className="text-[10px] px-1 py-0">
                    {(source.totalChicks || 0).toLocaleString('en-US')} {t('batches.chicks')}
                  </Badge>
                </div>
              </div>
              <span className="text-sm font-medium tabular-nums shrink-0">{fmt(source.grandTotal)}</span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <MoreVertical className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                  <DropdownMenuItem onClick={() => handleSelect(source._id)}>
                    <Eye className="mr-2 h-4 w-4" /> {t('common.view')}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleEdit(source)}>
                    <Pencil className="mr-2 h-4 w-4" /> {t('common.edit')}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-destructive" onClick={() => setSourceToDelete(source)}>
                    <Trash2 className="mr-2 h-4 w-4" /> {t('common.delete')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))
        )}
      </div>
    </div>
  );

  const detail = selectedId ? <SourceDetail sourceId={selectedId} onEdit={handleEdit} /> : null;

  const sourceIds = useMemo(() => sources.map((s) => s._id), [sources]);
  const currentIdx = selectedId ? sourceIds.indexOf(selectedId) : -1;

  return (
    <>
      <MasterDetail
        list={list}
        detail={detail}
        hasSelection={!!selectedId}
        onBack={handleBack}
        emptyIcon={Egg}
        emptyMessage={t('batches.selectSource', 'Select a source to view details')}
        persistId={persistId}
        hasPrev={currentIdx > 0}
        hasNext={currentIdx >= 0 && currentIdx < sourceIds.length - 1}
        onPrev={() => currentIdx > 0 && handleSelect(sourceIds[currentIdx - 1])}
        onNext={() => currentIdx < sourceIds.length - 1 && handleSelect(sourceIds[currentIdx + 1])}
      />

      {sheetBatchId && (
        <SourceSheet
          open={sourceSheetOpen}
          onOpenChange={(open) => { if (!open) { setSourceSheetOpen(false); setEditingSource(null); } }}
          batchId={sheetBatchId}
          editingSource={editingSource}
          onSuccess={() => {}}
        />
      )}

      <ConfirmDeleteDialog
        open={!!sourceToDelete}
        onOpenChange={(open) => !open && setSourceToDelete(null)}
        title={t('batches.deleteSourceTitle')}
        description={t('batches.deleteSourceWarning')}
        onConfirm={() => sourceToDelete && deleteSource({
          action: 'delete',
          id: sourceToDelete._id,
        }, {
          onSuccess: () => {
            setSourceToDelete(null);
            if (selectedId) navigate(`${basePath}/sources`, { replace: true });
            toast({ title: t('batches.sourceDeleted') });
          },
        })}
        isPending={isDeleting}
      />
    </>
  );
}
