import type { StorageRequest, TruckingLoad, TruckingLoadStatus } from '../types';

export type LoadAggregateState = 'NONE' | 'PENDING' | 'APPROVED' | 'IN_PROGRESS' | 'COMPLETED';

// ============================================================================
// STATE TRANSITION VALIDATION
// ============================================================================

/**
 * Valid state transitions for trucking loads
 * Prevents invalid transitions like APPROVED → NEW or COMPLETED → anything
 */
const VALID_TRANSITIONS: Record<TruckingLoadStatus, TruckingLoadStatus[]> = {
  NEW: ['APPROVED', 'REJECTED'], // Admin can approve or reject pending loads
  APPROVED: ['IN_TRANSIT'], // Once approved, truck departs (admin marks as in transit)
  IN_TRANSIT: ['COMPLETED'], // Once in transit, truck arrives (admin marks as completed)
  COMPLETED: [], // Final state - no transitions allowed
  REJECTED: [], // Final state - no transitions allowed
};

/**
 * Validates if a state transition is allowed
 * @param from - Current status
 * @param to - Desired status
 * @returns true if transition is valid, false otherwise
 */
export function isValidTransition(from: TruckingLoadStatus, to: TruckingLoadStatus): boolean {
  // Same state is always valid (no-op)
  if (from === to) return true;

  const allowedTransitions = VALID_TRANSITIONS[from] || [];
  return allowedTransitions.includes(to);
}

/**
 * Validates and returns error message if transition is invalid
 * @param from - Current status
 * @param to - Desired status
 * @returns null if valid, error message if invalid
 */
export function validateTransition(from: TruckingLoadStatus, to: TruckingLoadStatus): string | null {
  if (isValidTransition(from, to)) {
    return null;
  }

  // Generate helpful error messages
  if (from === 'COMPLETED') {
    return 'Cannot change status of a completed load';
  }
  if (from === 'REJECTED') {
    return 'Cannot change status of a rejected load';
  }
  if (from === 'APPROVED' && to === 'NEW') {
    return 'Cannot revert an approved load to pending status';
  }
  if (from === 'IN_TRANSIT' && to !== 'COMPLETED') {
    return 'Loads in transit can only be marked as completed';
  }

  return `Invalid status transition from ${from} to ${to}`;
}

export interface LoadProgressSummary {
  plannedJoints: number;
  completedJoints: number;
  remainingJoints: number;
}

const inboundStateLabels: Record<Exclude<LoadAggregateState, 'NONE'>, string> = {
  PENDING: 'Pending Trucking Approval',
  APPROVED: 'Trucking to MPS',
  IN_PROGRESS: 'Trucking to MPS',
  COMPLETED: 'Stored at MPS',
};

const outboundStateLabels: Record<Exclude<LoadAggregateState, 'NONE'>, string> = {
  PENDING: 'Pending Approval Trucking from MPS',
  APPROVED: 'Trucking from MPS',
  IN_PROGRESS: 'Trucking from MPS',
  COMPLETED: 'Complete',
};

export type StatusBadgeTone = 'pending' | 'info' | 'success' | 'danger' | 'neutral';

export interface RequestLogisticsSnapshot {
  inboundLoads: TruckingLoad[];
  outboundLoads: TruckingLoad[];
  inboundState: LoadAggregateState;
  outboundState: LoadAggregateState;
  customerStatusLabel: string;
  inboundStatusLabel: string | null;
  outboundStatusLabel: string | null;
  inboundProgress: LoadProgressSummary;
  outboundProgress: LoadProgressSummary;
}

export const aggregateLoadState = (loads: TruckingLoad[]): LoadAggregateState => {
  if (!loads.length) return 'NONE';
  if (loads.some(load => load.status === 'IN_TRANSIT')) return 'IN_PROGRESS';
  if (loads.some(load => load.status === 'APPROVED')) return 'APPROVED';
  if (loads.some(load => load.status === 'NEW')) return 'PENDING';
  if (loads.length && loads.every(load => load.status === 'COMPLETED')) return 'COMPLETED';
  return 'NONE';
};

export const getLoadStateLabel = (
  state: LoadAggregateState,
  direction: 'INBOUND' | 'OUTBOUND'
): string | null => {
  if (state === 'NONE') return null;
  return direction === 'INBOUND' ? inboundStateLabels[state] : outboundStateLabels[state];
};

export const summarizeLoadTotals = (
  loads: TruckingLoad[],
  fallbackTotal?: number | null
): LoadProgressSummary => {
  const summary = loads.reduce<LoadProgressSummary>(
    (acc, load) => {
      acc.plannedJoints += load.totalJointsPlanned ?? 0;
      acc.completedJoints += load.totalJointsCompleted ?? 0;
      return acc;
    },
    { plannedJoints: 0, completedJoints: 0, remainingJoints: 0 }
  );

  const totalTarget = summary.plannedJoints || fallbackTotal || 0;
  const remaining = Math.max(totalTarget - summary.completedJoints, 0);

  return {
    plannedJoints: totalTarget,
    completedJoints: summary.completedJoints,
    remainingJoints: remaining,
  };
};

const deriveCustomerStatusLabel = (
  request: StorageRequest,
  inboundState: LoadAggregateState,
  outboundState: LoadAggregateState,
  inboundLoads: TruckingLoad[],
  outboundLoads: TruckingLoad[]
): string => {
  if (request.status === 'REJECTED') {
    return 'Storage Request Rejected';
  }

  const newestInboundLoad =
    inboundLoads.length > 0
      ? inboundLoads.reduce((latest, load) =>
          load.sequenceNumber > latest.sequenceNumber ? load : latest
        )
      : null;

  const newestOutboundLoad =
    outboundLoads.length > 0
      ? outboundLoads.reduce((latest, load) =>
          load.sequenceNumber > latest.sequenceNumber ? load : latest
        )
      : null;

  if (newestOutboundLoad) {
    const loadNumber = newestOutboundLoad.sequenceNumber;
    switch (newestOutboundLoad.status) {
      case 'NEW':
        return `Pickup Load ${loadNumber} pending confirmation`;
      case 'APPROVED':
        return `Pickup Load ${loadNumber} scheduled`;
      case 'IN_TRANSIT':
        return `Pickup Load ${loadNumber} en route`;
      case 'COMPLETED':
        return 'Complete';
      default:
        break;
    }
  }

  if (newestInboundLoad) {
    const loadNumber = newestInboundLoad.sequenceNumber;
    switch (newestInboundLoad.status) {
      case 'NEW':
        return `Load ${loadNumber} pending confirmation`;
      case 'APPROVED':
        return `Load ${loadNumber} booked`;
      case 'IN_TRANSIT':
        return `Load ${loadNumber} en route`;
      case 'COMPLETED':
        if (outboundState === 'NONE') {
          return `Load ${loadNumber} stored on site`;
        }
        break;
      default:
        break;
    }
  }

  if (outboundState === 'PENDING') return outboundStateLabels.PENDING;
  if (outboundState === 'APPROVED' || outboundState === 'IN_PROGRESS') return outboundStateLabels.APPROVED;
  if (outboundState === 'COMPLETED') return 'Complete';

  if (inboundState === 'PENDING') return inboundStateLabels.PENDING;
  if (inboundState === 'APPROVED' || inboundState === 'IN_PROGRESS') return inboundStateLabels.APPROVED;
  if (inboundState === 'COMPLETED' && outboundState === 'NONE') return inboundStateLabels.COMPLETED;

  if (request.status === 'PENDING') return 'Pending Pipe Storage Approval';
  if (request.status === 'APPROVED') return 'Approved for Storage';
  if (request.status === 'COMPLETED') return 'Complete';
  if (request.status === 'DRAFT') return 'Draft';

  return 'Pending Pipe Storage Approval';
};

export const getStatusBadgeTone = (statusLabel: string): StatusBadgeTone => {
  if (/Rejected/i.test(statusLabel)) return 'danger';
  if (/Pending/i.test(statusLabel)) return 'pending';
  if (/Trucking/i.test(statusLabel)) return 'info';
  if (/Stored|Approved|Complete/i.test(statusLabel)) return 'success';
  return 'neutral';
};

const sortLoads = (loads: TruckingLoad[]): TruckingLoad[] =>
  [...loads].sort((a, b) => a.sequenceNumber - b.sequenceNumber);

export const getRequestLogisticsSnapshot = (request: StorageRequest): RequestLogisticsSnapshot => {
  const inboundLoads = sortLoads((request.truckingLoads ?? []).filter(load => load.direction === 'INBOUND'));
  const outboundLoads = sortLoads((request.truckingLoads ?? []).filter(load => load.direction === 'OUTBOUND'));

  const inboundState = aggregateLoadState(inboundLoads);
  const outboundState = aggregateLoadState(outboundLoads);

  const customerStatusLabel = deriveCustomerStatusLabel(
    request,
    inboundState,
    outboundState,
    inboundLoads,
    outboundLoads
  );
  const inboundStatusLabel = getLoadStateLabel(inboundState, 'INBOUND');
  const outboundStatusLabel = getLoadStateLabel(outboundState, 'OUTBOUND');

  const fallbackTotal = request.requestDetails?.totalJoints ?? null;

  return {
    inboundLoads,
    outboundLoads,
    inboundState,
    outboundState,
    customerStatusLabel,
    inboundStatusLabel,
    outboundStatusLabel,
    inboundProgress: summarizeLoadTotals(inboundLoads, fallbackTotal),
    outboundProgress: summarizeLoadTotals(outboundLoads),
  };
};
