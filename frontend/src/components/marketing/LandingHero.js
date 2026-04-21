import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ArrowRight, ArrowLeft, MessageCircle } from 'lucide-react';
import { isRTL } from '@/i18n/languages';
import RadialHubDiagram from './RadialHubDiagram';

// Bespoke hero for the landing page.
//
// Layout:
//   - Mobile / tablet (< lg): stacked, radial first, text below.
//     This puts the visual centrepiece in the first viewport on a phone.
//   - Desktop (lg+): two columns side-by-side, text left + radial right.
//     Removes the wasted horizontal space we'd have on a wide laptop and
//     keeps the headline, subtitle, CTAs and trust line all above the fold
//     on standard 1080p / 1440p displays.
//
// Order is controlled with the `order-*` utility on each child rather than
// the DOM order, so the text block is first in the markup (good for screen
// readers and SEO) but the radial paints first visually on phones.
export default function LandingHero() {
  const { t, i18n } = useTranslation();
  const rtl = isRTL(i18n.language);
  const ForwardArrow = rtl ? ArrowLeft : ArrowRight;

  return (
    // -mt-16 md:-mt-20 pulls the gradient up behind the sticky nav so the
    // nav's "transparent over hero" state is actually transparent over the
    // green gradient, not over the page background.
    <div className="relative -mt-16 md:-mt-20">
      <div className="hero-gradient relative overflow-hidden">
        {/* Decorative ambient layers — depth without competing with content. */}
        <div
          className="absolute inset-0 hero-spotlight pointer-events-none"
          aria-hidden="true"
        />
        <div
          className="absolute -top-32 -end-24 h-96 w-96 rounded-full bg-white/[0.05] blur-3xl pointer-events-none"
          aria-hidden="true"
        />
        <div
          className="absolute -bottom-32 -start-24 h-96 w-96 rounded-full bg-primary/30 blur-3xl pointer-events-none"
          aria-hidden="true"
        />

        <div className="relative mx-auto max-w-7xl px-4 md:px-6 pt-20 md:pt-28 pb-16 md:pb-24">
          <div className="grid grid-cols-1 lg:grid-cols-2 items-center gap-10 md:gap-14 lg:gap-16">
            {/* Text block.
                - In DOM first (better for screen readers + SEO).
                - Visually order-2 on mobile (radial first) and order-1 on
                  desktop (left column).
                - Centered alignment on mobile, left/start aligned at lg+. */}
            <div className="order-2 lg:order-1 text-center lg:text-start max-w-2xl mx-auto lg:mx-0">
              <h1 className="text-3xl sm:text-5xl md:text-6xl lg:text-[3.5rem] xl:text-6xl font-bold tracking-tight leading-[1.05] text-white">
                {t('marketing.hero.title')}
              </h1>

              <p className="mt-4 md:mt-6 text-base md:text-lg text-white/85 leading-relaxed lg:max-w-xl">
                {t('marketing.hero.subtitle')}
              </p>

              <div className="mt-7 md:mt-9 flex flex-col sm:flex-row items-stretch sm:items-center justify-center lg:justify-start gap-3">
                <Link
                  to="/register"
                  className="group inline-flex items-center justify-center gap-2 h-12 px-7 rounded-2xl bg-white text-primary font-semibold transition-all hover:bg-white/95 hover:shadow-[0_8px_28px_rgba(0,0,0,0.18)] hover:-translate-y-0.5"
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
                  className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-2xl bg-white/[0.18] text-white font-semibold border border-white/15 transition-colors hover:bg-white/[0.26] backdrop-blur-sm"
                >
                  <MessageCircle className="h-4 w-4" aria-hidden="true" />
                  {t('marketing.hero.ctaSecondary')}
                </a>
              </div>

              <p className="mt-8 md:mt-10 text-xs md:text-sm text-white/65">
                {t('marketing.hero.trustLine')}
              </p>
            </div>

            {/* Radial diagram.
                - order-1 on mobile (renders first visually below the nav)
                - order-2 on desktop (right column)
                - Slightly smaller max-width at lg+ since it now sits in a
                  half-width column instead of full-width. */}
            <div className="order-1 lg:order-2 lg:max-w-[520px] lg:ms-auto w-full">
              <RadialHubDiagram />
            </div>
          </div>
        </div>

        {/* Soft fade from the gradient bottom into the page background. */}
        <div
          className="absolute inset-x-0 bottom-0 h-20 md:h-28 pointer-events-none bg-gradient-to-b from-transparent to-background"
          aria-hidden="true"
        />
      </div>
    </div>
  );
}
