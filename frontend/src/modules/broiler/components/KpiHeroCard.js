import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Eyebrow } from '@/components/ui/eyebrow';

// Web port of mobile/modules/broiler/components/BatchKpiCard.js. The
// uppercase eyebrow sits ABOVE the card; the card body holds a 28pt headline
// (with optional muted prefix/suffix), an optional subline, and a 3-cell stat
// grid divided by hairlines. Matches the recipe at DESIGN_LANGUAGE.md §6 with
// the dashboard-specific 28pt Bold headline carried over from the mobile spec.
export default function KpiHeroCard({
  title,
  icon: Icon,
  headline,
  headlineSuffix,
  headlineColor,         // Tailwind class (e.g. "text-success") or null
  subline,
  sublineColor,
  children,              // Free-form body between subline and stat grid (mobile parity)
  stats,
  onClick,
  // Optional ReactNode rendered in the chevron's slot (top-right of the
  // headline row). When provided, the navigation chevron is suppressed
  // even if the card is tappable — the consumer has explicitly claimed
  // the slot for an inline affordance (e.g. the kg/bags toggle on the
  // FeedInventoryCard). The card-level `onClick` still fires when the
  // user clicks elsewhere on the card; the action inside `headlineRight`
  // should `event.stopPropagation()` to avoid double-firing.
  headlineRight,
}) {
  const tappable = typeof onClick === 'function';
  const hasHeadlineRight = headlineRight != null;

  const Body = (
    <>
      {/* Headline row */}
      {(headline != null || headlineSuffix || tappable || hasHeadlineRight) ? (
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-baseline gap-2">
            {headline != null ? (
              <span
                className={cn(
                  'truncate text-[28px] font-bold leading-[34px] tracking-[-0.4px]',
                  headlineColor || 'text-foreground',
                )}
              >
                {headline}
              </span>
            ) : null}
            {headlineSuffix ? (
              <span className="text-[12px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                {headlineSuffix}
              </span>
            ) : null}
          </div>
          {hasHeadlineRight ? (
            // Wrapper consumes click events so a card-level `onClick`
            // doesn't fire when the user is aiming at the inline
            // action (e.g. unit toggle) and lands a hair to the side.
            <div
              className="ms-3 shrink-0"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
            >
              {headlineRight}
            </div>
          ) : tappable ? (
            <ChevronRight
              className="ms-3 mt-2 h-[18px] w-[18px] shrink-0 text-muted-foreground rtl:rotate-180"
              strokeWidth={2.2}
              aria-hidden="true"
            />
          ) : null}
        </div>
      ) : null}

      {/* Subline (e.g. "Margin 18.5%") */}
      {subline ? (
        <p className={cn('mt-1 text-xs font-medium', sublineColor || 'text-muted-foreground')}>
          {subline}
        </p>
      ) : null}

      {/* Free-form body (survival bar, per-house list, expense bars, etc.) —
          ports the mobile BatchKpiCard children slot so a single primitive
          can host both the headline strip and richer composed bodies. */}
      {children ? <div className="mt-3.5">{children}</div> : null}

      {/* 3-cell stat grid with hairline dividers between cells */}
      {Array.isArray(stats) && stats.length > 0 ? (
        <div className={cn(
          'flex items-stretch border-t border-border pt-3.5',
          (children || subline || headline != null) ? 'mt-4' : '',
        )}>
          {stats.map((stat, i) => {
            const StatIcon = stat.icon;
            return (
              <div key={stat.label || `s${i}`} className="flex flex-1 items-stretch min-w-0">
                {i > 0 ? (
                  <div className="mx-2 w-px self-stretch bg-border" aria-hidden="true" />
                ) : null}
                <div className="flex flex-1 flex-col items-start min-w-0">
                  <div className="flex items-center gap-1 mb-1">
                    {StatIcon ? (
                      <StatIcon className="h-[11px] w-[11px] text-muted-foreground" strokeWidth={2.4} />
                    ) : null}
                    <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground truncate">
                      {stat.label}
                    </span>
                  </div>
                  <span
                    className={cn(
                      'truncate text-[14px] font-semibold leading-tight',
                      stat.valueColor || 'text-foreground',
                    )}
                  >
                    {stat.value}
                  </span>
                  {stat.subValue ? (
                    <span className={cn('mt-0.5 truncate text-[11px] font-medium', stat.subValueColor || 'text-muted-foreground')}>
                      {stat.subValue}
                    </span>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
    </>
  );

  // Card chrome — same recipe as the design-language Card primitive but
  // inlined here so we can switch to a button when `onClick` is provided
  // without losing the press-state visuals.
  const cardClass = cn(
    'rounded-2xl border border-sectionBorder bg-card p-5 text-card-foreground',
    'shadow-[0_1px_8px_rgba(15,31,16,0.04)] dark:shadow-none',
    'transition-colors',
    tappable && 'cursor-pointer hover:border-accentStrong/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background text-start',
  );

  return (
    <div>
      {/* Eyebrow ABOVE the card (matches mobile pattern). */}
      {title ? (
        <div className="mb-2 ms-1.5 flex items-center gap-2">
          {Icon ? <Icon className="h-3 w-3 text-muted-foreground" strokeWidth={2.2} /> : null}
          <Eyebrow>{title}</Eyebrow>
        </div>
      ) : null}

      {tappable ? (
        // When `headlineRight` carries an interactive child (e.g. the
        // FeedInventoryCard's kg/bags toggle), we cannot wrap the whole
        // card in a <button> — nested buttons are invalid HTML and break
        // keyboard / screen-reader behaviour. In that case render a
        // div with `role="button"` so the card stays clickable but
        // the inner control keeps its native semantics.
        hasHeadlineRight ? (
          <div
            role="button"
            tabIndex={0}
            onClick={onClick}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick(e);
              }
            }}
            className={cn(cardClass, 'w-full')}
          >
            {Body}
          </div>
        ) : (
          <button type="button" onClick={onClick} className={cn(cardClass, 'w-full')}>
            {Body}
          </button>
        )
      ) : (
        <div className={cardClass}>{Body}</div>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Tone helpers — shared so widgets colour numbers consistently. Ported from
// mobile/modules/broiler/components/BatchKpiCard.js. The web tones map onto
// the new semantic tokens added in the previous PR (success / warning /
// destructive / muted) instead of raw hex strings.
// -----------------------------------------------------------------------------

export function profitToneClass(val) {
  if (val == null) return 'text-foreground';
  return val < 0 ? 'text-destructive' : 'text-success';
}

export function mortalityToneClass(pct) {
  if (pct >= 5) return 'text-destructive';
  if (pct >= 2) return 'text-warning';
  return 'text-success';
}

// Maps a feed-inventory status (see computeFeedInventory) to the
// Tailwind class the KPI card should render the headline / subline /
// banner in. Mirrors mobile feedStockToneColor.
//
//   ok        — comfortable runway, paint with success (positive).
//   low       — 3–7 days runway, warning amber so it's noticed.
//   critical  — under 3 days runway, destructive red.
//   over      — consumed already exceeds tracked orders, also red.
//   untracked — no orders entered yet; muted because there's nothing
//               to project against.
export function feedStockToneClass(status) {
  switch (status) {
    case 'critical':
    case 'over':
      return 'text-destructive';
    case 'low':
      return 'text-warning';
    case 'untracked':
      return 'text-muted-foreground';
    case 'ok':
    default:
      return 'text-success';
  }
}
