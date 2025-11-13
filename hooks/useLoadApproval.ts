/**
 * Load Approval Hooks
 *
 * React Query mutations for admin load approval workflow.
 * Provides typed helpers for approve, reject, and request correction actions.
 *
 * Design:
 * - Declarative UI: LoadDetailModal calls approveLoad(), rejectLoad(), etc.
 * - Optimistic updates: UI updates immediately, rolls back on error
 * - Cache invalidation: Auto-refresh pending loads list, load details, company data
 * - Notifications: Slack alerts sent automatically on success
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import {
  notifyLoadApproved,
  notifyLoadRejected,
  notifyManifestCorrectionNeeded,
  notifyLoadInTransit,
  notifyLoadCompleted,
  type NotificationPayload,
  type RejectionPayload,
  type CorrectionPayload,
  type InTransitPayload,
  type CompletionPayload,
} from '../services/notificationService';
import type { TruckingLoadStatus } from '../types';

// ============================================================================
// TYPES
// ============================================================================

interface ApproveLoadVariables {
  loadId: string;
  companyId: string;
  companyName: string;
  companyDomain: string | null;
  sequenceNumber: number;
  scheduledSlotStart: string;
  scheduledSlotEnd: string;
  truckingCompany: string | null;
  driverName: string | null;
  totalJointsPlanned: number | null;
  totalLengthFtPlanned: number | null;
}

interface RejectLoadVariables extends ApproveLoadVariables {
  reason: string;
}

interface RequestCorrectionVariables {
  loadId: string;
  companyId: string;
  companyName: string;
  companyDomain: string | null;
  sequenceNumber: number;
  scheduledSlotStart: string;
  scheduledSlotEnd: string;
  truckingCompany: string | null;
  driverName: string | null;
  totalJointsPlanned: number | null;
  totalLengthFtPlanned: number | null;
  issues: string[];
}

// ============================================================================
// MUTATION: APPROVE LOAD
// ============================================================================

/**
 * Approve a pending load (NEW → APPROVED)
 * - Updates database status
 * - Sends Slack notification to customer
 * - Invalidates React Query caches
 *
 * @example
 * const { approveLoad, isLoading } = useApproveLoad();
 * approveLoad({ loadId: '...', companyId: '...', ... });
 */
export function useApproveLoad() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const mutation = useMutation({
    mutationFn: async (variables: ApproveLoadVariables) => {
      const { loadId, companyId, ...loadData } = variables;

      // Update load status in database
      const { data, error } = await supabase
        .from('trucking_loads')
        .update({ status: 'APPROVED' as TruckingLoadStatus })
        .eq('id', loadId)
        .select()
        .single();

      if (error) {
        console.error('[useApproveLoad] Database error:', error);
        throw new Error(`Failed to approve load: ${error.message}`);
      }

      if (!data) {
        throw new Error('Load approval succeeded but no data returned');
      }

      // Send notification to customer
      const notificationPayload: NotificationPayload = {
        load: {
          id: loadId,
          sequenceNumber: loadData.sequenceNumber,
          scheduledSlotStart: loadData.scheduledSlotStart,
          scheduledSlotEnd: loadData.scheduledSlotEnd,
          truckingCompany: loadData.truckingCompany,
          driverName: loadData.driverName,
          totalJointsPlanned: loadData.totalJointsPlanned,
          totalLengthFtPlanned: loadData.totalLengthFtPlanned,
        },
        company: {
          id: companyId,
          name: loadData.companyName,
          domain: loadData.companyDomain,
        },
        admin: {
          userId: user?.id || 'unknown',
          email: user?.email || null,
        },
      };

      await notifyLoadApproved(notificationPayload);

      return data;
    },
    onSuccess: (data, variables) => {
      console.log(`[useApproveLoad] Load ${variables.loadId} approved successfully`);

      // Extract storage_request_id for sequential blocking invalidation
      const storageRequestId = (data as any).storage_request_id;

      // Invalidate relevant caches
      queryClient.invalidateQueries({ queryKey: ['trucking-loads', 'pending'] });
      queryClient.invalidateQueries({ queryKey: ['trucking-loads', 'pending', 'count'] });
      queryClient.invalidateQueries({ queryKey: ['trucking-loads', 'details', variables.loadId] });
      queryClient.invalidateQueries({ queryKey: ['company-data', variables.companyId] });

      // Invalidate per-request blocking query (clears wizard blocking UI immediately)
      if (storageRequestId) {
        queryClient.invalidateQueries({ queryKey: ['trucking-loads', 'pending-for-request', storageRequestId] });
      }
    },
    onError: (error, variables) => {
      console.error(`[useApproveLoad] Failed to approve load ${variables.loadId}:`, error);
    },
  });

  return {
    approveLoad: mutation.mutate,
    approveLoadAsync: mutation.mutateAsync,
    isLoading: mutation.isPending,
    isSuccess: mutation.isSuccess,
    isError: mutation.isError,
    error: mutation.error,
  };
}

// ============================================================================
// MUTATION: REJECT LOAD
// ============================================================================

/**
 * Reject a pending load (NEW → REJECTED)
 * - Updates database status
 * - Sends Slack notification with rejection reason
 * - Invalidates React Query caches
 *
 * @example
 * const { rejectLoad, isLoading } = useRejectLoad();
 * rejectLoad({ loadId: '...', reason: 'Manifest data incomplete', ... });
 */
export function useRejectLoad() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const mutation = useMutation({
    mutationFn: async (variables: RejectLoadVariables) => {
      const { loadId, companyId, reason, ...loadData } = variables;

      // Update load status in database
      const { data, error } = await supabase
        .from('trucking_loads')
        .update({ status: 'REJECTED' as TruckingLoadStatus })
        .eq('id', loadId)
        .select()
        .single();

      if (error) {
        console.error('[useRejectLoad] Database error:', error);
        throw new Error(`Failed to reject load: ${error.message}`);
      }

      if (!data) {
        throw new Error('Load rejection succeeded but no data returned');
      }

      // Send notification to customer with reason
      const notificationPayload: RejectionPayload = {
        load: {
          id: loadId,
          sequenceNumber: loadData.sequenceNumber,
          scheduledSlotStart: loadData.scheduledSlotStart,
          scheduledSlotEnd: loadData.scheduledSlotEnd,
          truckingCompany: loadData.truckingCompany,
          driverName: loadData.driverName,
          totalJointsPlanned: loadData.totalJointsPlanned,
          totalLengthFtPlanned: loadData.totalLengthFtPlanned,
        },
        company: {
          id: companyId,
          name: loadData.companyName,
          domain: loadData.companyDomain,
        },
        admin: {
          userId: user?.id || 'unknown',
          email: user?.email || null,
        },
        reason,
      };

      await notifyLoadRejected(notificationPayload);

      return data;
    },
    onSuccess: (data, variables) => {
      console.log(`[useRejectLoad] Load ${variables.loadId} rejected successfully`);

      // Extract storage_request_id for sequential blocking invalidation
      const storageRequestId = (data as any).storage_request_id;

      // Invalidate relevant caches
      queryClient.invalidateQueries({ queryKey: ['trucking-loads', 'pending'] });
      queryClient.invalidateQueries({ queryKey: ['trucking-loads', 'pending', 'count'] });
      queryClient.invalidateQueries({ queryKey: ['trucking-loads', 'details', variables.loadId] });
      queryClient.invalidateQueries({ queryKey: ['company-data', variables.companyId] });

      // Invalidate per-request blocking query (clears wizard blocking UI immediately)
      if (storageRequestId) {
        queryClient.invalidateQueries({ queryKey: ['trucking-loads', 'pending-for-request', storageRequestId] });
      }
    },
    onError: (error, variables) => {
      console.error(`[useRejectLoad] Failed to reject load ${variables.loadId}:`, error);
    },
  });

  return {
    rejectLoad: mutation.mutate,
    rejectLoadAsync: mutation.mutateAsync,
    isLoading: mutation.isPending,
    isSuccess: mutation.isSuccess,
    isError: mutation.isError,
    error: mutation.error,
  };
}

// ============================================================================
// MUTATION: REQUEST CORRECTION
// ============================================================================

/**
 * Request manifest corrections from customer (status remains NEW)
 * - Does NOT change load status
 * - Sends Slack notification with list of issues
 * - Invalidates React Query caches
 *
 * @example
 * const { requestCorrection, isLoading } = useRequestCorrection();
 * requestCorrection({
 *   loadId: '...',
 *   issues: ['Missing heat numbers', 'Duplicate serial numbers'],
 *   ...
 * });
 */
export function useRequestCorrection() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const mutation = useMutation({
    mutationFn: async (variables: RequestCorrectionVariables) => {
      const { loadId, companyId, issues, ...loadData } = variables;

      // Send notification to customer with issues list
      const notificationPayload: CorrectionPayload = {
        load: {
          id: loadId,
          sequenceNumber: loadData.sequenceNumber,
          scheduledSlotStart: loadData.scheduledSlotStart,
          scheduledSlotEnd: loadData.scheduledSlotEnd,
          truckingCompany: loadData.truckingCompany,
          driverName: loadData.driverName,
          totalJointsPlanned: loadData.totalJointsPlanned,
          totalLengthFtPlanned: loadData.totalLengthFtPlanned,
        },
        company: {
          id: companyId,
          name: loadData.companyName,
          domain: loadData.companyDomain,
        },
        admin: {
          userId: user?.id || 'unknown',
          email: user?.email || null,
        },
        issues,
      };

      await notifyManifestCorrectionNeeded(notificationPayload);

      // Return success (no database changes needed - status remains NEW)
      return { success: true, loadId, issues };
    },
    onSuccess: (data, variables) => {
      console.log(`[useRequestCorrection] Correction request sent for load ${variables.loadId}`);

      // Invalidate load details cache (to show any UI indicators)
      queryClient.invalidateQueries({ queryKey: ['trucking-loads', 'details', variables.loadId] });
    },
    onError: (error, variables) => {
      console.error(`[useRequestCorrection] Failed to send correction request for load ${variables.loadId}:`, error);
    },
  });

  return {
    requestCorrection: mutation.mutate,
    requestCorrectionAsync: mutation.mutateAsync,
    isLoading: mutation.isPending,
    isSuccess: mutation.isSuccess,
    isError: mutation.isError,
    error: mutation.error,
  };
}

// ============================================================================
// MUTATION: MARK LOAD IN TRANSIT
// ============================================================================

/**
 * Mark approved load as in transit (APPROVED → IN_TRANSIT)
 * - Updates database status
 * - Sends Slack notification to customer
 * - Invalidates React Query caches
 *
 * @example
 * const { markLoadInTransit, isLoading } = useMarkLoadInTransit();
 * markLoadInTransit({ loadId: '...', companyId: '...', companyName: '...', ... });
 */

interface MarkInTransitVariables {
  loadId: string;
  companyId: string;
  companyName: string;
  companyDomain: string | null;
  sequenceNumber: number;
  scheduledSlotEnd: string;
  driverName: string | null;
  driverPhone: string | null;
  totalJointsPlanned: number | null;
}

export function useMarkLoadInTransit() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (variables: MarkInTransitVariables) => {
      const { loadId, companyId, ...loadData } = variables;

      // Update load status in database
      const { data, error } = await supabase
        .from('trucking_loads')
        .update({
          status: 'IN_TRANSIT' as TruckingLoadStatus,
          // in_transit_at will be set by database default or trigger
        })
        .eq('id', loadId)
        .select()
        .single();

      if (error) {
        console.error('[useMarkLoadInTransit] Database error:', error);
        throw new Error(`Failed to mark load in transit: ${error.message}`);
      }

      if (!data) {
        throw new Error('Load update succeeded but no data returned');
      }

      // Send notification to customer
      const notificationPayload: InTransitPayload = {
        load: {
          id: loadId,
          sequenceNumber: loadData.sequenceNumber,
          scheduledSlotEnd: loadData.scheduledSlotEnd,
          driverName: loadData.driverName,
          driverPhone: loadData.driverPhone,
          totalJointsPlanned: loadData.totalJointsPlanned,
        },
        company: {
          id: companyId,
          name: loadData.companyName,
          domain: loadData.companyDomain,
        },
      };

      await notifyLoadInTransit(notificationPayload);

      return data;
    },
    onSuccess: (data, variables) => {
      console.log(`[useMarkLoadInTransit] Load ${variables.loadId} marked in transit successfully`);

      // Extract storage_request_id for sequential blocking invalidation
      const storageRequestId = (data as any).storage_request_id;

      // Invalidate relevant caches
      queryClient.invalidateQueries({ queryKey: ['trucking-loads', 'approved'] });
      queryClient.invalidateQueries({ queryKey: ['trucking-loads', 'in-transit'] });
      queryClient.invalidateQueries({ queryKey: ['trucking-loads', 'details', variables.loadId] });
      queryClient.invalidateQueries({ queryKey: ['company-data', variables.companyId] });

      // Invalidate per-request blocking query
      if (storageRequestId) {
        queryClient.invalidateQueries({ queryKey: ['trucking-loads', 'pending-for-request', storageRequestId] });
      }
    },
    onError: (error, variables) => {
      console.error(`[useMarkLoadInTransit] Failed to mark load ${variables.loadId} in transit:`, error);
    },
  });

  return {
    markLoadInTransit: mutation.mutate,
    markLoadInTransitAsync: mutation.mutateAsync,
    isLoading: mutation.isPending,
    isSuccess: mutation.isSuccess,
    isError: mutation.isError,
    error: mutation.error,
  };
}

// ============================================================================
// MUTATION: MARK LOAD COMPLETED
// ============================================================================

/**
 * Mark in-transit load as completed (IN_TRANSIT → COMPLETED)
 * - Updates database status and completed_at timestamp
 * - Updates total_joints_completed (actual received quantity)
 * - Creates inventory records from manifest data (bulk insert)
 * - Updates rack occupancy atomically
 * - Sends Slack notification to customer
 * - Invalidates React Query caches
 *
 * @example
 * const { markLoadCompleted, isLoading } = useMarkLoadCompleted();
 * markLoadCompleted({
 *   loadId: '...',
 *   rackId: 'A-A1-01',
 *   actualJointsReceived: 95,
 *   notes: 'Delivery completed successfully',
 *   ...
 * });
 */

interface MarkCompletedVariables {
  loadId: string;
  companyId: string;
  companyName: string;
  companyDomain: string | null;
  sequenceNumber: number;
  rackId: string;
  actualJointsReceived: number;
  notes: string;
  requestId: string;
}

export function useMarkLoadCompleted() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const mutation = useMutation({
    mutationFn: async (variables: MarkCompletedVariables) => {
      const {
        loadId,
        companyId,
        requestId,
        rackId,
        actualJointsReceived,
        notes,
        ...notificationData
      } = variables;

      if (!user) {
        throw new Error('User must be authenticated to complete a load.');
      }

      // Step 1-4: Call the transactional database function
      // This atomically updates load status, creates inventory, and updates rack occupancy
      const { data: rpcResult, error: rpcError } = await supabase.rpc(
        'mark_load_completed_and_create_inventory',
        {
          load_id_param: loadId,
          company_id_param: companyId,
          request_id_param: requestId,
          rack_id_param: rackId,
          actual_joints_param: actualJointsReceived,
          completion_notes_param: notes || null,
        }
      );

      if (rpcError) {
        console.error('[useMarkLoadCompleted] RPC error:', rpcError);
        throw new Error(`Failed to execute completion transaction: ${rpcError.message}`);
      }

      console.log('[useMarkLoadCompleted] Transaction successful:', rpcResult);

      // Fetch storage_request_id for cache invalidation
      const { data: loadData } = await supabase
        .from('trucking_loads')
        .select('storage_request_id')
        .eq('id', loadId)
        .single();

      // Step 5 & 6: Handle notifications after the transaction is successful
      try {
        const { count: totalOnSite } = await supabase
          .from('inventory')
          .select('*', { count: 'exact', head: true })
          .eq('company_id', companyId)
          .eq('status', 'IN_STORAGE');

        const { data: rackData } = await supabase
          .from('racks')
          .select('capacity, occupied')
          .eq('id', rackId)
          .single();

        const availableCapacity = rackData
          ? rackData.capacity - rackData.occupied
          : 0;

        const notificationPayload: CompletionPayload = {
          load: {
            id: loadId,
            sequenceNumber: notificationData.sequenceNumber,
            completedAt: new Date().toISOString(),
            actualJointsReceived,
            rackLocation: rackId,
          },
          company: {
            id: companyId,
            name: notificationData.companyName,
            domain: notificationData.companyDomain,
          },
          inventory: {
            totalOnSite: totalOnSite || 0,
            availableCapacity,
          },
        };

        await notifyLoadCompleted(notificationPayload);
      } catch (notificationError) {
        // Log the error, but don't throw. The primary operation was successful.
        console.error('[useMarkLoadCompleted] Failed to send notification:', notificationError);
      }

      return loadData; // Return load data for onSuccess to use
    },
    onSuccess: (data, variables) => {
      console.log(`[useMarkLoadCompleted] Load ${variables.loadId} marked completed successfully`);

      const storageRequestId = data?.storage_request_id;

      // Invalidate relevant caches
      queryClient.invalidateQueries({ queryKey: ['trucking-loads', 'in-transit'] });
      queryClient.invalidateQueries({ queryKey: ['trucking-loads', 'completed'] });
      queryClient.invalidateQueries({ queryKey: ['trucking-loads', 'details', variables.loadId] });
      queryClient.invalidateQueries({ queryKey: ['company-data', variables.companyId] });
      queryClient.invalidateQueries({ queryKey: ['companies', variables.companyId, 'inventory'] });
      queryClient.invalidateQueries({ queryKey: ['storage_racks'] }); // Invalidate racks to show new occupancy

      // Invalidate per-request blocking query (allows next load to be booked)
      if (storageRequestId) {
        queryClient.invalidateQueries({
          queryKey: ['trucking-loads', 'pending-for-request', storageRequestId],
        });
      }
    },
    onError: (error, variables) => {
      console.error(`[useMarkLoadCompleted] Failed to mark load ${variables.loadId} completed:`, error);
    },
  });

  return {
    markLoadCompleted: mutation.mutate,
    markLoadCompletedAsync: mutation.mutateAsync,
    isLoading: mutation.isPending,
    isSuccess: mutation.isSuccess,
    isError: mutation.isError,
    error: mutation.error,
  };
}
