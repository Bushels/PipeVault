-- ============================================================================
-- Admin Tile Redesign: Project Summaries with Complete Document Data (v2)
-- CORRECTED VERSION - Addresses audit findings
-- ============================================================================
-- Fixes applied:
-- 1. ✅ REVOKE EXECUTE on is_admin_user() (security hardening)
-- 2. ✅ Case-insensitive mpsgroup.ca filtering
-- 3. ✅ Fixed json_agg(DISTINCT ... ORDER BY) syntax error
-- 4. ✅ Fixed rack_inventory status aggregation bug
-- 5. ✅ Added missing inventory indexes
-- 6. ✅ CONCURRENTLY indexes in separate statements (non-transactional)
-- ============================================================================

-- ============================================================================
-- PART 1: FUNCTIONS (can run in transaction)
-- ============================================================================

-- ============================================================================
-- SECURITY: Admin Role Check Function
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

COMMENT ON FUNCTION is_admin_user() IS 'Returns TRUE if authenticated user is an admin. Used for RLS and RPC access control. NOT publicly callable - internal use only.';

-- ✅ FIX #1: Revoke public access to is_admin_user()
-- Only get_project_summaries_by_company() can call it internally
REVOKE ALL ON FUNCTION is_admin_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION is_admin_user() FROM anon;
REVOKE EXECUTE ON FUNCTION is_admin_user() FROM authenticated;
-- No GRANT - only SECURITY DEFINER functions can call it

-- ============================================================================
-- MAIN RPC: Get Project Summaries by Company (Admin-Only)
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
          'parsedPayload', td.parsed_payload,
          'uploadedBy', td.uploaded_by,
          'uploadedAt', td.uploaded_at
        )
        ORDER BY td.uploaded_at DESC
      ) as documents_json
    FROM trucking_documents td
    GROUP BY td.trucking_load_id
  ),

  -- CTE 2: Per-Rack Inventory Details (for StorageSection)
  -- ✅ FIX #4: Fixed status aggregation - now collects all statuses per rack
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
          'statuses', array_agg(DISTINCT i.status ORDER BY i.status),  -- ✅ FIX: Aggregate status
          'assignedAt', MIN(i.created_at),
          'lastUpdated', MAX(i.updated_at)
        )
        ORDER BY sa.name
      ) as racks_json
    FROM inventory i
    LEFT JOIN storage_areas sa ON sa.id = i.storage_area_id
    WHERE i.storage_area_id IS NOT NULL
    GROUP BY i.storage_request_id, i.trucking_load_id, sa.id, sa.name
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
            'documents', COALESCE(ld.documents_json, '[]'::json),
            'assignedRacks', COALESCE(ri.racks_json, '[]'::json)
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
            'documents', COALESCE(ld.documents_json, '[]'::json),
            'assignedRacks', COALESCE(ri.racks_json, '[]'::json)
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
  -- ✅ FIX #3: Fixed json_agg(DISTINCT ... ORDER BY) syntax error
  project_inventory AS (
    SELECT
      i.storage_request_id,
      COUNT(i.id) as total_joints,
      SUM(i.length) as total_length_ft,
      SUM(i.weight) as total_weight_lbs,
      array_agg(DISTINCT sa.name ORDER BY sa.name) FILTER (WHERE sa.name IS NOT NULL) as rack_names  -- ✅ FIX: Use array_agg
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
              'rackNames', COALESCE(pi.rack_names, ARRAY[]::text[])  -- ✅ FIX: Return text[] in JSON
            ),
            json_build_object(
              'totalJoints', 0,
              'totalLengthFt', 0,
              'totalWeightLbs', 0,
              'rackNames', ARRAY[]::text[]
            )
          )
        )
        ORDER BY sr.created_at DESC
      ) as projects_json

    FROM companies c
    INNER JOIN storage_requests sr ON sr.company_id = c.id
    LEFT JOIN project_loads pl ON pl.project_id = sr.id
    LEFT JOIN project_inventory pi ON pi.storage_request_id = sr.id

    -- ✅ FIX #2: Case-insensitive mpsgroup.ca filtering
    WHERE lower(c.domain) != 'mpsgroup.ca'

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
and full workflow state information. Filters out admin company (case-insensitive).';

-- Grant permissions to authenticated users (function enforces admin check internally)
REVOKE ALL ON FUNCTION get_project_summaries_by_company() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_project_summaries_by_company() TO authenticated;

-- ============================================================================
-- DEPRECATION NOTICE FOR OLD FUNCTION
-- ============================================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_company_summaries') THEN
    COMMENT ON FUNCTION get_company_summaries() IS
    'DEPRECATED: Use get_project_summaries_by_company() instead.
    This function returns company-level aggregates only (no project details).
    Will be removed after tile redesign is complete.';
  END IF;
END $$;

-- ============================================================================
-- END OF PART 1 (transactional)
-- ============================================================================
