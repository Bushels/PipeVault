# 🚨 CRITICAL HOTFIX: Schema Mismatch in Approval Functions

## Issue Discovered

The deployed `approve_storage_request_atomic()` and `reject_storage_request_atomic()` functions are attempting to query `companies.contact_email`, but that column **does not exist** in the database schema.

**Impact:** Both approval and rejection operations will fail at runtime when trying to queue notification emails.

---

## Schema Analysis

### Current Schema

**`storage_requests` table includes:**
- ✅ `user_email` (TEXT, NOT NULL) - The user who submitted the request
- ✅ `admin_notes` (TEXT, nullable) - Added in previous migration
- ✅ `assigned_rack_ids` (UUID[], nullable)
- ✅ `rejection_reason` (TEXT, nullable)

**`companies` table includes:**
- ✅ `id` (UUID, PRIMARY KEY)
- ✅ `name` (TEXT, NOT NULL)
- ✅ `domain` (TEXT, NOT NULL)
- ❌ `contact_email` **DOES NOT EXIST**

### What the Functions Are Trying to Do

Both functions execute this query:
```sql
SELECT
  sr.company_id,
  sr.reference_id,
  sr.status,
  c.name,
  c.contact_email  -- ❌ FAILS: Column doesn't exist
INTO
  v_company_id,
  v_reference_id,
  v_current_status,
  v_company_name,
  v_company_email
FROM storage_requests sr
INNER JOIN companies c ON c.id = sr.company_id
WHERE sr.id = p_request_id;
```

**Error at runtime:**
```
ERROR: column "contact_email" does not exist
```

---

## Solution

Use `storage_requests.user_email` instead of `companies.contact_email` for notification delivery.

**Rationale:**
- `storage_requests.user_email` is the email of the person who submitted the request
- This is the correct recipient for approval/rejection notifications
- Column exists and is NOT NULL (guaranteed to have a value)

---

## Deployment Instructions

### Step 1: Deploy Hotfix Migration

**File:** [supabase/migrations/20251109000003_fix_approval_workflow_schema.sql](../supabase/migrations/20251109000003_fix_approval_workflow_schema.sql)

1. Open Supabase SQL Editor
2. Copy and paste the entire migration file
3. Execute

**What this does:**
- Replaces `approve_storage_request_atomic()` with corrected version
- Replaces `reject_storage_request_atomic()` with corrected version
- Uses `sr.user_email` instead of `c.contact_email`
- Changes variable from `v_company_email` to `v_user_email` for clarity

---

### Step 2: Verify Fix

Run this query to confirm functions updated:

```sql
SELECT
  proname as function_name,
  pg_get_function_arguments(oid) as arguments,
  prosecdef as is_security_definer
FROM pg_proc
WHERE proname IN ('approve_storage_request_atomic', 'reject_storage_request_atomic')
ORDER BY proname;
```

**Expected result:** 2 rows showing both functions

---

### Step 3: Test Approval (Dry Run)

Find a PENDING request:

```sql
SELECT
  sr.id,
  sr.reference_id,
  sr.status,
  sr.user_email,
  c.name as company_name
FROM storage_requests sr
INNER JOIN companies c ON c.id = sr.company_id
WHERE sr.status = 'PENDING'
LIMIT 1;
```

Find a rack with capacity:

```sql
SELECT
  id,
  name,
  capacity,
  occupied,
  (capacity - occupied) as available
FROM storage_areas
WHERE (capacity - occupied) >= 50
ORDER BY name
LIMIT 3;
```

Test approval (replace with actual UUIDs):

```sql
SELECT approve_storage_request_atomic(
  p_request_id := '<request_uuid>',
  p_assigned_rack_ids := ARRAY['<rack_uuid>']::UUID[],
  p_required_joints := 50,
  p_notes := 'Testing schema fix'
);
```

**Expected success result:**
```json
{
  "success": true,
  "requestId": "...",
  "referenceId": "REF-XXX",
  "status": "APPROVED",
  "assignedRacks": ["A-B1-05"],
  "requiredJoints": 50,
  "availableCapacity": 150,
  "message": "Request REF-XXX approved successfully. Assigned to racks: A-B1-05"
}
```

**If this succeeds, the fix is working!**

---

### Step 4: Verify Notification Queue

Check that notification was queued with correct email:

```sql
SELECT
  notification_type,
  recipient_email,
  subject,
  payload->>'referenceId' as reference_id,
  status,
  created_at
FROM notification_queue
ORDER BY created_at DESC
LIMIT 5;
```

**Verify:**
- ✅ `recipient_email` matches the `storage_requests.user_email` value
- ✅ `notification_type` is `'storage_request_approved'`
- ✅ `status` is `'PENDING'`

---

## Changes Made in Hotfix

### Before (Broken):
```sql
SELECT
  sr.company_id,
  sr.reference_id,
  sr.status,
  c.name,
  c.contact_email  -- ❌ Column doesn't exist
INTO
  v_company_id,
  v_reference_id,
  v_current_status,
  v_company_name,
  v_company_email
FROM storage_requests sr
INNER JOIN companies c ON c.id = sr.company_id
WHERE sr.id = p_request_id;

-- Later in notification insert:
INSERT INTO notification_queue (...)
VALUES (..., v_company_email, ...);  -- ❌ NULL or error
```

### After (Fixed):
```sql
SELECT
  sr.company_id,
  sr.reference_id,
  sr.status,
  sr.user_email,  -- ✅ Use user's email from storage_requests
  c.name
INTO
  v_company_id,
  v_reference_id,
  v_current_status,
  v_user_email,   -- ✅ Renamed for clarity
  v_company_name
FROM storage_requests sr
INNER JOIN companies c ON c.id = sr.company_id
WHERE sr.id = p_request_id;

-- Later in notification insert:
INSERT INTO notification_queue (...)
VALUES (..., v_user_email, ...);  -- ✅ Correct email
```

---

## Why This Happened

The original migration file (`20251109000002_atomic_approval_workflow.sql`) was written assuming a schema where `companies.contact_email` existed. However, the actual production schema stores contact information differently:

- Customer contact emails are stored in `storage_requests.user_email`
- Company records only contain: `id`, `name`, `domain`, `created_at`, `updated_at`

This is a reasonable schema design (companies can have multiple users with different emails), but the migration wasn't updated to match.

---

## Frontend Integration Status

✅ **No frontend changes needed** - the hooks are already compatible:

- `hooks/useApprovalWorkflow.ts` calls `approve_storage_request_atomic()` by name
- The function signature hasn't changed (same parameters)
- The return type is identical (same JSON structure)
- Frontend error handling already covers this scenario

Once the hotfix is deployed, the frontend hooks will work immediately.

---

## Next Steps After Deployment

1. ✅ Deploy hotfix migration
2. ✅ Verify with test approval
3. ✅ Check notification queue has correct emails
4. 🔄 Proceed with frontend integration testing
5. 🔄 Add virtualization to CompanyGroupCarousel

---

## Rollback (if needed)

If the hotfix causes issues:

```sql
-- Rollback: Restore original (broken) version
-- (Not recommended - the original version doesn't work!)

-- Better option: Fix forward by adjusting the query further
```

**Note:** There's no reason to rollback this fix - the original version is non-functional due to the missing column.

---

## Prevention for Future

**Before deploying SQL migrations:**

1. ✅ Run schema inspection queries to verify all referenced columns exist
2. ✅ Test with actual data in a staging environment
3. ✅ Use `information_schema.columns` queries to validate schema assumptions
4. ✅ Create verification queries that test the full code path

**Checklist for next migration:**
```sql
-- Before writing migration, inspect schema:
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('storage_requests', 'companies', 'storage_areas')
ORDER BY table_name, ordinal_position;
```

---

## Summary

| Item | Status |
|------|--------|
| Issue Identified | ✅ `companies.contact_email` doesn't exist |
| Root Cause | Migration written for different schema |
| Impact | Approval/rejection fails at notification step |
| Solution | Use `storage_requests.user_email` instead |
| Hotfix Created | ✅ `20251109000003_fix_approval_workflow_schema.sql` |
| Ready to Deploy | ✅ Yes |
| Frontend Impact | ✅ None (hooks already compatible) |

**Deploy the hotfix now to unblock testing!**
