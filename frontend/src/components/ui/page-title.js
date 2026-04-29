import * as React from 'react';
import { cn } from '@/lib/utils';
import { Eyebrow } from '@/components/ui/eyebrow';

// Canonical page heading. Replaces the per-page
// `<div><h1 className="text-2xl font-heading font-bold ...">…</h1>
// <p className="text-muted-foreground">…</p></div>` pattern that was
// drifting between pages (some had `text-3xl`, some `font-bold`, some
// `font-heading`, etc.).
//
// Sets the typography scale once:
//   - title    → 28pt Bold, -0.5px tracking (mobile/docs/DESIGN_LANGUAGE.md §3)
//   - subtitle → 14pt Regular, muted-foreground
//   - eyebrow  → 11pt SemiBold uppercase 0.12em (Eyebrow primitive)
//
// `actions` is an optional right-aligned slot for page-level CTAs (e.g.
// "New batch", "Filter"). On mobile widths the actions wrap to a second
// row underneath the title.
export default function PageTitle({
  eyebrow,
  title,
  subtitle,
  actions,
  className,
  ...props
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between',
        className,
      )}
      {...props}
    >
      <div className="min-w-0 flex-1 space-y-1">
        {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
        <h1 className="text-[28px] font-heading font-bold leading-[1.15] tracking-[-0.5px] text-foreground">
          {title}
        </h1>
        {subtitle ? (
          <p className="text-sm text-muted-foreground leading-relaxed">{subtitle}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 items-center gap-2 sm:ms-4">{actions}</div>
      ) : null}
    </div>
  );
}
