import { useTranslation } from 'react-i18next';
import * as Accordion from '@radix-ui/react-accordion';
import { ChevronDown } from 'lucide-react';
import SectionShell from './SectionShell';
import { cn } from '@/lib/utils';

// FAQ accordion. Mirrors the visual pattern used by ModuleShowcase so the
// page reads as one cohesive accordion family across sections:
//   - rounded-[18px] card with sectionBorder, becomes primary/40 when open
//   - chevron-down in a pill on the trailing edge, rotates 180 on open
//   - hairline separator between trigger row and body when expanded
//   - generous, consistent padding inside both the trigger and the body
export default function FaqAccordion() {
  const { t } = useTranslation();
  const items = t('marketing.faq.items', { returnObjects: true }) || [];
  const list = Array.isArray(items) ? items : [];

  return (
    <SectionShell
      id="faq"
      eyebrow={t('marketing.faq.eyebrow')}
      title={t('marketing.faq.title')}
      subtitle={t('marketing.faq.subtitle')}
    >
      <div className="max-w-3xl mx-auto">
        <Accordion.Root type="single" collapsible className="flex flex-col gap-3">
          {list.map((item, i) => (
            <Accordion.Item
              key={i}
              value={`faq-${i}`}
              className={cn(
                'group rounded-[18px] border border-sectionBorder bg-card overflow-hidden',
                'shadow-[0_1px_8px_rgba(0,0,0,0.04)] dark:shadow-none',
                'data-[state=open]:border-primary/40 transition-colors duration-200',
              )}
            >
              <Accordion.Header>
                <Accordion.Trigger
                  className={cn(
                    'flex w-full items-center gap-4 p-5 md:p-6 text-start',
                    'hover:bg-accent/30 transition-colors',
                    'focus-visible:outline-none focus-visible:bg-accent/30',
                  )}
                >
                  <span className="flex-1 text-base md:text-lg font-semibold leading-snug text-foreground">
                    {item?.q}
                  </span>
                  <span
                    className={cn(
                      'flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
                      'bg-secondary text-muted-foreground border border-sectionBorder',
                      'transition-all duration-200',
                      'group-data-[state=open]:bg-primary/10 group-data-[state=open]:text-primary group-data-[state=open]:border-primary/30',
                    )}
                    aria-hidden="true"
                  >
                    <ChevronDown
                      className="h-4 w-4 transition-transform duration-200 group-data-[state=open]:rotate-180"
                      strokeWidth={2.4}
                    />
                  </span>
                </Accordion.Trigger>
              </Accordion.Header>

              <Accordion.Content className="overflow-hidden data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up">
                <div className="px-5 md:px-6 pb-5 md:pb-6 pt-1">
                  {/* Hairline between question and answer — same separator
                      pattern as the modules accordion, so the body reads as
                      a continuation of the trigger row, not a floating
                      second card stacked beneath it. */}
                  <div className="h-px bg-sectionBorder mb-4" aria-hidden="true" />
                  <p className="text-sm md:text-[15px] leading-relaxed text-muted-foreground text-start">
                    {item?.a}
                  </p>
                </div>
              </Accordion.Content>
            </Accordion.Item>
          ))}
        </Accordion.Root>
      </div>
    </SectionShell>
  );
}
