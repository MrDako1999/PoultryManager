// Single source of truth for per-module role capabilities, used by:
//   - Backend (protect middleware + userCan) to compute the effective
//     action list for a request.
//   - Mobile + web module registries to expose the same matrix to the
//     clients via /auth/me's moduleCapabilities payload.
//
// To add a new module's capabilities: drop a new file under
// shared/modules/<id>/capabilities.js exporting `<id>Capabilities`,
// then import + register it here.

import { broilerCapabilities } from './broiler/capabilities.js';

export const MODULE_CAPABILITIES = {
  broiler: broilerCapabilities,
};

export function getModuleCapabilities(moduleId) {
  return MODULE_CAPABILITIES[moduleId] || null;
}

// Returns the union of action strings granted by the user's role
// across all of the user's effectively-active modules. Consumed by
// userCan when an effectiveModules list is provided.
export function actionsForRoleAcrossModules(role, moduleIds) {
  if (!role || !Array.isArray(moduleIds)) return [];
  const seen = new Set();
  for (const id of moduleIds) {
    const map = MODULE_CAPABILITIES[id];
    if (!map) continue;
    const list = map[role];
    if (!Array.isArray(list)) continue;
    for (const action of list) seen.add(action);
  }
  return [...seen];
}
