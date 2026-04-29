// ApproveAndCloseSheet — three-mode sheet that handles all the manual
// status flips on a processingJob:
//
//   PACKING            -> "Mark Packing Complete" (sets packingCompletedAt)
//   PACKED             -> "Close Job" (sets closedAt; if variance==0 OR no
//                         approval-required setting, also stamps
//                         varianceApproval auto so the job lands on COMPLETE)
//   AWAITING_APPROVAL  -> supervisor-required form: pick supervisor + note
//                         then stamp varianceApproval
//   COMPLETE / PACKED  -> "Reopen for Packing" (sets reopenedAt to bump
//                         the job back into PACKING via deriveJobStatus)
//
// Each mode shares the same reconciliation snapshot at the top so the
// operator sees what they're committing to.
import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter,
} from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import SearchableSelect from '@/components/SearchableSelect';
import useLocalQuery from '@/hooks/useLocalQuery';
import useOfflineMutation from '@/hooks/useOfflineMutation';
import useSettings from '@/hooks/useSettings';
import useAuthStore from '@/stores/authStore';
import { varianceTone } from '@/modules/slaughterhouse/lib/reconciliation';
import {
  canMarkPackingComplete, canCloseJob, canReopen,
} from '@/modules/slaughterhouse/lib/jobStatus';

const fmtInt = (v) => Number(v || 0).toLocaleString('en-US');
const fmtKg = (v) => Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function Row({ label, value, bold }) {
  return (
    <div className="flex justify-between text-sm">
      <span className={cn('text-muted-foreground', bold && 'text-foreground font-medium')}>
        {label}
      </span>
      <span className={cn('tabular-nums', bold && 'font-semibold')}>{value}</span>
    </div>
  );
}

export default function ApproveAndCloseSheet({ open, onOpenChange, job, reconciliation, onSuccess }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { user } = useAuthStore();
  const settings = useSettings('slaughterhouse');

  const workers = useLocalQuery('workers');
  const { mutate: saveJob, isPending } = useOfflineMutation('processingJobs');

  const [approvalNote, setApprovalNote] = useState('');
  const [approvedBy, setApprovedBy] = useState('');

  useEffect(() => {
    if (!open) return;
    setApprovalNote(job?.varianceApproval?.note || '');
    setApprovedBy(
      typeof job?.varianceApproval?.approvedBy === 'object'
        ? job.varianceApproval.approvedBy?._id
        : job?.varianceApproval?.approvedBy || '',
    );
  }, [open, job]);

  const supervisorOptions = useMemo(
    () => workers
      .filter((w) => !w.deletedAt)
      .map((w) => ({
        value: w._id,
        label: `${w.firstName || ''} ${w.lastName || ''}`.trim() || w.email || '—',
        description: w.role ? t(`workers.workerRoles.${w.role}`, w.role) : '',
      })),
    [workers, t],
  );

  if (!job || !reconciliation) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent>
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  const liveStatus = job.status; // The parent passes the derived status
                                  // via job.status as well (we'll trust
                                  // canMarkPackingComplete/etc. helpers
                                  // to gate whichever button shows).
  const reqApproval = settings?.reconciliation?.requireApprovalToClose !== false;
  const needsApproval = !reconciliation.isBalanced && reqApproval;

  const close = () => onOpenChange(false);

  const flipPackingComplete = () => {
    saveJob({
      action: 'update',
      id: job._id,
      data: {
        packingCompletedAt: new Date().toISOString(),
        packingCompletedBy: user?._id || null,
        // Reset reopen marker so the derived state stays at PACKED
        // until the operator explicitly reopens.
        reopenedAt: null,
      },
    }, {
      onSuccess: () => {
        toast({ title: t('reconciliation.markedPackingComplete', 'Marked packing complete') });
        close();
        onSuccess?.();
      },
    });
  };

  const closeJobAuto = () => {
    // Variance==0 OR approval not required -> auto-stamp approval and
    // close. This keeps the happy path one-click for clean jobs.
    saveJob({
      action: 'update',
      id: job._id,
      data: {
        closedAt: new Date().toISOString(),
        closedBy: user?._id || null,
        variance: reconciliation.variance,
        varianceApproval: {
          approvedBy: user?._id || null,
          approvedAt: new Date().toISOString(),
          note: 'Variance is zero — auto-approved on close.',
        },
        reopenedAt: null,
      },
    }, {
      onSuccess: () => {
        toast({ title: t('reconciliation.jobClosed', 'Job closed') });
        close();
        onSuccess?.();
      },
    });
  };

  const closeWithApproval = () => {
    if (!approvedBy) {
      toast({
        title: t('common.error'),
        description: t('reconciliation.supervisorRequired', 'Pick a supervisor to approve the variance'),
        variant: 'destructive',
      });
      return;
    }
    if (!approvalNote.trim()) {
      toast({
        title: t('common.error'),
        description: t('reconciliation.noteRequired', 'A short approval note is required'),
        variant: 'destructive',
      });
      return;
    }
    saveJob({
      action: 'update',
      id: job._id,
      data: {
        closedAt: job.closedAt || new Date().toISOString(),
        closedBy: user?._id || null,
        variance: reconciliation.variance,
        varianceApproval: {
          approvedBy,
          approvedAt: new Date().toISOString(),
          note: approvalNote.trim(),
        },
        reopenedAt: null,
      },
    }, {
      onSuccess: () => {
        toast({ title: t('reconciliation.jobClosed', 'Job closed') });
        close();
        onSuccess?.();
      },
    });
  };

  const reopen = () => {
    saveJob({
      action: 'update',
      id: job._id,
      data: { reopenedAt: new Date().toISOString() },
    }, {
      onSuccess: () => {
        toast({ title: t('reconciliation.reopened', 'Reopened for packing') });
        close();
        onSuccess?.();
      },
    });
  };

  const tone = varianceTone(reconciliation.variance);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{t('reconciliation.title', 'Reconciliation')}</SheetTitle>
          <SheetDescription>
            {t('reconciliation.closeDesc', 'Review the snapshot and pick the next action.')}
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="space-y-4 px-6 py-4">

            <div className="rounded-lg border p-3 space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">{t('reconciliation.balance', 'Balance')}</h3>
                <Badge
                  variant={reconciliation.isBalanced ? 'outline' : 'destructive'}
                  className={cn(
                    'gap-1.5 text-xs',
                    tone === 'minor' && 'bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100',
                    tone === 'warning' && 'bg-orange-100 text-orange-700 border-orange-200 hover:bg-orange-100',
                  )}
                >
                  {reconciliation.isBalanced
                    ? <CheckCircle2 className="h-3 w-3" />
                    : <AlertTriangle className="h-3 w-3" />}
                  {reconciliation.isBalanced
                    ? t('reconciliation.balanceOk', 'Balanced')
                    : t('reconciliation.balanceVariance', 'Variance {{value}}', {
                      value: reconciliation.variance > 0
                        ? `+${fmtInt(reconciliation.variance)}`
                        : fmtInt(reconciliation.variance),
                    })}
                </Badge>
              </div>
              <Separator className="my-1" />
              <Row label={t('reconciliation.expected', 'Expected')} value={fmtInt(reconciliation.expectedQty)} />
              <Row label={t('reconciliation.lossesSubtotal', 'Losses')} value={`-${fmtInt(reconciliation.losses)}`} />
              <Row label={t('reconciliation.netToLine', 'Net to line')} value={fmtInt(reconciliation.netToLine)} />
              <Row label={t('reconciliation.produced', 'Produced')} value={fmtInt(reconciliation.wholeBirdsPacked)} bold />
              {reconciliation.avgDressedKg != null ? (
                <Row label={t('reconciliation.yieldAvgDressedKg', 'Avg dressed weight')} value={`${fmtKg(reconciliation.avgDressedKg)} kg`} />
              ) : null}
            </div>

            {needsApproval ? (
              <div className="space-y-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3">
                <p className="text-sm font-semibold text-destructive">
                  {t('reconciliation.approvalRequired', 'Variance approval required')}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t('reconciliation.approvalRequiredDesc', 'This job has a non-zero variance. A supervisor must approve to close.')}
                </p>
                <div className="space-y-2">
                  <Label>
                    {t('reconciliation.approvedBy', 'Approved by')}
                    <span className="text-destructive ms-1">*</span>
                  </Label>
                  <SearchableSelect
                    options={supervisorOptions}
                    value={approvedBy}
                    onChange={setApprovedBy}
                    placeholder={t('reconciliation.selectSupervisor', 'Select supervisor…')}
                    searchPlaceholder={t('common.search', 'Search…')}
                    emptyMessage={t('common.noResults', 'No results')}
                  />
                </div>
                <div className="space-y-2">
                  <Label>
                    {t('reconciliation.approvalNote', 'Approval note')}
                    <span className="text-destructive ms-1">*</span>
                  </Label>
                  <Textarea
                    rows={3}
                    placeholder={t('reconciliation.approvalNotePlaceholder', 'Reason for accepting the variance…')}
                    value={approvalNote}
                    onChange={(e) => setApprovalNote(e.target.value)}
                  />
                </div>
              </div>
            ) : null}

          </div>
        </ScrollArea>

        <SheetFooter className="gap-2 flex-wrap">
          <Button type="button" variant="outline" onClick={close}>
            {t('common.cancel')}
          </Button>
          {canMarkPackingComplete(liveStatus) ? (
            <Button onClick={flipPackingComplete} disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('reconciliation.markPackingComplete', 'Mark Packing Complete')}
            </Button>
          ) : null}
          {canCloseJob(liveStatus) && !needsApproval ? (
            <Button onClick={closeJobAuto} disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('reconciliation.closeJob', 'Close Job')}
            </Button>
          ) : null}
          {canCloseJob(liveStatus) && needsApproval ? (
            <Button onClick={closeWithApproval} disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('reconciliation.approveAndClose', 'Approve & Close')}
            </Button>
          ) : null}
          {liveStatus === 'AWAITING_APPROVAL' ? (
            <Button onClick={closeWithApproval} disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('reconciliation.approveAndClose', 'Approve & Close')}
            </Button>
          ) : null}
          {canReopen(liveStatus) ? (
            <Button variant="outline" onClick={reopen} disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('reconciliation.reopen', 'Reopen for Packing')}
            </Button>
          ) : null}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
