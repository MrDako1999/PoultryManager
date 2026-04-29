// Per-module role capabilities for the slaughterhouse module.
//
// Same contract as broiler/capabilities.js: actions are merged with
// DEFAULT_ROLE_ACTIONS in shared/permissions.js when the slaughterhouse
// module is active for the effective user. Module capabilities are
// additive; subtraction is what user.permissions.deny[] is for.
//
// Six new operational roles (gate_clerk, receiving_worker,
// processing_supervisor, packing_worker, cold_store_user, dispatch_user)
// are scoped to the slaughterhouse domain and grant nothing on broiler
// entities. The shared roles (owner, manager, accountant, viewer) get
// slaughterhouse capabilities here on top of whatever broiler grants
// them.
//
// HR worker.role enum stays unchanged — these capabilities apply to
// app-access (sub-user) accounts, not HR worker records.

export const slaughterhouseCapabilities = {
  owner: ['*'],

  manager: [
    'processingJob:*', 'truckEntry:*',
    'productionBox:*', 'productionPortion:*', 'productionGiblet:*',
    'stockUnit:*', 'stockMovement:*',
    'handover:*', 'handoverItem:*',
    'processingInvoice:*', 'priceList:*', 'storageLocation:*',
    'business:*', 'contact:*', 'worker:*',
    'media:*',
  ],

  accountant: [
    'processingJob:read', 'truckEntry:read',
    'productionBox:read', 'productionPortion:read', 'productionGiblet:read',
    'stockUnit:read', 'stockMovement:read',
    'handover:read', 'handoverItem:read',
    'processingInvoice:*', 'priceList:*',
    'business:read', 'business:create', 'business:update',
    'contact:read', 'contact:create', 'contact:update',
    'media:read', 'media:create',
  ],

  // Gate / Reception — registers truck arrivals and assigns queue position.
  gate_clerk: [
    'processingJob:read',
    'processingJob:create',
    'truckEntry:create', 'truckEntry:read', 'truckEntry:update:own',
    'business:read', 'contact:read', 'contact:create',
    'media:read', 'media:create',
  ],

  // Unloading inspection — DOA, condemned, B-grade, photos.
  receiving_worker: [
    'processingJob:read',
    'truckEntry:read', 'truckEntry:update',
    'media:read', 'media:create',
  ],

  // Line oversight — close jobs, approve variance, override worker counts.
  processing_supervisor: [
    'processingJob:*', 'truckEntry:*',
    'productionBox:read', 'productionPortion:read', 'productionGiblet:read',
    'stockUnit:read',
    'handover:read',
    'business:read', 'contact:read', 'worker:read',
    'media:*',
  ],

  // Packing — boxes, portions, giblets.
  packing_worker: [
    'processingJob:read',
    'productionBox:create', 'productionBox:read', 'productionBox:update:own',
    'productionPortion:create', 'productionPortion:read', 'productionPortion:update:own',
    'productionGiblet:create', 'productionGiblet:read', 'productionGiblet:update:own',
    'media:read', 'media:create',
  ],

  // Cold store — inventory views, movements, damage logging.
  cold_store_user: [
    'stockUnit:read', 'stockUnit:update',
    'stockMovement:create', 'stockMovement:read',
    'storageLocation:read',
    'processingJob:read',
    'media:read', 'media:create',
  ],

  // Dispatch — outbound vehicles, signatures, doc generation.
  dispatch_user: [
    'handover:*', 'handoverItem:*',
    'stockUnit:read',
    'business:read', 'contact:read', 'contact:create',
    'media:read', 'media:create',
  ],

  viewer: [
    'processingJob:read', 'truckEntry:read',
    'productionBox:read', 'productionPortion:read', 'productionGiblet:read',
    'stockUnit:read', 'stockMovement:read',
    'handover:read', 'handoverItem:read',
    'processingInvoice:read', 'priceList:read', 'storageLocation:read',
    'business:read', 'contact:read', 'worker:read',
    'media:read',
  ],
};

export default slaughterhouseCapabilities;
