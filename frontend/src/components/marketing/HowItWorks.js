import { useTranslation } from 'react-i18next';
import { Crown, HardHat } from 'lucide-react';
import SectionShell from './SectionShell';

export default function HowItWorks() {
  const { t } = useTranslation();
  // returnObjects gives us the [{title,body}] arrays straight from i18n.
  const ownerSteps = t('marketing.howItWorks.owner.steps', { returnObjects: true }) || [];
  const workerSteps = t('marketing.howItWorks.worker.steps', { returnObjects: true }) || [];

  return (
    <SectionShell
      id="how-it-works"
      eyebrow={t('marketing.howItWorks.eyebrow')}
      title={t('marketing.howItWorks.title')}
      subtitle={t('marketing.howItWorks.subtitle')}
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 md:gap-7">
        <Panel
          Icon={Crown}
          eyebrow={t('marketing.howItWorks.owner.eyebrow')}
          title={t('marketing.howItWorks.owner.title')}
          steps={Array.isArray(ownerSteps) ? ownerSteps : []}
        />
        <Panel
          Icon={HardHat}
          eyebrow={t('marketing.howItWorks.worker.eyebrow')}
          title={t('marketing.howItWorks.worker.title')}
          steps={Array.isArray(workerSteps) ? workerSteps : []}
        />
      </div>
    </SectionShell>
  );
}

function Panel({ Icon, eyebrow, title, steps }) {
  return (
    <div className="rounded-[18px] border border-sectionBorder bg-card p-6 md:p-8 shadow-[0_1px_8px_rgba(0,0,0,0.04)] dark:shadow-none">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-primary/10 text-primary">
          <Icon className="h-5 w-5" strokeWidth={2.2} aria-hidden="true" />
        </div>
        <div>
          <div className="text-[11px] font-semibold tracking-[0.16em] uppercase text-primary">
            {eyebrow}
          </div>
          <h3 className="text-xl font-semibold leading-tight tracking-tight">{title}</h3>
        </div>
      </div>

      <ol className="mt-6 flex flex-col gap-5">
        {steps.map((step, i) => (
          <li key={i} className="flex gap-4">
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-semibold"
              aria-hidden="true"
            >
              {i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <h4 className="text-base font-semibold leading-tight text-foreground text-start">
                {step?.title}
              </h4>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground text-start">
                {step?.body}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
