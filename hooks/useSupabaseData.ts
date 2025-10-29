/**
 * Supabase Data Hooks
 * React Query hooks for fetching and mutating data in Supabase
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { Company, StorageRequest, Pipe, Yard, TruckLoad } from '../types';
import type { Database } from '../lib/database.types';

// ============================================================================
// QUERY KEYS
// ============================================================================
export const queryKeys = {
  companies: ['companies'] as const,
  requests: ['requests'] as const,
  requestsByCompany: (companyId: string) => ['requests', companyId] as const,
  inventory: ['inventory'] as const,
  inventoryByCompany: (companyId: string) => ['inventory', companyId] as const,
  inventoryByReference: (companyId: string, referenceId: string) => ['inventory', companyId, referenceId] as const,
  yards: ['yards'] as const,
  racks: ['racks'] as const,
  truckLoads: ['truckLoads'] as const,
};

// ============================================================================
// COMPANIES
// ============================================================================

export function useCompanies() {
  return useQuery({
    queryKey: queryKeys.companies,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .order('name');

      if (error) throw error;
      return data as Company[];
    },
  });
}

export function useAddCompany() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (newCompany: Omit<Company, 'id'>) => {
      const { data, error } = await supabase
        .from('companies')
        .insert({
          name: newCompany.name,
          domain: newCompany.domain,
        })
        .select()
        .single();

      if (error) throw error;
      return data as Company;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.companies });
    },
  });
}

// ============================================================================
// STORAGE REQUESTS
// ============================================================================

export function useRequests(companyId?: string) {
  return useQuery({
    queryKey: companyId ? queryKeys.requestsByCompany(companyId) : queryKeys.requests,
    queryFn: async () => {
      let query = supabase
        .from('storage_requests')
        .select('*')
        .order('created_at', { ascending: false });

      if (companyId) {
        query = query.eq('company_id', companyId);
      }

      const { data, error} = await query;

      if (error) throw error;
      return data as StorageRequest[];
    },
  });
}

export function useAddRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (newRequest: Omit<StorageRequest, 'id'>) => {
      const { data, error } = await supabase
        .from('storage_requests')
        .insert({
          company_id: newRequest.companyId,
          user_email: newRequest.userId,
          reference_id: newRequest.referenceId,
          status: newRequest.status,
          request_details: newRequest.requestDetails as any,
          trucking_info: newRequest.truckingInfo as any,
        })
        .select()
        .single();

      if (error) throw error;
      return data as unknown as StorageRequest;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.requests });
    },
  });
}

export function useUpdateRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (updatedRequest: StorageRequest) => {
      const { data, error } = await supabase
        .from('storage_requests')
        .update({
          status: updatedRequest.status,
          request_details: updatedRequest.requestDetails as any,
          trucking_info: updatedRequest.truckingInfo as any,
          assigned_location: updatedRequest.assignedLocation,
          assigned_rack_ids: updatedRequest.assignedRackIds,
          approval_summary: updatedRequest.approvalSummary,
          rejection_reason: updatedRequest.rejectionReason,
        })
        .eq('id', updatedRequest.id)
        .select()
        .single();

      if (error) throw error;
      return data as unknown as StorageRequest;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.requests });
    },
  });
}

// ============================================================================
// INVENTORY
// ============================================================================

export function useInventory(companyId?: string, referenceId?: string) {
  return useQuery({
    queryKey: referenceId && companyId
      ? queryKeys.inventoryByReference(companyId, referenceId)
      : companyId
      ? queryKeys.inventoryByCompany(companyId)
      : queryKeys.inventory,
    queryFn: async () => {
      let query = supabase
        .from('inventory')
        .select('*')
        .order('created_at', { ascending: false });

      if (companyId) {
        query = query.eq('company_id', companyId);
      }

      if (referenceId) {
        query = query.eq('reference_id', referenceId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as unknown as Pipe[];
    },
  });
}

export function useAddInventoryItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (newPipe: Omit<Pipe, 'id'>) => {
      const { data, error } = await supabase
        .from('inventory')
        .insert({
          company_id: newPipe.companyId,
          reference_id: newPipe.referenceId,
          type: newPipe.type,
          grade: newPipe.grade,
          outer_diameter: newPipe.outerDiameter,
          weight: newPipe.weight,
          length: newPipe.length,
          quantity: newPipe.quantity,
          status: newPipe.status || 'PENDING_DELIVERY',
          drop_off_timestamp: newPipe.dropOffTimestamp,
          storage_area_id: newPipe.storageAreaId,
        })
        .select()
        .single();

      if (error) throw error;
      return data as unknown as Pipe;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.inventory });
    },
  });
}

export function useUpdateInventoryItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Pipe> }) => {
      const { data, error } = await supabase
        .from('inventory')
        .update({
          status: updates.status,
          pickup_timestamp: updates.pickUpTimestamp,
          assigned_uwi: updates.assignedUWI,
          assigned_well_name: updates.assignedWellName,
          pickup_truck_load_id: updates.pickupTruckLoadId,
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as unknown as Pipe;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.inventory });
    },
  });
}

// ============================================================================
// YARDS
// ============================================================================

export function useYards() {
  return useQuery({
    queryKey: queryKeys.yards,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('yards')
        .select(`
          *,
          areas:yard_areas(
            *,
            racks(*)
          )
        `)
        .order('id');

      if (error) throw error;
      return data as unknown as Yard[];
    },
  });
}

export function useUpdateRack() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: { occupied: number; occupiedMeters: number } }) => {
      const { data, error } = await supabase
        .from('racks')
        .update({
          occupied: updates.occupied,
          occupied_meters: updates.occupiedMeters,
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.yards });
      queryClient.invalidateQueries({ queryKey: queryKeys.racks });
    },
  });
}

// ============================================================================
// TRUCK LOADS
// ============================================================================

export function useTruckLoads() {
  return useQuery({
    queryKey: queryKeys.truckLoads,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('truck_loads')
        .select('*')
        .order('arrival_time', { ascending: false });

      if (error) throw error;
      return data as unknown as TruckLoad[];
    },
  });
}

export function useAddTruckLoad() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (newTruckLoad: Omit<TruckLoad, 'id'>) => {
      const { data, error } = await supabase
        .from('truck_loads')
        .insert({
          type: newTruckLoad.type,
          trucking_company: newTruckLoad.truckingCompany,
          driver_name: newTruckLoad.driverName,
          driver_phone: newTruckLoad.driverPhone,
          arrival_time: newTruckLoad.arrivalTime,
          departure_time: newTruckLoad.departureTime,
          joints_count: newTruckLoad.jointsCount,
          storage_area_id: newTruckLoad.storageAreaId,
          related_request_id: newTruckLoad.relatedRequestId,
          related_pipe_ids: newTruckLoad.relatedPipeIds,
          assigned_uwi: newTruckLoad.assignedUWI,
          assigned_well_name: newTruckLoad.assignedWellName,
          notes: newTruckLoad.notes,
          photo_urls: newTruckLoad.photoUrls,
        })
        .select()
        .single();

      if (error) throw error;
      return data as unknown as TruckLoad;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.truckLoads });
    },
  });
}

export function useUpdateTruckLoad() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<TruckLoad> }) => {
      const { data, error } = await supabase
        .from('truck_loads')
        .update({
          departure_time: updates.departureTime,
          notes: updates.notes,
          photo_urls: updates.photoUrls,
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as unknown as TruckLoad;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.truckLoads });
    },
  });
}
