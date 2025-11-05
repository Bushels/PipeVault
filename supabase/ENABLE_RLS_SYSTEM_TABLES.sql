-- Migration: Enable RLS on system tables
-- Purpose: Fix security issue - 3 tables exposed without RLS protection
-- Date: 2025-11-05
--
-- Security Advisory: Tables without RLS are publicly accessible via PostgREST API
-- This migration enables RLS and creates appropriate policies for:
-- 1. admin_allowlist - Admin email whitelist
-- 2. notification_queue - Notification queue for processing
-- 3. notifications_log - Notification history log

-- ============================================================================
-- 1. ENABLE RLS ON admin_allowlist
-- ============================================================================

ALTER TABLE admin_allowlist ENABLE ROW LEVEL SECURITY;

-- Policy: Only admins can view the allowlist
CREATE POLICY "Admins can view admin allowlist"
ON admin_allowlist
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM admin_users
    WHERE admin_users.email = auth.jwt() ->> 'email'
  )
);

-- Policy: Only admins can add to allowlist
CREATE POLICY "Admins can insert into allowlist"
ON admin_allowlist
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM admin_users
    WHERE admin_users.email = auth.jwt() ->> 'email'
  )
);

-- Policy: Only admins can remove from allowlist
CREATE POLICY "Admins can delete from allowlist"
ON admin_allowlist
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM admin_users
    WHERE admin_users.email = auth.jwt() ->> 'email'
  )
);

-- ============================================================================
-- 2. ENABLE RLS ON notification_queue
-- ============================================================================

ALTER TABLE notification_queue ENABLE ROW LEVEL SECURITY;

-- Policy: Service role can manage notification queue
CREATE POLICY "Service role can manage notification queue"
ON notification_queue
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Policy: Admins can view notification queue
CREATE POLICY "Admins can view notification queue"
ON notification_queue
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM admin_users
    WHERE admin_users.email = auth.jwt() ->> 'email'
  )
);

-- ============================================================================
-- 3. ENABLE RLS ON notifications_log
-- ============================================================================

ALTER TABLE notifications_log ENABLE ROW LEVEL SECURITY;

-- Policy: Service role can insert into notifications log
CREATE POLICY "Service role can insert into notifications log"
ON notifications_log
FOR INSERT
TO service_role
WITH CHECK (true);

-- Policy: Service role can update notifications log
CREATE POLICY "Service role can update notifications log"
ON notifications_log
FOR UPDATE
TO service_role
USING (true);

-- Policy: Admins can view notifications log
CREATE POLICY "Admins can view notifications log"
ON notifications_log
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM admin_users
    WHERE admin_users.email = auth.jwt() ->> 'email'
  )
);

-- Policy: Users can view their own notifications (email stored in payload JSONB)
CREATE POLICY "Users can view their own notifications"
ON notifications_log
FOR SELECT
TO authenticated
USING (
  payload->>'to' = auth.jwt() ->> 'email'
);

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Verify RLS is enabled on all three tables
SELECT
  schemaname,
  tablename,
  rowsecurity AS rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('admin_allowlist', 'notification_queue', 'notifications_log')
ORDER BY tablename;

-- Count policies for each table
SELECT
  schemaname,
  tablename,
  COUNT(*) as policy_count
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('admin_allowlist', 'notification_queue', 'notifications_log')
GROUP BY schemaname, tablename
ORDER BY tablename;

-- Add comments for documentation
COMMENT ON TABLE admin_allowlist IS 'Admin email allowlist - RLS enabled (admin-only access)';
COMMENT ON TABLE notification_queue IS 'Notification queue for processing - RLS enabled (service role + admin access)';
COMMENT ON TABLE notifications_log IS 'Notification history log - RLS enabled (users can view their own, admins can view all)';
