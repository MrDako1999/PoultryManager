import { actionsForRoleAcrossModules } from './modules/index.js';

export const WILDCARD = '*';

export const DEFAULT_ROLE_ACTIONS = {
  owner: ['*'],

  manager: [
    'batch:*',
    'source:*',
    'feedOrder:*',
    'saleOrder:*',
    'expense:*',
    'dailyLog:*',
    'house:*',
    'farm:*',
    'worker:*',
    'contact:*',
    'business:*',
    'feedItem:*',
    'transfer:*',
    'media:*',
    'settings:read',
    'settings:business:read',
    'settings:accounting:read',
    'settings:saleDefaults:read',
  ],

  accountant: [
    'batch:read',
    'source:read',
    'feedOrder:*',
    'saleOrder:*',
    'expense:*',
    'business:read',
    'business:create',
    'business:update',
    'contact:read',
    'contact:create',
    'contact:update',
    'transfer:*',
    'media:read',
    'media:create',
    'settings:read',
    'settings:accounting:*',
    'settings:saleDefaults:*',
  ],

  veterinarian: [
    'batch:read',
    'house:read',
    'farm:read',
    'dailyLog:read',
    'dailyLog:create:WEIGHT',
    'dailyLog:create:ENVIRONMENT',
    'dailyLog:update:own',
    'worker:read',
    'contact:read',
    'business:read',
    'media:read',
    'media:create',
  ],

  ground_staff: [
    'batch:read',
    'house:read:assigned',
    'farm:read',
    'dailyLog:create',
    // Read all logs in the (farm-scoped) batches they can access so the
    // batch detail tabs can show team coverage and missing days. The
    // backend list filter still scopes to assigned farms via
    // [backend/services/workerScope.js], so this never leaks data out
    // of their assignment.
    'dailyLog:read',
    // Edit only logs they authored. Detail screens that surface the
    // edit affordance must check ownership before accepting the cap.
    'dailyLog:update:own',
    'media:create',
  ],

  // Slaughterhouse operational roles — minimal cross-cutting defaults.
  // The bulk of each role's permissions is granted via the per-module
  // capability matrix in shared/modules/slaughterhouse/capabilities.js,
  // which is merged in only when the user has the slaughterhouse module
  // enabled. The defaults here are limited to reads and media that
  // every operational role needs regardless of module context.
  gate_clerk: [
    'media:read',
    'media:create',
    'business:read',
    'contact:read',
  ],

  receiving_worker: [
    'media:read',
    'media:create',
  ],

  processing_supervisor: [
    'media:read',
    'media:create',
    'business:read',
    'contact:read',
    'worker:read',
  ],

  packing_worker: [
    'media:read',
    'media:create',
  ],

  cold_store_user: [
    'media:read',
    'media:create',
  ],

  dispatch_user: [
    'media:read',
    'media:create',
    'business:read',
    'contact:read',
  ],

  viewer: [
    'batch:read',
    'source:read',
    'feedOrder:read',
    'saleOrder:read',
    'expense:read',
    'dailyLog:read',
    'house:read',
    'farm:read',
    'worker:read',
    'contact:read',
    'business:read',
    'feedItem:read',
    'transfer:read',
    'media:read',
  ],
};

export function parseAction(action) {
  if (!action || typeof action !== 'string') return null;
  const [entity, verb, scope] = action.split(':');
  return { entity, verb, scope };
}

export function actionMatches(granted, requested) {
  if (!granted || !requested) return false;
  if (granted === WILDCARD) return true;
  if (granted === requested) return true;

  const g = parseAction(granted);
  const r = parseAction(requested);
  if (!g || !r) return false;

  if (g.entity !== WILDCARD && g.entity !== r.entity) return false;

  if (g.verb === WILDCARD) return true;
  if (g.verb !== r.verb) return false;

  if (!g.scope) return true;
  if (g.scope === WILDCARD) return true;
  return g.scope === r.scope;
}

export function actionsForRole(role) {
  return DEFAULT_ROLE_ACTIONS[role] || [];
}

// Computes the full effective action list for a user. The list is the
// union of (a) the user's explicit allows, (b) the global role defaults,
// and (c) the per-module role capabilities for every module currently
// active for the user. The user's deny list is applied at check time
// in `userCan`.
//
// `effectiveModules` is optional. When omitted, the function falls back
// to user.modules (which on owners is the source of truth and on
// sub-users may be stale; resolveModules() in backend/middleware/modules
// is the canonical resolver).
export function effectiveActionsForUser(user, effectiveModules) {
  if (!user) return [];
  const explicit = Array.isArray(user.permissions?.allow) ? user.permissions.allow : [];
  const roleDefaults = actionsForRole(user.accountRole);
  const modules = Array.isArray(effectiveModules)
    ? effectiveModules
    : (Array.isArray(user.modules) ? user.modules : []);
  const moduleActions = actionsForRoleAcrossModules(user.accountRole, modules);
  return [...new Set([...explicit, ...roleDefaults, ...moduleActions])];
}

export function userCan(user, requestedAction, effectiveModules) {
  if (!user || !requestedAction) return false;

  const denies = Array.isArray(user.permissions?.deny)
    ? user.permissions.deny
    : [];

  for (const denied of denies) {
    if (actionMatches(denied, requestedAction)) return false;
  }

  // Fast path: protect middleware attaches `effectiveActions` to the
  // user once per request so we don't re-walk the tree on every check.
  const granted = Array.isArray(user.effectiveActions)
    ? user.effectiveActions
    : effectiveActionsForUser(user, effectiveModules);

  for (const g of granted) {
    if (actionMatches(g, requestedAction)) return true;
  }

  return false;
}
