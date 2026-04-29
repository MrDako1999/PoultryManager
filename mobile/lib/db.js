import { AppState } from 'react-native';
import * as SQLite from 'expo-sqlite';
import { EventEmitter } from './events';
import { isNativeHandleError as classifyNativeHandleError } from './errorClassify';
import { recordError } from './errorBuffer';

export const dbEvents = new EventEmitter();

// Module-level handle cache. We do NOT assign `_db` until init has
// fully succeeded (PRAGMA + migrations + ping) so a partial failure
// can't leave a dead handle wedged in the cache. `_dbInitPromise`
// dedupes concurrent openers — without it two parallel callers (e.g.
// the auth checkAuth + a useLocalQuery refresh on first paint) would
// both run runMigrations.
let _db = null;
let _dbInitPromise = null;

async function pingHandle(db) {
  try {
    await db.getFirstAsync('SELECT 1');
    return true;
  } catch {
    return false;
  }
}

async function openAndMigrateDb() {
  const db = await SQLite.openDatabaseAsync('PoultryManagerDB');
  // PRAGMA journal_mode can fail on some sandboxed filesystems
  // (notably Huawei EMUI's "PrivateSpace" / sandbox-encrypted dirs).
  // It's an optimisation, not a correctness requirement, so log and
  // continue rather than refusing to boot the DB.
  try {
    await db.execAsync(`PRAGMA journal_mode = WAL;`);
  } catch (err) {
    console.warn('[db] PRAGMA journal_mode = WAL failed (continuing):', err?.message);
    recordError('getDb', err, undefined, { phase: 'pragma_wal' });
  }
  try {
    await runMigrations(db, BASE_MIGRATIONS);
  } catch (err) {
    recordError('getDb', err, undefined, { phase: 'migrations' });
    try { await db.closeAsync(); } catch {}
    throw err;
  }
  // A handle that returned successfully from openDatabaseAsync but
  // can't service a SELECT is a Huawei/EMUI failure mode we keep
  // hitting in the field. Surface it loudly so it can't masquerade as
  // "no data" downstream.
  if (!(await pingHandle(db))) {
    try { await db.closeAsync(); } catch {}
    const err = new Error('[db] handle did not respond to SELECT 1 after init');
    recordError('getDb', err, 'native_handle', { phase: 'post_init_ping' });
    throw err;
  }
  return db;
}

export async function getDb() {
  if (_db) return _db;
  if (_dbInitPromise) return _dbInitPromise;
  _dbInitPromise = openAndMigrateDb()
    .then((db) => {
      _db = db;
      return db;
    })
    .catch((err) => {
      // Don't memoise a failure — the next caller should retry from
      // scratch (most often the failure is transient: cold-boot race
      // against the sandbox unlocking, OS reclaim, etc.).
      _dbInitPromise = null;
      throw err;
    });
  return _dbInitPromise;
}

/**
 * Nuclear reset — close the cached connection (if any), delete the
 * SQLite file on disk, and clear our caches. Next `getDb()` call
 * reopens from scratch and re-runs every migration. Triggered from
 * the hidden Batches diagnostic when a user is wedged with a dead
 * native handle that won't recover even after AppState revalidation.
 */
export async function resetDb() {
  const closing = _db;
  _db = null;
  _dbInitPromise = null;
  if (closing) {
    try { await closing.closeAsync(); } catch (err) {
      console.warn('[db] closeAsync during reset failed:', err?.message);
    }
  }
  try {
    await SQLite.deleteDatabaseAsync('PoultryManagerDB');
  } catch (err) {
    // Missing file is the expected case on a brand-new install or
    // after Huawei's auto-clean wiped the data dir behind our back —
    // not worth surfacing.
    if (!/does not exist|no such/i.test(String(err?.message || ''))) {
      console.warn('[db] deleteDatabaseAsync failed:', err?.message);
    }
  }
}

// Re-export the shared classifier so existing/eventual callers can
// keep importing it from `@/lib/db` without caring about the split.
// Live definition lives in `./errorClassify` to break the circular
// dependency with `./errorBuffer`.
export const isNativeHandleError = classifyNativeHandleError;

/**
 * Evict the cached handle so the next getDb() reopens from scratch.
 * Best-effort closeAsync on the corpse so its native resources get
 * cleaned up if at all possible. Always emits a 'reconnect' event so
 * the sync engine can refresh after the reset.
 */
async function evictDeadHandle(reason) {
  const dead = _db;
  _db = null;
  _dbInitPromise = null;
  if (dead) {
    try { await dead.closeAsync(); } catch {}
  }
  console.warn(`[db] evicted dead handle: ${reason}`);
  dbEvents.emit('reconnect');
}

// Validate the cached handle whenever the app returns to foreground.
// On Android — and Huawei in particular — the JSI binding behind the
// SQLite handle gets torn down while the JS-side reference is still
// live. The first prepareAsync after resume then rejects with
// `java.lang.NullPointerException` and every subsequent op piles on
// the same way (we saw this with two stacked sync errors before
// catching it). Pinging on resume lets us evict the corpse so the
// next getDb() opens a fresh connection.
let _appStateSub = null;
if (typeof AppState?.addEventListener === 'function') {
  _appStateSub = AppState.addEventListener('change', async (state) => {
    if (state !== 'active' || !_db) return;
    const alive = await pingHandle(_db);
    if (!alive) {
      recordError(
        'getDb',
        new Error('cached handle dead on AppState resume'),
        'native_handle',
        { phase: 'resume_ping' }
      );
      await evictDeadHandle('AppState resume ping failed');
    }
  });
}
// Exported so unit tests / dev-only flows can detach if needed; the
// reference also keeps the listener pinned in __DEV__ Fast Refresh.
export const _appStateSubscription = _appStateSub;

/**
 * Wraps a DB operation so a single native-handle failure (NPE etc.)
 * triggers an evict + retry against a freshly-opened connection.
 * Belt-and-suspenders for the AppState resume ping: ops can fire in
 * the gap before that listener runs (cold-foreground races, ops on a
 * still-foreground app whose handle rotted under it). One retry only —
 * if the second attempt also fails we bubble the error so the caller
 * can surface it instead of looping forever.
 *
 * `fn` MUST be a thunk that re-runs `getDb()` itself (the wrapped
 * public ops here all do). That's how the retry picks up the new
 * handle after eviction.
 */
export async function withDbRetry(fn) {
  try {
    return await fn();
  } catch (err) {
    if (!isNativeHandleError(err)) throw err;
    // Record both attempts so the diagnostic shows the full picture:
    // it's the difference between "transient handle blip we recovered
    // from" (one entry) vs. "DB is genuinely wedged" (two entries
    // close in time, same kind).
    recordError('withDbRetry', err, 'native_handle', { phase: 'first_attempt' });
    await evictDeadHandle(`first attempt rejected with native error: ${err.message || err}`);
    try {
      return await fn();
    } catch (retryErr) {
      recordError('withDbRetry', retryErr, undefined, { phase: 'retry_attempt' });
      throw retryErr;
    }
  }
}

/**
 * Read-only peek at the cache state. Used by the diagnostic so we can
 * tell on-device whether `getDb()` was ever successfully reached or
 * whether we're stuck in the broken-handle gutter.
 */
export function inspectDbCacheState() {
  return {
    cached: _db !== null,
    initPending: _dbInitPromise !== null,
  };
}

const BASE_MIGRATIONS = [
  {
    id: 'v1_initial_schema',
    up: async (db) => {
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS batches (_id TEXT PRIMARY KEY, data TEXT, updatedAt TEXT);
        CREATE TABLE IF NOT EXISTS sources (_id TEXT PRIMARY KEY, data TEXT, batch TEXT, updatedAt TEXT);
        CREATE TABLE IF NOT EXISTS expenses (_id TEXT PRIMARY KEY, data TEXT, batch TEXT, updatedAt TEXT);
        CREATE TABLE IF NOT EXISTS feedOrders (_id TEXT PRIMARY KEY, data TEXT, batch TEXT, updatedAt TEXT);
        CREATE TABLE IF NOT EXISTS feedOrderItems (_id TEXT PRIMARY KEY, data TEXT, feedOrder TEXT, updatedAt TEXT);
        CREATE TABLE IF NOT EXISTS saleOrders (_id TEXT PRIMARY KEY, data TEXT, batch TEXT, updatedAt TEXT);
        CREATE TABLE IF NOT EXISTS businesses (_id TEXT PRIMARY KEY, data TEXT, updatedAt TEXT, deletedAt TEXT);
        CREATE TABLE IF NOT EXISTS contacts (_id TEXT PRIMARY KEY, data TEXT, updatedAt TEXT, deletedAt TEXT);
        CREATE TABLE IF NOT EXISTS workers (_id TEXT PRIMARY KEY, data TEXT, updatedAt TEXT, deletedAt TEXT);
        CREATE TABLE IF NOT EXISTS farms (_id TEXT PRIMARY KEY, data TEXT, updatedAt TEXT, deletedAt TEXT);
        CREATE TABLE IF NOT EXISTS houses (_id TEXT PRIMARY KEY, data TEXT, farm TEXT, updatedAt TEXT, deletedAt TEXT);
        CREATE TABLE IF NOT EXISTS feedItems (_id TEXT PRIMARY KEY, data TEXT, feedCompany TEXT, updatedAt TEXT, deletedAt TEXT);
        CREATE TABLE IF NOT EXISTS transfers (_id TEXT PRIMARY KEY, data TEXT, business TEXT, updatedAt TEXT, deletedAt TEXT);
        CREATE TABLE IF NOT EXISTS dailyLogs (_id TEXT PRIMARY KEY, data TEXT, batch TEXT, house TEXT, updatedAt TEXT, deletedAt TEXT);
        CREATE TABLE IF NOT EXISTS media (_id TEXT PRIMARY KEY, data TEXT, updatedAt TEXT);
        CREATE TABLE IF NOT EXISTS users (_id TEXT PRIMARY KEY, data TEXT, updatedAt TEXT, deletedAt TEXT);

        CREATE TABLE IF NOT EXISTS mutation_queue (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          entityType TEXT NOT NULL,
          action TEXT NOT NULL,
          entityId TEXT,
          payload TEXT,
          mediaFields TEXT,
          status TEXT DEFAULT 'pending',
          createdAt TEXT NOT NULL,
          error TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_mq_status ON mutation_queue(status);

        CREATE TABLE IF NOT EXISTS sync_meta (
          entityType TEXT PRIMARY KEY,
          lastSyncAt TEXT
        );

        CREATE TABLE IF NOT EXISTS id_map (
          tempId TEXT NOT NULL,
          entityType TEXT NOT NULL,
          realId TEXT NOT NULL,
          PRIMARY KEY (tempId, entityType)
        );

        CREATE TABLE IF NOT EXISTS settings (
          key TEXT PRIMARY KEY,
          value TEXT
        );

        CREATE TABLE IF NOT EXISTS media_blobs (
          _id TEXT PRIMARY KEY,
          blob BLOB,
          filename TEXT,
          mimeType TEXT,
          metadata TEXT
        );
      `);
    },
  },
  {
    // Backfill for installs that ran v1 before the `users` table was added
    // to the v1 statement. Those devices have v1 marked applied in
    // schema_version, so the new CREATE TABLE never executed and any
    // sync/clear that touches `users` (e.g. logout -> clearAll) explodes
    // with "no such table: users".
    id: 'v2_users_table',
    up: async (db) => {
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS users (_id TEXT PRIMARY KEY, data TEXT, updatedAt TEXT, deletedAt TEXT);
      `);
    },
  },
];

const _moduleMigrations = [];

export function registerModuleMigrations(migrations) {
  if (!Array.isArray(migrations)) return;
  for (const m of migrations) {
    if (!m || !m.id || typeof m.up !== 'function') continue;
    if (_moduleMigrations.some((x) => x.id === m.id)) continue;
    _moduleMigrations.push(m);
  }
}

async function runMigrations(db, migrations) {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS schema_version (
      id TEXT PRIMARY KEY,
      appliedAt TEXT NOT NULL
    );
  `);

  const all = [...migrations, ..._moduleMigrations];
  for (const m of all) {
    const already = await db.getFirstAsync(
      `SELECT id FROM schema_version WHERE id = ?`,
      [m.id]
    );
    if (already) continue;
    try {
      await m.up(db);
      await db.runAsync(
        `INSERT OR REPLACE INTO schema_version (id, appliedAt) VALUES (?, ?)`,
        [m.id, new Date().toISOString()]
      );
    } catch (err) {
      console.error(`Migration ${m.id} failed:`, err);
      throw err;
    }
  }
}

export async function rerunMigrations() {
  const db = await getDb();
  await runMigrations(db, BASE_MIGRATIONS);
}

export const ENTITY_TABLES = [
  'batches', 'sources', 'expenses', 'feedOrders', 'feedOrderItems',
  'saleOrders', 'businesses', 'contacts', 'workers', 'farms', 'houses',
  'feedItems', 'transfers', 'dailyLogs', 'media', 'users',
];

export const SOFT_DELETE_TABLES = [
  'businesses', 'contacts', 'workers', 'farms', 'houses', 'feedItems',
  'transfers', 'dailyLogs', 'users',
];

export const ENTITY_API_MAP = {
  batches: '/batches',
  sources: '/sources',
  expenses: '/expenses',
  feedOrders: '/feed-orders',
  feedOrderItems: null,
  saleOrders: '/sale-orders',
  businesses: '/businesses',
  contacts: '/contacts',
  workers: '/workers',
  farms: '/farms',
  houses: '/houses',
  feedItems: '/feed-items',
  transfers: '/transfers',
  dailyLogs: '/daily-logs',
  media: '/media',
  users: '/users',
};

export const SYNC_ORDER = [
  'businesses', 'contacts', 'farms', 'houses', 'workers', 'users', 'feedItems',
  'transfers',
  'batches', 'sources', 'feedOrders', 'feedOrderItems', 'saleOrders',
  'expenses', 'dailyLogs', 'media',
];

// Every public op below is wrapped in `withDbRetry`. The wrapped
// thunk MUST call `getDb()` inside (not capture an outer reference)
// so that after an evict-on-NPE the retry actually picks up the
// freshly opened connection.

export async function upsertEntities(tableName, records) {
  if (!records || records.length === 0) return;
  await withDbRetry(async () => {
    const db = await getDb();
    const stmt = await db.prepareAsync(
      `INSERT OR REPLACE INTO ${tableName} (_id, data, updatedAt) VALUES ($id, $data, $updatedAt)`
    );
    try {
      for (const record of records) {
        await stmt.executeAsync({
          $id: record._id,
          $data: JSON.stringify(record),
          $updatedAt: record.updatedAt || new Date().toISOString(),
        });
      }
    } finally {
      try { await stmt.finalizeAsync(); } catch {}
    }
  });
  dbEvents.emit('change', tableName);
}

export async function getAllEntities(tableName) {
  return withDbRetry(async () => {
    const db = await getDb();
    const rows = await db.getAllAsync(`SELECT data FROM ${tableName}`);
    return rows.map((r) => JSON.parse(r.data));
  });
}

export async function getEntityById(tableName, id) {
  return withDbRetry(async () => {
    const db = await getDb();
    const row = await db.getFirstAsync(`SELECT data FROM ${tableName} WHERE _id = ?`, [id]);
    return row ? JSON.parse(row.data) : null;
  });
}

export async function deleteEntities(tableName, ids) {
  if (!ids || ids.length === 0) return;
  await withDbRetry(async () => {
    const db = await getDb();
    const placeholders = ids.map(() => '?').join(',');
    await db.runAsync(`DELETE FROM ${tableName} WHERE _id IN (${placeholders})`, ids);
  });
  dbEvents.emit('change', tableName);
}

export async function clearTable(tableName) {
  try {
    await withDbRetry(async () => {
      const db = await getDb();
      await db.runAsync(`DELETE FROM ${tableName}`);
    });
    dbEvents.emit('change', tableName);
  } catch (err) {
    // A missing table here would cascade and break logout / fullResync,
    // since callers loop over ENTITY_TABLES. Swallow that specific case
    // so the rest of the cleanup still runs; surface anything else.
    const msg = String(err?.message || '');
    if (/no such table/i.test(msg)) {
      console.warn(`[db] clearTable skipped (missing table): ${tableName}`);
      return;
    }
    throw err;
  }
}

export async function getSyncMeta(entityType) {
  return withDbRetry(async () => {
    const db = await getDb();
    return db.getFirstAsync(`SELECT * FROM sync_meta WHERE entityType = ?`, [entityType]);
  });
}

export async function getSyncMetaCount() {
  return withDbRetry(async () => {
    const db = await getDb();
    const row = await db.getFirstAsync(`SELECT COUNT(*) as count FROM sync_meta`);
    return row?.count || 0;
  });
}

export async function upsertSyncMeta(entries) {
  await withDbRetry(async () => {
    const db = await getDb();
    const stmt = await db.prepareAsync(
      `INSERT OR REPLACE INTO sync_meta (entityType, lastSyncAt) VALUES ($entityType, $lastSyncAt)`
    );
    try {
      for (const entry of entries) {
        await stmt.executeAsync({ $entityType: entry.entityType, $lastSyncAt: entry.lastSyncAt });
      }
    } finally {
      try { await stmt.finalizeAsync(); } catch {}
    }
  });
}

export async function getSettings(key) {
  return withDbRetry(async () => {
    const db = await getDb();
    const row = await db.getFirstAsync(`SELECT value FROM settings WHERE key = ?`, [key]);
    return row ? JSON.parse(row.value) : null;
  });
}

export async function upsertSettings(entries) {
  await withDbRetry(async () => {
    const db = await getDb();
    const stmt = await db.prepareAsync(
      `INSERT OR REPLACE INTO settings (key, value) VALUES ($key, $value)`
    );
    try {
      for (const entry of entries) {
        await stmt.executeAsync({ $key: entry.key, $value: JSON.stringify(entry.value) });
      }
    } finally {
      try { await stmt.finalizeAsync(); } catch {}
    }
  });
}

export async function getIdMapping(tempId, entityType) {
  return withDbRetry(async () => {
    const db = await getDb();
    return db.getFirstAsync(
      `SELECT realId FROM id_map WHERE tempId = ? AND entityType = ?`,
      [tempId, entityType]
    );
  });
}

export async function putIdMapping(tempId, entityType, realId) {
  await withDbRetry(async () => {
    const db = await getDb();
    await db.runAsync(
      `INSERT OR REPLACE INTO id_map (tempId, entityType, realId) VALUES (?, ?, ?)`,
      [tempId, entityType, realId]
    );
  });
}
