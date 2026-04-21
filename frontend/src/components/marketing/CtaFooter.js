import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ArrowRight, ArrowLeft, MessageCircle, Mail } from 'lucide-react';
import { isRTL } from '@/i18n/languages';

export default function CtaFooter() {
  const { t, i18n } = useTranslation();
  const rtl = isRTL(i18n.language);
  const ForwardArrow = rtl ? ArrowLeft : ArrowRight;

  return (
    <section className="py-16 md:py-24">
      <div className="mx-auto max-w-7xl px-4 md:px-6">
        <div className="hero-gradient relative overflow-hidden rounded-[28px] px-6 py-14 md:px-14 md:py-20 text-center">
          {/* Soft circular highlight in the leading corner — direction-neutral
              because it's purely decorative and centered horizontally on
              translate axis. */}
          <div
            className="absolute inset-0 bg-[radial-gradient(circle_at_30%_-10%,rgba(255,255,255,0.18),transparent_60%)] pointer-events-none"
            aria-hidden="true"
          />

          <h2 className="relative text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight text-white max-w-3xl mx-auto">
            {t('marketing.ctaFooter.title')}
          </h2>
          <p className="relative mt-4 text-base md:text-lg text-white/85 max-w-2xl mx-auto leading-relaxed">
            {t('marketing.ctaFooter.body')}
          </p>

          <div className="relative mt-8 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3">
            <Link
              to="/register"
              className="inline-flex items-center justify-center gap-2 h-12 px-7 rounded-2xl bg-white text-primary font-semibold transition-colors hover:bg-white/90"
            >
              {t('marketing.ctaFooter.ctaPrimary')}
              <ForwardArrow className="h-4 w-4" aria-hidden="true" />
            </Link>
            <a
              href="https://wa.me/971522444195"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-2xl bg-white/[0.18] text-white font-semibold border border-white/15 transition-colors hover:bg-white/[0.26]"
            >
              <MessageCircle className="h-4 w-4" aria-hidden="true" />
              {t('marketing.ctaFooter.ctaWhatsapp')}
            </a>
            <a
              href="mailto:info@esteratech.com"
              className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-2xl bg-white/[0.18] text-white font-semibold border border-white/15 transition-colors hover:bg-white/[0.26]"
            >
              <Mail className="h-4 w-4" aria-hidden="true" />
              {t('marketing.ctaFooter.ctaEmail')}
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
