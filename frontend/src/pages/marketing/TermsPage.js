import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollText } from 'lucide-react';
import PageHero from '@/components/marketing/PageHero';
import LegalProse from '@/components/marketing/LegalProse';

export default function TermsPage() {
  const { t } = useTranslation();
  const body = t('marketing.terms.body', { returnObjects: true });
  const intro = t('marketing.terms.intro');

  useEffect(() => {
    const previous = document.title;
    document.title = `${t('marketing.terms.title')} — PoultryManager`;
    return () => { document.title = previous; };
  }, [t]);

  return (
    <PageHero
      icon={ScrollText}
      eyebrow={t('marketing.footer.legal.title')}
      title={t('marketing.terms.title')}
      subtitle={t('marketing.terms.lastUpdated')}
    >
      <article className="mx-auto max-w-3xl px-4 md:px-6">
        {intro && intro !== 'marketing.terms.intro' && (
          <p className="text-base md:text-lg text-foreground/85 leading-relaxed mb-10 text-start">
            {intro}
          </p>
        )}
        <LegalProse body={Array.isArray(body) ? body : []} />
      </article>
    </PageHero>
  );
}
