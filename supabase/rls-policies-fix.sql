-- ============================================================================
-- RLS POLICIES FIX - Add policies for unrestricted tables
-- Run this in Supabase SQL Editor after running schema.sql
-- ============================================================================

-- ============================================================================
-- ADMIN USERS TABLE - Restrict access
-- ============================================================================
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- Only admins can read admin_users table
-- For now, we'll allow authenticated users to check if an email is admin
-- In production, you'd use a custom JWT claim
CREATE POLICY "Authenticated users can read admin_users"
  ON admin_users FOR SELECT
  TO authenticated
  USING (true);

-- Only service role can modify admin_users
-- (This means only backend/Edge Functions can add/update admins)

-- ============================================================================
-- YARD TABLES - Public read, admin write
-- ============================================================================
ALTER TABLE yards ENABLE ROW LEVEL SECURITY;
ALTER TABLE yard_areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE racks ENABLE ROW LEVEL SECURITY;

-- Anyone can view yard information (needed for capacity display)
CREATE POLICY "Public can view yards"
  ON yards FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Public can view yard areas"
  ON yard_areas FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Public can view racks"
  ON racks FOR SELECT
  TO public
  USING (true);

-- Only authenticated users (admins) can modify yard data
CREATE POLICY "Authenticated users can update racks"
  ON racks FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Service role can insert/delete (for setup only)
-- This is handled automatically by Supabase

-- ============================================================================
-- TRUCK LOADS - Add missing policies
-- ============================================================================

-- Authenticated users can view truck loads for their company
CREATE POLICY "Users can view own company truck loads"
  ON truck_loads FOR SELECT
  TO authenticated
  USING (
    related_request_id IN (
      SELECT id FROM storage_requests
      WHERE company_id IN (
        SELECT id FROM companies
        WHERE domain = split_part(auth.jwt()->>'email', '@', 2)
      )
    )
  );

-- Authenticated users can create truck loads (for delivery/pickup scheduling)
CREATE POLICY "Authenticated users can create truck loads"
  ON truck_loads FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ============================================================================
-- DOCUMENTS - Add missing write policies
-- ============================================================================

-- Users can insert documents for their own company
CREATE POLICY "Users can upload own company documents"
  ON documents FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT id FROM companies
      WHERE domain = split_part(auth.jwt()->>'email', '@', 2)
    )
  );

-- Users can view their own company's documents
CREATE POLICY "Users can view own company documents"
  ON documents FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT id FROM companies
      WHERE domain = split_part(auth.jwt()->>'email', '@', 2)
    )
  );

-- ============================================================================
-- STORAGE REQUESTS - Add missing write policies
-- ============================================================================

-- Users can create requests for their own company
CREATE POLICY "Users can create requests for own company"
  ON storage_requests FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT id FROM companies
      WHERE domain = split_part(auth.jwt()->>'email', '@', 2)
    )
  );

-- Users can update their own company's requests
CREATE POLICY "Users can update own company requests"
  ON storage_requests FOR UPDATE
  TO authenticated
  USING (
    company_id IN (
      SELECT id FROM companies
      WHERE domain = split_part(auth.jwt()->>'email', '@', 2)
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT id FROM companies
      WHERE domain = split_part(auth.jwt()->>'email', '@', 2)
    )
  );

-- ============================================================================
-- INVENTORY - Add missing write policies
-- ============================================================================

-- Users can insert inventory for their own company
CREATE POLICY "Users can create own company inventory"
  ON inventory FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT id FROM companies
      WHERE domain = split_part(auth.jwt()->>'email', '@', 2)
    )
  );

-- Users can update their own company's inventory
CREATE POLICY "Users can update own company inventory"
  ON inventory FOR UPDATE
  TO authenticated
  USING (
    company_id IN (
      SELECT id FROM companies
      WHERE domain = split_part(auth.jwt()->>'email', '@', 2)
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT id FROM companies
      WHERE domain = split_part(auth.jwt()->>'email', '@', 2)
    )
  );

-- ============================================================================
-- CONVERSATIONS - Add missing write policies
-- ============================================================================

-- Users can create their own conversations
CREATE POLICY "Users can create own conversations"
  ON conversations FOR INSERT
  TO authenticated
  WITH CHECK (user_email = auth.jwt()->>'email');

-- Users can update their own conversations
CREATE POLICY "Users can update own conversations"
  ON conversations FOR UPDATE
  TO authenticated
  USING (user_email = auth.jwt()->>'email')
  WITH CHECK (user_email = auth.jwt()->>'email');

-- ============================================================================
-- NOTIFICATIONS - Add missing policies
-- ============================================================================

-- Admins can view their notifications
CREATE POLICY "Admins can view own notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING (
    admin_user_id IS NULL OR -- Broadcast notifications
    admin_user_id IN (
      SELECT id FROM admin_users WHERE email = auth.jwt()->>'email'
    )
  );

-- Admins can update their notifications (mark as read)
CREATE POLICY "Admins can update own notifications"
  ON notifications FOR UPDATE
  TO authenticated
  USING (
    admin_user_id IN (
      SELECT id FROM admin_users WHERE email = auth.jwt()->>'email'
    )
  )
  WITH CHECK (
    admin_user_id IN (
      SELECT id FROM admin_users WHERE email = auth.jwt()->>'email'
    )
  );

-- ============================================================================
-- IMPORTANT: For MVP/Testing
-- ============================================================================
-- If you want to temporarily disable RLS for testing, run:
-- ALTER TABLE table_name DISABLE ROW LEVEL SECURITY;
--
-- But NEVER do this in production!
--
-- For admin operations (like approving requests), you should:
-- 1. Use Supabase service role key in Edge Functions
-- 2. Or add a custom JWT claim for admin users
-- 3. Or use the Supabase dashboard to perform admin operations

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Check which tables have RLS enabled:
-- SELECT tablename, rowsecurity
-- FROM pg_tables
-- WHERE schemaname = 'public';

-- Check policies for a specific table:
-- SELECT * FROM pg_policies WHERE tablename = 'storage_requests';

-- Test your policies by:
-- 1. Create a test user in Supabase Auth
-- 2. Try to query tables as that user
-- 3. Verify they can only see their own company's data
