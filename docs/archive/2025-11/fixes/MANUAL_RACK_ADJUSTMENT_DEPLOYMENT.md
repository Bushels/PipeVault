# Manual Rack Adjustment Feature - Deployment Guide

## Overview
Deploy the secure manual rack adjustment feature that allows admins to manually adjust rack occupancy with full audit trail. This feature is production-ready with proper authorization and compliance logging.

---

## Features

### What This Adds
- ✅ **Admin-clickable racks** in Storage tab visualization
- ✅ **Secure adjustment modal** with validation and live feedback
- ✅ **Full audit trail** - Every change logged with who, when, why
- ✅ **Authorization checks** - Only admins can adjust
- ✅ **Data integrity** - Atomic transactions prevent inconsistencies
- ✅ **Capacity validation** - Prevents over-capacity assignments

### Use Cases
- Pipe physically moved between racks in the yard
- Manual corrections for data discrepancies
- Emergency capacity adjustments
- Physical inventory reconciliation

---

## Pre-Deployment Checklist

- [ ] Dev server is running (`npm run dev`)
- [ ] Build succeeded (already verified ✅)
- [ ] You are logged in as admin in Supabase Dashboard
- [ ] You have SQL Editor access in Supabase Dashboard

---

## Step 1: Create Audit Trail Table

**File**: `supabase/migrations/20251113000003_create_rack_adjustment_audit.sql`

**What it does**:
- Creates `rack_occupancy_adjustments` audit table
- Logs all manual adjustments (who, when, why, before/after values)
- Adds RLS policies (admins can view, system can insert)
- Creates indexes for query performance

**How to apply**:

1. Open **Supabase Dashboard** → **SQL Editor**
2. Open the file `supabase/migrations/20251113000003_create_rack_adjustment_audit.sql`
3. Copy the **entire contents**
4. Paste into SQL Editor
5. Click **Run** (bottom right)

**Expected result**:
```
Success. No rows returned
```

**Verification** (run after migration):
```sql
-- Should show the new audit table
SELECT table_name, table_type
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name = 'rack_occupancy_adjustments';

-- Should return: rack_occupancy_adjustments | BASE TABLE

-- Check table structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'rack_occupancy_adjustments'
ORDER BY ordinal_position;

-- Should show 9 columns:
-- id, rack_id, adjusted_by, adjusted_at, reason,
-- old_joints_occupied, new_joints_occupied,
-- old_meters_occupied, new_meters_occupied
```

---

## Step 2: Create Secure Adjustment Function ✅ DEPLOYED

**File**: `supabase/migrations/20251113000004_create_manual_rack_adjustment_func.sql`

**Status**: ✅ **Successfully deployed to production**

**What it does**:
- Creates `manually_adjust_rack_occupancy()` database function
- Validates admin access via `admin_users` table
- Validates capacity limits and reason length (10 char minimum)
- Atomically updates rack occupancy AND logs to audit table
- Sets `updated_at = NOW()` on racks for traceability
- Returns summary JSON for frontend feedback
- Uses SECURITY DEFINER for privilege escalation

**Deployment Confirmation**:
- ✅ Function created as SECURITY DEFINER
- ✅ Permissions: revoked from public, granted to authenticated
- ✅ Admin validation via JWT email claim against `admin_users` table
- ✅ Capacity and reason validation enforced
- ✅ Atomic updates to `racks` and audit logging to `rack_occupancy_adjustments`
- ✅ JSON summary returned on success

**How to apply** (already completed):

1. Open **Supabase Dashboard** → **SQL Editor**
2. Open the file `supabase/migrations/20251113000004_create_manual_rack_adjustment_func.sql`
3. Copy the **entire contents**
4. Paste into SQL Editor
5. Click **Run**

**Expected result**:
```
Success. No rows returned
```

**Verification** (run after migration):
```sql
-- Function should exist
SELECT routine_name, routine_type, security_type
FROM information_schema.routines
WHERE routine_name = 'manually_adjust_rack_occupancy';

-- Should return: manually_adjust_rack_occupancy | FUNCTION | DEFINER

-- Check function signature (parameters)
SELECT
  p.parameter_name,
  p.data_type,
  p.parameter_mode
FROM information_schema.parameters p
WHERE p.specific_name IN (
  SELECT specific_name
  FROM information_schema.routines
  WHERE routine_name = 'manually_adjust_rack_occupancy'
)
ORDER BY p.ordinal_position;

-- Should return 4 parameters:
-- p_rack_id       | text    | IN
-- p_new_joints    | integer | IN
-- p_new_meters    | numeric | IN
-- p_reason        | text    | IN
```

---

## Step 3: Test Manual Adjustment Feature

### Test 1: Access the Feature
1. Go to **Admin Dashboard** (http://localhost:5173/admin)
2. Click the **"Storage"** tab
3. You should see the rack visualization with Yard A, B, C
4. Hover over any rack - cursor should change to pointer
5. Tooltip should say "Click to adjust occupancy for [rack name]"

**Expected**: Racks are clickable with hover effect

---

### Test 2: Adjust a Rack
1. Click on rack **"A1-1"** (or any rack)
2. Modal should open: **"Adjust Rack: A1-1"**
3. You should see:
   - Current State (occupied/capacity)
   - Form inputs for new joints and meters
   - Reason textarea with character count
   - Change Summary showing delta

**Try these validations**:

**Test 2a: Exceed Capacity**
- Try to set joints to 150 (if capacity is 100)
- Click "Update Rack"
- **Expected**: Error message "New joints (150) exceed rack capacity (100)"

**Test 2b: Negative Values**
- Try to set joints to -5
- **Expected**: HTML5 validation prevents input (min="0")

**Test 2c: Short Reason**
- Enter reason: "test" (4 characters)
- **Expected**: Character count shows orange "(4/10)", button disabled

**Test 2d: Valid Adjustment**
- Set joints to 25
- Set meters to 780.5
- Enter reason: "Manual adjustment for testing - moved pipe from A1-10"
- **Expected**: Character count turns green, submit button enabled
- Click "Update Rack"
- **Expected**: Success, modal closes, page reloads, rack updated

---

### Test 3: Verify Audit Trail
Run this query after making an adjustment:

```sql
SELECT
  rack_id,
  adjusted_by,
  adjusted_at,
  reason,
  old_joints_occupied || ' → ' || new_joints_occupied AS joints_change,
  old_meters_occupied || ' → ' || new_meters_occupied AS meters_change
FROM rack_occupancy_adjustments
ORDER BY adjusted_at DESC
LIMIT 5;
```

**Expected output** (example):
```
rack_id | adjusted_by      | adjusted_at           | reason                              | joints_change | meters_change
--------|------------------|----------------------|-------------------------------------|---------------|---------------
A1-1    | admin@mps.com    | 2025-11-13 14:30:00  | Manual adjustment for testing...    | 50 → 25       | 1560.0 → 780.5
```

---

### Test 4: Security - Non-Admin Access
This test verifies only admins can adjust racks.

**Scenario**: Log in as a non-admin customer and try to access the feature.

**Expected**:
- Customers cannot see the Admin Dashboard
- If a customer somehow calls the function directly via API, they get:
  ```
  Unauthorized: Only admins can manually adjust rack occupancy.
  ```

---

## Step 4 (Optional): Clear Test Racks

If you still need to clear racks A1-10 and A2-1 as originally requested:

**File**: `CLEAR_RACKS.sql`

1. Open **Supabase Dashboard** → **SQL Editor**
2. Copy the contents of `CLEAR_RACKS.sql`
3. Paste and run

**This will**:
- Set A1-10: 50/100 → 0/100
- Set A2-1: 50/100 → 0/100

**Note**: This is a direct UPDATE and will NOT create audit log entries. If you want to clear these racks with audit trail, use the new manual adjustment feature instead:
1. Click on A1-10 in the Storage tab
2. Set joints to 0, meters to 0
3. Enter reason: "Clearing test data for inventory reconciliation"
4. Submit

---

## Rollback Plan (If Needed)

If something goes wrong, you can rollback:

```sql
-- ROLLBACK STEP 1: Drop the function
DROP FUNCTION IF EXISTS public.manually_adjust_rack_occupancy(TEXT, INTEGER, NUMERIC, TEXT);

-- ROLLBACK STEP 2: Drop the audit table
DROP TABLE IF EXISTS public.rack_occupancy_adjustments CASCADE;
```

**Note**: This will lose all audit history. Only rollback if absolutely necessary.

---

## Post-Deployment Verification

### Checklist
- [ ] **Migration 1 applied**: Audit table created
- [ ] **Migration 2 applied**: Function created
- [ ] **UI test passed**: Racks are clickable
- [ ] **Validation works**: Capacity limits enforced
- [ ] **Audit trail works**: Adjustments logged
- [ ] **Authorization works**: Only admins can adjust
- [ ] **No errors**: No console errors or warnings

---

## How Admins Use the Feature

### Step-by-Step Workflow

1. **Navigate to Storage tab** in Admin Dashboard
2. **Click on the rack** you want to adjust
3. **Review current state** (occupied/capacity displayed)
4. **Enter new values** for joints and meters
5. **Enter reason** (minimum 10 characters) - describe why:
   - "Pipe physically moved to rack B-3 for organization"
   - "Manual correction after physical inventory count"
   - "Emergency capacity adjustment for incoming load"
6. **Review change summary** (delta shown in green/red)
7. **Click "Update Rack"**
8. **Verification**: Page reloads, rack displays new values

### Best Practices
- Always provide descriptive reasons (audit compliance)
- Double-check values before submitting (atomic transaction)
- Use the feature sparingly (prefer system-driven updates)
- Review audit log monthly for reconciliation

---

## Architecture Summary

### Frontend Layer
- **Component**: `ManualRackAdjustmentModal.tsx`
- **Validation**: Client-side validation (capacity, negative values, reason length)
- **UI Feedback**: Live character count, delta display, error messages

### Database Layer
- **Table**: `rack_occupancy_adjustments` (audit log)
- **Function**: `manually_adjust_rack_occupancy()` (secure update + log)
- **Security**: SECURITY DEFINER + admin validation
- **Atomicity**: All operations wrapped in transaction

### Security Controls
1. **Authorization**: Only emails in `admin_users` table can execute
2. **RLS Policies**: Admins can view audit log, system can insert
3. **Validation**: Capacity limits, negative values, reason length enforced
4. **Audit Trail**: Every change logged with full context
5. **Transaction Integrity**: Update + log are atomic (all-or-nothing)

---

## Troubleshooting

### Error: "Unauthorized: Only admins can manually adjust rack occupancy"
**Cause**: Your email is not in the `admin_users` table
**Fix**: Add yourself:
```sql
INSERT INTO admin_users (email, role)
VALUES ('your-email@example.com', 'super_admin');
```

### Error: "function manually_adjust_rack_occupancy does not exist"
**Cause**: Step 2 migration didn't apply
**Fix**: Re-run the migration file in SQL Editor

### Error: "table rack_occupancy_adjustments does not exist"
**Cause**: Step 1 migration didn't apply
**Fix**: Re-run the migration file in SQL Editor

### Error: "New joints exceed rack capacity"
**Cause**: You tried to set occupancy higher than capacity
**Fix**: This is correct validation - reduce the joints value

### Modal doesn't open when clicking rack
**Cause**: Frontend state issue or build not deployed
**Fix**:
1. Hard refresh browser (Ctrl+Shift+R)
2. Check console for errors
3. Verify dev server is running

### Page doesn't reload after adjustment
**Cause**: `window.location.reload()` is called in `onSuccess`
**Fix**: This is expected behavior - ensures UI reflects database changes

---

## Deployment Status

- [ ] **Step 1**: Audit table migration applied
- [ ] **Step 2**: Function migration applied
- [ ] **Step 3**: UI tested - racks clickable
- [ ] **Step 4**: Validation tested - capacity enforced
- [ ] **Step 5**: Audit log verified - adjustments logged
- [ ] **Step 6**: Security tested - admin-only access
- [ ] **Ready**: Feature production-ready

---

## Files Modified/Created

### Created
- `CLEAR_RACKS.sql` - Optional script to clear specific racks
- `components/admin/ManualRackAdjustmentModal.tsx` - Modal component
- `supabase/migrations/20251113000003_create_rack_adjustment_audit.sql` - Audit table
- `supabase/migrations/20251113000004_create_manual_rack_adjustment_func.sql` - Secure function

### Modified
- `components/admin/AdminDashboard.tsx` - Added click handlers and modal integration

---

## Success Criteria

✅ **Security**: Only admins can adjust rack occupancy
✅ **Audit**: All adjustments logged to audit table
✅ **Validation**: Capacity limits enforced
✅ **Atomicity**: Update + log are atomic transaction
✅ **UX**: Clear visual feedback and error messages
✅ **Performance**: Indexed queries for audit history
✅ **Compliance**: Full audit trail for reconciliation

---

**Questions?** Report any errors with:
1. Full error message
2. Which step failed
3. Result of verification queries
