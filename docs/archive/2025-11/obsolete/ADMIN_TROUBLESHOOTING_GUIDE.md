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

---

## Slack Notifications Not Working for Storage Requests

**Date Discovered:** 2025-11-05

### Symptoms
- New storage requests submitted but MPS team receives no Slack notification
- Users report storage request went through but team isn't notified
- No error visible to user but internal notification fails

### Root Cause
1. **Missing trigger** on `storage_requests` table
2. **Incomplete function** - `notify_slack_storage_request` was a stub without Block Kit implementation
3. **Function overwrite** during `FIX_FUNCTION_SEARCH_PATH.sql` migration lost the full webhook code

### Investigation Steps
```sql
-- Check for trigger
SELECT trigger_name, event_manipulation, event_object_table
FROM information_schema.triggers
WHERE trigger_name LIKE '%slack%';
-- Result: No rows (trigger missing)

-- Check function definition
SELECT pg_get_functiondef(oid)
FROM pg_proc
WHERE proname = 'notify_slack_storage_request';
-- Result: Only calls enqueue_notification, no Block Kit payload
```

### Solution
Run the `RESTORE_SLACK_NOTIFICATIONS.sql` migration that:

1. **Recreates full function** with Block Kit formatting
2. **Retrieves webhook URL** securely from Supabase Vault
3. **Creates AFTER INSERT OR UPDATE trigger** on storage_requests
4. **Fires only for PENDING status** requests (not drafts)

**Files:**
- `supabase/RESTORE_SLACK_NOTIFICATIONS.sql` - Complete restoration migration

**Key Features:**
- Rich Slack message with project reference, company, contact info, pipe details
- Action button linking to PipeVault Admin Dashboard
- Submission timestamp
- Secure webhook URL retrieval from vault.decrypted_secrets

### Verification
1. Apply migration in Supabase Dashboard SQL Editor
2. Submit a test storage request
3. Check Slack channel for formatted notification
4. Verify notification includes all request details

### Prevention
- **Always verify triggers** after running database migrations
- **Test notification system** after any function changes
- **Check Supabase Vault** for webhook URL configuration
- **Monitor notification_queue** table for failed deliveries

---

## Rack Capacity Shows Wrong Values (1 joint instead of 100)

**Date Discovered:** 2025-11-05

### Symptoms
- Yard A shows "1 pipe free" instead of expected capacity
- Admin dashboard storage view shows minimal available space
- Racks display as nearly full when they should be mostly empty
- Each rack shows capacity of 1 joint instead of 100

### Root Cause
Initial rack setup used wrong default capacity value during database initialization. All racks were created with `capacity = 1` instead of the intended `capacity = 100`.

### Investigation Steps
```sql
-- Check rack capacities in Yard A
SELECT
  r.id, r.name, ya.name as area_name,
  r.capacity, r.occupied, (r.capacity - r.occupied) as free_space
FROM racks r
JOIN yard_areas ya ON r.area_id = ya.id
WHERE ya.yard_id = 'A';
-- Result: All racks show capacity = 1
```

### Impact
- **Yard A**: 22 racks × 1 capacity = 22 joints total (should be 2,200)
- **Current occupied**: 2 joints
- **Shown as available**: 20 joints ❌
- **Should show**: 2,198 joints ✅

### Solution
Run the `FIX_ALL_RACK_CAPACITIES.sql` migration that:

1. Updates all racks with `capacity < 100` to `capacity = 100`
2. Sets `capacity_meters = 1200` (100 joints × 12m average)
3. Preserves existing `occupied` values
4. Shows before/after statistics for verification

**Files:**
- `supabase/FIX_ALL_RACK_CAPACITIES.sql` - Capacity restoration migration

### Verification
```sql
-- After running migration, verify capacities
SELECT
  ya.yard_id,
  COUNT(*) as rack_count,
  MIN(r.capacity) as min_capacity,
  MAX(r.capacity) as max_capacity,
  SUM(r.capacity) as total_capacity,
  SUM(r.occupied) as total_occupied,
  SUM(r.capacity - r.occupied) as total_free_space
FROM racks r
JOIN yard_areas ya ON r.area_id = ya.id
GROUP BY ya.yard_id;
-- Expected: min_capacity = 100, max_capacity = 100
```

### Prevention
- **Verify capacity constraints** in schema.sql
- **Check default values** during database initialization
- **Test with sample data** before production deployment
- **Monitor rack utilization** metrics in admin dashboard

---

## Cannot Edit or Delete Trucking Loads

**Date Discovered:** 2025-11-05

### Symptoms
- Admin wants to modify trucking load details but no option available
- Plans change during process but can't update load information
- Accidentally created load but can't remove it
- No edit/delete buttons visible on load cards

### Root Cause
Initial implementation of trucking loads only supported creation and viewing. No edit or delete functionality was built into the admin dashboard.

### Solution Implemented
Added comprehensive edit and delete functionality to Admin Dashboard:

**Edit Load Modal Features:**
- Direction (INBOUND/OUTBOUND)
- Sequence Number
- Status (NEW, APPROVED, IN_TRANSIT, COMPLETED, CANCELLED)
- Scheduled Start/End Times (datetime pickers)
- Well Information (Asset, Wellpad, Well Name, UWI)
- Contact Information (Trucking Company, Contact details, Driver info)
- Planned Quantities (Joints, Length, Weight)
- Notes (free-form text)

**Delete Load Features:**
- Confirmation dialog before deletion
- Shows load sequence number for verification
- Clear warning that action cannot be undone
- Error handling if deletion fails

**Files Modified:**
- `components/admin/AdminDashboard.tsx` - Added EditLoadModal component and handlers

### Using Edit/Delete Features

**To Edit a Load:**
1. Go to Admin Dashboard → View trucking documents for a request
2. Click "Edit" button on any load card
3. Modify fields as needed in the modal
4. Click "Save Changes" (or Cancel to discard)
5. Changes reflect immediately in UI

**To Delete a Load:**
1. Click "Delete" button on any load card
2. Confirm deletion in dialog
3. Load is permanently removed from database
4. UI updates automatically

### Technical Implementation
```typescript
// State management
const [editingLoad, setEditingLoad] = useState<{id: string; requestId: string} | null>(null);
const [loadToDelete, setLoadToDelete] = useState<{...} | null>(null);

// Handlers
const handleEditLoad = (loadId: string, requestId: string) => {...}
const handleDeleteLoad = (loadId: string, requestId: string, seq: number) => {...}
const confirmDeleteLoad = async () => {...}
```

### Verification
1. Edit a test load and verify changes persist
2. Delete a test load and verify it's removed
3. Check that UI updates without requiring page refresh
4. Verify no console errors during edit/delete operations

---
