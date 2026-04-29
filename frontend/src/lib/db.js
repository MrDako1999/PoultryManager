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

// Slaughterhouse module tables. Indexes capture the foreign keys we
// query the most often so useLocalQuery({ <key>: id }) hits an index
// instead of scanning the whole store. `expiresAt` is indexed on the
// production rows + stock units so the cold-store expiry alerts can
// stream sorted results.
db.version(5).stores({
  processingJobs: '_id, customer, status, openedAt, closedAt, updatedAt, deletedAt',
  truckEntries: '_id, job, supplier, status, arrivedAt, updatedAt, deletedAt',
  productionBoxes: '_id, job, weightBandGrams, allocation, expiresAt, updatedAt, deletedAt',
  productionPortions: '_id, job, partType, allocation, expiresAt, updatedAt, deletedAt',
  productionGiblets: '_id, job, partType, allocation, expiresAt, updatedAt, deletedAt',
  stockUnits: '_id, owner, location, allocation, expiresAt, sourceType, sourceId, updatedAt, deletedAt',
  stockMovements: '_id, stockUnit, type, occurredAt, updatedAt',
  handovers: '_id, customer, dispatchedAt, status, updatedAt, deletedAt',
  handoverItems: '_id, handover, stockUnit, updatedAt',
  processingInvoices: '_id, job, customer, issuedAt, updatedAt, deletedAt',
  priceLists: '_id, business, updatedAt, deletedAt',
  storageLocations: '_id, name, temperatureZone, updatedAt, deletedAt',
});

export const ENTITY_TABLES = [
  'batches', 'sources', 'expenses', 'feedOrders', 'feedOrderItems',
  'saleOrders', 'businesses', 'contacts', 'workers', 'farms', 'houses',
  'feedItems', 'transfers', 'dailyLogs', 'media',
  // Slaughterhouse
  'processingJobs', 'truckEntries',
  'productionBoxes', 'productionPortions', 'productionGiblets',
  'stockUnits', 'stockMovements',
  'handovers', 'handoverItems',
  'processingInvoices', 'priceLists', 'storageLocations',
];

export const SOFT_DELETE_TABLES = [
  'businesses', 'contacts', 'workers', 'farms', 'houses', 'feedItems',
  'transfers', 'dailyLogs',
  // Slaughterhouse: every entity that supports edit-then-undelete needs
  // to be in this list, otherwise useLocalQuery won't filter
  // deletedAt-marked records. stockMovements is intentionally excluded
  // (append-only audit log).
  'processingJobs', 'truckEntries',
  'productionBoxes', 'productionPortions', 'productionGiblets',
  'stockUnits', 'handovers', 'handoverItems',
  'processingInvoices', 'priceLists', 'storageLocations',
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
  // Slaughterhouse — frontend-only this round (precedent: feedOrderItems).
  // The sync engine fast-paths these through processQueue:
  //   if (!apiPath) await db.mutationQueue.update(entry.id, { status: 'synced' });
  // so writes persist locally without hitting any endpoint. When the
  // backend lands, populating these paths re-engages full sync. See
  // §11 of the slaughterhouse plan for the post-backend backfill note.
  processingJobs: null,
  truckEntries: null,
  productionBoxes: null,
  productionPortions: null,
  productionGiblets: null,
  stockUnits: null,
  stockMovements: null,
  handovers: null,
  handoverItems: null,
  processingInvoices: null,
  priceLists: null,
  storageLocations: null,
};

export const SYNC_ORDER = [
  'businesses', 'contacts', 'farms', 'houses', 'workers', 'feedItems',
  'transfers',
  'batches', 'sources', 'feedOrders', 'feedOrderItems', 'saleOrders',
  'expenses', 'dailyLogs',
  // Slaughterhouse — parents before children. storageLocations and
  // priceLists come first because every production / handover row
  // references them.
  'storageLocations', 'priceLists',
  'processingJobs', 'truckEntries',
  'productionBoxes', 'productionPortions', 'productionGiblets',
  'stockUnits', 'stockMovements',
  'handovers', 'handoverItems',
  'processingInvoices',
  'media',
];

export default db;
