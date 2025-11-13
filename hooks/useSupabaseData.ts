/**
 * Supabase Data Hooks
 * React Query hooks for fetching and mutating data in Supabase
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type {
  Company,
  StorageRequest,
  Pipe,
  Yard,
  TruckLoad,
  StorageDocument,
  Shipment,
  ShipmentTruck,
  DockAppointment,
  ShipmentDocument,
  ShipmentItem,
  TruckingLoad,
  TruckingDocument,
} from '../types';
import type { Database } from '../lib/database.types';

type CompanyRow = Database['public']['Tables']['companies']['Row'];
type StorageRequestRow = Database['public']['Tables']['storage_requests']['Row'];
type InventoryRow = Database['public']['Tables']['inventory']['Row'];
type DocumentRow = Database['public']['Tables']['documents']['Row'];
// DEPRECATED: truck_loads table removed in migration 20251110000003
// type TruckLoadRow = Database['public']['Tables']['truck_loads']['Row'];
type ShipmentRow = Database['public']['Tables']['shipments']['Row'];
type ShipmentTruckRow = Database['public']['Tables']['shipment_trucks']['Row'];
type DockAppointmentRow = Database['public']['Tables']['dock_appointments']['Row'];
type ShipmentDocumentRow = Database['public']['Tables']['shipment_documents']['Row'];
type ShipmentDocumentQueryRow = ShipmentDocumentRow & { document?: DocumentRow };
type ShipmentItemRow = Database['public']['Tables']['shipment_items']['Row'];
type YardRow = Database['public']['Tables']['yards']['Row'];
type YardAreaRow = Database['public']['Tables']['yard_areas']['Row'];
type RackRow = Database['public']['Tables']['racks']['Row'];
type TruckingLoadRow = Database['public']['Tables']['trucking_loads']['Row'];
type TruckingDocumentRow = Database['public']['Tables']['trucking_documents']['Row'];

type CreateTruckingLoadInput = {
  storageRequestId: string;
  direction: TruckingLoad['direction'];
  sequenceNumber?: number;
  status?: TruckingLoad['status'];
  scheduledSlotStart?: string | null;
  scheduledSlotEnd?: string | null;
  pickupLocation?: Record<string, unknown> | null;
  deliveryLocation?: Record<string, unknown> | null;
  assetName?: string | null;
  wellpadName?: string | null;
  wellName?: string | null;
  uwi?: string | null;
  truckingCompany?: string | null;
  contactCompany?: string | null;
  contactName?: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
  driverName?: string | null;
  driverPhone?: string | null;
  notes?: string | null;
  totalJointsPlanned?: number | null;
  totalLengthFtPlanned?: number | null;
  totalWeightLbsPlanned?: number | null;
};

type TruckingLoadUpdateFields = Partial<{
  status: TruckingLoad['status'];
  scheduledSlotStart: string | null;
  scheduledSlotEnd: string | null;
  pickupLocation: Record<string, unknown> | null;
  deliveryLocation: Record<string, unknown> | null;
  assetName: string | null;
  wellpadName: string | null;
  wellName: string | null;
  uwi: string | null;
  truckingCompany: string | null;
  contactCompany: string | null;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  driverName: string | null;
  driverPhone: string | null;
  notes: string | null;
  totalJointsPlanned: number | null;
  totalLengthFtPlanned: number | null;
  totalWeightLbsPlanned: number | null;
  totalJointsCompleted: number | null;
  totalLengthFtCompleted: number | null;
  totalWeightLbsCompleted: number | null;
  approvedAt: string | null;
  completedAt: string | null;
}>;

type UpdateTruckingLoadInput = {
  id: string;
  storageRequestId: string;
  updates: TruckingLoadUpdateFields;
};

type CreateTruckingDocumentInput = {
  truckingLoadId: string;
  fileName: string;
  storagePath: string;
  documentType?: string | null;
  uploadedBy?: string | null;
  uploadedAt?: string;
  storageRequestId?: string;
};

type ShipmentQueryRow = ShipmentRow & {
  shipment_trucks?: ShipmentTruckRow[];
  dock_appointments?: DockAppointmentRow[];
  shipment_documents?: ShipmentDocumentQueryRow[];
  shipment_items?: ShipmentItemRow[];
};

type StorageRequestQueryRow = StorageRequestRow & {
  trucking_loads?: Array<TruckingLoadRow & { trucking_documents?: TruckingDocumentRow[] }>;
};

type ShipmentTruckExtras = {
  appointments?: DockAppointmentRow[];
  documents?: ShipmentDocumentQueryRow[];
  items?: ShipmentItemRow[];
};

const mapCompanyRow = (row: CompanyRow): Company => ({
  id: row.id,
  name: row.name,
  domain: row.domain,
});

const mapStorageRequestRow = (row: StorageRequestQueryRow): StorageRequest => ({
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
  truckingLoads: (row.trucking_loads || []).map(mapTruckingLoadRow),
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

const mapDockAppointmentRow = (row: DockAppointmentRow): DockAppointment => ({
  id: row.id,
  shipmentId: row.shipment_id,
  truckId: row.truck_id || undefined,
  slotStart: row.slot_start,
  slotEnd: row.slot_end,
  afterHours: row.after_hours ?? undefined,
  surchargeApplied: row.surcharge_applied ?? undefined,
  status: row.status,
  calendarEventId: row.calendar_event_id || undefined,
  calendarSyncStatus: row.calendar_sync_status || undefined,
  reminder24hSentAt: row.reminder_24h_sent_at || undefined,
  reminder1hSentAt: row.reminder_1h_sent_at || undefined,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  truckingLoadId: row.trucking_load_id || undefined,
});

const mapShipmentDocumentRow = (row: ShipmentDocumentQueryRow): ShipmentDocument => ({
  id: row.id,
  shipmentId: row.shipment_id,
  truckId: row.truck_id || undefined,
  documentId: row.document_id,
  documentType: row.document_type,
  status: row.status,
  parsedPayload: (row.parsed_payload as ShipmentDocument['parsedPayload']) ?? null,
  processingNotes: row.processing_notes || undefined,
  uploadedBy: row.uploaded_by || undefined,
  fileName: row.document?.file_name ?? undefined,
  fileType: row.document?.file_type ?? undefined,
  fileSize: row.document?.file_size ?? undefined,
  storagePath: row.document?.storage_path ?? undefined,
  uploadedAt: row.document?.uploaded_at ?? undefined,
  createdAt: row.created_at,
  processedAt: row.processed_at || undefined,
  updatedAt: row.updated_at,
  truckingLoadId: row.trucking_load_id || undefined,
});

const mapShipmentItemRow = (row: ShipmentItemRow): ShipmentItem => ({
  id: row.id,
  shipmentId: row.shipment_id,
  truckId: row.truck_id || undefined,
  documentId: row.document_id || undefined,
  inventoryId: row.inventory_id || undefined,
  manufacturer: row.manufacturer || undefined,
  heatNumber: row.heat_number || undefined,
  serialNumber: row.serial_number || undefined,
  tallyLengthFt: row.tally_length_ft ?? undefined,
  quantity: row.quantity ?? undefined,
  status: row.status,
  notes: row.notes || undefined,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  truckingLoadId: row.trucking_load_id || undefined,
});

const mapShipmentTruckRow = (row: ShipmentTruckRow, extras: ShipmentTruckExtras = {}): ShipmentTruck => {
  const appointmentRow = extras.appointments?.find(appt => appt.truck_id === row.id);
  const documents = extras.documents?.filter(doc => doc.truck_id === row.id) ?? [];
  const items = extras.items?.filter(item => item.truck_id === row.id) ?? [];

  return {
    id: row.id,
    shipmentId: row.shipment_id,
    sequenceNumber: row.sequence_number,
    status: row.status,
    truckingCompany: row.trucking_company || undefined,
    contactName: row.contact_name || undefined,
    contactPhone: row.contact_phone || undefined,
    contactEmail: row.contact_email || undefined,
    scheduledSlotStart: row.scheduled_slot_start || undefined,
    scheduledSlotEnd: row.scheduled_slot_end || undefined,
    arrivalTime: row.arrival_time || undefined,
    departureTime: row.departure_time || undefined,
    jointsCount: row.joints_count ?? undefined,
    totalLengthFt: row.total_length_ft ?? undefined,
    manifestReceived: row.manifest_received ?? undefined,
    notes: row.notes || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    truckingLoadId: row.trucking_load_id || undefined,
    appointment: appointmentRow ? mapDockAppointmentRow(appointmentRow) : undefined,
    documents: documents.map(mapShipmentDocumentRow),
    manifestItems: items.map(mapShipmentItemRow),
  };
};

const mapTruckingLoadRow = (
  row: TruckingLoadRow & { trucking_documents?: TruckingDocumentRow[] }
): TruckingLoad => ({
  id: row.id,
  storageRequestId: row.storage_request_id,
  direction: row.direction,
  sequenceNumber: row.sequence_number,
  status: row.status,
  scheduledSlotStart: row.scheduled_slot_start || undefined,
  scheduledSlotEnd: row.scheduled_slot_end || undefined,
  pickupLocation: (row.pickup_location as Record<string, unknown> | null) ?? null,
  deliveryLocation: (row.delivery_location as Record<string, unknown> | null) ?? null,
  assetName: row.asset_name || null,
  wellpadName: row.wellpad_name || null,
  wellName: row.well_name || null,
  uwi: row.uwi || null,
  truckingCompany: row.trucking_company || null,
  contactCompany: row.contact_company || null,
  contactName: row.contact_name || null,
  contactPhone: row.contact_phone || null,
  contactEmail: row.contact_email || null,
  driverName: row.driver_name || null,
  driverPhone: row.driver_phone || null,
  notes: row.notes || null,
  totalJointsPlanned: row.total_joints_planned ?? null,
  totalLengthFtPlanned: row.total_length_ft_planned ?? null,
  totalWeightLbsPlanned: row.total_weight_lbs_planned ?? null,
  totalJointsCompleted: row.total_joints_completed ?? null,
  totalLengthFtCompleted: row.total_length_ft_completed ?? null,
  totalWeightLbsCompleted: row.total_weight_lbs_completed ?? null,
  approvedAt: row.approved_at || null,
  completedAt: row.completed_at || null,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  documents: row.trucking_documents ? row.trucking_documents.map(mapTruckingDocumentRow) : undefined,
});

const mapTruckingDocumentRow = (row: TruckingDocumentRow): TruckingDocument => ({
  id: row.id,
  truckingLoadId: row.trucking_load_id,
  fileName: row.file_name,
  storagePath: row.storage_path,
  documentType: row.document_type || null,
  uploadedBy: row.uploaded_by || null,
  uploadedAt: row.uploaded_at || undefined,
  parsedPayload: (row.parsed_payload as any) || null, // AI-extracted manifest data
});
const mapShipmentRow = (row: ShipmentQueryRow): Shipment => {
  const appointments = row.dock_appointments ?? [];
  const documents = row.shipment_documents ?? [];
  const items = row.shipment_items ?? [];
  const trucks = row.shipment_trucks ?? [];

  return {
    id: row.id,
    requestId: row.request_id,
    companyId: row.company_id,
    createdBy: row.created_by,
    status: row.status,
    truckingMethod: row.trucking_method,
    truckingCompany: row.trucking_company || undefined,
    truckingContactName: row.trucking_contact_name || undefined,
    truckingContactPhone: row.trucking_contact_phone || undefined,
    truckingContactEmail: row.trucking_contact_email || undefined,
    numberOfTrucks: row.number_of_trucks,
    estimatedJointCount: row.estimated_joint_count ?? undefined,
    estimatedTotalLengthFt: row.estimated_total_length_ft ?? undefined,
    specialInstructions: row.special_instructions || undefined,
    surchargeApplicable: row.surcharge_applicable ?? undefined,
    surchargeAmount: row.surcharge_amount ?? undefined,
    documentsStatus: row.documents_status || undefined,
    calendarSyncStatus: row.calendar_sync_status || undefined,
    latestCustomerNotificationAt: row.latest_customer_notification_at || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    truckingLoadId: row.trucking_load_id || undefined,
    trucks: trucks.map(truck => mapShipmentTruckRow(truck, { appointments, documents, items })),
    appointments: appointments.map(mapDockAppointmentRow),
    documents: documents.map(mapShipmentDocumentRow),
    manifestItems: items.map(mapShipmentItemRow),
  };
};

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
        allocationMode: (rack.allocation_mode as 'LINEAR_CAPACITY' | 'SLOT') ?? 'LINEAR_CAPACITY',
        lengthMeters: rack.length_meters ?? null,
        widthMeters: rack.width_meters ?? null,
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
  // DEPRECATED: truckLoads removed in migration 20251110000003
  // truckLoads: ['truckLoads'] as const,
  truckingLoads: ['trucking-loads'] as const,
  truckingLoadsByRequest: (requestId: string) => ['trucking-loads', requestId] as const,
  truckingDocuments: ['trucking-documents'] as const,
  truckingDocumentsByLoad: (loadId: string) => ['trucking-documents', loadId] as const,
  documents: ['documents'] as const,
  documentsByCompany: (companyId: string) => ['documents', companyId] as const,
  shipments: ['shipments'] as const,
  shipment: (shipmentId: string) => ['shipments', shipmentId] as const,
  shipmentsByCompany: (companyId: string) => ['shipments', 'company', companyId] as const,
  shipmentsByRequest: (requestId: string) => ['shipments', 'request', requestId] as const,
  shipmentTrucks: (shipmentId: string) => ['shipments', shipmentId, 'trucks'] as const,
  dockAppointments: ['dockAppointments'] as const,
  dockAppointmentsByShipment: (shipmentId: string) => ['dockAppointments', shipmentId] as const,
  shipmentDocuments: (shipmentId: string) => ['shipments', shipmentId, 'documents'] as const,
  shipmentItems: (shipmentId: string) => ['shipments', shipmentId, 'items'] as const,
};

const invalidateShipmentCache = (
  queryClient: ReturnType<typeof useQueryClient>,
  context: { id?: string; companyId?: string; requestId?: string }
) => {
  queryClient.invalidateQueries({ queryKey: queryKeys.shipments });

  if (context.id) {
    queryClient.invalidateQueries({ queryKey: queryKeys.shipment(context.id) });
    queryClient.invalidateQueries({ queryKey: queryKeys.shipmentTrucks(context.id) });
    queryClient.invalidateQueries({ queryKey: queryKeys.shipmentDocuments(context.id) });
    queryClient.invalidateQueries({ queryKey: queryKeys.shipmentItems(context.id) });
    queryClient.invalidateQueries({ queryKey: queryKeys.dockAppointmentsByShipment(context.id) });
  }

  if (context.companyId) {
    queryClient.invalidateQueries({ queryKey: queryKeys.shipmentsByCompany(context.companyId) });
  }

  if (context.requestId) {
    queryClient.invalidateQueries({ queryKey: queryKeys.shipmentsByRequest(context.requestId) });
  }
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
      // Note: Using !trucking_documents_load_fkey to disambiguate duplicate foreign keys
      let query = supabase
        .from('storage_requests')
        .select(`
          *,
          trucking_loads(
            *,
            trucking_documents!trucking_documents_load_fkey(*)
          )
        `)
        .order('created_at', { ascending: false });

      if (companyId) {
        query = query.eq('company_id', companyId);
      }

      const { data, error } = await query;

      if (error) throw error;
      const rows = (data ?? []) as StorageRequestQueryRow[];
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
      const payload: Record<string, unknown> = {};

      if (updates.status !== undefined) payload.status = updates.status;
      if (updates.dropOffTimestamp !== undefined) payload.drop_off_timestamp = updates.dropOffTimestamp ?? null;
      if (updates.pickUpTimestamp !== undefined) payload.pickup_timestamp = updates.pickUpTimestamp ?? null;
      if (updates.assignedUWI !== undefined) payload.assigned_uwi = updates.assignedUWI ?? null;
      if (updates.assignedWellName !== undefined) payload.assigned_well_name = updates.assignedWellName ?? null;
      if (updates.storageAreaId !== undefined) payload.storage_area_id = updates.storageAreaId ?? null;
      if (updates.deliveryTruckLoadId !== undefined) payload.delivery_truck_load_id = updates.deliveryTruckLoadId ?? null;
      if (updates.pickupTruckLoadId !== undefined) payload.pickup_truck_load_id = updates.pickupTruckLoadId ?? null;

      if (Object.keys(payload).length === 0) {
        const { data, error } = await supabase
          .from('inventory')
          .select('*')
          .eq('id', id)
          .single();

        if (error) throw error;
        return data as unknown as Pipe;
      }

      const { data, error } = await supabase
        .from('inventory')
        .update(payload)
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
// SHIPMENTS
// ============================================================================

type CreateShipmentInput = {
  requestId: string;
  companyId: string;
  createdBy: string;
  truckingMethod: Shipment['truckingMethod'];
  status?: Shipment['status'];
  truckingCompany?: Shipment['truckingCompany'];
  truckingContactName?: Shipment['truckingContactName'];
  truckingContactPhone?: Shipment['truckingContactPhone'];
  truckingContactEmail?: Shipment['truckingContactEmail'];
  numberOfTrucks: number;
  estimatedJointCount?: number | null;
  estimatedTotalLengthFt?: number | null;
  specialInstructions?: Shipment['specialInstructions'];
  surchargeApplicable?: Shipment['surchargeApplicable'];
  surchargeAmount?: Shipment['surchargeAmount'];
  documentsStatus?: Shipment['documentsStatus'];
  calendarSyncStatus?: Shipment['calendarSyncStatus'];
};

type UpdateShipmentInput = {
  id: string;
  updates: Partial<{
    status: Shipment['status'];
    truckingMethod: Shipment['truckingMethod'];
    truckingCompany: Shipment['truckingCompany'];
    truckingContactName: Shipment['truckingContactName'];
    truckingContactPhone: Shipment['truckingContactPhone'];
    truckingContactEmail: Shipment['truckingContactEmail'];
    numberOfTrucks: number;
    estimatedJointCount: number | null;
    estimatedTotalLengthFt: number | null;
    specialInstructions: Shipment['specialInstructions'];
    surchargeApplicable: Shipment['surchargeApplicable'];
    surchargeAmount: Shipment['surchargeAmount'];
    documentsStatus: Shipment['documentsStatus'];
    calendarSyncStatus: Shipment['calendarSyncStatus'];
    latestCustomerNotificationAt: Shipment['latestCustomerNotificationAt'];
  }>;
};

type CreateShipmentTruckInput = {
  shipmentId: string;
  sequenceNumber?: number;
  status?: ShipmentTruck['status'];
  truckingCompany?: ShipmentTruck['truckingCompany'];
  contactName?: ShipmentTruck['contactName'];
  contactPhone?: ShipmentTruck['contactPhone'];
  contactEmail?: ShipmentTruck['contactEmail'];
  scheduledSlotStart?: ShipmentTruck['scheduledSlotStart'];
  scheduledSlotEnd?: ShipmentTruck['scheduledSlotEnd'];
  arrivalTime?: ShipmentTruck['arrivalTime'];
  departureTime?: ShipmentTruck['departureTime'];
  jointsCount?: ShipmentTruck['jointsCount'];
  totalLengthFt?: ShipmentTruck['totalLengthFt'];
  manifestReceived?: ShipmentTruck['manifestReceived'];
  notes?: ShipmentTruck['notes'];
};

type UpdateShipmentTruckInput = {
  id: string;
  shipmentId: string;
  updates: Partial<{
    sequenceNumber: number;
    status: ShipmentTruck['status'];
    truckingCompany: ShipmentTruck['truckingCompany'];
    contactName: ShipmentTruck['contactName'];
    contactPhone: ShipmentTruck['contactPhone'];
    contactEmail: ShipmentTruck['contactEmail'];
    scheduledSlotStart: ShipmentTruck['scheduledSlotStart'];
    scheduledSlotEnd: ShipmentTruck['scheduledSlotEnd'];
    arrivalTime: ShipmentTruck['arrivalTime'];
    departureTime: ShipmentTruck['departureTime'];
    jointsCount: ShipmentTruck['jointsCount'];
    totalLengthFt: ShipmentTruck['totalLengthFt'];
    manifestReceived: ShipmentTruck['manifestReceived'];
    notes: ShipmentTruck['notes'];
  }>;
};

type DeleteShipmentTruckInput = {
  id: string;
  shipmentId: string;
};

type CreateDockAppointmentInput = {
  shipmentId: string;
  truckId?: string | null;
  slotStart: string;
  slotEnd: string;
  afterHours?: DockAppointment['afterHours'];
  surchargeApplied?: DockAppointment['surchargeApplied'];
  status?: DockAppointment['status'];
  calendarEventId?: DockAppointment['calendarEventId'];
  calendarSyncStatus?: DockAppointment['calendarSyncStatus'];
};

type UpdateDockAppointmentInput = {
  id: string;
  shipmentId: string;
  updates: Partial<{
    truckId: DockAppointment['truckId'];
    slotStart: DockAppointment['slotStart'];
    slotEnd: DockAppointment['slotEnd'];
    afterHours: DockAppointment['afterHours'];
    surchargeApplied: DockAppointment['surchargeApplied'];
    status: DockAppointment['status'];
    calendarEventId: DockAppointment['calendarEventId'];
    calendarSyncStatus: DockAppointment['calendarSyncStatus'];
    reminder24hSentAt: DockAppointment['reminder24hSentAt'];
    reminder1hSentAt: DockAppointment['reminder1hSentAt'];
  }>;
};

type DeleteDockAppointmentInput = {
  id: string;
  shipmentId: string;
};

type CreateShipmentDocumentInput = {
  shipmentId: string;
  documentId: string;
  truckId?: string | null;
  documentType: string;
  status?: ShipmentDocument['status'];
  parsedPayload?: ShipmentDocument['parsedPayload'];
  processingNotes?: ShipmentDocument['processingNotes'];
  uploadedBy?: ShipmentDocument['uploadedBy'];
};

type UpdateShipmentDocumentInput = {
  id: string;
  shipmentId: string;
  updates: Partial<{
    truckId: ShipmentDocument['truckId'];
    documentType: ShipmentDocument['documentType'];
    status: ShipmentDocument['status'];
    parsedPayload: ShipmentDocument['parsedPayload'];
    processingNotes: ShipmentDocument['processingNotes'];
    uploadedBy: ShipmentDocument['uploadedBy'];
    processedAt: ShipmentDocument['processedAt'];
  }>;
};

type DeleteShipmentDocumentInput = {
  id: string;
  shipmentId: string;
};

type CreateShipmentItemInput = {
  shipmentId: string;
  truckId?: string | null;
  documentId?: string | null;
  inventoryId?: string | null;
  manufacturer?: ShipmentItem['manufacturer'];
  heatNumber?: ShipmentItem['heatNumber'];
  serialNumber?: ShipmentItem['serialNumber'];
  tallyLengthFt?: ShipmentItem['tallyLengthFt'];
  quantity?: ShipmentItem['quantity'];
  status?: ShipmentItem['status'];
  notes?: ShipmentItem['notes'];
};

type UpdateShipmentItemInput = {
  id: string;
  shipmentId: string;
  updates: Partial<{
    truckId: ShipmentItem['truckId'];
    documentId: ShipmentItem['documentId'];
    inventoryId: ShipmentItem['inventoryId'];
    manufacturer: ShipmentItem['manufacturer'];
    heatNumber: ShipmentItem['heatNumber'];
    serialNumber: ShipmentItem['serialNumber'];
    tallyLengthFt: ShipmentItem['tallyLengthFt'];
    quantity: ShipmentItem['quantity'];
    status: ShipmentItem['status'];
    notes: ShipmentItem['notes'];
  }>;
};

type DeleteShipmentItemInput = {
  id: string;
  shipmentId: string;
};

export function useShipments() {
  return useQuery<Shipment[]>({
    queryKey: queryKeys.shipments,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shipments')
        .select(`
          *,
          shipment_trucks(*),
          dock_appointments(*),
          shipment_documents(
            *,
            document:document_id(*)
          ),
          shipment_items(*)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      const rows = (data ?? []) as ShipmentQueryRow[];
      return rows.map(mapShipmentRow);
    },
  });
}

export function useShipmentsByCompany(companyId?: string) {
  return useQuery<Shipment[]>({
    queryKey: companyId ? queryKeys.shipmentsByCompany(companyId) : queryKeys.shipments,
    enabled: Boolean(companyId),
    queryFn: async () => {
      if (!companyId) return [];

      const { data, error } = await supabase
        .from('shipments')
        .select(`
          *,
          shipment_trucks(*),
          dock_appointments(*),
          shipment_documents(
            *,
            document:document_id(*)
          ),
          shipment_items(*)
        `)
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      const rows = (data ?? []) as ShipmentQueryRow[];
      return rows.map(mapShipmentRow);
    },
  });
}

export function useShipmentsByRequest(requestId?: string) {
  return useQuery<Shipment[]>({
    queryKey: requestId ? queryKeys.shipmentsByRequest(requestId) : queryKeys.shipments,
    enabled: Boolean(requestId),
    queryFn: async () => {
      if (!requestId) return [];

      const { data, error } = await supabase
        .from('shipments')
        .select(`
          *,
          shipment_trucks(*),
          dock_appointments(*),
          shipment_documents(
            *,
            document:document_id(*)
          ),
          shipment_items(*)
        `)
        .eq('request_id', requestId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      const rows = (data ?? []) as ShipmentQueryRow[];
      return rows.map(mapShipmentRow);
    },
  });
}

export function useShipment(shipmentId?: string) {
  return useQuery<Shipment | null>({
    queryKey: shipmentId ? queryKeys.shipment(shipmentId) : queryKeys.shipments,
    enabled: Boolean(shipmentId),
    queryFn: async () => {
      if (!shipmentId) return null;

      const { data, error } = await supabase
        .from('shipments')
        .select(`
          *,
          shipment_trucks(*),
          dock_appointments(*),
          shipment_documents(
            *,
            document:document_id(*)
          ),
          shipment_items(*)
        `)
        .eq('id', shipmentId)
        .single();

      if (error) throw error;
      return mapShipmentRow(data as ShipmentQueryRow);
    },
  });
}

export function useCreateShipment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateShipmentInput) => {
      const { data, error } = await supabase
        .from('shipments')
        .insert({
          request_id: input.requestId,
          company_id: input.companyId,
          created_by: input.createdBy,
          status: input.status ?? 'SCHEDULING',
          trucking_method: input.truckingMethod,
          trucking_company: input.truckingCompany ?? null,
          trucking_contact_name: input.truckingContactName ?? null,
          trucking_contact_phone: input.truckingContactPhone ?? null,
          trucking_contact_email: input.truckingContactEmail ?? null,
          number_of_trucks: input.numberOfTrucks,
          estimated_joint_count: input.estimatedJointCount ?? null,
          estimated_total_length_ft: input.estimatedTotalLengthFt ?? null,
          special_instructions: input.specialInstructions ?? null,
          surcharge_applicable: input.surchargeApplicable ?? false,
          surcharge_amount: input.surchargeAmount ?? null,
          documents_status: input.documentsStatus ?? null,
          calendar_sync_status: input.calendarSyncStatus ?? 'PENDING',
        })
        .select(`
          *,
          shipment_trucks(*),
          dock_appointments(*),
          shipment_documents(
            *,
            document:document_id(*)
          ),
          shipment_items(*)
        `)
        .single();

      if (error) throw error;
      return mapShipmentRow(data as ShipmentQueryRow);
    },
    onSuccess: (shipment) => {
      invalidateShipmentCache(queryClient, {
        id: shipment.id,
        companyId: shipment.companyId,
        requestId: shipment.requestId,
      });
    },
  });
}

export function useUpdateShipment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: UpdateShipmentInput) => {
      const payload: Record<string, unknown> = {};

      if (updates.status !== undefined) payload.status = updates.status;
      if (updates.truckingMethod !== undefined) payload.trucking_method = updates.truckingMethod;
      if (updates.truckingCompany !== undefined) payload.trucking_company = updates.truckingCompany ?? null;
      if (updates.truckingContactName !== undefined) payload.trucking_contact_name = updates.truckingContactName ?? null;
      if (updates.truckingContactPhone !== undefined) payload.trucking_contact_phone = updates.truckingContactPhone ?? null;
      if (updates.truckingContactEmail !== undefined) payload.trucking_contact_email = updates.truckingContactEmail ?? null;
      if (updates.numberOfTrucks !== undefined) payload.number_of_trucks = updates.numberOfTrucks;
      if (updates.estimatedJointCount !== undefined) payload.estimated_joint_count = updates.estimatedJointCount ?? null;
      if (updates.estimatedTotalLengthFt !== undefined) payload.estimated_total_length_ft = updates.estimatedTotalLengthFt ?? null;
      if (updates.specialInstructions !== undefined) payload.special_instructions = updates.specialInstructions ?? null;
      if (updates.surchargeApplicable !== undefined) payload.surcharge_applicable = updates.surchargeApplicable ?? null;
      if (updates.surchargeAmount !== undefined) payload.surcharge_amount = updates.surchargeAmount ?? null;
      if (updates.documentsStatus !== undefined) payload.documents_status = updates.documentsStatus ?? null;
      if (updates.calendarSyncStatus !== undefined) payload.calendar_sync_status = updates.calendarSyncStatus ?? null;
      if (updates.latestCustomerNotificationAt !== undefined) {
        payload.latest_customer_notification_at = updates.latestCustomerNotificationAt ?? null;
      }

      if (Object.keys(payload).length === 0) {
        const { data, error } = await supabase
          .from('shipments')
          .select(`
            *,
            shipment_trucks(*),
            dock_appointments(*),
            shipment_documents(
              *,
              document:document_id(*)
            ),
            shipment_items(*)
          `)
          .eq('id', id)
          .single();

        if (error) throw error;
        return mapShipmentRow(data as ShipmentQueryRow);
      }

      const { data, error } = await supabase
        .from('shipments')
        .update(payload)
        .eq('id', id)
        .select(`
          *,
          shipment_trucks(*),
          dock_appointments(*),
          shipment_documents(
            *,
            document:document_id(*)
          ),
          shipment_items(*)
        `)
        .single();

      if (error) throw error;
      return mapShipmentRow(data as ShipmentQueryRow);
    },
    onSuccess: (shipment) => {
      invalidateShipmentCache(queryClient, {
        id: shipment.id,
        companyId: shipment.companyId,
        requestId: shipment.requestId,
      });
    },
  });
}

export function useAddShipmentTruck() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateShipmentTruckInput) => {
      const { data, error } = await supabase
        .from('shipment_trucks')
        .insert({
          shipment_id: input.shipmentId,
          sequence_number: input.sequenceNumber ?? 1,
          status: input.status ?? 'PENDING',
          trucking_company: input.truckingCompany ?? null,
          contact_name: input.contactName ?? null,
          contact_phone: input.contactPhone ?? null,
          contact_email: input.contactEmail ?? null,
          scheduled_slot_start: input.scheduledSlotStart ?? null,
          scheduled_slot_end: input.scheduledSlotEnd ?? null,
          arrival_time: input.arrivalTime ?? null,
          departure_time: input.departureTime ?? null,
          joints_count: input.jointsCount ?? null,
          total_length_ft: input.totalLengthFt ?? null,
          manifest_received: input.manifestReceived ?? false,
          notes: input.notes ?? null,
        })
        .select('*')
        .single();

      if (error) throw error;
      return mapShipmentTruckRow(data as ShipmentTruckRow);
    },
    onSuccess: (truck) => {
      invalidateShipmentCache(queryClient, { id: truck.shipmentId });
    },
  });
}

export function useUpdateShipmentTruck() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, shipmentId, updates }: UpdateShipmentTruckInput) => {
      const payload: Record<string, unknown> = {};

      if (updates.sequenceNumber !== undefined) payload.sequence_number = updates.sequenceNumber;
      if (updates.status !== undefined) payload.status = updates.status;
      if (updates.truckingCompany !== undefined) payload.trucking_company = updates.truckingCompany ?? null;
      if (updates.contactName !== undefined) payload.contact_name = updates.contactName ?? null;
      if (updates.contactPhone !== undefined) payload.contact_phone = updates.contactPhone ?? null;
      if (updates.contactEmail !== undefined) payload.contact_email = updates.contactEmail ?? null;
      if (updates.scheduledSlotStart !== undefined) payload.scheduled_slot_start = updates.scheduledSlotStart ?? null;
      if (updates.scheduledSlotEnd !== undefined) payload.scheduled_slot_end = updates.scheduledSlotEnd ?? null;
      if (updates.arrivalTime !== undefined) payload.arrival_time = updates.arrivalTime ?? null;
      if (updates.departureTime !== undefined) payload.departure_time = updates.departureTime ?? null;
      if (updates.jointsCount !== undefined) payload.joints_count = updates.jointsCount ?? null;
      if (updates.totalLengthFt !== undefined) payload.total_length_ft = updates.totalLengthFt ?? null;
      if (updates.manifestReceived !== undefined) payload.manifest_received = updates.manifestReceived ?? null;
      if (updates.notes !== undefined) payload.notes = updates.notes ?? null;

      const { data, error } = await supabase
        .from('shipment_trucks')
        .update(payload)
        .eq('id', id)
        .select('*')
        .single();

      if (error) throw error;
      return mapShipmentTruckRow(data as ShipmentTruckRow);
    },
    onSuccess: (truck, variables) => {
      const shipmentContextId = variables?.shipmentId ?? truck.shipmentId;
      invalidateShipmentCache(queryClient, { id: shipmentContextId });
    },
  });
}

export function useDeleteShipmentTruck() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, shipmentId }: DeleteShipmentTruckInput) => {
      const { error } = await supabase
        .from('shipment_trucks')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return shipmentId;
    },
    onSuccess: (shipmentId) => {
      invalidateShipmentCache(queryClient, { id: shipmentId });
    },
  });
}

export function useCreateDockAppointment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateDockAppointmentInput) => {
      const { data, error } = await supabase
        .from('dock_appointments')
        .insert({
          shipment_id: input.shipmentId,
          truck_id: input.truckId ?? null,
          slot_start: input.slotStart,
          slot_end: input.slotEnd,
          after_hours: input.afterHours ?? false,
          surcharge_applied: input.surchargeApplied ?? false,
          status: input.status ?? 'PENDING',
          calendar_event_id: input.calendarEventId ?? null,
          calendar_sync_status: input.calendarSyncStatus ?? 'PENDING',
        })
        .select('*')
        .single();

      if (error) throw error;
      return mapDockAppointmentRow(data as DockAppointmentRow);
    },
    onSuccess: (appointment) => {
      invalidateShipmentCache(queryClient, { id: appointment.shipmentId });
    },
  });
}

export function useUpdateDockAppointment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, shipmentId, updates }: UpdateDockAppointmentInput) => {
      const payload: Record<string, unknown> = {};

      if (updates.truckId !== undefined) payload.truck_id = updates.truckId ?? null;
      if (updates.slotStart !== undefined) payload.slot_start = updates.slotStart ?? null;
      if (updates.slotEnd !== undefined) payload.slot_end = updates.slotEnd ?? null;
      if (updates.afterHours !== undefined) payload.after_hours = updates.afterHours ?? null;
      if (updates.surchargeApplied !== undefined) payload.surcharge_applied = updates.surchargeApplied ?? null;
      if (updates.status !== undefined) payload.status = updates.status;
      if (updates.calendarEventId !== undefined) payload.calendar_event_id = updates.calendarEventId ?? null;
      if (updates.calendarSyncStatus !== undefined) payload.calendar_sync_status = updates.calendarSyncStatus ?? null;
      if (updates.reminder24hSentAt !== undefined) payload.reminder_24h_sent_at = updates.reminder24hSentAt ?? null;
      if (updates.reminder1hSentAt !== undefined) payload.reminder_1h_sent_at = updates.reminder1hSentAt ?? null;

      const { data, error } = await supabase
        .from('dock_appointments')
        .update(payload)
        .eq('id', id)
        .select('*')
        .single();

      if (error) throw error;
      return mapDockAppointmentRow(data as DockAppointmentRow);
    },
    onSuccess: (appointment, variables) => {
      const shipmentContextId = variables?.shipmentId ?? appointment.shipmentId;
      invalidateShipmentCache(queryClient, { id: shipmentContextId });
    },
  });
}

export function useDeleteDockAppointment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, shipmentId }: DeleteDockAppointmentInput) => {
      const { error } = await supabase
        .from('dock_appointments')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return shipmentId;
    },
    onSuccess: (shipmentId) => {
      invalidateShipmentCache(queryClient, { id: shipmentId });
    },
  });
}

export function useAddShipmentDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateShipmentDocumentInput) => {
      const { data, error } = await supabase
        .from('shipment_documents')
        .insert({
          shipment_id: input.shipmentId,
          truck_id: input.truckId ?? null,
          document_id: input.documentId,
          document_type: input.documentType,
          status: input.status ?? 'UPLOADED',
          parsed_payload: input.parsedPayload ?? null,
          processing_notes: input.processingNotes ?? null,
          uploaded_by: input.uploadedBy ?? null,
        })
        .select('*')
        .single();

      if (error) throw error;
      return mapShipmentDocumentRow(data as ShipmentDocumentRow);
    },
    onSuccess: (document) => {
      invalidateShipmentCache(queryClient, { id: document.shipmentId });
    },
  });
}

export function useUpdateShipmentDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, shipmentId, updates }: UpdateShipmentDocumentInput) => {
      const payload: Record<string, unknown> = {};

      if (updates.truckId !== undefined) payload.truck_id = updates.truckId ?? null;
      if (updates.documentType !== undefined) payload.document_type = updates.documentType ?? null;
      if (updates.status !== undefined) payload.status = updates.status;
      if (updates.parsedPayload !== undefined) payload.parsed_payload = updates.parsedPayload ?? null;
      if (updates.processingNotes !== undefined) payload.processing_notes = updates.processingNotes ?? null;
      if (updates.uploadedBy !== undefined) payload.uploaded_by = updates.uploadedBy ?? null;
      if (updates.processedAt !== undefined) payload.processed_at = updates.processedAt ?? null;

      const { data, error } = await supabase
        .from('shipment_documents')
        .update(payload)
        .eq('id', id)
        .select('*')
        .single();

      if (error) throw error;
      return mapShipmentDocumentRow(data as ShipmentDocumentRow);
    },
    onSuccess: (document, variables) => {
      const shipmentContextId = variables?.shipmentId ?? document.shipmentId;
      invalidateShipmentCache(queryClient, { id: shipmentContextId });
    },
  });
}

export function useDeleteShipmentDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, shipmentId }: DeleteShipmentDocumentInput) => {
      const { error } = await supabase
        .from('shipment_documents')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return shipmentId;
    },
    onSuccess: (shipmentId) => {
      invalidateShipmentCache(queryClient, { id: shipmentId });
    },
  });
}

export function useAddShipmentItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateShipmentItemInput) => {
      const { data, error } = await supabase
        .from('shipment_items')
        .insert({
          shipment_id: input.shipmentId,
          truck_id: input.truckId ?? null,
          document_id: input.documentId ?? null,
          inventory_id: input.inventoryId ?? null,
          manufacturer: input.manufacturer ?? null,
          heat_number: input.heatNumber ?? null,
          serial_number: input.serialNumber ?? null,
          tally_length_ft: input.tallyLengthFt ?? null,
          quantity: input.quantity ?? null,
          status: input.status ?? 'IN_TRANSIT',
          notes: input.notes ?? null,
        })
        .select('*')
        .single();

      if (error) throw error;
      return mapShipmentItemRow(data as ShipmentItemRow);
    },
    onSuccess: (item) => {
      invalidateShipmentCache(queryClient, { id: item.shipmentId });
    },
  });
}

export function useUpdateShipmentItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, shipmentId, updates }: UpdateShipmentItemInput) => {
      const payload: Record<string, unknown> = {};

      if (updates.truckId !== undefined) payload.truck_id = updates.truckId ?? null;
      if (updates.documentId !== undefined) payload.document_id = updates.documentId ?? null;
      if (updates.inventoryId !== undefined) payload.inventory_id = updates.inventoryId ?? null;
      if (updates.manufacturer !== undefined) payload.manufacturer = updates.manufacturer ?? null;
      if (updates.heatNumber !== undefined) payload.heat_number = updates.heatNumber ?? null;
      if (updates.serialNumber !== undefined) payload.serial_number = updates.serialNumber ?? null;
      if (updates.tallyLengthFt !== undefined) payload.tally_length_ft = updates.tallyLengthFt ?? null;
      if (updates.quantity !== undefined) payload.quantity = updates.quantity ?? null;
      if (updates.status !== undefined) payload.status = updates.status;
      if (updates.notes !== undefined) payload.notes = updates.notes ?? null;

      const { data, error } = await supabase
        .from('shipment_items')
        .update(payload)
        .eq('id', id)
        .select('*')
        .single();

      if (error) throw error;
      return mapShipmentItemRow(data as ShipmentItemRow);
    },
    onSuccess: (item, variables) => {
      const shipmentContextId = variables?.shipmentId ?? item.shipmentId;
      invalidateShipmentCache(queryClient, { id: shipmentContextId });
    },
  });
}

export function useDeleteShipmentItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, shipmentId }: DeleteShipmentItemInput) => {
      const { error } = await supabase
        .from('shipment_items')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return shipmentId;
    },
    onSuccess: (shipmentId) => {
      invalidateShipmentCache(queryClient, { id: shipmentId });
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

/**
 * @deprecated REMOVED - truck_loads table dropped in migration 20251110000003
 *
 * The legacy truck_loads table has been deprecated in favor of trucking_loads.
 * Use useTruckingLoadsByRequest() instead.
 *
 * Migration: supabase/migrations/20251110000003_deprecate_truck_loads_table.sql
 *
 * These hooks are kept temporarily to prevent build errors, but will throw
 * runtime errors if called. Remove all usages and delete these hooks.
 *
 * References to remove:
 * - App.tsx line 13, 18, 36, 43 (import and usage)
 */
export function useTruckLoads() {
  return useQuery({
    queryKey: ['deprecated_truck_loads'],
    queryFn: async () => {
      throw new Error(
        'useTruckLoads() is deprecated. The truck_loads table was removed. ' +
        'Use useTruckingLoadsByRequest() with the new trucking_loads schema instead.'
      );
    },
    enabled: false, // Prevent auto-execution
  });
}

/**
 * @deprecated REMOVED - truck_loads table dropped in migration 20251110000003
 * Use useCreateTruckingLoad() instead.
 */
export function useAddTruckLoad() {
  return useMutation({
    mutationFn: async () => {
      throw new Error(
        'useAddTruckLoad() is deprecated. The truck_loads table was removed. ' +
        'Use useCreateTruckingLoad() with the new trucking_loads schema instead.'
      );
    },
  });
}

/**
 * @deprecated REMOVED - truck_loads table dropped in migration 20251110000003
 * Use useUpdateTruckingLoad() instead.
 */
export function useUpdateTruckLoad() {
  return useMutation({
    mutationFn: async () => {
      throw new Error(
        'useUpdateTruckLoad() is deprecated. The truck_loads table was removed. ' +
        'Use useUpdateTruckingLoad() with the new trucking_loads schema instead.'
      );
    },
  });
}


// ============================================================================
// TRUCKING LOADS (PIPE WORKFLOW)
// ============================================================================

export function useTruckingLoadsByRequest(requestId?: string) {
  return useQuery<TruckingLoad[]>({
    queryKey: requestId ? queryKeys.truckingLoadsByRequest(requestId) : queryKeys.truckingLoads,
    enabled: Boolean(requestId),
    queryFn: async () => {
      if (!requestId) return [];

      const { data, error } = await supabase
        .from('trucking_loads')
        .select('*, trucking_documents(*)')
        .eq('storage_request_id', requestId)
        .order('direction', { ascending: true })
        .order('sequence_number', { ascending: true });

      if (error) throw error;
      const rows = (data ?? []) as Array<TruckingLoadRow & { trucking_documents?: TruckingDocumentRow[] }>;
      return rows.map(mapTruckingLoadRow);
    },
  });
}

export function useCreateTruckingLoad() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateTruckingLoadInput) => {
      const {
        storageRequestId,
        direction,
        sequenceNumber = 1,
        status = 'NEW',
        ...rest
      } = input;

      const payload: Record<string, unknown> = {
        storage_request_id: storageRequestId,
        direction,
        sequence_number: sequenceNumber,
        status,
        scheduled_slot_start: rest.scheduledSlotStart ?? null,
        scheduled_slot_end: rest.scheduledSlotEnd ?? null,
        pickup_location: rest.pickupLocation ?? null,
        delivery_location: rest.deliveryLocation ?? null,
        asset_name: rest.assetName ?? null,
        wellpad_name: rest.wellpadName ?? null,
        well_name: rest.wellName ?? null,
        uwi: rest.uwi ?? null,
        trucking_company: rest.truckingCompany ?? null,
        contact_company: rest.contactCompany ?? null,
        contact_name: rest.contactName ?? null,
        contact_phone: rest.contactPhone ?? null,
        contact_email: rest.contactEmail ?? null,
        driver_name: rest.driverName ?? null,
        driver_phone: rest.driverPhone ?? null,
        notes: rest.notes ?? null,
        total_joints_planned: rest.totalJointsPlanned ?? null,
        total_length_ft_planned: rest.totalLengthFtPlanned ?? null,
        total_weight_lbs_planned: rest.totalWeightLbsPlanned ?? null,
      };

      const { data, error } = await supabase
        .from('trucking_loads')
        .insert(payload)
        .select('*')
        .single();

      if (error) throw error;
      return mapTruckingLoadRow(data as TruckingLoadRow);
    },
    onSuccess: (load) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.truckingLoadsByRequest(load.storageRequestId) });
    },
  });
}

export function useUpdateTruckingLoad() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, storageRequestId, updates }: UpdateTruckingLoadInput) => {
      const payload: Record<string, unknown> = {};

      if (updates.status !== undefined) payload.status = updates.status;
      if (updates.scheduledSlotStart !== undefined) payload.scheduled_slot_start = updates.scheduledSlotStart ?? null;
      if (updates.scheduledSlotEnd !== undefined) payload.scheduled_slot_end = updates.scheduledSlotEnd ?? null;
      if (updates.pickupLocation !== undefined) payload.pickup_location = updates.pickupLocation ?? null;
      if (updates.deliveryLocation !== undefined) payload.delivery_location = updates.deliveryLocation ?? null;
      if (updates.assetName !== undefined) payload.asset_name = updates.assetName ?? null;
      if (updates.wellpadName !== undefined) payload.wellpad_name = updates.wellpadName ?? null;
      if (updates.wellName !== undefined) payload.well_name = updates.wellName ?? null;
      if (updates.uwi !== undefined) payload.uwi = updates.uwi ?? null;
      if (updates.truckingCompany !== undefined) payload.trucking_company = updates.truckingCompany ?? null;
      if (updates.contactCompany !== undefined) payload.contact_company = updates.contactCompany ?? null;
      if (updates.contactName !== undefined) payload.contact_name = updates.contactName ?? null;
      if (updates.contactPhone !== undefined) payload.contact_phone = updates.contactPhone ?? null;
      if (updates.contactEmail !== undefined) payload.contact_email = updates.contactEmail ?? null;
      if (updates.driverName !== undefined) payload.driver_name = updates.driverName ?? null;
      if (updates.driverPhone !== undefined) payload.driver_phone = updates.driverPhone ?? null;
      if (updates.notes !== undefined) payload.notes = updates.notes ?? null;
      if (updates.totalJointsPlanned !== undefined) payload.total_joints_planned = updates.totalJointsPlanned ?? null;
      if (updates.totalLengthFtPlanned !== undefined) payload.total_length_ft_planned = updates.totalLengthFtPlanned ?? null;
      if (updates.totalWeightLbsPlanned !== undefined) payload.total_weight_lbs_planned = updates.totalWeightLbsPlanned ?? null;
      if (updates.totalJointsCompleted !== undefined) payload.total_joints_completed = updates.totalJointsCompleted ?? null;
      if (updates.totalLengthFtCompleted !== undefined) payload.total_length_ft_completed = updates.totalLengthFtCompleted ?? null;
      if (updates.totalWeightLbsCompleted !== undefined) payload.total_weight_lbs_completed = updates.totalWeightLbsCompleted ?? null;
      if (updates.approvedAt !== undefined) payload.approved_at = updates.approvedAt ?? null;
      if (updates.completedAt !== undefined) payload.completed_at = updates.completedAt ?? null;

      const { data, error } = await supabase
        .from('trucking_loads')
        .update(payload)
        .eq('id', id)
        .select('*')
        .single();

      if (error) throw error;
      return mapTruckingLoadRow(data as TruckingLoadRow);
    },
    onSuccess: (load, variables) => {
      const requestId = variables?.storageRequestId ?? load.storageRequestId;
      queryClient.invalidateQueries({ queryKey: queryKeys.truckingLoadsByRequest(requestId) });
    },
  });
}

export function useTruckingDocuments(truckingLoadId?: string) {
  return useQuery<TruckingDocument[]>({
    queryKey: truckingLoadId ? queryKeys.truckingDocumentsByLoad(truckingLoadId) : queryKeys.truckingDocuments,
    enabled: Boolean(truckingLoadId),
    queryFn: async () => {
      if (!truckingLoadId) return [];

      const { data, error } = await supabase
        .from('trucking_documents')
        .select('*')
        .eq('trucking_load_id', truckingLoadId)
        .order('uploaded_at', { ascending: false });

      if (error) throw error;
      const rows = (data ?? []) as TruckingDocumentRow[];
      return rows.map(mapTruckingDocumentRow);
    },
  });
}

export function useCreateTruckingDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateTruckingDocumentInput) => {
      const payload: Record<string, unknown> = {
        trucking_load_id: input.truckingLoadId,
        file_name: input.fileName,
        storage_path: input.storagePath,
        document_type: input.documentType ?? null,
        uploaded_by: input.uploadedBy ?? null,
      };

      if (input.uploadedAt) {
        payload.uploaded_at = input.uploadedAt;
      }

      const { data, error } = await supabase
        .from('trucking_documents')
        .insert(payload)
        .select('*')
        .single();

      if (error) throw error;
      return mapTruckingDocumentRow(data as TruckingDocumentRow);
    },
    onSuccess: (document, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.truckingDocumentsByLoad(document.truckingLoadId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.requests });
      if (variables?.storageRequestId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.truckingLoadsByRequest(variables.storageRequestId) });
      }
    },
  });
}

export function useDeleteTruckingDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, truckingLoadId, storagePath }: { id: string; truckingLoadId: string; storagePath?: string }) => {
      // Delete from storage first if path provided
      if (storagePath) {
        const { error: storageError } = await supabase.storage
          .from('documents')
          .remove([storagePath]);

        if (storageError) {
          console.error('Failed to delete file from storage:', storageError);
          // Continue with database deletion even if storage fails
        }
      }

      // Delete from database
      const { error: dbError } = await supabase
        .from('trucking_documents')
        .delete()
        .eq('id', id);

      if (dbError) throw dbError;

      return { id, truckingLoadId };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.truckingDocumentsByLoad(result.truckingLoadId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.requests });
    },
  });
}



