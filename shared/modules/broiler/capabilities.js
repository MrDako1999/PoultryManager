// Per-module role capabilities for the broiler module.
//
// These actions are merged with the global DEFAULT_ROLE_ACTIONS in
// shared/permissions.js when the broiler module is active for the
// effective user. Module capabilities are ADDITIVE — they only grant
// extra actions; subtraction is what user.permissions.deny[] is for.
//
// Both the backend (via protect/userCan) and the clients (mobile +
// frontend module registries) import from this single file so the
// capability matrix never drifts between platforms.

export const broilerCapabilities = {
  owner: ['*'],
  manager: [
    'batch:*', 'source:*', 'feedOrder:*', 'saleOrder:*', 'expense:*',
    'dailyLog:*', 'house:*', 'farm:*', 'worker:*', 'contact:*',
    'business:*', 'feedItem:*', 'transfer:*',
  ],
  accountant: [
    'batch:read', 'source:read', 'feedOrder:*', 'saleOrder:*', 'expense:*',
    'business:read', 'contact:read', 'transfer:*',
  ],
  veterinarian: [
    'batch:read', 'house:read', 'farm:read', 'worker:read', 'contact:read',
    'business:read', 'dailyLog:read', 'dailyLog:create:WEIGHT',
    'dailyLog:create:ENVIRONMENT', 'dailyLog:update:own',
  ],
  ground_staff: [
    'batch:read', 'house:read:assigned', 'dailyLog:create',
    'dailyLog:read:own', 'dailyLog:update:own', 'farm:read',
  ],
  viewer: [
    'batch:read', 'source:read', 'feedOrder:read', 'saleOrder:read',
    'expense:read', 'dailyLog:read', 'house:read', 'farm:read',
    'worker:read', 'contact:read', 'business:read', 'feedItem:read',
    'transfer:read',
  ],
};

export default broilerCapabilities;
