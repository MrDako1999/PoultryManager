import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva } from 'class-variance-authority';
import { cn } from '@/lib/utils';

// Atom-level <Button> ported from mobile/docs/DESIGN_LANGUAGE.md §8.e.
//
// Visual recipe:
//   - rounded-2xl (16pt) — matches the mobile CTA radius.
//   - 15pt SemiBold label (text-[15px] font-semibold) — bumped one notch up
//     from shadcn's default 14pt Medium so the action reads with the right
//     amount of weight on top of soft-fill inputs and section cards.
//   - White text on bg-primary in BOTH themes. The mobile doc is firm on
//     this: dark-text-on-dark-green looks muddy. We hardcode `text-white`
//     instead of `text-primary-foreground` because the dark variant of the
//     latter resolves to a near-black colour that the doc explicitly
//     forbids.
//   - Hover steps to bg-primary/90, focus-visible falls back to a 2pt ring
//     in --ring (we keep the ring for the button because it's the keyboard
//     navigation affordance — mobile uses haptics for the same purpose).
const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-2xl text-[15px] font-semibold ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-primary text-white hover:bg-primary/90',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        outline:
          'border-[1.5px] border-inputBorderIdle bg-transparent text-foreground hover:bg-accent hover:text-accent-foreground',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        link: 'text-accentStrong underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 rounded-xl px-3 text-sm',
        lg: 'h-11 px-8',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

const Button = React.forwardRef(({ className, variant, size, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : 'button';
  return (
    <Comp
      className={cn(buttonVariants({ variant, size, className }))}
      ref={ref}
      {...props}
    />
  );
});
Button.displayName = 'Button';

export { Button, buttonVariants };
