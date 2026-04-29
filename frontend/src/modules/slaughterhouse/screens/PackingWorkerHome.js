import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Boxes, ClipboardList } from 'lucide-react';
import useLocalQuery from '@/hooks/useLocalQuery';
import RoleHomeShell from './RoleHomeShell';

// Packing worker: jobs that are READY (all trucks unloaded) or already
// in PACKING but not yet packed-complete. Tap to open the production
// tab where the worker logs boxes / portions / giblets.
export default function PackingWorkerHome() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const jobs = useLocalQuery('processingJobs');
  const businesses = useLocalQuery('businesses');

  const businessesById = useMemo(
    () => Object.fromEntries(businesses.map((b) => [b._id, b])),
    [businesses],
  );

  const active = useMemo(
    () => jobs
      .filter((j) => !j.deletedAt)
      .filter((j) => ['READY', 'PACKING', 'UNLOADING'].includes(j.status || 'NEW'))
      .sort((a, b) => new Date(a.openedAt || 0) - new Date(b.openedAt || 0)),
    [jobs],
  );

  const items = active.map((j) => {
    const customer = businessesById[typeof j.customer === 'object' ? j.customer?._id : j.customer];
    return {
      key: j._id,
      icon: Boxes,
      primary: j.jobNumber || t('processingJobs.jobNumber', 'Job'),
      secondary: [
        customer?.companyName,
        t(`processingJobs.statuses.${j.status}`, j.status),
      ].filter(Boolean).join(' · '),
      onClick: () => navigate(`/dashboard/processing-jobs/${j._id}/production`),
    };
  });

  return (
    <RoleHomeShell
      title={t('production.title', 'Production')}
      subtitle={t('dashboard.packingSubtitle', 'Jobs ready for packing.')}
      items={items}
      emptyState={{
        icon: ClipboardList,
        title: t('processingJobs.noJobs', 'No processing jobs yet'),
        description: t('dashboard.packingNoJobs', 'Wait for the line to call your station.'),
      }}
    />
  );
}
