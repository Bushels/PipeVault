-- ============================================================================
-- EMERGENCY FIX: Admin Cannot See Storage Requests
-- Run this ENTIRE script in Supabase SQL Editor
-- ============================================================================

-- Step 1: Check what requests exist (bypasses RLS using service role)
SELECT
  '=== EXISTING REQUESTS ===' as step,
  id,
  reference_id,
  status,
  company_id,
  user_email,
  created_at
FROM storage_requests
ORDER BY created_at DESC
LIMIT 10;

-- Step 2: Check current RLS policies
SELECT
  '=== CURRENT RLS POLICIES ===' as step,
  policyname,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'storage_requests';

-- Step 3: DROP ALL POLICIES (clean slate)
DROP POLICY IF EXISTS "Users can view own company requests" ON storage_requests;
DROP POLICY IF EXISTS "Admins can view all requests" ON storage_requests;
DROP POLICY IF EXISTS "Allowlisted admins can view all requests" ON storage_requests;
DROP POLICY IF EXISTS "Users can create requests for own company" ON storage_requests;
DROP POLICY IF EXISTS "Admins can update all requests" ON storage_requests;
DROP POLICY IF EXISTS "Allowlisted admins can update all requests" ON storage_requests;
DROP POLICY IF EXISTS "Users can update own company requests" ON storage_requests;

-- Step 4: CREATE ADMIN POLICY (MOST CRITICAL)
CREATE POLICY "Allowlisted admins can view all requests"
  ON storage_requests FOR SELECT
  TO authenticated
  USING (
    lower(auth.jwt() ->> 'email') = ANY (ARRAY[
      'admin@mpsgroup.com',
      'kyle@bushels.com',
      'admin@bushels.com',
      'kylegronning@mpsgroup.ca'
    ])
  );

-- Step 5: CREATE CUSTOMER POLICY
CREATE POLICY "Users can view own company requests"
  ON storage_requests FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT id FROM companies
      WHERE lower(domain) = lower(split_part(auth.jwt() ->> 'email', '@', 2))
    )
  );

-- Step 6: CREATE INSERT POLICY
CREATE POLICY "Users can create requests for own company"
  ON storage_requests FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT id FROM companies
      WHERE lower(domain) = lower(split_part(auth.jwt() ->> 'email', '@', 2))
    )
  );

-- Step 7: CREATE ADMIN UPDATE POLICY
CREATE POLICY "Allowlisted admins can update all requests"
  ON storage_requests FOR UPDATE
  TO authenticated
  USING (
    lower(auth.jwt() ->> 'email') = ANY (ARRAY[
      'admin@mpsgroup.com',
      'kyle@bushels.com',
      'admin@bushels.com',
      'kylegronning@mpsgroup.ca'
    ])
  )
  WITH CHECK (
    lower(auth.jwt() ->> 'email') = ANY (ARRAY[
      'admin@mpsgroup.com',
      'kyle@bushels.com',
      'admin@bushels.com',
      'kylegronning@mpsgroup.ca'
    ])
  );

-- Step 8: CREATE CUSTOMER UPDATE POLICY
CREATE POLICY "Users can update own company requests"
  ON storage_requests FOR UPDATE
  TO authenticated
  USING (
    company_id IN (
      SELECT id FROM companies
      WHERE lower(domain) = lower(split_part(auth.jwt() ->> 'email', '@', 2))
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT id FROM companies
      WHERE lower(domain) = lower(split_part(auth.jwt() ->> 'email', '@', 2))
    )
  );

-- Step 9: Verify policies were created
SELECT
  '=== NEW POLICIES CREATED ===' as step,
  policyname,
  cmd
FROM pg_policies
WHERE tablename = 'storage_requests'
ORDER BY policyname;

-- Step 10: Test as your admin user (run this while logged in as kylegronning@mpsgroup.ca)
-- SELECT
--   auth.jwt() ->> 'email' as my_email,
--   lower(auth.jwt() ->> 'email') as lowercased,
--   lower(auth.jwt() ->> 'email') = ANY (ARRAY[
--     'admin@mpsgroup.com',
--     'kyle@bushels.com',
--     'admin@bushels.com',
--     'kylegronning@mpsgroup.ca'
--   ]) as should_match_allowlist;

-- ============================================================================
-- SUCCESS! After running this, refresh your admin dashboard.
-- The requests should appear in the Approvals tab.
-- ============================================================================
