import { useTranslation } from 'react-i18next';
import { Mail, MessageCircle, Sparkles } from 'lucide-react';
import SectionShell from './SectionShell';

// Single card placeholder until Stripe is wired (see SUBSCRIPTION.md). Two
// CTAs route to the same destinations as the contact page so the user always
// has a way to reach a human.
export default function PricingComingSoon() {
  const { t } = useTranslation();

  return (
    <SectionShell id="pricing" headerless className="py-12 md:py-16">
      <div className="relative overflow-hidden rounded-[28px] border border-sectionBorder bg-gradient-to-br from-primary/15 via-primary/5 to-transparent dark:from-primary/20 dark:via-primary/10 dark:to-transparent p-8 md:p-14">
        {/* Decorative blob — hidden on small screens to keep the card calm */}
        <div
          className="hidden md:block absolute -top-16 -end-16 h-56 w-56 rounded-full bg-primary/10 blur-3xl"
          aria-hidden="true"
        />

        <div className="relative max-w-2xl mx-auto text-center flex flex-col items-center gap-4">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-[14px] bg-primary/15 text-primary">
            <Sparkles className="h-5 w-5" strokeWidth={2.2} aria-hidden="true" />
          </div>
          <span className="text-[11px] font-semibold tracking-[0.18em] uppercase text-primary">
            {t('marketing.pricing.eyebrow')}
          </span>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
            {t('marketing.pricing.title')}
          </h2>
          <p className="text-base md:text-lg text-muted-foreground leading-relaxed">
            {t('marketing.pricing.body')}
          </p>

          <div className="mt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
            <a
              href="mailto:info@esteratech.com?subject=PoultryManager%20pricing%20enquiry"
              className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-2xl bg-primary text-primary-foreground font-semibold transition-colors hover:bg-primary/90"
            >
              <Mail className="h-4 w-4" aria-hidden="true" />
              {t('marketing.pricing.ctaContact')}
            </a>
            <a
              href="https://wa.me/971522444195"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-2xl bg-secondary text-secondary-foreground font-semibold border border-sectionBorder transition-colors hover:bg-accent"
            >
              <MessageCircle className="h-4 w-4" aria-hidden="true" />
              {t('marketing.pricing.ctaWhatsapp')}
            </a>
          </div>
        </div>
      </div>
    </SectionShell>
  );
}
