// Hidden diagnostic helper used to debug situations where the dashboard
// shows batch-derived stats (live birds / mortality / etc.) but the
// Batches list / BatchDetail screens claim no data exists, or where
// the SQLite native handle has rotted on EMUI/HyperOS and every op
// rejects with NPE.
//
// Triggered by a long-press on the Batches screen header title so it
// stays invisible to regular users. Read-only on the happy path; the
// optional self-heal step (only fires when the initial inspect hits a
// native-handle error) calls `resetDb()` and re-inspects.

import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import { getDb, resetDb, inspectDbCacheState } from './db';
import { isNativeHandleError } from './errorClassify';
import { getRecentErrors, getErrorBufferSize } from './errorBuffer';
import useAuthStore from '@/stores/authStore';
import useSyncStore from '@/stores/syncStore';

const yn = (val) => (val ? 'yes' : 'no');

async function tableExists(db, name) {
  const row = await db.getFirstAsync(
    `SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?`,
    [name]
  );
  return !!row;
}

async function countRows(db, table) {
  if (!(await tableExists(db, table))) return null;
  const row = await db.getFirstAsync(`SELECT COUNT(*) as count FROM ${table}`);
  return row?.count ?? 0;
}

async function inspectBatchRows(db) {
  if (!(await tableExists(db, 'batches'))) {
    return { exists: false };
  }
  const rows = await db.getAllAsync(`SELECT _id, data, updatedAt FROM batches`);
  let parsed = 0;
  let failed = 0;
  let firstParseError = null;
  let inProgress = 0;
  let complete = 0;
  let otherStatus = 0;
  let totalQty = 0;
  let firstRowSample = null;

  rows.forEach((r, i) => {
    if (i === 0) {
      firstRowSample = {
        _id: r._id,
        dataLen: r.data?.length ?? 0,
        updatedAt: r.updatedAt,
      };
    }
    let obj;
    try {
      obj = JSON.parse(r.data);
      parsed += 1;
    } catch (err) {
      failed += 1;
      if (!firstParseError) {
        firstParseError = `${r._id}: ${err.message || err}`;
      }
      return;
    }
    if (obj?.status === 'IN_PROGRESS') inProgress += 1;
    else if (obj?.status === 'COMPLETE') complete += 1;
    else otherStatus += 1;
    if (Array.isArray(obj?.houses)) {
      for (const h of obj.houses) totalQty += Number(h?.quantity || 0);
    }
  });

  return {
    exists: true,
    rawCount: rows.length,
    parsed,
    failed,
    firstParseError,
    inProgress,
    complete,
    otherStatus,
    totalQty,
    firstRowSample,
  };
}

async function getBatchesSyncMeta(db) {
  if (!(await tableExists(db, 'sync_meta'))) return null;
  const row = await db.getFirstAsync(
    `SELECT lastSyncAt FROM sync_meta WHERE entityType = ?`,
    ['batches']
  );
  return row?.lastSyncAt || null;
}

async function getMutationStats(db) {
  if (!(await tableExists(db, 'mutation_queue'))) {
    return { pendingBatches: 0, failedBatches: 0, totalPending: 0, totalFailed: 0 };
  }
  const [pendingBatches, failedBatches, totalPending, totalFailed] = await Promise.all([
    db.getFirstAsync(
      `SELECT COUNT(*) as count FROM mutation_queue WHERE entityType = 'batches' AND status = 'pending'`
    ),
    db.getFirstAsync(
      `SELECT COUNT(*) as count FROM mutation_queue WHERE entityType = 'batches' AND status = 'failed'`
    ),
    db.getFirstAsync(
      `SELECT COUNT(*) as count FROM mutation_queue WHERE status = 'pending'`
    ),
    db.getFirstAsync(
      `SELECT COUNT(*) as count FROM mutation_queue WHERE status = 'failed'`
    ),
  ]);
  return {
    pendingBatches: pendingBatches?.count ?? 0,
    failedBatches: failedBatches?.count ?? 0,
    totalPending: totalPending?.count ?? 0,
    totalFailed: totalFailed?.count ?? 0,
  };
}

async function getSchemaVersions(db) {
  if (!(await tableExists(db, 'schema_version'))) return [];
  const rows = await db.getAllAsync(`SELECT id FROM schema_version ORDER BY appliedAt`);
  return rows.map((r) => r.id);
}

/**
 * Run the full battery of inspect queries against the supplied db
 * handle and return them as a structured bundle. Each promise is
 * caught individually so a single failed query (most often the
 * native-handle NPE that motivated this whole file) doesn't blow up
 * the rest of the diagnostic.
 */
async function collectInspect(db) {
  const [
    batchInfo, syncMeta, muStats, schemaIds,
    farmsCount, dailyLogsCount, saleOrdersCount, expensesCount, housesCount,
  ] = await Promise.all([
    inspectBatchRows(db).catch((err) => ({ error: err.message || String(err) })),
    getBatchesSyncMeta(db).catch(() => null),
    getMutationStats(db).catch(() => null),
    getSchemaVersions(db).catch(() => []),
    countRows(db, 'farms').catch(() => null),
    countRows(db, 'dailyLogs').catch(() => null),
    countRows(db, 'saleOrders').catch(() => null),
    countRows(db, 'expenses').catch(() => null),
    countRows(db, 'houses').catch(() => null),
  ]);
  return {
    batchInfo, syncMeta, muStats, schemaIds,
    farmsCount, dailyLogsCount, saleOrdersCount, expensesCount, housesCount,
  };
}

/**
 * True when the inspect bundle indicates we hit a native-handle error
 * (the EMUI failure mode). Drives the optional self-heal step.
 */
function inspectHitNativeHandleError(bundle) {
  const msg = bundle?.batchInfo?.error;
  if (!msg) return false;
  return isNativeHandleError({ message: msg });
}

function expectedDbPath() {
  // expo-sqlite stores under `documentDirectory + 'SQLite/<name>'` on
  // both platforms. We don't actually open the file, just report the
  // path so a tester can confirm location with a file-explorer if
  // needed (and we sanity-check the FileSystem API is wired).
  try {
    const dir = FileSystem.documentDirectory;
    if (!dir) return null;
    return `${dir}SQLite/PoultryManagerDB`;
  } catch {
    return null;
  }
}

function platformLines() {
  const lines = ['Platform:'];
  lines.push(`  os: ${Platform.OS} ${Platform.Version}`);
  // Android exposes Build info under `Platform.constants` (Brand,
  // Manufacturer, Model, Release, Fingerprint). Huawei devices
  // typically come through as Brand=HUAWEI/HONOR, Manufacturer=HUAWEI,
  // which lets us cross-reference field reports with this exact
  // failure mode.
  const c = Platform.constants || {};
  if (Platform.OS === 'android') {
    lines.push(`  brand: ${c.Brand || '-'}`);
    lines.push(`  manufacturer: ${c.Manufacturer || '-'}`);
    lines.push(`  model: ${c.Model || '-'}`);
    if (c.Release) lines.push(`  release: ${c.Release}`);
  }
  const path = expectedDbPath();
  if (path) lines.push(`  db path: ${path}`);
  return lines;
}

function dbCacheLines() {
  const lines = ['DB cache state:'];
  try {
    const s = inspectDbCacheState();
    lines.push(`  cached handle: ${yn(s.cached)}`);
    lines.push(`  init promise pending: ${yn(s.initPending)}`);
  } catch (err) {
    lines.push(`  inspect failed: ${err?.message || err}`);
  }
  return lines;
}

function inspectLines(bundle, headerSuffix = '') {
  const lines = [];
  const { batchInfo, syncMeta, muStats, farmsCount, dailyLogsCount, saleOrdersCount, expensesCount, housesCount } = bundle;

  lines.push('');
  lines.push(`Batches table${headerSuffix}:`);
  if (batchInfo?.error) {
    lines.push(`  inspect failed: ${String(batchInfo.error).slice(0, 200)}`);
  } else if (!batchInfo?.exists) {
    lines.push('  table exists: NO  <-- migration likely missing');
  } else {
    lines.push(`  table exists: yes`);
    lines.push(`  raw rows: ${batchInfo.rawCount}`);
    lines.push(`  parsed ok: ${batchInfo.parsed}`);
    lines.push(`  parse failed: ${batchInfo.failed}`);
    if (batchInfo.firstParseError) {
      lines.push(`  first parse err: ${batchInfo.firstParseError.slice(0, 160)}`);
    }
    lines.push(`  IN_PROGRESS: ${batchInfo.inProgress}`);
    lines.push(`  COMPLETE: ${batchInfo.complete}`);
    lines.push(`  other status: ${batchInfo.otherStatus}`);
    lines.push(`  total houses qty: ${batchInfo.totalQty}`);
    if (batchInfo.firstRowSample) {
      const s = batchInfo.firstRowSample;
      lines.push(`  sample _id: ${s._id} (data ${s.dataLen} chars)`);
    }
  }

  lines.push('');
  lines.push('Sync state:');
  const sync = useSyncStore.getState();
  lines.push(`  isOnline: ${yn(sync.isOnline)}`);
  lines.push(`  isSyncing: ${yn(sync.isSyncing)}`);
  lines.push(`  isFullResyncing: ${yn(sync.isFullResyncing)}`);
  lines.push(`  isInitialSyncing: ${yn(sync.isInitialSyncing)}`);
  lines.push(`  lastSyncAt (store): ${sync.lastSyncAt || '-'}`);
  lines.push(`  lastSyncAt (batches): ${syncMeta || '-'}`);
  lines.push(
    `  mutation queue: pending=${muStats?.totalPending ?? '?'} failed=${muStats?.totalFailed ?? '?'} (batches: p=${muStats?.pendingBatches ?? '?'} f=${muStats?.failedBatches ?? '?'})`
  );
  if (Array.isArray(sync.syncErrors) && sync.syncErrors.length) {
    lines.push(`  syncStore errors (${sync.syncErrors.length}):`);
    sync.syncErrors.slice(-3).forEach((e, i) => {
      lines.push(`    ${i + 1}. [${e.type}] ${String(e.message || '').slice(0, 80)}`);
    });
  } else {
    lines.push('  syncStore errors: none');
  }

  lines.push('');
  lines.push('Related table counts:');
  lines.push(`  farms: ${farmsCount ?? 'missing'}`);
  lines.push(`  houses: ${housesCount ?? 'missing'}`);
  lines.push(`  dailyLogs: ${dailyLogsCount ?? 'missing'}`);
  lines.push(`  saleOrders: ${saleOrdersCount ?? 'missing'}`);
  lines.push(`  expenses: ${expensesCount ?? 'missing'}`);
  return lines;
}

function userLines() {
  const lines = ['User:'];
  const user = useAuthStore.getState().user;
  if (!user) {
    lines.push('  no user in store');
    return lines;
  }
  lines.push(`  _id: ${user._id}`);
  lines.push(`  role: ${user.accountRole || 'viewer'}`);
  lines.push(`  isOwner: ${yn(!user.createdBy)}`);
  lines.push(`  modules: ${(user.modules || []).join(',') || '-'}`);
  return lines;
}

function errorBufferLines() {
  const lines = [];
  const total = getErrorBufferSize();
  lines.push(`Error log (last 20 of ${total}):`);
  if (total === 0) {
    lines.push('  empty');
    return lines;
  }
  const recent = getRecentErrors(20);
  recent.forEach((e, i) => {
    const tag = e.kind === 'native_handle' ? 'NATIVE' : (e.kind || 'other').toUpperCase();
    const time = String(e.ts || '').replace('T', ' ').slice(0, 19);
    const msg = String(e.message || '').slice(0, 110);
    let line = `  ${i + 1}. [${tag}] ${time} ${e.source}: ${msg}`;
    if (e.extra) {
      const extras = Object.entries(e.extra).map(([k, v]) => `${k}=${v}`).join(' ');
      if (extras) line += ` (${extras})`;
    }
    lines.push(line);
  });
  return lines;
}

export async function runBatchesDiagnostic() {
  const lines = [];
  lines.push('=== BATCHES DIAGNOSTIC ===');

  lines.push('');
  lines.push(...platformLines());

  lines.push('');
  lines.push(...dbCacheLines());

  // Try the first inspect pass. If it fails with a native-handle
  // error we run a one-shot self-heal: resetDb() + reopen + re-inspect.
  // Both passes are reported so the user (and us via screenshots) can
  // see what was broken AND whether the heal actually helped.
  let healAttempted = false;
  let healSucceeded = false;
  let initialError = null;

  let db;
  try {
    db = await getDb();
  } catch (err) {
    initialError = err;
  }

  let bundle = null;
  if (db) {
    bundle = await collectInspect(db);
  }

  if ((initialError && isNativeHandleError(initialError)) ||
      (bundle && inspectHitNativeHandleError(bundle))) {
    healAttempted = true;
    lines.push('');
    lines.push('Self-heal: native-handle error detected, attempting resetDb()...');
    try {
      await resetDb();
      const fresh = await getDb();
      bundle = await collectInspect(fresh);
      healSucceeded = !inspectHitNativeHandleError(bundle);
      lines.push(`  result: ${healSucceeded ? 'OK (re-opened cleanly)' : 'still broken after reset'}`);
    } catch (err) {
      lines.push(`  result: reset threw: ${String(err?.message || err).slice(0, 200)}`);
    }
  } else if (initialError) {
    lines.push('');
    lines.push(`getDb() failed: ${String(initialError.message || initialError).slice(0, 200)}`);
  }

  if (bundle) {
    const suffix = healAttempted ? ' (post-heal)' : '';
    lines.push(...inspectLines(bundle, suffix));
  }

  lines.push('');
  lines.push(...userLines());

  lines.push('');
  if (bundle?.schemaIds?.length) {
    lines.push(`Migrations applied: ${bundle.schemaIds.join(',')}`);
  } else {
    lines.push('Migrations applied: none');
  }

  lines.push('');
  lines.push(...errorBufferLines());

  return lines.join('\n');
}
