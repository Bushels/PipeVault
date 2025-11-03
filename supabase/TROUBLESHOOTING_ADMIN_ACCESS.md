# Troubleshooting Admin Access to Storage Requests

## Problem
Admins cannot see storage requests in the Admin Dashboard, even though:
- Users can submit requests successfully
- Users can see their own requests
- Admin is logged in with a whitelisted email

## Root Cause
The `admin_users` table was missing the `user_id` column, causing RLS policies to fail silently. The policies were trying to check `admin_users.user_id` against the authenticated user's ID, but since that column didn't exist, the check always returned false.

## Solution: Fix the Schema (Recommended)

### Step 1: Run the Schema Fix
Open your Supabase SQL Editor and run the `FIX_ADMIN_SCHEMA.sql` file:

1. Go to https://supabase.com/dashboard/project/YOUR_PROJECT_REF
2. Navigate to **SQL Editor**
3. Copy and paste the contents of `FIX_ADMIN_SCHEMA.sql`
4. Click **Run**

This will:
- Add the `user_id` column to `admin_users`
- Link existing admin records to Supabase Auth users
- Create necessary indexes

### Step 2: Verify the Fix
After running the SQL, you should see output showing:
- Your admin users with their `user_id` values populated
- Your current user listed with `is_in_admin_table = 1`

### Step 3: Test
1. Refresh your PipeVault admin dashboard
2. Navigate to the **Approvals** tab
3. You should now see all pending storage requests!

## Alternative: Quick Email-Only Fix

If you need an immediate fix and don't want to modify the schema:

1. Run `EMERGENCY_FIX_ADMIN_ACCESS.sql` in Supabase SQL Editor
2. This removes the broken `admin_users` table checks
3. Uses email allowlist only (simpler but less flexible)

## Verifying Your Admin Status

To check if you're properly set up as an admin, run this query in Supabase SQL Editor:

```sql
-- Check your current user
SELECT
  id as user_id,
  email,
  raw_user_meta_data
FROM auth.users
WHERE id = auth.uid();

-- Check if you're in admin_users table
SELECT
  email,
  name,
  user_id,
  is_active
FROM admin_users
WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid());

-- Test the allowlist
SELECT
  lower((SELECT auth.jwt() ->> 'email')) as my_email,
  lower((SELECT auth.jwt() ->> 'email')) = ANY (ARRAY[
    'admin@mpsgroup.com',
    'kyle@bushels.com',
    'admin@bushels.com',
    'kylegronning@mpsgroup.ca'
  ]) as in_allowlist;
```

## Checking Storage Requests

To see all storage requests (bypassing RLS), run this in SQL Editor:

```sql
SELECT
  id,
  reference_id,
  status,
  company_id,
  user_email,
  created_at,
  request_details->>'companyName' as company_name
FROM storage_requests
ORDER BY created_at DESC
LIMIT 10;
```

## Understanding the Fix

### Before:
- `admin_users` table had: `id`, `email`, `name`, `role`
- RLS policies checked: `admin_users.user_id = auth.uid()` ❌ (column didn't exist)
- Result: Admin checks always failed

### After:
- `admin_users` table has: `id`, `user_id`, `email`, `name`, `role`
- RLS policies check: `admin_users.user_id = auth.uid()` ✅ (column exists!)
- Result: Admin checks work properly

## Future Prevention

The updated `schema.sql` now includes the `user_id` column by default. If you ever recreate the database:
1. Run `schema.sql` (includes user_id column)
2. Run `rls-policies-fix.sql` (RLS policies will work correctly)
3. Insert your admin users with their `user_id` values

## Still Not Working?

If you're still having issues after running the fix:

1. **Clear browser cache** and hard refresh (Ctrl+Shift+R)
2. **Sign out and sign back in** to refresh your JWT token
3. **Check browser console** for any errors
4. **Verify your email** is in the allowlist in both:
   - `rls-policies-fix.sql` (lines 200-206, 242-255)
   - `AuthContext.tsx` (lines 79-84)
5. **Check RLS is enabled**: Run `SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' AND tablename = 'storage_requests';`

## Need Help?

If the issue persists:
1. Check the browser console (F12) for errors
2. Check the Network tab to see if the Supabase query is returning data
3. Run the verification queries above and share the output
