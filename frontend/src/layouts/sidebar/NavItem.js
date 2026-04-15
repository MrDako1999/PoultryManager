import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import SidebarTooltip from './SidebarTooltip';

export default function NavItem({ to, end, icon: Icon, label, isExpanded, rtl, onNavigate, indent }) {
  const { pathname } = useLocation();
  const isActive = end ? pathname === to : pathname.startsWith(to);

  const link = (
    <Link
      to={to}
      onClick={onNavigate}
      className={cn(
        'flex h-10 items-center rounded-md text-sm font-medium overflow-hidden transition-all duration-300',
        isExpanded ? (indent ? 'gap-3 ps-9 pe-3' : 'gap-3 px-3') : 'gap-0 px-[14px]',
        isActive
          ? 'bg-primary text-primary-foreground dark:text-white'
          : 'text-foreground/70 hover:bg-accent hover:text-foreground'
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span
        className={cn(
          'truncate whitespace-nowrap transition-all duration-300',
          isExpanded ? 'opacity-100 max-w-[180px]' : 'opacity-0 max-w-0'
        )}
      >
        {label}
      </span>
    </Link>
  );

  return (
    <SidebarTooltip label={label} rtl={rtl} show={!isExpanded}>
      {link}
    </SidebarTooltip>
  );
}
