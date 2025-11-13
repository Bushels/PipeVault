-- Migration: Add project-reference-centric RPC function for admin tile redesign
-- Description: Creates get_project_summaries_by_company() to replace company-level aggregates
--              with project-level details including loads, inventory, and rack assignments.
-- Author: Admin Operations Orchestrator
-- Date: 2025-11-08
-- Related: ADMIN_TILE_REDESIGN_ANALYSIS.md

-- ============================================================================
-- DROP OLD VERSION (if exists)
-- ============================================================================
DROP FUNCTION IF EXISTS get_project_summaries_by_company(TEXT);

-- ============================================================================
-- CREATE NEW FUNCTION
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_project_summaries_by_company(
  p_exclude_admin_domain TEXT DEFAULT 'mpsgroup.ca'
)
RETURNS TABLE (
  -- Company Info
  company_id UUID,
  company_name TEXT,
  company_domain TEXT,

  -- Project Info (from storage_requests)
  project_id UUID,
  reference_id TEXT,
  status TEXT,
  user_email TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  approved_by TEXT,

  -- Request Details (JSONB fields)
  request_details JSONB,
  trucking_info JSONB,
  assigned_rack_ids TEXT[],
  internal_notes TEXT,

  -- Load Counts
  total_loads BIGINT,
  inbound_load_count BIGINT,
  outbound_load_count BIGINT,
  pending_load_count BIGINT,
  completed_load_count BIGINT,

  -- Inventory Counts
  inventory_count BIGINT,
  in_storage_count BIGINT,

  -- Load Details (array of JSON objects)
  inbound_loads JSONB,
  outbound_loads JSONB,

  -- Rack Assignments
  rack_locations TEXT[]
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH project_loads AS (
    -- Aggregate load information per project
    -- Uses FILTER clause for efficient conditional counting
    SELECT
      sr.id as project_id,
      COUNT(tl.id) as total_loads,
      COUNT(tl.id) FILTER (WHERE tl.direction = 'INBOUND') as inbound_count,
      COUNT(tl.id) FILTER (WHERE tl.direction = 'OUTBOUND') as outbound_count,
      COUNT(tl.id) FILTER (WHERE tl.status IN ('NEW', 'APPROVED')) as pending_count,
      COUNT(tl.id) FILTER (WHERE tl.status = 'COMPLETED') as completed_count,

      -- Build JSON array of inbound loads with nested document counts
      -- Each load includes: id, sequence, status, dates, joints, document info
      COALESCE(
        json_agg(
          json_build_object(
            'id', tl.id,
            'sequenceNumber', tl.sequence_number,
            'status', tl.status,
            'scheduledSlotStart', tl.scheduled_slot_start,
            'scheduledSlotEnd', tl.scheduled_slot_end,
            'totalJointsPlanned', tl.total_joints_planned,
            'totalJointsCompleted', tl.total_joints_completed,
            'totalWeightLbsPlanned', tl.total_weight_lbs_planned,
            'totalWeightLbsCompleted', tl.total_weight_lbs_completed,
            'approvedAt', tl.approved_at,
            'completedAt', tl.completed_at,
            'truckingCompany', tl.trucking_company,
            'contactName', tl.contact_name,
            'contactPhone', tl.contact_phone,
            'notes', tl.notes,
            'documentCount', (
              SELECT COUNT(*)
              FROM trucking_documents td
              WHERE td.trucking_load_id = tl.id
            ),
            'hasManifest', (
              SELECT COUNT(*) > 0
              FROM trucking_documents td
              WHERE td.trucking_load_id = tl.id
                AND td.parsed_payload IS NOT NULL
            )
          )
          ORDER BY tl.sequence_number
        ) FILTER (WHERE tl.direction = 'INBOUND'),
        '[]'::json
      ) as inbound_loads_json,

      -- Build JSON array of outbound loads (same structure as inbound)
      COALESCE(
        json_agg(
          json_build_object(
            'id', tl.id,
            'sequenceNumber', tl.sequence_number,
            'status', tl.status,
            'scheduledSlotStart', tl.scheduled_slot_start,
            'scheduledSlotEnd', tl.scheduled_slot_end,
            'totalJointsPlanned', tl.total_joints_planned,
            'totalJointsCompleted', tl.total_joints_completed,
            'totalWeightLbsPlanned', tl.total_weight_lbs_planned,
            'totalWeightLbsCompleted', tl.total_weight_lbs_completed,
            'approvedAt', tl.approved_at,
            'completedAt', tl.completed_at,
            'truckingCompany', tl.trucking_company,
            'contactName', tl.contact_name,
            'contactPhone', tl.contact_phone,
            'notes', tl.notes,
            'documentCount', (
              SELECT COUNT(*)
              FROM trucking_documents td
              WHERE td.trucking_load_id = tl.id
            ),
            'hasManifest', (
              SELECT COUNT(*) > 0
              FROM trucking_documents td
              WHERE td.trucking_load_id = tl.id
                AND td.parsed_payload IS NOT NULL
            )
          )
          ORDER BY tl.sequence_number
        ) FILTER (WHERE tl.direction = 'OUTBOUND'),
        '[]'::json
      ) as outbound_loads_json

    FROM storage_requests sr
    LEFT JOIN trucking_loads tl ON tl.storage_request_id = sr.id
    GROUP BY sr.id
  ),
  project_inventory AS (
    -- Aggregate inventory information per project
    -- Includes unique rack locations for display
    SELECT
      sr.id as project_id,
      COUNT(inv.id) as inventory_count,
      COUNT(inv.id) FILTER (WHERE inv.status = 'IN_STORAGE') as in_storage_count,

      -- Get unique rack names (e.g., "A-B1-05", "A-B1-06")
      -- Uses DISTINCT to avoid duplicates from multiple inventory items in same rack
      array_agg(DISTINCT r.name) FILTER (WHERE r.name IS NOT NULL) as rack_names

    FROM storage_requests sr
    LEFT JOIN inventory inv ON inv.reference_id = sr.reference_id
    LEFT JOIN racks r ON r.id = inv.storage_area_id
    GROUP BY sr.id
  )
  SELECT
    -- Company Info
    c.id as company_id,
    c.name as company_name,
    c.domain as company_domain,

    -- Project Info
    sr.id as project_id,
    sr.reference_id,
    sr.status,
    sr.user_email,
    sr.created_at,
    sr.updated_at,
    sr.approved_at,
    sr.approved_by,

    -- Request Details
    sr.request_details,
    sr.trucking_info,
    sr.assigned_rack_ids,
    sr.internal_notes,

    -- Load Counts
    COALESCE(pl.total_loads, 0) as total_loads,
    COALESCE(pl.inbound_count, 0) as inbound_load_count,
    COALESCE(pl.outbound_count, 0) as outbound_load_count,
    COALESCE(pl.pending_count, 0) as pending_load_count,
    COALESCE(pl.completed_count, 0) as completed_load_count,

    -- Inventory Counts
    COALESCE(pi.inventory_count, 0) as inventory_count,
    COALESCE(pi.in_storage_count, 0) as in_storage_count,

    -- Load Details (nested JSON)
    pl.inbound_loads_json as inbound_loads,
    pl.outbound_loads_json as outbound_loads,

    -- Rack Assignments
    COALESCE(pi.rack_names, ARRAY[]::TEXT[]) as rack_locations

  FROM companies c
  INNER JOIN storage_requests sr ON sr.company_id = c.id
  LEFT JOIN project_loads pl ON pl.project_id = sr.id
  LEFT JOIN project_inventory pi ON pi.project_id = sr.id

  -- Filter out admin company (mpsgroup.ca by default)
  WHERE c.domain != p_exclude_admin_domain

  -- Sort by company name, then by project creation date (newest first)
  ORDER BY c.name, sr.created_at DESC;
END;
$$;

-- ============================================================================
-- PERMISSIONS
-- ============================================================================
-- Grant execute to authenticated users (RLS policies still apply)
GRANT EXECUTE ON FUNCTION public.get_project_summaries_by_company(TEXT) TO authenticated;

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================
-- These indexes optimize the JOIN queries in the RPC function

-- Index for trucking_loads JOIN
CREATE INDEX IF NOT EXISTS idx_trucking_loads_storage_request_id
ON trucking_loads(storage_request_id)
INCLUDE (direction, status, sequence_number);

-- Index for inventory JOIN (by reference_id)
CREATE INDEX IF NOT EXISTS idx_inventory_reference_id
ON inventory(reference_id)
INCLUDE (status, storage_area_id);

-- Index for companies filtering
CREATE INDEX IF NOT EXISTS idx_companies_domain
ON companies(domain);

-- Index for storage_requests ordering
CREATE INDEX IF NOT EXISTS idx_storage_requests_created_at
ON storage_requests(created_at DESC);

-- Index for trucking_documents subquery
CREATE INDEX IF NOT EXISTS idx_trucking_documents_load_id
ON trucking_documents(trucking_load_id)
WHERE parsed_payload IS NOT NULL;

-- ============================================================================
-- DOCUMENTATION
-- ============================================================================
COMMENT ON FUNCTION public.get_project_summaries_by_company(TEXT) IS
  'Returns project-level summaries for admin dashboard tile carousel. ' ||
  'Each row represents one storage_request (project reference) with nested load data. ' ||
  'Excludes admin company (mpsgroup.ca by default). ' ||
  'Optimized using CTEs and JSONB aggregation for ~200-500ms execution time. ' ||
  'Related to: ADMIN_TILE_REDESIGN_ANALYSIS.md';

-- ============================================================================
-- DEPRECATE OLD FUNCTION
-- ============================================================================
-- Mark get_company_summaries() as deprecated (keep for backward compatibility)
COMMENT ON FUNCTION public.get_company_summaries() IS
  'DEPRECATED: Use get_project_summaries_by_company() instead. ' ||
  'This function will be removed in a future release after admin tile redesign is complete.';

-- ============================================================================
-- PERFORMANCE TESTING QUERY
-- ============================================================================
-- Run this query to test performance with your actual data:
--
-- EXPLAIN ANALYZE
-- SELECT * FROM get_project_summaries_by_company();
--
-- Expected execution time: 200-500ms for 50 companies, 200 projects, 500 loads
-- If slower, check indexes and analyze table statistics
