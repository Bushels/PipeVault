-- Migration: Add RLS Policies for Company Metadata Management
-- Purpose: Allow admins to manage company lifecycle (archive, unarchive, mark as customer/non-customer)
-- Author: Database Integrity Guardian Agent
-- Date: 2025-11-10
--
-- Security model:
-- - All authenticated users can SELECT companies (existing behavior)
-- - Only admins can UPDATE company metadata columns (is_customer, is_archived, etc.)
-- - Customers cannot modify their own company metadata

-- ============================================================================
-- STEP 1: Verify RLS is Enabled
-- ============================================================================

-- Ensure RLS is enabled on companies table
-- (Should already be enabled, but verify)
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 2: Create Admin Helper Function (If Not Exists)
-- ============================================================================

-- Check if is_admin() function exists
-- This function is used by RLS policies to determine admin status
CREATE OR REPLACE FUNCTION public.is_admin(user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.admin_users
    WHERE admin_users.user_id = is_admin.user_id
      AND admin_users.is_active = true
  );
$$;

COMMENT ON FUNCTION public.is_admin(UUID) IS
  'Returns true if the given user_id is an active admin. ' ||
  'Used by RLS policies to grant admin privileges. ' ||
  'SECURITY DEFINER allows checking admin_users table.';

-- ============================================================================
-- STEP 3: Add UPDATE Policy for Admin Metadata Management
-- ============================================================================

-- Drop existing policy if it exists (idempotent)
DROP POLICY IF EXISTS "Admins can manage company metadata" ON public.companies;

-- Create policy allowing admins to update company metadata
CREATE POLICY "Admins can manage company metadata"
  ON public.companies
  FOR UPDATE
  TO authenticated
  USING (
    -- Admin can update any company
    public.is_admin(auth.uid())
  )
  WITH CHECK (
    -- Admin can set any values (no restrictions)
    public.is_admin(auth.uid())
  );

COMMENT ON POLICY "Admins can manage company metadata" ON public.companies IS
  'Allows admin users to update company records, including lifecycle metadata ' ||
  '(is_customer, is_archived, archived_at, deleted_at). ' ||
  'Regular users cannot update company records.';

-- ============================================================================
-- STEP 4: Verify Existing SELECT Policies Still Work
-- ============================================================================

-- Ensure existing SELECT policies are not affected
-- Customers should still be able to view their own company
-- Admins should be able to view all companies

-- Check existing SELECT policies:
-- SELECT polname, polcmd, polpermissive, polroles::regrole[], pg_get_expr(polqual, polrelid) as qual
-- FROM pg_policy
-- WHERE polrelid = 'public.companies'::regclass
--   AND polcmd = 'r';

-- ============================================================================
-- STEP 5: Add INSERT Policy (If Needed)
-- ============================================================================

-- Note: Companies are typically created via signup flow, not manual INSERT
-- If needed, add INSERT policy here
-- For now, assume service role handles company creation

-- ============================================================================
-- STEP 6: Add DELETE Policy (Prevent Accidental Deletion)
-- ============================================================================

-- Prevent DELETE entirely - use soft delete (deleted_at) instead
DROP POLICY IF EXISTS "Prevent company deletion" ON public.companies;

CREATE POLICY "Prevent company deletion"
  ON public.companies
  FOR DELETE
  TO authenticated
  USING (false);  -- Never allow DELETE

COMMENT ON POLICY "Prevent company deletion" ON public.companies IS
  'Prevents hard deletion of company records. ' ||
  'Use soft delete (deleted_at column) instead for GDPR compliance and audit trail.';

-- ============================================================================
-- VALIDATION QUERIES (Run manually after migration)
-- ============================================================================

-- Verify policies are created
-- SELECT
--   polname,
--   polcmd,
--   polpermissive,
--   pg_get_expr(polqual, polrelid) as using_expr,
--   pg_get_expr(polwithcheck, polrelid) as with_check_expr
-- FROM pg_policy
-- WHERE polrelid = 'public.companies'::regclass
-- ORDER BY polname;

-- Test admin can update company metadata (run as admin user)
-- UPDATE companies SET is_archived = true WHERE id = 'some-uuid';

-- Test non-admin cannot update (should fail with RLS violation)
-- UPDATE companies SET is_archived = true WHERE id = 'some-uuid';
