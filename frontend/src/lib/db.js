import Dexie from 'dexie';

const db = new Dexie('PoultryManagerDB');

db.version(1).stores({
  batches: '_id, farm, status, updatedAt',
  sources: '_id, batch, updatedAt',
  expenses: '_id, batch, category, source, feedOrder, saleOrder, updatedAt',
  feedOrders: '_id, batch, updatedAt',
  feedOrderItems: '_id, feedOrder, updatedAt',
  saleOrders: '_id, batch, updatedAt',
  businesses: '_id, updatedAt, deletedAt',
  contacts: '_id, updatedAt, deletedAt',
  workers: '_id, updatedAt, deletedAt',
  farms: '_id, updatedAt, deletedAt',
  feedItems: '_id, feedCompany, updatedAt, deletedAt',
  media: '_id, entity_type, entity_id, updatedAt',
  settings: 'key',

  mutationQueue: '++id, entityType, entityId, status, createdAt',
  syncMeta: 'entityType',
  idMap: '[tempId+entityType]',
  mediaBlobs: '_id',
});

db.version(2).stores({
  transfers: '_id, business, updatedAt, deletedAt',
});

db.version(3).stores({
  houses: '_id, farm, updatedAt, deletedAt',
});

db.version(4).stores({
  dailyLogs: '_id, batch, house, date, logType, updatedAt, deletedAt',
});

export const ENTITY_TABLES = [
  'batches', 'sources', 'expenses', 'feedOrders', 'feedOrderItems',
  'saleOrders', 'businesses', 'contacts', 'workers', 'farms', 'houses',
  'feedItems', 'transfers', 'dailyLogs', 'media',
];

export const SOFT_DELETE_TABLES = ['businesses', 'contacts', 'workers', 'farms', 'houses', 'feedItems', 'transfers', 'dailyLogs'];

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

export default db;
