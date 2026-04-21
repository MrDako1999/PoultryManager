import { cn } from '@/lib/utils';

// Unified gradient-hero + rounded-top sheet wrapper for the legal and contact
// pages. Mirrors the mobile HeroSheetScreen anatomy from DESIGN_LANGUAGE.md §1
// — full-bleed brand gradient with optional icon tile, then a -24pt overlapped
// rounded-top "sheet" that contains the actual page body.
//
// The landing page has its own bespoke hero with the module-hub diagram; only
// /privacy, /terms and /contact use this wrapper.
export default function PageHero({ icon: Icon, eyebrow, title, subtitle, children }) {
  return (
    <div className="bg-background">
      <div className="hero-gradient relative">
        <div className="mx-auto max-w-5xl px-4 md:px-6 pt-10 md:pt-16 pb-20 md:pb-28 text-center">
          {Icon && (
            <div
              className={cn(
                'mx-auto mb-6 inline-flex items-center justify-center',
                'h-14 w-14 rounded-[18px] bg-white/[0.18] border border-white/15',
                'shadow-[0_4px_12px_rgba(0,0,0,0.18)]',
              )}
            >
              <Icon className="h-7 w-7 text-white" strokeWidth={2} aria-hidden="true" />
            </div>
          )}
          {eyebrow && (
            <div className="text-[11px] font-semibold tracking-[0.18em] uppercase text-white/70 mb-3">
              {eyebrow}
            </div>
          )}
          <h1 className="text-3xl md:text-5xl font-bold tracking-tight text-white">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-4 text-base md:text-lg text-white/85 max-w-2xl mx-auto leading-relaxed">
              {subtitle}
            </p>
          )}
        </div>
      </div>

      {/*
        -mt-6 (≈24pt) overlap + rounded-t-[28px] is the design language sheet
        cue. Mobile pins the hero and scrolls the sheet; on web we adopt only
        the visual overlap because pinning a hero on a long marketing page
        feels claustrophobic.
      */}
      <div className="bg-background -mt-12 md:-mt-16 rounded-t-[28px] relative z-10 pt-10 md:pt-14 pb-16 md:pb-24 shadow-[0_-4px_24px_rgba(0,0,0,0.06)] dark:shadow-[0_-4px_24px_rgba(0,0,0,0.4)]">
        {children}
      </div>
    </div>
  );
}
