import { cn } from '@/lib/utils';

// Standard wrapper for any block on the marketing sheet. Owns the page
// gutter, max width, vertical rhythm, optional alternating background tone,
// and the optional eyebrow / title / subtitle scaffolding so the landing
// page doesn't repeat the same boilerplate eight times.
//
// Tones:
//   default = transparent, sits on the page background
//   tinted  = bg-secondary/40 — used to alternate sections so the eye gets a
//             rhythm of "card section / break / card section" instead of
//             eight back-to-back surfaces
export default function SectionShell({
  id,
  eyebrow,
  title,
  subtitle,
  children,
  className,
  innerClassName,
  headerless = false,
  align = 'center',
  tone = 'default',
}) {
  const headerAlign = align === 'start' ? 'text-start items-start' : 'text-center items-center';
  const toneClass = tone === 'tinted' ? 'bg-secondary/30 dark:bg-secondary/20' : '';

  return (
    <section id={id} className={cn('w-full', toneClass, className)}>
      <div className={cn('mx-auto w-full max-w-7xl px-4 md:px-6 py-20 md:py-28', innerClassName)}>
        {!headerless && (eyebrow || title || subtitle) && (
          <div className={cn('flex flex-col gap-3 max-w-3xl mx-auto mb-12 md:mb-16', headerAlign)}>
            {eyebrow && (
              <span className="inline-flex items-center gap-2.5">
                {align === 'center' && (
                  <span className="h-px w-6 bg-primary/40" aria-hidden="true" />
                )}
                <span className="text-[11px] font-semibold tracking-[0.18em] uppercase text-primary">
                  {eyebrow}
                </span>
                {align === 'center' && (
                  <span className="h-px w-6 bg-primary/40" aria-hidden="true" />
                )}
              </span>
            )}
            {title && (
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-foreground leading-[1.1]">
                {title}
              </h2>
            )}
            {subtitle && (
              <p className="text-base md:text-lg text-muted-foreground leading-relaxed">
                {subtitle}
              </p>
            )}
          </div>
        )}
        {children}
      </div>
    </section>
  );
}
