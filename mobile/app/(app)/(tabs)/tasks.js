import { useMemo } from 'react';
import { View } from 'react-native';
import { Redirect } from 'expo-router';
import useCapabilities from '@/hooks/useCapabilities';
import { resolveRoleTasks } from '@/modules/_shared/RoleDashboardRouter';
import { useHeroSheetTokens } from '@/components/HeroSheetScreen';

/**
 * Tasks tab. Resolves the per-module, per-role tasks screen via the
 * same router pattern used by the dashboard tab. Mounted in the tab
 * layout only for roles that have a registered screen for the active
 * module — currently `ground_staff` on broiler.
 *
 * If a user with no registered screen deep-links to /tasks (shouldn't
 * happen via the tab bar, but defensively) we redirect them home.
 */
export default function TasksTab() {
  const { role, activeModule } = useCapabilities();
  const { screenBg } = useHeroSheetTokens();

  const Screen = useMemo(
    () => resolveRoleTasks(activeModule, role),
    [activeModule, role]
  );

  if (!Screen) {
    return <Redirect href="/(app)/(tabs)/dashboard" />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: screenBg }}>
      <Screen />
    </View>
  );
}
