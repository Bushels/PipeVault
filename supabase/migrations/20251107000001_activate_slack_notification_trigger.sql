-- Migration: Activate Slack notification trigger for storage_requests
-- Date: 2025-11-07
-- Purpose: Enable automatic Slack notifications when storage requests are submitted
--
-- Background:
-- - The notify_slack_storage_request() function exists with full Block Kit implementation
-- - Function retrieves webhook URL from vault.decrypted_secrets
-- - Function sends notifications via pg_net.http_post()
-- - However, NO TRIGGER exists to call this function
--
-- This migration creates the missing trigger to activate the notification system

-- Drop trigger if it exists (idempotent migration)
DROP TRIGGER IF EXISTS trigger_notify_slack_storage_request ON public.storage_requests;

-- Create trigger to fire on INSERT or UPDATE of storage_requests
-- This will call notify_slack_storage_request() whenever a storage request is created or updated
CREATE TRIGGER trigger_notify_slack_storage_request
  AFTER INSERT OR UPDATE ON public.storage_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_slack_storage_request();

-- Verification query (optional - run to confirm trigger created)
-- SELECT
--   trigger_name,
--   event_manipulation,
--   event_object_table,
--   action_statement,
--   action_timing
-- FROM information_schema.triggers
-- WHERE trigger_name = 'trigger_notify_slack_storage_request';
--
-- Expected result:
-- trigger_name: trigger_notify_slack_storage_request
-- event_manipulation: INSERT, UPDATE
-- event_object_table: storage_requests
-- action_statement: EXECUTE FUNCTION notify_slack_storage_request()
-- action_timing: AFTER

-- Note: Ensure slack_webhook_url is configured in Supabase Vault:
-- 1. Go to Settings > Vault in Supabase Dashboard
-- 2. Add secret with name: slack_webhook_url
-- 3. Value should be your Slack webhook URL from https://api.slack.com/apps
