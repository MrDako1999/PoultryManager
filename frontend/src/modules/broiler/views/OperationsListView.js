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
import { Plus, MoreVertical, Pencil, Trash2, Eye, ClipboardList, ChevronsDownUp, ChevronsUpDown, User } from 'lucide-react';
import MasterDetail from '@/components/MasterDetail';
import DailyLogDetail from '@/modules/broiler/details/DailyLogDetail';
import DailyLogSheet from '@/modules/broiler/daily-log/DailyLogSheet';
import ExpenseCategoryGroup from '@/modules/broiler/rows/ExpenseCategoryGroup';
import ConfirmDeleteDialog from '@/components/ConfirmDeleteDialog';
import { cn } from '@/lib/utils';
import useOfflineMutation from '@/hooks/useOfflineMutation';
import useGroupExpand from '@/hooks/useGroupExpand';
import { LOG_TYPE_ICONS } from '@/lib/constants';
import { formatDateForInput } from '@/lib/format';

const TYPE_BADGE_VARIANTS = {
  DAILY: 'default',
  WEIGHT: 'secondary',
  ENVIRONMENT: 'outline',
};

function formatUserName(user) {
  if (!user) return '—';
  if (typeof user === 'object') return `${user.firstName || ''} ${user.lastName || ''}`.trim() || '—';
  return String(user);
}

function LogSummary({ log, t }) {
  switch (log.logType) {
    case 'DAILY': {
      const parts = [];
      if (log.deaths != null) parts.push(`${log.deaths} ${t('batches.operations.deathsUnit')}`);
      if (log.feedKg != null) parts.push(`${log.feedKg} kg`);
      if (log.waterLiters != null) parts.push(`${log.waterLiters} L`);
      return <span>{parts.join(' · ') || '—'}</span>;
    }
    case 'WEIGHT':
      return <span>{log.averageWeight != null ? `${log.averageWeight.toLocaleString()}g` : '—'}</span>;
    case 'ENVIRONMENT': {
      const parts = [];
      if (log.temperature != null) parts.push(`${log.temperature}°C`);
      if (log.humidity != null) parts.push(`${log.humidity}%`);
      if (log.waterTDS != null) parts.push(`TDS ${log.waterTDS}`);
      if (log.waterPH != null) parts.push(`pH ${log.waterPH}`);
      return <span>{parts.join(' · ') || '—'}</span>;
    }
    default:
      return <span>—</span>;
  }
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

export default function OperationsListView({
  items: logs,
  selectedId,
  basePath,
  persistId,
  batchId,
  houseId,
  houseName,
  batch,
}) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { toast } = useToast();

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingLog, setEditingLog] = useState(null);
  const [logToDelete, setLogToDelete] = useState(null);

  const grouped = useMemo(() => {
    const groups = {};
    logs.forEach((log) => {
      const dateKey = formatDateForInput(log.date);
      if (!groups[dateKey]) groups[dateKey] = { items: [], cycleDay: log.cycleDay, count: 0 };
      groups[dateKey].items.push(log);
      groups[dateKey].count += 1;
    });
    for (const key of Object.keys(groups)) {
      groups[key].items.sort((a, b) => a.logType.localeCompare(b.logType));
    }
    return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a));
  }, [logs]);

  const groupKeys = useMemo(() => grouped.map(([dateKey]) => dateKey), [grouped]);
  const { isOpen, toggle, toggleAll, allExpanded } = useGroupExpand(groupKeys, `${persistId}-dates`);

  const { mutate: deleteLog, isPending: isDeleting } = useOfflineMutation('dailyLogs');

  const handleSelect = (logId) => navigate(`${basePath}/${logId}`);
  const handleBack = () => navigate(basePath);
  const handleEdit = (log) => { setEditingLog(log); setSheetOpen(true); };

  const list = (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
        <h2 className="font-semibold text-sm">{houseName} ({logs.length})</h2>
        <div className="flex items-center gap-1">
          {grouped.length > 1 && (
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={toggleAll}>
              {allExpanded
                ? <ChevronsDownUp className="h-3.5 w-3.5" />
                : <ChevronsUpDown className="h-3.5 w-3.5" />}
            </Button>
          )}
          {batchId && (
            <Button size="sm" className="h-7 gap-1 text-xs" onClick={() => { setEditingLog(null); setSheetOpen(true); }}>
              <Plus className="h-3 w-3" />
              {t('batches.operations.addEntry')}
            </Button>
          )}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center px-4">
            <div className="rounded-full bg-muted p-4 mb-4">
              <ClipboardList className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-1">{t('batches.operations.noEntries')}</h3>
            <p className="text-sm text-muted-foreground mb-4 max-w-sm">{t('batches.operations.noEntriesDesc')}</p>
          </div>
        ) : (
          grouped.map(([dateKey, { items, cycleDay, count }]) => (
            <ExpenseCategoryGroup
              key={dateKey}
              label={formatDate(dateKey)}
              pills={[
                ...(cycleDay ? [{ value: t('batches.operations.cycleDay', { day: cycleDay }) }] : []),
                { value: count },
              ]}
              open={isOpen(dateKey)}
              onToggle={() => toggle(dateKey)}
            >
              {items.map((log) => {
                const TypeIcon = LOG_TYPE_ICONS[log.logType];
                return (
                  <div
                    key={log._id}
                    onClick={() => handleSelect(log._id)}
                    className={cn(
                      'flex items-center gap-3 px-4 py-2.5 border-b cursor-pointer transition-colors hover:bg-accent/50',
                      selectedId === log._id && 'bg-accent',
                    )}
                  >
                    <div className="mt-0.5 shrink-0">
                      {TypeIcon && <TypeIcon className="h-4 w-4 text-muted-foreground" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge variant={TYPE_BADGE_VARIANTS[log.logType] || 'secondary'} className="text-[10px] px-1.5 py-0 shrink-0">
                          {t(`batches.operations.logTypes.${log.logType}`)}
                        </Badge>
                        <span className="text-sm font-medium truncate">
                          <LogSummary log={log} t={t} />
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-0.5">
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {formatUserName(log.createdBy)}
                        </span>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={(e) => e.stopPropagation()}>
                          <MoreVertical className="h-3.5 w-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenuItem onClick={() => handleSelect(log._id)}>
                          <Eye className="mr-2 h-4 w-4" /> {t('common.view')}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleEdit(log)}>
                          <Pencil className="mr-2 h-4 w-4" /> {t('common.edit')}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive" onClick={() => setLogToDelete(log)}>
                          <Trash2 className="mr-2 h-4 w-4" /> {t('common.delete')}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                );
              })}
            </ExpenseCategoryGroup>
          ))
        )}
      </div>
    </div>
  );

  const detail = selectedId ? (
    <DailyLogDetail logId={selectedId} onEdit={handleEdit} />
  ) : null;

  const selectedLog = logs.find((l) => l._id === selectedId);
  const detailLabel = selectedLog
    ? `${t(`batches.operations.logTypes.${selectedLog.logType}`)} · ${formatDate(selectedLog.date)}`
    : undefined;

  const flatLogIds = useMemo(() => grouped.flatMap(([, { items }]) => items.map((l) => l._id)), [grouped]);
  const currentIdx = selectedId ? flatLogIds.indexOf(selectedId) : -1;

  return (
    <>
      <MasterDetail
        list={list}
        detail={detail}
        hasSelection={!!selectedId}
        onBack={handleBack}
        emptyIcon={ClipboardList}
        emptyMessage={t('batches.operations.selectEntry')}
        persistId={persistId}
        detailLabel={detailLabel}
        hasPrev={currentIdx > 0}
        hasNext={currentIdx >= 0 && currentIdx < flatLogIds.length - 1}
        onPrev={() => currentIdx > 0 && handleSelect(flatLogIds[currentIdx - 1])}
        onNext={() => currentIdx < flatLogIds.length - 1 && handleSelect(flatLogIds[currentIdx + 1])}
      />

      {batchId && (
        <DailyLogSheet
          open={sheetOpen}
          onOpenChange={(open) => { if (!open) { setSheetOpen(false); setEditingLog(null); } }}
          batchId={batchId}
          houseId={houseId}
          editingLog={editingLog}
          batch={batch}
          onSuccess={() => {}}
        />
      )}

      <ConfirmDeleteDialog
        open={!!logToDelete}
        onOpenChange={(open) => !open && setLogToDelete(null)}
        title={t('batches.operations.deleteTitle')}
        description={t('batches.operations.deleteWarning')}
        onConfirm={() => logToDelete && deleteLog({
          action: 'delete',
          id: logToDelete._id,
        }, {
          onSuccess: () => {
            setLogToDelete(null);
            if (selectedId) navigate(basePath, { replace: true });
            toast({ title: t('batches.operations.entryDeleted') });
          },
        })}
        isPending={isDeleting}
      />
    </>
  );
}
