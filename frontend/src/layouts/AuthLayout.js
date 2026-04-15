import { Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Sun, Moon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import useThemeStore from '@/stores/themeStore';

export default function AuthLayout() {
  const { t } = useTranslation();
  const { setTheme, resolvedTheme } = useThemeStore();

  const toggleTheme = () => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
  const ThemeIcon = resolvedTheme === 'dark' ? Sun : Moon;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <div className="absolute top-4 right-4 rtl:right-auto rtl:left-4">
        <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label={t('common.theme')}>
          <ThemeIcon className="h-5 w-5" />
        </Button>
      </div>

      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center space-y-2">
            <div className="flex items-center justify-center gap-2">
              <img src={resolvedTheme === 'dark' ? '/media/logo/pm_logo_notext_square_white_max.png' : '/media/logo/PM logo_notext_square_max.png'} alt="PoultryManager" className="h-14 w-14 rounded-xl object-contain" />
            </div>
            <h1 className="text-2xl font-heading font-bold tracking-tight">
              {t('app.name')}
            </h1>
            <p className="text-sm text-muted-foreground">
              {t('app.tagline')}
            </p>
          </div>

          <Outlet />
        </div>
      </div>

      <footer className="py-4 text-center text-xs text-muted-foreground">
        &copy; {new Date().getFullYear()} Estera Tech LLC
      </footer>
    </div>
  );
}
