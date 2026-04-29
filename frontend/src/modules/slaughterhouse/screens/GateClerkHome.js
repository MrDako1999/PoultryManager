import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Plus, Truck, ClipboardList } from 'lucide-react';
import useLocalQuery from '@/hooks/useLocalQuery';
import RoleHomeShell from './RoleHomeShell';
import NewJobSheet from '@/modules/slaughterhouse/sheets/NewJobSheet';

// Gate clerk: today's truck queue + giant "+ New Job" CTA so a truck
// arrival is one tap away.
export default function GateClerkHome() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [sheetOpen, setSheetOpen] = useState(false);

  const truckEntries = useLocalQuery('truckEntries');
  const jobs = useLocalQuery('processingJobs');
  const businesses = useLocalQuery('businesses');

  const businessesById = useMemo(
    () => Object.fromEntries(businesses.map((b) => [b._id, b])),
    [businesses],
  );

  const todayQueue = useMemo(() => {
    const todayKey = new Date().toDateString();
    return truckEntries
      .filter((tr) => !tr.deletedAt)
      .filter((tr) => tr.arrivedAt && new Date(tr.arrivedAt).toDateString() === todayKey)
      .sort((a, b) => new Date(b.arrivedAt) - new Date(a.arrivedAt));
  }, [truckEntries]);

  const items = todayQueue.map((tr) => {
    const job = jobs.find((j) => j._id === (typeof tr.job === 'object' ? tr.job?._id : tr.job));
    const supplier = businessesById[typeof tr.supplier === 'object' ? tr.supplier?._id : tr.supplier];
    return {
      key: tr._id,
      icon: Truck,
      primary: tr.vehiclePlate || '—',
      secondary: [
        supplier?.companyName,
        t(`trucks.statuses.${tr.status}`, tr.status),
        job?.jobNumber,
      ].filter(Boolean).join(' · '),
      onClick: () => job?._id && navigate(`/dashboard/processing-jobs/${job._id}`),
    };
  });

  return (
    <>
      <RoleHomeShell
        title={t('processingJobs.title', 'Processing Jobs')}
        subtitle={t('dashboard.gateClerkSubtitle', "Today's queue at the gate.")}
        primaryAction={{
          label: t('processingJobs.newJob', 'New Job'),
          icon: Plus,
          onClick: () => setSheetOpen(true),
        }}
        items={items}
        emptyState={{
          icon: ClipboardList,
          title: t('processingJobs.noJobs', 'No processing jobs yet'),
          description: t('processingJobs.noJobsDesc', 'Create your first job when a truck arrives at the gate.'),
          cta: { label: t('processingJobs.newJob', 'New Job'), icon: Plus, onClick: () => setSheetOpen(true) },
        }}
      />
      <NewJobSheet open={sheetOpen} onOpenChange={setSheetOpen} />
    </>
  );
}
