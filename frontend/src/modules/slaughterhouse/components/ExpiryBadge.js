import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { expiryStatus } from '@/modules/slaughterhouse/lib/expiry';

// Reuses the existing Badge primitive (per plan §0.1) with a tone
// chosen by expiry urgency. No new badge component invented; this is
// just a thin wrapper that picks the right variant + label.
export default function ExpiryBadge({ expiresAt, className }) {
  const { t } = useTranslation();
  const status = expiryStatus(expiresAt);
  if (status === 'none') return null;

  const variant = status === 'expired' || status === 'critical' ? 'destructive'
    : status === 'soon' ? 'secondary'
      : 'outline';

  return (
    <Badge variant={variant} className={cn('text-[10px] px-1.5 py-0', className)}>
      {t(`stock.expiry.${status}`, status)}
    </Badge>
  );
}
