import * as SQLite from 'expo-sqlite';
import { EventEmitter } from './events';

export const dbEvents = new EventEmitter();

let _db = null;

export async function getDb() {
  if (_db) return _db;
  _db = await SQLite.openDatabaseAsync('PoultryManagerDB');
  await _db.execAsync(`PRAGMA journal_mode = WAL;`);
  await initSchema(_db);
  return _db;
}

async function initSchema(db) {
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
}

export const ENTITY_TABLES = [
  'batches', 'sources', 'expenses', 'feedOrders', 'feedOrderItems',
  'saleOrders', 'businesses', 'contacts', 'workers', 'farms', 'houses',
  'feedItems', 'transfers', 'dailyLogs', 'media',
];

export const SOFT_DELETE_TABLES = [
  'businesses', 'contacts', 'workers', 'farms', 'houses', 'feedItems', 'transfers', 'dailyLogs',
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
};

export const SYNC_ORDER = [
  'businesses', 'contacts', 'farms', 'houses', 'workers', 'feedItems',
  'transfers',
  'batches', 'sources', 'feedOrders', 'feedOrderItems', 'saleOrders',
  'expenses', 'dailyLogs', 'media',
];

export async function upsertEntities(tableName, records) {
  if (!records || records.length === 0) return;
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
    await stmt.finalizeAsync();
  }
  dbEvents.emit('change', tableName);
}

export async function getAllEntities(tableName) {
  const db = await getDb();
  const rows = await db.getAllAsync(`SELECT data FROM ${tableName}`);
  return rows.map((r) => JSON.parse(r.data));
}

export async function getEntityById(tableName, id) {
  const db = await getDb();
  const row = await db.getFirstAsync(`SELECT data FROM ${tableName} WHERE _id = ?`, [id]);
  return row ? JSON.parse(row.data) : null;
}

export async function deleteEntities(tableName, ids) {
  if (!ids || ids.length === 0) return;
  const db = await getDb();
  const placeholders = ids.map(() => '?').join(',');
  await db.runAsync(`DELETE FROM ${tableName} WHERE _id IN (${placeholders})`, ids);
  dbEvents.emit('change', tableName);
}

export async function clearTable(tableName) {
  const db = await getDb();
  await db.runAsync(`DELETE FROM ${tableName}`);
  dbEvents.emit('change', tableName);
}

export async function getSyncMeta(entityType) {
  const db = await getDb();
  return db.getFirstAsync(`SELECT * FROM sync_meta WHERE entityType = ?`, [entityType]);
}

export async function getSyncMetaCount() {
  const db = await getDb();
  const row = await db.getFirstAsync(`SELECT COUNT(*) as count FROM sync_meta`);
  return row?.count || 0;
}

export async function upsertSyncMeta(entries) {
  const db = await getDb();
  const stmt = await db.prepareAsync(
    `INSERT OR REPLACE INTO sync_meta (entityType, lastSyncAt) VALUES ($entityType, $lastSyncAt)`
  );
  try {
    for (const entry of entries) {
      await stmt.executeAsync({ $entityType: entry.entityType, $lastSyncAt: entry.lastSyncAt });
    }
  } finally {
    await stmt.finalizeAsync();
  }
}

export async function getSettings(key) {
  const db = await getDb();
  const row = await db.getFirstAsync(`SELECT value FROM settings WHERE key = ?`, [key]);
  return row ? JSON.parse(row.value) : null;
}

export async function upsertSettings(entries) {
  const db = await getDb();
  const stmt = await db.prepareAsync(
    `INSERT OR REPLACE INTO settings (key, value) VALUES ($key, $value)`
  );
  try {
    for (const entry of entries) {
      await stmt.executeAsync({ $key: entry.key, $value: JSON.stringify(entry.value) });
    }
  } finally {
    await stmt.finalizeAsync();
  }
}

export async function getIdMapping(tempId, entityType) {
  const db = await getDb();
  return db.getFirstAsync(
    `SELECT realId FROM id_map WHERE tempId = ? AND entityType = ?`,
    [tempId, entityType]
  );
}

export async function putIdMapping(tempId, entityType, realId) {
  const db = await getDb();
  await db.runAsync(
    `INSERT OR REPLACE INTO id_map (tempId, entityType, realId) VALUES (?, ?, ?)`,
    [tempId, entityType, realId]
  );
}
