import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Plus, Truck } from 'lucide-react';
import useLocalQuery from '@/hooks/useLocalQuery';
import RoleHomeShell from './RoleHomeShell';
import HandoverSheet from '@/modules/slaughterhouse/sheets/HandoverSheet';

const fmtKg = (v) => Number(v || 0).toLocaleString('en-US', {
  minimumFractionDigits: 2, maximumFractionDigits: 2,
});

// Dispatch user: today's outbound handovers + giant "+ New Handover"
// CTA. Tapping a handover row reopens it for review.
export default function DispatchHome() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [sheetOpen, setSheetOpen] = useState(false);

  const handovers = useLocalQuery('handovers');
  const businesses = useLocalQuery('businesses');

  const businessesById = useMemo(
    () => Object.fromEntries(businesses.map((b) => [b._id, b])),
    [businesses],
  );

  const todays = useMemo(() => {
    const todayKey = new Date().toDateString();
    return handovers
      .filter((h) => !h.deletedAt)
      .filter((h) => h.dispatchedAt && new Date(h.dispatchedAt).toDateString() === todayKey)
      .sort((a, b) => new Date(b.dispatchedAt) - new Date(a.dispatchedAt));
  }, [handovers]);

  const items = todays.map((h) => {
    const customer = businessesById[typeof h.customer === 'object' ? h.customer?._id : h.customer];
    return {
      key: h._id,
      icon: Truck,
      primary: h.vehiclePlate || '—',
      secondary: [
        customer?.companyName,
        h.totals?.totalKg != null ? `${fmtKg(h.totals.totalKg)} kg` : null,
      ].filter(Boolean).join(' · '),
      onClick: () => navigate('/dashboard/handovers'),
    };
  });

  return (
    <>
      <RoleHomeShell
        title={t('handovers.title', 'Handovers')}
        subtitle={t('dashboard.dispatchSubtitle', 'Today\'s outbound dispatches.')}
        primaryAction={{
          label: t('handovers.newHandover', 'New Handover'),
          icon: Plus,
          onClick: () => setSheetOpen(true),
        }}
        items={items}
        emptyState={{
          icon: Truck,
          title: t('handovers.noHandovers', 'No handovers yet'),
          description: t('handovers.noHandoversDesc', 'Create a handover when a wholesaler arrives to collect product.'),
          cta: { label: t('handovers.newHandover', 'New Handover'), icon: Plus, onClick: () => setSheetOpen(true) },
        }}
      />
      <HandoverSheet open={sheetOpen} onOpenChange={setSheetOpen} />
    </>
  );
}
