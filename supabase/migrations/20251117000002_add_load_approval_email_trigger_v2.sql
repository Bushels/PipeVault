-- Migration: Add email notification trigger for load approvals (IMPROVED)
-- Created: 2025-11-17
-- Purpose: Send email to customer when admin approves, completes, or marks loads in transit
-- Version: 2.0 - Addresses Supabase GPT-5 security and operational feedback

-- ============================================================================
-- STEP 0: Add indexes for performance
-- ============================================================================

-- Index for efficient trigger queries
CREATE INDEX IF NOT EXISTS idx_trucking_loads_storage_request_status
ON trucking_loads(storage_request_id, status, direction);

-- Index for notification queue queries
CREATE INDEX IF NOT EXISTS idx_notification_queue_processed_attempts
ON notification_queue(processed, attempts, created_at)
WHERE processed = false;

-- Unique index for idempotency (prevent duplicate notifications)
CREATE UNIQUE INDEX IF NOT EXISTS idx_notification_queue_dedup
ON notification_queue(
  type,
  (payload->>'truckingLoadId'),
  (payload->>'statusTransitionTo')
) WHERE processed = false;

-- ============================================================================
-- STEP 1: Create function that sends load approval email
-- ============================================================================

CREATE OR REPLACE FUNCTION notify_load_approved()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_customer_email TEXT;
  v_company_name TEXT;
  v_reference_id TEXT;
  v_scheduled_date TEXT;
  v_scheduled_time TEXT;
  v_company_id UUID;
BEGIN
  -- Only send email when status changes to APPROVED
  IF NEW.status = 'APPROVED' AND (OLD.status IS NULL OR OLD.status != 'APPROVED') THEN

    -- Get customer email and company name from storage request
    -- Note: storage_requests has user_email, not user_id
    SELECT
      sr.user_email,
      c.name,
      sr.reference_id,
      sr.company_id,
      -- Format date/time with timezone and no padding
      CASE
        WHEN NEW.scheduled_slot_start IS NOT NULL
        THEN TO_CHAR(NEW.scheduled_slot_start AT TIME ZONE 'America/Edmonton', 'FMDay, FMMonth DD, YYYY')
        ELSE 'TBD'
      END,
      CASE
        WHEN NEW.scheduled_slot_start IS NOT NULL
        THEN TO_CHAR(NEW.scheduled_slot_start AT TIME ZONE 'America/Edmonton', 'HH:MI AM MST')
        ELSE 'TBD'
      END
    INTO
      v_customer_email,
      v_company_name,
      v_reference_id,
      v_company_id,
      v_scheduled_date,
      v_scheduled_time
    FROM storage_requests sr
    JOIN companies c ON sr.company_id = c.id
    WHERE sr.id = NEW.storage_request_id;

    -- Guard: If no customer email found, skip and log error
    IF v_customer_email IS NULL THEN
      RAISE WARNING 'Cannot send load_approved email: No customer email found for storage_request_id=%', NEW.storage_request_id;
      RETURN NEW;
    END IF;

    -- Insert notification into queue (idempotent via unique index)
    BEGIN
      INSERT INTO notification_queue (
        type,
        payload,
        processed,
        attempts,
        created_at
      ) VALUES (
        'load_approved',
        jsonb_build_object(
          -- Recipient info
          'userEmail', v_customer_email,
          'companyName', v_company_name,
          'companyId', v_company_id,

          -- Load identifiers (for troubleshooting & dedup)
          'truckingLoadId', NEW.id,
          'storageRequestId', NEW.storage_request_id,
          'referenceId', v_reference_id,
          'loadNumber', NEW.sequence_number,

          -- Status transition metadata
          'statusTransitionFrom', OLD.status,
          'statusTransitionTo', 'APPROVED',
          'occurredAt', NOW(),

          -- Load details
          'scheduledDate', v_scheduled_date,
          'scheduledTime', v_scheduled_time,
          'truckingCompany', COALESCE(NEW.trucking_company, 'N/A'),
          'driverName', COALESCE(NEW.driver_name, 'TBD'),
          'driverPhone', COALESCE(NEW.driver_phone, 'TBD'),
          'totalJoints', COALESCE(NEW.total_joints_planned, 0),

          -- Email metadata
          'subject', 'Load #' || NEW.sequence_number || ' Approved - Delivery ' || v_scheduled_date || ' at ' || v_scheduled_time,
          'notificationType', 'email'
        ),
        false,
        0,
        NOW()
      );

      RAISE NOTICE 'Load approval email queued for % (load_id: %)', v_customer_email, NEW.id;

    EXCEPTION
      WHEN unique_violation THEN
        -- Duplicate notification already queued, skip silently
        RAISE NOTICE 'Duplicate load_approved notification skipped for load_id=%', NEW.id;
    END;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION notify_load_approved() IS
'Automatically queues an email notification when a trucking load is approved.
Triggered on UPDATE of trucking_loads when status changes to APPROVED.
SECURITY: Uses SECURITY DEFINER with search_path protection.
IDEMPOTENCY: Unique index prevents duplicate notifications.';

-- Security: Revoke execute from public roles (only trigger can execute)
REVOKE EXECUTE ON FUNCTION notify_load_approved() FROM PUBLIC, anon, authenticated;

-- ============================================================================
-- STEP 2: Create load completion email trigger
-- ============================================================================

CREATE OR REPLACE FUNCTION notify_load_completed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_customer_email TEXT;
  v_company_name TEXT;
  v_reference_id TEXT;
  v_rack_names TEXT;
  v_total_joints_delivered INTEGER;
  v_total_loads_completed INTEGER;
  v_company_id UUID;
BEGIN
  -- Only send email when status changes to COMPLETED
  IF NEW.status = 'COMPLETED' AND (OLD.status IS NULL OR OLD.status != 'COMPLETED') THEN

    -- Get customer and project details
    SELECT
      sr.user_email,
      c.name,
      sr.reference_id,
      sr.company_id
    INTO
      v_customer_email,
      v_company_name,
      v_reference_id,
      v_company_id
    FROM storage_requests sr
    JOIN companies c ON sr.company_id = c.id
    WHERE sr.id = NEW.storage_request_id;

    -- Guard: If no customer email found, skip
    IF v_customer_email IS NULL THEN
      RAISE WARNING 'Cannot send load_completed email: No customer email found for storage_request_id=%', NEW.storage_request_id;
      RETURN NEW;
    END IF;

    -- Get rack names from assigned racks
    SELECT STRING_AGG(name, ', ')
    INTO v_rack_names
    FROM storage_areas
    WHERE id = ANY(
      SELECT UNNEST(assigned_rack_ids)
      FROM storage_requests
      WHERE id = NEW.storage_request_id
    );

    -- Calculate cumulative totals for this storage request
    -- (Only COMPLETED INBOUND loads - pipes received into storage)
    SELECT
      COALESCE(SUM(total_joints_completed), 0),
      COUNT(*)
    INTO
      v_total_joints_delivered,
      v_total_loads_completed
    FROM trucking_loads
    WHERE storage_request_id = NEW.storage_request_id
      AND status = 'COMPLETED'
      AND direction = 'INBOUND';

    -- Insert notification into queue
    BEGIN
      INSERT INTO notification_queue (
        type,
        payload,
        processed,
        attempts,
        created_at
      ) VALUES (
        'load_completed',
        jsonb_build_object(
          -- Recipient info
          'userEmail', v_customer_email,
          'companyName', v_company_name,
          'companyId', v_company_id,

          -- Load identifiers
          'truckingLoadId', NEW.id,
          'storageRequestId', NEW.storage_request_id,
          'referenceId', v_reference_id,
          'loadNumber', NEW.sequence_number,

          -- Status transition metadata
          'statusTransitionFrom', OLD.status,
          'statusTransitionTo', 'COMPLETED',
          'occurredAt', NOW(),

          -- Delivery summary
          'jointsReceived', COALESCE(NEW.total_joints_completed, 0),
          'totalLength', COALESCE(NEW.total_length_ft_completed, 0),
          'totalWeight', COALESCE(NEW.total_weight_tonnes_completed, 0),
          'rackLocation', COALESCE(v_rack_names, 'Pending assignment'),
          'completedAt', NOW(),

          -- Cumulative project totals
          'projectTotalJoints', v_total_joints_delivered,
          'projectTotalLoads', v_total_loads_completed,

          -- Email metadata
          'subject', 'Load #' || NEW.sequence_number || ' Delivered & Stored at MPS',
          'notificationType', 'email'
        ),
        false,
        0,
        NOW()
      );

      RAISE NOTICE 'Load completion email queued for % (load_id: %)', v_customer_email, NEW.id;

    EXCEPTION
      WHEN unique_violation THEN
        RAISE NOTICE 'Duplicate load_completed notification skipped for load_id=%', NEW.id;
    END;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION notify_load_completed() IS
'Automatically queues an email notification when a trucking load is completed.
Includes load details and cumulative project totals.
SECURITY: Uses SECURITY DEFINER with search_path protection.';

REVOKE EXECUTE ON FUNCTION notify_load_completed() FROM PUBLIC, anon, authenticated;

-- ============================================================================
-- STEP 3: Create load in-transit email trigger
-- ============================================================================

CREATE OR REPLACE FUNCTION notify_load_in_transit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_customer_email TEXT;
  v_company_name TEXT;
  v_reference_id TEXT;
  v_eta TEXT;
  v_company_id UUID;
BEGIN
  -- Only send email when status changes to IN_TRANSIT
  IF NEW.status = 'IN_TRANSIT' AND (OLD.status IS NULL OR OLD.status != 'IN_TRANSIT') THEN

    -- Get customer details
    SELECT
      sr.user_email,
      c.name,
      sr.reference_id,
      sr.company_id,
      CASE
        WHEN NEW.scheduled_slot_end IS NOT NULL
        THEN TO_CHAR(NEW.scheduled_slot_end AT TIME ZONE 'America/Edmonton', 'HH:MI AM MST')
        ELSE 'TBD'
      END
    INTO
      v_customer_email,
      v_company_name,
      v_reference_id,
      v_company_id,
      v_eta
    FROM storage_requests sr
    JOIN companies c ON sr.company_id = c.id
    WHERE sr.id = NEW.storage_request_id;

    -- Guard: If no customer email found, skip
    IF v_customer_email IS NULL THEN
      RAISE WARNING 'Cannot send load_in_transit email: No customer email found for storage_request_id=%', NEW.storage_request_id;
      RETURN NEW;
    END IF;

    -- Insert notification into queue
    BEGIN
      INSERT INTO notification_queue (
        type,
        payload,
        processed,
        attempts,
        created_at
      ) VALUES (
        'load_in_transit',
        jsonb_build_object(
          -- Recipient info
          'userEmail', v_customer_email,
          'companyName', v_company_name,
          'companyId', v_company_id,

          -- Load identifiers
          'truckingLoadId', NEW.id,
          'storageRequestId', NEW.storage_request_id,
          'referenceId', v_reference_id,
          'loadNumber', NEW.sequence_number,

          -- Status transition metadata
          'statusTransitionFrom', OLD.status,
          'statusTransitionTo', 'IN_TRANSIT',
          'occurredAt', NOW(),

          -- Transit details
          'driverName', COALESCE(NEW.driver_name, 'TBD'),
          'driverPhone', COALESCE(NEW.driver_phone, 'TBD'),
          'eta', v_eta,
          'totalJoints', COALESCE(NEW.total_joints_planned, 0),

          -- Email metadata
          'subject', 'Load #' || NEW.sequence_number || ' En Route to MPS',
          'notificationType', 'email'
        ),
        false,
        0,
        NOW()
      );

      RAISE NOTICE 'Load in-transit email queued for % (load_id: %)', v_customer_email, NEW.id;

    EXCEPTION
      WHEN unique_violation THEN
        RAISE NOTICE 'Duplicate load_in_transit notification skipped for load_id=%', NEW.id;
    END;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION notify_load_in_transit() IS
'Automatically queues an email notification when a trucking load status changes to IN_TRANSIT.
SECURITY: Uses SECURITY DEFINER with search_path protection.';

REVOKE EXECUTE ON FUNCTION notify_load_in_transit() FROM PUBLIC, anon, authenticated;

-- ============================================================================
-- STEP 4: Create triggers on trucking_loads table
-- ============================================================================

DROP TRIGGER IF EXISTS trigger_load_approved_email ON trucking_loads;
CREATE TRIGGER trigger_load_approved_email
  AFTER UPDATE ON trucking_loads
  FOR EACH ROW
  EXECUTE FUNCTION notify_load_approved();

COMMENT ON TRIGGER trigger_load_approved_email ON trucking_loads IS
'Sends email notification to customer when load is approved by admin';

DROP TRIGGER IF EXISTS trigger_load_completed_email ON trucking_loads;
CREATE TRIGGER trigger_load_completed_email
  AFTER UPDATE ON trucking_loads
  FOR EACH ROW
  EXECUTE FUNCTION notify_load_completed();

COMMENT ON TRIGGER trigger_load_completed_email ON trucking_loads IS
'Sends email notification to customer when load is completed and inventory created';

DROP TRIGGER IF EXISTS trigger_load_in_transit_email ON trucking_loads;
CREATE TRIGGER trigger_load_in_transit_email
  AFTER UPDATE ON trucking_loads
  FOR EACH ROW
  EXECUTE FUNCTION notify_load_in_transit();

COMMENT ON TRIGGER trigger_load_in_transit_email ON trucking_loads IS
'Sends email notification to customer when load is marked as in transit';

-- ============================================================================
-- STEP 5: Grant minimal necessary permissions
-- ============================================================================

-- Ensure notification_queue allows INSERTs from trigger functions
-- (These functions run as SECURITY DEFINER with function owner's permissions)
GRANT INSERT ON notification_queue TO postgres;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Check that triggers were created
SELECT
  trigger_name,
  event_manipulation,
  event_object_table,
  action_timing,
  action_statement
FROM information_schema.triggers
WHERE trigger_name IN (
  'trigger_load_approved_email',
  'trigger_load_completed_email',
  'trigger_load_in_transit_email'
)
ORDER BY trigger_name;

-- Check that indexes were created
SELECT
  indexname,
  tablename,
  indexdef
FROM pg_indexes
WHERE indexname IN (
  'idx_trucking_loads_storage_request_status',
  'idx_notification_queue_processed_attempts',
  'idx_notification_queue_dedup'
)
ORDER BY indexname;

-- Expected output: 3 triggers on trucking_loads table, 3 indexes created
