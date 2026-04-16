export const ACCOUNT_ROLES = [
  'owner',
  'manager',
  'veterinarian',
  'accountant',
  'ground_staff',
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
