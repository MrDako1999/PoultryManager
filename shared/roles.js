export const ACCOUNT_ROLES = [
  'owner',
  'manager',
  'veterinarian',
  'accountant',
  'ground_staff',
  'gate_clerk',
  'receiving_worker',
  'processing_supervisor',
  'packing_worker',
  'cold_store_user',
  'dispatch_user',
  'viewer',
];

export const ROLE_META = {
  owner: {
    id: 'owner',
    labelKey: 'settings.roles.owner',
    descKey: 'settings.roles.ownerDesc',
    isSystem: true,
  },
  manager: {
    id: 'manager',
    labelKey: 'settings.roles.manager',
    descKey: 'settings.roles.managerDesc',
    isSystem: false,
  },
  veterinarian: {
    id: 'veterinarian',
    labelKey: 'settings.roles.veterinarian',
    descKey: 'settings.roles.veterinarianDesc',
    isSystem: false,
  },
  accountant: {
    id: 'accountant',
    labelKey: 'settings.roles.accountant',
    descKey: 'settings.roles.accountantDesc',
    isSystem: false,
  },
  ground_staff: {
    id: 'ground_staff',
    labelKey: 'settings.roles.ground_staff',
    descKey: 'settings.roles.ground_staffDesc',
    isSystem: false,
  },
  gate_clerk: {
    id: 'gate_clerk',
    labelKey: 'settings.roles.gate_clerk',
    descKey: 'settings.roles.gate_clerkDesc',
    isSystem: false,
  },
  receiving_worker: {
    id: 'receiving_worker',
    labelKey: 'settings.roles.receiving_worker',
    descKey: 'settings.roles.receiving_workerDesc',
    isSystem: false,
  },
  processing_supervisor: {
    id: 'processing_supervisor',
    labelKey: 'settings.roles.processing_supervisor',
    descKey: 'settings.roles.processing_supervisorDesc',
    isSystem: false,
  },
  packing_worker: {
    id: 'packing_worker',
    labelKey: 'settings.roles.packing_worker',
    descKey: 'settings.roles.packing_workerDesc',
    isSystem: false,
  },
  cold_store_user: {
    id: 'cold_store_user',
    labelKey: 'settings.roles.cold_store_user',
    descKey: 'settings.roles.cold_store_userDesc',
    isSystem: false,
  },
  dispatch_user: {
    id: 'dispatch_user',
    labelKey: 'settings.roles.dispatch_user',
    descKey: 'settings.roles.dispatch_userDesc',
    isSystem: false,
  },
  viewer: {
    id: 'viewer',
    labelKey: 'settings.roles.viewer',
    descKey: 'settings.roles.viewerDesc',
    isSystem: false,
  },
};

export function isValidRole(role) {
  return ACCOUNT_ROLES.includes(role);
}

export function getRoleMeta(role) {
  return ROLE_META[role] || null;
}
