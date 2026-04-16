import { View, Text, ScrollView, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import {
  ChevronLeft, Bird, Egg, Feather, Factory, ShoppingBag, Wrench, Check, Lock,
} from 'lucide-react-native';
import useAuthStore from '@/stores/authStore';
import useThemeStore from '@/stores/themeStore';
import { Badge } from '@/components/ui/Badge';

const MODULE_META = {
  broiler: { icon: Bird, color: '#059669', darkColor: '#34d399' },
  hatchery: { icon: Egg, color: '#d97706', darkColor: '#fbbf24' },
  freeRange: { icon: Feather, color: '#0284c7', darkColor: '#38bdf8' },
  eggProduction: { icon: Egg, color: '#ea580c', darkColor: '#fb923c' },
  slaughterhouse: { icon: Factory, color: '#dc2626', darkColor: '#f87171' },
  marketing: { icon: ShoppingBag, color: '#9333ea', darkColor: '#a78bfa' },
  equipment: { icon: Wrench, color: '#475569', darkColor: '#94a3b8' },
};

const ALL_MODULES = [
  'broiler', 'hatchery', 'freeRange', 'eggProduction', 'slaughterhouse', 'marketing', 'equipment',
];

export default function SettingsModulesScreen() {
  const { t } = useTranslation();
  const { resolvedTheme } = useThemeStore();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const activeModules = user?.modules || [];
  const isDark = resolvedTheme === 'dark';
  const primaryColor = isDark ? 'hsl(148, 48%, 38%)' : 'hsl(148, 60%, 20%)';

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <View className="flex-row items-center px-2 pt-2 pb-3 border-b border-border">
        <Pressable onPress={() => router.back()} className="p-2 -ml-1 active:opacity-60">
          <ChevronLeft size={24} color={primaryColor} />
        </Pressable>
        <View className="flex-1">
          <Text className="text-lg font-bold text-foreground">
            {t('settings.modules', 'Modules')}
          </Text>
          <Text className="text-xs text-muted-foreground">
            {t('settings.modulesDesc', 'Active poultry modules on your account')}
          </Text>
        </View>
      </View>

      <ScrollView
        className="flex-1 px-4 pt-4"
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
      >
        {ALL_MODULES.map((moduleKey) => {
          const isActive = activeModules.includes(moduleKey);
          const meta = MODULE_META[moduleKey] || { icon: Wrench, color: '#475569', darkColor: '#94a3b8' };
          const Icon = meta.icon;
          const iconColor = isDark ? meta.darkColor : meta.color;

          return (
            <View
              key={moduleKey}
              className={`flex-row items-center gap-3 rounded-xl border p-4 mb-3 ${
                isActive ? 'border-primary/30 bg-primary/5' : 'border-border opacity-60'
              }`}
            >
              <View
                className={`h-10 w-10 rounded-xl items-center justify-center ${
                  isActive ? 'bg-primary/10' : 'bg-muted'
                }`}
              >
                <Icon size={20} color={isActive ? iconColor : (isDark ? '#94a3b8' : '#94a3b8')} />
              </View>
              <View className="flex-1 min-w-0">
                <Text className="text-sm font-medium text-foreground">
                  {t(`modules.${moduleKey}`, moduleKey)}
                </Text>
                <Text className="text-xs text-muted-foreground" numberOfLines={1}>
                  {t(`modules.${moduleKey}Desc`, '')}
                </Text>
              </View>
              {isActive ? (
                <View className="flex-row items-center gap-1 bg-primary/10 rounded-full px-2.5 py-1">
                  <Check size={12} color={primaryColor} />
                  <Text className="text-xs font-medium text-primary">{t('common.active', 'Active')}</Text>
                </View>
              ) : (
                <View className="flex-row items-center gap-1 border border-border rounded-full px-2.5 py-1">
                  <Lock size={12} color={isDark ? '#94a3b8' : '#94a3b8'} />
                  <Text className="text-xs text-muted-foreground">{t('modules.comingSoon', 'Coming Soon')}</Text>
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}
