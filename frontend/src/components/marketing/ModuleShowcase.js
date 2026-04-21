import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import * as Accordion from '@radix-ui/react-accordion';
import {
  ChevronDown, Users, Sparkles, ListChecks, ArrowRight, ArrowLeft, MessageCircle,
} from 'lucide-react';
import { MODULE_CATALOG, MODULE_IDS } from '@poultrymanager/shared';
import { isRTL } from '@/i18n/languages';
import SectionShell from './SectionShell';
import ModuleIconTile from './ModuleIconTile';
import { onModuleSelect } from './moduleSelection';
import { cn } from '@/lib/utils';

// Modules-as-accordion. Replaces the old card grid + popup dialog combo
// with a single-column inline expander — cleaner pattern, no popup chrome,
// no grid-row growth weirdness when one card grows.
//
// Colour discipline: the per-module brand colour appears in exactly ONE
// place — the icon tile — so the section reads as a unified piece of brand
// chrome rather than a rainbow. All other accents (chevrons, borders,
// section eyebrows, bullets, CTAs) use the primary green.
//
// Coordination with the radial hub:
//   - Trigger row click expands the item.
//   - Radial node click dispatches `pm:module-select` (see moduleSelection.js).
//     This component listens, scrolls itself into view, and opens that item.
export default function ModuleShowcase() {
  const { t, i18n } = useTranslation();
  const rtl = isRTL(i18n.language);
  const ForwardArrow = rtl ? ArrowLeft : ArrowRight;

  // Controlled accordion value so the radial-hub event bus can drive opens
  // from outside this component. `expandedId` is null when collapsed.
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    return onModuleSelect((moduleId) => {
      if (!moduleId) return;
      const target = document.getElementById('modules');
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      // Wait for the scroll-into-view animation to settle before triggering
      // the expand, so the eye lands on the section first then sees the
      // chosen item open inside it.
      window.setTimeout(() => setExpandedId(moduleId), 280);
    });
  }, []);

  return (
    <SectionShell
      id="modules"
      eyebrow={t('marketing.modules.eyebrow')}
      title={t('marketing.modules.title')}
      subtitle={t('marketing.modules.subtitle')}
    >
      <div className="max-w-3xl mx-auto">
        <Accordion.Root
          type="single"
          collapsible
          value={expandedId || ''}
          onValueChange={(v) => setExpandedId(v || null)}
          className="flex flex-col gap-3"
        >
          {MODULE_IDS.map((id) => (
            <ModuleAccordionItem
              key={id}
              id={id}
              t={t}
              ForwardArrow={ForwardArrow}
            />
          ))}
        </Accordion.Root>
      </div>
    </SectionShell>
  );
}

function ModuleAccordionItem({ id, t, ForwardArrow }) {
  const meta = MODULE_CATALOG[id];
  if (!meta) return null;

  const features = t(`marketing.modules.info.${id}.features`, { returnObjects: true });
  const featureList = Array.isArray(features) ? features : [];

  return (
    <Accordion.Item
      value={id}
      className={cn(
        'group rounded-[18px] border border-sectionBorder bg-card overflow-hidden',
        'shadow-[0_1px_8px_rgba(0,0,0,0.04)] dark:shadow-none',
        'data-[state=open]:border-primary/40',
        'transition-colors duration-200',
      )}
    >
      <Accordion.Header>
        <Accordion.Trigger
          className={cn(
            'group/trigger flex w-full items-center gap-4 p-5 md:p-6 text-start',
            'hover:bg-accent/30 transition-colors',
            'focus-visible:outline-none focus-visible:bg-accent/30',
          )}
        >
          {/* Icon tile is the ONLY surface that carries the module colour */}
          <ModuleIconTile moduleId={id} meta={meta} size="lg" className="shrink-0" />

          <div className="min-w-0 flex-1">
            <h3 className="text-base md:text-[17px] font-semibold leading-tight tracking-tight text-foreground">
              {t(`modules.${id}`)}
            </h3>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground line-clamp-2">
              {t(`modules.${id}Desc`)}
            </p>
          </div>

          {/* Chevron rotates 180° on open via Radix data-state attr.
              Brand-neutral muted-foreground -> primary on open. */}
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

      {/* Content uses tailwindcss-animate's accordion-down/up keyframes
          (already configured in tailwind.config.js) for the height
          animation. Inline expansion — no portal, no overlay, no popup. */}
      <Accordion.Content className="overflow-hidden data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up">
        <div className="px-5 md:px-6 pb-6 pt-2">
          {/* Hairline separator between the trigger row and the body so the
              expansion reads as a continuation, not a new card. */}
          <div className="h-px bg-sectionBorder mb-5" aria-hidden="true" />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5">
            <DetailBlock
              Icon={Users}
              label={t('marketing.modules.detail.whoFor')}
            >
              {t(`marketing.modules.info.${id}.whoFor`)}
            </DetailBlock>

            <DetailBlock
              Icon={Sparkles}
              label={t('marketing.modules.detail.whoHelps')}
            >
              {t(`marketing.modules.info.${id}.whoHelps`)}
            </DetailBlock>

            {featureList.length > 0 && (
              <div className="md:col-span-2">
                <BlockHeader Icon={ListChecks} label={t('marketing.modules.detail.features')} />
                <ul className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5">
                  {featureList.map((feat, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2.5 text-sm leading-relaxed text-foreground/85"
                    >
                      <span
                        className="mt-2 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-primary"
                        aria-hidden="true"
                      />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* In-card CTAs — small, brand-primary, secondary outline */}
          <div className="mt-6 flex flex-col sm:flex-row gap-3">
            <Link
              to="/register"
              className="group/cta inline-flex items-center justify-center gap-2 h-10 px-5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold transition-colors hover:bg-primary/90"
            >
              {t('marketing.modules.detail.getStarted')}
              <ForwardArrow
                className="h-3.5 w-3.5 transition-transform group-hover/cta:translate-x-0.5 rtl:group-hover/cta:-translate-x-0.5"
                aria-hidden="true"
              />
            </Link>
            <a
              href="https://wa.me/971522444195"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 h-10 px-5 rounded-xl bg-secondary text-secondary-foreground text-sm font-semibold border border-sectionBorder transition-colors hover:bg-accent"
            >
              <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />
              {t('marketing.modules.detail.talkToUs')}
            </a>
          </div>
        </div>
      </Accordion.Content>
    </Accordion.Item>
  );
}

function BlockHeader({ Icon, label }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="h-3.5 w-3.5 text-primary" strokeWidth={2.4} aria-hidden="true" />
      <span className="text-[11px] font-semibold tracking-[0.16em] uppercase text-muted-foreground">
        {label}
      </span>
    </div>
  );
}

function DetailBlock({ Icon, label, children }) {
  return (
    <div>
      <BlockHeader Icon={Icon} label={label} />
      <p className="mt-2 text-sm leading-relaxed text-foreground/85 text-start">
        {children}
      </p>
    </div>
  );
}
