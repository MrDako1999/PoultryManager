import { useTranslation } from 'react-i18next';
import { ChevronsUpDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import useCapabilities from '@/hooks/useCapabilities';
import useModuleStore from '@/stores/moduleStore';
import { MODULES } from '@/modules/registry';

export default function ModuleSwitcher({ compact = false }) {
  const { t } = useTranslation();
  const { visibleModules } = useCapabilities();
  const activeModuleId = useModuleStore((s) => s.activeModule);
  const setActiveModule = useModuleStore((s) => s.setActiveModule);

  if (!visibleModules || visibleModules.length < 2) return null;

  const active = activeModuleId ? MODULES[activeModuleId] : null;
  const ActiveIcon = active?.icon;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            'w-full justify-between gap-2 h-9',
            compact && 'w-9 h-9 p-0 justify-center',
          )}
        >
          <span className="flex items-center gap-2 min-w-0">
            {ActiveIcon && <ActiveIcon className="h-4 w-4 shrink-0" />}
            {!compact && (
              <span className="truncate text-sm">
                {active ? t(active.labelKey, activeModuleId) : t('modules.none', 'Select module')}
              </span>
            )}
          </span>
          {!compact && <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-60" />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>{t('modules.switcherTitle', 'Switch module')}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {visibleModules.map((id) => {
          const mod = MODULES[id];
          if (!mod) return null;
          const Icon = mod.icon;
          const isActive = id === activeModuleId;
          return (
            <DropdownMenuItem
              key={id}
              onSelect={() => setActiveModule(id)}
              className="flex items-center gap-2"
            >
              {Icon && <Icon className="h-4 w-4 shrink-0" />}
              <span className="flex-1">{t(mod.labelKey, id)}</span>
              {isActive && <Check className="h-3.5 w-3.5" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
