import { Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

/**
 * "Live" status pill for active modules. Inactive modules render no pill at
 * all — the dimmed icon-tile + lower opacity already convey "not yet".
 *
 * `tone="hero"` paints a translucent-white variant for use over the brand
 * gradient hero. Default tone uses theme tokens for cards on the sheet.
 *
 * `size="xs"` is used inside the radial-hub nodes; `size="sm"` is the
 * row-card default.
 */
const SIZES = {
  xs: 'px-1.5 py-[2px] text-[9px] gap-1',
  sm: 'px-2.5 py-1 text-[11px] gap-1.5',
};

export default function ModuleStatusPill({
  active,
  size = 'sm',
  tone = 'default',
  className,
}) {
  if (!active) return null;

  const { t } = useTranslation();
  const sizeClass = SIZES[size] || SIZES.sm;

  if (tone === 'hero') {
    return (
      <span className={cn(
        'inline-flex items-center rounded-full font-semibold uppercase tracking-wider',
        'bg-white text-primary',
        sizeClass,
        className,
      )}>
        <Check className="h-3 w-3" strokeWidth={3} aria-hidden="true" />
        {t('marketing.modulesHub.live')}
      </span>
    );
  }

  return (
    <span className={cn(
      'inline-flex items-center rounded-full font-semibold uppercase tracking-wider',
      'bg-primary/15 text-primary border border-primary/20',
      sizeClass,
      className,
    )}>
      <Check className="h-3 w-3" strokeWidth={3} aria-hidden="true" />
      {t('marketing.modulesHub.live')}
    </span>
  );
}
