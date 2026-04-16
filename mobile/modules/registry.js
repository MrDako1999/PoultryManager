import { MODULE_IDS } from '@poultrymanager/shared';
import { addModuleResources } from '@/i18n';
import broiler from './broiler/index.js';

export const MODULES = {
  [broiler.id]: broiler,
};

// Register each module's i18n bundle. This must run AFTER the i18n instance is
// initialized — `@/i18n` does that synchronously on import. Bundles are stored
// under `moduleResources.<id>.*` and mirrored at the top level for back-compat.
for (const mod of Object.values(MODULES)) {
  if (mod?.i18n) addModuleResources(mod.id, mod.i18n);
}

export const MODULE_ORDER = MODULE_IDS.filter((id) => !!MODULES[id]);

export function getModule(id) {
  return MODULES[id] || null;
}

export function validateRegistry({ throwOnError = true } = {}) {
  const errors = [];

  for (const [id, mod] of Object.entries(MODULES)) {
    if (!mod || mod.id !== id) {
      errors.push(`Module "${id}" missing or id mismatch`);
      continue;
    }

    if (!mod.sync || !Array.isArray(mod.sync.tables)) {
      errors.push(`Module "${id}" missing sync.tables`);
    }
    if (!mod.capabilities || typeof mod.capabilities !== 'object') {
      errors.push(`Module "${id}" missing capabilities map`);
    }
  }

  if (errors.length && throwOnError) {
    throw new Error(`Module registry validation failed:\n - ${errors.join('\n - ')}`);
  }
  return errors;
}

export function allModuleMigrations() {
  const out = [];
  for (const mod of Object.values(MODULES)) {
    if (Array.isArray(mod.migrations)) out.push(...mod.migrations);
  }
  return out;
}

export function allModuleI18n() {
  const out = {};
  for (const mod of Object.values(MODULES)) {
    if (!mod.i18n) continue;
    out[mod.id] = mod.i18n;
  }
  return out;
}
