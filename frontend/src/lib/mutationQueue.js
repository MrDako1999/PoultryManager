import db from './db';
import useSyncStore from '@/stores/syncStore';

export async function enqueue(entityType, action, entityId, payload, mediaFields) {
  await db.mutationQueue.add({
    entityType,
    action,
    entityId,
    payload,
    mediaFields: mediaFields || null,
    status: 'pending',
    createdAt: new Date().toISOString(),
    error: null,
  });
  await useSyncStore.getState().refreshPendingCount();
}

export async function getPendingCount() {
  return db.mutationQueue.where('status').equals('pending').count();
}

export async function getFailedEntries() {
  return db.mutationQueue.where('status').equals('failed').toArray();
}

export async function retryFailed(entryId) {
  await db.mutationQueue.update(entryId, { status: 'pending', error: null });
  await useSyncStore.getState().refreshPendingCount();
}

export async function discardFailed(entryId) {
  await db.mutationQueue.delete(entryId);
  await useSyncStore.getState().refreshPendingCount();
}
