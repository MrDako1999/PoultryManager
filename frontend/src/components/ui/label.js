import * as React from 'react';
import * as LabelPrimitive from '@radix-ui/react-label';
import { cva } from 'class-variance-authority';
import { cn } from '@/lib/utils';

// 13pt Medium per mobile/docs/DESIGN_LANGUAGE.md §3 typography table.
// Bumped down from shadcn's default 14pt — at desktop sizes the 14pt
// label competes visually with the 14pt input value text. 13pt creates
// the "label is ancillary, input is primary" hierarchy the mobile field
// labels achieve.
const labelVariants = cva(
  'text-[13px] font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
);

const Label = React.forwardRef(({ className, ...props }, ref) => (
  <LabelPrimitive.Root ref={ref} className={cn(labelVariants(), className)} {...props} />
));
Label.displayName = LabelPrimitive.Root.displayName;

export { Label };
