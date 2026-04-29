import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import useThemeStore from '@/stores/themeStore';
import { getStatusConfig } from '@/modules/slaughterhouse/lib/jobStatus';

// Inline status chip for processing jobs. Reuses the STATUS_CONFIG
// shape from broiler so the visual recipe is unchanged: small pill with
// background + icon coloured per status, label in the same tone.
//
// Two visual variants:
//   default — pill with full background tint, icon+label
//   pin     — round pin with just the icon (used by avatars/cards)
export default function JobStatusBadge({ status, variant = 'default', className }) {
  const { t } = useTranslation();
  const { resolvedTheme } = useThemeStore();
  const dark = resolvedTheme === 'dark';
  const cfg = getStatusConfig(status);
  const Icon = cfg.icon;
  const bg = dark ? cfg.pinBgDark : cfg.pinBgLight;

  if (variant === 'pin') {
    return (
      <span
        aria-hidden="true"
        className={cn(
          'inline-flex h-5 w-5 items-center justify-center rounded-full',
          className,
        )}
        style={{ backgroundColor: bg }}
      >
        <Icon className="h-3 w-3" style={{ color: cfg.iconColor }} strokeWidth={2.5} />
      </span>
    );
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
        className,
      )}
      style={{ backgroundColor: bg, color: cfg.iconColor }}
    >
      <Icon className="h-3 w-3" strokeWidth={2.5} />
      {t(`processingJobs.statuses.${status}`, status)}
    </span>
  );
}
