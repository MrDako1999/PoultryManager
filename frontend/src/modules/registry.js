import { MODULE_IDS } from '@poultrymanager/shared';
import { addModuleResources } from '@/i18n';
import broiler from './broiler/index.js';
import slaughterhouse from './slaughterhouse/index.js';

export const MODULES = {
  [broiler.id]: broiler,
  [slaughterhouse.id]: slaughterhouse,
};

export const MODULE_ORDER = MODULE_IDS.filter((id) => !!MODULES[id]);

export function getModule(id) {
  return MODULES[id] || null;
}

export function validateRegistry({ throwOnError = true } = {}) {
  const errors = [];
  for (const [id, mod] of Object.entries(MODULES)) {
    if (!mod || mod.id !== id) errors.push(`Module "${id}" missing or id mismatch`);
    if (mod && (!mod.sync || !Array.isArray(mod.sync.tables))) errors.push(`Module "${id}" missing sync.tables`);
    if (mod && (!mod.capabilities || typeof mod.capabilities !== 'object')) errors.push(`Module "${id}" missing capabilities map`);
  }
  if (errors.length && throwOnError) throw new Error('Module registry validation failed:\n - ' + errors.join('\n - '));
  return errors;
}

// Register each module's i18n bundle under modules.<id>.* (with a top-level
// back-compat mirror during the transition — see i18n/index.js for details).
for (const mod of Object.values(MODULES)) {
  if (mod?.i18n) addModuleResources(mod.id, mod.i18n);
}
