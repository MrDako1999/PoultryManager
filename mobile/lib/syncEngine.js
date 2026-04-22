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
import useSyncStore from '@/stores/syncStore';
import {
  REF_FIELDS,
  ARRAY_REF_FIELDS,
  SINGLE_MEDIA_FIELDS,
  ARRAY_MEDIA_FIELDS,
  ITEM_ARRAYS,
  NESTED_REF_OBJECTS,
  OTHER_DOC_ARRAY_MEDIA_KEY,
} from '@poultrymanager/shared';

const SYNC_INTERVAL_MS = 60_000;
const BILLING_HEARTBEAT_MS = 30_000;
let intervalId = null;
let billingHeartbeatId = null;
let _queueProcessing = false;
let _rerunRequested = false;
let _billingPaused = false;

const SHARED_TABLES = new Set([
  'businesses', 'contacts', 'workers', 'farms', 'media',
]);

// Tables that only owners are allowed to sync. Sub-users would get 403
// from the backend; we just skip the fetch entirely for them.
const OWNER_ONLY_TABLES = new Set([
  'users',
]);

// Lazy-load the registry and authStore to break the require cycle:
// syncEngine -> registry -> broiler/index -> widgets -> authStore -> syncEngine.
// Top-level imports would crash because the registry hasn't finished evaluating
// when syncEngine first loads.
function getRegistry() {
  return require('@/modules/registry');
}

function getAuthStore() {
  return require('@/stores/authStore').default;
}

function getVisibleModules() {
  const { MODULE_ORDER } = getRegistry();
  const user = getAuthStore().getState().user;
  if (!user) return MODULE_ORDER;
  const userModules = Array.isArray(user.modules) ? user.modules : [];
  return MODULE_ORDER.filter((m) => userModules.includes(m));
}

function resolveAllowedTables() {
  const { MODULES } = getRegistry();
  const visible = getVisibleModules();
  const allowed = new Set(SHARED_TABLES);
  for (const id of visible) {
    const mod = MODULES[id];
    if (!mod?.sync) continue;
    for (const t of mod.sync.tables || []) allowed.add(t);
    for (const t of mod.sync.dependsOn || []) allowed.add(t);
  }
  // Owner-only tables (e.g. users / team members) are added only when
  // the current user is the workspace owner. Sub-users would otherwise
  // hammer 403s on every sync tick.
  const user = getAuthStore().getState().user;
  const isOwner = !!user && !user.createdBy;
  if (isOwner) {
    for (const t of OWNER_ONLY_TABLES) allowed.add(t);
  }
  return allowed;
}

function resolveBatchScoped() {
  const { MODULES } = getRegistry();
  const visible = getVisibleModules();
  const batched = new Set();
  for (const id of visible) {
    const mod = MODULES[id];
    for (const t of mod?.sync?.batchScoped || []) batched.add(t);
  }
  return batched;
}

function filteredSyncOrder() {
  const allowed = resolveAllowedTables();
  return SYNC_ORDER.filter((e) => ENTITY_API_MAP[e] && allowed.has(e));
}

async function getServerTime() {
  const { data } = await api.get('/sync/status');
  return data.serverTime;
}

/**
 * Refresh /auth/me and persist the workspace.subscription block to
 * sync_meta so the BillingLockScreen has the latest policy without
 * blocking the UI on a network round-trip.
 *
 * Returns the latest subscription payload (`{ status, policy, reason,
 * verifiedAt, ... }`) so callers can branch on `policy === 'block'`
 * before kicking off a heavy sync.
 *
 * Updates the auth store as a side-effect — the store is the single
 * source of truth for the user/workspace blob; useSubscriptionGate
 * reads from it.
 */
export async function refreshAuthAndSubscription() {
  try {
    const { data } = await api.get('/auth/me');
    const subscription = data?.workspace?.subscription || null;

    // Push the fresh user blob into the auth store so capability
    // checks, scope, and subscription gate all see the latest state
    // without a re-mount.
    try {
      const authStore = getAuthStore();
      authStore.setState({ user: data });
    } catch (err) {
      console.warn('[syncEngine] failed to update authStore from /auth/me', err?.message);
    }

    if (subscription) {
      await upsertSyncMeta([
        {
          entityType: '__subscription__',
          lastSyncAt: JSON.stringify(subscription),
        },
      ]);
    }
    return subscription;
  } catch (err) {
    // 402 SUBSCRIPTION_INACTIVE shouldn't reach here because /auth/me
    // is exempt from the subscription gate on the backend. A 401 means
    // the token is gone — let the existing axios interceptor handle it.
    console.warn('[syncEngine] refreshAuthAndSubscription failed:', err?.message);
    return null;
  }
}

export async function getCachedSubscription() {
  const meta = await getSyncMeta('__subscription__');
  if (!meta?.lastSyncAt) return null;
  try {
    return JSON.parse(meta.lastSyncAt);
  } catch {
    return null;
  }
}

/**
 * Start a lightweight 30s /auth/me poll that runs ONLY while the
 * workspace is blocked. Heavy entity sync stays paused; this loop just
 * watches for the owner to fix billing. The moment the subscription
 * flips back to 'allow' it flips heavy sync back on.
 */
export function startBillingHeartbeat() {
  if (billingHeartbeatId) return;
  billingHeartbeatId = setInterval(async () => {
    const sub = await refreshAuthAndSubscription();
    if (sub?.policy === 'allow') {
      stopBillingHeartbeat();
      _billingPaused = false;
      startPeriodicSync();
      // Trigger an immediate catch-up sync + queue flush so any work
      // queued during the lock surfaces right away.
      deltaSync().catch(() => {});
      processQueue().catch(() => {});
    }
  }, BILLING_HEARTBEAT_MS);
}

export function stopBillingHeartbeat() {
  if (billingHeartbeatId) {
    clearInterval(billingHeartbeatId);
    billingHeartbeatId = null;
  }
}

/**
 * Manual retry from the BillingLockScreen "Retry" button. Same code
 * path as the heartbeat — single /auth/me, unlock if 'allow'.
 */
export async function retrySubscription() {
  const sub = await refreshAuthAndSubscription();
  if (sub?.policy === 'allow') {
    stopBillingHeartbeat();
    _billingPaused = false;
    startPeriodicSync();
    deltaSync().catch(() => {});
    processQueue().catch(() => {});
  }
  return sub;
}

function pauseHeavySyncForBilling() {
  if (_billingPaused) return;
  _billingPaused = true;
  stopPeriodicSync();
  startBillingHeartbeat();
}

async function fetchAllForEntity(entityType, updatedSince, batchScoped) {
  const apiPath = ENTITY_API_MAP[entityType];
  if (!apiPath) return [];
  const params = {};
  if (updatedSince) {
    params.updatedSince = updatedSince;
  } else if (batchScoped && batchScoped.has(entityType)) {
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

const ENTITY_TO_TABLE = {
  feedOrder: 'feedOrders',
  feedOrderItem: 'feedOrderItems',
  saleOrder: 'saleOrders',
  dailyLog: 'dailyLogs',
  feedItem: 'feedItems',
  media: 'media',
};

function tableForEntityType(entityType) {
  if (ENTITY_TO_TABLE[entityType]) return ENTITY_TO_TABLE[entityType];
  return entityType + 's';
}

async function applyDeletions(deletionMap) {
  for (const [entityType, ids] of Object.entries(deletionMap)) {
    const tableName = tableForEntityType(entityType);
    if (ENTITY_TABLES.includes(tableName)) {
      await deleteEntities(tableName, ids);
    }
  }
}

export async function fullSync({ reportProgress = false } = {}) {
  const store = useSyncStore.getState();
  store.setSyncing(true);
  const syncableEntities = filteredSyncOrder();
  const batchScoped = resolveBatchScoped();
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
      const records = await fetchAllForEntity(entityType, undefined, batchScoped);
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
    // Refresh /auth/me first so we know the owner's subscription state
    // before doing anything expensive. If the workspace is blocked we
    // pause heavy sync, start the billing heartbeat, and bail.
    const subscription = await refreshAuthAndSubscription();
    if (subscription?.policy === 'block') {
      pauseHeavySyncForBilling();
      return;
    }
    if (_billingPaused && subscription?.policy === 'allow') {
      // Edge: heartbeat already detected the unlock and switched things
      // back on. Continue with the sync as normal.
      _billingPaused = false;
      stopBillingHeartbeat();
    }

    const metaCount = await getSyncMetaCount();
    if (metaCount === 0) {
      await fullSync();
      return;
    }

    const serverTime = await getServerTime();
    let oldestSyncAt = null;
    const syncableEntities = filteredSyncOrder();
    const batchScoped = resolveBatchScoped();

    for (const entityType of syncableEntities) {
      const meta = await getSyncMeta(entityType);
      const lastSyncAt = meta?.lastSyncAt;

      if (!oldestSyncAt || (lastSyncAt && lastSyncAt < oldestSyncAt)) {
        oldestSyncAt = lastSyncAt;
      }

      try {
        const records = await fetchAllForEntity(entityType, lastSyncAt, batchScoped);
        await upsertEntities(entityType, records);
        await handleSoftDeletes(entityType, records);
      } catch (err) {
        // A missing local table (added in a later migration that hasn't
        // run yet) shouldn't kill the whole delta loop. Log and move on
        // so other entities still sync; the migration will catch up on
        // the next app launch.
        if (/no such table/i.test(String(err?.message || ''))) {
          console.warn(`[syncEngine] skipping ${entityType}: ${err.message}`);
          continue;
        }
        throw err;
      }
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

    const metaEntries = syncableEntities
      .map((entityType) => ({ entityType, lastSyncAt: serverTime }));
    metaEntries.push({ entityType: 'settings', lastSyncAt: serverTime });
    await upsertSyncMeta(metaEntries);
    store.setLastSyncAt(serverTime);
  } catch (err) {
    // 401 means the token is gone — either the user just logged out
    // (in which case the api interceptor already cleared the token
    // and bounced them to /login) or the session expired server-side.
    // Either way the running deltaSync is the loser of the race; this
    // is expected noise, not a real failure. Swallow it so logout
    // doesn't surface a red error in the dev console.
    if (err?.response?.status === 401) {
      return;
    }
    console.error('Delta sync failed:', err);
    const transient = isTransientError(err);
    store.addSyncError({
      type: 'deltaSync',
      transient,
      message: err.message,
      at: new Date().toISOString(),
    });
    // Don't touch isOnline here. Mirroring the desktop, the OS link-layer
    // signal (NetInfo `state.isConnected`, surfaced via `useNetwork`) is
    // the single source of truth for connectivity. A single failed sync
    // round could be a server flap or a one-off timeout — the user is
    // not necessarily offline.
  } finally {
    store.setSyncing(false);
    await store.refreshCounts();
  }
}

/**
 * True when an axios error is a "the server didn't talk to us" error
 * (no network, DNS, SSL, timeout, server 5xx). These are NOT user
 * errors — the mutation should remain `pending` and be retried on the
 * next periodic sync (every 60s) or when connectivity returns.
 *
 * Permanent errors (4xx validation, 401 auth, 403 permission, 409
 * conflict) should mark the entry `failed` so the user sees a counter
 * and can retry/discard from the popover. Auto-retrying a 422 on the
 * same payload would just burn forever.
 */
function isTransientError(err) {
  if (!err) return false;
  if (err.code === 'ECONNABORTED') return true;       // axios timeout
  if (err.code === 'ERR_NETWORK') return true;        // no network
  if (err.message === 'Network Error') return true;   // axios pre-flight network failure
  if (!err.response) return true;                     // no response at all → transport failure
  const status = err.response.status;
  if (status >= 500 && status < 600) return true;     // server-side errors retry
  if (status === 408 || status === 429) return true;  // request timeout / rate limit
  return false;
}

export async function processQueue() {
  const store = useSyncStore.getState();
  if (!store.isOnline) return;
  // Don't drain the queue while the workspace is locked. Mutations stay
  // in `pending` and flush automatically when the gate flips back to
  // 'allow' via the heartbeat or manual retry.
  if (_billingPaused) return;

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
      // If the user dropped network mid-loop, abort immediately. We don't
      // want to burn through 50 mutations each timing out for 30s.
      if (!useSyncStore.getState().isOnline) break;

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
            await updateReferences(entry.entityType, entityId, serverRecord._id);
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
        // Same logout-race rule as deltaSync: if the token is gone the
        // remaining mutations will all hit 401 and there's nothing
        // useful to surface. Bail out of the queue silently — the api
        // interceptor already handled the redirect to /login.
        if (err?.response?.status === 401) {
          break;
        }

        const transient = isTransientError(err);
        console.error(
          `Mutation ${transient ? 'pending (transient error)' : 'failed'} ` +
            `[${entry.entityType}/${entry.action}]:`,
          err.message
        );

        if (transient) {
          // Leave status='pending'. The next periodic sync (60s) or the
          // next NetInfo reconnect will re-attempt. Surface a transient
          // error in the store so devs/QA can see it but don't escalate.
          store.addSyncError({
            type: 'mutation',
            transient: true,
            entityType: entry.entityType,
            action: entry.action,
            message: err.message,
            at: new Date().toISOString(),
          });
          // If this was a transport-level failure (no response from the
          // server) the rest of the queue is going to hit the same wall
          // — bail to avoid burning through 30s timeouts. We do NOT
          // touch `isOnline` here; the OS link-layer signal owns
          // connectivity, mirroring the desktop's `navigator.onLine`.
          if (!err.response) break;
        } else {
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

async function resolveRefId(tempId, entityType) {
  if (!tempId) return tempId;
  const mapping = await getIdMapping(tempId, entityType);
  return mapping ? mapping.realId : tempId;
}

async function resolveMediaId(tempId) {
  if (!tempId) return tempId;
  const mapping = await getIdMapping(tempId, 'media');
  if (mapping) return mapping.realId;

  const db = await getDb();
  const blob = await db.getFirstAsync(`SELECT _id FROM media_blobs WHERE _id = ?`, [tempId]);
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

  for (const [field, entityType] of Object.entries(REF_FIELDS)) {
    if (resolved[field]) {
      const mapping = await getIdMapping(resolved[field], entityType);
      if (mapping) resolved[field] = mapping.realId;
    }
  }

  for (const [field, entityType] of Object.entries(ARRAY_REF_FIELDS)) {
    if (Array.isArray(resolved[field])) {
      resolved[field] = await Promise.all(
        resolved[field].map((id) => resolveRefId(id, entityType))
      );
    }
  }

  for (const [arrayField, refMap] of Object.entries(ITEM_ARRAYS)) {
    if (!Array.isArray(resolved[arrayField])) continue;
    resolved[arrayField] = await Promise.all(
      resolved[arrayField].map(async (item) => {
        if (!item || typeof item !== 'object') return item;
        const copy = { ...item };
        for (const [itemField, entityType] of Object.entries(refMap)) {
          if (copy[itemField]) copy[itemField] = await resolveRefId(copy[itemField], entityType);
        }
        return copy;
      })
    );
  }

  for (const field of SINGLE_MEDIA_FIELDS) {
    if (resolved[field]) resolved[field] = await resolveMediaId(resolved[field]);
  }

  for (const [objField, config] of Object.entries(NESTED_REF_OBJECTS)) {
    if (resolved[objField] && typeof resolved[objField] === 'object') {
      const nested = { ...resolved[objField] };
      for (const [field, entityType] of Object.entries(config.refFields || {})) {
        if (nested[field]) nested[field] = await resolveRefId(nested[field], entityType);
      }
      for (const field of config.mediaArrayFields || []) {
        nested[field] = await resolveMediaArray(nested[field]);
      }
      resolved[objField] = nested;
    }
  }

  for (const field of ARRAY_MEDIA_FIELDS) {
    if (Array.isArray(resolved[field])) {
      resolved[field] = await resolveMediaArray(resolved[field]);
    }
  }

  if (Array.isArray(resolved.otherDocs)) {
    resolved.otherDocs = await Promise.all(
      resolved.otherDocs.map(async (doc) => {
        if (!doc || !doc[OTHER_DOC_ARRAY_MEDIA_KEY]) return doc;
        return { ...doc, [OTHER_DOC_ARRAY_MEDIA_KEY]: await resolveMediaId(doc[OTHER_DOC_ARRAY_MEDIA_KEY]) };
      })
    );
  }

  return resolved;
}

async function updateReferences(entityType, tempId, realId) {
  const db = await getDb();
  const pending = await db.getAllAsync(
    `SELECT id, entityType, entityId, payload FROM mutation_queue WHERE status = 'pending'`
  );

  const refFieldNames = Object.keys(REF_FIELDS);
  const arrRefFieldNames = Object.keys(ARRAY_REF_FIELDS);

  for (const row of pending) {
    const parsedPayload = row.payload ? JSON.parse(row.payload) : null;
    let payload = parsedPayload ? { ...parsedPayload } : null;
    let changed = false;

    if (payload) {
      for (const field of refFieldNames) {
        if (payload[field] === tempId) {
          payload[field] = realId;
          changed = true;
        }
      }
      for (const field of arrRefFieldNames) {
        if (Array.isArray(payload[field])) {
          const idx = payload[field].indexOf(tempId);
          if (idx !== -1) {
            payload[field] = [...payload[field]];
            payload[field][idx] = realId;
            changed = true;
          }
        }
      }
      for (const arrayField of Object.keys(ITEM_ARRAYS)) {
        if (Array.isArray(payload[arrayField])) {
          payload[arrayField] = payload[arrayField].map((item) => {
            if (!item || typeof item !== 'object') return item;
            let local = item;
            for (const [k] of Object.entries(ITEM_ARRAYS[arrayField])) {
              if (item[k] === tempId) {
                local = { ...local, [k]: realId };
                changed = true;
              }
            }
            return local;
          });
        }
      }
    }

    const isSelfEntity = row.entityId === tempId && row.entityType === entityType;
    if (isSelfEntity) {
      await db.runAsync(
        `UPDATE mutation_queue SET entityId = ?, payload = ? WHERE id = ?`,
        [realId, changed ? JSON.stringify(payload) : row.payload, row.id]
      );
    } else if (changed) {
      await db.runAsync(
        `UPDATE mutation_queue SET payload = ? WHERE id = ?`,
        [JSON.stringify(payload), row.id]
      );
    }
  }
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
