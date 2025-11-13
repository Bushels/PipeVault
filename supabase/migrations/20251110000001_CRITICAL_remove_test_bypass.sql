-- ============================================================================
-- CRITICAL SECURITY FIX: Remove Test Mode Admin Bypass
-- ============================================================================
-- Issue: is_admin_user() returns true for anonymous users (auth.uid() IS NULL)
-- Risk: Anyone can call admin RPCs without authentication
-- Fix: Restore production-only admin check
--
-- ⚠️  DEPLOY IMMEDIATELY TO PRODUCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION is_admin_user()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Production: Only check admin_users table
  -- No test mode bypass - NULL auth.uid() returns false
  RETURN EXISTS (
    SELECT 1
    FROM admin_users
    WHERE user_id = auth.uid()
  );
END;
$$;

COMMENT ON FUNCTION is_admin_user() IS
'Production: Returns true only if authenticated user is in admin_users table. No anonymous access.';

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- This should return false when run from SQL Editor (anonymous)
SELECT is_admin_user() as is_admin;
-- Expected: false

-- Verify admin RPC functions are now secured
DO $$
BEGIN
  BEGIN
    PERFORM approve_storage_request_atomic(
      'test-uuid'::uuid,
      ARRAY['test-rack']::text[],
      100,
      'test'
    );
    RAISE EXCEPTION 'SECURITY FAILURE: Anonymous user was able to approve request';
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM LIKE '%Access denied%' THEN
        RAISE NOTICE 'SUCCESS: Admin check is working correctly';
      ELSE
        RAISE;
      END IF;
  END;
END $$;

-- ============================================================================
-- POST-DEPLOYMENT VERIFICATION
-- ============================================================================

-- 1. Verify is_admin_user() returns false for anonymous
-- 2. Verify admin RPCs throw "Access denied" for anonymous
-- 3. Add your admin user to admin_users table:
--    INSERT INTO admin_users (user_id) VALUES ('<your-auth-uid>');
-- 4. Test approval workflow as authenticated admin user
