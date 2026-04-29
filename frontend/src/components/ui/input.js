import * as React from 'react';
import { cn } from '@/lib/utils';

// Atom-level <Input> ported from mobile/docs/DESIGN_LANGUAGE.md §6 (SheetInput).
//
// Visual recipe:
//   - Soft-fill `bg-inputBg` instead of transparent. Reads as a tap target on
//     top of any surface (sheet, card, or page) without needing extra chrome.
//   - 1.5pt idle border swaps to a 1.5pt brand-green focus border (no ring
//     offset). The mobile language deliberately moved away from the shadcn
//     "ring + offset" focus state because it competes visually with the
//     soft-fill and reads as a Bootstrap leftover at desktop sizes.
//   - rounded-xl (12pt) calibrated for a 40pt input height; tighter than the
//     mobile 14pt because the desktop input is also denser (h-10 vs 52pt).
//
// Density:
//   - `default` (h-10) — matches the rest of the desktop UI (button, select).
//   - `compact` (h-9) — for tables and tight filter rows.
//
// Optional `icon` prop: pass a lucide component to get the same icon-prefix
// slot the mobile SheetInput uses. When omitted, the input renders bare so
// existing call sites (which compose their own absolute-positioned icon +
// `className="pl-9"`) keep working unchanged.
const Input = React.forwardRef(
  ({ className, type, density = 'default', icon: Icon, ...props }, ref) => {
    const heightClass = density === 'compact' ? 'h-9' : 'h-10';

    const inputElement = (
      <input
        type={type}
        ref={ref}
        className={cn(
          'flex w-full rounded-xl border-[1.5px] border-inputBorderIdle bg-inputBg px-3.5 text-sm text-foreground transition-colors',
          'placeholder:text-muted-foreground',
          'focus-visible:outline-none focus-visible:border-inputBorderFocus',
          'disabled:cursor-not-allowed disabled:opacity-60',
          'file:border-0 file:bg-transparent file:text-sm file:font-medium',
          heightClass,
          Icon && 'ps-10',
          className,
        )}
        {...props}
      />
    );

    if (!Icon) return inputElement;

    return (
      <div className={cn('relative', heightClass)}>
        <Icon
          className="pointer-events-none absolute start-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted-foreground"
          strokeWidth={2}
          aria-hidden="true"
        />
        {inputElement}
      </div>
    );
  },
);
Input.displayName = 'Input';

export { Input };
