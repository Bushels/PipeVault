# Test Mode Admin Bypass

## Purpose

Allows testing the approval workflow functions from Supabase SQL Editor (service role context) without requiring an authenticated user session.

## What This Does

The `is_admin_user()` function is temporarily modified to:
- Return `true` when `auth.uid()` is null (SQL Editor / service role context)
- Continue checking `admin_users` table for authenticated app users

## Security Impact

⚠️ **This bypass ONLY affects service role context** (SQL Editor, backend scripts)

✅ **App users are still protected:** The function still checks `admin_users` table for authenticated sessions

## Deployment

**File:** `supabase/migrations/20251109000005_test_mode_admin_bypass.sql`

Deploy this migration to enable testing:
1. Open Supabase SQL Editor
2. Paste and execute the migration
3. Verify: `SELECT is_admin_user();` should return `true`

## Testing Workflow

Once deployed, you can test the approval functions:

```sql
-- Test 1: Approve the fixture request
SELECT approve_storage_request_atomic(
  p_request_id := '13890948-9fd5-439e-8c2a-325e121f8ad0',
  p_assigned_rack_ids := ARRAY['A-A1-10']::TEXT[],
  p_required_joints := 50,
  p_notes := 'Testing schema alignment fix'
);

-- Test 2: Verify rack occupancy increased
SELECT id, name, capacity, occupied, (capacity - occupied) as available
FROM racks
WHERE id = 'A-A1-10';

-- Test 3: Check notification queue
SELECT type, payload->>'userEmail' as recipient, payload->>'subject' as subject, processed
FROM notification_queue
ORDER BY created_at DESC
LIMIT 3;

-- Test 4: Check audit log
SELECT admin_user_id, action, details->>'referenceId' as ref, created_at
FROM admin_audit_log
ORDER BY created_at DESC
LIMIT 3;
```

## Removing Test Mode (Required Before Production)

**⚠️ IMPORTANT:** Remove this bypass before deploying to production!

### Option A: Revert to Production Version

```sql
CREATE OR REPLACE FUNCTION is_admin_user()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Production: Only check admin_users table
  RETURN EXISTS (
    SELECT 1
    FROM admin_users
    WHERE user_id = auth.uid()
  );
END;
$$;

COMMENT ON FUNCTION is_admin_user() IS
'Production: Returns true if authenticated user is in admin_users table';
```

### Option B: Add Actual Admin Users

Instead of using test mode, add your admin user(s):

```sql
-- Get your user ID from Supabase Auth dashboard
INSERT INTO admin_users (user_id, created_at)
VALUES
  ('<your-auth-user-id>', NOW()),
  ('<another-admin-user-id>', NOW())
ON CONFLICT (user_id) DO NOTHING;
```

## Why This Is Safe for Testing

1. **Service role only:** The bypass only activates when `auth.uid()` is null
2. **SQL Editor context:** Regular app users always have `auth.uid()` set
3. **RLS still enforced:** Row Level Security policies are independent
4. **Easy to remove:** Single migration reverts to production version

## Verification After Removal

After removing test mode, verify security still works:

```sql
-- From SQL Editor (should return false after removal)
SELECT is_admin_user();

-- Expected: false (because auth.uid() is null and we removed bypass)
```

## Alternative: Frontend Testing

For end-to-end testing without bypass:

1. Create a test admin user in Supabase Auth
2. Add that user to `admin_users` table
3. Log in as that user in your app
4. Test approval workflow through AdminDashboard UI

This tests the full authentication flow without needing SQL Editor bypass.

---

## Summary

| Item | Status |
|------|--------|
| Purpose | Enable SQL Editor testing |
| Security Risk | Low (service role only) |
| Required for Testing | Yes (unless using authenticated session) |
| Required for Production | **NO - REMOVE BEFORE DEPLOY** |
| Easy to Remove | Yes (single SQL statement) |

**Deploy migration 20251109000005 → Run tests → Remove bypass before production!**
