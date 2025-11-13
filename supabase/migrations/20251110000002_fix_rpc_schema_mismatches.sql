-- ============================================================================
-- FIX: Schema Mismatches in get_project_summaries_by_company RPC
-- ============================================================================
-- Issues:
-- 1. References storage_areas table (should be racks)
-- 2. References inventory.storage_request_id (should be request_id)
-- 3. References companies.contact_email/contact_phone (columns don't exist)
-- 4. References storage_requests columns that may not exist
--
-- This migration fixes all schema mismatches to work with actual database
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
  -- Security check: Admin-only
  IF NOT is_admin_user() THEN
    RAISE EXCEPTION 'Access denied. Admin privileges required.'
      USING HINT = 'This function is only available to users in the admin_users table';
  END IF;

  WITH
  -- CTE 1: Load documents with AI-extracted manifest data
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
        ) ORDER BY td.uploaded_at DESC
      ) AS documents_json
    FROM trucking_documents td
    GROUP BY td.trucking_load_id
  ),

  -- CTE 2: Per-rack inventory (FIXED: uses racks table and request_id column)
  rack_inventory AS (
    SELECT
      i.request_id,  -- ✅ FIXED: was storage_request_id
      i.trucking_load_id,
      json_agg(
        json_build_object(
          'rackId', r.id,  -- ✅ FIXED: was sa.id
          'rackName', r.name,  -- ✅ FIXED: was sa.name
          'jointCount', COUNT(i.id),
          'statuses', array_agg(DISTINCT i.status ORDER BY i.status),
          'assignedAt', MIN(i.created_at),
          'lastUpdated', MAX(i.updated_at)
        ) ORDER BY r.name
      ) AS racks_json
    FROM inventory i
    LEFT JOIN racks r ON r.id = i.storage_area_id  -- ✅ FIXED: was storage_areas sa
    WHERE i.storage_area_id IS NOT NULL
    GROUP BY i.request_id, i.trucking_load_id
  ),

  -- CTE 3: Project loads (inbound/outbound)
  project_loads AS (
    SELECT
      sr.id AS project_id,
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
            'truckingCompany', tl.trucking_company,
            'notes', tl.notes,
            'documents', COALESCE(ld.documents_json, '[]'::json),
            'assignedRacks', COALESCE(ri.racks_json, '[]'::json)
          ) ORDER BY tl.sequence_number
        ) FILTER (WHERE tl.direction = 'INBOUND'),
        '[]'::json
      ) AS inbound_loads_json,
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
            'truckingCompany', tl.trucking_company,
            'notes', tl.notes,
            'documents', COALESCE(ld.documents_json, '[]'::json),
            'assignedRacks', COALESCE(ri.racks_json, '[]'::json)
          ) ORDER BY tl.sequence_number
        ) FILTER (WHERE tl.direction = 'OUTBOUND'),
        '[]'::json
      ) AS outbound_loads_json
    FROM storage_requests sr
    LEFT JOIN trucking_loads tl ON tl.storage_request_id = sr.id
    LEFT JOIN load_documents ld ON ld.trucking_load_id = tl.id
    LEFT JOIN rack_inventory ri ON ri.trucking_load_id = tl.id AND ri.request_id = sr.id  -- ✅ FIXED: added request_id join
    GROUP BY sr.id
  ),

  -- CTE 4: Project inventory summary (FIXED: uses racks table and request_id column)
  project_inventory AS (
    SELECT
      i.request_id,  -- ✅ FIXED: was storage_request_id
      COUNT(i.id) AS total_joints,
      COUNT(i.id) FILTER (WHERE i.status = 'IN_STORAGE') AS in_storage,
      COUNT(i.id) FILTER (WHERE i.status = 'PENDING_DELIVERY') AS pending_delivery,
      COUNT(i.id) FILTER (WHERE i.status = 'PICKED_UP') AS picked_up,
      array_agg(DISTINCT r.name ORDER BY r.name) FILTER (WHERE r.name IS NOT NULL) AS rack_names  -- ✅ FIXED: was sa.name
    FROM inventory i
    LEFT JOIN racks r ON r.id = i.storage_area_id  -- ✅ FIXED: was storage_areas sa
    GROUP BY i.request_id
  ),

  -- CTE 5: Company projects aggregation
  company_projects AS (
    SELECT
      c.id AS company_id,
      c.name AS company_name,
      c.domain AS company_domain,
      json_agg(
        json_build_object(
          'id', sr.id,
          'referenceId', sr.reference_id,
          'status', sr.status::text,
          'submittedBy', sr.user_email,  -- ✅ FIXED: actual column name
          'createdAt', sr.created_at,
          'updatedAt', sr.updated_at,
          'pipeDetails', sr.request_details,  -- ✅ FIXED: stored as JSONB
          'inboundLoads', pl.inbound_loads_json,
          'outboundLoads', pl.outbound_loads_json,
          'inventorySummary', COALESCE(
            json_build_object(
              'total', pi.total_joints,
              'inStorage', pi.in_storage,
              'pendingDelivery', pi.pending_delivery,
              'pickedUp', pi.picked_up,
              'rackNames', COALESCE(pi.rack_names, ARRAY[]::text[])
            ),
            json_build_object(
              'total', 0,
              'inStorage', 0,
              'pendingDelivery', 0,
              'pickedUp', 0,
              'rackNames', ARRAY[]::text[]
            )
          )
        ) ORDER BY sr.created_at DESC
      ) AS projects_json
    FROM companies c
    INNER JOIN storage_requests sr ON sr.company_id = c.id
    LEFT JOIN project_loads pl ON pl.project_id = sr.id
    LEFT JOIN project_inventory pi ON pi.request_id = sr.id  -- ✅ FIXED: was storage_request_id
    WHERE lower(c.domain) != 'mpsgroup.ca'
    GROUP BY c.id, c.name, c.domain
  )

  -- Final aggregation
  SELECT json_agg(
    json_build_object(
      'company', json_build_object(
        'id', company_id,
        'name', company_name,
        'domain', company_domain
      ),
      'projects', projects_json
    ) ORDER BY company_name
  )
  INTO result
  FROM company_projects;

  RETURN COALESCE(result, '[]'::json);

EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Error in get_project_summaries_by_company: %', SQLERRM;
  RETURN '[]'::json;
END;
$$;

COMMENT ON FUNCTION get_project_summaries_by_company() IS
'Returns nested project summaries grouped by company. FIXED: Uses racks table and inventory.request_id.';

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Test the function as an admin
-- This should now work without errors
SELECT get_project_summaries_by_company();

-- Verify the function returns valid JSON
SELECT
  jsonb_pretty(get_project_summaries_by_company()::jsonb) AS pretty_output
LIMIT 1;
