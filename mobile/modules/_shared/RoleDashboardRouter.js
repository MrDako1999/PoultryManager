import { MODULES } from '@/modules/registry';

/**
 * Resolves the role-specific dashboard component for the active module
 * and current user role. Returns null when the active module doesn't
 * declare a `roleDashboards[role]` override, in which case the standard
 * widget grid renders instead.
 *
 * Why a router: each module owns its own role dashboards (broiler ships
 * a `WorkerHome`, egg-production will ship its own egg-collection
 * worker home, etc.). Centralising the lookup here means the dashboard
 * tab never needs to know which modules exist — adding a new module
 * with a `roleDashboards.ground_staff` override Just Works.
 */
export function resolveRoleDashboard(activeModuleId, role) {
  if (!activeModuleId || !role) return null;
  const mod = MODULES[activeModuleId];
  return mod?.roleDashboards?.[role] || null;
}

/**
 * Same lookup pattern for the Tasks tab. Each module that ships a
 * worker-style tasks screen declares it under `roleTasks[role]`.
 * Falls back to null when nothing is registered, in which case the
 * Tasks tab itself shouldn't be mounted.
 */
export function resolveRoleTasks(activeModuleId, role) {
  if (!activeModuleId || !role) return null;
  const mod = MODULES[activeModuleId];
  return mod?.roleTasks?.[role] || null;
}

/**
 * React component that renders the resolved role dashboard, or null
 * when none applies. Lets the dashboard tab stay declarative:
 *   const Override = useRoleDashboard(activeModule, role);
 *   if (Override) return <Override />;
 */
export default function RoleDashboardRouter({ activeModule, role, ...props }) {
  const Component = resolveRoleDashboard(activeModule, role);
  if (!Component) return null;
  return <Component {...props} />;
}

export function RoleTasksRouter({ activeModule, role, ...props }) {
  const Component = resolveRoleTasks(activeModule, role);
  if (!Component) return null;
  return <Component {...props} />;
}
