import db, { ENTITY_TABLES, ENTITY_API_MAP, SYNC_ORDER, SOFT_DELETE_TABLES } from './db';
import api from './api';
import { uploadPendingBlob } from './mediaQueue';
import useSyncStore from '@/stores/syncStore';

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
    api.get('/settings/accounting').then(r => r.data).catch(() => null),
    api.get('/settings/sale-defaults').then(r => r.data).catch(() => null),
    api.get('/settings/business').then(r => r.data).catch(() => null),
  ]);
  return { accounting, saleDefaults, business };
}

async function upsertEntities(tableName, records) {
  if (!records || records.length === 0) return;
  await db[tableName].bulkPut(records);
}

async function handleSoftDeletes(tableName, records) {
  if (!SOFT_DELETE_TABLES.includes(tableName)) return;
  const deleted = records.filter(r => r.deletedAt);
  if (deleted.length > 0) {
    const ids = deleted.map(r => r._id);
    await db[tableName].bulkDelete(ids);
  }
}

async function applyDeletions(deletionMap) {
  for (const [entityType, ids] of Object.entries(deletionMap)) {
    const tableName = entityType === 'feedOrder' ? 'feedOrders'
      : entityType === 'feedOrderItem' ? 'feedOrderItems'
      : entityType === 'saleOrder' ? 'saleOrders'
      : entityType + 's';

    if (db[tableName]) {
      await db[tableName].bulkDelete(ids);
    }
  }
}

const ENTITY_LABELS = {
  businesses: 'Businesses',
  contacts: 'Contacts',
  farms: 'Farms',
  houses: 'Houses',
  workers: 'Workers',
  feedItems: 'Feed Items',
  transfers: 'Transfers',
  batches: 'Batches',
  sources: 'Sources',
  feedOrders: 'Feed Orders',
  feedOrderItems: 'Feed Order Items',
  saleOrders: 'Sale Orders',
  expenses: 'Expenses',
  dailyLogs: 'Daily Logs',
  media: 'Media',
};

export async function fullSync({ reportProgress = false } = {}) {
  const store = useSyncStore.getState();
  store.setSyncing(true);

  const syncableEntities = SYNC_ORDER.filter(e => ENTITY_API_MAP[e]);
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
      report(ENTITY_LABELS[entityType] || entityType);
      const records = await fetchAllForEntity(entityType);
      await upsertEntities(entityType, records);
    }

    report('Settings');
    const settings = await fetchSettings();
    await db.settings.bulkPut([
      { key: 'accounting', value: settings.accounting },
      { key: 'saleDefaults', value: settings.saleDefaults },
      { key: 'business', value: settings.business },
    ]);

    const metaEntries = syncableEntities.map(entityType => ({ entityType, lastSyncAt: serverTime }));
    metaEntries.push({ entityType: 'settings', lastSyncAt: serverTime });
    await db.syncMeta.bulkPut(metaEntries);

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
    for (const table of [...ENTITY_TABLES, 'settings', 'syncMeta', 'idMap']) {
      await db[table].clear();
    }
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
    const hasMeta = (await db.syncMeta.count()) > 0;
    if (!hasMeta) {
      await fullSync();
      return;
    }

    const serverTime = await getServerTime();

    let oldestSyncAt = null;

    for (const entityType of SYNC_ORDER) {
      if (!ENTITY_API_MAP[entityType]) continue;
      const meta = await db.syncMeta.get(entityType);
      const lastSyncAt = meta?.lastSyncAt;

      if (!oldestSyncAt || (lastSyncAt && lastSyncAt < oldestSyncAt)) {
        oldestSyncAt = lastSyncAt;
      }

      const records = await fetchAllForEntity(entityType, lastSyncAt);
      await upsertEntities(entityType, records);
      await handleSoftDeletes(entityType, records);
    }

    const settingsMeta = await db.syncMeta.get('settings');
    if (!settingsMeta?.lastSyncAt || settingsMeta.lastSyncAt < serverTime) {
      const settings = await fetchSettings();
      const keys = ['accounting', 'saleDefaults', 'business'];
      const toWrite = [];
      for (const key of keys) {
        const current = await db.settings.get(key);
        if (JSON.stringify(current?.value) !== JSON.stringify(settings[key])) {
          toWrite.push({ key, value: settings[key] });
        }
      }
      if (toWrite.length > 0) {
        await db.settings.bulkPut(toWrite);
      }
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
      .filter(e => ENTITY_API_MAP[e])
      .map(entityType => ({ entityType, lastSyncAt: serverTime }));
    metaEntries.push({ entityType: 'settings', lastSyncAt: serverTime });
    await db.syncMeta.bulkPut(metaEntries);

    store.setLastSyncAt(serverTime);
  } catch (err) {
    console.error('Delta sync failed:', err);
    store.addSyncError({ type: 'deltaSync', message: err.message, at: new Date().toISOString() });
  } finally {
    store.setSyncing(false);
    await store.refreshPendingCount();
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
    const pending = await db.mutationQueue.where('status').equals('pending').sortBy('createdAt');
    if (pending.length === 0) return;

    const sorted = pending.sort((a, b) => {
      const ai = SYNC_ORDER.indexOf(a.entityType);
      const bi = SYNC_ORDER.indexOf(b.entityType);
      if (ai !== bi) return ai - bi;
      return a.createdAt - b.createdAt;
    });

    for (const entry of sorted) {
      const fresh = await db.mutationQueue.get(entry.id);
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
          await db.mutationQueue.update(entry.id, { status: 'synced' });
          continue;
        }

        let response;
        if (entry.action === 'create') {
          response = await api.post(apiPath, payload);
          const serverRecord = response.data?.source || response.data;
          if (serverRecord?._id && entityId) {
            await db.idMap.put({ tempId: entityId, entityType: entry.entityType, realId: serverRecord._id });
            await db[entry.entityType].delete(entityId);
            await db[entry.entityType].put(serverRecord);
            await updateReferences(entry.entityType, entityId, serverRecord._id);
          }
        } else if (entry.action === 'update') {
          response = await api.put(`${apiPath}/${entityId}`, payload);
          const serverRecord = response.data?.source || response.data;
          if (serverRecord) {
            await db[entry.entityType].put(serverRecord);
          }
        } else if (entry.action === 'delete') {
          await api.delete(`${apiPath}/${entityId}`);
        }

        await db.mutationQueue.update(entry.id, { status: 'synced' });
      } catch (err) {
        console.error(`Mutation failed [${entry.entityType}/${entry.action}]:`, err);
        await db.mutationQueue.update(entry.id, {
          status: 'failed',
          error: err.response?.data?.message || err.message,
        });
        store.addSyncError({
          type: 'mutation',
          entityType: entry.entityType,
          action: entry.action,
          message: err.response?.data?.message || err.message,
          at: new Date().toISOString(),
        });
      }
    }

    await store.refreshPendingCount();

    const remaining = await db.mutationQueue.where('status').equals('pending').count();
    if (remaining === 0) {
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
  const mapping = await db.idMap.get({ tempId: id, entityType });
  return mapping ? mapping.realId : id;
}

async function resolveRefId(tempId, entityType) {
  if (!tempId) return tempId;
  const mapping = await db.idMap.get({ tempId, entityType });
  return mapping ? mapping.realId : tempId;
}

async function resolveMediaId(tempId) {
  if (!tempId) return tempId;
  const mapping = await db.idMap.get({ tempId, entityType: 'media' });
  if (mapping) return mapping.realId;

  const blob = await db.mediaBlobs.get(tempId);
  if (blob) {
    const uploaded = await uploadPendingBlob(tempId);
    return uploaded?._id || tempId;
  }

  return tempId;
}

async function resolveMediaArray(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return arr;
  return Promise.all(arr.map(resolveMediaId));
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
      const mapping = await db.idMap.get({ tempId: resolved[field], entityType });
      if (mapping) resolved[field] = mapping.realId;
    }
  }

  const arrayRefFields = {
    contacts: 'contacts',
    businesses: 'businesses',
  };

  for (const [field, entityType] of Object.entries(arrayRefFields)) {
    if (Array.isArray(resolved[field])) {
      resolved[field] = await Promise.all(
        resolved[field].map((id) => resolveRefId(id, entityType)),
      );
    }
  }

  if (Array.isArray(resolved.items)) {
    resolved.items = await Promise.all(
      resolved.items.map(async (item) => {
        if (!item || typeof item !== 'object') return item;
        const copy = { ...item };
        if (copy.feedItem) {
          copy.feedItem = await resolveRefId(copy.feedItem, 'feedItems');
        }
        return copy;
      }),
    );
  }

  if (Array.isArray(resolved.houses)) {
    resolved.houses = await Promise.all(
      resolved.houses.map(async (entry) => {
        if (!entry || typeof entry !== 'object') return entry;
        const copy = { ...entry };
        if (copy.house) {
          copy.house = await resolveRefId(copy.house, 'houses');
        }
        return copy;
      }),
    );
  }

  const singleMediaFields = [
    'logo', 'photo', 'trnCertificate', 'tradeLicense',
    'eidFront', 'eidBack', 'visa', 'passportPage',
  ];
  for (const field of singleMediaFields) {
    if (resolved[field]) {
      resolved[field] = await resolveMediaId(resolved[field]);
    }
  }

  if (resolved.slaughter && typeof resolved.slaughter === 'object') {
    resolved.slaughter = { ...resolved.slaughter };
    resolved.slaughter.slaughterhouse = await resolveRefId(resolved.slaughter.slaughterhouse, 'businesses');
    resolved.slaughter.relatedExpense = await resolveRefId(resolved.slaughter.relatedExpense, 'expenses');
    resolved.slaughter.reportDocs = await resolveMediaArray(resolved.slaughter.reportDocs);
  }

  for (const field of ['invoiceDocs', 'transferProofs', 'taxInvoiceDocs', 'deliveryNoteDocs', 'receipts', 'reportDocs', 'photos']) {
    resolved[field] = await resolveMediaArray(resolved[field]);
  }

  if (Array.isArray(resolved.otherDocs)) {
    resolved.otherDocs = await Promise.all(
      resolved.otherDocs.map(async (doc) => {
        if (!doc || !doc.media_id) return doc;
        return { ...doc, media_id: await resolveMediaId(doc.media_id) };
      }),
    );
  }

  return resolved;
}

async function updateReferences(entityType, tempId, realId) {
  const pending = await db.mutationQueue.where('status').equals('pending').toArray();
  for (const entry of pending) {
    let changed = false;
    const payload = entry.payload ? { ...entry.payload } : {};

    const refFields = ['batch', 'source', 'feedOrder', 'saleOrder', 'tradingCompany',
      'sourceFrom', 'farm', 'house', 'business', 'contact', 'feedCompany', 'feedItem', 'buyer', 'customer',
      'existingBusinessId', 'existingContactId'];

    for (const field of refFields) {
      if (payload[field] === tempId) {
        payload[field] = realId;
        changed = true;
      }
    }

    for (const arrField of ['contacts', 'businesses']) {
      if (Array.isArray(payload[arrField])) {
        const idx = payload[arrField].indexOf(tempId);
        if (idx !== -1) {
          payload[arrField] = [...payload[arrField]];
          payload[arrField][idx] = realId;
          changed = true;
        }
      }
    }

    if (Array.isArray(payload.items)) {
      payload.items = payload.items.map((item) => {
        if (item?.feedItem === tempId) {
          changed = true;
          return { ...item, feedItem: realId };
        }
        return item;
      });
    }

    if (entry.entityId === tempId && entry.entityType === entityType) {
      await db.mutationQueue.update(entry.id, { entityId: realId, payload: changed ? payload : entry.payload });
    } else if (changed) {
      await db.mutationQueue.update(entry.id, { payload });
    }
  }
}

async function uploadPendingMedia(payload, mediaFields) {
  const resolved = { ...payload };
  for (const field of mediaFields) {
    const value = resolved[field];
    if (!value) continue;

    const ids = Array.isArray(value) ? value : [value];
    const realIds = [];

    for (const id of ids) {
      const blob = await db.mediaBlobs.get(id);
      if (blob) {
        const formData = new FormData();
        formData.append('file', new File([blob.blob], blob.filename, { type: blob.mimeType }));
        if (blob.metadata) {
          for (const [k, v] of Object.entries(blob.metadata)) {
            formData.append(k, v);
          }
        }
        const { data: mediaRecord } = await api.post('/media/upload', formData);
        realIds.push(mediaRecord._id);
        await db.idMap.put({ tempId: id, entityType: 'media', realId: mediaRecord._id });
        await db.mediaBlobs.delete(id);
      } else {
        const mapping = await db.idMap.get({ tempId: id, entityType: 'media' });
        realIds.push(mapping ? mapping.realId : id);
      }
    }

    resolved[field] = Array.isArray(value) ? realIds : realIds[0];
  }
  return resolved;
}

export async function clearAll() {
  for (const table of [...ENTITY_TABLES, 'settings', 'mutationQueue', 'syncMeta', 'idMap', 'mediaBlobs']) {
    await db[table].clear();
  }
  const store = useSyncStore.getState();
  store.setLastSyncAt(null);
  await store.refreshPendingCount();
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

export async function init() {
  await deltaSync();
  await processQueue();
  startPeriodicSync();

  window.addEventListener('online', async () => {
    await deltaSync();
    await processQueue();
  });
}
