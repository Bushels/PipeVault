/**
 * Workflow State Calculator (Immutable)
 *
 * Addresses critical review finding #3:
 * - Uses immutable operations (no in-place sorting)
 * - Aligns with customer-facing workflow states
 * - Returns all documented states including "All Loads Received"
 * - Fixes logic for "Pending Pickup Request"
 */

import type {
  ProjectSummary,
  ProjectLoad,
  WorkflowStateResult,
  WorkflowState,
  WorkflowBadgeTone,
} from '../types/projectSummaries';

/**
 * Calculate workflow state WITHOUT mutating input data
 * Creates defensive copies before sorting
 *
 * State machine transitions:
 * 1. Pending Approval → 2. Waiting on Load #1 → 3. Waiting on Load #2... →
 * 4. All Loads Received → 5. In Storage → 6. Pickup Requested →
 * 7. Waiting on Pickup #1 → 8. Complete
 */
export function calculateWorkflowState(project: ProjectSummary): WorkflowStateResult {
  const { status, inboundLoads, outboundLoads, inventorySummary } = project;

  // ✅ FIX: Defensive copy before sorting (prevents mutation)
  const sortedInbound = [...inboundLoads].sort((a, b) => a.sequenceNumber - b.sequenceNumber);
  const sortedOutbound = [...outboundLoads].sort((a, b) => a.sequenceNumber - b.sequenceNumber);

  // ============================================================================
  // STATE 1: Pending Approval
  // ============================================================================
  if (status === 'PENDING') {
    return {
      state: 'Pending Approval',
      label: 'Pending Admin Approval',
      badgeTone: 'pending',
      nextAction: 'Admin must approve or reject this request',
    };
  }

  // ============================================================================
  // STATE 2: Rejected
  // ============================================================================
  if (status === 'REJECTED') {
    return {
      state: 'Complete',
      label: 'Rejected',
      badgeTone: 'danger',
      nextAction: null,
    };
  }

  // ============================================================================
  // STATE 3: Approved but no loads scheduled yet
  // ============================================================================
  if (status === 'APPROVED' && sortedInbound.length === 0) {
    return {
      state: 'Waiting on Load #N to MPS',
      label: 'Waiting on Load #1 to MPS',
      badgeTone: 'info',
      nextAction: 'Customer must schedule first delivery',
    };
  }

  // ============================================================================
  // STATE 4: Waiting on specific inbound load to arrive
  // ============================================================================
  const nextPendingInbound = sortedInbound.find(
    load => load.status === 'PENDING' || load.status === 'SCHEDULED'
  );

  if (nextPendingInbound) {
    const loadNumber = nextPendingInbound.sequenceNumber;
    const scheduledDate = nextPendingInbound.scheduledSlotStart
      ? new Date(nextPendingInbound.scheduledSlotStart).toLocaleDateString()
      : 'TBD';

    return {
      state: 'Waiting on Load #N to MPS',
      label: `Waiting on Load #${loadNumber} to MPS`,
      badgeTone: 'info',
      nextAction: `Load #${loadNumber} scheduled for ${scheduledDate}`,
    };
  }

  // ============================================================================
  // STATE 5: All loads arrived, processing manifests (NEW STATE)
  // ============================================================================
  // ✅ FIX: This state was missing in original logic
  const allInboundArrived = sortedInbound.length > 0 && sortedInbound.every(
    load => load.status === 'COMPLETED' || load.status === 'ARRIVED'
  );

  const allManifestsProcessed = sortedInbound.every(
    load => load.documents.some(doc => doc.parsedPayload)
  );

  if (allInboundArrived && !allManifestsProcessed) {
    return {
      state: 'All Loads Received',
      label: 'Processing Manifests',
      badgeTone: 'info',
      nextAction: 'Admin must upload and process manifest documents',
    };
  }

  // ============================================================================
  // STATE 6: In Storage (all loads complete, inventory assigned to racks)
  // ============================================================================
  const hasInventory = inventorySummary.totalJoints > 0;
  const noOutboundRequests = sortedOutbound.length === 0;

  if (allInboundArrived && hasInventory && noOutboundRequests) {
    return {
      state: 'In Storage',
      label: 'In Storage',
      badgeTone: 'success',
      nextAction: 'Inventory stored. Awaiting customer pickup request.',
    };
  }

  // ============================================================================
  // STATE 7: Pickup Requested (customer created outbound load)
  // ============================================================================
  // ✅ FIX: Correct logic - this state occurs when outbound loads EXIST
  // (original bug: only returned this when outbound loads were pending/scheduled)
  if (sortedOutbound.length > 0) {
    const nextPendingOutbound = sortedOutbound.find(
      load => load.status === 'PENDING' || load.status === 'SCHEDULED'
    );

    if (nextPendingOutbound) {
      const loadNumber = nextPendingOutbound.sequenceNumber;
      const scheduledDate = nextPendingOutbound.scheduledSlotStart
        ? new Date(nextPendingOutbound.scheduledSlotStart).toLocaleDateString()
        : 'TBD';

      return {
        state: 'Waiting on Load #N Pickup',
        label: `Waiting on Load #${loadNumber} Pickup`,
        badgeTone: 'info',
        nextAction: `Pickup scheduled for ${scheduledDate}`,
      };
    }

    // All outbound loads in progress or completed
    const allOutboundComplete = sortedOutbound.every(load => load.status === 'COMPLETED');

    if (allOutboundComplete && inventorySummary.totalJoints === 0) {
      // ============================================================================
      // STATE 8: Complete (all pipe returned to customer)
      // ============================================================================
      return {
        state: 'Complete',
        label: 'All Pipe Returned',
        badgeTone: 'success',
        nextAction: null,
      };
    }

    // Some outbound loads in progress
    return {
      state: 'Pickup Requested',
      label: 'Pickup in Progress',
      badgeTone: 'info',
      nextAction: 'Outbound loads being prepared for pickup',
    };
  }

  // ============================================================================
  // FALLBACK: Should not reach here in normal workflow
  // ============================================================================
  console.warn('Unexpected workflow state for project:', project.referenceId, {
    status,
    inboundCount: sortedInbound.length,
    outboundCount: sortedOutbound.length,
    inventoryJoints: inventorySummary.totalJoints,
  });

  return {
    state: 'In Storage',
    label: 'In Storage',
    badgeTone: 'neutral',
    nextAction: null,
  };
}

/**
 * Get badge color class based on workflow tone
 * Consistent with admin theme (cyan/yellow/green/red)
 */
export function getWorkflowBadgeClass(tone: WorkflowBadgeTone): string {
  const badgeClasses: Record<WorkflowBadgeTone, string> = {
    pending: 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30',
    info: 'bg-blue-500/20 text-blue-300 border border-blue-500/30',
    success: 'bg-green-500/20 text-green-300 border border-green-500/30',
    danger: 'bg-red-500/20 text-red-300 border border-red-500/30',
    neutral: 'bg-gray-500/20 text-gray-300 border border-gray-500/30',
  };

  return badgeClasses[tone];
}

/**
 * Get progress percentage for project (0-100)
 * Used for progress bars in UI
 */
export function calculateProjectProgress(project: ProjectSummary): number {
  const { status, inboundLoads, outboundLoads, inventorySummary } = project;

  // Rejected = 0%
  if (status === 'REJECTED') return 0;

  // Pending = 10%
  if (status === 'PENDING') return 10;

  // Approved but no loads = 20%
  if (inboundLoads.length === 0) return 20;

  // Calculate inbound progress (20% -> 60%)
  const totalInbound = inboundLoads.length;
  const completedInbound = inboundLoads.filter(
    load => load.status === 'COMPLETED' || load.status === 'ARRIVED'
  ).length;
  const inboundProgress = 20 + (completedInbound / totalInbound) * 40;

  // If no inventory yet, return inbound progress
  if (inventorySummary.totalJoints === 0) return Math.round(inboundProgress);

  // In storage = 70%
  if (outboundLoads.length === 0) return 70;

  // Calculate outbound progress (70% -> 100%)
  const totalOutbound = outboundLoads.length;
  const completedOutbound = outboundLoads.filter(load => load.status === 'COMPLETED').length;
  const outboundProgress = 70 + (completedOutbound / totalOutbound) * 30;

  return Math.round(outboundProgress);
}

/**
 * Check if project requires admin action
 * Used to highlight projects in admin dashboard
 */
export function requiresAdminAction(project: ProjectSummary): boolean {
  // Pending approval
  if (project.status === 'PENDING') return true;

  // All loads arrived but manifests not processed
  const allInboundArrived = project.inboundLoads.length > 0 && project.inboundLoads.every(
    load => load.status === 'COMPLETED' || load.status === 'ARRIVED'
  );
  const allManifestsProcessed = project.inboundLoads.every(
    load => load.documents.some(doc => doc.parsedPayload)
  );

  if (allInboundArrived && !allManifestsProcessed) return true;

  return false;
}

/**
 * Get next milestone for project
 * Used to show "what's next" in UI
 */
export function getNextMilestone(project: ProjectSummary): string | null {
  const workflowState = calculateWorkflowState(project);
  return workflowState.nextAction;
}
