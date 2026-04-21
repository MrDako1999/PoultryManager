import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ShieldCheck } from 'lucide-react';
import PageHero from '@/components/marketing/PageHero';
import LegalProse from '@/components/marketing/LegalProse';

export default function PrivacyPage() {
  const { t } = useTranslation();
  // returnObjects pulls the structured array out of the i18n bundle.
  // Body lives only in en.json today; i18next falls back to en for any other
  // active locale automatically.
  const body = t('marketing.privacy.body', { returnObjects: true });
  const intro = t('marketing.privacy.intro');

  // Set the document title separately for each legal page so the browser tab
  // and the Play Console preview both show the right name.
  useEffect(() => {
    const previous = document.title;
    document.title = `${t('marketing.privacy.title')} — PoultryManager`;
    return () => { document.title = previous; };
  }, [t]);

  return (
    <PageHero
      icon={ShieldCheck}
      eyebrow={t('marketing.footer.legal.title')}
      title={t('marketing.privacy.title')}
      subtitle={t('marketing.privacy.lastUpdated')}
    >
      <article className="mx-auto max-w-3xl px-4 md:px-6">
        {intro && intro !== 'marketing.privacy.intro' && (
          <p className="text-base md:text-lg text-foreground/85 leading-relaxed mb-10 text-start">
            {intro}
          </p>
        )}
        <LegalProse body={Array.isArray(body) ? body : []} />
      </article>
    </PageHero>
  );
}
