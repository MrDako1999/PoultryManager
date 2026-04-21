import Worker from '../models/Worker.js';
import House from '../models/House.js';

/**
 * Per-user data-scope helpers.
 *
 * Sub-users are scoped to a set of farms (Worker.farmAssignments).
 * Owners are unscoped — they see everything in their workspace.
 *
 * Three return values matter:
 *   - null  -> no scope filter applies (owner / sub-user without a Worker record)
 *   - []    -> sub-user explicitly assigned to NO farms; sees nothing
 *   - [id]  -> scoped to these ids
 *
 * Callers convert null to "skip the filter" and any array to a Mongo
 * `{ $in: ids }` clause. Keep this distinction precise — collapsing
 * null and [] silently breaks owner access.
 *
 * See WORKERS.md and DATA_OWNERSHIP.md for the surrounding invariants.
 */

export async function getAssignedFarmIds(user) {
  if (!user || !user.createdBy) return null;
  const worker = await Worker.findOne({ linkedUser: user._id, deletedAt: null })
    .select('farmAssignments');
  if (!worker) return null;
  return (worker.farmAssignments || []).map(String);
}

export async function getAssignedHouseIds(user) {
  if (!user || !user.createdBy) return null;
  const worker = await Worker.findOne({ linkedUser: user._id, deletedAt: null })
    .select('houseAssignments farmAssignments');
  if (!worker) return null;

  const farmHouseIds = worker.farmAssignments?.length
    ? await House.find({
        farm: { $in: worker.farmAssignments },
        deletedAt: null,
      }).distinct('_id')
    : [];

  return [
    ...new Set([
      ...(worker.houseAssignments || []).map(String),
      ...farmHouseIds.map(String),
    ]),
  ];
}

/**
 * Helper for list-route filters. Given a scope helper result and the
 * field name to filter on, returns either a partial Mongo filter
 * fragment to spread into the query, or null when no scoping applies.
 *
 *   const farmFilter = scopeFilter(await getAssignedFarmIds(user), 'farm');
 *   const docs = await House.find({ user_id: ownerId, ...farmFilter });
 */
export function scopeFilter(scopeIds, field) {
  if (scopeIds === null) return {};
  return { [field]: { $in: scopeIds } };
}
