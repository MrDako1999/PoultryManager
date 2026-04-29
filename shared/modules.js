export const MODULE_IDS = [
  'broiler',
  'hatchery',
  'freeRange',
  'eggProduction',
  'slaughterhouse',
  'marketing',
  'equipment',
];

export const MODULE_CATALOG = {
  broiler: {
    id: 'broiler',
    labelKey: 'modules.broiler',
    descKey: 'modules.broilerDesc',
    icon: 'Bird',
    color: { light: '#059669', dark: '#34d399' },
    available: true,
  },
  hatchery: {
    id: 'hatchery',
    labelKey: 'modules.hatchery',
    descKey: 'modules.hatcheryDesc',
    icon: 'Egg',
    color: { light: '#d97706', dark: '#fbbf24' },
    available: false,
  },
  freeRange: {
    id: 'freeRange',
    labelKey: 'modules.freeRange',
    descKey: 'modules.freeRangeDesc',
    icon: 'Feather',
    color: { light: '#0284c7', dark: '#38bdf8' },
    available: false,
  },
  eggProduction: {
    id: 'eggProduction',
    labelKey: 'modules.eggProduction',
    descKey: 'modules.eggProductionDesc',
    icon: 'Egg',
    color: { light: '#ea580c', dark: '#fb923c' },
    available: false,
  },
  slaughterhouse: {
    id: 'slaughterhouse',
    labelKey: 'modules.slaughterhouse',
    descKey: 'modules.slaughterhouseDesc',
    icon: 'Factory',
    color: { light: '#dc2626', dark: '#f87171' },
    available: true,
  },
  marketing: {
    id: 'marketing',
    labelKey: 'modules.marketing',
    descKey: 'modules.marketingDesc',
    icon: 'ShoppingBag',
    color: { light: '#9333ea', dark: '#a78bfa' },
    available: false,
  },
  equipment: {
    id: 'equipment',
    labelKey: 'modules.equipment',
    descKey: 'modules.equipmentDesc',
    icon: 'Wrench',
    color: { light: '#475569', darkColor: '#94a3b8' },
    available: false,
  },
};

export function isValidModule(moduleId) {
  return MODULE_IDS.includes(moduleId);
}

export function getModuleMeta(moduleId) {
  return MODULE_CATALOG[moduleId] || null;
}
