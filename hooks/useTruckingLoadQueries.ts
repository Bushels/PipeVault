/**
 * Pending Loads Hooks
 *
 * Data layer for admin load verification workflow.
 * Provides lightweight queries for pending loads list and detailed load views.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { TruckingLoad, StorageRequest, Company, TruckingDocument } from '../types';

// ============================================================================
// TYPES
// ============================================================================

export interface PendingLoadSummary {
  loadId: string;
  sequenceNumber: number;
  companyId: string;
  companyName: string;
  requestReferenceId: string;
  requestId: string;
  scheduledSlotStart: string;
  scheduledSlotEnd: string;
  isAfterHours: boolean;
  truckingCompany: string | null;
  driverName: string | null;
  totalJointsPlanned: number | null;
  totalLengthFtPlanned: number | null;
  totalWeightLbsPlanned: number | null;
  documentCount: number;
  createdAt: string;
}

export interface LoadDetails {
  load: TruckingLoad;
  storageRequest: StorageRequest;
  company: Company;
  documents: TruckingDocument[];
  parsedManifestItems: any[];
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Check if a time slot is after regular business hours
 * Regular hours: 7 AM - 5 PM weekdays
 * After-hours: Weekends, before 7 AM, after 5 PM
 */
export function isAfterHoursSlot(slotStart: string): boolean {
  const date = new Date(slotStart);
  const hour = date.getHours();
  const dayOfWeek = date.getDay();

  // Weekend (0 = Sunday, 6 = Saturday)
  if (dayOfWeek === 0 || dayOfWeek === 6) return true;

  // Before 7 AM or after 5 PM
  if (hour < 7 || hour >= 17) return true;

  return false;
}

/**
 * Calculate after-hours surcharge
 */
export function calculateSurcharge(isAfterHours: boolean): number {
  return isAfterHours ? 450 : 0;
}

// ============================================================================
// HOOKS
// ============================================================================

/**
 * Get lightweight list of pending loads (status = NEW)
 * Used for admin pending loads tile
 */
export function usePendingLoads() {
  return useQuery<PendingLoadSummary[]>({
    queryKey: ['trucking-loads', 'pending'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('trucking_loads')
        .select(`
          id,
          sequence_number,
          status,
          scheduled_slot_start,
          scheduled_slot_end,
          trucking_company,
          driver_name,
          total_joints_planned,
          total_length_ft_planned,
          total_weight_lbs_planned,
          created_at,
          storage_request:storage_requests!inner(
            id,
            reference_id,
            company_id,
            company:companies!inner(id, name, domain)
          ),
          documents:trucking_documents!trucking_documents_load_fkey(id, file_name)
        `)
        .eq('direction', 'INBOUND')
        .eq('status', 'NEW')
        .order('scheduled_slot_start', { ascending: true });

      if (error) {
        console.error('[usePendingLoads] Query error:', error);
        throw error;
      }

      // Transform to summary format
      return (data || []).map((load: any) => ({
        loadId: load.id,
        sequenceNumber: load.sequence_number,
        companyId: load.storage_request.company_id,
        companyName: load.storage_request.company.name,
        requestReferenceId: load.storage_request.reference_id,
        requestId: load.storage_request.id,
        scheduledSlotStart: load.scheduled_slot_start,
        scheduledSlotEnd: load.scheduled_slot_end,
        isAfterHours: isAfterHoursSlot(load.scheduled_slot_start),
        truckingCompany: load.trucking_company,
        driverName: load.driver_name,
        totalJointsPlanned: load.total_joints_planned,
        totalLengthFtPlanned: load.total_length_ft_planned,
        totalWeightLbsPlanned: load.total_weight_lbs_planned,
        documentCount: load.documents?.length || 0,
        createdAt: load.created_at,
      }));
    },
    staleTime: 30 * 1000, // 30 seconds
    refetchOnWindowFocus: true,
    refetchInterval: 60 * 1000, // Auto-refresh every minute
  });
}

/**
 * Get full details for a specific load
 * Includes AI parsed manifest data and documents
 */
export function useLoadDetails(loadId?: string) {
  return useQuery<LoadDetails | null>({
    queryKey: loadId ? ['trucking-loads', 'details', loadId] : ['trucking-loads', 'details', 'null'],
    enabled: !!loadId,
    queryFn: async () => {
      if (!loadId) return null;

      const { data, error } = await supabase
        .from('trucking_loads')
        .select(`
          *,
          storage_request:storage_requests!inner(
            *,
            company:companies!inner(*)
          ),
          documents:trucking_documents!trucking_documents_load_fkey(*)
        `)
        .eq('id', loadId)
        .single();

      if (error) {
        console.error('[useLoadDetails] Query error:', error);
        throw error;
      }

      if (!data) return null;

      // Cast to any to work with database response
      const loadData = data as any;

      // Extract parsed manifest items from all documents
      const parsedManifestItems = (loadData.documents || []).flatMap(
        (doc: any) => doc.parsed_payload || []
      );

      return {
        load: loadData as TruckingLoad,
        storageRequest: loadData.storage_request as StorageRequest,
        company: loadData.storage_request.company as Company,
        documents: loadData.documents as TruckingDocument[],
        parsedManifestItems,
      };
    },
    staleTime: 30 * 1000,
    refetchOnWindowFocus: false,
  });
}

/**
 * Get count of pending loads for badge display
 */
export function usePendingLoadsCount() {
  return useQuery<number>({
    queryKey: ['trucking-loads', 'pending', 'count'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('trucking_loads')
        .select('*', { count: 'exact', head: true })
        .eq('direction', 'INBOUND')
        .eq('status', 'NEW');

      if (error) {
        console.error('[usePendingLoadsCount] Query error:', error);
        throw error;
      }

      return count || 0;
    },
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  });
}

/**
 * Get lightweight list of approved loads (status = APPROVED)
 * Used for admin approved loads tab - ready to mark in transit
 */
export function useApprovedLoads() {
  return useQuery<PendingLoadSummary[]>({
    queryKey: ['trucking-loads', 'approved'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('trucking_loads')
        .select(`
          id,
          sequence_number,
          status,
          scheduled_slot_start,
          scheduled_slot_end,
          trucking_company,
          driver_name,
          total_joints_planned,
          total_length_ft_planned,
          total_weight_lbs_planned,
          created_at,
          storage_request:storage_requests!inner(
            id,
            reference_id,
            company_id,
            company:companies!inner(id, name, domain)
          ),
          documents:trucking_documents!trucking_documents_load_fkey(id, file_name)
        `)
        .eq('direction', 'INBOUND')
        .eq('status', 'APPROVED')
        .order('scheduled_slot_start', { ascending: true });

      if (error) {
        console.error('[useApprovedLoads] Query error:', error);
        throw error;
      }

      // Transform to summary format
      return (data || []).map((load: any) => ({
        loadId: load.id,
        sequenceNumber: load.sequence_number,
        companyId: load.storage_request.company_id,
        companyName: load.storage_request.company.name,
        requestReferenceId: load.storage_request.reference_id,
        requestId: load.storage_request.id,
        scheduledSlotStart: load.scheduled_slot_start,
        scheduledSlotEnd: load.scheduled_slot_end,
        isAfterHours: isAfterHoursSlot(load.scheduled_slot_start),
        truckingCompany: load.trucking_company,
        driverName: load.driver_name,
        totalJointsPlanned: load.total_joints_planned,
        totalLengthFtPlanned: load.total_length_ft_planned,
        totalWeightLbsPlanned: load.total_weight_lbs_planned,
        documentCount: load.documents?.length || 0,
        createdAt: load.created_at,
      }));
    },
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true,
    refetchInterval: 60 * 1000,
  });
}

/**
 * Get count of approved loads for badge display
 */
export function useApprovedLoadsCount() {
  return useQuery<number>({
    queryKey: ['trucking-loads', 'approved', 'count'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('trucking_loads')
        .select('*', { count: 'exact', head: true })
        .eq('direction', 'INBOUND')
        .eq('status', 'APPROVED');

      if (error) {
        console.error('[useApprovedLoadsCount] Query error:', error);
        throw error;
      }

      return count || 0;
    },
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  });
}

/**
 * Get lightweight list of in-transit loads (status = IN_TRANSIT)
 * Used for admin in-transit tab - ready to mark completed
 */
export function useInTransitLoads() {
  return useQuery<PendingLoadSummary[]>({
    queryKey: ['trucking-loads', 'in-transit'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('trucking_loads')
        .select(`
          id,
          sequence_number,
          status,
          scheduled_slot_start,
          scheduled_slot_end,
          trucking_company,
          driver_name,
          total_joints_planned,
          total_length_ft_planned,
          total_weight_lbs_planned,
          created_at,
          storage_request:storage_requests!inner(
            id,
            reference_id,
            company_id,
            company:companies!inner(id, name, domain)
          ),
          documents:trucking_documents!trucking_documents_load_fkey(id, file_name)
        `)
        .eq('direction', 'INBOUND')
        .eq('status', 'IN_TRANSIT')
        .order('scheduled_slot_end', { ascending: true }); // Sort by ETA

      if (error) {
        console.error('[useInTransitLoads] Query error:', error);
        throw error;
      }

      // Transform to summary format
      return (data || []).map((load: any) => ({
        loadId: load.id,
        sequenceNumber: load.sequence_number,
        companyId: load.storage_request.company_id,
        companyName: load.storage_request.company.name,
        requestReferenceId: load.storage_request.reference_id,
        requestId: load.storage_request.id,
        scheduledSlotStart: load.scheduled_slot_start,
        scheduledSlotEnd: load.scheduled_slot_end,
        isAfterHours: isAfterHoursSlot(load.scheduled_slot_start),
        truckingCompany: load.trucking_company,
        driverName: load.driver_name,
        totalJointsPlanned: load.total_joints_planned,
        totalLengthFtPlanned: load.total_length_ft_planned,
        totalWeightLbsPlanned: load.total_weight_lbs_planned,
        documentCount: load.documents?.length || 0,
        createdAt: load.created_at,
      }));
    },
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true,
    refetchInterval: 60 * 1000,
  });
}

/**
 * Get count of in-transit loads for badge display
 */
export function useInTransitLoadsCount() {
  return useQuery<number>({
    queryKey: ['trucking-loads', 'in-transit', 'count'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('trucking_loads')
        .select('*', { count: 'exact', head: true })
        .eq('direction', 'INBOUND')
        .eq('status', 'IN_TRANSIT');

      if (error) {
        console.error('[useInTransitLoadsCount] Query error:', error);
        throw error;
      }

      return count || 0;
    },
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  });
}

/**
 * Check if a storage request has any incomplete loads
 * Used for sequential load blocking in InboundShipmentWizard
 *
 * Returns the most recent incomplete load for the request, or null if all loads are completed/rejected.
 * This allows Load #2 to be booked only after Load #1 has been COMPLETED (not just approved).
 *
 * Blocking conditions: NEW, APPROVED, or IN_TRANSIT
 * Non-blocking conditions: COMPLETED or REJECTED
 *
 * Rationale: Inventory must be reconciled before next truck arrival
 */
export function usePendingLoadForRequest(requestId?: string) {
  return useQuery<TruckingLoad | null>({
    queryKey: requestId ? ['trucking-loads', 'pending-for-request', requestId] : ['trucking-loads', 'pending-for-request', 'null'],
    enabled: !!requestId,
    queryFn: async () => {
      if (!requestId) return null;

      const { data, error } = await supabase
        .from('trucking_loads')
        .select('*')
        .eq('storage_request_id', requestId)
        .eq('direction', 'INBOUND')
        .not('status', 'in', '(COMPLETED,REJECTED)') // Block on NEW, APPROVED, IN_TRANSIT
        .order('sequence_number', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('[usePendingLoadForRequest] Query error:', error);
        throw error;
      }

      return data as TruckingLoad | null;
    },
    staleTime: 10 * 1000, // Short stale time for real-time blocking
    refetchOnWindowFocus: true,
    refetchInterval: 30 * 1000, // Auto-refresh every 30 seconds
  });
}
