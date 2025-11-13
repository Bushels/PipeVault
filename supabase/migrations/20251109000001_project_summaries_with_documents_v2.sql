-- ============================================================================
-- Admin Tile Redesign: Project Summaries with Complete Document Data (v2)
-- ============================================================================
-- This migration addresses the critical gaps identified in code review:
-- 1. ✅ Include complete document data (parsed_payload, file paths, MIME types)
-- 2. ✅ Include per-rack inventory details for StorageSection
-- 3. ✅ Add admin-only security (role-based access control)
-- 4. ✅ Use CONCURRENTLY for index creation (non-blocking)
--
-- Replaces: 20251108000001_add_project_summaries_function.sql
-- ============================================================================

-- ============================================================================
-- SECURITY: Admin Role Check Function
-- ============================================================================
-- This function checks if the authenticated user is an admin
-- Returns TRUE only if user is in admin_users table
-- Used by get_project_summaries_by_company() for access control
-- ============================================================================

CREATE OR REPLACE FUNCTION is_admin_user()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if current user is in admin_users table
  RETURN EXISTS (
    SELECT 1
    FROM admin_users
    WHERE user_id = auth.uid()
  );
END;
$$;

COMMENT ON FUNCTION is_admin_user() IS 'Returns TRUE if authenticated user is an admin. Used for RLS and RPC access control.';

-- ============================================================================
-- MAIN RPC: Get Project Summaries by Company (Admin-Only)
-- ============================================================================
-- Returns project-level data grouped by company for admin tile UI
--
-- Key Features:
-- - Admin-only access (checks is_admin_user())
-- - Filters out admin company (mpsgroup.ca)
-- - Nested document data with parsed_payload for ManifestDataDisplay
-- - Per-rack inventory details for StorageSection
-- - Performance-optimized with CTEs and indexes
--
-- Returns structure:
-- [
--   {
--     company: { id, name, domain, contact_email, contact_phone },
--     projects: [
--       {
--         id, referenceId, status, submittedBy, contactEmail, contactPhone,
--         pipeDetails: { type, grade, outerDiameter, ... },
--         inboundLoads: [
--           {
--             id, sequenceNumber, status, dates, joints, weight,
--             documents: [
--               { id, fileName, storagePath, documentType, parsedPayload, uploadedAt }
--             ],
--             assignedRacks: [{ rackId, rackName, jointCount, status, assignedAt }]
--           }
--         ],
--         outboundLoads: [...],
--         inventorySummary: { totalJoints, totalLengthFt, racks: [...] }
--       }
--     ]
--   }
-- ]
-- ============================================================================

CREATE OR REPLACE FUNCTION get_project_summaries_by_company()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSON;
BEGIN
  -- ============================================================================
  -- SECURITY CHECK: Admin-only access
  -- ============================================================================
  IF NOT is_admin_user() THEN
    RAISE EXCEPTION 'Access denied. Admin privileges required.'
      USING HINT = 'This function is only available to users in the admin_users table';
  END IF;

  -- ============================================================================
  -- QUERY: Build nested company → project → load → document structure
  -- ============================================================================
  WITH

  -- CTE 1: Load Documents (with full manifest data)
  load_documents AS (
    SELECT
      td.trucking_load_id,
      json_agg(
        json_build_object(
          'id', td.id,
          'fileName', td.file_name,
          'storagePath', td.storage_path,
          'documentType', td.document_type,
          'parsedPayload', td.parsed_payload,  -- ✅ FIX #1: Include full manifest data
          'uploadedBy', td.uploaded_by,
          'uploadedAt', td.uploaded_at
        )
        ORDER BY td.uploaded_at DESC
      ) as documents_json
    FROM trucking_documents td
    GROUP BY td.trucking_load_id
  ),

  -- CTE 2: Per-Rack Inventory Details (for StorageSection)
  rack_inventory AS (
    SELECT
      i.storage_request_id,
      i.trucking_load_id,
      json_agg(
        json_build_object(
          'rackId', sa.id,
          'rackName', sa.name,
          'jointCount', COUNT(i.id),
          'totalLengthFt', SUM(i.length),
          'totalWeightLbs', SUM(i.weight),
          'status', i.status,
          'assignedAt', MIN(i.created_at),
          'lastUpdated', MAX(i.updated_at)
        )
        ORDER BY sa.name
      ) as racks_json
    FROM inventory i
    LEFT JOIN storage_areas sa ON sa.id = i.storage_area_id
    WHERE i.storage_area_id IS NOT NULL  -- Only inventory that's been assigned to racks
    GROUP BY i.storage_request_id, i.trucking_load_id
  ),

  -- CTE 3: Project Loads (inbound + outbound with nested documents)
  project_loads AS (
    SELECT
      sr.id as project_id,

      -- Inbound loads with full document data
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
            'documents', COALESCE(ld.documents_json, '[]'::json),  -- ✅ FIX #1: Full document array
            'assignedRacks', COALESCE(ri.racks_json, '[]'::json)   -- ✅ FIX #2: Per-rack inventory
          )
          ORDER BY tl.sequence_number
        ) FILTER (WHERE tl.direction = 'INBOUND'),
        '[]'::json
      ) as inbound_loads_json,

      -- Outbound loads with full document data
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
            'documents', COALESCE(ld.documents_json, '[]'::json),  -- ✅ FIX #1: Full document array
            'assignedRacks', COALESCE(ri.racks_json, '[]'::json)   -- ✅ FIX #2: Per-rack inventory
          )
          ORDER BY tl.sequence_number
        ) FILTER (WHERE tl.direction = 'OUTBOUND'),
        '[]'::json
      ) as outbound_loads_json

    FROM storage_requests sr
    LEFT JOIN trucking_loads tl ON tl.storage_request_id = sr.id
    LEFT JOIN load_documents ld ON ld.trucking_load_id = tl.id
    LEFT JOIN rack_inventory ri ON ri.trucking_load_id = tl.id
    GROUP BY sr.id
  ),

  -- CTE 4: Overall Inventory Summary (aggregated across all racks)
  project_inventory AS (
    SELECT
      i.storage_request_id,
      COUNT(i.id) as total_joints,
      SUM(i.length) as total_length_ft,
      SUM(i.weight) as total_weight_lbs,
      json_agg(DISTINCT sa.name ORDER BY sa.name) FILTER (WHERE sa.name IS NOT NULL) as rack_names
    FROM inventory i
    LEFT JOIN storage_areas sa ON sa.id = i.storage_area_id
    WHERE i.status = 'IN_STORAGE'
    GROUP BY i.storage_request_id
  ),

  -- CTE 5: Company Projects (group all projects by company)
  company_projects AS (
    SELECT
      c.id as company_id,
      c.name as company_name,
      c.domain as company_domain,
      c.contact_email as company_contact_email,
      c.contact_phone as company_contact_phone,

      -- Build array of all projects for this company
      json_agg(
        json_build_object(
          'id', sr.id,
          'referenceId', sr.reference_id,
          'status', sr.status,
          'submittedBy', sr.submitted_by,
          'contactEmail', sr.contact_email,
          'contactPhone', sr.contact_phone,
          'createdAt', sr.created_at,
          'updatedAt', sr.updated_at,

          -- Pipe request details (original submission)
          'pipeDetails', json_build_object(
            'pipeType', sr.pipe_type,
            'pipeGrade', sr.pipe_grade,
            'outerDiameter', sr.outer_diameter,
            'connectionType', sr.connection_type,
            'totalJointsEstimate', sr.total_joints_estimate,
            'storageStartDate', sr.storage_start_date,
            'estimatedDuration', sr.estimated_duration_months,
            'specialHandling', sr.special_handling_requirements
          ),

          -- Load arrays with nested documents
          'inboundLoads', pl.inbound_loads_json,
          'outboundLoads', pl.outbound_loads_json,

          -- Inventory summary
          'inventorySummary', COALESCE(
            json_build_object(
              'totalJoints', pi.total_joints,
              'totalLengthFt', pi.total_length_ft,
              'totalWeightLbs', pi.total_weight_lbs,
              'rackNames', pi.rack_names
            ),
            json_build_object(
              'totalJoints', 0,
              'totalLengthFt', 0,
              'totalWeightLbs', 0,
              'rackNames', '[]'::json
            )
          )
        )
        ORDER BY sr.created_at DESC  -- Most recent projects first
      ) as projects_json

    FROM companies c
    INNER JOIN storage_requests sr ON sr.company_id = c.id
    LEFT JOIN project_loads pl ON pl.project_id = sr.id
    LEFT JOIN project_inventory pi ON pi.storage_request_id = sr.id

    -- ✅ FIX #3: Filter out admin company (mpsgroup.ca)
    WHERE c.domain != 'mpsgroup.ca'

    GROUP BY c.id, c.name, c.domain, c.contact_email, c.contact_phone
  )

  -- Final output: Array of companies with nested projects
  SELECT json_agg(
    json_build_object(
      'company', json_build_object(
        'id', company_id,
        'name', company_name,
        'domain', company_domain,
        'contactEmail', company_contact_email,
        'contactPhone', company_contact_phone
      ),
      'projects', projects_json
    )
    ORDER BY company_name
  )
  INTO result
  FROM company_projects;

  RETURN COALESCE(result, '[]'::json);

EXCEPTION
  WHEN OTHERS THEN
    -- Log error and return empty array (graceful degradation)
    RAISE WARNING 'Error in get_project_summaries_by_company: %', SQLERRM;
    RETURN '[]'::json;
END;
$$;

COMMENT ON FUNCTION get_project_summaries_by_company() IS
'Admin-only function that returns project-level data grouped by company.
Includes complete document data with parsed manifests, per-rack inventory details,
and full workflow state information. Filters out admin company (mpsgroup.ca).';

-- ============================================================================
-- PERFORMANCE INDEXES (with CONCURRENTLY to avoid blocking)
-- ============================================================================
-- ✅ FIX #4: Use CREATE INDEX CONCURRENTLY to avoid production table locks
-- ============================================================================

-- Drop old indexes if they exist (from previous migration)
DROP INDEX IF EXISTS idx_trucking_loads_request CASCADE;
DROP INDEX IF EXISTS idx_trucking_loads_direction CASCADE;
DROP INDEX IF EXISTS idx_inventory_request CASCADE;
DROP INDEX IF EXISTS idx_inventory_status CASCADE;
DROP INDEX IF EXISTS idx_trucking_documents_load CASCADE;

-- Recreate with CONCURRENTLY (safe for production)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_trucking_loads_request
  ON trucking_loads(storage_request_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_trucking_loads_direction
  ON trucking_loads(direction)
  WHERE direction IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_inventory_request
  ON inventory(storage_request_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_inventory_status
  ON inventory(status)
  WHERE status = 'IN_STORAGE';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_trucking_documents_load
  ON trucking_documents(trucking_load_id);

-- Additional index for document type filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_trucking_documents_type
  ON trucking_documents(document_type)
  WHERE document_type IS NOT NULL;

-- Index for parsed_payload queries (manifest searches)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_trucking_documents_has_manifest
  ON trucking_documents(trucking_load_id)
  WHERE parsed_payload IS NOT NULL;

-- ============================================================================
-- GRANT PERMISSIONS (Admin-only access)
-- ============================================================================
-- Only grant EXECUTE to authenticated users
-- Function itself checks is_admin_user() and raises exception for non-admins
-- ============================================================================

REVOKE ALL ON FUNCTION get_project_summaries_by_company() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_project_summaries_by_company() TO authenticated;

-- ============================================================================
-- DEPRECATION NOTICE FOR OLD FUNCTION
-- ============================================================================

COMMENT ON FUNCTION get_company_summaries() IS
'DEPRECATED: Use get_project_summaries_by_company() instead.
This function returns company-level aggregates only (no project details).
Will be removed after tile redesign is complete.';

-- ============================================================================
-- TESTING QUERIES
-- ============================================================================

-- Test 1: Verify admin check works
-- SELECT is_admin_user();  -- Should return TRUE for admins, FALSE for customers

-- Test 2: Verify function returns data (admin only)
-- SELECT get_project_summaries_by_company();

-- Test 3: Verify mpsgroup.ca is filtered out
-- SELECT json_array_length(get_project_summaries_by_company()::json);

-- Test 4: Check document data structure
-- SELECT
--   p->>'referenceId' as ref,
--   jsonb_array_length((p->'inboundLoads')::jsonb) as inbound_count,
--   (p->'inboundLoads'->0->'documents')::jsonb as first_load_docs
-- FROM json_array_elements(get_project_summaries_by_company()::json) AS companies,
--      json_array_elements(companies->'projects') AS p
-- LIMIT 5;

-- ============================================================================
-- ROLLBACK PLAN
-- ============================================================================

-- To rollback this migration:
-- 1. DROP FUNCTION get_project_summaries_by_company() CASCADE;
-- 2. DROP FUNCTION is_admin_user() CASCADE;
-- 3. Re-run 20251108000001_add_project_summaries_function.sql (if needed)

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
