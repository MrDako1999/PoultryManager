import DeletionLog from '../models/DeletionLog.js';

export async function logDeletion(userId, entityType, entityId) {
  try {
    await DeletionLog.create({ user_id: userId, entityType, entityId });
  } catch (err) {
    console.error('Failed to log deletion:', err.message);
  }
}

export async function logDeletions(userId, entityType, entityIds) {
  if (!entityIds || entityIds.length === 0) return;
  try {
    const entries = entityIds.map(id => ({ user_id: userId, entityType, entityId: id }));
    await DeletionLog.insertMany(entries);
  } catch (err) {
    console.error('Failed to log deletions:', err.message);
  }
}
