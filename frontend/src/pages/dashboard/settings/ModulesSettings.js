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

const MODULE_META = {
  broiler: { icon: Bird, color: 'text-emerald-600 dark:text-emerald-400' },
  hatchery: { icon: Egg, color: 'text-amber-600 dark:text-amber-400' },
  freeRange: { icon: Feather, color: 'text-sky-600 dark:text-sky-400' },
  eggProduction: { icon: Egg, color: 'text-orange-600 dark:text-orange-400' },
  slaughterhouse: { icon: Factory, color: 'text-red-600 dark:text-red-400' },
  marketing: { icon: ShoppingBag, color: 'text-purple-600 dark:text-purple-400' },
  equipment: { icon: Wrench, color: 'text-slate-600 dark:text-slate-400' },
};

const ALL_MODULES = [
  'broiler',
  'hatchery',
  'freeRange',
  'eggProduction',
  'slaughterhouse',
  'marketing',
  'equipment',
];

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
          {ALL_MODULES.map((moduleKey) => {
            const isActive = activeModules.includes(moduleKey);
            const meta = MODULE_META[moduleKey] || { icon: Warehouse, color: 'text-muted-foreground' };
            const Icon = meta.icon;

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
                  <Icon className={`h-5 w-5 ${isActive ? meta.color : 'text-muted-foreground'}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{t(`modules.${moduleKey}`)}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {t(`modules.${moduleKey}Desc`)}
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
