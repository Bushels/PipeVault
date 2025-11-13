-- Migration: Activate Slack notification trigger for completed projects
-- Date: 2025-11-07
-- Purpose: Enable automatic Slack notifications when all pipe is moved out of storage
--
-- Background:
-- - The notify_slack_project_complete() function exists with proper implementation
-- - Function monitors when OUTBOUND trucking loads are COMPLETED
-- - When the last pipe is moved out (remaining inventory = 0), sends Slack notification
-- - However, NO TRIGGER exists to call this function
--
-- This migration creates the missing trigger on trucking_loads table

-- Drop trigger if it exists (idempotent migration)
DROP TRIGGER IF EXISTS on_trucking_load_complete ON public.trucking_loads;

-- Create trigger to fire on UPDATE of trucking_loads
-- This will call notify_slack_project_complete() when load status changes
CREATE TRIGGER on_trucking_load_complete
  AFTER UPDATE ON public.trucking_loads
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_slack_project_complete();

-- Verification query (optional - run to confirm trigger created)
-- SELECT
--   trigger_name,
--   event_manipulation,
--   event_object_table,
--   action_statement,
--   action_timing
-- FROM information_schema.triggers
-- WHERE trigger_name = 'on_trucking_load_complete';
--
-- Expected result:
-- trigger_name: on_trucking_load_complete
-- event_manipulation: UPDATE
-- event_object_table: trucking_loads
-- action_statement: EXECUTE FUNCTION public.notify_slack_project_complete()
-- action_timing: AFTER

-- Note: The function logic:
-- 1. Only acts when NEW.direction = 'OUTBOUND' AND NEW.status = 'COMPLETED'
-- 2. Checks remaining inventory for the storage_request_id
-- 3. If remaining_inventory = 0, sends Slack notification:
--    "✅ Project Complete: All pipe for project {id} from company {name} has been moved out."
--
-- Prerequisites (already verified):
-- 1. slack_webhook_url exists in Supabase Vault (checked via vault.decrypted_secret('Slack-URL-Webhook'))
-- 2. pg_net extension installed (v0.19.5)
-- 3. notify_slack_project_complete() function exists
