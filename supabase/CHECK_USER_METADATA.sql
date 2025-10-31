-- ============================================================================
-- CHECK USER METADATA - Diagnose Missing Name/Company Issue
-- ============================================================================
-- Run this in Supabase SQL Editor to see what metadata is actually stored

-- 1. Check bushelsenergy user metadata
SELECT
  id,
  email,
  raw_user_meta_data,
  raw_user_meta_data->>'full_name' as full_name,
  raw_user_meta_data->>'company_name' as company_name,
  raw_user_meta_data->>'contact_number' as contact_number,
  created_at
FROM auth.users
WHERE email ILIKE '%bushelsenergy%'
ORDER BY created_at DESC
LIMIT 5;

-- 2. Check all non-system users to see their metadata
SELECT
  email,
  raw_user_meta_data,
  created_at
FROM auth.users
WHERE email NOT LIKE '%supabase%'
ORDER BY created_at DESC;

-- ============================================================================
-- FIX: Manually Add Missing Metadata (if needed)
-- ============================================================================
-- If the query above shows that full_name or company_name is NULL,
-- you can manually add it using this UPDATE statement.
--
-- IMPORTANT: Replace 'user@bushelsenergy.com' with the actual email address
--            and fill in the correct name/company values

/*
UPDATE auth.users
SET raw_user_meta_data = raw_user_meta_data || jsonb_build_object(
  'full_name', 'John Doe',
  'company_name', 'Bushels Energy',
  'contact_number', '555-1234'
)
WHERE email = 'user@bushelsenergy.com';
*/

-- After updating, verify the change:
/*
SELECT
  email,
  raw_user_meta_data->>'full_name' as full_name,
  raw_user_meta_data->>'company_name' as company_name
FROM auth.users
WHERE email = 'user@bushelsenergy.com';
*/
