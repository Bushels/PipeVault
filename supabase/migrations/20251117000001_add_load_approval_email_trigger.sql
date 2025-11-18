-- Migration: Add email notification trigger for load approvals
-- Created: 2025-11-17
-- Purpose: Send email to customer when admin approves a load

-- ============================================================================
-- STEP 1: Create function that sends load approval email
-- ============================================================================

CREATE OR REPLACE FUNCTION notify_load_approved()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_customer_email TEXT;
  v_company_name TEXT;
  v_reference_id TEXT;
  v_scheduled_date TEXT;
  v_scheduled_time TEXT;
BEGIN
  -- Only send email when status changes to APPROVED
  IF NEW.status = 'APPROVED' AND (OLD.status IS NULL OR OLD.status != 'APPROVED') THEN

    -- Get customer email and company name from storage request
    SELECT
      u.email,
      c.name,
      sr.reference_id,
      TO_CHAR(NEW.scheduled_slot_start, 'Day, Month DD, YYYY'),
      TO_CHAR(NEW.scheduled_slot_start, 'HH:MI AM')
    INTO
      v_customer_email,
      v_company_name,
      v_reference_id,
      v_scheduled_date,
      v_scheduled_time
    FROM storage_requests sr
    JOIN companies c ON sr.company_id = c.id
    JOIN auth.users u ON u.id = sr.user_id
    WHERE sr.id = NEW.storage_request_id;

    -- Insert notification into queue
    INSERT INTO notification_queue (
      type,
      payload,
      processed,
      attempts,
      created_at
    ) VALUES (
      'load_approved',
      jsonb_build_object(
        'userEmail', v_customer_email,
        'companyName', v_company_name,
        'referenceId', v_reference_id,
        'loadNumber', NEW.sequence_number,
        'scheduledDate', v_scheduled_date,
        'scheduledTime', v_scheduled_time,
        'truckingCompany', NEW.trucking_company,
        'driverName', NEW.driver_name,
        'driverPhone', NEW.driver_phone,
        'totalJoints', NEW.total_joints_planned,
        'subject', 'Load #' || NEW.sequence_number || ' Approved - Delivery ' || v_scheduled_date || ' at ' || v_scheduled_time,
        'notificationType', 'email'
      ),
      false,
      0,
      NOW()
    );

    RAISE NOTICE 'Load approval email queued for %', v_customer_email;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION notify_load_approved() IS
'Automatically queues an email notification when a trucking load is approved.
Triggered on UPDATE of trucking_loads when status changes to APPROVED.';

-- ============================================================================
-- STEP 2: Create trigger on trucking_loads table
-- ============================================================================

DROP TRIGGER IF EXISTS trigger_load_approved_email ON trucking_loads;

CREATE TRIGGER trigger_load_approved_email
  AFTER UPDATE ON trucking_loads
  FOR EACH ROW
  EXECUTE FUNCTION notify_load_approved();

COMMENT ON TRIGGER trigger_load_approved_email ON trucking_loads IS
'Sends email notification to customer when load is approved by admin';

-- ============================================================================
-- STEP 3: Create load completion email trigger
-- ============================================================================

CREATE OR REPLACE FUNCTION notify_load_completed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_customer_email TEXT;
  v_company_name TEXT;
  v_reference_id TEXT;
  v_rack_names TEXT;
  v_total_joints_delivered INTEGER;
  v_total_in_storage INTEGER;
BEGIN
  -- Only send email when status changes to COMPLETED
  IF NEW.status = 'COMPLETED' AND (OLD.status IS NULL OR OLD.status != 'COMPLETED') THEN

    -- Get customer and project details
    SELECT
      u.email,
      c.name,
      sr.reference_id
    INTO
      v_customer_email,
      v_company_name,
      v_reference_id
    FROM storage_requests sr
    JOIN companies c ON sr.company_id = c.id
    JOIN auth.users u ON u.id = sr.user_id
    WHERE sr.id = NEW.storage_request_id;

    -- Get rack names from assigned racks
    SELECT STRING_AGG(name, ', ')
    INTO v_rack_names
    FROM storage_areas
    WHERE id = ANY((
      SELECT assigned_rack_ids
      FROM storage_requests
      WHERE id = NEW.storage_request_id
    ));

    -- Calculate total joints delivered for this request
    SELECT
      COALESCE(SUM(total_joints_completed), 0),
      COUNT(*)
    INTO
      v_total_joints_delivered,
      v_total_in_storage
    FROM trucking_loads
    WHERE storage_request_id = NEW.storage_request_id
      AND status = 'COMPLETED'
      AND direction = 'INBOUND';

    -- Insert notification into queue
    INSERT INTO notification_queue (
      type,
      payload,
      processed,
      attempts,
      created_at
    ) VALUES (
      'load_completed',
      jsonb_build_object(
        'userEmail', v_customer_email,
        'companyName', v_company_name,
        'referenceId', v_reference_id,
        'loadNumber', NEW.sequence_number,
        'jointsReceived', NEW.total_joints_completed,
        'totalLength', NEW.total_length_ft_completed,
        'totalWeight', NEW.total_weight_tonnes_completed,
        'rackLocation', v_rack_names,
        'completedAt', NOW(),
        'projectTotalJoints', v_total_joints_delivered,
        'subject', 'Load #' || NEW.sequence_number || ' Delivered & Stored at MPS',
        'notificationType', 'email'
      ),
      false,
      0,
      NOW()
    );

    RAISE NOTICE 'Load completion email queued for %', v_customer_email;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION notify_load_completed() IS
'Automatically queues an email notification when a trucking load is completed.
Includes load details and cumulative project totals.';

DROP TRIGGER IF EXISTS trigger_load_completed_email ON trucking_loads;

CREATE TRIGGER trigger_load_completed_email
  AFTER UPDATE ON trucking_loads
  FOR EACH ROW
  EXECUTE FUNCTION notify_load_completed();

COMMENT ON TRIGGER trigger_load_completed_email ON trucking_loads IS
'Sends email notification to customer when load is completed and inventory created';

-- ============================================================================
-- STEP 4: Create load in-transit email trigger
-- ============================================================================

CREATE OR REPLACE FUNCTION notify_load_in_transit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_customer_email TEXT;
  v_company_name TEXT;
  v_reference_id TEXT;
BEGIN
  -- Only send email when status changes to IN_TRANSIT
  IF NEW.status = 'IN_TRANSIT' AND (OLD.status IS NULL OR OLD.status != 'IN_TRANSIT') THEN

    -- Get customer details
    SELECT
      u.email,
      c.name,
      sr.reference_id
    INTO
      v_customer_email,
      v_company_name,
      v_reference_id
    FROM storage_requests sr
    JOIN companies c ON sr.company_id = c.id
    JOIN auth.users u ON u.id = sr.user_id
    WHERE sr.id = NEW.storage_request_id;

    -- Insert notification into queue
    INSERT INTO notification_queue (
      type,
      payload,
      processed,
      attempts,
      created_at
    ) VALUES (
      'load_in_transit',
      jsonb_build_object(
        'userEmail', v_customer_email,
        'companyName', v_company_name,
        'referenceId', v_reference_id,
        'loadNumber', NEW.sequence_number,
        'driverName', NEW.driver_name,
        'driverPhone', NEW.driver_phone,
        'eta', TO_CHAR(NEW.scheduled_slot_end, 'HH:MI AM'),
        'totalJoints', NEW.total_joints_planned,
        'subject', 'Load #' || NEW.sequence_number || ' En Route to MPS',
        'notificationType', 'email'
      ),
      false,
      0,
      NOW()
    );

    RAISE NOTICE 'Load in-transit email queued for %', v_customer_email;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION notify_load_in_transit() IS
'Automatically queues an email notification when a trucking load status changes to IN_TRANSIT';

DROP TRIGGER IF EXISTS trigger_load_in_transit_email ON trucking_loads;

CREATE TRIGGER trigger_load_in_transit_email
  AFTER UPDATE ON trucking_loads
  FOR EACH ROW
  EXECUTE FUNCTION notify_load_in_transit();

COMMENT ON TRIGGER trigger_load_in_transit_email ON trucking_loads IS
'Sends email notification to customer when load is marked as in transit';

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Check that triggers were created
SELECT
  trigger_name,
  event_manipulation,
  event_object_table,
  action_timing
FROM information_schema.triggers
WHERE trigger_name IN (
  'trigger_load_approved_email',
  'trigger_load_completed_email',
  'trigger_load_in_transit_email'
)
ORDER BY trigger_name;

-- Expected output: 3 triggers on trucking_loads table
