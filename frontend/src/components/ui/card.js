import * as React from 'react';
import { cn } from '@/lib/utils';
import { Eyebrow } from '@/components/ui/eyebrow';

// Atom-level <Card> ported from mobile/docs/DESIGN_LANGUAGE.md §2 / §6
// (SheetSection). Visual recipe:
//   - rounded-2xl (16pt) — one notch under the mobile 18pt because desktop
//     cards are wider; the same radius would read soft-bubblegum at 600pt+.
//   - Mandatory border-sectionBorder in BOTH themes. The mobile doc is firm
//     on this (§2 lightness ladder rule) — without an explicit border the
//     card bleeds into the page in dark mode (only ~5% L gap from screen)
//     and the light-mode `shadow-sm` alone is too quiet to carry the edge
//     against an off-white background.
//   - Soft 0.04 shadow in light mode, no shadow in dark — depth is carried
//     by the border on dark and shared between border + shadow on light.
const Card = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      'rounded-2xl border border-sectionBorder bg-card text-card-foreground',
      'shadow-[0_1px_8px_rgba(15,31,16,0.04)] dark:shadow-none',
      className,
    )}
    {...props}
  />
));
Card.displayName = 'Card';

// CardHeader accepts an optional `eyebrow` prop that renders the uppercase
// section label above the title. Backwards compatible — call sites that
// don't pass it look identical to the previous shadcn CardHeader.
const CardHeader = React.forwardRef(({ className, eyebrow, children, ...props }, ref) => (
  <div ref={ref} className={cn('flex flex-col space-y-1.5 p-6', className)} {...props}>
    {eyebrow ? <Eyebrow className="mb-1">{eyebrow}</Eyebrow> : null}
    {children}
  </div>
));
CardHeader.displayName = 'CardHeader';

// Drop the old `text-2xl` default — at desktop sizes it dominates the card
// and competes with page-level headings. text-lg + SemiBold reads as "card
// title" without shouting, matches the mobile SheetSection title in spirit.
const CardTitle = React.forwardRef(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn('text-lg font-semibold leading-tight tracking-tight', className)}
    {...props}
  />
));
CardTitle.displayName = 'CardTitle';

const CardDescription = React.forwardRef(({ className, ...props }, ref) => (
  <p ref={ref} className={cn('text-sm text-muted-foreground', className)} {...props} />
));
CardDescription.displayName = 'CardDescription';

const CardContent = React.forwardRef(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('p-6 pt-0', className)} {...props} />
));
CardContent.displayName = 'CardContent';

const CardFooter = React.forwardRef(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('flex items-center p-6 pt-0', className)} {...props} />
));
CardFooter.displayName = 'CardFooter';

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent };
