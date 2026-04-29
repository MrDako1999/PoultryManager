import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Snowflake, AlertTriangle } from 'lucide-react';
import useLocalQuery from '@/hooks/useLocalQuery';
import RoleHomeShell from './RoleHomeShell';
import { expiryStatus } from '@/modules/slaughterhouse/lib/expiry';
import { formatBandLabel } from '@/modules/slaughterhouse/lib/defaultWeightBands';

const fmtKg = (v) => Number(v || 0).toLocaleString('en-US', {
  minimumFractionDigits: 2, maximumFractionDigits: 2,
});

// Cold-store user: stock units approaching expiry first, plus a
// quick-jump to the global cold store. Surfaces critical items
// (<24h) at the top so damaged-goods marking is one tap away.
export default function ColdStoreHome() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const stockUnits = useLocalQuery('stockUnits');

  const urgent = useMemo(
    () => stockUnits
      .filter((u) => !u.deletedAt && (Number(u.qtyAvailable) || 0) > 0)
      .filter((u) => {
        const s = expiryStatus(u.expiresAt);
        return s === 'expired' || s === 'critical' || s === 'soon';
      })
      .sort((a, b) => new Date(a.expiresAt || 0) - new Date(b.expiresAt || 0))
      .slice(0, 30),
    [stockUnits],
  );

  const items = urgent.map((u) => {
    const sourceLabel = u.sourceType === 'box'
      ? formatBandLabel(u.weightBandGrams)
      : t(`production.partTypes.${u.partType}`, u.partType || u.sourceType);
    const status = expiryStatus(u.expiresAt);
    return {
      key: u._id,
      icon: status === 'expired' || status === 'critical' ? AlertTriangle : Snowflake,
      primary: sourceLabel,
      secondary: `${fmtKg(u.weightKg)} kg · ${t(`stock.expiry.${status}`, status)}`,
      onClick: () => navigate('/dashboard/cold-store'),
    };
  });

  return (
    <RoleHomeShell
      title={t('stock.title', 'Cold Store')}
      subtitle={t('dashboard.coldStoreSubtitle', 'Items approaching expiry first.')}
      items={items}
      emptyState={{
        icon: Snowflake,
        title: t('stock.noStock', 'No stock on hand'),
        description: t('dashboard.coldStoreEmpty', 'Cold store is clean — nothing is close to expiring.'),
      }}
    />
  );
}
