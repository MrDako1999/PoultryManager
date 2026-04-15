import { useLocation } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import NavItem from './NavItem';

export default function NavGroup({ group, isExpanded, rtl, onNavigate, t, openGroups, toggleGroup }) {
  const { pathname } = useLocation();
  const { key, path, icon: Icon, children } = group;
  const isGroupActive = pathname.startsWith(path);
  const isOpen = openGroups[key] ?? false;

  if (!isExpanded) {
    return children.map((child) => (
      <NavItem
        key={child.key}
        to={child.path}
        icon={child.icon}
        label={t(`nav.${child.key}`)}
        isExpanded={false}
        rtl={rtl}
        onNavigate={onNavigate}
      />
    ));
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => toggleGroup(key)}
        className={cn(
          'flex h-10 w-full items-center gap-3 px-3 rounded-md text-sm font-medium overflow-hidden transition-all duration-300',
          isGroupActive
            ? 'text-primary font-semibold'
            : 'text-foreground/70 hover:bg-accent hover:text-foreground'
        )}
      >
        <Icon className="h-4 w-4 shrink-0" />
        <span className="truncate whitespace-nowrap flex-1 text-left">
          {t(`nav.${key}`)}
        </span>
        <ChevronRight
          className={cn(
            'h-3.5 w-3.5 shrink-0 transition-transform duration-200 rtl:rotate-180',
            isOpen && 'rotate-90 rtl:rotate-90'
          )}
        />
      </button>
      <div
        className={cn(
          'overflow-hidden transition-all duration-200 space-y-1',
          isOpen ? 'max-h-96 opacity-100 mt-1' : 'max-h-0 opacity-0'
        )}
      >
        {children.map((child) => (
          <NavItem
            key={child.key}
            to={child.path}
            icon={child.icon}
            label={t(`nav.${child.key}`)}
            isExpanded
            rtl={rtl}
            onNavigate={onNavigate}
            indent
          />
        ))}
      </div>
    </div>
  );
}
