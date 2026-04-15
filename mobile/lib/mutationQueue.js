import { getDb, dbEvents } from './db';

export async function enqueue(entityType, action, entityId, payload, mediaFields) {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO mutation_queue (entityType, action, entityId, payload, mediaFields, status, createdAt)
     VALUES (?, ?, ?, ?, ?, 'pending', ?)`,
    [
      entityType,
      action,
      entityId,
      payload ? JSON.stringify(payload) : null,
      mediaFields ? JSON.stringify(mediaFields) : null,
      new Date().toISOString(),
    ]
  );
  dbEvents.emit('change', 'mutation_queue');
  const { default: useSyncStore } = await import('../stores/syncStore');
  await useSyncStore.getState().refreshCounts();
}

export async function getPendingCount() {
  const db = await getDb();
  const row = await db.getFirstAsync(
    `SELECT COUNT(*) as count FROM mutation_queue WHERE status = 'pending'`
  );
  return row?.count || 0;
}

export async function getFailedCount() {
  const db = await getDb();
  const row = await db.getFirstAsync(
    `SELECT COUNT(*) as count FROM mutation_queue WHERE status = 'failed'`
  );
  return row?.count || 0;
}

export async function getFailedEntries() {
  const db = await getDb();
  const rows = await db.getAllAsync(
    `SELECT * FROM mutation_queue WHERE status = 'failed' ORDER BY createdAt`
  );
  return rows.map(parseQueueEntry);
}

export async function retryFailed(entryId) {
  const db = await getDb();
  await db.runAsync(
    `UPDATE mutation_queue SET status = 'pending', error = NULL WHERE id = ?`,
    [entryId]
  );
  dbEvents.emit('change', 'mutation_queue');
  const { default: useSyncStore } = await import('../stores/syncStore');
  await useSyncStore.getState().refreshCounts();
}

export async function discardFailed(entryId) {
  const db = await getDb();
  await db.runAsync(`DELETE FROM mutation_queue WHERE id = ?`, [entryId]);
  dbEvents.emit('change', 'mutation_queue');
  const { default: useSyncStore } = await import('../stores/syncStore');
  await useSyncStore.getState().refreshCounts();
}

function parseQueueEntry(row) {
  return {
    ...row,
    payload: row.payload ? JSON.parse(row.payload) : null,
    mediaFields: row.mediaFields ? JSON.parse(row.mediaFields) : null,
  };
}
