-- ============================================================================
-- DEBUG UPDATE TEST - Test if UPDATE works at all
-- Run this in Supabase SQL Editor (uses service role, bypasses RLS)
-- ============================================================================

-- Step 1: Show current pending requests
SELECT
  '=== CURRENT PENDING REQUESTS ===' as test,
  id,
  reference_id,
  status,
  user_email,
  company_id
FROM storage_requests
WHERE status = 'PENDING'
ORDER BY created_at DESC;

-- Step 2: Try a direct UPDATE (this will work because you're using service role)
-- Let's update the first pending request as a test
UPDATE storage_requests
SET
  status = 'APPROVED',
  approved_at = NOW(),
  assigned_location = 'Test Location - Yard A, North, Rack 1',
  assigned_rack_ids = ARRAY['A-N-R1', 'A-N-R2']
WHERE id = (
  SELECT id FROM storage_requests
  WHERE status = 'PENDING'
  ORDER BY created_at DESC
  LIMIT 1
)
RETURNING id, reference_id, status, assigned_location;

-- Step 3: Verify the update worked
SELECT
  '=== AFTER UPDATE ===' as test,
  id,
  reference_id,
  status,
  approved_at,
  assigned_location,
  assigned_rack_ids
FROM storage_requests
WHERE status = 'APPROVED'
ORDER BY approved_at DESC
LIMIT 1;

-- ============================================================================
-- If this works, the database structure is fine.
-- The issue is 100% the RLS policies blocking your JWT token.
-- ============================================================================

-- Step 4: Check all current UPDATE policies
SELECT
  '=== CURRENT UPDATE POLICIES ===' as test,
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual::text as using_clause,
  with_check::text as with_check_clause
FROM pg_policies
WHERE tablename = 'storage_requests'
  AND cmd = 'UPDATE'
ORDER BY policyname;
