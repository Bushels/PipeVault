-- ============================================================================
-- FIX UPDATE POLICIES - Clean rebuild of storage_requests UPDATE policies
-- This ensures admins can approve/reject requests
-- ============================================================================

-- Step 1: DROP ALL existing UPDATE policies on storage_requests
DROP POLICY IF EXISTS "Admins can update all requests" ON storage_requests;
DROP POLICY IF EXISTS "Allowlisted admins can update all requests" ON storage_requests;
DROP POLICY IF EXISTS "Users can update own company requests" ON storage_requests;

-- Step 2: Recreate policies in the correct order (most permissive first)

-- POLICY 1: Allowlisted admin emails (fallback, always works)
CREATE POLICY "Allowlisted admins can update all requests"
  ON storage_requests FOR UPDATE
  TO authenticated
  USING (
    (SELECT auth.jwt() ->> 'email') = ANY (ARRAY[
      'admin@mpsgroup.com',
      'kyle@bushels.com',
      'admin@bushels.com',
      'kylegronning@mpsgroup.ca'
    ])
  )
  WITH CHECK (
    (SELECT auth.jwt() ->> 'email') = ANY (ARRAY[
      'admin@mpsgroup.com',
      'kyle@bushels.com',
      'admin@bushels.com',
      'kylegronning@mpsgroup.ca'
    ])
  );

-- POLICY 2: Admins via admin_users table (checks user_id)
CREATE POLICY "Admins can update all requests"
  ON storage_requests FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
        AND admin_users.is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
        AND admin_users.is_active = true
    )
  );

-- POLICY 3: Users can update their own company's requests
CREATE POLICY "Users can update own company requests"
  ON storage_requests FOR UPDATE
  TO authenticated
  USING (
    company_id IN (
      SELECT id FROM companies
      WHERE lower(domain) = lower(split_part((SELECT auth.jwt() ->> 'email'), '@', 2))
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT id FROM companies
      WHERE lower(domain) = lower(split_part((SELECT auth.jwt() ->> 'email'), '@', 2))
    )
  );

-- Step 3: Verify policies were created
SELECT
  '=== NEW UPDATE POLICIES ===' as result,
  policyname,
  cmd
FROM pg_policies
WHERE tablename = 'storage_requests'
  AND cmd = 'UPDATE'
ORDER BY policyname;

-- Step 4: Test if your email matches the allowlist
SELECT
  '=== YOUR EMAIL TEST ===' as result,
  (SELECT auth.jwt() ->> 'email') as your_email,
  (SELECT auth.jwt() ->> 'email') = ANY (ARRAY[
    'admin@mpsgroup.com',
    'kyle@bushels.com',
    'admin@bushels.com',
    'kylegronning@mpsgroup.ca'
  ]) as matches_allowlist;

-- Step 5: Test if you're in admin_users table
SELECT
  '=== ADMIN_USERS CHECK ===' as result,
  auth.uid() as your_user_id,
  EXISTS (
    SELECT 1 FROM admin_users
    WHERE admin_users.user_id = auth.uid()
      AND admin_users.is_active = true
  ) as in_admin_users;

-- ============================================================================
-- SUCCESS! After running this:
-- 1. All UPDATE policies are recreated cleanly
-- 2. Simplified syntax (removed lower() from jwt check)
-- 3. Admin check includes is_active = true
-- 4. Refresh your app and try approving again
-- ============================================================================
