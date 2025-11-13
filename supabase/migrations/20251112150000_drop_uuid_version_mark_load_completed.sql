-- ============================================================================
-- MIGRATION: Drop Old UUID Version of mark_load_completed_and_create_inventory
-- ============================================================================
--
-- Problem: Function overloading conflict detected in production
--
-- Error: "Could not choose the best candidate function between:
--   - mark_load_completed_and_create_inventory(...rack_id_param => uuid...)
--   - mark_load_completed_and_create_inventory(...rack_id_param => text...)"
--
-- Root Cause:
--   CREATE OR REPLACE FUNCTION does not work when changing parameter types.
--   When we corrected rack_id_param from UUID to TEXT, PostgreSQL created
--   a second function instead of replacing the first one.
--
-- Solution:
--   1. Drop the old UUID version explicitly
--   2. Keep only the TEXT version (correct schema)
--   3. Prevent future ambiguity
--
-- Impact:
--   - Old function with UUID parameter will be removed
--   - Only TEXT version will remain (matches racks.id schema)
--   - Admin load completion will work correctly
--
-- ============================================================================

-- Drop the old function with UUID rack_id_param
-- This is the incorrect version that assumed racks.id was UUID
DROP FUNCTION IF EXISTS public.mark_load_completed_and_create_inventory(
    UUID,  -- load_id_param
    UUID,  -- company_id_param
    UUID,  -- request_id_param
    UUID,  -- rack_id_param (OLD: incorrect type)
    INTEGER,  -- actual_joints_param
    TEXT  -- completion_notes_param
);

-- ============================================================================
-- VERIFICATION: Ensure only TEXT version remains
-- ============================================================================

-- After applying this migration, verify only one function exists:
-- SELECT
--   p.proname AS function_name,
--   pg_get_function_arguments(p.oid) AS arguments
-- FROM pg_proc p
-- JOIN pg_namespace n ON p.pronamespace = n.oid
-- WHERE n.nspname = 'public'
--   AND p.proname = 'mark_load_completed_and_create_inventory';
--
-- Expected output: ONE row with rack_id_param TEXT

-- ============================================================================
-- COMMENT
-- ============================================================================

COMMENT ON DATABASE postgres IS
  'Dropped UUID version of mark_load_completed_and_create_inventory. ' ||
  'Only TEXT version remains (correct schema). ' ||
  'Migration date: 2025-11-12';
