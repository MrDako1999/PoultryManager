import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { LayoutDashboard, Egg, FolderOpen, Calculator, Settings } from 'lucide-react-native';
import useThemeStore from '../../../stores/themeStore';

export default function TabsLayout() {
  const { t } = useTranslation();
  const { resolvedTheme } = useThemeStore();

  const activeColor = resolvedTheme === 'dark' ? 'hsl(148, 48%, 38%)' : 'hsl(148, 60%, 20%)';
  const inactiveColor = 'hsl(150, 10%, 45%)';
  const tabBarBg = resolvedTheme === 'dark' ? 'hsl(150, 20%, 8%)' : 'hsl(0, 0%, 100%)';
  const borderColor = resolvedTheme === 'dark' ? 'hsl(150, 14%, 15%)' : 'hsl(148, 14%, 87%)';

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
