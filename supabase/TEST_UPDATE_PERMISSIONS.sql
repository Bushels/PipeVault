-- ============================================================================
-- TEST UPDATE PERMISSIONS
-- Run this while logged in as your admin user in Supabase SQL Editor
-- ============================================================================

-- Step 1: Check your current user and admin status
SELECT
  '=== YOUR IDENTITY ===' as test,
  auth.uid() as user_id,
  auth.jwt() ->> 'email' as email,
  lower(auth.jwt() ->> 'email') as email_lowercase;

-- Step 2: Check if you're in admin_users table
SELECT
  '=== ADMIN_USERS LOOKUP ===' as test,
  COUNT(*) as found_by_user_id,
  MAX(email) as email
FROM admin_users
WHERE user_id = auth.uid();

-- Step 3: Check if you match the allowlist
SELECT
  '=== ALLOWLIST CHECK ===' as test,
  lower(auth.jwt() ->> 'email') = ANY (ARRAY[
    'admin@mpsgroup.com',
    'kyle@bushels.com',
    'admin@bushels.com',
    'kylegronning@mpsgroup.ca'
  ]) as matches_allowlist;

-- Step 4: Check current RLS policies on storage_requests
SELECT
  '=== STORAGE_REQUESTS UPDATE POLICIES ===' as test,
  policyname,
  cmd,
  CASE
    WHEN qual IS NOT NULL THEN LEFT(qual::text, 100)
    ELSE 'N/A'
  END as using_clause
FROM pg_policies
WHERE tablename = 'storage_requests'
  AND cmd = 'UPDATE'
ORDER BY policyname;

-- Step 5: Try to select a request (should work)
SELECT
  '=== CAN YOU SELECT REQUESTS? ===' as test,
  COUNT(*) as total_requests,
  COUNT(*) FILTER (WHERE status = 'PENDING') as pending_requests
FROM storage_requests;

-- Step 6: Check if approved_at and rejected_at columns exist
SELECT
  '=== STORAGE_REQUESTS COLUMNS ===' as test,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'storage_requests'
  AND column_name IN ('status', 'approved_at', 'rejected_at', 'assigned_location', 'assigned_rack_ids')
ORDER BY column_name;

-- Step 7: Get one pending request ID for testing
SELECT
  '=== SAMPLE PENDING REQUEST ===' as test,
  id,
  reference_id,
  status,
  user_email
FROM storage_requests
WHERE status = 'PENDING'
LIMIT 1;

-- ============================================================================
-- After running this, if everything looks good, try this UPDATE test:
-- (Replace 'YOUR_REQUEST_ID_HERE' with the ID from Step 7)
-- ============================================================================

-- UPDATE storage_requests
-- SET status = 'APPROVED',
--     approved_at = NOW(),
--     assigned_location = 'Test Location',
--     assigned_rack_ids = ARRAY['A-N-R1']
-- WHERE id = 'YOUR_REQUEST_ID_HERE';
--
-- If this works, the RLS policies are fine and the issue is in the application code
-- If this fails, we need to fix the RLS policies
