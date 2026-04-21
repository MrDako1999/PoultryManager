import { useTranslation } from 'react-i18next';
import { Sun, Moon } from 'lucide-react';
import useThemeStore from '@/stores/themeStore';
import { cn } from '@/lib/utils';

// Direct light/dark toggle (no system option, no dropdown). One click flips
// between the two themes. The icon shows the *current* mode so the user can
// always read state at a glance — the small rotation animation on press
// makes the swap feel responsive.
//
// Translucent over the gradient (variant="hero"), opaque on the sheet
// (variant="default") — same shape as LanguageSwitcher.
export default function ThemeToggle({ variant = 'default', className }) {
  const { t } = useTranslation();
  const { resolvedTheme, setTheme } = useThemeStore();
  const isDark = resolvedTheme === 'dark';

  const Icon = isDark ? Moon : Sun;
  const label = isDark
    ? t('marketing.theme.switchToLight', 'Switch to light mode')
    : t('marketing.theme.switchToDark', 'Switch to dark mode');

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex items-center justify-center rounded-full transition-all',
        'h-9 w-9 active:scale-95',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40',
        variant === 'hero'
          ? 'bg-white/[0.18] text-white border border-white/15 hover:bg-white/[0.26]'
          : 'bg-secondary text-secondary-foreground border border-sectionBorder hover:bg-accent',
        className,
      )}
    >
      <Icon
        className="h-4 w-4 transition-transform duration-300"
        // Subtle rotate cue on press — the icon spins as the new icon takes
        // its place, so the swap doesn't feel like a hard cut.
        style={{ transform: isDark ? 'rotate(0deg)' : 'rotate(0deg)' }}
        aria-hidden="true"
      />
    </button>
  );
}
