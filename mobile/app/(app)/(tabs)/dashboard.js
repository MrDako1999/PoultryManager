import { useMemo } from 'react';
import { View, Text, ScrollView, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import useAuthStore from '@/stores/authStore';
import useThemeStore from '@/stores/themeStore';
import useCapabilities from '@/hooks/useCapabilities';
import SyncIconButton from '@/components/SyncIconButton';
import ModuleSwitcher from '@/shared/components/ModuleSwitcher';
import { MODULES } from '@/modules/registry';

const logoLight = require('@/assets/images/logo.png');
const logoDark = require('@/assets/images/logo-white.png');

export default function DashboardScreen() {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const { resolvedTheme } = useThemeStore();
  const insets = useSafeAreaInsets();
  const { visibleModules, can, role, activeModule } = useCapabilities();

  const RoleDashboard = useMemo(() => {
    const mod = activeModule ? MODULES[activeModule] : null;
    return mod?.roleDashboards?.[role] || null;
  }, [activeModule, role]);

  const widgets = useMemo(() => {
    const out = [];
    for (const id of visibleModules) {
      const mod = MODULES[id];
      for (const widget of mod?.dashboardWidgets || []) {
        if (widget.capability && !can(widget.capability)) continue;
        out.push({ ...widget, moduleId: id });
      }
    }
    out.sort((a, b) => (a.order || 0) - (b.order || 0));
    return out;
  }, [visibleModules, can]);

  if (RoleDashboard) {
    return <RoleDashboard />;
  }

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 16 }}
    >
      <View className="px-4 mb-4">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center flex-1 gap-3">
            <Image
              source={resolvedTheme === 'dark' ? logoDark : logoLight}
              className="h-9 w-9 rounded-xl"
              resizeMode="contain"
            />
            <View className="flex-1">
              <Text className="text-2xl font-bold text-foreground">
                {t('dashboard.welcome', { name: user?.firstName || '' })}
              </Text>
              <Text className="text-sm text-muted-foreground">{t('dashboard.overview')}</Text>
            </View>
          </View>
          <View className="flex-row items-center gap-2">
            <ModuleSwitcher compact />
            <SyncIconButton />
          </View>
        </View>
      </View>

      {widgets.map((widget) => {
        const W = widget.component;
        if (!W) return null;
        return (
          <View key={`${widget.moduleId}:${widget.id}`} className="px-4 mb-4">
            <W />
          </View>
        );
      })}

      {widgets.length === 0 && (
        <View className="px-4 mb-4">
          <Text className="text-sm text-muted-foreground text-center py-10">
            {t('dashboard.noWidgets', 'No dashboard widgets available for your role.')}
          </Text>
        </View>
      )}
    </ScrollView>
  );
}
