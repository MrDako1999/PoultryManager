import { useState, useEffect, useCallback } from 'react';
import {
  RefreshCw, WifiOff, AlertCircle, Check, Loader2, DatabaseZap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import useSyncStore from '@/stores/syncStore';
import { deltaSync, processQueue, fullResync } from '@/lib/syncEngine';
import { retryFailed, discardFailed, getFailedEntries } from '@/lib/mutationQueue';

export default function SyncIndicator() {
  const {
    isOnline, isSyncing, isFullResyncing, pendingCount, syncProgress,
  } = useSyncStore();
  const [failedEntries, setFailedEntries] = useState([]);
  const [open, setOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const failedCount = failedEntries.length;

  const loadFailed = useCallback(async () => {
    const entries = await getFailedEntries();
    setFailedEntries(entries);
  }, []);

  useEffect(() => {
    loadFailed();
  }, [isSyncing, pendingCount, loadFailed]);

  const handleSync = async () => {
    await deltaSync();
    await processQueue();
  };

  const handleFullResync = async () => {
    setConfirmOpen(false);
    await fullResync();
  };

  const handleOpen = async (val) => {
    if (val) await loadFailed();
    setOpen(val);
  };

  const handleRetry = async (id) => {
    await retryFailed(id);
    await processQueue();
    await loadFailed();
  };

  const handleDiscard = async (id) => {
    await discardFailed(id);
    await loadFailed();
  };

  if (isFullResyncing) {
    const pct = syncProgress ? Math.round((syncProgress.current / syncProgress.total) * 100) : 0;
    return (
      <div className="fixed inset-0 z-[200] flex items-center justify-center bg-background/80 backdrop-blur-sm">
        <div className="w-full max-w-sm mx-4 rounded-xl border bg-card p-6 shadow-lg space-y-4">
          <div className="flex items-center gap-3">
            <DatabaseZap className="h-5 w-5 text-primary animate-pulse" />
            <h3 className="text-sm font-semibold">Full Resync</h3>
          </div>
          <div className="space-y-2">
            <Progress value={pct} className="h-2" />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {syncProgress
                  ? `Fetching ${syncProgress.label}…`
                  : 'Preparing…'}
              </span>
              <span>{pct}%</span>
            </div>
            {syncProgress && (
              <p className="text-xs text-muted-foreground text-center">
                Step {syncProgress.current} of {syncProgress.total}
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  let StatusIcon, iconClass, statusLabel;
  if (!isOnline) {
    StatusIcon = WifiOff;
    iconClass = 'text-destructive';
    statusLabel = 'Offline';
  } else if (isSyncing) {
    StatusIcon = Loader2;
    iconClass = 'text-muted-foreground animate-spin';
    statusLabel = 'Syncing…';
  } else if (failedCount > 0) {
    StatusIcon = AlertCircle;
    iconClass = 'text-destructive';
    statusLabel = `${failedCount} failed`;
  } else if (pendingCount > 0) {
    StatusIcon = RefreshCw;
    iconClass = 'text-warning';
    statusLabel = `${pendingCount} pending`;
  } else {
    StatusIcon = Check;
    iconClass = 'text-success';
    statusLabel = 'Synced';
  }

  const badgeCount = failedCount || (pendingCount > 0 && !isSyncing ? pendingCount : 0);

  return (
    <>
      <DropdownMenu open={open} onOpenChange={handleOpen}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="relative h-8 w-8">
            <StatusIcon className={cn('h-4 w-4', iconClass)} />
            {badgeCount > 0 && (
              <span
                className={cn(
                  'absolute -top-0.5 -right-0.5 flex items-center justify-center h-4 min-w-4 rounded-full text-[10px] font-bold text-white px-1 pointer-events-none',
                  failedCount > 0 ? 'bg-destructive' : 'bg-warning',
                )}
              >
                {badgeCount}
              </span>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel className="flex items-center gap-2">
            <StatusIcon className={cn('h-3.5 w-3.5 shrink-0', iconClass)} />
            <span>{statusLabel}</span>
          </DropdownMenuLabel>

          {pendingCount > 0 && !isSyncing && (
            <div className="px-2 pb-1 text-[11px] text-muted-foreground">
              {pendingCount} pending change{pendingCount !== 1 ? 's' : ''}
            </div>
          )}

          <DropdownMenuSeparator />

          <DropdownMenuItem onClick={handleSync} disabled={!isOnline || isSyncing}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Sync now
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => { setOpen(false); setConfirmOpen(true); }}
            className="text-destructive focus:text-destructive"
          >
            <DatabaseZap className="mr-2 h-4 w-4" />
            Full resync
          </DropdownMenuItem>

          {failedEntries.length > 0 && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-destructive text-xs">
                Failed ({failedCount})
              </DropdownMenuLabel>
              {failedEntries.slice(0, 5).map((entry) => (
                <div key={entry.id} className="px-2 py-1.5 text-xs space-y-1">
                  <p className="font-medium">{entry.entityType} — {entry.action}</p>
                  <p className="text-muted-foreground truncate">{entry.error}</p>
                  <div className="flex gap-2 pt-0.5">
                    <button onClick={() => handleRetry(entry.id)} className="text-primary hover:underline font-medium">
                      Retry
                    </button>
                    <button onClick={() => handleDiscard(entry.id)} className="text-destructive hover:underline font-medium">
                      Discard
                    </button>
                  </div>
                </div>
              ))}
              {failedEntries.length > 5 && (
                <div className="px-2 py-1 text-[11px] text-muted-foreground">
                  +{failedEntries.length - 5} more…
                </div>
              )}
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <ResyncConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        onConfirm={handleFullResync}
        pendingCount={pendingCount}
      />
    </>
  );
}

function ResyncConfirmDialog({ open, onOpenChange, onConfirm, pendingCount }) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Full Resync</AlertDialogTitle>
          <AlertDialogDescription>
            This will clear all locally cached data and re-download everything from the server.
            {pendingCount > 0 && (
              <span className="block mt-2 font-medium text-destructive">
                You have {pendingCount} unsynced change{pendingCount !== 1 ? 's' : ''} that
                will be lost. Consider syncing first.
              </span>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>
            Resync
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
