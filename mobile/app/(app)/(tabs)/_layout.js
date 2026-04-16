import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { LayoutDashboard, Egg, FolderOpen, Calculator, Settings } from 'lucide-react-native';
import useThemeStore from '@/stores/themeStore';
import useCapabilities from '@/hooks/useCapabilities';
import useModuleStore from '@/stores/moduleStore';
import { MODULES } from '@/modules/registry';

export default function TabsLayout() {
  const { t } = useTranslation();
  const { resolvedTheme } = useThemeStore();
  const { can } = useCapabilities();
  const activeModuleId = useModuleStore((s) => s.activeModule);
  const activeModule = activeModuleId ? MODULES[activeModuleId] : null;

  const activeColor = resolvedTheme === 'dark' ? 'hsl(148, 48%, 38%)' : 'hsl(148, 60%, 20%)';
  const inactiveColor = 'hsl(150, 10%, 45%)';
  const tabBarBg = resolvedTheme === 'dark' ? 'hsl(150, 20%, 8%)' : 'hsl(0, 0%, 100%)';
  const borderColor = resolvedTheme === 'dark' ? 'hsl(150, 14%, 15%)' : 'hsl(148, 14%, 87%)';

  const moduleTabNames = new Set((activeModule?.tabs || []).map((tab) => tab.name));
  const moduleTabMeta = Object.fromEntries(
    (activeModule?.tabs || []).map((tab) => [tab.name, tab])
  );

  function tabHref(tabName, capability, moduleTab) {
    if (moduleTab && !moduleTabNames.has(tabName)) return null;
    if (capability && !can(capability)) return null;
    return undefined;
  }

  const batchesTabConfig = moduleTabMeta.batches;
  const batchesVisible = batchesTabConfig && can(batchesTabConfig.capability || 'batch:read');

  const accountingVisible = can('expense:read') || can('saleOrder:read');

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: activeColor,
        tabBarInactiveTintColor: inactiveColor,
        tabBarStyle: {
          backgroundColor: tabBarBg,
          borderTopColor: borderColor,
        },
        tabBarLabelStyle: {
          fontFamily: 'Poppins-Medium',
          fontSize: 10,
        },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: t('nav.dashboard'),
          tabBarIcon: ({ color, size }) => <LayoutDashboard size={size - 2} color={color} />,
        }}
      />
      <Tabs.Screen
        name="batches"
        options={{
          title: t('nav.batches'),
          tabBarIcon: ({ color, size }) => <Egg size={size - 2} color={color} />,
          href: batchesVisible ? undefined : null,
        }}
      />
      <Tabs.Screen
        name="directory"
        options={{
          title: t('nav.directory', 'Directory'),
          tabBarIcon: ({ color, size }) => <FolderOpen size={size - 2} color={color} />,
        }}
      />
      <Tabs.Screen
        name="accounting"
        options={{
          title: t('nav.accounting', 'Accounting'),
          tabBarIcon: ({ color, size }) => <Calculator size={size - 2} color={color} />,
          href: accountingVisible ? undefined : null,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t('nav.settings'),
          tabBarIcon: ({ color, size }) => <Settings size={size - 2} color={color} />,
        }}
      />
    </Tabs>
  );
}
