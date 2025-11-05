-- Migration: Remove duplicate enqueue_notification function
-- Purpose: Fix "function is not unique" error when submitting storage requests
-- Date: 2025-11-05
--
-- Issue: Two versions of enqueue_notification exist:
-- 1. enqueue_notification(type text, payload jsonb) - old version
-- 2. enqueue_notification(p_type text, p_payload jsonb, p_webhook_key text) - new version
--
-- PostgreSQL can't determine which to use when called with 2 arguments
-- Solution: Drop the old 2-parameter version

-- Drop the old 2-parameter version
DROP FUNCTION IF EXISTS public.enqueue_notification(text, jsonb);

-- Verify only one version remains (the 3-parameter version)
SELECT
  p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS arguments,
  p.pronargs AS num_args
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname = 'enqueue_notification';

-- Expected result: Only 1 row showing the 3-parameter version
