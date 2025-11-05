-- Migration: Restore complete Slack notification system
-- Purpose: Fix missing trigger and restore full Block Kit webhook implementation
-- Date: 2025-11-05
--
-- Issue: Slack notifications not working for new storage requests
-- Root Cause:
-- 1. No trigger exists on storage_requests table to call notify_slack_storage_request
-- 2. notify_slack_storage_request function is incomplete stub (missing Block Kit payload)
--
-- Solution:
-- 1. Restore full notify_slack_storage_request function with Block Kit formatting
-- 2. Create AFTER INSERT OR UPDATE trigger on storage_requests table

-- ============================================================================
-- STEP 1: Restore Full Slack Notification Function
-- ============================================================================

CREATE OR REPLACE FUNCTION public.notify_slack_storage_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  slack_webhook_url TEXT;
  request_details JSONB;
  item_type TEXT;
  total_joints TEXT;
  company_name TEXT;
  storage_start TEXT;
  storage_end TEXT;
  slack_payload JSONB;
BEGIN
  -- Only send notification for PENDING requests (not drafts)
  IF NEW.status = 'PENDING' THEN

    -- Retrieve Slack webhook URL from Supabase Vault (secure storage)
    SELECT decrypted_secret
    INTO slack_webhook_url
    FROM vault.decrypted_secrets
    WHERE name = 'slack_webhook_url'
    LIMIT 1;

    -- Extract request details from JSONB
    request_details := NEW.request_details;
    item_type := COALESCE(request_details->>'itemType', 'N/A');
    total_joints := COALESCE((request_details->>'totalJoints')::text, 'N/A');
    company_name := COALESCE(request_details->>'companyName', 'N/A');
    storage_start := COALESCE(request_details->>'storageStartDate', 'N/A');
    storage_end := COALESCE(request_details->>'storageEndDate', 'N/A');

    -- Build Slack payload with Block Kit formatting
    slack_payload := jsonb_build_object(
      'blocks', jsonb_build_array(
        -- Header
        jsonb_build_object(
          'type', 'header',
          'text', jsonb_build_object(
            'type', 'plain_text',
            'text', '🔔 New Storage Request Submitted',
            'emoji', true
          )
        ),
        -- Request details section
        jsonb_build_object(
          'type', 'section',
          'fields', jsonb_build_array(
            jsonb_build_object(
              'type', 'mrkdwn',
              'text', '*Project Reference:*' || E'\n' || COALESCE(NEW.reference_id, 'N/A')
            ),
            jsonb_build_object(
              'type', 'mrkdwn',
              'text', '*Company:*' || E'\n' || company_name
            ),
            jsonb_build_object(
              'type', 'mrkdwn',
              'text', '*Contact Email:*' || E'\n' || COALESCE(NEW.user_email, 'N/A')
            ),
            jsonb_build_object(
              'type', 'mrkdwn',
              'text', '*Item Type:*' || E'\n' || item_type
            ),
            jsonb_build_object(
              'type', 'mrkdwn',
              'text', '*Quantity:*' || E'\n' || total_joints || ' joints'
            ),
            jsonb_build_object(
              'type', 'mrkdwn',
              'text', '*Storage Period:*' || E'\n' || storage_start || ' to ' || storage_end
            )
          )
        ),
        -- Action required section
        jsonb_build_object(
          'type', 'section',
          'text', jsonb_build_object(
            'type', 'mrkdwn',
            'text', '⏰ *Action Required:* Review and approve this request in the PipeVault Admin Dashboard.'
          )
        ),
        -- Button to view in PipeVault
        jsonb_build_object(
          'type', 'actions',
          'elements', jsonb_build_array(
            jsonb_build_object(
              'type', 'button',
              'text', jsonb_build_object(
                'type', 'plain_text',
                'text', '🔍 Review in PipeVault',
                'emoji', true
              ),
              'url', 'https://kylegronning.github.io/PipeVault/',
              'style', 'primary'
            )
          )
        ),
        -- Timestamp context
        jsonb_build_object(
          'type', 'context',
          'elements', jsonb_build_array(
            jsonb_build_object(
              'type', 'mrkdwn',
              'text', '📅 Submitted: ' || to_char(NEW.created_at, 'Mon DD, YYYY at HH24:MI')
            )
          )
        )
      )
    );

    -- Send to Slack using pg_net extension
    PERFORM net.http_post(
      url := slack_webhook_url,
      headers := jsonb_build_object('Content-Type', 'application/json'),
      body := slack_payload
    );

  END IF;

  RETURN NEW;
END;
$function$;

-- ============================================================================
-- STEP 2: Create Trigger on storage_requests Table
-- ============================================================================

-- Drop trigger if it exists (to avoid "already exists" error)
DROP TRIGGER IF EXISTS trigger_notify_slack_storage_request ON public.storage_requests;

-- Create trigger to fire on INSERT or UPDATE
CREATE TRIGGER trigger_notify_slack_storage_request
  AFTER INSERT OR UPDATE ON public.storage_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_slack_storage_request();

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Verify the trigger was created
SELECT
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE trigger_name = 'trigger_notify_slack_storage_request';

-- Verify the function has the full implementation
SELECT
  p.proname AS function_name,
  pg_get_functiondef(p.oid) AS function_definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname = 'notify_slack_storage_request';

-- Expected results:
-- 1. Trigger should show AFTER INSERT OR UPDATE on storage_requests
-- 2. Function definition should include Block Kit payload construction and pg_net.http_post call
-- 3. Webhook URL is securely retrieved from vault.decrypted_secrets
