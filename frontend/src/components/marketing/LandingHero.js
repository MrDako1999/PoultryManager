import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  ArrowLeft,
  Calendar,
  ShieldCheck,
  Leaf,
  Smartphone,
  Radio,
} from 'lucide-react';
import { isRTL } from '@/i18n/languages';
import RadialHubDiagram from './RadialHubDiagram';

// Bespoke hero for the landing page.
//
// Layout:
//   - A real photographic background (UAE farm + Dubai skyline) sits behind
//     a dark green overlay; everything floats above it.
//   - Mobile / tablet (< lg): stacked, radial first, text below.
//   - Desktop (lg+): two columns side-by-side, text left + radial right.
//   - A full-width "trust strip" with credibility cards anchors the hero
//     bottom on lg+ — on mobile the strip wraps to a 2x2 grid.
//
// DOM order is text → radial → trust strip; we swap visual order on small
// screens with `order-*` so the radial paints first under the nav on a
// phone. Important for first-impression and SEO/screen-reader semantics.
export default function LandingHero() {
  const { t, i18n } = useTranslation();
  const rtl = isRTL(i18n.language);
  const ForwardArrow = rtl ? ArrowLeft : ArrowRight;

  const trustCards = [
    { id: 'uaeStandard', Icon: ShieldCheck },
    { id: 'foodSecurity', Icon: Leaf },
    { id: 'mobileFirst', Icon: Smartphone },
    { id: 'realTime', Icon: Radio },
  ];

  return (
    // -mt-16 md:-mt-20 pulls the hero up behind the sticky nav so the nav's
    // "transparent over hero" state is actually transparent over the
    // photo+overlay, not over the page background.
    <div className="relative -mt-16 md:-mt-20">
      <div className="relative overflow-hidden">
        {/* Background photograph — the UAE farm + Dubai skyline. Rendered
            as a real <img> rather than a CSS background so the browser can
            decode it eagerly, prioritize it for LCP, and apply higher-
            quality scaling. Anchored to the BOTTOM so the silos / Estera
            Farms buildings / Burj Khalifa skyline are always visible
            regardless of viewport height. */}
        <img
          src="/media/hero/farm-skyline.png"
          alt=""
          aria-hidden="true"
          loading="eager"
          // fetchpriority is a real attribute; React 18 forwards unknown
          // ones to the DOM. Using camelCase to silence the lint warning.
          fetchpriority="high"
          decoding="async"
          draggable="false"
          // On mobile we shift the photo's focal point to the right so the
          // silos / Estera Farms gate side of the photo sits in view rather
          // than the dead-center asphalt patch. Tune the first value (e.g.
          // 70%) to taste — 0% pulls the LEFT edge into view, 100% the RIGHT.
          // On lg+ we go back to bottom-center where the full-width photo
          // already shows everything we want.
          className="absolute inset-0 h-full w-full object-cover object-[70%_100%] lg:object-bottom select-none"
          style={{ imageRendering: 'auto' }}
        />

        {/* Dark green tint — heavy at the top so the nav + headline are
            legible, then fades quickly so the photographed horizon and
            farm buildings stay visible at the bottom of the hero. */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'linear-gradient(180deg, rgba(6,30,18,0.94) 0%, rgba(8,38,24,0.80) 25%, rgba(10,42,26,0.45) 55%, rgba(10,42,26,0.18) 80%, rgba(10,42,26,0.05) 100%)',
          }}
          aria-hidden="true"
        />

        {/* Left-column legibility veil — keeps the headline / subtitle / CTAs
            readable on the left while letting the right side of the photo
            (silos, skyline) breathe at full clarity. */}
        <div
          className="absolute inset-0 pointer-events-none lg:block hidden"
          style={{
            background:
              'linear-gradient(90deg, rgba(6,30,18,0.55) 0%, rgba(6,30,18,0.30) 35%, rgba(6,30,18,0) 60%)',
          }}
          aria-hidden="true"
        />

        {/* Soft spotlight roughly centred on the radial diagram — pulls the
            eye into the visual without adding a hard ring. */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse 55% 55% at 75% 40%, rgba(255,255,255,0.10) 0%, transparent 60%)',
          }}
          aria-hidden="true"
        />

        <div className="relative mx-auto max-w-7xl px-4 md:px-6 pt-20 md:pt-24 pb-0">
          {/*
            Two layouts, one DOM, controlled with `order-*` on a flex column
            for mobile and `lg:grid` for desktop.

            MOBILE order (top → bottom):
              1. Eyebrow pill ("Built in the UAE…")
              2. Headline ("One platform…")
              3. Compact radial (small, no labels)
              4. Subtitle
              5. CTAs

            DESKTOP order:
              Left column: eyebrow → headline → subtitle → CTAs
              Right column: full radial with labels

            The trust strip below the grid does the credibility lifting on
            both breakpoints, so we don't need separate "powered by" badges.
          */}
          <div className="flex flex-col lg:grid lg:grid-cols-2 lg:items-center gap-6 sm:gap-8 lg:gap-12 max-w-2xl mx-auto lg:max-w-none">
            {/* 1) Eyebrow pill — first on every breakpoint. */}
            <div className="order-1 lg:order-1 lg:col-start-1 text-center lg:text-start">
              <div className="inline-flex items-center gap-2 h-9 px-3.5 rounded-full bg-black/35 border border-white/15 text-white text-xs sm:text-[13px] font-medium backdrop-blur-md">
                <span aria-hidden="true" className="text-base leading-none">
                  🇦🇪
                </span>
                <span>{t('marketing.hero.eyebrow')}</span>
              </div>
            </div>

            {/* 2) Headline — second on mobile, second on desktop (left col). */}
            <h1 className="order-2 lg:order-2 lg:col-start-1 text-center lg:text-start text-4xl sm:text-5xl md:text-6xl lg:text-[3.75rem] xl:text-7xl font-bold tracking-tight leading-[1.02] text-white">
              {t('marketing.hero.titleLead')}{' '}
              <span className="block text-[hsl(148_55%_62%)]">
                {t('marketing.hero.titleAccent')}
              </span>
            </h1>

            {/* 3a) Compact radial — mobile-only. Sits between the headline
                and the subtitle so the visual punctuates the brand promise
                without dominating the first viewport on a phone. */}
            <div className="order-3 lg:hidden flex justify-center">
              <RadialHubDiagram variant="compact" />
            </div>

            {/* 4) Subtitle. */}
            <p className="order-4 lg:order-3 lg:col-start-1 text-center lg:text-start text-base md:text-lg text-white/80 leading-relaxed lg:max-w-xl">
              {t('marketing.hero.subtitle')}
            </p>

            {/* 5) CTAs. */}
            <div className="order-5 lg:order-4 lg:col-start-1 flex flex-col sm:flex-row items-stretch sm:items-center justify-center lg:justify-start gap-3">
              <Link
                to="/register"
                className="group inline-flex items-center justify-center gap-2 h-12 px-7 rounded-2xl bg-[hsl(148_60%_38%)] text-white font-semibold transition-all hover:bg-[hsl(148_60%_44%)] hover:shadow-[0_10px_32px_rgba(34,160,80,0.45)] hover:-translate-y-0.5"
              >
                {t('marketing.hero.ctaPrimary')}
                <ForwardArrow
                  className="h-4 w-4 transition-transform group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5"
                  aria-hidden="true"
                />
              </Link>
              <a
                href="https://wa.me/971522444195"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-2xl bg-white/[0.08] text-white font-semibold border border-white/25 transition-colors hover:bg-white/[0.16] backdrop-blur-md"
              >
                <Calendar className="h-4 w-4" aria-hidden="true" />
                {t('marketing.hero.ctaSecondary')}
              </a>
            </div>

            {/* Full radial — desktop-only. Spans all rows of the left
                column so it stays vertically centred next to the text
                stack on the left. */}
            <div className="hidden lg:flex lg:col-start-2 lg:row-start-1 lg:row-span-4 lg:max-w-[520px] lg:ms-auto w-full items-center">
              <RadialHubDiagram />
            </div>
          </div>

          {/* Trust strip — full-width band at the bottom of the hero, sitting
              just above the section break. Glass card with 4 credibility
              tiles. On mobile it wraps to a 2x2 grid; on lg+ it's a single
              row matching the reference design. */}
          <div className="mt-10 md:mt-14">
            <div className="rounded-2xl bg-black/35 border border-white/10 backdrop-blur-md px-4 sm:px-6 py-4 sm:py-5">
              <ul className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-6">
                {trustCards.map(({ id, Icon }) => (
                  <li
                    key={id}
                    className="flex items-center gap-3 min-w-0"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 ring-1 ring-primary/30 text-[hsl(148_55%_62%)]">
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 text-white leading-tight">
                      <span className="block text-[13px] sm:text-sm font-semibold">
                        {t(`marketing.hero.trustStrip.${id}.line1`)}
                      </span>
                      <span className="block text-[13px] sm:text-sm font-semibold text-white/85">
                        {t(`marketing.hero.trustStrip.${id}.line2`)}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Bottom spacer — keeps the trust strip from kissing the next
              section while preserving the photo bleed. */}
          <div className="h-10 md:h-14" aria-hidden="true" />
        </div>

        {/* Soft fade from the hero into the page background — kept short so
            it only blends the very last sliver of the photo, not the silos
            and farm buildings. */}
        <div
          className="absolute inset-x-0 bottom-0 h-8 md:h-10 pointer-events-none bg-gradient-to-b from-transparent to-background"
          aria-hidden="true"
        />
      </div>
    </div>
  );
}

