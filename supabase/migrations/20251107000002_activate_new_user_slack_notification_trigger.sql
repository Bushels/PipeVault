-- Migration: Activate Slack notification trigger for new user signups
-- Date: 2025-11-07
-- Purpose: Enable automatic Slack notifications when new users sign up
--
-- Background:
-- - The notify_slack_new_user() function exists with proper implementation
-- - Function retrieves webhook URL from vault.decrypted_secrets
-- - Function sends notifications via net.http_post()
-- - However, NO TRIGGER exists to call this function when users sign up
--
-- This migration creates the missing trigger on auth.users table

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

-- Note: The function will send a simple text message to Slack:
-- "New user signed up: {email} (id={uuid}, at={timestamp})"
--
-- Prerequisites (already verified):
-- 1. slack_webhook_url exists in Supabase Vault
-- 2. pg_net extension installed (v0.19.5)
-- 3. notify_slack_new_user() function exists
