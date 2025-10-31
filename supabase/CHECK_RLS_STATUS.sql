-- ============================================================================
-- CHECK RLS STATUS - Quick diagnostic for when requests disappear
-- Run this in Supabase SQL Editor
-- ============================================================================

-- Step 1: Verify data exists (bypasses RLS)
SELECT
  '=== ALL REQUESTS IN DATABASE ===' as test,
  reference_id,
  status,
  user_email,
  created_at
FROM storage_requests
ORDER BY created_at DESC;

-- Step 2: Check if RLS is enabled
SELECT
  '=== RLS STATUS ===' as test,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename = 'storage_requests';

-- Step 3: Check SELECT policies
SELECT
  '=== SELECT POLICIES ===' as test,
  policyname,
  permissive,
  roles,
  qual::text as using_clause
FROM pg_policies
WHERE tablename = 'storage_requests'
  AND cmd = 'SELECT'
ORDER BY policyname;

-- Step 4: Test your current access (run while logged in as user)
SELECT
  '=== YOUR ACCESS TEST ===' as test,
  auth.jwt() ->> 'email' as your_email,
  auth.uid() as your_user_id,
  COUNT(*) as requests_you_can_see
FROM storage_requests;

-- Step 5: Test admin allowlist
SELECT
  '=== ADMIN ALLOWLIST TEST ===' as test,
  auth.jwt() ->> 'email' as your_email,
  (auth.jwt() ->> 'email') IN (
    'admin@mpsgroup.com',
    'kyle@bushels.com',
    'admin@bushels.com',
    'kylegronning@mpsgroup.ca'
  ) as in_allowlist;

-- ============================================================================
-- INTERPRETATION:
-- - If "ALL REQUESTS" shows data but "YOUR ACCESS TEST" shows 0, RLS is blocking you
-- - If "RLS STATUS" shows false, RLS is disabled (shouldn't happen)
-- - If "SELECT POLICIES" is empty, policies were deleted (need to re-run FIX_ALL_ADMIN_POLICIES.sql)
-- - If "ADMIN ALLOWLIST TEST" shows false, your email isn't in the allowlist
-- ============================================================================
