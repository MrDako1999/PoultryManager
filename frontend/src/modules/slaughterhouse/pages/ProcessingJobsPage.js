import { useState, useMemo, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Plus, ClipboardList, Search,
} from 'lucide-react';
import PageTitle from '@/components/ui/page-title';
import useLocalQuery from '@/hooks/useLocalQuery';
import useCapabilities from '@/hooks/useCapabilities';
import usePersistedState from '@/hooks/usePersistedState';
import EnumButtonSelect from '@/components/EnumButtonSelect';
import JobRow from '@/modules/slaughterhouse/rows/JobRow';
import NewJobSheet from '@/modules/slaughterhouse/sheets/NewJobSheet';
import { JOB_STATUSES } from '@/modules/slaughterhouse/lib/jobStatus';

const FILTER_STATUSES = ['ALL', ...JOB_STATUSES];

// Mirrors BatchesPage.js — search + status filter + persisted state +
// empty-state Card + create sheet trigger. Slaughterhouse-specific
// filtering: a status enum chip strip (NEW / UNLOADING / PACKING /
// PACKED / AWAITING_APPROVAL / COMPLETE) plus full-text search across
// job number, customer name, supplier name and truck plate.
export default function ProcessingJobsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { can } = useCapabilities();
  const canCreate = can('processingJob:create');

  const [sheetOpen, setSheetOpen] = useState(false);
  const [didAutoOpen, setDidAutoOpen] = useState(false);
  const [search, setSearch] = usePersistedState('slaughter-jobs-search', '');
  const [statusFilter, setStatusFilter] = usePersistedState('slaughter-jobs-status', 'ALL');

  // Auto-open the create sheet when navigated here with state.openNew
  // (mirrors the broiler dashboard "+ New Batch" button hand-off).
  useEffect(() => {
    if (!didAutoOpen && location.state?.openNew && canCreate) {
      setSheetOpen(true);
      setDidAutoOpen(true);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, didAutoOpen, canCreate, navigate, location.pathname]);

  const allJobs = useLocalQuery('processingJobs');
  const allTruckEntries = useLocalQuery('truckEntries');
  const businesses = useLocalQuery('businesses');

  const businessesById = useMemo(
    () => Object.fromEntries(businesses.map((b) => [b._id, b])),
    [businesses],
  );

  // Pre-aggregate truck-count + total-expected per job so each row
  // doesn't re-walk truckEntries (O(N*M) -> O(N)).
  const trucksByJobId = useMemo(() => {
    const acc = {};
    for (const tr of allTruckEntries) {
      if (tr.deletedAt) continue;
      const jid = typeof tr.job === 'object' ? tr.job?._id : tr.job;
      if (!jid) continue;
      if (!acc[jid]) acc[jid] = { count: 0, totalExpected: 0 };
      acc[jid].count += 1;
      acc[jid].totalExpected += Number(tr.expectedQty) || 0;
    }
    return acc;
  }, [allTruckEntries]);

  const filtered = useMemo(() => {
    let list = allJobs.filter((j) => !j.deletedAt);

    if (statusFilter && statusFilter !== 'ALL') {
      list = list.filter((j) => (j.status || 'NEW') === statusFilter);
    }

    if (search) {
      const needle = search.toLowerCase();
      list = list.filter((j) => {
        const customer = businessesById[typeof j.customer === 'object' ? j.customer?._id : j.customer];
        const customerName = customer?.companyName?.toLowerCase() || '';
        const jobNumber = (j.jobNumber || '').toLowerCase();
        if (jobNumber.includes(needle)) return true;
        if (customerName.includes(needle)) return true;
        // Search across supplier names and vehicle plates of trucks
        // attached to the job.
        const trucks = allTruckEntries.filter((tr) => {
          if (tr.deletedAt) return false;
          const jid = typeof tr.job === 'object' ? tr.job?._id : tr.job;
          return jid === j._id;
        });
        for (const tr of trucks) {
          if ((tr.vehiclePlate || '').toLowerCase().includes(needle)) return true;
          const sId = typeof tr.supplier === 'object' ? tr.supplier?._id : tr.supplier;
          const sup = businessesById[sId];
          if (sup?.companyName?.toLowerCase().includes(needle)) return true;
        }
        return false;
      });
    }

    return list.sort((a, b) => {
      const aT = a.openedAt ? new Date(a.openedAt).getTime() : 0;
      const bT = b.openedAt ? new Date(b.openedAt).getTime() : 0;
      return bT - aT;
    });
  }, [allJobs, statusFilter, search, businessesById, allTruckEntries]);

  const statusOptions = useMemo(
    () => FILTER_STATUSES.map((s) => ({
      value: s,
      label: s === 'ALL' ? t('processingJobs.filterAll', 'All') : t(`processingJobs.statuses.${s}`, s),
    })),
    [t],
  );

  return (
    <div className="space-y-4">
      <PageTitle
        title={t('processingJobs.title', 'Processing Jobs')}
        subtitle={t('processingJobs.subtitle', 'Manage live-bird intake, processing and packing reports')}
        actions={canCreate && (
          <Button size="sm" className="gap-1.5" onClick={() => setSheetOpen(true)}>
            <Plus className="h-3.5 w-3.5" />
            {t('processingJobs.newJob', 'New Job')}
          </Button>
        )}
      />

      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('processingJobs.searchPlaceholder', 'Search by job number, customer or supplier…')}
            className="pl-8 h-9 bg-white dark:bg-card"
          />
        </div>

        <EnumButtonSelect
          options={statusOptions}
          value={statusFilter}
          onChange={setStatusFilter}
          columns={statusOptions.length}
          compact
        />
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <div className="mx-auto mb-4 inline-flex rounded-full bg-muted p-4">
              <ClipboardList className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="mb-1 text-lg font-semibold">
              {search || statusFilter !== 'ALL'
                ? t('processingJobs.noJobsFiltered', 'No jobs match your filters')
                : t('processingJobs.noJobs', 'No processing jobs yet')}
            </h3>
            <p className="mx-auto mb-4 max-w-sm text-sm text-muted-foreground">
              {t('processingJobs.noJobsDesc', 'Create your first job when a truck arrives at the gate.')}
            </p>
            {canCreate && !search && statusFilter === 'ALL' ? (
              <Button size="sm" className="gap-1.5" onClick={() => setSheetOpen(true)}>
                <Plus className="h-3.5 w-3.5" />
                {t('processingJobs.addFirstJob', 'Create First Job')}
              </Button>
            ) : null}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0 divide-y">
            {filtered.map((job) => {
              const customerId = typeof job.customer === 'object' ? job.customer?._id : job.customer;
              const customer = businessesById[customerId];
              const summary = trucksByJobId[job._id] || { count: 0, totalExpected: 0 };
              return (
                <JobRow
                  key={job._id}
                  job={job}
                  customer={customer}
                  truckCount={summary.count}
                  totalExpected={summary.totalExpected}
                  onClick={() => navigate(`/dashboard/processing-jobs/${job._id}`)}
                />
              );
            })}
          </CardContent>
        </Card>
      )}

      <NewJobSheet open={sheetOpen} onOpenChange={setSheetOpen} />
    </div>
  );
}
