import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Truck, ClipboardCheck } from 'lucide-react';
import useLocalQuery from '@/hooks/useLocalQuery';
import RoleHomeShell from './RoleHomeShell';

// Receiving worker: trucks awaiting sortation. A truck is "awaiting"
// if it has been logged but has zero sortation entries OR an
// unloadingStartedAt that hasn't been completed.
export default function ReceivingWorkerHome() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const truckEntries = useLocalQuery('truckEntries');
  const businesses = useLocalQuery('businesses');

  const businessesById = useMemo(
    () => Object.fromEntries(businesses.map((b) => [b._id, b])),
    [businesses],
  );

  const awaiting = useMemo(() => {
    return truckEntries
      .filter((tr) => !tr.deletedAt)
      .filter((tr) => {
        const s = tr.sortation || {};
        const noSortation = !((Number(s.doa) || 0) || (Number(s.condemnation) || 0)
          || (Number(s.bGrade) || 0) || (Number(s.shortage) || 0));
        return tr.status !== 'READY' && (noSortation || !tr.unloadingCompletedAt);
      })
      .sort((a, b) => new Date(a.arrivedAt || 0) - new Date(b.arrivedAt || 0));
  }, [truckEntries]);

  const items = awaiting.map((tr) => {
    const supplier = businessesById[typeof tr.supplier === 'object' ? tr.supplier?._id : tr.supplier];
    const jobId = typeof tr.job === 'object' ? tr.job?._id : tr.job;
    return {
      key: tr._id,
      icon: Truck,
      primary: tr.vehiclePlate || '—',
      secondary: [
        supplier?.companyName,
        t(`trucks.statuses.${tr.status}`, tr.status),
      ].filter(Boolean).join(' · '),
      onClick: () => navigate(`/dashboard/processing-jobs/${jobId}/sortation/${tr._id}`),
    };
  });

  return (
    <RoleHomeShell
      title={t('sortation.title', 'Sortation')}
      subtitle={t('dashboard.receivingSubtitle', 'Trucks awaiting sortation.')}
      items={items}
      emptyState={{
        icon: ClipboardCheck,
        title: t('sortation.noSortation', 'No sortation logged yet'),
        description: t('dashboard.allCaughtUp', "All caught up — no trucks waiting to be sorted."),
      }}
    />
  );
}
