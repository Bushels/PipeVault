-- ============================================================================
-- TEST MODE: Admin Bypass for SQL Editor Testing
-- ============================================================================
-- This allows testing approval functions from SQL Editor (service role)
-- while maintaining security for authenticated app users
--
-- ⚠️  REMOVE THIS BYPASS BEFORE PRODUCTION DEPLOYMENT
-- ============================================================================

CREATE OR REPLACE FUNCTION is_admin_user()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- TEST MODE: Allow SQL Editor (service role has auth.uid() = null)
  -- ⚠️  REMOVE THIS BEFORE PRODUCTION
  IF auth.uid() IS NULL THEN
    RETURN true;
  END IF;

  -- Production: Check admin_users table
  RETURN EXISTS (
    SELECT 1
    FROM admin_users
    WHERE user_id = auth.uid()
  );
END;
$$;

COMMENT ON FUNCTION is_admin_user() IS
'TEST MODE: Returns true for service role (SQL Editor). Remove bypass before production!';

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- This should now return true when run from SQL Editor
SELECT is_admin_user() as is_admin;

-- Expected: is_admin = true (because auth.uid() is null in SQL Editor)
