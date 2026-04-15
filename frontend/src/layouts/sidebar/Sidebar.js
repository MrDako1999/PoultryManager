import { useTranslation } from 'react-i18next';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { navItems, navGroups, SIDEBAR_WIDTH, SIDEBAR_COLLAPSED_WIDTH } from './constants';
import NavItem from './NavItem';
import NavGroup from './NavGroup';
import SidebarFooter from './SidebarFooter';
import useThemeStore from '@/stores/themeStore';

export default function Sidebar({
  sidebarOpen, setSidebarOpen,
  isDesktop, isExpanded,
  collapsed, setCollapsed,
  openGroups, toggleGroup,
  closeMobileDrawer,
  rtl, user, initials, onLogout,
}) {
  const { t } = useTranslation();
  const { resolvedTheme } = useThemeStore();
  const isDark = resolvedTheme === 'dark';
  const bannerSrc = isDark ? '/media/logo/PM_banner_white.png' : '/media/logo/PM_Banner.png';
  const iconSrc = isDark ? '/media/logo/pm_logo_notext_square_white_max.png' : '/media/logo/PM logo_notext_square_max.png';
  const sidebarWidth = isExpanded ? SIDEBAR_WIDTH : SIDEBAR_COLLAPSED_WIDTH;

  return (
    <aside
      className={cn(
        'fixed top-0 z-50 flex h-full flex-col border-r bg-card transition-all duration-300',
        sidebarWidth,
        rtl ? 'right-0 border-l border-r-0' : 'left-0',
        isDesktop
          ? 'translate-x-0'
          : sidebarOpen
            ? 'translate-x-0'
            : rtl
              ? 'translate-x-full'
              : '-translate-x-full'
      )}
    >
      {/* Header */}
      <div className={cn(
        'relative flex items-center border-b shrink-0 overflow-visible transition-all duration-300',
        isExpanded ? 'h-16 px-4' : 'h-16 justify-center px-[14px]'
      )}>
        {isExpanded ? (
          <>
            <img src={bannerSrc} alt="PoultryManager" className="h-11 object-contain object-left" />
            {!isDesktop && sidebarOpen && (
              <Button
                variant="ghost"
                size="icon"
                className="ml-auto h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
                onClick={() => setSidebarOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </>
        ) : (
          <img src={iconSrc} alt="PoultryManager" className="h-10 w-10 rounded-lg shrink-0 object-contain" />
        )}

        {/* Collapse/expand toggle */}
        {isDesktop && (
          <button
            type="button"
            onClick={() => setCollapsed((prev) => !prev)}
            className={cn(
              'absolute top-1/2 -translate-y-1/2 flex items-center justify-center text-muted-foreground/60 hover:text-foreground transition-colors',
              rtl ? '-left-5' : '-right-5'
            )}
          >
            {(collapsed !== rtl)
              ? <ChevronRight className="h-4 w-4" />
              : <ChevronLeft className="h-4 w-4" />
            }
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
        {navItems.map(({ key, path, icon }) => (
          <NavItem
            key={key}
            to={path}
            end={key === 'dashboard'}
            icon={icon}
            label={t(`nav.${key}`)}
            isExpanded={isExpanded}
            rtl={rtl}
            onNavigate={closeMobileDrawer}
          />
        ))}

        {navGroups.map((group) => (
          <NavGroup
            key={group.key}
            group={group}
            isExpanded={isExpanded}
            rtl={rtl}
            onNavigate={closeMobileDrawer}
            t={t}
            openGroups={openGroups}
            toggleGroup={toggleGroup}
          />
        ))}
      </nav>

      {/* Footer */}
      <SidebarFooter
        isExpanded={isExpanded}
        rtl={rtl}
        user={user}
        initials={initials}
        onNavigate={closeMobileDrawer}
        onLogout={onLogout}
        t={t}
      />
    </aside>
  );
}
