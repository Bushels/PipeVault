-- ============================================================================
-- USER METADATA REFERENCE
-- ============================================================================
-- This document describes the user metadata stored in Supabase Auth
-- Metadata is automatically stored in auth.users.raw_user_meta_data
-- No additional tables or migrations are needed
--
-- Run this query to check user metadata:
-- SELECT id, email, raw_user_meta_data FROM auth.users;
-- ============================================================================

-- CUSTOMER SIGNUP METADATA
-- When a customer signs up, we store the following metadata:
-- {
--   "first_name": "John",           -- Customer's first name
--   "last_name": "Doe",              -- Customer's last name
--   "company_name": "Acme Corp",     -- Company name
--   "contact_number": "555-1234"     -- Contact phone number
-- }

-- ADMIN SIGNUP METADATA
-- When an admin signs up, no additional metadata is required
-- Admin status is determined by:
--   1. Email whitelist in AuthContext.tsx
--   2. admin_users table lookup
--   3. app_metadata.role = 'admin' (if set manually)

-- ============================================================================
-- QUERY EXAMPLES
-- ============================================================================

-- View all user metadata
SELECT
  id,
  email,
  raw_user_meta_data->>'first_name' as first_name,
  raw_user_meta_data->>'last_name' as last_name,
  raw_user_meta_data->>'company_name' as company_name,
  raw_user_meta_data->>'contact_number' as contact_number,
  created_at
FROM auth.users
ORDER BY created_at DESC;

-- Find users by company
SELECT
  email,
  raw_user_meta_data->>'first_name' || ' ' || raw_user_meta_data->>'last_name' as full_name,
  raw_user_meta_data->>'company_name' as company
FROM auth.users
WHERE raw_user_meta_data->>'company_name' ILIKE '%search_term%';

-- Count users by company
SELECT
  raw_user_meta_data->>'company_name' as company,
  COUNT(*) as user_count
FROM auth.users
WHERE raw_user_meta_data->>'company_name' IS NOT NULL
GROUP BY raw_user_meta_data->>'company_name'
ORDER BY user_count DESC;

-- ============================================================================
-- UPDATING USER METADATA
-- ============================================================================

-- Update user metadata (example - run via Supabase Dashboard or API)
-- Note: This is typically done via the signup flow, not manually
/*
UPDATE auth.users
SET raw_user_meta_data = jsonb_set(
  COALESCE(raw_user_meta_data, '{}'::jsonb),
  '{first_name}',
  '"UpdatedFirstName"'
)
WHERE email = 'user@example.com';
*/

-- ============================================================================
-- NOTES
-- ============================================================================
-- 1. User metadata is stored in auth.users table (managed by Supabase Auth)
-- 2. No schema migrations needed - metadata is flexible JSONB
-- 3. Previous users with 'full_name' field will need to be migrated
-- 4. New signups will use 'first_name' and 'last_name' fields
-- 5. The app handles both formats for backwards compatibility
