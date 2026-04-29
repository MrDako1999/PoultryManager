import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Truck, Building2, ChevronRight, Bird } from 'lucide-react';
import { cn } from '@/lib/utils';
import JobStatusBadge from './JobStatusBadge';

const fmtInt = (val) => Number(val || 0).toLocaleString('en-US');

// Web mirror of broiler's BatchCard recipe — elevated card shell,
// avatar tile, name + meta, trailing chevron in compact variant.
// Adapted to the slaughterhouse domain: shows customer + truck count
// + expected birds rather than farm + flock + mortality.
//
// Two visual variants:
//   default — dashboard "Live Line" style: status pin avatar + meta.
//   compact — list rows: same anatomy, denser, trailing chevron.
export default function JobCard({
  job,
  customer,
  truckCount = 0,
  totalExpected = 0,
  variant = 'default',
  onClick,
}) {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const handleClick = onClick || (() => navigate(`/dashboard/processing-jobs/${job._id}`));
  const isCompact = variant === 'compact';

  // Avatar letter — first letter of customer companyName or job number.
  const avatar = useMemo(() => {
    const source = customer?.companyName || job?.jobNumber || '?';
    return source[0]?.toUpperCase() || '?';
  }, [customer, job]);

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        'group block w-full rounded-2xl border text-start transition-colors',
        'border-elevatedCard-border bg-elevatedCard',
        'hover:border-accentStrong/40 hover:bg-elevatedCard-pressed/60',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        'shadow-[0_2px_10px_rgba(15,31,16,0.05)] dark:shadow-none',
        isCompact ? 'p-3' : 'p-3.5',
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className="relative shrink-0"
          style={{ width: isCompact ? 36 : 40, height: isCompact ? 36 : 40 }}
        >
          <div
            className="flex items-center justify-center rounded-xl bg-destructive/10"
            style={{ width: isCompact ? 36 : 40, height: isCompact ? 36 : 40 }}
          >
            <span className="font-heading font-bold text-destructive leading-none text-sm">
              {avatar}
            </span>
          </div>
          <JobStatusBadge
            status={job.status || 'NEW'}
            variant="pin"
            className="absolute -bottom-1 -right-1 ring-2 ring-elevatedCard"
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-semibold leading-tight text-foreground truncate">
            {job.jobNumber || t('processingJobs.jobNumber', 'Job')}
          </div>
          {customer?.companyName ? (
            <div className="mt-1 flex items-center gap-1 text-[12px] text-muted-foreground">
              <Building2 className="h-3 w-3 shrink-0" strokeWidth={2.2} aria-hidden="true" />
              <span className="truncate">{customer.companyName}</span>
            </div>
          ) : null}
          <div className="mt-1 flex flex-wrap items-center gap-x-2 text-[12px] tabular-nums text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Truck className="h-3 w-3" strokeWidth={2.2} aria-hidden="true" />
              {fmtInt(truckCount)}
            </span>
            <span aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1">
              <Bird className="h-3 w-3" strokeWidth={2.2} aria-hidden="true" />
              {fmtInt(totalExpected)}
            </span>
          </div>
        </div>

        {isCompact ? (
          <ChevronRight
            className="ms-1 mt-2 h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 rtl:rotate-180"
            strokeWidth={2.2}
            aria-hidden="true"
          />
        ) : null}
      </div>
    </button>
  );
}
