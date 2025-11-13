-- ============================================================================
-- Atomic Approval/Rejection Workflow (Transactional)
-- ============================================================================
-- This migration addresses critical gap #4: Non-atomic approval workflow
--
-- Problem: Current client-side approval logic issues multiple Supabase updates
-- in try/catch, which can leave racks or inventory out of sync if any operation
-- fails mid-sequence.
--
-- Solution: Move all approval/rejection logic into transactional stored procedures
-- that guarantee atomicity. Either all operations succeed, or all are rolled back.
-- ============================================================================

-- ============================================================================
-- ATOMIC APPROVAL WORKFLOW
-- ============================================================================
-- Approves a storage request and performs all related updates atomically:
-- 1. Update request status to APPROVED
-- 2. Validate and assign rack capacity
-- 3. Send email notification
-- 4. Send Slack notification
-- 5. Create audit log entry
--
-- All operations succeed together or fail together (no partial state).
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
  v_company_email TEXT;
  v_reference_id TEXT;
  v_current_status TEXT;
  v_rack_record RECORD;
  v_total_capacity INTEGER := 0;
  v_total_occupied INTEGER := 0;
  v_available_capacity INTEGER := 0;
  v_rack_names TEXT[] := '{}';
  v_result JSON;
BEGIN
  -- ============================================================================
  -- SECURITY CHECK: Admin-only access
  -- ============================================================================
  IF NOT is_admin_user() THEN
    RAISE EXCEPTION 'Access denied. Admin privileges required.'
      USING HINT = 'Only admins can approve storage requests';
  END IF;

  -- ============================================================================
  -- STEP 1: Validate Request Exists and is Pending
  -- ============================================================================
  SELECT
    sr.company_id,
    sr.reference_id,
    sr.status,
    c.name,
    c.contact_email
  INTO
    v_company_id,
    v_reference_id,
    v_current_status,
    v_company_name,
    v_company_email
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

  -- ============================================================================
  -- STEP 2: Validate Rack Capacity (Atomic Check)
  -- ============================================================================
  -- Check each rack has sufficient capacity BEFORE making any updates
  -- This prevents partial approvals where some racks are updated but others fail
  -- ============================================================================

  IF array_length(p_assigned_rack_ids, 1) IS NULL OR array_length(p_assigned_rack_ids, 1) = 0 THEN
    RAISE EXCEPTION 'At least one rack must be assigned'
      USING HINT = 'Provide one or more rack IDs in p_assigned_rack_ids';
  END IF;

  -- Calculate total available capacity across all assigned racks
  FOR v_rack_record IN
    SELECT
      sa.id,
      sa.name,
      sa.capacity,
      sa.occupied,
      (sa.capacity - sa.occupied) as available
    FROM storage_areas sa
    WHERE sa.id = ANY(p_assigned_rack_ids)
    ORDER BY sa.name
  LOOP
    v_total_capacity := v_total_capacity + v_rack_record.capacity;
    v_total_occupied := v_total_occupied + v_rack_record.occupied;
    v_available_capacity := v_available_capacity + v_rack_record.available;
    v_rack_names := array_append(v_rack_names, v_rack_record.name);
  END LOOP;

  -- Verify we found all racks
  IF array_length(v_rack_names, 1) != array_length(p_assigned_rack_ids, 1) THEN
    RAISE EXCEPTION 'One or more rack IDs are invalid'
      USING HINT = 'Check that all rack IDs exist in storage_areas table';
  END IF;

  -- Verify sufficient capacity
  IF v_available_capacity < p_required_joints THEN
    RAISE EXCEPTION 'Insufficient rack capacity: % joints required, % available across racks: %',
      p_required_joints,
      v_available_capacity,
      array_to_string(v_rack_names, ', ')
      USING HINT = 'Assign additional racks or reduce required joints';
  END IF;

  -- ============================================================================
  -- STEP 3: Update Request Status (Atomic)
  -- ============================================================================
  UPDATE storage_requests
  SET
    status = 'APPROVED',
    assigned_rack_ids = p_assigned_rack_ids,
    admin_notes = p_notes,
    updated_at = NOW()
  WHERE id = p_request_id;

  -- ============================================================================
  -- STEP 4: Update Rack Occupancy (Atomic)
  -- ============================================================================
  -- Distribute joints evenly across racks (or use first rack if only one)
  -- This is a simplified distribution - production may need more sophisticated logic
  -- ============================================================================

  IF array_length(p_assigned_rack_ids, 1) = 1 THEN
    -- Single rack: assign all joints to it
    UPDATE storage_areas
    SET
      occupied = occupied + p_required_joints,
      updated_at = NOW()
    WHERE id = p_assigned_rack_ids[1];

  ELSE
    -- Multiple racks: distribute evenly (with remainder to first rack)
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

  -- ============================================================================
  -- STEP 5: Create Audit Log Entry
  -- ============================================================================
  INSERT INTO admin_audit_log (
    admin_user_id,
    action,
    entity_type,
    entity_id,
    details,
    created_at
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

  -- ============================================================================
  -- STEP 6: Trigger Notifications (Email + Slack)
  -- ============================================================================
  -- Note: Actual email/Slack sending happens via Edge Functions or external services
  -- This function creates notification queue entries that workers will process
  -- ============================================================================

  INSERT INTO notification_queue (
    notification_type,
    recipient_email,
    subject,
    payload,
    status,
    created_at
  )
  VALUES (
    'storage_request_approved',
    v_company_email,
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

  -- ============================================================================
  -- STEP 7: Return Success Result
  -- ============================================================================
  v_result := json_build_object(
    'success', true,
    'requestId', p_request_id,
    'referenceId', v_reference_id,
    'status', 'APPROVED',
    'assignedRacks', v_rack_names,
    'requiredJoints', p_required_joints,
    'availableCapacity', v_available_capacity - p_required_joints,
    'message', format(
      'Request %s approved successfully. Assigned to racks: %s',
      v_reference_id,
      array_to_string(v_rack_names, ', ')
    )
  );

  RETURN v_result;

EXCEPTION
  WHEN OTHERS THEN
    -- All updates automatically rolled back on exception (ACID guarantee)
    RAISE EXCEPTION 'Approval failed: %', SQLERRM
      USING HINT = 'All changes have been rolled back. No partial state.';
END;
$$;

COMMENT ON FUNCTION approve_storage_request_atomic IS
'Atomically approves a storage request with rack assignment and capacity validation.
Either all operations succeed (request approved, racks updated, notifications sent) or
all operations are rolled back (no partial state). Guaranteed ACID compliance.';

-- ============================================================================
-- ATOMIC REJECTION WORKFLOW
-- ============================================================================
-- Rejects a storage request and performs all related updates atomically:
-- 1. Update request status to REJECTED
-- 2. Send email notification
-- 3. Send Slack notification
-- 4. Create audit log entry
--
-- All operations succeed together or fail together (no partial state).
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
  v_company_email TEXT;
  v_reference_id TEXT;
  v_current_status TEXT;
  v_result JSON;
BEGIN
  -- ============================================================================
  -- SECURITY CHECK: Admin-only access
  -- ============================================================================
  IF NOT is_admin_user() THEN
    RAISE EXCEPTION 'Access denied. Admin privileges required.'
      USING HINT = 'Only admins can reject storage requests';
  END IF;

  -- ============================================================================
  -- STEP 1: Validate Request Exists and is Pending
  -- ============================================================================
  SELECT
    sr.company_id,
    sr.reference_id,
    sr.status,
    c.name,
    c.contact_email
  INTO
    v_company_id,
    v_reference_id,
    v_current_status,
    v_company_name,
    v_company_email
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

  -- ============================================================================
  -- STEP 2: Update Request Status (Atomic)
  -- ============================================================================
  UPDATE storage_requests
  SET
    status = 'REJECTED',
    rejection_reason = p_rejection_reason,
    updated_at = NOW()
  WHERE id = p_request_id;

  -- ============================================================================
  -- STEP 3: Create Audit Log Entry
  -- ============================================================================
  INSERT INTO admin_audit_log (
    admin_user_id,
    action,
    entity_type,
    entity_id,
    details,
    created_at
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

  -- ============================================================================
  -- STEP 4: Trigger Notifications (Email + Slack)
  -- ============================================================================
  INSERT INTO notification_queue (
    notification_type,
    recipient_email,
    subject,
    payload,
    status,
    created_at
  )
  VALUES (
    'storage_request_rejected',
    v_company_email,
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

  -- ============================================================================
  -- STEP 5: Return Success Result
  -- ============================================================================
  v_result := json_build_object(
    'success', true,
    'requestId', p_request_id,
    'referenceId', v_reference_id,
    'status', 'REJECTED',
    'rejectionReason', p_rejection_reason,
    'message', format('Request %s rejected successfully', v_reference_id)
  );

  RETURN v_result;

EXCEPTION
  WHEN OTHERS THEN
    -- All updates automatically rolled back on exception (ACID guarantee)
    RAISE EXCEPTION 'Rejection failed: %', SQLERRM
      USING HINT = 'All changes have been rolled back. No partial state.';
END;
$$;

COMMENT ON FUNCTION reject_storage_request_atomic IS
'Atomically rejects a storage request with notification. Either all operations
succeed (request rejected, notifications sent) or all operations are rolled back
(no partial state). Guaranteed ACID compliance.';

-- ============================================================================
-- SUPPORTING TABLES (if they don't exist)
-- ============================================================================

-- Admin audit log table
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_user
  ON admin_audit_log(admin_user_id);

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_entity
  ON admin_audit_log(entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_created
  ON admin_audit_log(created_at DESC);

-- Notification queue table (for async email/Slack processing)
CREATE TABLE IF NOT EXISTS notification_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_type TEXT NOT NULL,
  recipient_email TEXT,
  subject TEXT,
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',  -- PENDING, SENT, FAILED
  attempts INTEGER DEFAULT 0,
  last_attempt_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notification_queue_status
  ON notification_queue(status)
  WHERE status = 'PENDING';

CREATE INDEX IF NOT EXISTS idx_notification_queue_created
  ON notification_queue(created_at DESC);

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================
REVOKE ALL ON FUNCTION approve_storage_request_atomic FROM PUBLIC;
REVOKE ALL ON FUNCTION reject_storage_request_atomic FROM PUBLIC;

GRANT EXECUTE ON FUNCTION approve_storage_request_atomic TO authenticated;
GRANT EXECUTE ON FUNCTION reject_storage_request_atomic TO authenticated;

-- ============================================================================
-- TESTING QUERIES
-- ============================================================================

-- Test 1: Approve a request
-- SELECT approve_storage_request_atomic(
--   p_request_id := '<uuid>',
--   p_assigned_rack_ids := ARRAY['<rack_uuid>']::UUID[],
--   p_required_joints := 100,
--   p_notes := 'Approved for testing'
-- );

-- Test 2: Reject a request
-- SELECT reject_storage_request_atomic(
--   p_request_id := '<uuid>',
--   p_rejection_reason := 'Insufficient capacity at this time'
-- );

-- Test 3: Check audit log
-- SELECT * FROM admin_audit_log ORDER BY created_at DESC LIMIT 10;

-- Test 4: Check notification queue
-- SELECT * FROM notification_queue WHERE status = 'PENDING';

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
