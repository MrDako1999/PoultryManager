import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { UserX, Mail } from 'lucide-react';
import PageHero from '@/components/marketing/PageHero';
import LegalProse from '@/components/marketing/LegalProse';

// Dedicated page for account-deletion requests. Required by Google Play —
// the URL goes into Play Console under Data safety → Data collection and
// security → "Add a link that users can use to request that their account
// and associated data is deleted". Same content shape as Privacy / Terms,
// plus a callout card up top with the direct mailto: action so the path is
// obvious without having to read the prose first.
export default function AccountDeletionPage() {
  const { t } = useTranslation();
  const body = t('marketing.accountDeletion.body', { returnObjects: true });
  const intro = t('marketing.accountDeletion.intro');
  const summary = t('marketing.accountDeletion.summary', { returnObjects: true });

  useEffect(() => {
    const previous = document.title;
    document.title = `${t('marketing.accountDeletion.title')} — PoultryManager`;
    return () => { document.title = previous; };
  }, [t]);

  return (
    <PageHero
      icon={UserX}
      eyebrow={t('marketing.footer.legal.title')}
      title={t('marketing.accountDeletion.title')}
      subtitle={t('marketing.accountDeletion.lastUpdated')}
    >
      <article className="mx-auto max-w-3xl px-4 md:px-6">
        {intro && intro !== 'marketing.accountDeletion.intro' && (
          <p className="text-base md:text-lg text-foreground/85 leading-relaxed mb-8 text-start">
            {intro}
          </p>
        )}

        {/* Action card — prominent CTA so a user who only reads the top of
            the page still has a one-click path to start the deletion. */}
        {summary && typeof summary === 'object' && (
          <div className="mb-10 rounded-[18px] border border-primary/30 bg-primary/5 dark:bg-primary/10 p-5 md:p-6">
            <div className="text-[11px] font-semibold tracking-[0.16em] uppercase text-primary mb-2">
              {summary.label}
            </div>
            <p className="text-sm md:text-base leading-relaxed text-foreground/90 mb-4 text-start">
              {summary.body}
            </p>
            <a
              href={summary.ctaHref}
              className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-2xl bg-primary text-primary-foreground text-sm font-semibold transition-colors hover:bg-primary/90"
            >
              <Mail className="h-4 w-4" aria-hidden="true" />
              {summary.ctaLabel}
            </a>
          </div>
        )}

        <LegalProse body={Array.isArray(body) ? body : []} />
      </article>
    </PageHero>
  );
}
