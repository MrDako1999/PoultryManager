import * as React from 'react';
import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

// Checkbox uses --accent-strong (the focus/active brand-green) instead of
// --primary so a checked control sitting next to a primary CTA doesn't
// double up on the same exact green. rounded-md (now 8pt with the bumped
// --radius) gives the checkbox a softer outline that pairs with the new
// rounded-xl inputs above and below it. The idle border lifts to
// --input-border-idle so a row of "input + checkbox + input" reads as one
// family.
const Checkbox = React.forwardRef(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      'peer h-4 w-4 shrink-0 rounded-md border-[1.5px] border-inputBorderIdle ring-offset-background',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
      'disabled:cursor-not-allowed disabled:opacity-50',
      'data-[state=checked]:bg-accentStrong data-[state=checked]:border-accentStrong data-[state=checked]:text-white',
      className,
    )}
    {...props}
  >
    <CheckboxPrimitive.Indicator className={cn('flex items-center justify-center text-current')}>
      <Check className="h-3.5 w-3.5" strokeWidth={3} />
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
));
Checkbox.displayName = CheckboxPrimitive.Root.displayName;

export { Checkbox };
