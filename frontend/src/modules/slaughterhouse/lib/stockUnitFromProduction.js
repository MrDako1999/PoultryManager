// Helper that turns a fresh production row into the matching stockUnit
// payload. Centralised so all three production sheets (boxes, portions,
// giblets) build stockUnits with the same shape and the cold-store +
// handover flows can rely on a consistent contract.
//
// Owner is sourced from the parent job's customer (toll-processing
// model: the customer owns the produced inventory while it sits in the
// slaughterhouse cold store). For self-processing tenants the customer
// is themselves, so this still works.

import { computeExpiresAt } from './expiry';

const num = (v) => (Number(v) || 0);

function ownerOfJob(job) {
  if (!job) return null;
  return typeof job.customer === 'object' ? job.customer?._id : job.customer || null;
}

function defaultLocationId(storageLocations) {
  const live = (storageLocations || []).filter((l) => !l.deletedAt);
  const freezer = live.find((l) => (l.name || '').toLowerCase() === 'freezer');
  return (freezer || live[0])?._id || null;
}

export function buildBoxStockUnit({ box, job, storageLocations }) {
  const totalBirds = box.totalBirds != null
    ? num(box.totalBirds)
    : num(box.boxQty) * num(box.birdsPerBox);
  const totalKg = box.totalKg != null
    ? num(box.totalKg)
    : totalBirds * (num(box.weightBandGrams) / 1000);
  return {
    sourceType: 'box',
    sourceId: box._id,
    owner: ownerOfJob(job),
    location: box.storageLocation || defaultLocationId(storageLocations),
    allocation: box.allocation || 'STOCK',
    weightKg: totalKg,
    weightBandGrams: box.weightBandGrams,
    qtyAvailable: num(box.boxQty),
    qtyReserved: 0,
    packagedAt: box.packagedAt || new Date().toISOString(),
    expiresAt: box.expiresAt || null,
    temperatureZone: 'FROZEN',
    damagedQty: 0,
  };
}

export function buildPortionStockUnit({ row, job, storageLocations, kind = 'portion' }) {
  const totalKg = row.totalKg != null
    ? num(row.totalKg)
    : num(row.trayCount) * num(row.weightPerTray);
  return {
    sourceType: kind, // 'portion' | 'giblet'
    sourceId: row._id,
    partType: row.partType,
    owner: ownerOfJob(job),
    location: row.storageLocation || defaultLocationId(storageLocations),
    allocation: row.allocation || 'STOCK',
    weightKg: totalKg,
    qtyAvailable: num(row.trayCount),
    qtyReserved: 0,
    packagedAt: row.packagedAt || new Date().toISOString(),
    expiresAt: row.expiresAt || null,
    temperatureZone: 'CHILLED',
    damagedQty: 0,
  };
}

// Auto-compute expiresAt from packagedAt + the tenant's default shelf
// life for the given kind (boxes/portions/giblets). The setter is
// passed in (rather than mutated state from outside) so callers stay
// pure functional with the rest of their effects.
export function autoExpires({ packagedAt, kind, slaughterhouseSettings }) {
  return computeExpiresAt({ packagedAt, kind, slaughterhouseSettings });
}
