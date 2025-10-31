-- ============================================================================
-- FIX ADMIN ACCESS - Proper Schema Update
-- This fixes the root cause by adding user_id to admin_users table
-- Run this in Supabase SQL Editor
-- ============================================================================

-- Step 1: Add user_id column to admin_users table
ALTER TABLE admin_users
ADD COLUMN IF NOT EXISTS user_id UUID UNIQUE;

-- Step 2: Add foreign key constraint to auth.users
-- Note: This references Supabase's internal auth.users table
ALTER TABLE admin_users
DROP CONSTRAINT IF EXISTS admin_users_user_id_fkey;

ALTER TABLE admin_users
ADD CONSTRAINT admin_users_user_id_fkey
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Step 3: Create index for performance
CREATE INDEX IF NOT EXISTS idx_admin_users_user_id ON admin_users(user_id);

-- Step 4: Insert/Update admin user records
-- IMPORTANT: Replace these with your actual Supabase Auth user IDs
-- To get your user ID, run: SELECT id, email FROM auth.users;

-- Example: Update existing admin record with user_id
-- UPDATE admin_users
-- SET user_id = (SELECT id FROM auth.users WHERE email = 'kylegronning@mpsgroup.ca')
-- WHERE email = 'kylegronning@mpsgroup.ca';

-- Or insert a new admin record if it doesn't exist:
INSERT INTO admin_users (email, name, role, user_id)
SELECT
  email,
  COALESCE(raw_user_meta_data->>'full_name', email) as name,
  'admin' as role,
  id as user_id
FROM auth.users
WHERE email IN (
  'kylegronning@mpsgroup.ca',
  'admin@mpsgroup.com',
  'kyle@bushels.com',
  'admin@bushels.com'
)
ON CONFLICT (email)
DO UPDATE SET
  user_id = EXCLUDED.user_id,
  updated_at = NOW();

-- Step 5: Verify admin users are properly set up
SELECT
  '=== ADMIN USERS ===' as step,
  email,
  name,
  user_id,
  is_active
FROM admin_users
ORDER BY email;

-- Step 6: Check if your current user is in the admin table
SELECT
  '=== YOUR AUTH USER ===' as step,
  id as user_id,
  email,
  (SELECT COUNT(*) FROM admin_users WHERE user_id = auth.users.id) as is_in_admin_table
FROM auth.users
WHERE id = auth.uid();

-- ============================================================================
-- SUCCESS! After running this:
-- 1. Your admin_users table now has user_id column
-- 2. Admin records are linked to Supabase Auth users
-- 3. The RLS policies in rls-policies-fix.sql should now work
-- 4. Refresh your app and you should see storage requests!
-- ============================================================================
