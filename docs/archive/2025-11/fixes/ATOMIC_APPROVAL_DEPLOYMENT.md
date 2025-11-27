# Atomic Approval Workflow - Deployment Guide

## Prerequisites Completed ✅
- ✅ Functions migration deployed (`20251109000001_FINAL_CORRECTED.sql`)
- ✅ Indexes created (`20251109000001_FINAL_INDEXES.sql`)
- ✅ Unused indexes cleaned up
- ✅ Frontend hooks created

## Deployment Steps

### Step 1: Add admin_notes Column
**File:** `supabase/migrations/20251109000000_add_admin_notes_column.sql`

Open Supabase SQL Editor and run:

```sql
ALTER TABLE storage_requests
ADD COLUMN IF NOT EXISTS admin_notes TEXT;

COMMENT ON COLUMN storage_requests.admin_notes IS
'Internal notes added by admin during approval or rejection process. Not visible to customers.';
```

**Verify:**
```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'storage_requests'
  AND column_name = 'admin_notes';
```

Expected result: 1 row showing `admin_notes | text | YES`

---

### Step 2: Deploy Atomic Approval Workflow
**File:** `supabase/migrations/20251109000002_atomic_approval_workflow.sql`

This migration creates:
- `approve_storage_request_atomic()` function
- `reject_storage_request_atomic()` function
- `admin_audit_log` table (if not exists)
- `notification_queue` table (if not exists)

Open Supabase SQL Editor and run the entire file.

**Verify Functions Exist:**
```sql
SELECT
  proname as function_name,
  prosecdef as is_security_definer,
  pg_get_function_arguments(oid) as arguments
FROM pg_proc
WHERE proname IN ('approve_storage_request_atomic', 'reject_storage_request_atomic')
ORDER BY proname;
```

Expected result: 2 rows
```
function_name                     | is_security_definer | arguments
----------------------------------+---------------------+---------------------------
approve_storage_request_atomic    | t                   | p_request_id uuid, ...
reject_storage_request_atomic     | t                   | p_request_id uuid, ...
```

**Verify Tables Exist:**
```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('admin_audit_log', 'notification_queue')
ORDER BY table_name;
```

Expected result: 2 rows
```
table_name
--------------------
admin_audit_log
notification_queue
```

---

## Testing the Atomic Approval Workflow

### Test 1: Approve a Request (with capacity validation)

First, find a PENDING request:
```sql
SELECT
  sr.id,
  sr.reference_id,
  sr.status,
  sr.total_joints_estimate,
  c.name as company_name
FROM storage_requests sr
INNER JOIN companies c ON c.id = sr.company_id
WHERE sr.status = 'PENDING'
LIMIT 1;
```

Then find a rack with sufficient capacity:
```sql
SELECT
  id,
  name,
  capacity,
  occupied,
  (capacity - occupied) as available
FROM storage_areas
WHERE (capacity - occupied) >= 100  -- Adjust based on request
ORDER BY name
LIMIT 3;
```

Now test the approval (replace UUIDs with actual values):
```sql
SELECT approve_storage_request_atomic(
  p_request_id := '<request_uuid>',
  p_assigned_rack_ids := ARRAY['<rack_uuid>']::UUID[],
  p_required_joints := 100,
  p_notes := 'Approved for testing'
);
```

**Expected Success Result:**
```json
{
  "success": true,
  "requestId": "...",
  "referenceId": "REF-XXX",
  "status": "APPROVED",
  "assignedRacks": ["A-B1-05"],
  "requiredJoints": 100,
  "availableCapacity": 150,
  "message": "Request REF-XXX approved successfully. Assigned to racks: A-B1-05"
}
```

---

### Test 2: Reject a Request

Find another PENDING request:
```sql
SELECT id, reference_id, status
FROM storage_requests
WHERE status = 'PENDING'
LIMIT 1;
```

Test rejection:
```sql
SELECT reject_storage_request_atomic(
  p_request_id := '<request_uuid>',
  p_rejection_reason := 'Insufficient capacity at this time'
);
```

**Expected Success Result:**
```json
{
  "success": true,
  "requestId": "...",
  "referenceId": "REF-XXX",
  "status": "REJECTED",
  "rejectionReason": "Insufficient capacity at this time",
  "message": "Request REF-XXX rejected successfully"
}
```

---

### Test 3: Verify Audit Log

```sql
SELECT
  admin_user_id,
  action,
  entity_type,
  details->>'referenceId' as reference_id,
  details->>'companyName' as company,
  created_at
FROM admin_audit_log
ORDER BY created_at DESC
LIMIT 5;
```

Should show recent APPROVE_REQUEST and REJECT_REQUEST entries.

---

### Test 4: Verify Notification Queue

```sql
SELECT
  notification_type,
  recipient_email,
  subject,
  status,
  created_at
FROM notification_queue
WHERE status = 'PENDING'
ORDER BY created_at DESC;
```

Should show pending notifications for approved/rejected requests.

---

## Testing Atomic Rollback

### Test 5: Trigger Capacity Validation Failure

Try to approve with insufficient capacity:
```sql
SELECT approve_storage_request_atomic(
  p_request_id := '<request_uuid>',
  p_assigned_rack_ids := ARRAY['<rack_uuid>']::UUID[],
  p_required_joints := 9999999,  -- Way more than available
  p_notes := 'Testing capacity validation'
);
```

**Expected Error:**
```
ERROR: Insufficient rack capacity: 9999999 joints required, 200 available across racks: A-B1-05
HINT: Assign additional racks or reduce required joints
```

**Verify Rollback:**
```sql
SELECT status FROM storage_requests WHERE id = '<request_uuid>';
```

Should still be `PENDING` (not changed to APPROVED).

---

### Test 6: Security Check (Non-Admin User)

If you have a non-admin test account, try calling the function:
```sql
SELECT approve_storage_request_atomic(
  p_request_id := '<request_uuid>',
  p_assigned_rack_ids := ARRAY['<rack_uuid>']::UUID[],
  p_required_joints := 100,
  p_notes := 'Testing security'
);
```

**Expected Error:**
```
ERROR: Access denied. Admin privileges required.
HINT: Only admins can approve storage requests
```

---

## Frontend Integration Checklist

Once migrations are deployed:

- [ ] Import `useApproveRequest` and `useRejectRequest` from `hooks/useApprovalWorkflow`
- [ ] Replace existing client-side approval logic with atomic hooks
- [ ] Add loading states (`isPending`)
- [ ] Add error handling (`isError`, `error.message`)
- [ ] Add success toast notifications
- [ ] Test approval with valid rack assignment
- [ ] Test approval with insufficient capacity (should show error)
- [ ] Test rejection flow
- [ ] Verify project summaries refresh after approval/rejection

---

## Rollback Plan

If deployment fails or issues are discovered:

### Rollback Step 1: Drop Functions
```sql
DROP FUNCTION IF EXISTS approve_storage_request_atomic CASCADE;
DROP FUNCTION IF EXISTS reject_storage_request_atomic CASCADE;
```

### Rollback Step 2: Drop Tables (if you want to revert completely)
```sql
-- WARNING: This deletes all audit logs and queued notifications
DROP TABLE IF EXISTS admin_audit_log CASCADE;
DROP TABLE IF EXISTS notification_queue CASCADE;
```

### Rollback Step 3: Remove admin_notes Column (optional)
```sql
ALTER TABLE storage_requests DROP COLUMN IF EXISTS admin_notes;
```

---

## Success Criteria

All tests pass when:

✅ Both functions exist and are SECURITY DEFINER
✅ Audit log and notification queue tables exist
✅ Approval succeeds and updates request + racks atomically
✅ Rejection succeeds and updates request
✅ Capacity validation prevents over-allocation
✅ Non-admin users cannot call functions
✅ Failed operations roll back completely (no partial state)
✅ Notifications are queued for processing
✅ Frontend hooks successfully call RPCs

---

## Next Steps After Deployment

1. **Update AdminDashboard Component**
   - Replace existing approval logic with `useApproveRequest()` hook
   - Replace existing rejection logic with `useRejectRequest()` hook

2. **Add Virtualization** (Critical Gap #6)
   - Implement virtual scrolling in CompanyGroupCarousel
   - Prevents browser lockup with 200+ tiles

3. **Integration Testing**
   - Test full approval workflow end-to-end
   - Test rejection workflow end-to-end
   - Verify project summaries update in real-time

4. **Monitor Production**
   - Watch audit logs for approval/rejection activity
   - Monitor notification queue for delivery failures
   - Check index usage stats after 1 week
