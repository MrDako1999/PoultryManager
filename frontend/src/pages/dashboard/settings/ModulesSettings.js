import { useTranslation } from 'react-i18next';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Bird,
  Egg,
  Feather,
  Factory,
  Warehouse,
  ShoppingBag,
  Wrench,
  Check,
  Lock,
} from 'lucide-react';
import useAuthStore from '@/stores/authStore';
import { MODULE_IDS, MODULE_CATALOG } from '@poultrymanager/shared';

// Map the shared catalog's icon names to actual lucide icons.
const ICON_MAP = {
  Bird, Egg, Feather, Factory, ShoppingBag, Wrench, Warehouse,
};

const COLOR_MAP = {
  broiler: 'text-emerald-600 dark:text-emerald-400',
  hatchery: 'text-amber-600 dark:text-amber-400',
  freeRange: 'text-sky-600 dark:text-sky-400',
  eggProduction: 'text-orange-600 dark:text-orange-400',
  slaughterhouse: 'text-red-600 dark:text-red-400',
  marketing: 'text-purple-600 dark:text-purple-400',
  equipment: 'text-slate-600 dark:text-slate-400',
};

export default function ModulesSettings() {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const activeModules = user?.modules || [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('settings.modulesTitle')}</CardTitle>
        <CardDescription>{t('settings.modulesDesc')}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-2">
          {MODULE_IDS.map((moduleKey) => {
            const catalog = MODULE_CATALOG[moduleKey] || {};
            const isActive = activeModules.includes(moduleKey);
            const Icon = ICON_MAP[catalog.icon] || Warehouse;
            const colorClass = COLOR_MAP[moduleKey] || 'text-muted-foreground';

            return (
              <div
                key={moduleKey}
                className={`flex items-center gap-4 rounded-lg border p-4 transition-colors ${
                  isActive ? 'border-primary/30 bg-primary/5' : 'opacity-60'
                }`}
              >
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                    isActive ? 'bg-primary/10' : 'bg-muted'
                  }`}
                >
                  <Icon className={`h-5 w-5 ${isActive ? colorClass : 'text-muted-foreground'}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{t(`modules.${moduleKey}`, moduleKey)}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {t(`modules.${moduleKey}Desc`, '')}
                  </p>
                </div>
                {isActive ? (
                  <Badge variant="success" className="shrink-0 gap-1">
                    <Check className="h-3 w-3" />
                    {t('common.active')}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="shrink-0 gap-1">
                    <Lock className="h-3 w-3" />
                    {t('modules.comingSoon')}
                  </Badge>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
