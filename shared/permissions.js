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
    'dailyLog:create',
    'dailyLog:read:own',
    'dailyLog:update:own',
    'farm:read',
    'media:create',
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

export function userCan(user, requestedAction) {
  if (!user || !requestedAction) return false;

  const explicit = Array.isArray(user.permissions?.allow)
    ? user.permissions.allow
    : [];
  const denies = Array.isArray(user.permissions?.deny)
    ? user.permissions.deny
    : [];
  const roleDefaults = actionsForRole(user.accountRole);

  for (const denied of denies) {
    if (actionMatches(denied, requestedAction)) return false;
  }

  const granted = [...explicit, ...roleDefaults];
  for (const g of granted) {
    if (actionMatches(g, requestedAction)) return true;
  }

  return false;
}
