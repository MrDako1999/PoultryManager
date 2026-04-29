import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { buildSidebar, SIDEBAR_WIDTH, SIDEBAR_COLLAPSED_WIDTH } from './constants';
import NavItem from './NavItem';
import NavGroup from './NavGroup';
import SidebarFooter from './SidebarFooter';
import useThemeStore from '@/stores/themeStore';
import useCapabilities from '@/hooks/useCapabilities';
import { MODULES } from '@/modules/registry';
import ModuleSwitcher from '@/shared/components/ModuleSwitcher';

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
  const { visibleModules, activeModule, can } = useCapabilities();
  const isDark = resolvedTheme === 'dark';
  const bannerSrc = isDark ? '/media/logo/PM_banner_white.png' : '/media/logo/PM_Banner.png';
  const iconSrc = isDark ? '/media/logo/pm_logo_notext_square_white_max.png' : '/media/logo/PM logo_notext_square_max.png';
  const sidebarWidth = isExpanded ? SIDEBAR_WIDTH : SIDEBAR_COLLAPSED_WIDTH;

  // Scope module-contributed sidebarGroups to the active module so the
  // sidebar swaps between modules cleanly. Cross-module groups (Directory,
  // Accounting) still see the full visibleModules list inside buildSidebar
  // because they aggregate across modules.
  const scopedModules = useMemo(() => {
    if (activeModule && visibleModules.includes(activeModule)) return [activeModule];
    return visibleModules;
  }, [activeModule, visibleModules]);

  const { navItems, navGroups } = useMemo(
    () => buildSidebar({
      visibleModules: scopedModules,
      allModules: visibleModules,
      modules: MODULES,
      can,
    }),
    [scopedModules, visibleModules, can],
  );

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
            {/* Logo doubles as a "back to marketing site" link. Closes the
                mobile drawer first so the user doesn't land on / with the
                drawer still open behind the page. */}
            <Link
              to="/"
              onClick={closeMobileDrawer}
              className="inline-flex items-center transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded-md"
              aria-label="PoultryManager — go to home"
            >
              <img
                src={bannerSrc}
                alt="PoultryManager"
                className="h-11 object-contain object-left"
                draggable={false}
              />
            </Link>
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
          <Link
            to="/"
            onClick={closeMobileDrawer}
            className="inline-flex items-center transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded-lg"
            aria-label="PoultryManager — go to home"
          >
            <img
              src={iconSrc}
              alt="PoultryManager"
              className="h-10 w-10 rounded-lg shrink-0 object-contain"
              draggable={false}
            />
          </Link>
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
        {navItems.map(({ key, path, icon, end }) => (
          <NavItem
            key={key}
            to={path}
            end={end === true || key === 'dashboard'}
            icon={icon}
            label={t(`nav.${key}`, key)}
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

      {/* Module switcher — hidden when only one module */}
      {visibleModules.length > 1 && (
        <div className={cn('px-3 pb-2', !isExpanded && 'flex justify-center')}>
          <ModuleSwitcher compact={!isExpanded} />
        </div>
      )}

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
