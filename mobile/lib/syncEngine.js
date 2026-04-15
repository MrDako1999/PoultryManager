import {
  getDb,
  ENTITY_TABLES,
  ENTITY_API_MAP,
  SYNC_ORDER,
  SOFT_DELETE_TABLES,
  upsertEntities,
  deleteEntities,
  clearTable,
  getSyncMeta,
  getSyncMetaCount,
  upsertSyncMeta,
  upsertSettings,
  getIdMapping,
  putIdMapping,
  dbEvents,
} from './db';
import api from './api';
import { uploadPendingBlob } from './mediaQueue';
import useSyncStore from '../stores/syncStore';

const SYNC_INTERVAL_MS = 60_000;
let intervalId = null;
let _queueProcessing = false;
let _rerunRequested = false;

async function getServerTime() {
  const { data } = await api.get('/sync/status');
  return data.serverTime;
}

const BATCH_SCOPED = ['sources', 'expenses', 'feedOrders', 'saleOrders', 'dailyLogs'];

async function fetchAllForEntity(entityType, updatedSince) {
  const apiPath = ENTITY_API_MAP[entityType];
  if (!apiPath) return [];
  const params = {};
  if (updatedSince) {
    params.updatedSince = updatedSince;
  } else if (BATCH_SCOPED.includes(entityType)) {
    params.syncAll = true;
  }
  const { data } = await api.get(apiPath, { params });
  return Array.isArray(data) ? data : [];
}

async function fetchSettings() {
  const [accounting, saleDefaults, business] = await Promise.all([
    api.get('/settings/accounting').then((r) => r.data).catch(() => null),
    api.get('/settings/sale-defaults').then((r) => r.data).catch(() => null),
    api.get('/settings/business').then((r) => r.data).catch(() => null),
  ]);
  return { accounting, saleDefaults, business };
}

async function handleSoftDeletes(tableName, records) {
  if (!SOFT_DELETE_TABLES.includes(tableName)) return;
  const deleted = records.filter((r) => r.deletedAt);
  if (deleted.length > 0) {
    await deleteEntities(tableName, deleted.map((r) => r._id));
  }
}

async function applyDeletions(deletionMap) {
  for (const [entityType, ids] of Object.entries(deletionMap)) {
    const tableName =
      entityType === 'feedOrder' ? 'feedOrders'
        : entityType === 'feedOrderItem' ? 'feedOrderItems'
          : entityType === 'saleOrder' ? 'saleOrders'
            : entityType + 's';
    await deleteEntities(tableName, ids);
  }
}

export async function fullSync({ reportProgress = false } = {}) {
  const store = useSyncStore.getState();
  store.setSyncing(true);
  const syncableEntities = SYNC_ORDER.filter((e) => ENTITY_API_MAP[e]);
  const totalSteps = syncableEntities.length + 1;
  let currentStep = 0;
  const report = (label) => {
    if (!reportProgress) return;
    currentStep++;
    store.setSyncProgress({ current: currentStep, total: totalSteps, label });
  };

  try {
    const serverTime = await getServerTime();
    for (const entityType of syncableEntities) {
      report(entityType);
      const records = await fetchAllForEntity(entityType);
      await upsertEntities(entityType, records);
    }
    report('Settings');
    const settings = await fetchSettings();
    await upsertSettings([
      { key: 'accounting', value: settings.accounting },
      { key: 'saleDefaults', value: settings.saleDefaults },
      { key: 'business', value: settings.business },
    ]);

    const metaEntries = syncableEntities.map((entityType) => ({ entityType, lastSyncAt: serverTime }));
    metaEntries.push({ entityType: 'settings', lastSyncAt: serverTime });
    await upsertSyncMeta(metaEntries);
    store.setLastSyncAt(serverTime);
  } catch (err) {
    console.error('Full sync failed:', err);
    store.addSyncError({ type: 'fullSync', message: err.message, at: new Date().toISOString() });
    throw err;
  } finally {
    store.setSyncing(false);
    if (reportProgress) store.clearSyncProgress();
  }
}

export async function fullResync() {
  const store = useSyncStore.getState();
  store.setFullResyncing(true);
  store.clearErrors();
  try {
    for (const table of [...ENTITY_TABLES, 'settings']) {
      await clearTable(table);
    }
    const db = await getDb();
    await db.runAsync(`DELETE FROM sync_meta`);
    await db.runAsync(`DELETE FROM id_map`);
    await fullSync({ reportProgress: true });
  } catch (err) {
    console.error('Full resync failed:', err);
  } finally {
    store.setFullResyncing(false);
    store.clearSyncProgress();
  }
}

export async function deltaSync() {
  const store = useSyncStore.getState();
  if (!store.isOnline) return;
  store.setSyncing(true);

  try {
    const metaCount = await getSyncMetaCount();
    if (metaCount === 0) {
      await fullSync();
      return;
    }

    const serverTime = await getServerTime();
    let oldestSyncAt = null;

    for (const entityType of SYNC_ORDER) {
      if (!ENTITY_API_MAP[entityType]) continue;
      const meta = await getSyncMeta(entityType);
      const lastSyncAt = meta?.lastSyncAt;

      if (!oldestSyncAt || (lastSyncAt && lastSyncAt < oldestSyncAt)) {
        oldestSyncAt = lastSyncAt;
      }

      const records = await fetchAllForEntity(entityType, lastSyncAt);
      await upsertEntities(entityType, records);
      await handleSoftDeletes(entityType, records);
    }

    const settingsMeta = await getSyncMeta('settings');
    if (!settingsMeta?.lastSyncAt || settingsMeta.lastSyncAt < serverTime) {
      const settings = await fetchSettings();
      await upsertSettings([
        { key: 'accounting', value: settings.accounting },
        { key: 'saleDefaults', value: settings.saleDefaults },
        { key: 'business', value: settings.business },
      ]);
    }

    if (oldestSyncAt) {
      try {
        const { data: deletionMap } = await api.get('/sync/deletions', { params: { since: oldestSyncAt } });
        await applyDeletions(deletionMap);
      } catch (err) {
        console.error('Deletion sync failed:', err);
      }
    }

    const metaEntries = SYNC_ORDER
      .filter((e) => ENTITY_API_MAP[e])
      .map((entityType) => ({ entityType, lastSyncAt: serverTime }));
    metaEntries.push({ entityType: 'settings', lastSyncAt: serverTime });
    await upsertSyncMeta(metaEntries);
    store.setLastSyncAt(serverTime);
  } catch (err) {
    console.error('Delta sync failed:', err);
    store.addSyncError({ type: 'deltaSync', message: err.message, at: new Date().toISOString() });
  } finally {
    store.setSyncing(false);
    await store.refreshCounts();
  }
}

export async function processQueue() {
  const store = useSyncStore.getState();
  if (!store.isOnline) return;

  if (_queueProcessing) {
    _rerunRequested = true;
    return;
  }
  _queueProcessing = true;

  try {
    const db = await getDb();
    const pending = await db.getAllAsync(
      `SELECT * FROM mutation_queue WHERE status = 'pending' ORDER BY createdAt`
    );
    if (pending.length === 0) return;

    const sorted = pending
      .map((row) => ({
        ...row,
        payload: row.payload ? JSON.parse(row.payload) : null,
        mediaFields: row.mediaFields ? JSON.parse(row.mediaFields) : null,
      }))
      .sort((a, b) => {
        const ai = SYNC_ORDER.indexOf(a.entityType);
        const bi = SYNC_ORDER.indexOf(b.entityType);
        if (ai !== bi) return ai - bi;
        return a.createdAt < b.createdAt ? -1 : 1;
      });

    for (const entry of sorted) {
      const fresh = await db.getFirstAsync(`SELECT status FROM mutation_queue WHERE id = ?`, [entry.id]);
      if (!fresh || fresh.status !== 'pending') continue;

      try {
        let payload = entry.payload ? { ...entry.payload } : {};
        let entityId = entry.entityId;

        payload = await resolveIds(payload);
        entityId = await resolveId(entry.entityType, entityId);

        if (entry.action === 'create' && entry.mediaFields) {
          payload = await uploadPendingMedia(payload, entry.mediaFields);
        }

        const apiPath = ENTITY_API_MAP[entry.entityType];
        if (!apiPath) {
          await db.runAsync(`UPDATE mutation_queue SET status = 'synced' WHERE id = ?`, [entry.id]);
          continue;
        }

        let response;
        if (entry.action === 'create') {
          response = await api.post(apiPath, payload);
          const serverRecord = response.data?.source || response.data;
          if (serverRecord?._id && entityId) {
            await putIdMapping(entityId, entry.entityType, serverRecord._id);
            await db.runAsync(`DELETE FROM ${entry.entityType} WHERE _id = ?`, [entityId]);
            await upsertEntities(entry.entityType, [serverRecord]);
          }
        } else if (entry.action === 'update') {
          response = await api.put(`${apiPath}/${entityId}`, payload);
          const serverRecord = response.data?.source || response.data;
          if (serverRecord) {
            await upsertEntities(entry.entityType, [serverRecord]);
          }
        } else if (entry.action === 'delete') {
          await api.delete(`${apiPath}/${entityId}`);
        }

        await db.runAsync(`UPDATE mutation_queue SET status = 'synced' WHERE id = ?`, [entry.id]);
      } catch (err) {
        console.error(`Mutation failed [${entry.entityType}/${entry.action}]:`, err);
        await db.runAsync(
          `UPDATE mutation_queue SET status = 'failed', error = ? WHERE id = ?`,
          [err.response?.data?.message || err.message, entry.id]
        );
        store.addSyncError({
          type: 'mutation',
          entityType: entry.entityType,
          action: entry.action,
          message: err.response?.data?.message || err.message,
          at: new Date().toISOString(),
        });
      }
    }

    await store.refreshCounts();
    const remaining = await db.getFirstAsync(
      `SELECT COUNT(*) as count FROM mutation_queue WHERE status = 'pending'`
    );
    if ((remaining?.count || 0) === 0) {
      setTimeout(() => deltaSync(), 1500);
    }
  } finally {
    _queueProcessing = false;
    if (_rerunRequested) {
      _rerunRequested = false;
      processQueue().catch(() => {});
    }
  }
}

async function resolveId(entityType, id) {
  if (!id) return id;
  const mapping = await getIdMapping(id, entityType);
  return mapping ? mapping.realId : id;
}

async function resolveIds(payload) {
  if (!payload || typeof payload !== 'object') return payload;
  const resolved = { ...payload };

  const refFields = {
    batch: 'batches', source: 'sources', feedOrder: 'feedOrders',
    saleOrder: 'saleOrders', tradingCompany: 'businesses',
    sourceFrom: 'businesses', farm: 'farms', house: 'houses', business: 'businesses',
    contact: 'contacts', feedCompany: 'businesses', feedItem: 'feedItems',
    buyer: 'businesses', customer: 'businesses',
    existingBusinessId: 'businesses', existingContactId: 'contacts',
  };

  for (const [field, entityType] of Object.entries(refFields)) {
    if (resolved[field]) {
      const mapping = await getIdMapping(resolved[field], entityType);
      if (mapping) resolved[field] = mapping.realId;
    }
  }

  return resolved;
}

async function uploadPendingMedia(payload, mediaFields) {
  const db = await getDb();
  const resolved = { ...payload };
  for (const field of mediaFields) {
    const value = resolved[field];
    if (!value) continue;
    const ids = Array.isArray(value) ? value : [value];
    const realIds = [];

    for (const id of ids) {
      const blob = await db.getFirstAsync(`SELECT * FROM media_blobs WHERE _id = ?`, [id]);
      if (blob) {
        const uploaded = await uploadPendingBlob(id);
        realIds.push(uploaded?._id || id);
      } else {
        const mapping = await getIdMapping(id, 'media');
        realIds.push(mapping ? mapping.realId : id);
      }
    }
    resolved[field] = Array.isArray(value) ? realIds : realIds[0];
  }
  return resolved;
}

export async function clearAll() {
  for (const table of [...ENTITY_TABLES, 'settings']) {
    await clearTable(table);
  }
  const db = await getDb();
  await db.runAsync(`DELETE FROM mutation_queue`);
  await db.runAsync(`DELETE FROM sync_meta`);
  await db.runAsync(`DELETE FROM id_map`);
  await db.runAsync(`DELETE FROM media_blobs`);
  dbEvents.emit('change', 'mutation_queue');

  const store = useSyncStore.getState();
  store.setLastSyncAt(null);
  await store.refreshCounts();
}

export function startPeriodicSync() {
  stopPeriodicSync();
  intervalId = setInterval(async () => {
    const store = useSyncStore.getState();
    if (store.isOnline && !store.isSyncing) {
      await deltaSync();
      await processQueue();
    }
  }, SYNC_INTERVAL_MS);
}

export function stopPeriodicSync() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}
