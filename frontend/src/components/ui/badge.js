import * as React from 'react';
import { cva } from 'class-variance-authority';
import { cn } from '@/lib/utils';

// Atom-level <Badge> ported from mobile/docs/DESIGN_LANGUAGE.md §8.d.
//
// Visual recipe:
//   - Full pill (rounded-full).
//   - 11pt SemiBold uppercase label, 0.04em tracking — the mobile spec.
//     Replaces shadcn's default 12pt SemiBold mixed-case so pills stop
//     reading as miniature buttons and start reading as labels.
//   - Padding stays at px-2.5 py-0.5 so existing layouts don't shift.
//
// Colour variants:
//   - success / warning / info — brand-aligned semantic tokens defined in
//     index.css. Replaces the per-component amber-100 / emerald-100 / etc.
//     literals scattered through the dashboard.
//   - default / secondary / destructive / outline — kept for callers that
//     want the older flat fills (auto-generated badges, "owner" pills, etc.).
const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.04em] transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground hover:bg-primary/80',
        secondary: 'border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80',
        destructive: 'border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80',
        outline: 'text-foreground',
        success: 'border-transparent bg-success-bg text-success',
        warning: 'border-transparent bg-warning-bg text-warning',
        info: 'border-transparent bg-info-bg text-info',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

function Badge({ className, variant, ...props }) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
