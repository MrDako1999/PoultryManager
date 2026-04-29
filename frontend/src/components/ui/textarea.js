import * as React from 'react';
import { cn } from '@/lib/utils';

// Same atom-level chrome as <Input> — soft-fill, 1.5pt idle/focus border,
// rounded-xl, no ring offset. min-h-[96px] gives roughly four rows at the
// 14px text size, which is the smallest size that lets a description /
// notes field breathe without dominating the form. See
// mobile/docs/DESIGN_LANGUAGE.md §6 (SheetInput).
const Textarea = React.forwardRef(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        'flex w-full rounded-xl border-[1.5px] border-inputBorderIdle bg-inputBg px-3.5 py-2.5 text-sm text-foreground transition-colors',
        'placeholder:text-muted-foreground',
        'focus-visible:outline-none focus-visible:border-inputBorderFocus',
        'disabled:cursor-not-allowed disabled:opacity-60',
        'min-h-[96px]',
        className,
      )}
      ref={ref}
      {...props}
    />
  );
});
Textarea.displayName = 'Textarea';

export { Textarea };
