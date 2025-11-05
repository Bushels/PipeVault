-- Migration: Remove SECURITY DEFINER from views
-- Purpose: Fix security issue - views bypass RLS with SECURITY DEFINER
-- Date: 2025-11-05
--
-- Security Advisory: Views with SECURITY DEFINER execute with creator's permissions,
-- bypassing RLS policies. This can expose data that should be restricted.
--
-- Solution: Recreate views without SECURITY DEFINER so they respect RLS policies
-- on underlying tables (inventory, storage_requests, racks, etc.)

-- ============================================================================
-- 1. Recreate inventory_summary view without SECURITY DEFINER
-- ============================================================================

DROP VIEW IF EXISTS inventory_summary;

CREATE VIEW inventory_summary AS
SELECT
  i.company_id,
  c.name AS company_name,
  i.reference_id,
  count(*) AS pipe_groups,
  sum(i.quantity) AS total_joints,
  sum(i.quantity::numeric * i.length) AS total_length_meters,
  count(*) FILTER (WHERE i.status = 'IN_STORAGE'::pipe_status) AS active_groups,
  sum(i.quantity) FILTER (WHERE i.status = 'IN_STORAGE'::pipe_status) AS active_joints
FROM inventory i
JOIN companies c ON i.company_id = c.id
GROUP BY i.company_id, c.name, i.reference_id;

COMMENT ON VIEW inventory_summary IS
'Aggregates inventory data by company - respects RLS policies on inventory and companies tables';

-- ============================================================================
-- 2. Recreate yard_capacity view without SECURITY DEFINER
-- ============================================================================

DROP VIEW IF EXISTS yard_capacity;

CREATE VIEW yard_capacity AS
SELECT
  y.id AS yard_id,
  y.name AS yard_name,
  ya.id AS area_id,
  ya.name AS area_name,
  count(r.id) AS total_racks,
  sum(r.capacity) AS total_capacity_joints,
  sum(r.occupied) AS total_occupied_joints,
  sum(r.capacity_meters) AS total_capacity_meters,
  sum(r.occupied_meters) AS total_occupied_meters,
  round(
    (sum(r.occupied)::numeric / NULLIF(sum(r.capacity), 0)::numeric) * 100,
    2
  ) AS occupancy_percentage
FROM yards y
JOIN yard_areas ya ON y.id = ya.yard_id
JOIN racks r ON ya.id = r.area_id
GROUP BY y.id, y.name, ya.id, ya.name;

COMMENT ON VIEW yard_capacity IS
'Aggregates yard capacity data - respects RLS policies on yards, yard_areas, and racks tables';

-- ============================================================================
-- 3. Recreate pending_approvals view without SECURITY DEFINER
-- ============================================================================

DROP VIEW IF EXISTS pending_approvals;

CREATE VIEW pending_approvals AS
SELECT
  sr.id,
  sr.company_id,
  sr.user_email,
  sr.reference_id,
  sr.status,
  sr.request_details,
  sr.trucking_info,
  sr.assigned_location,
  sr.assigned_rack_ids,
  sr.approval_summary,
  sr.rejection_reason,
  sr.created_at,
  sr.updated_at,
  sr.approved_at,
  sr.rejected_at,
  sr.archived_at,
  sr.approved_by,
  sr.internal_notes,
  c.name AS company_name,
  count(d.id) AS document_count
FROM storage_requests sr
JOIN companies c ON sr.company_id = c.id
LEFT JOIN documents d ON sr.id = d.request_id
WHERE sr.status = 'PENDING'::request_status
  AND sr.archived_at IS NULL  -- Don't show archived requests
GROUP BY sr.id, c.name
ORDER BY sr.created_at;

COMMENT ON VIEW pending_approvals IS
'Shows pending storage requests with company info - respects RLS policies on storage_requests, companies, and documents tables';

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Verify views were recreated successfully
SELECT
  schemaname,
  viewname,
  viewowner
FROM pg_views
WHERE schemaname = 'public'
  AND viewname IN ('inventory_summary', 'yard_capacity', 'pending_approvals')
ORDER BY viewname;

-- Check that views no longer have SECURITY DEFINER
-- (This query should return 0 rows if successful)
SELECT
  n.nspname as schema,
  c.relname as view_name,
  pg_get_viewdef(c.oid) as definition
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind = 'v'
  AND n.nspname = 'public'
  AND c.relname IN ('inventory_summary', 'yard_capacity', 'pending_approvals')
  AND pg_get_viewdef(c.oid) ILIKE '%security definer%';
