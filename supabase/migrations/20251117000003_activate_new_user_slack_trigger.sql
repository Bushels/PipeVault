-- Migration: Activate Slack notification trigger for new user signups
-- Date: 2025-11-17
-- Purpose: Enable automatic Slack notifications when new users sign up
--
-- Prerequisites (verified):
-- 1. slack_webhook_url exists in Supabase Vault ✅
-- 2. pg_net extension installed ✅
-- 3. notify_slack_new_user() function exists (created in 20251117000001) ✅
--
-- This migration creates the trigger on auth.users table to call the function

-- Drop trigger if it exists (idempotent migration)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create trigger to fire on INSERT of new users
-- This will call notify_slack_new_user() whenever a new user signs up
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_slack_new_user();

-- Verification query (optional - run to confirm trigger created)
-- SELECT
--   trigger_name,
--   event_manipulation,
--   event_object_schema,
--   event_object_table,
--   action_statement,
--   action_timing
-- FROM information_schema.triggers
-- WHERE trigger_name = 'on_auth_user_created';
--
-- Expected result:
-- trigger_name: on_auth_user_created
-- event_manipulation: INSERT
-- event_object_schema: auth
-- event_object_table: users
-- action_statement: EXECUTE FUNCTION public.notify_slack_new_user()
-- action_timing: AFTER

-- Add comment for documentation
COMMENT ON TRIGGER on_auth_user_created ON auth.users IS
  'Sends Slack notification when new user signs up via notify_slack_new_user() function';
