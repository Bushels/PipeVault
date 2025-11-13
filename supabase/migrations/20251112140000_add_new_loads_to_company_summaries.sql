-- Migration: Add NEW Loads Count to Company Summaries
-- Purpose: Enable admin dashboard to show badge indicator for loads awaiting approval
-- Date: 2025-11-12
--
-- Changes:
-- 1. Add new_loads BIGINT to RETURNS TABLE
-- 2. Add COUNT(*) FILTER (WHERE tl.status = 'NEW') in company_load_counts CTE
-- 3. Include new_loads in final SELECT with COALESCE
--
-- Background:
-- Customer submits Load #1 (status='NEW') but admin doesn't see it needs approval.
-- Company tiles show "Loads: 5" without indicating 2 are awaiting admin action.
-- This migration adds new_loads count to enable badge indicator: "5 (2 awaiting)"

-- ============================================================================
-- Drop and Recreate Function with NEW Loads Count
-- ============================================================================

DROP FUNCTION IF EXISTS public.get_company_summaries();

CREATE OR REPLACE FUNCTION public.get_company_summaries()
RETURNS TABLE (
  id UUID,
  name TEXT,
  domain TEXT,
  total_requests BIGINT,
  pending_requests BIGINT,
  approved_requests BIGINT,
  rejected_requests BIGINT,
  total_inventory_items BIGINT,
  in_storage_items BIGINT,
  total_loads BIGINT,
  inbound_loads BIGINT,
  outbound_loads BIGINT,
  new_loads BIGINT,        -- NEW: Count of loads with status='NEW' awaiting approval
  latest_activity TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH company_request_counts AS (
    SELECT
      sr.company_id,
      COUNT(*) as total_requests,
      COUNT(*) FILTER (WHERE sr.status = 'PENDING') as pending_requests,
      COUNT(*) FILTER (WHERE sr.status = 'APPROVED') as approved_requests,
      COUNT(*) FILTER (WHERE sr.status = 'REJECTED') as rejected_requests,
      MAX(sr.created_at) as latest_activity
    FROM storage_requests sr
    GROUP BY sr.company_id
  ),
  company_inventory_counts AS (
    SELECT
      inv.company_id,
      COUNT(*) as total_inventory_items,
      COUNT(*) FILTER (WHERE inv.status = 'IN_STORAGE') as in_storage_items
    FROM inventory inv
    GROUP BY inv.company_id
  ),
  company_load_counts AS (
    SELECT
      sr.company_id,
      COUNT(*) as total_loads,
      COUNT(*) FILTER (WHERE tl.direction = 'INBOUND') as inbound_loads,
      COUNT(*) FILTER (WHERE tl.direction = 'OUTBOUND') as outbound_loads,
      COUNT(*) FILTER (WHERE tl.status = 'NEW') as new_loads  -- NEW: Count loads awaiting approval
    FROM trucking_loads tl
    JOIN storage_requests sr ON sr.id = tl.storage_request_id
    GROUP BY sr.company_id
  )
  SELECT
    c.id,
    c.name,
    c.domain,
    COALESCE(rc.total_requests, 0) as total_requests,
    COALESCE(rc.pending_requests, 0) as pending_requests,
    COALESCE(rc.approved_requests, 0) as approved_requests,
    COALESCE(rc.rejected_requests, 0) as rejected_requests,
    COALESCE(ic.total_inventory_items, 0) as total_inventory_items,
    COALESCE(ic.in_storage_items, 0) as in_storage_items,
    COALESCE(lc.total_loads, 0) as total_loads,
    COALESCE(lc.inbound_loads, 0) as inbound_loads,
    COALESCE(lc.outbound_loads, 0) as outbound_loads,
    COALESCE(lc.new_loads, 0) as new_loads,  -- NEW: Default to 0 if no loads
    rc.latest_activity
  FROM companies c
  LEFT JOIN company_request_counts rc ON rc.company_id = c.id
  LEFT JOIN company_inventory_counts ic ON ic.company_id = c.id
  LEFT JOIN company_load_counts lc ON lc.company_id = c.id
  WHERE
    -- GHOST FILTERING: Only show active customer companies
    c.is_customer = true
    AND c.is_archived = false
    AND c.deleted_at IS NULL
    AND (
      EXISTS (
        SELECT 1
        FROM storage_requests sr
        JOIN auth.users u ON u.email = sr.user_email AND u.deleted_at IS NULL
        WHERE sr.company_id = c.id
      )
      OR rc.total_requests = 0
    )
  ORDER BY c.name;
END;
$$;

-- ============================================================================
-- Grant Execute Permission
-- ============================================================================

GRANT EXECUTE ON FUNCTION public.get_company_summaries() TO authenticated;

-- ============================================================================
-- Update Function Comment
-- ============================================================================

COMMENT ON FUNCTION public.get_company_summaries() IS
  'Returns lightweight summary statistics for active customer companies only. ' ||
  'Used by admin dashboard tile carousel. ' ||
  'Includes new_loads count to show badge indicator for loads awaiting approval. ' ||
  'Filters out: ' ||
  '  - Admin accounts (is_customer = false) ' ||
  '  - Archived companies (is_archived = true) ' ||
  '  - Soft-deleted companies (deleted_at IS NOT NULL) ' ||
  '  - Companies with deleted auth users (checks auth.users.deleted_at) ' ||
  'Optimized query using CTEs to avoid N+1 pattern.';

-- ============================================================================
-- VALIDATION QUERIES (Run manually after migration)
-- ============================================================================

-- Test the function returns new_loads count
-- SELECT name, total_loads, new_loads FROM get_company_summaries();

-- Verify NEW loads are counted correctly
-- SELECT
--   c.name,
--   COUNT(*) as total_loads,
--   COUNT(*) FILTER (WHERE tl.status = 'NEW') as new_loads
-- FROM companies c
-- JOIN storage_requests sr ON sr.company_id = c.id
-- JOIN trucking_loads tl ON tl.storage_request_id = sr.id
-- WHERE c.is_customer = true
-- GROUP BY c.name;
