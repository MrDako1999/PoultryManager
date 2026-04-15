import { Settings, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import NavItem from './NavItem';
import SidebarTooltip from './SidebarTooltip';

export default function SidebarFooter({ isExpanded, rtl, user, initials, onNavigate, onLogout, t }) {
  return (
    <div className="border-t py-3 px-3 space-y-1">
      <NavItem
        to="/dashboard/settings"
        icon={Settings}
        label={t('nav.settings')}
        isExpanded={isExpanded}
        rtl={rtl}
        onNavigate={onNavigate}
      />

      <Separator className="!my-1 transition-all duration-300" />

      <div
        className={cn(
          'overflow-hidden transition-all duration-300',
          isExpanded ? 'max-h-16 opacity-100' : 'max-h-0 opacity-0'
        )}
      >
        <div className="flex items-center gap-3 px-3 py-2">
          <Avatar className="h-8 w-8 shrink-0">
            <AvatarFallback className="text-xs bg-primary text-primary-foreground">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">
              {user?.firstName} {user?.lastName}
            </p>
            <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
          </div>
        </div>
      </div>

      <SidebarTooltip label={t('auth.logout')} rtl={rtl} show={!isExpanded}>
        <button
          type="button"
          onClick={onLogout}
          className={cn(
            'flex h-10 items-center rounded-md text-sm font-medium text-destructive overflow-hidden transition-all duration-300 hover:bg-destructive/10',
            isExpanded ? 'w-full gap-3 px-3' : 'gap-0 px-[14px]'
          )}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          <span
            className={cn(
              'truncate whitespace-nowrap transition-all duration-300',
              isExpanded ? 'opacity-100 max-w-[180px]' : 'opacity-0 max-w-0'
            )}
          >
            {t('auth.logout')}
          </span>
        </button>
      </SidebarTooltip>
    </div>
  );
}
