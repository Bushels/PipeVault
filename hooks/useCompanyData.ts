/**
 * Company-Scoped Data Hooks for Admin Dashboard
 *
 * These hooks provide optimized queries for the tile-based admin interface.
 * They follow a lazy-loading pattern where:
 * 1. useCompanySummaries() loads lightweight summary cards (always)
 * 2. useCompanyDetails() loads full data only when tile is clicked
 *
 * Performance optimizations:
 * - Stale-while-revalidate caching (5 min stale time)
 * - Lazy loading of detailed data
 * - Aggregate counts via database-side computation
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { Company, StorageRequest, Pipe, TruckingLoad } from '../types';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Lightweight company summary for tile display
 * Shows counts and high-level stats without loading full data
 */
export interface CompanySummary {
  id: string;
  name: string;
  domain: string;

  // Aggregate counts (computed in database)
  totalRequests: number;
  pendingRequests: number;
  approvedRequests: number;
  rejectedRequests: number;

  totalInventoryItems: number;
  inStorageItems: number;

  totalLoads: number;
  inboundLoads: number;
  outboundLoads: number;
  newLoads: number; // Count of loads with status='NEW' awaiting admin approval

  // Most recent activity timestamp
  latestActivity?: string;

  // Requester identity from most recent storage request
  lastRequesterName?: string;
  lastRequesterEmail?: string;
}

/**
 * Full company details loaded when tile is clicked
 * Includes complete request/inventory/load data
 */
export interface CompanyDetails {
  company: Company;
  summary: CompanySummary;
  requests: StorageRequest[];
  inventory: Pipe[];
  loads: TruckingLoad[];
}

// ============================================================================
// QUERY KEYS
// ============================================================================

const companyQueryKeys = {
  summaries: ['companies', 'summaries'] as const,
  details: (companyId: string) => ['companies', 'details', companyId] as const,
  requests: (companyId: string) => ['companies', companyId, 'requests'] as const,
  inventory: (companyId: string) => ['companies', companyId, 'inventory'] as const,
  loads: (companyId: string) => ['companies', companyId, 'loads'] as const,
};

// ============================================================================
// SUMMARY QUERIES (Always loaded for tile carousel)
// ============================================================================

/**
 * Get lightweight summaries for all companies
 * Used to render the company tile carousel
 *
 * Performance: Uses optimized PostgreSQL function with CTEs
 * - Single query instead of N+1 pattern (151 queries → 1 query for 50 companies)
 * - Database-side aggregation using FILTER and window functions
 * - ~100-200ms execution time for 50 companies with 5,000 requests
 *
 * Caching: 30 second stale time for admin summaries (reduced from 5 min for faster approval updates and ghost tile removal)
 */
export function useCompanySummaries() {
  return useQuery<CompanySummary[]>({
    queryKey: companyQueryKeys.summaries,
    queryFn: async () => {
      // Call optimized PostgreSQL function with ghost filtering
      // See: supabase/migrations/20251110000006_update_company_summaries_filter_ghosts.sql
      // Filters out: admin accounts, archived companies, deleted auth users
      const { data, error } = await supabase.rpc('get_company_summaries');

      if (error) throw error;

      // Map database response to TypeScript interface
      return (data || []).map((row: any) => ({
        id: row.id,
        name: row.name,
        domain: row.domain,
        totalRequests: Number(row.total_requests),
        pendingRequests: Number(row.pending_requests),
        approvedRequests: Number(row.approved_requests),
        rejectedRequests: Number(row.rejected_requests),
        totalInventoryItems: Number(row.total_inventory_items),
        inStorageItems: Number(row.in_storage_items),
        totalLoads: Number(row.total_loads),
        inboundLoads: Number(row.inbound_loads),
        outboundLoads: Number(row.outbound_loads),
        newLoads: Number(row.new_loads),
        latestActivity: row.latest_activity || undefined,
        lastRequesterName: row.last_requester_name || undefined,
        lastRequesterEmail: row.last_requester_email || undefined,
      }));
    },
    staleTime: 30 * 1000, // 30 seconds (reduced for faster admin approval updates)
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });
}

// ============================================================================
// DETAIL QUERIES (Lazy-loaded when tile clicked)
// ============================================================================

/**
 * Get full company details including all requests, inventory, and loads
 * Only called when user clicks on a company tile
 *
 * Performance: Uses existing hooks to leverage React Query cache
 * Caching: Data stays fresh for 3 minutes after loading
 */
export function useCompanyDetails(companyId?: string) {
  return useQuery<CompanyDetails | null>({
    queryKey: companyId ? companyQueryKeys.details(companyId) : ['companies', 'details', 'null'],
    enabled: !!companyId, // Only run query if companyId is provided
    queryFn: async () => {
      console.log('[useCompanyDetails] Fetching data for companyId:', companyId);
      if (!companyId) return null;

      // Fetch company info
      const { data: company, error: companyError } = await supabase
        .from('companies')
        .select('*')
        .eq('id', companyId)
        .single();

      if (companyError) throw companyError;

      // Fetch all requests with trucking loads
      // Note: Using !trucking_documents_trucking_load_id_fkey to reference the correct foreign key
      const { data: requestsRaw, error: requestsError } = await supabase
        .from('storage_requests')
        .select(`
          *,
          trucking_loads(
            *,
            trucking_documents!trucking_documents_trucking_load_id_fkey(*)
          )
        `)
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });

      if (requestsError) throw requestsError;

      // Fetch all inventory
      const { data: inventoryRaw, error: inventoryError } = await supabase
        .from('inventory')
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });

      if (inventoryError) throw inventoryError;

      // Map database rows to application types
      const requests: StorageRequest[] = requestsRaw.map((row: any) => ({
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
        requestDetails: row.request_details,
        truckingInfo: row.trucking_info,
        assignedLocation: row.assigned_location || undefined,
        assignedRackIds: row.assigned_rack_ids || undefined,
        approvalSummary: row.approval_summary || undefined,
        rejectionReason: row.rejection_reason || undefined,
        truckingLoads: (row.trucking_loads || []).map((load: any) => ({
          id: load.id,
          storageRequestId: load.storage_request_id,
          direction: load.direction,
          sequenceNumber: load.sequence_number,
          status: load.status,
          scheduledSlotStart: load.scheduled_slot_start || undefined,
          scheduledSlotEnd: load.scheduled_slot_end || undefined,
          pickupLocation: load.pickup_location,
          deliveryLocation: load.delivery_location,
          assetName: load.asset_name,
          wellpadName: load.wellpad_name,
          wellName: load.well_name,
          uwi: load.uwi,
          truckingCompany: load.trucking_company,
          contactCompany: load.contact_company,
          contactName: load.contact_name,
          contactPhone: load.contact_phone,
          contactEmail: load.contact_email,
          driverName: load.driver_name,
          driverPhone: load.driver_phone,
          notes: load.notes,
          totalJointsPlanned: load.total_joints_planned,
          totalLengthFtPlanned: load.total_length_ft_planned,
          totalWeightLbsPlanned: load.total_weight_lbs_planned,
          totalJointsCompleted: load.total_joints_completed,
          totalLengthFtCompleted: load.total_length_ft_completed,
          totalWeightLbsCompleted: load.total_weight_lbs_completed,
          approvedAt: load.approved_at,
          completedAt: load.completed_at,
          createdAt: load.created_at,
          updatedAt: load.updated_at,
          documents: (load.trucking_documents || []).map((doc: any) => ({
            id: doc.id,
            truckingLoadId: doc.trucking_load_id,
            fileName: doc.file_name,
            storagePath: doc.storage_path,
            documentType: doc.document_type,
            uploadedBy: doc.uploaded_by,
            uploadedAt: doc.uploaded_at,
            parsedPayload: doc.parsed_payload,
          })),
        })),
      }));

      const inventory: Pipe[] = inventoryRaw.map((row: any) => ({
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
      }));

      // Collect all loads from all requests
      const loads: TruckingLoad[] = requests.flatMap(r => r.truckingLoads || []);

      // Calculate summary stats
      const summary: CompanySummary = {
        id: company.id,
        name: company.name,
        domain: company.domain,
        totalRequests: requests.length,
        pendingRequests: requests.filter(r => r.status === 'PENDING').length,
        approvedRequests: requests.filter(r => r.status === 'APPROVED').length,
        rejectedRequests: requests.filter(r => r.status === 'REJECTED').length,
        totalInventoryItems: inventory.length,
        inStorageItems: inventory.filter(i => i.status === 'IN_STORAGE').length,
        totalLoads: loads.length,
        inboundLoads: loads.filter(l => l.direction === 'INBOUND').length,
        outboundLoads: loads.filter(l => l.direction === 'OUTBOUND').length,
        newLoads: loads.filter(l => l.status === 'NEW').length,
        latestActivity: requests[0]?.createdAt, // Already sorted descending
      };

      const result = {
        company: {
          id: company.id,
          name: company.name,
          domain: company.domain,
        },
        summary,
        requests,
        inventory,
        loads,
      };

      console.log('[useCompanyDetails] Data fetched successfully:', {
        companyId,
        companyName: company.name,
        requestCount: requests.length,
        inventoryCount: inventory.length,
        loadCount: loads.length,
      });

      return result;
    },
    staleTime: 3 * 60 * 1000, // 3 minutes
    refetchOnWindowFocus: false, // Don't refetch when tab regains focus
  });
}

/**
 * Get pending approval count across all companies
 * Used for admin dashboard header badge
 */
export function usePendingApprovalsCount() {
  return useQuery<number>({
    queryKey: ['admin', 'pending-approvals-count'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('storage_requests')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'PENDING');

      if (error) throw error;
      return count ?? 0;
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
    refetchInterval: 5 * 60 * 1000, // Auto-refresh every 5 minutes
    refetchOnWindowFocus: true,
  });
}

/**
 * Get recent activity across all companies
 * Used for admin dashboard activity feed
 */
export interface RecentActivity {
  id: string;
  type: 'request_created' | 'request_approved' | 'load_booked' | 'inventory_added';
  companyId: string;
  companyName: string;
  timestamp: string;
  description: string;
  referenceId?: string;
}

export function useRecentActivity(limit: number = 10) {
  return useQuery<RecentActivity[]>({
    queryKey: ['admin', 'recent-activity', limit],
    queryFn: async () => {
      // Fetch recent requests with company info
      const { data: requests, error: requestsError } = await supabase
        .from('storage_requests')
        .select(`
          id,
          status,
          reference_id,
          created_at,
          approved_at,
          company_id,
          companies(name)
        `)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (requestsError) throw requestsError;

      // Transform to activity items
      const activities: RecentActivity[] = requests.map((req: any) => {
        const isApproved = req.status === 'APPROVED' && req.approved_at;
        return {
          id: req.id,
          type: isApproved ? 'request_approved' : 'request_created',
          companyId: req.company_id,
          companyName: req.companies?.name || 'Unknown Company',
          timestamp: isApproved ? req.approved_at : req.created_at,
          description: isApproved
            ? `Storage request ${req.reference_id} approved`
            : `New storage request ${req.reference_id} submitted`,
          referenceId: req.reference_id,
        };
      });

      // Sort by timestamp descending
      activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      return activities.slice(0, limit);
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
    refetchInterval: 5 * 60 * 1000, // Auto-refresh every 5 minutes
  });
}
