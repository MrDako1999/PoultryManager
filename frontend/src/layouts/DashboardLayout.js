import { useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { TooltipProvider } from '@/components/ui/tooltip';
import useAuthStore from '@/stores/authStore';
import useThemeStore from '@/stores/themeStore';
import { isRTL } from '@/i18n/languages';
import useSidebar from '@/hooks/useSidebar';
import Sidebar from './sidebar/Sidebar';
import Topbar from './sidebar/Topbar';

export default function DashboardLayout() {
  const sidebar = useSidebar();
  const { user, logout } = useAuthStore();
  const { setTheme, resolvedTheme } = useThemeStore();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();

  const rtl = isRTL(i18n.language);

  useEffect(() => {
    document.documentElement.setAttribute('dir', rtl ? 'rtl' : 'ltr');
  }, [rtl]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const toggleTheme = () => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');

  const initials = user
    ? `${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}`.toUpperCase()
    : '?';

  const { isExpanded, isDesktop, sidebarOpen, setSidebarOpen, collapsed, setCollapsed } = sidebar;

  const mainMargin = rtl
    ? (isExpanded ? 'lg:mr-64' : 'lg:mr-[68px]')
    : (isExpanded ? 'lg:ml-64' : 'lg:ml-[68px]');

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-background">
        {sidebarOpen && !isDesktop && (
          <div
            className="fixed inset-0 z-40 bg-black/50"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <Sidebar
          {...sidebar}
          rtl={rtl}
          user={user}
          initials={initials}
          onLogout={handleLogout}
        />

        <div className={cn('transition-all duration-300', mainMargin)}>
          <Topbar
            onOpenSidebar={() => setSidebarOpen(true)}
            user={user}
            initials={initials}
            rtl={rtl}
            resolvedTheme={resolvedTheme}
            onToggleTheme={toggleTheme}
            onLogout={handleLogout}
          />

          <main className="p-4 lg:p-6 min-h-[calc(100vh-4rem)]">
            <Outlet />
          </main>
        </div>
      </div>
    </TooltipProvider>
  );
}
