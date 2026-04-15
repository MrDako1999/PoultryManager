import {
  Menu,
  Sun,
  Moon,
  ChevronDown,
  Settings,
  LogOut,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import SyncIndicator from '@/components/SyncIndicator';

export default function Topbar({ onOpenSidebar, user, initials, rtl, resolvedTheme, onToggleTheme, onLogout }) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const ThemeIcon = resolvedTheme === 'dark' ? Sun : Moon;

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-card px-4 lg:px-6">
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        onClick={onOpenSidebar}
      >
        <Menu className="h-5 w-5" />
      </Button>

      <div className="flex-1" />

      <SyncIndicator />

      <Button variant="ghost" size="icon" onClick={onToggleTheme} aria-label={t('common.theme')}>
        <ThemeIcon className="h-5 w-5" />
      </Button>

      <Separator orientation="vertical" className="h-6" />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="flex items-center gap-2 px-2">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="text-xs bg-primary text-primary-foreground">
                {initials}
              </AvatarFallback>
            </Avatar>
            <span className="hidden sm:inline-block text-sm font-medium">
              {user?.firstName}
            </span>
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align={rtl ? 'start' : 'end'} className="w-48">
          <DropdownMenuLabel>
            {user?.firstName} {user?.lastName}
            <p className="text-xs font-normal text-muted-foreground">{user?.email}</p>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => navigate('/dashboard/settings')}>
            <Settings className="mr-2 h-4 w-4 rtl:mr-0 rtl:ml-2" />
            {t('nav.settings')}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onLogout} className="text-destructive">
            <LogOut className="mr-2 h-4 w-4 rtl:mr-0 rtl:ml-2" />
            {t('auth.logout')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
