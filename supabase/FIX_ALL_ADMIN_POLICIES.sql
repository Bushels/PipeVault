-- ============================================================================
-- FIX ALL ADMIN POLICIES - Comprehensive fix for admin access
-- This rebuilds ALL storage_requests policies to ensure admins can see and update requests
-- ============================================================================

-- STEP 1: DROP ALL existing policies on storage_requests
DROP POLICY IF EXISTS "Users can view own company requests" ON storage_requests;
DROP POLICY IF EXISTS "Admins can view all requests" ON storage_requests;
DROP POLICY IF EXISTS "Allowlisted admins can view all requests" ON storage_requests;
DROP POLICY IF EXISTS "Users can create requests for own company" ON storage_requests;
DROP POLICY IF EXISTS "Admins can update all requests" ON storage_requests;
DROP POLICY IF EXISTS "Allowlisted admins can update all requests" ON storage_requests;
DROP POLICY IF EXISTS "Users can update own company requests" ON storage_requests;

-- ============================================================================
-- STEP 2: CREATE SELECT POLICIES (who can see requests)
-- ============================================================================

-- SELECT POLICY 1: Allowlisted admin emails (most permissive, always works)
CREATE POLICY "Allowlisted admins can view all requests"
  ON storage_requests FOR SELECT
  TO authenticated
  USING (
    (auth.jwt() ->> 'email') IN (
      'admin@mpsgroup.com',
      'kyle@bushels.com',
      'admin@bushels.com',
      'kylegronning@mpsgroup.ca'
    )
  );

-- SELECT POLICY 2: Admins via admin_users table
CREATE POLICY "Admins can view all requests"
  ON storage_requests FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
        AND admin_users.is_active = true
    )
  );

-- SELECT POLICY 3: Users can view their own company's requests
CREATE POLICY "Users can view own company requests"
  ON storage_requests FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT id FROM companies
      WHERE lower(domain) = lower(split_part(auth.jwt() ->> 'email', '@', 2))
    )
  );

-- ============================================================================
-- STEP 3: CREATE INSERT POLICIES (who can create requests)
-- ============================================================================

CREATE POLICY "Users can create requests for own company"
  ON storage_requests FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT id FROM companies
      WHERE lower(domain) = lower(split_part(auth.jwt() ->> 'email', '@', 2))
    )
  );

-- ============================================================================
-- STEP 4: CREATE UPDATE POLICIES (who can modify requests)
-- ============================================================================

-- UPDATE POLICY 1: Allowlisted admin emails (most permissive)
CREATE POLICY "Allowlisted admins can update all requests"
  ON storage_requests FOR UPDATE
  TO authenticated
  USING (
    (auth.jwt() ->> 'email') IN (
      'admin@mpsgroup.com',
      'kyle@bushels.com',
      'admin@bushels.com',
      'kylegronning@mpsgroup.ca'
    )
  )
  WITH CHECK (
    (auth.jwt() ->> 'email') IN (
      'admin@mpsgroup.com',
      'kyle@bushels.com',
      'admin@bushels.com',
      'kylegronning@mpsgroup.ca'
    )
  );

-- UPDATE POLICY 2: Admins via admin_users table
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

-- UPDATE POLICY 3: Users can update their own company's requests
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

-- ============================================================================
-- STEP 5: VERIFICATION
-- ============================================================================

-- Show all policies we just created
SELECT
  '=== ALL STORAGE_REQUESTS POLICIES ===' as result,
  policyname,
  cmd
FROM pg_policies
WHERE tablename = 'storage_requests'
ORDER BY cmd, policyname;

-- Test your email
SELECT
  '=== EMAIL TEST ===' as result,
  auth.jwt() ->> 'email' as your_email,
  (auth.jwt() ->> 'email') IN (
    'admin@mpsgroup.com',
    'kyle@bushels.com',
    'admin@bushels.com',
    'kylegronning@mpsgroup.ca'
  ) as in_allowlist;

-- Test admin_users lookup
SELECT
  '=== ADMIN_USERS TEST ===' as result,
  auth.uid() as your_user_id,
  EXISTS (
    SELECT 1 FROM admin_users
    WHERE admin_users.user_id = auth.uid()
      AND admin_users.is_active = true
  ) as in_admin_table;

-- Count requests you should see
SELECT
  '=== REQUEST COUNT ===' as result,
  COUNT(*) as total_requests,
  COUNT(*) FILTER (WHERE status = 'PENDING') as pending_requests
FROM storage_requests;

-- ============================================================================
-- SUCCESS! After running this script:
-- 1. All policies use simplified syntax (no lower() on jwt email)
-- 2. Email check uses IN instead of = ANY
-- 3. All policies check is_active = true for admin_users
-- 4. Refresh your app (Ctrl+Shift+R) and the 3 requests should appear!
-- ============================================================================
