/**
 * Supabase Data Hooks
 * React Query hooks for fetching and mutating data in Supabase
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { Company, StorageRequest, Pipe, Yard, TruckLoad, StorageDocument } from '../types';
import type { Database } from '../lib/database.types';

type CompanyRow = Database['public']['Tables']['companies']['Row'];
type StorageRequestRow = Database['public']['Tables']['storage_requests']['Row'];
type InventoryRow = Database['public']['Tables']['inventory']['Row'];
type DocumentRow = Database['public']['Tables']['documents']['Row'];
type TruckLoadRow = Database['public']['Tables']['truck_loads']['Row'];
type YardRow = Database['public']['Tables']['yards']['Row'];
type YardAreaRow = Database['public']['Tables']['yard_areas']['Row'];
type RackRow = Database['public']['Tables']['racks']['Row'];

const mapCompanyRow = (row: CompanyRow): Company => ({
  id: row.id,
  name: row.name,
  domain: row.domain,
});

const mapStorageRequestRow = (row: StorageRequestRow): StorageRequest => ({
  id: row.id,
  companyId: row.company_id,
  userId: row.user_email,
  referenceId: row.reference_id,
  status: row.status,
  archivedAt: row.archived_at ?? undefined,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  approvedAt: row.approved_at,
  approvedBy: row.approved_by ?? undefined,
  rejectedAt: row.rejected_at,
  internalNotes: row.internal_notes ?? undefined,
  requestDetails: row.request_details ? (row.request_details as StorageRequest['requestDetails']) : undefined,
  truckingInfo: row.trucking_info ? (row.trucking_info as StorageRequest['truckingInfo']) : undefined,
  assignedLocation: row.assigned_location || undefined,
  assignedRackIds: row.assigned_rack_ids || undefined,
  approvalSummary: row.approval_summary || undefined,
  rejectionReason: row.rejection_reason || undefined,
});

const mapInventoryRow = (row: InventoryRow): Pipe => ({
  id: row.id,
  companyId: row.company_id,
  referenceId: row.reference_id,
  type: row.type,
  grade: row.grade,
  outerDiameter: Number(row.outer_diameter),
  weight: Number(row.weight),
  length: Number(row.length),
  quantity: row.quantity,
  status: row.status,
  dropOffTimestamp: row.drop_off_timestamp || undefined,
  pickUpTimestamp: row.pickup_timestamp || undefined,
  storageAreaId: row.storage_area_id || undefined,
  assignedUWI: row.assigned_uwi || undefined,
  assignedWellName: row.assigned_well_name || undefined,
  deliveryTruckLoadId: row.delivery_truck_load_id || undefined,
  pickupTruckLoadId: row.pickup_truck_load_id || undefined,
});

const mapDocumentRow = (row: DocumentRow): StorageDocument => ({
  id: row.id,
  companyId: row.company_id,
  requestId: row.request_id || undefined,
  inventoryId: row.inventory_id || undefined,
  fileName: row.file_name,
  fileType: row.file_type,
  fileSize: row.file_size,
  storagePath: row.storage_path,
  extractedData: (row.extracted_data as StorageDocument['extractedData']) ?? null,
  isProcessed: row.is_processed ?? false,
  uploadedAt: row.uploaded_at,
  processedAt: row.processed_at || undefined,
});

const mapTruckLoadRow = (row: TruckLoadRow): TruckLoad => ({
  id: row.id,
  type: row.type,
  truckingCompany: row.trucking_company,
  driverName: row.driver_name,
  driverPhone: row.driver_phone || undefined,
  arrivalTime: row.arrival_time,
  departureTime: row.departure_time || undefined,
  jointsCount: row.joints_count,
  storageAreaId: row.storage_area_id || undefined,
  relatedRequestId: row.related_request_id || undefined,
  relatedPipeIds: row.related_pipe_ids ?? [],
  assignedUWI: row.assigned_uwi || undefined,
  assignedWellName: row.assigned_well_name || undefined,
  notes: row.notes || undefined,
  photoUrls: row.photo_urls || undefined,
});

type YardQueryRow = YardRow & {
  areas?: Array<YardAreaRow & { racks?: RackRow[] }>;
};

const mapYardRow = (row: YardQueryRow): Yard => ({
  id: row.id,
  name: row.name,
  areas: (row.areas || []).map((area) => ({
    id: area.id,
    name: area.name,
    racks: (area.racks || []).map((rack) => ({
      id: rack.id,
      name: rack.name,
      capacity: rack.capacity ?? 0,
      capacityMeters: rack.capacity_meters ?? 0,
      occupied: rack.occupied ?? 0,
      occupiedMeters: rack.occupied_meters ?? 0,
    })),
  })),
});

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
  documents: ['documents'] as const,
  documentsByCompany: (companyId: string) => ['documents', companyId] as const,
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
      const rows = (data ?? []) as CompanyRow[];
      return rows.map(mapCompanyRow);
    },
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchOnMount: 'always',
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
      return mapCompanyRow(data as CompanyRow);
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
      const rows = (data ?? []) as StorageRequestRow[];
      return rows.map(mapStorageRequestRow);
    },
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchOnMount: 'always',
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
          request_details: (newRequest.requestDetails as StorageRequest['requestDetails']) ?? null,
          trucking_info: (newRequest.truckingInfo as StorageRequest['truckingInfo']) ?? null,
          assigned_location: newRequest.assignedLocation ?? null,
          assigned_rack_ids: newRequest.assignedRackIds ?? null,
          approval_summary: newRequest.approvalSummary ?? null,
          rejection_reason: newRequest.rejectionReason ?? null,
          archived_at: newRequest.archivedAt ?? null,
          approved_at: newRequest.approvedAt ?? null,
          approved_by: newRequest.approvedBy ?? null,
          internal_notes: newRequest.internalNotes ?? null,
        })
        .select()
        .single();

      if (error) throw error;
      return mapStorageRequestRow(data as StorageRequestRow);
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
      const updateData: any = {
        status: updatedRequest.status,
        request_details: (updatedRequest.requestDetails as StorageRequest['requestDetails']) ?? null,
        trucking_info: (updatedRequest.truckingInfo as StorageRequest['truckingInfo']) ?? null,
        assigned_location: updatedRequest.assignedLocation ?? null,
        assigned_rack_ids: updatedRequest.assignedRackIds ?? null,
        approval_summary: updatedRequest.approvalSummary ?? null,
        rejection_reason: updatedRequest.rejectionReason ?? null,
        archived_at: updatedRequest.archivedAt ?? null,
        approved_by: updatedRequest.approvedBy ?? null,
        internal_notes: updatedRequest.internalNotes ?? null,
      };

      // Set timestamp based on status
      if (updatedRequest.status === 'APPROVED') {
        updateData.approved_at = updatedRequest.approvedAt ?? new Date().toISOString();
        updateData.rejected_at = updatedRequest.rejectedAt ?? null;
      } else if (updatedRequest.status === 'REJECTED') {
        updateData.rejected_at = updatedRequest.rejectedAt ?? new Date().toISOString();
        updateData.approved_at = updatedRequest.approvedAt ?? null;
      } else {
        updateData.approved_at = updatedRequest.approvedAt ?? null;
        updateData.rejected_at = updatedRequest.rejectedAt ?? null;
      }

      const { data, error } = await supabase
        .from('storage_requests')
        .update(updateData)
        .eq('id', updatedRequest.id)
        .select()
        .single();

      if (error) throw error;
      return mapStorageRequestRow(data as StorageRequestRow);
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
      const rows = (data ?? []) as InventoryRow[];
      return rows.map(mapInventoryRow);
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
      return mapInventoryRow(data as InventoryRow);
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
// DOCUMENTS
// ============================================================================

export function useDocuments(companyId?: string) {
  return useQuery({
    queryKey: companyId ? queryKeys.documentsByCompany(companyId) : queryKeys.documents,
    queryFn: async () => {
      let query = supabase
        .from('documents')
        .select('*')
        .order('uploaded_at', { ascending: false });

      if (companyId) {
        query = query.eq('company_id', companyId);
      }

      const { data, error } = await query;

      if (error) throw error;
      const rows = (data ?? []) as DocumentRow[];
      return rows.map(mapDocumentRow);
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
      const rows = (data ?? []) as YardQueryRow[];
      return rows.map(mapYardRow);
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
      const rows = (data ?? []) as TruckLoadRow[];
      return rows.map(mapTruckLoadRow);
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
          driver_phone: newTruckLoad.driverPhone ?? null,
          arrival_time: newTruckLoad.arrivalTime,
          departure_time: newTruckLoad.departureTime ?? null,
          joints_count: newTruckLoad.jointsCount,
          storage_area_id: newTruckLoad.storageAreaId ?? null,
          related_request_id: newTruckLoad.relatedRequestId ?? null,
          related_pipe_ids: newTruckLoad.relatedPipeIds ?? [],
          assigned_uwi: newTruckLoad.assignedUWI ?? null,
          assigned_well_name: newTruckLoad.assignedWellName ?? null,
          notes: newTruckLoad.notes ?? null,
          photo_urls: newTruckLoad.photoUrls ?? null,
        })
        .select()
        .single();

      if (error) throw error;
      return mapTruckLoadRow(data as TruckLoadRow);
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
          departure_time: updates.departureTime ?? null,
          notes: updates.notes ?? null,
          photo_urls: updates.photoUrls ?? null,
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return mapTruckLoadRow(data as TruckLoadRow);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.truckLoads });
    },
  });
}
