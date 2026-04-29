import { useState, useMemo } from 'react';
import { Outlet, useParams, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Tabs, TabsList, TabsTrigger,
} from '@/components/ui/tabs';
import ScrollableTabs from '@/components/ui/scrollable-tabs';
import { Button } from '@/components/ui/button';
import {
  ArrowLeft, ClipboardList, Trash2, Building2,
} from 'lucide-react';
import {
  Tooltip, TooltipContent, TooltipTrigger,
} from '@/components/ui/tooltip';
import Breadcrumb from '@/components/Breadcrumb';
import ConfirmDeleteDialog from '@/components/ConfirmDeleteDialog';
import { useToast } from '@/components/ui/use-toast';
import useLocalRecord from '@/hooks/useLocalRecord';
import useLocalQuery from '@/hooks/useLocalQuery';
import useOfflineMutation from '@/hooks/useOfflineMutation';
import JobStatusBadge from '@/modules/slaughterhouse/components/JobStatusBadge';
import {
  STATUS_CONFIG, getStatusConfig, deriveJobStatus,
} from '@/modules/slaughterhouse/lib/jobStatus';

const SEGMENT_LABELS = {
  sortation: 'processingJobs.tabs.sortation',
  production: 'processingJobs.tabs.production',
  stock: 'processingJobs.tabs.stock',
  reconciliation: 'processingJobs.tabs.reconciliation',
  invoice: 'processingJobs.tabs.invoice',
};

const TAB_KEYS = ['sortation', 'production', 'stock', 'reconciliation', 'invoice'];

// Mirrors BatchDetailLayout — top-level shell for a processingJob with
// a status header, tabs, and an outlet for child views. Status is
// derived live from child rows so the chip always reflects reality
// even when the cached job.status hasn't been re-saved yet.
export default function JobDetailLayout() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const { toast } = useToast();

  const job = useLocalRecord('processingJobs', id);
  const truckEntries = useLocalQuery('truckEntries', { job: id });
  const productionBoxes = useLocalQuery('productionBoxes', { job: id });
  const productionPortions = useLocalQuery('productionPortions', { job: id });
  const productionGiblets = useLocalQuery('productionGiblets', { job: id });
  const businesses = useLocalQuery('businesses');

  const [deleteOpen, setDeleteOpen] = useState(false);

  const { mutate: deleteJob, isPending: isDeleting } = useOfflineMutation('processingJobs');

  const customer = useMemo(() => {
    if (!job) return null;
    const cid = typeof job.customer === 'object' ? job.customer?._id : job.customer;
    if (!cid) return null;
    if (typeof job.customer === 'object' && job.customer?.companyName) return job.customer;
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

  if (!job) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <ClipboardList className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-lg font-semibold mb-2">{t('processingJobs.notFound', 'Job not found')}</h2>
        <Button variant="outline" onClick={() => navigate('/dashboard/processing-jobs')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t('processingJobs.backToJobs', 'Back to Processing Jobs')}
        </Button>
      </div>
    );
  }

  const pathAfterJob = location.pathname.split(`/processing-jobs/${id}`)[1] || '';
  const segments = pathAfterJob.split('/').filter(Boolean);
  const subView = segments[0];
  const activeTab = TAB_KEYS.includes(subView) ? subView : 'trucks';

  const breadcrumbs = [
    { label: t('processingJobs.title', 'Processing Jobs'), to: '/dashboard/processing-jobs' },
    { label: job.jobNumber || t('processingJobs.jobNumber', 'Job'), to: `/dashboard/processing-jobs/${id}` },
  ];
  if (subView && SEGMENT_LABELS[subView]) {
    breadcrumbs.push({
      label: t(SEGMENT_LABELS[subView]),
      to: `/dashboard/processing-jobs/${id}/${subView}`,
    });
  }

  const status = getStatusConfig(liveStatus);
  const StatusIcon = status.icon;

  return (
    <div className="space-y-4">
      <Breadcrumb items={breadcrumbs} />

      <div className="flex items-start gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0 mt-0.5"
          onClick={() => {
            if (subView) navigate(`/dashboard/processing-jobs/${id}`);
            else navigate('/dashboard/processing-jobs');
          }}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>

        {/* Status pin avatar — visual parity with BatchDetailLayout's
            farm avatar + status pin. Background uses the slaughterhouse
            brand red tint so the icon reads as a job (vs farm) marker. */}
        <div className="relative shrink-0 mt-0.5">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-destructive/10">
            <ClipboardList className="h-5 w-5 text-destructive" />
          </div>
          <div
            className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full ring-2 ring-background"
            style={{ backgroundColor: status.pinBgLight }}
          >
            <StatusIcon className="h-3 w-3" style={{ color: status.iconColor }} />
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <h1 className="text-lg sm:text-2xl font-heading font-bold tracking-tight break-all">
              {job.jobNumber || t('processingJobs.jobNumber', 'Job')}
            </h1>
            <JobStatusBadge status={liveStatus} />
          </div>
          <div className="flex items-center gap-2 sm:gap-4 text-xs sm:text-sm text-muted-foreground mt-1 flex-wrap">
            {customer?.companyName && (
              <span className="flex items-center gap-1">
                <Building2 className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{customer.companyName}</span>
              </span>
            )}
            {job.openedAt && (
              <span className="tabular-nums whitespace-nowrap">
                {new Date(job.openedAt).toLocaleDateString('en-US')}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0 mt-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive hover:text-destructive"
                onClick={() => setDeleteOpen(true)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('common.delete')}</TooltipContent>
          </Tooltip>
        </div>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(val) => {
          if (val === 'trucks') navigate(`/dashboard/processing-jobs/${id}`);
          else navigate(`/dashboard/processing-jobs/${id}/${val}`);
        }}
      >
        <ScrollableTabs>
          <TabsList>
            <TabsTrigger value="trucks">{t('processingJobs.tabs.trucks', 'Trucks')}</TabsTrigger>
            <TabsTrigger value="sortation">{t('processingJobs.tabs.sortation', 'Sortation')}</TabsTrigger>
            <TabsTrigger value="production">{t('processingJobs.tabs.production', 'Production')}</TabsTrigger>
            <TabsTrigger value="stock">{t('processingJobs.tabs.stock', 'Stock')}</TabsTrigger>
            <TabsTrigger value="reconciliation">{t('processingJobs.tabs.reconciliation', 'Reconciliation')}</TabsTrigger>
            <TabsTrigger value="invoice">{t('processingJobs.tabs.invoice', 'Invoice')}</TabsTrigger>
          </TabsList>
        </ScrollableTabs>
      </Tabs>

      <Outlet context={{
        job,
        liveStatus,
        truckEntries,
        productionBoxes,
        productionPortions,
        productionGiblets,
      }} />

      <ConfirmDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={t('processingJobs.deleteTitle', 'Delete Job')}
        description={t('processingJobs.deleteWarning', 'This will permanently delete this job and all its trucks, sortation, production records and stock units. This action cannot be undone.')}
        onConfirm={() => deleteJob(
          { action: 'delete', id: job._id },
          {
            onSuccess: () => {
              setDeleteOpen(false);
              toast({ title: t('processingJobs.jobDeleted', 'Job deleted') });
              navigate('/dashboard/processing-jobs');
            },
          },
        )}
        isPending={isDeleting}
      />
    </div>
  );
}
