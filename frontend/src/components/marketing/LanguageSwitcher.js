import { useTranslation } from 'react-i18next';
import { Languages, Check } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import languages, { getLanguage } from '@/i18n/languages';
import { cn } from '@/lib/utils';

// Translucent pill on the gradient (variant="hero"), opaque secondary pill on
// the sheet (variant="default"). Uses native <select>-style behaviour via the
// existing Radix dropdown-menu primitive so it inherits keyboard nav + a11y
// for free.
//
// `alwaysShowLabel` — opts out of the small-viewport name-hidden treatment.
// The compact desktop nav hides the language name by default to save space;
// surfaces with breathing room (mobile drawer footer, settings panels)
// should pass alwaysShowLabel so the pill doesn't read as a sparse icon-only
// glyph that's hard to scan.
export default function LanguageSwitcher({
  variant = 'default',
  className,
  alwaysShowLabel = false,
}) {
  const { i18n, t } = useTranslation();
  const current = getLanguage(i18n.language) || languages[0];

  const triggerClass = cn(
    'inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40',
    variant === 'hero'
      ? 'bg-white/[0.18] text-white border border-white/15 hover:bg-white/[0.26]'
      : 'bg-secondary text-secondary-foreground border border-sectionBorder hover:bg-accent',
    className,
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={triggerClass}
        aria-label={t('marketing.nav.language')}
      >
        <Languages className="h-4 w-4" aria-hidden="true" />
        <span aria-hidden="true">{current.flag}</span>
        <span className={alwaysShowLabel ? 'inline' : 'hidden sm:inline'}>
          {current.nativeName}
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="min-w-[180px] rounded-xl border-sectionBorder"
      >
        {languages.map((lang) => {
          const active = lang.code === current.code;
          return (
            <DropdownMenuItem
              key={lang.code}
              onSelect={() => i18n.changeLanguage(lang.code)}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 cursor-pointer',
                active && 'bg-accent',
              )}
            >
              <span aria-hidden="true" className="text-base leading-none">{lang.flag}</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium leading-tight">{lang.nativeName}</div>
                <div className="text-xs text-muted-foreground leading-tight">{lang.name}</div>
              </div>
              {active && <Check className="h-4 w-4 text-primary" aria-hidden="true" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
