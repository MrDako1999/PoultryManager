// JobDetail — read-only summary panel for a processingJob, suitable
// for opening from a list row in a stacked detail-sheet. Mirrors the
// broiler SaleDetail layout: header chip + party card + totals card +
// docs list. The bulk of the job's interactivity lives in the tab
// outlets; this is the at-a-glance view.
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useMemo } from 'react';
import { Pencil, ChevronRight, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import useLocalRecord from '@/hooks/useLocalRecord';
import useLocalQuery from '@/hooks/useLocalQuery';
import JobStatusBadge from '@/modules/slaughterhouse/components/JobStatusBadge';
import {
  Row, fmtDate, CARD_CLS, PARTY_CLS,
} from './shared';
import { computeReconciliation } from '@/modules/slaughterhouse/lib/reconciliation';
import { deriveJobStatus } from '@/modules/slaughterhouse/lib/jobStatus';

const fmtInt = (v) => Number(v || 0).toLocaleString('en-US');
const fmtKg = (v) => Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function JobDetail({ jobId, onClose, onEdit }) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const job = useLocalRecord('processingJobs', jobId);
  const businesses = useLocalQuery('businesses');
  const truckEntries = useLocalQuery('truckEntries', { job: jobId });
  const productionBoxes = useLocalQuery('productionBoxes', { job: jobId });
  const productionPortions = useLocalQuery('productionPortions', { job: jobId });
  const productionGiblets = useLocalQuery('productionGiblets', { job: jobId });

  const customer = useMemo(() => {
    if (!job) return null;
    const cid = typeof job.customer === 'object' ? job.customer?._id : job.customer;
    return businesses.find((b) => b._id === cid) || null;
  }, [job, businesses]);

  const liveStatus = useMemo(
    () => deriveJobStatus({
      job,
      truckEntries,
      productionBoxes,
      productionPortions,
      productionGiblets,
    }),
    [job, truckEntries, productionBoxes, productionPortions, productionGiblets],
  );

  const recon = useMemo(
    () => computeReconciliation({
      truckEntries,
      productionBoxes,
      productionPortions,
      productionGiblets,
    }),
    [truckEntries, productionBoxes, productionPortions, productionGiblets],
  );

  if (!job) {
    return (
      <div className="flex-1 flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" aria-hidden />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 pt-6 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1.5">
            <JobStatusBadge status={liveStatus} />
            <h3 className="text-sm font-semibold truncate">{job.jobNumber || '—'}</h3>
            <p className="text-xs text-muted-foreground">{fmtDate(job.openedAt)}</p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0 mt-1">
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => onEdit?.(job)} title={t('common.edit')}>
              <Pencil className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <Separator />

      <div className="flex-1 overflow-y-auto">
        <div className="px-6 py-4 space-y-4 overflow-hidden">
          {customer ? (
            <button
              type="button"
              onClick={() => {
                onClose?.();
                navigate(`/dashboard/directory/businesses/${customer._id}`);
              }}
              className={PARTY_CLS}
            >
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-0.5">
                {t('processingJobs.customer', 'Customer')}
              </p>
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold truncate flex items-center gap-1">
                  <Building2 className="h-3.5 w-3.5 shrink-0" />
                  {customer.companyName}
                </span>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
              </div>
            </button>
          ) : null}

          <div className={CARD_CLS}>
            <div className="px-3 py-2.5 space-y-0.5">
              <Row label={t('reconciliation.expected', 'Expected')} value={fmtInt(recon.expectedQty)} bold />
              <Row label={t('reconciliation.lossesSubtotal', 'Losses')} value={`-${fmtInt(recon.losses)}`} negative={recon.losses > 0} />
              <Row label={t('reconciliation.netToLine', 'Net to line')} value={fmtInt(recon.netToLine)} />
              <Row label={t('reconciliation.produced', 'Produced')} value={fmtInt(recon.wholeBirdsPacked)} bold />
              <Row label={t('reconciliation.balance', 'Balance')} value={fmtInt(recon.variance)} negative={!recon.isBalanced} />
              {recon.avgDressedKg != null ? (
                <Row label={t('reconciliation.yieldAvgDressedKg', 'Avg dressed weight')} value={`${fmtKg(recon.avgDressedKg)} kg`} />
              ) : null}
            </div>
          </div>

          {job.notes ? (
            <div className="rounded-md bg-muted/30 border px-3 py-2.5">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">{t('common.notes', 'Notes')}</p>
              <p className="text-sm whitespace-pre-wrap">{job.notes}</p>
            </div>
          ) : null}

          <p className="text-xs text-muted-foreground text-center pt-1 pb-2">
            {t('common.createdAt', 'Created')} {fmtDate(job.createdAt)}
            {' · '}
            {t('common.updatedAt', 'Updated')} {fmtDate(job.updatedAt)}
          </p>
        </div>
      </div>
    </div>
  );
}
