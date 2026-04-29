import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Eyebrow } from '@/components/ui/eyebrow';
import { ChevronRight, Truck, Boxes, CheckCheck, ClipboardList } from 'lucide-react';
import useLocalQuery from '@/hooks/useLocalQuery';
import useSlaughterhouseDashboardStats from './useSlaughterhouseDashboardStats';
import JobCard from '@/modules/slaughterhouse/components/JobCard';

const fmtInt = (v) => Number(v || 0).toLocaleString('en-US');

// "Live Line" widget — mirrors BroilerActiveBatches pattern: an
// Eyebrow + card stack with 2pt rounded dividers between entries.
// Shows queued / on-line / done-today summary then an "active jobs"
// list of JobCards.
export default function LiveLineWidget() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const { liveLine } = useSlaughterhouseDashboardStats('today');
  const businesses = useLocalQuery('businesses');
  const truckEntries = useLocalQuery('truckEntries');

  const businessesById = Object.fromEntries(businesses.map((b) => [b._id, b]));

  const trucksByJobId = {};
  for (const tr of truckEntries) {
    if (tr.deletedAt) continue;
    const jid = typeof tr.job === 'object' ? tr.job?._id : tr.job;
    if (!jid) continue;
    if (!trucksByJobId[jid]) trucksByJobId[jid] = { count: 0, totalExpected: 0 };
    trucksByJobId[jid].count += 1;
    trucksByJobId[jid].totalExpected += Number(tr.expectedQty) || 0;
  }

  const stats = [
    { icon: Truck, label: t('dashboard.queued', 'Queued'), value: liveLine.queued.length },
    { icon: Boxes, label: t('dashboard.onLine', 'On Line'), value: liveLine.onLine.length },
    { icon: CheckCheck, label: t('dashboard.doneToday', 'Done today'), value: liveLine.doneToday.length },
  ];

  const activeJobs = [...liveLine.queued, ...liveLine.onLine].slice(0, 6);

  if (activeJobs.length === 0) {
    return (
      <section>
        <Eyebrow className="mb-2 ms-1.5">
          {t('dashboard.liveLineTitle', 'Live Line')}
        </Eyebrow>
        <Card>
          <CardContent className="py-12 text-center">
            <div className="mx-auto mb-4 inline-flex rounded-full bg-muted p-4">
              <ClipboardList className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="mb-1 text-lg font-semibold">
              {t('processingJobs.noJobs', 'No processing jobs yet')}
            </h3>
            <p className="mx-auto mb-4 max-w-sm text-sm text-muted-foreground">
              {t('processingJobs.noJobsDesc', 'Create your first job when a truck arrives at the gate.')}
            </p>
          </CardContent>
        </Card>
      </section>
    );
  }

  return (
    <section>
      <Eyebrow className="mb-2 ms-1.5">{t('dashboard.liveLineTitle', 'Live Line')}</Eyebrow>

      <Card>
        <CardContent className="p-0 divide-y">
          {stats.map(({ icon: Icon, label, value }) => (
            <button
              key={label}
              type="button"
              onClick={() => navigate('/dashboard/processing-jobs')}
              className="flex w-full items-center gap-3 px-4 py-3 hover:bg-accent/50 transition-colors text-left"
            >
              <Icon className="h-4 w-4 text-muted-foreground" />
              <span className="flex-1 text-sm">{label}</span>
              <span className="text-sm font-semibold tabular-nums">{fmtInt(value)}</span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          ))}
        </CardContent>
      </Card>

      <div className="mt-3">
        {activeJobs.map((j, idx) => {
          const customerId = typeof j.customer === 'object' ? j.customer?._id : j.customer;
          const customer = businessesById[customerId];
          const summary = trucksByJobId[j._id] || { count: 0, totalExpected: 0 };
          return (
            <div key={j._id}>
              {idx > 0 ? (
                <div
                  aria-hidden="true"
                  className="mx-1 my-3 h-0.5 rounded-full bg-elevatedCard-border"
                />
              ) : null}
              <JobCard
                job={j}
                customer={customer}
                truckCount={summary.count}
                totalExpected={summary.totalExpected}
              />
            </div>
          );
        })}
      </div>
    </section>
  );
}
