import User from '../models/User.js';
import Worker from '../models/Worker.js';
import Contact from '../models/Contact.js';
import Business from '../models/Business.js';
import Farm from '../models/Farm.js';
import House from '../models/House.js';
import Batch from '../models/Batch.js';
import DailyLog from '../models/DailyLog.js';
import FeedItem from '../models/FeedItem.js';
import FeedOrder from '../models/FeedOrder.js';
import FeedOrderItem from '../models/FeedOrderItem.js';
import Source from '../models/Source.js';
import Expense from '../models/Expense.js';
import SaleOrder from '../models/SaleOrder.js';
import Transfer from '../models/Transfer.js';
import Media from '../models/Media.js';
import { softDeleteUser } from './inviteService.js';

// Workspace-scoped collections (every doc has a `user_id` pointing at the
// workspace owner). Order doesn't matter for soft-delete since we never
// hard-remove rows and there are no FK constraints, but we list children
// before parents for readability when scanning the list.
const WORKSPACE_MODELS = [
  ['dailyLog',      DailyLog],
  ['feedOrderItem', FeedOrderItem],
  ['feedOrder',     FeedOrder],
  ['feedItem',      FeedItem],
  ['expense',       Expense],
  ['source',        Source],
  ['saleOrder',     SaleOrder],
  ['transfer',      Transfer],
  ['media',         Media],
  ['batch',         Batch],
  ['house',         House],
  ['farm',          Farm],
  ['worker',        Worker],
  ['contact',       Contact],
  ['business',      Business],
];

/**
 * Soft-delete an account, cascading the deletion across the workspace.
 *
 * - Owner self-delete: cascades to every sub-user in the workspace (which
 *   itself cascades to that sub-user's Worker + Contact via softDeleteUser),
 *   then to every workspace entity (Business, Farm, House, Batch, daily
 *   logs, sales, expenses, etc.), then finally to the owner themselves.
 *
 * - Sub-user self-delete: defers to softDeleteUser. Workspace stays —
 *   the workspace belongs to the owner.
 *
 * NEVER hard-deletes. Authored records (DailyLog, Media, etc.) keep their
 * authorship reference for audit purposes per DATA_OWNERSHIP.md, and the
 * 30-day retention window described in /account-deletion needs the rows
 * to physically remain so a support engineer can reverse a deletion if a
 * user changes their mind. A future scheduled job can hard-purge anything
 * with `deletedAt < now - 30 days` once the retention promise expires.
 *
 * @param {{ user: Object, logDeletion?: Function }} args
 * @returns {Promise<{ user, deletions: Array<[string, ObjectId]> }>}
 */
export async function softDeleteAccount({ user, logDeletion }) {
  if (!user) throw new Error('softDeleteAccount: user is required');

  // Idempotent — calling twice doesn't double-cascade.
  if (user.deletedAt) {
    return { user, deletions: [] };
  }

  // Sub-user self-delete: existing single-user cascade. Workspace stays.
  if (user.createdBy) {
    return softDeleteUser({
      ownerId: user.createdBy,
      userId: user._id,
      logDeletion,
    });
  }

  // Owner self-delete: full workspace cascade.
  const ownerId = user._id;
  const now = new Date();
  const deletions = [];

  // 1. Cascade-soft-delete every sub-user (and each one's Worker + Contact
  //    via softDeleteUser's own internal cascade).
  const subUsers = await User.find({ createdBy: ownerId, deletedAt: null }).select('_id');
  for (const sub of subUsers) {
    try {
      const subResult = await softDeleteUser({ ownerId, userId: sub._id, logDeletion });
      deletions.push(...subResult.deletions);
    } catch (err) {
      // One sub-user failing shouldn't abort the whole cascade — log and
      // continue. The owner deletion at the end is the source of truth that
      // gates re-login regardless.
      // eslint-disable-next-line no-console
      console.warn('[accountDeletion] sub-user cascade failed for', sub._id, err?.message);
    }
  }

  // 2. Soft-delete every workspace entity scoped to this owner.
  //    Some schemas already declare `deletedAt`; for those we go through
  //    Mongoose so middleware/timestamps fire. For schemas that pre-date
  //    the soft-delete convention we write the timestamp directly via the
  //    underlying MongoDB driver — keeps this forwards-compatible without
  //    requiring a schema migration on every model up front.
  for (const [type, Model] of WORKSPACE_MODELS) {
    const docs = await Model.find({ user_id: ownerId }).select('_id deletedAt');
    if (docs.length === 0) continue;

    const undeleted = docs.filter((d) => !d.deletedAt);
    if (undeleted.length === 0) continue;

    const ids = undeleted.map((d) => d._id);
    const hasField = !!Model.schema?.path?.('deletedAt');

    if (hasField) {
      await Model.updateMany({ _id: { $in: ids } }, { deletedAt: now });
    } else {
      await Model.collection.updateMany(
        { _id: { $in: ids } },
        { $set: { deletedAt: now } }
      );
    }

    for (const id of ids) {
      deletions.push([type, id]);
      if (typeof logDeletion === 'function') {
        try {
          await logDeletion(ownerId, type, id);
        } catch (err) {
          // eslint-disable-next-line no-console
          console.warn('[accountDeletion] logDeletion failed for', type, id, err?.message);
        }
      }
    }
  }

  // 3. Finally soft-delete the owner themselves. After this returns the
  //    auth middleware will reject any further requests with 401
  //    USER_DELETED, and any sub-users that survived cascade-failure above
  //    will also be blocked because protect() now rejects sub-users whose
  //    owner has been soft-deleted (defense-in-depth check).
  user.deletedAt = now;
  user.isActive = false;
  await user.save();
  deletions.push(['user', user._id]);
  if (typeof logDeletion === 'function') {
    try {
      await logDeletion(ownerId, 'user', user._id);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[accountDeletion] owner logDeletion failed', err?.message);
    }
  }

  return { user, deletions };
}
