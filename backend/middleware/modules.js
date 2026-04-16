import User from '../models/User.js';
import { isValidModule } from '@poultrymanager/shared';

const _ownerModulesCache = new Map();
const CACHE_TTL_MS = 30_000;

async function getOwnerModules(userId) {
  if (!userId) return [];

  const cached = _ownerModulesCache.get(String(userId));
  if (cached && cached.expires > Date.now()) return cached.modules;

  const owner = await User.findById(userId).select('modules');
  const modules = Array.isArray(owner?.modules) ? owner.modules : [];

  _ownerModulesCache.set(String(userId), {
    modules,
    expires: Date.now() + CACHE_TTL_MS,
  });
  return modules;
}

export function invalidateOwnerModulesCache(userId) {
  if (userId) _ownerModulesCache.delete(String(userId));
  else _ownerModulesCache.clear();
}

export async function resolveModules(user) {
  if (!user) return [];
  if (!user.createdBy) {
    return Array.isArray(user.modules) ? user.modules : [];
  }
  return getOwnerModules(user.createdBy);
}

export const requireModule = (moduleId) => async (req, res, next) => {
  try {
    if (!isValidModule(moduleId)) {
      return res.status(500).json({ message: `Unknown module: ${moduleId}` });
    }
    const effective = await resolveModules(req.user);
    if (!effective.includes(moduleId)) {
      return res.status(403).json({ message: `Module '${moduleId}' is not active for this account` });
    }
    req.effectiveModules = effective;
    next();
  } catch (err) {
    next(err);
  }
};

export const attachEffectiveModules = async (req, res, next) => {
  try {
    req.effectiveModules = await resolveModules(req.user);
    next();
  } catch (err) {
    next(err);
  }
};
