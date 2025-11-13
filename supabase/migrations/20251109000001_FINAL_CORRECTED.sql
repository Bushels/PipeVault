-- ============================================================================
-- FINAL CORRECTED VERSION - All Column Name Issues Fixed
-- ============================================================================
-- Critical fix: inventory.request_id (NOT storage_request_id)
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
  RETURN EXISTS (
    SELECT 1
    FROM admin_users
    WHERE user_id = auth.uid()
  );
END;
$$;

COMMENT ON FUNCTION is_admin_user() IS 'Returns TRUE if authenticated user is an admin. Internal use only.';

-- Security: Not publicly callable
REVOKE ALL ON FUNCTION is_admin_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION is_admin_user() FROM anon;
REVOKE EXECUTE ON FUNCTION is_admin_user() FROM authenticated;

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
  IF NOT is_admin_user() THEN
    RAISE EXCEPTION 'Access denied. Admin privileges required.'
      USING HINT = 'This function is only available to users in the admin_users table';
  END IF;

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
  -- ✅ CRITICAL FIX: inventory.request_id (not storage_request_id)
  rack_inventory AS (
    SELECT
      i.request_id,           -- ✅ FIXED
      i.trucking_load_id,
      json_agg(
        json_build_object(
          'rackId', sa.id,
          'rackName', sa.name,
          'jointCount', COUNT(i.id),
          'totalLengthFt', SUM(i.length),
          'totalWeightLbs', SUM(i.weight),
          'statuses', array_agg(DISTINCT i.status ORDER BY i.status),
          'assignedAt', MIN(i.created_at),
          'lastUpdated', MAX(i.updated_at)
        )
        ORDER BY sa.name
      ) as racks_json
    FROM inventory i
    LEFT JOIN storage_areas sa ON sa.id = i.storage_area_id
    WHERE i.storage_area_id IS NOT NULL
    GROUP BY i.request_id, i.trucking_load_id, sa.id, sa.name  -- ✅ FIXED
  ),

  -- CTE 3: Project Loads (inbound + outbound with nested documents)
  project_loads AS (
    SELECT
      sr.id as project_id,

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
    LEFT JOIN rack_inventory ri ON ri.request_id = sr.id AND ri.trucking_load_id = tl.id  -- ✅ FIXED
    GROUP BY sr.id
  ),

  -- CTE 4: Overall Inventory Summary (aggregated across all racks)
  -- ✅ CRITICAL FIX: inventory.request_id (not storage_request_id)
  project_inventory AS (
    SELECT
      i.request_id,           -- ✅ FIXED
      COUNT(i.id) as total_joints,
      SUM(i.length) as total_length_ft,
      SUM(i.weight) as total_weight_lbs,
      array_agg(DISTINCT sa.name ORDER BY sa.name) FILTER (WHERE sa.name IS NOT NULL) as rack_names
    FROM inventory i
    LEFT JOIN storage_areas sa ON sa.id = i.storage_area_id
    WHERE i.status = 'IN_STORAGE'
    GROUP BY i.request_id     -- ✅ FIXED
  ),

  -- CTE 5: Company Projects (group all projects by company)
  company_projects AS (
    SELECT
      c.id as company_id,
      c.name as company_name,
      c.domain as company_domain,
      c.contact_email as company_contact_email,
      c.contact_phone as company_contact_phone,

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

          'inboundLoads', pl.inbound_loads_json,
          'outboundLoads', pl.outbound_loads_json,

          'inventorySummary', COALESCE(
            json_build_object(
              'totalJoints', pi.total_joints,
              'totalLengthFt', pi.total_length_ft,
              'totalWeightLbs', pi.total_weight_lbs,
              'rackNames', COALESCE(pi.rack_names, ARRAY[]::text[])
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
    LEFT JOIN project_inventory pi ON pi.request_id = sr.id  -- ✅ FIXED
    WHERE lower(c.domain) != 'mpsgroup.ca'
    GROUP BY c.id, c.name, c.domain, c.contact_email, c.contact_phone
  )

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
    RAISE WARNING 'Error in get_project_summaries_by_company: %', SQLERRM;
    RETURN '[]'::json;
END;
$$;

COMMENT ON FUNCTION get_project_summaries_by_company() IS
'Admin-only function that returns project-level data grouped by company.';

REVOKE ALL ON FUNCTION get_project_summaries_by_company() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_project_summaries_by_company() TO authenticated;

-- Deprecate old function
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_company_summaries') THEN
    COMMENT ON FUNCTION get_company_summaries() IS 'DEPRECATED: Use get_project_summaries_by_company() instead.';
  END IF;
END $$;
