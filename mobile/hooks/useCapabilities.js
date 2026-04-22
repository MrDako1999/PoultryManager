import { useMemo } from 'react';
import { actionMatches, actionsForRole } from '@poultrymanager/shared';
import useAuthStore from '@/stores/authStore';
import useModuleStore from '@/stores/moduleStore';

// Lazy-load the registry to break the require cycle:
// useCapabilities -> registry -> broiler/index -> widgets -> useCapabilities.
function getRegistry() {
  return require('@/modules/registry');
}

function collectModuleCaps(visibleModules, role) {
  const { MODULES } = getRegistry();
  const caps = new Set();
  for (const id of visibleModules) {
    const mod = MODULES[id];
    const roleCaps = mod?.capabilities?.[role];
    if (Array.isArray(roleCaps)) {
      for (const c of roleCaps) caps.add(c);
    }
  }
  return Array.from(caps);
}

export default function useCapabilities() {
  const user = useAuthStore((s) => s.user);
  const activeModule = useModuleStore((s) => s.activeModule);

  const role = user?.accountRole || 'viewer';
  const userModules = Array.isArray(user?.modules) ? user.modules : [];

  const visibleModules = useMemo(
    () => {
      const { MODULE_ORDER } = getRegistry();
      return MODULE_ORDER.filter((m) => userModules.includes(m));
    },
    [userModules.join(',')] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const workspace = user?.workspace || {
    ownerId: user?._id,
    ownerName: '',
    ownerBusiness: user?.accountBusiness || null,
    isOwner: !user?.createdBy,
  };

  const grantedActions = useMemo(() => {
    const explicit = Array.isArray(user?.permissions?.allow) ? user.permissions.allow : [];
    // Union the cached `/auth/me` defaults with the LIVE shared role
    // defaults from the bundled `shared/permissions.js`. Without this
    // union, a permissions upgrade (e.g. ground_staff gaining
    // `dailyLog:read` to power the new BatchDetail tabs) wouldn't
    // take effect for any existing session until the user explicitly
    // logged out and back in — `/auth/me` only refreshes on
    // `checkAuth()`/`refreshUser()`, not on a JS hot reload. Unioning
    // is safe because deny[] is enforced separately and removing a
    // default cap is something the server should do via deny[]
    // anyway, not by reducing the role defaults.
    const cachedDefaults = Array.isArray(user?.permissions?.defaults)
      ? user.permissions.defaults
      : [];
    const liveRoleDefaults = actionsForRole(role);
    const moduleCaps = collectModuleCaps(visibleModules, role);
    return Array.from(new Set([
      ...explicit,
      ...cachedDefaults,
      ...liveRoleDefaults,
      ...moduleCaps,
    ]));
  }, [user?.permissions?.allow, user?.permissions?.defaults, role, visibleModules.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  const denies = useMemo(
    () => (Array.isArray(user?.permissions?.deny) ? user.permissions.deny : []),
    [user?.permissions?.deny]
  );

  function can(requestedAction) {
    if (!requestedAction || !user) return false;
    for (const denied of denies) {
      if (actionMatches(denied, requestedAction)) return false;
    }
    for (const g of grantedActions) {
      if (actionMatches(g, requestedAction)) return true;
    }
    return false;
  }

  function hasModule(id) {
    return visibleModules.includes(id);
  }

  return {
    user,
    role,
    workspace,
    visibleModules,
    hasModule,
    activeModule,
    can,
  };
}
