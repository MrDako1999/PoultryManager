import * as React from 'react';
import { cn } from '@/lib/utils';

// The defining mobile signal — the uppercase 11pt SemiBold "section title"
// label that sits above every SheetSection on mobile (mobile/docs/DESIGN_LANGUAGE.md
// §3 typography table). Web equivalent so dashboard cards and page titles can
// pick up the same eyebrow rhythm without each caller hand-rolling its own
// `text-xs uppercase tracking-wider` recipe.
const Eyebrow = React.forwardRef(({ className, as: Tag = 'span', ...props }, ref) => (
  <Tag
    ref={ref}
    className={cn(
      'block text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground',
      className,
    )}
    {...props}
  />
));
Eyebrow.displayName = 'Eyebrow';

export { Eyebrow };
export default Eyebrow;
