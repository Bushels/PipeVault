/**
 * Approval Workflow Hook
 *
 * Provides atomic approval and rejection operations for storage requests.
 * Uses SECURITY DEFINER stored procedures for ACID transaction guarantees.
 *
 * Addresses critical review finding #4:
 * - Uses atomic PostgreSQL stored procedures (all-or-nothing)
 * - No client-side try/catch with partial state
 * - Capacity validation happens server-side BEFORE updates
 * - Automatic rollback on any error
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type {
  ApprovalRequest,
  RejectionRequest,
  ApprovalResult,
} from '../types/projectSummaries';

/**
 * Approve a storage request with atomic transaction guarantees
 *
 * This calls the `approve_storage_request_atomic()` PostgreSQL function which:
 * 1. Validates request is PENDING
 * 2. Validates rack capacity BEFORE any updates
 * 3. Updates request status to APPROVED
 * 4. Updates rack occupancy counts
 * 5. Creates audit log entry
 * 6. Queues notification email
 *
 * If ANY step fails, entire operation rolls back (ACID compliance)
 */
export function useApproveRequest() {
  const queryClient = useQueryClient();

  return useMutation<ApprovalResult, Error, ApprovalRequest>({
    mutationFn: async (request: ApprovalRequest) => {
      const { data, error } = await supabase.rpc('approve_storage_request_atomic', {
        p_request_id: request.requestId,
        p_assigned_rack_ids: request.assignedRackIds,
        p_required_joints: request.requiredJoints,
        p_notes: request.notes || null,
      });

      if (error) {
        // Handle specific error types
        if (error.message?.includes('Access denied')) {
          throw new Error('Admin privileges required to approve requests.');
        }
        if (error.message?.includes('not in PENDING status')) {
          throw new Error('Request has already been approved or rejected.');
        }
        if (error.message?.includes('Insufficient capacity')) {
          throw new Error(`Rack capacity exceeded: ${error.message}`);
        }
        if (error.message?.includes('not found')) {
          throw new Error('Storage request not found.');
        }

        throw new Error(`Approval failed: ${error.message}`);
      }

      // Type guard: ensure data matches expected structure
      if (!data || typeof data !== 'object' || !('success' in data)) {
        throw new Error('Invalid response from approval function');
      }

      return data as ApprovalResult;
    },

    onSuccess: (result, request) => {
      // Invalidate project summaries to refetch fresh data
      queryClient.invalidateQueries({ queryKey: ['projectSummaries'] });

      // Invalidate company summaries for admin tile updates
      queryClient.invalidateQueries({ queryKey: ['companies', 'summaries'] });

      // Invalidate storage requests cache
      queryClient.invalidateQueries({ queryKey: ['requests'] });

      // Invalidate specific company data for faster update
      if (result.companyId) {
        queryClient.invalidateQueries({
          queryKey: ['projectSummaries', 'company', result.companyId],
        });
        queryClient.invalidateQueries({
          queryKey: ['companies', 'details', result.companyId],
        });
      }

      console.log(`✅ Request ${result.requestId} approved successfully`, {
        assignedRacks: result.assignedRacks,
        notificationQueued: result.notificationQueued,
      });
    },

    onError: (error, request) => {
      console.error(`❌ Failed to approve request ${request.requestId}:`, error.message);
    },
  });
}

/**
 * Reject a storage request with atomic transaction guarantees
 *
 * This calls the `reject_storage_request_atomic()` PostgreSQL function which:
 * 1. Validates request is PENDING
 * 2. Updates request status to REJECTED
 * 3. Records rejection reason
 * 4. Creates audit log entry
 * 5. Queues notification email
 *
 * If ANY step fails, entire operation rolls back (ACID compliance)
 */
export function useRejectRequest() {
  const queryClient = useQueryClient();

  return useMutation<ApprovalResult, Error, RejectionRequest>({
    mutationFn: async (request: RejectionRequest) => {
      const { data, error } = await supabase.rpc('reject_storage_request_atomic', {
        p_request_id: request.requestId,
        p_rejection_reason: request.rejectionReason,
        p_notes: request.notes || null,
      });

      if (error) {
        // Handle specific error types
        if (error.message?.includes('Access denied')) {
          throw new Error('Admin privileges required to reject requests.');
        }
        if (error.message?.includes('not in PENDING status')) {
          throw new Error('Request has already been approved or rejected.');
        }
        if (error.message?.includes('not found')) {
          throw new Error('Storage request not found.');
        }

        throw new Error(`Rejection failed: ${error.message}`);
      }

      // Type guard: ensure data matches expected structure
      if (!data || typeof data !== 'object' || !('success' in data)) {
        throw new Error('Invalid response from rejection function');
      }

      return data as ApprovalResult;
    },

    onSuccess: (result, request) => {
      // Invalidate project summaries to refetch fresh data
      queryClient.invalidateQueries({ queryKey: ['projectSummaries'] });

      // Invalidate company summaries for admin tile updates
      queryClient.invalidateQueries({ queryKey: ['companies', 'summaries'] });

      // Invalidate storage requests cache
      queryClient.invalidateQueries({ queryKey: ['requests'] });

      // Invalidate specific company data for faster update
      if (result.companyId) {
        queryClient.invalidateQueries({
          queryKey: ['projectSummaries', 'company', result.companyId],
        });
        queryClient.invalidateQueries({
          queryKey: ['companies', 'details', result.companyId],
        });
      }

      console.log(`✅ Request ${result.requestId} rejected successfully`, {
        reason: request.rejectionReason,
        notificationQueued: result.notificationQueued,
      });
    },

    onError: (error, request) => {
      console.error(`❌ Failed to reject request ${request.requestId}:`, error.message);
    },
  });
}

/**
 * Example usage in a component:
 *
 * ```typescript
 * function ApprovalPanel({ request }: { request: ProjectSummary }) {
 *   const approveRequest = useApproveRequest();
 *   const rejectRequest = useRejectRequest();
 *
 *   const handleApprove = async () => {
 *     try {
 *       const result = await approveRequest.mutateAsync({
 *         requestId: request.id,
 *         assignedRackIds: selectedRackIds,
 *         requiredJoints: request.pipeDetails.totalJointsEstimate,
 *         notes: 'Approved by admin',
 *       });
 *
 *       toast.success(`Request approved! Reference: ${result.requestId}`);
 *     } catch (error) {
 *       toast.error(error.message);
 *     }
 *   };
 *
 *   const handleReject = async () => {
 *     try {
 *       const result = await rejectRequest.mutateAsync({
 *         requestId: request.id,
 *         rejectionReason: 'Insufficient capacity for requested storage duration',
 *         notes: 'Please contact us to discuss alternatives',
 *       });
 *
 *       toast.success('Request rejected. Customer has been notified.');
 *     } catch (error) {
 *       toast.error(error.message);
 *     }
 *   };
 *
 *   return (
 *     <div>
 *       <button
 *         onClick={handleApprove}
 *         disabled={approveRequest.isPending}
 *       >
 *         {approveRequest.isPending ? 'Approving...' : 'Approve'}
 *       </button>
 *       <button
 *         onClick={handleReject}
 *         disabled={rejectRequest.isPending}
 *       >
 *         {rejectRequest.isPending ? 'Rejecting...' : 'Reject'}
 *       </button>
 *
 *       {approveRequest.isError && (
 *         <p className="text-red-500">{approveRequest.error.message}</p>
 *       )}
 *       {rejectRequest.isError && (
 *         <p className="text-red-500">{rejectRequest.error.message}</p>
 *       )}
 *     </div>
 *   );
 * }
 * ```
 */
