import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { MessageSquare, Phone, Building2, MapPin, Mail, Headphones, MessageCircle } from 'lucide-react';
import PageHero from '@/components/marketing/PageHero';

// Mirrors the bidmanager.io contact card layout, with PoultryManager copy and
// Estera Tech LLC details. The phone number is wrapped in <span dir="ltr">
// so the "+971 …" string stays visually LTR even in an RTL paragraph (per
// DESIGN_LANGUAGE.md §12.4 — pure-digit values stay Western-digit, LTR).
export default function ContactPage() {
  const { t } = useTranslation();

  useEffect(() => {
    const previous = document.title;
    document.title = `${t('marketing.contact.title')} — PoultryManager`;
    return () => { document.title = previous; };
  }, [t]);

  return (
    <PageHero
      icon={MessageSquare}
      eyebrow={t('marketing.contact.eyebrow')}
      title={t('marketing.contact.title')}
      subtitle={t('marketing.contact.subtitle')}
    >
      <div className="mx-auto max-w-3xl px-4 md:px-6">
        <div className="rounded-[24px] border border-sectionBorder bg-card shadow-[0_1px_8px_rgba(0,0,0,0.04)] dark:shadow-none overflow-hidden">
          <div className="px-6 py-5 md:px-8 md:py-6 border-b border-sectionBorder">
            <h2 className="text-[11px] font-semibold tracking-[0.16em] uppercase text-primary text-start">
              {t('marketing.contact.infoTitle')}
            </h2>
          </div>

          <div className="px-6 py-2 md:px-8 md:py-3">
            <Row
              Icon={Phone}
              label={t('marketing.contact.phoneLabel')}
              value={t('marketing.contact.phone')}
              valueDir="ltr"
              href="https://wa.me/971522444195"
              external
            />
            <Row
              Icon={Building2}
              label={t('marketing.contact.companyLabel')}
              value={t('marketing.contact.company')}
            />
            <Row
              Icon={MapPin}
              label={t('marketing.contact.locationLabel')}
              value={t('marketing.contact.location')}
            />
            <Row
              Icon={Mail}
              label={t('marketing.contact.emailLabel')}
              value={t('marketing.contact.email')}
              href={`mailto:${t('marketing.contact.email')}`}
            />
            <Row
              Icon={Headphones}
              label={t('marketing.contact.supportLabel')}
              value={t('marketing.contact.support')}
              href={`mailto:${t('marketing.contact.support')}`}
              isLast
            />
          </div>
        </div>

        <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
          <a
            href="https://wa.me/971522444195"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-2xl bg-primary text-primary-foreground font-semibold transition-colors hover:bg-primary/90"
          >
            <MessageCircle className="h-4 w-4" aria-hidden="true" />
            {t('marketing.contact.whatsapp')}
          </a>
          <a
            href="mailto:info@esteratech.com"
            className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-2xl bg-secondary text-secondary-foreground font-semibold border border-sectionBorder transition-colors hover:bg-accent"
          >
            <Mail className="h-4 w-4" aria-hidden="true" />
            {t('marketing.contact.emailLabel')}
          </a>
        </div>
      </div>
    </PageHero>
  );
}

function Row({ Icon, label, value, href, external, valueDir, isLast }) {
  // Each row is a settings-row-style strip — icon tile + label + value, with
  // a hairline divider unless it's the last row in the card.
  const ValueWrap = href ? 'a' : 'span';
  const valueProps = href
    ? { href, ...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {}) }
    : {};

  return (
    <div
      className={[
        'flex items-center gap-4 py-4',
        !isLast ? 'border-b border-sectionBorder' : '',
      ].join(' ')}
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-primary/10 text-primary">
        <Icon className="h-4.5 w-4.5" strokeWidth={2.2} aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-semibold tracking-[0.14em] uppercase text-muted-foreground text-start">
          {label}
        </div>
        <ValueWrap
          {...valueProps}
          dir={valueDir}
          className={[
            'mt-0.5 block text-base md:text-[17px] font-semibold leading-tight text-foreground text-start',
            href ? 'hover:text-primary transition-colors' : '',
          ].join(' ')}
        >
          {value}
        </ValueWrap>
      </div>
    </div>
  );
}
