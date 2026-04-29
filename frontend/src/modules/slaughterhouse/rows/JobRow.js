import { useTranslation } from 'react-i18next';
import { Truck, Building2 } from 'lucide-react';
import EntityRowBase from '@/shared/rows/EntityRowBase';
import JobStatusBadge from '@/modules/slaughterhouse/components/JobStatusBadge';

const fmt = (val) => Number(val || 0).toLocaleString('en-US');

// List-row for processingJobs. Mirrors SaleRow shape (EntityRowBase
// shell + flex row of status chip / customer / counts on the trailing
// edge) so the list page reads consistently with the rest of the app.
export default function JobRow({ job, customer, truckCount = 0, totalExpected = 0, onClick, selected, actions }) {
  const { t } = useTranslation();

  return (
    <EntityRowBase onClick={onClick} selected={selected} actions={actions}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <p className="font-medium truncate">
            {job.jobNumber || t('processingJobs.jobNumber', 'Job')}
          </p>
          <JobStatusBadge status={job.status || 'NEW'} />
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
          {customer?.companyName ? (
            <span className="flex items-center gap-1 truncate">
              <Building2 className="h-3 w-3 shrink-0" />
              <span className="truncate">{customer.companyName}</span>
            </span>
          ) : null}
          {job.openedAt ? (
            <span className="tabular-nums shrink-0">
              {new Date(job.openedAt).toLocaleDateString('en-US')}
            </span>
          ) : null}
        </div>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-sm font-medium tabular-nums">
          {fmt(totalExpected)} <span className="text-muted-foreground text-xs">{t('processingJobs.expectedBirds', 'expected').toLowerCase()}</span>
        </p>
        <div className="flex items-center justify-end gap-2 text-[10px] text-muted-foreground tabular-nums">
          <span className="flex items-center gap-0.5">
            <Truck className="h-2.5 w-2.5" />
            {truckCount}
          </span>
        </div>
      </div>
    </EntityRowBase>
  );
}
