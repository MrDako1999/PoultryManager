// Status state machine for processingJob. Status is data-driven —
// transitions are computed from data presence + a couple of explicit
// flips. The derived status is denormalised onto job.status for fast
// list rendering, but `deriveJobStatus` should be re-run on every save
// so the cache cannot drift from reality.
//
// Transitions (mirrors plan §2):
//
//   NEW                -> UNLOADING        any truckEntry sortation row saved
//   UNLOADING          -> READY            all trucks marked unloaded
//   READY|UNLOADING    -> PACKING          first production row added
//   PACKING            -> PACKED           operator taps Mark Packing Complete
//   PACKED             -> AWAITING_APPROVAL operator taps Close Job
//   AWAITING_APPROVAL  -> COMPLETE         variance==0 OR supervisor approves
//   AWAITING_APPROVAL  -> PACKING          operator reopens to add more boxes
//   COMPLETE           -> [terminal]
//
// Manual flips set explicit fields on the job document:
//   packingCompletedAt / packingCompletedBy   -> PACKED
//   varianceApproval{...}                     -> COMPLETE
//   closedAt / closedBy                       -> COMPLETE
//   reopenedAt                                -> falls back to PACKING
//
// Auto flips read child rows from useLocalQuery and pass them in.

import {
  CircleDashed,
  Clock,
  CircleDot,
  Boxes,
  CheckCircle2,
  AlertTriangle,
  CheckCheck,
} from 'lucide-react';

export const JOB_STATUSES = [
  'NEW',
  'UNLOADING',
  'READY',
  'PACKING',
  'PACKED',
  'AWAITING_APPROVAL',
  'COMPLETE',
];

// Status pin / chip configuration. Same shape as the broiler
// STATUS_CONFIG so consumers can reuse the existing rendering recipe.
// Tones come straight from the lucide palette + the slaughterhouse
// brand red so chips read at high contrast on every surface.
export const STATUS_CONFIG = {
  NEW: {
    icon: CircleDashed,
    iconColor: 'hsl(150, 10%, 45%)',
    pinBgLight: 'hsl(150, 10%, 88%)',
    pinBgDark: 'hsl(150, 12%, 32%)',
  },
  UNLOADING: {
    icon: Clock,
    iconColor: '#d97706',
    pinBgLight: '#fef3c7',
    pinBgDark: '#3a2a0d',
  },
  READY: {
    icon: CircleDot,
    iconColor: '#0284c7',
    pinBgLight: '#dbeafe',
    pinBgDark: '#0e2236',
  },
  PACKING: {
    icon: Boxes,
    iconColor: '#7c3aed',
    pinBgLight: '#ede9fe',
    pinBgDark: '#241a3d',
  },
  PACKED: {
    icon: CheckCircle2,
    iconColor: '#0d9488',
    pinBgLight: '#ccfbf1',
    pinBgDark: '#0a2e2a',
  },
  AWAITING_APPROVAL: {
    icon: AlertTriangle,
    iconColor: '#dc2626',
    pinBgLight: '#fee2e2',
    pinBgDark: '#3a1010',
  },
  COMPLETE: {
    icon: CheckCheck,
    iconColor: '#059669',
    pinBgLight: '#d1fae5',
    pinBgDark: '#0e2e21',
  },
};

export function getStatusConfig(status) {
  return STATUS_CONFIG[status] || STATUS_CONFIG.NEW;
}

// Derive the current status from the job + its child rows. The caller
// passes pre-filtered child arrays (already scoped to the job). Order
// of checks matters: terminal/manual flips win over data-driven ones.
export function deriveJobStatus({
  job,
  truckEntries = [],
  productionBoxes = [],
  productionPortions = [],
  productionGiblets = [],
} = {}) {
  if (!job) return 'NEW';

  // Terminal / manual states win unless the job has been explicitly
  // reopened after that state. `reopenedAt` is the escape hatch the
  // ApproveAndCloseSheet sets when the operator wants to add more
  // boxes after closing.
  const closedAt = job.closedAt ? new Date(job.closedAt).getTime() : null;
  const reopenedAt = job.reopenedAt ? new Date(job.reopenedAt).getTime() : null;
  const closedTakesPriority = closedAt && (!reopenedAt || reopenedAt <= closedAt);
  if (closedTakesPriority && job.varianceApproval?.approvedAt) return 'COMPLETE';
  if (closedTakesPriority) return 'AWAITING_APPROVAL';

  const packingCompletedAt = job.packingCompletedAt
    ? new Date(job.packingCompletedAt).getTime()
    : null;
  const packingTakesPriority = packingCompletedAt
    && (!reopenedAt || reopenedAt <= packingCompletedAt);
  if (packingTakesPriority) return 'PACKED';

  // Data-driven flips. Production presence beats unload status because
  // packing implies the line is producing, regardless of whether the
  // gate clerk remembered to flip every truck to "Ready for line".
  const liveBoxes = productionBoxes.some((b) => !b.deletedAt);
  const livePortions = productionPortions.some((p) => !p.deletedAt);
  const liveGiblets = productionGiblets.some((g) => !g.deletedAt);
  if (liveBoxes || livePortions || liveGiblets) return 'PACKING';

  const liveTrucks = truckEntries.filter((tr) => !tr.deletedAt);
  if (liveTrucks.length === 0) return 'NEW';

  const anySortation = liveTrucks.some((tr) => {
    const s = tr.sortation || {};
    return (
      (Number(s.doa) || 0) > 0
      || (Number(s.condemnation) || 0) > 0
      || (Number(s.bGrade) || 0) > 0
      || (Number(s.shortage) || 0) > 0
    );
  });
  const allUnloaded = liveTrucks.length > 0
    && liveTrucks.every((tr) => tr.status === 'READY' || !!tr.unloadingCompletedAt);

  if (allUnloaded) return 'READY';
  if (anySortation) return 'UNLOADING';

  return 'NEW';
}

// Convenience: returns true when the operator may move the job back
// into PACKING from a terminal state. Used by the ApproveAndCloseSheet
// "Reopen for Packing" button.
export function canReopen(status) {
  return status === 'PACKED' || status === 'AWAITING_APPROVAL' || status === 'COMPLETE';
}

// Convenience: returns true when the close-job button should be shown.
// Mark Packing Complete is the gate; a job can only close once packing
// is sealed off.
export function canCloseJob(status) {
  return status === 'PACKED';
}

// Convenience: returns true when the Mark Packing Complete button
// should be shown.
export function canMarkPackingComplete(status) {
  return status === 'PACKING';
}
