# Admin Dashboard Troubleshooting Guide

## Problem: Admin Cannot See Storage Requests

This guide documents the root causes and solutions when admins cannot see storage requests in the Approvals tab.

---

## New: Open Storage Layout (Area A)
- Yard A now uses two slot-based rows: `A-A1-*` (west) and `A-A2-*` (east), each with 11 locations (north to south).
- Slot racks expose `allocation_mode = 'SLOT'` and report utilisation as occupied locations instead of joints/meters.
- Approval workflows log `[OpenStorage]` messages when rack metadata is missing. Check the browser console (admin UI) or server logs for these entries whenever Area A assignments fail.

---

## Quick Fix Checklist

When admin can't see requests, try these steps **in order**:

### 1. Sign Out and Sign Back In (Most Common Fix)
**Why:** Your JWT token is cached and doesn't include updated admin permissions.

**Steps:**
1. Click "Logout" in top right
2. Sign back in with your admin email
3. Check Approvals tab

**Success Rate:** 80% - This fixes most issues!

---

### 2. Verify Requests Exist in Database

**Run this in Supabase SQL Editor:**
```sql
SELECT
  id,
  reference_id,
  status,
  user_email,
  company_id,
  created_at
FROM storage_requests
WHERE status = 'PENDING'
ORDER BY created_at DESC
LIMIT 10;
```

**What to check:**
- ✅ If you see requests: Problem is RLS policies
- ❌ If no requests: Customers aren't submitting properly

---

### 3. Verify Your Admin Status

**Run this in Supabase SQL Editor:**
```sql
-- Check if you're in the email allowlist
SELECT
  '=== EMAIL ALLOWLIST CHECK ===' as test,
  auth.jwt() ->> 'email' as your_email,
  (auth.jwt() ->> 'email') IN (
    'admin@mpsgroup.com',
    'kyle@bushels.com',
    'admin@bushels.com',
    'kylegronning@mpsgroup.ca'
  ) as in_allowlist;

-- Check if you're in admin_users table
SELECT
  '=== ADMIN_USERS CHECK ===' as test,
  auth.uid() as your_user_id,
  email,
  user_id,
  is_active
FROM admin_users
WHERE user_id = auth.uid();
```

**What you need:**
- `in_allowlist: true` OR
- A record in `admin_users` with `is_active: true`

**If both are false:**
- Add your email to the allowlist in `FIX_ALL_ADMIN_POLICIES.sql`
- OR insert yourself into `admin_users` table

---

### 4. Verify RLS Policies Are Active

**Run this in Supabase SQL Editor:**
```sql
-- Check if SELECT policies exist
SELECT
  '=== STORAGE_REQUESTS SELECT POLICIES ===' as test,
  policyname,
  cmd
FROM pg_policies
WHERE tablename = 'storage_requests'
  AND cmd = 'SELECT'
ORDER BY policyname;
```

**You should see these 3 policies:**
1. `Allowlisted admins can view all requests`
2. `Admins can view all requests`
3. `Users can view own company requests`

**If policies are missing:**
- Run `supabase/FIX_ALL_ADMIN_POLICIES.sql` in SQL Editor

---

### 5. Test Your Access Directly

**Run this in Supabase SQL Editor (while logged in as admin):**
```sql
-- Test if you can see pending requests
SELECT
  COUNT(*) as pending_count,
  COUNT(*) FILTER (WHERE status = 'PENDING') as should_see_in_approvals
FROM storage_requests;
```

**What to check:**
- `pending_count > 0`: Requests exist
- `should_see_in_approvals > 0`: Requests should appear in Approvals tab

**If you get 0 rows:**
- RLS policies are blocking you
- Go to Step 6

---

### 6. Re-Run the Full Policy Fix

**This is the nuclear option - rebuilds all policies cleanly.**

1. Open Supabase SQL Editor
2. Run `supabase/FIX_ALL_ADMIN_POLICIES.sql` (entire file)
3. Verify output shows:
   - `in_allowlist: true` ✅
   - `in_admin_table: true` ✅
   - `pending_requests: [number > 0]` ✅
4. Sign out and sign back in
5. Check Approvals tab

**This should fix it!**

---

## Root Causes Explained

### Why does this happen?

**1. JWT Token Caching (Most Common)**
- Your browser caches your authentication token
- The token doesn't know about updated admin permissions
- Signing out/in generates a fresh token with latest permissions

**2. Missing admin_users Record**
- The `admin_users` table is missing a `user_id` column
- OR your user_id isn't in the table
- Solution: Run `FIX_ADMIN_SCHEMA.sql`

**3. RLS Policies Not Applied**
- The `storage_requests` table has RLS enabled
- But the SELECT policies aren't allowing admin access
- Solution: Run `FIX_ALL_ADMIN_POLICIES.sql`

**4. Email Case Sensitivity**
- Policies check emails case-sensitively
- Your JWT might have different casing than the allowlist
- Solution: Use `.maybeSingle()` and case-insensitive checks

---

## Prevention: How to Avoid This

### For New Admins
1. **Add to email allowlist** in `FIX_ALL_ADMIN_POLICIES.sql` (lines 25-29)
2. **Insert into admin_users table:**
   ```sql
   INSERT INTO admin_users (email, name, role, user_id)
   SELECT
     email,
     COALESCE(raw_user_meta_data->>'full_name', email) as name,
     'admin' as role,
     id as user_id
   FROM auth.users
   WHERE email = 'neweadmin@example.com';
   ```
3. **Have them sign out/in** to get fresh JWT token

### For Schema Changes
- **Always run SQL fixes in order:**
  1. `schema.sql` (creates tables)
  2. `FIX_ADMIN_SCHEMA.sql` (adds user_id column)
  3. `FIX_ALL_ADMIN_POLICIES.sql` (creates RLS policies)

### For Deployments
- **After any RLS policy changes:**
  1. Run the SQL in Supabase SQL Editor
  2. Tell all admins to sign out/in
  3. Verify they can see requests

---

## Quick Reference: Key Files

| File | Purpose | When to Run |
|------|---------|-------------|
| `supabase/schema.sql` | Creates all tables | Once during setup |
| `supabase/FIX_ADMIN_SCHEMA.sql` | Adds user_id to admin_users | Once, or after schema reset |
| `supabase/FIX_ALL_ADMIN_POLICIES.sql` | Fixes RLS policies | Anytime admin can't see requests |
| `supabase/TEST_UPDATE_PERMISSIONS.sql` | Tests if admin can update | When approval/reject fails |

---

## Still Not Working?

### Check Browser Console
1. Press F12 to open Developer Tools
2. Go to Console tab
3. Look for errors mentioning:
   - `403 Forbidden`
   - `RLS policy violation`
   - `PGRST` errors

### Check Network Tab
1. Press F12 to open Developer Tools
2. Go to Network tab
3. Click on the `storage_requests` request
4. Check the Preview/Response:
   - Empty array `[]` = RLS blocking you
   - Data returned = RLS working, frontend issue

### Contact Support
If nothing works, share these details:
1. Your admin email
2. Output from Step 3 (Verify Your Admin Status)
3. Output from Step 4 (Verify RLS Policies)
4. Browser console errors
5. Network tab response for `storage_requests`

---

## Success! Admin Can See Requests

**Confirm everything works:**
- ✅ Admin can see pending requests in Approvals tab
- ✅ Admin can approve/reject requests
- ✅ Admin can see all requests in All Requests tab
- ✅ Customer can see their own requests on their dashboard
- ✅ No 403/406 errors in console

**Document what fixed it** for next time! 📝
---

## Customer Delivery Scheduling Fails (403 + CORS)

**Symptoms**
- Customer wizard throws “Failed to schedule delivery” and console logs `shipments?select=*` returning 403.
- Weather card logs `Access-Control-Allow-Origin` CORS preflight failure for `fetch-realtime-weather`.

**Root Cause**
1. Delivery workflow tables only had `SELECT` policies, so inserts from authenticated customers were blocked by RLS.
2. Supabase Edge Functions did not handle `OPTIONS` requests, so browsers aborted the weather fetch before POST executed.

**Fix**
- Add matching `FOR INSERT` policies for `shipments`, `shipment_trucks`, `dock_appointments`, `shipment_documents`, and `documents` (see `supabase/schema.sql` + `supabase/SETUP_SHIPPING_WORKFLOW.sql`).
- Grant `INSERT` on those tables to the `authenticated` role.
- Update `supabase/functions/fetch-realtime-weather/index.ts` and `supabase/functions/fetch-weather-forecast/index.ts` to return CORS headers on both `OPTIONS` and error responses.

**Validation**
- Sign in as the customer, schedule a delivery, and confirm shipment/truck rows exist plus documents are linked to the created truck ID.
- From DevTools, re-run the weather request—`OPTIONS` and `POST` should both return 200 with `Access-Control-Allow-*` headers.
- Supabase dashboard should no longer show 403 errors for the customer user when inserting into the delivery tables.

---

## Build Error: "The character ">" is not valid inside a JSX element"

- **Symptom:** Vite/esbuild stops with a message like components/...tsx:NNN: The character ">" is not valid inside a JSX element.
- **Cause:** JSX parses a literal > in text (for example, a button label like dYs> Truck to MPS) as the start of a tag.
- **Fix:** Wrap the string in a JSX expression ({'dYs> Truck to MPS'}) or escape it (dYs&gt; Truck to MPS), then rerun the build.
