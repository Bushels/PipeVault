-- ============================================================================
-- FIX: Approval Workflow Schema Mismatch
-- ============================================================================
-- Issue: Functions query companies.contact_email, but that column doesn't exist
-- Fix: Use storage_requests.user_email instead (which exists)
-- ============================================================================

CREATE OR REPLACE FUNCTION approve_storage_request_atomic(
  p_request_id UUID,
  p_assigned_rack_ids UUID[],
  p_required_joints INTEGER,
  p_notes TEXT DEFAULT NULL,
  p_admin_user_id TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id UUID;
  v_company_name TEXT;
  v_user_email TEXT;  -- ✅ FIXED: Changed from v_company_email
  v_reference_id TEXT;
  v_current_status TEXT;
  v_rack_record RECORD;
  v_total_capacity INTEGER := 0;
  v_total_occupied INTEGER := 0;
  v_available_capacity INTEGER := 0;
  v_rack_names TEXT[] := '{}';
  v_result JSON;
BEGIN
  -- Admin-only access
  IF NOT is_admin_user() THEN
    RAISE EXCEPTION 'Access denied. Admin privileges required.'
      USING HINT = 'Only admins can approve storage requests';
  END IF;

  -- ✅ FIXED: Query storage_requests.user_email instead of companies.contact_email
  SELECT
    sr.company_id,
    sr.reference_id,
    sr.status,
    sr.user_email,  -- ✅ FIXED: Get email from storage_requests
    c.name
  INTO
    v_company_id,
    v_reference_id,
    v_current_status,
    v_user_email,   -- ✅ FIXED: Store in v_user_email
    v_company_name
  FROM storage_requests sr
  INNER JOIN companies c ON c.id = sr.company_id
  WHERE sr.id = p_request_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Storage request not found: %', p_request_id;
  END IF;

  IF v_current_status != 'PENDING' THEN
    RAISE EXCEPTION 'Request % is not pending (current status: %)', v_reference_id, v_current_status
      USING HINT = 'Only PENDING requests can be approved';
  END IF;

  -- Validate rack capacity
  IF array_length(p_assigned_rack_ids, 1) IS NULL OR array_length(p_assigned_rack_ids, 1) = 0 THEN
    RAISE EXCEPTION 'At least one rack must be assigned'
      USING HINT = 'Provide one or more rack IDs in p_assigned_rack_ids';
  END IF;

  FOR v_rack_record IN
    SELECT sa.id, sa.name, sa.capacity, sa.occupied, (sa.capacity - sa.occupied) AS available
    FROM storage_areas sa
    WHERE sa.id = ANY(p_assigned_rack_ids)
    ORDER BY sa.name
  LOOP
    v_total_capacity := v_total_capacity + v_rack_record.capacity;
    v_total_occupied := v_total_occupied + v_rack_record.occupied;
    v_available_capacity := v_available_capacity + v_rack_record.available;
    v_rack_names := array_append(v_rack_names, v_rack_record.name);
  END LOOP;

  IF array_length(v_rack_names, 1) != array_length(p_assigned_rack_ids, 1) THEN
    RAISE EXCEPTION 'One or more rack IDs are invalid'
      USING HINT = 'Check that all rack IDs exist in storage_areas table';
  END IF;

  IF v_available_capacity < p_required_joints THEN
    RAISE EXCEPTION 'Insufficient rack capacity: % joints required, % available across racks: %',
      p_required_joints,
      v_available_capacity,
      array_to_string(v_rack_names, ', ')
      USING HINT = 'Assign additional racks or reduce required joints';
  END IF;

  -- Update request status
  UPDATE storage_requests
  SET
    status = 'APPROVED',
    assigned_rack_ids = p_assigned_rack_ids,
    admin_notes = p_notes,
    updated_at = NOW()
  WHERE id = p_request_id;

  -- Update rack occupancy
  IF array_length(p_assigned_rack_ids, 1) = 1 THEN
    UPDATE storage_areas
    SET occupied = occupied + p_required_joints, updated_at = NOW()
    WHERE id = p_assigned_rack_ids[1];
  ELSE
    DECLARE
      v_joints_per_rack INTEGER;
      v_remainder INTEGER;
      v_rack_id UUID;
      v_idx INTEGER := 1;
    BEGIN
      v_joints_per_rack := p_required_joints / array_length(p_assigned_rack_ids, 1);
      v_remainder := p_required_joints % array_length(p_assigned_rack_ids, 1);

      FOREACH v_rack_id IN ARRAY p_assigned_rack_ids
      LOOP
        UPDATE storage_areas
        SET
          occupied = occupied + v_joints_per_rack + CASE WHEN v_idx <= v_remainder THEN 1 ELSE 0 END,
          updated_at = NOW()
        WHERE id = v_rack_id;
        v_idx := v_idx + 1;
      END LOOP;
    END;
  END IF;

  -- Audit log
  INSERT INTO admin_audit_log (
    admin_user_id, action, entity_type, entity_id, details, created_at
  )
  VALUES (
    COALESCE(p_admin_user_id, auth.uid()::text),
    'APPROVE_REQUEST',
    'storage_request',
    p_request_id,
    json_build_object(
      'referenceId', v_reference_id,
      'companyName', v_company_name,
      'assignedRacks', v_rack_names,
      'requiredJoints', p_required_joints,
      'notes', p_notes
    ),
    NOW()
  );

  -- ✅ FIXED: Use v_user_email instead of v_company_email
  INSERT INTO notification_queue (
    notification_type, recipient_email, subject, payload, status, created_at
  )
  VALUES (
    'storage_request_approved',
    v_user_email,  -- ✅ FIXED: Use user's email
    'Storage Request Approved - ' || v_reference_id,
    json_build_object(
      'requestId', p_request_id,
      'referenceId', v_reference_id,
      'companyName', v_company_name,
      'assignedRacks', v_rack_names,
      'requiredJoints', p_required_joints,
      'notes', p_notes
    ),
    'PENDING',
    NOW()
  );

  -- Result
  v_result := json_build_object(
    'success', true,
    'requestId', p_request_id,
    'referenceId', v_reference_id,
    'status', 'APPROVED',
    'assignedRacks', v_rack_names,
    'requiredJoints', p_required_joints,
    'availableCapacity', v_available_capacity - p_required_joints,
    'message', format('Request %s approved successfully. Assigned to racks: %s', v_reference_id, array_to_string(v_rack_names, ', '))
  );
  RETURN v_result;

EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'Approval failed: %', SQLERRM
    USING HINT = 'All changes have been rolled back. No partial state.';
END;
$$;

-- ============================================================================
-- FIX: Rejection Function
-- ============================================================================

CREATE OR REPLACE FUNCTION reject_storage_request_atomic(
  p_request_id UUID,
  p_rejection_reason TEXT,
  p_admin_user_id TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id UUID;
  v_company_name TEXT;
  v_user_email TEXT;  -- ✅ FIXED: Changed from v_company_email
  v_reference_id TEXT;
  v_current_status TEXT;
  v_result JSON;
BEGIN
  -- Admin-only access
  IF NOT is_admin_user() THEN
    RAISE EXCEPTION 'Access denied. Admin privileges required.'
      USING HINT = 'Only admins can reject storage requests';
  END IF;

  -- ✅ FIXED: Query storage_requests.user_email instead of companies.contact_email
  SELECT
    sr.company_id,
    sr.reference_id,
    sr.status,
    sr.user_email,  -- ✅ FIXED: Get email from storage_requests
    c.name
  INTO
    v_company_id,
    v_reference_id,
    v_current_status,
    v_user_email,   -- ✅ FIXED: Store in v_user_email
    v_company_name
  FROM storage_requests sr
  INNER JOIN companies c ON c.id = sr.company_id
  WHERE sr.id = p_request_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Storage request not found: %', p_request_id;
  END IF;

  IF v_current_status != 'PENDING' THEN
    RAISE EXCEPTION 'Request % is not pending (current status: %)', v_reference_id, v_current_status
      USING HINT = 'Only PENDING requests can be rejected';
  END IF;

  -- Update request
  UPDATE storage_requests
  SET status = 'REJECTED', rejection_reason = p_rejection_reason, updated_at = NOW()
  WHERE id = p_request_id;

  -- Audit log
  INSERT INTO admin_audit_log (
    admin_user_id, action, entity_type, entity_id, details, created_at
  )
  VALUES (
    COALESCE(p_admin_user_id, auth.uid()::text),
    'REJECT_REQUEST',
    'storage_request',
    p_request_id,
    json_build_object(
      'referenceId', v_reference_id,
      'companyName', v_company_name,
      'rejectionReason', p_rejection_reason
    ),
    NOW()
  );

  -- ✅ FIXED: Use v_user_email instead of v_company_email
  INSERT INTO notification_queue (
    notification_type, recipient_email, subject, payload, status, created_at
  )
  VALUES (
    'storage_request_rejected',
    v_user_email,  -- ✅ FIXED: Use user's email
    'Storage Request Rejected - ' || v_reference_id,
    json_build_object(
      'requestId', p_request_id,
      'referenceId', v_reference_id,
      'companyName', v_company_name,
      'rejectionReason', p_rejection_reason
    ),
    'PENDING',
    NOW()
  );

  -- Result
  v_result := json_build_object(
    'success', true,
    'requestId', p_request_id,
    'referenceId', v_reference_id,
    'status', 'REJECTED',
    'rejectionReason', p_rejection_reason,
    'message', format('Request %s rejected successfully', v_reference_id)
  );
  RETURN v_result;

EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'Rejection failed: %', SQLERRM
    USING HINT = 'All changes have been rolled back. No partial state.';
END;
$$;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Verify functions updated
SELECT
  proname as function_name,
  prosecdef as is_security_definer,
  pg_get_function_arguments(oid) as arguments
FROM pg_proc
WHERE proname IN ('approve_storage_request_atomic', 'reject_storage_request_atomic')
ORDER BY proname;

-- Expected result: 2 rows showing both functions as SECURITY DEFINER
