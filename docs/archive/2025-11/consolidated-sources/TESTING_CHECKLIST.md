# Atomic Approval Workflow - Testing Checklist

## Current Status

✅ **Completed:**
- Database functions deployed with schema fixes
- Test fixture created (REF-FIXTEST-001, PENDING status)
- Test rack identified (A-A1-10, 100 available capacity)
- is_admin_user() test bypass deployed
- Admin user ID NULL handling fix created

⏳ **Ready to Deploy:**
- Migration 20251109000006: Admin user ID test mode fix

🧪 **Ready to Test:**
- Full approval workflow
- Rejection workflow
- Edge case validation

---

## Step 1: Deploy Final Migration

**File:** `supabase/migrations/20251109000006_fix_admin_user_id_test_mode.sql`

**What this fixes:**
- Handles `auth.uid()` returning NULL in SQL Editor
- Adds `'service_role'` fallback for audit log entries
- Prevents NOT NULL violation on `admin_audit_log.admin_user_id`

**Deploy:**
1. Open Supabase SQL Editor
2. Execute the entire migration file
3. Verify: Should see "Function definitions updated" success message

---

## Step 2: Run Approval Test

```sql
-- Test 1: Approve the fixture request
SELECT approve_storage_request_atomic(
  p_request_id := '13890948-9fd5-439e-8c2a-325e121f8ad0'::UUID,
  p_assigned_rack_ids := ARRAY['A-A1-10']::TEXT[],
  p_required_joints := 50,
  p_notes := 'Testing atomic approval workflow'
);
```

**Expected Success Response:**
```json
{
  "success": true,
  "requestId": "13890948-9fd5-439e-8c2a-325e121f8ad0",
  "referenceId": "REF-FIXTEST-001",
  "status": "APPROVED",
  "assignedRacks": ["A-A1-10"],
  "requiredJoints": 50,
  "availableCapacity": 50,
  "message": "Request REF-FIXTEST-001 approved successfully. Assigned to racks: A-A1-10"
}
```

---

## Step 3: Verify Database Changes

### 3.1 Request Status Updated
```sql
SELECT
  id,
  reference_id,
  status,
  assigned_rack_ids,
  admin_notes,
  updated_at
FROM storage_requests
WHERE id = '13890948-9fd5-439e-8c2a-325e121f8ad0';
```

**Expected:**
- ✅ `status` = `'APPROVED'`
- ✅ `assigned_rack_ids` = `{A-A1-10}`
- ✅ `admin_notes` = `'Testing atomic approval workflow'`
- ✅ `updated_at` is recent

---

### 3.2 Rack Occupancy Increased
```sql
SELECT
  id,
  name,
  capacity,
  occupied,
  (capacity - occupied) as available,
  updated_at
FROM racks
WHERE id = 'A-A1-10';
```

**Expected:**
- ✅ `occupied` increased by 50 (was 0, now 50)
- ✅ `available` decreased by 50 (was 100, now 50)
- ✅ `updated_at` is recent

---

### 3.3 Notification Queue Entry Created
```sql
SELECT
  id,
  type,
  payload->>'userEmail' as recipient,
  payload->>'subject' as subject,
  payload->>'referenceId' as ref,
  payload->>'companyName' as company,
  payload->'assignedRacks' as racks,
  processed,
  created_at
FROM notification_queue
ORDER BY created_at DESC
LIMIT 1;
```

**Expected:**
- ✅ `type` = `'storage_request_approved'`
- ✅ `recipient` = `'test.requester@example.com'`
- ✅ `subject` = `'Storage Request Approved - REF-FIXTEST-001'`
- ✅ `ref` = `'REF-FIXTEST-001'`
- ✅ `company` = `'Test Company'`
- ✅ `racks` = `["A-A1-10"]`
- ✅ `processed` = `false`

---

### 3.4 Audit Log Entry Created
```sql
SELECT
  admin_user_id,
  action,
  entity_type,
  entity_id,
  details->>'referenceId' as ref,
  details->>'companyName' as company,
  details->'assignedRacks' as racks,
  details->>'requiredJoints' as joints,
  created_at
FROM admin_audit_log
ORDER BY created_at DESC
LIMIT 1;
```

**Expected:**
- ✅ `admin_user_id` = `'service_role'` (test mode)
- ✅ `action` = `'APPROVE_REQUEST'`
- ✅ `entity_type` = `'storage_request'`
- ✅ `entity_id` = `'13890948-9fd5-439e-8c2a-325e121f8ad0'`
- ✅ `ref` = `'REF-FIXTEST-001'`
- ✅ `company` = `'Test Company'`
- ✅ `racks` = `["A-A1-10"]`
- ✅ `joints` = `'50'`

---

## Step 4: Test Rejection Workflow

First, create another test fixture:

```sql
INSERT INTO storage_requests (
  id,
  company_id,
  user_email,
  reference_id,
  status,
  created_at,
  updated_at
)
VALUES (
  'a1b2c3d4-e5f6-4789-abcd-ef0123456789'::UUID,
  (SELECT id FROM companies LIMIT 1),
  'test.requester2@example.com',
  'REF-FIXTEST-002',
  'PENDING',
  NOW(),
  NOW()
);
```

Then test rejection:

```sql
SELECT reject_storage_request_atomic(
  p_request_id := 'a1b2c3d4-e5f6-4789-abcd-ef0123456789'::UUID,
  p_rejection_reason := 'Insufficient capacity for requested storage duration'
);
```

**Expected Success Response:**
```json
{
  "success": true,
  "requestId": "a1b2c3d4-e5f6-4789-abcd-ef0123456789",
  "referenceId": "REF-FIXTEST-002",
  "status": "REJECTED",
  "rejectionReason": "Insufficient capacity for requested storage duration",
  "message": "Request REF-FIXTEST-002 rejected successfully"
}
```

---

## Step 5: Verify Rejection

### 5.1 Request Status Updated
```sql
SELECT
  id,
  reference_id,
  status,
  rejection_reason,
  updated_at
FROM storage_requests
WHERE id = 'a1b2c3d4-e5f6-4789-abcd-ef0123456789';
```

**Expected:**
- ✅ `status` = `'REJECTED'`
- ✅ `rejection_reason` = `'Insufficient capacity for requested storage duration'`

---

### 5.2 Notification Queue Entry
```sql
SELECT
  type,
  payload->>'userEmail' as recipient,
  payload->>'subject' as subject,
  payload->>'referenceId' as ref,
  payload->>'rejectionReason' as reason,
  processed
FROM notification_queue
ORDER BY created_at DESC
LIMIT 1;
```

**Expected:**
- ✅ `type` = `'storage_request_rejected'`
- ✅ `recipient` = `'test.requester2@example.com'`
- ✅ `subject` = `'Storage Request Rejected - REF-FIXTEST-002'`
- ✅ `ref` = `'REF-FIXTEST-002'`
- ✅ `reason` = `'Insufficient capacity for requested storage duration'`
- ✅ `processed` = `false`

---

### 5.3 Audit Log Entry
```sql
SELECT
  admin_user_id,
  action,
  details->>'referenceId' as ref,
  details->>'rejectionReason' as reason
FROM admin_audit_log
ORDER BY created_at DESC
LIMIT 1;
```

**Expected:**
- ✅ `admin_user_id` = `'service_role'`
- ✅ `action` = `'REJECT_REQUEST'`
- ✅ `ref` = `'REF-FIXTEST-002'`
- ✅ `reason` = `'Insufficient capacity for requested storage duration'`

---

## Step 6: Edge Case Testing

### 6.1 Insufficient Capacity
```sql
-- Try to approve with way more joints than available
SELECT approve_storage_request_atomic(
  p_request_id := 'a1b2c3d4-e5f6-4789-abcd-ef0123456789'::UUID,  -- Use rejected request
  p_assigned_rack_ids := ARRAY['A-A1-10']::TEXT[],
  p_required_joints := 9999999,
  p_notes := 'Testing capacity validation'
);
```

**Expected Error:**
```
ERROR: Insufficient rack capacity: 9999999 joints required, 50 available across racks: A-A1-10
HINT: Assign additional racks or reduce required joints
```

**Verify No Changes:**
```sql
SELECT status FROM storage_requests WHERE id = 'a1b2c3d4-e5f6-4789-abcd-ef0123456789';
-- Expected: Still REJECTED (not changed to APPROVED)
```

---

### 6.2 Invalid Rack ID
```sql
-- Try to approve with non-existent rack
SELECT approve_storage_request_atomic(
  p_request_id := 'a1b2c3d4-e5f6-4789-abcd-ef0123456789'::UUID,
  p_assigned_rack_ids := ARRAY['INVALID-RACK']::TEXT[],
  p_required_joints := 50,
  p_notes := 'Testing validation'
);
```

**Expected Error:**
```
ERROR: One or more rack IDs are invalid
HINT: Check that all rack IDs exist in racks table
```

---

### 6.3 Already Approved Request
```sql
-- Try to approve the already-approved request again
SELECT approve_storage_request_atomic(
  p_request_id := '13890948-9fd5-439e-8c2a-325e121f8ad0'::UUID,
  p_assigned_rack_ids := ARRAY['A-A1-10']::TEXT[],
  p_required_joints := 50,
  p_notes := 'Testing duplicate approval'
);
```

**Expected Error:**
```
ERROR: Request REF-FIXTEST-001 is not pending (current status: APPROVED)
HINT: Only PENDING requests can be approved
```

---

## Step 7: Test Multi-Rack Distribution

Create a third test request:

```sql
INSERT INTO storage_requests (
  id, company_id, user_email, reference_id, status, created_at, updated_at
)
VALUES (
  'b2c3d4e5-f6a7-489b-bcde-f01234567890'::UUID,
  (SELECT id FROM companies LIMIT 1),
  'test.requester3@example.com',
  'REF-FIXTEST-003',
  'PENDING',
  NOW(), NOW()
);
```

Find 2-3 racks with available capacity:

```sql
SELECT id, name, capacity, occupied, (capacity - occupied) as available
FROM racks
WHERE (capacity - occupied) >= 30
ORDER BY name
LIMIT 3;
```

Test multi-rack approval:

```sql
SELECT approve_storage_request_atomic(
  p_request_id := 'b2c3d4e5-f6a7-489b-bcde-f01234567890'::UUID,
  p_assigned_rack_ids := ARRAY['<rack1>', '<rack2>', '<rack3>']::TEXT[],
  p_required_joints := 90,
  p_notes := 'Testing multi-rack distribution'
);
```

**Verify Distribution:**
```sql
SELECT id, name, occupied
FROM racks
WHERE id = ANY(ARRAY['<rack1>', '<rack2>', '<rack3>']::TEXT[])
ORDER BY name;
```

**Expected:** 90 joints distributed evenly (30 each)

---

## Step 8: Clean Up Test Data (Optional)

After testing completes:

```sql
-- Delete test requests
DELETE FROM storage_requests
WHERE reference_id LIKE 'REF-FIXTEST-%';

-- Revert rack occupancy
UPDATE racks
SET occupied = 0, updated_at = NOW()
WHERE id = 'A-A1-10';

-- Clear test notifications
DELETE FROM notification_queue
WHERE payload->>'referenceId' LIKE 'REF-FIXTEST-%';

-- Clear test audit logs
DELETE FROM admin_audit_log
WHERE details->>'referenceId' LIKE 'REF-FIXTEST-%';
```

---

## Step 9: Remove Test Mode (REQUIRED BEFORE PRODUCTION)

**Remove is_admin_user() bypass:**

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

**Verify removal:**
```sql
SELECT is_admin_user();
-- Expected: false (because auth.uid() is NULL in SQL Editor)
```

---

## Step 10: Frontend Integration Testing

Once test mode is removed and real admin users are added:

1. Log in as admin user in your app
2. Navigate to AdminDashboard
3. Find a PENDING storage request
4. Click "Approve" button
5. Select rack(s)
6. Enter notes
7. Confirm approval

**Expected:**
- ✅ Success toast notification
- ✅ Request status updates to APPROVED
- ✅ Rack occupancy updates
- ✅ Project summaries refresh automatically (React Query)
- ✅ Audit log entry created with actual user ID

---

## Success Criteria

All tests pass when:

- [x] Migration 20251109000006 deployed successfully
- [ ] Approval test succeeds (Step 2)
- [ ] All verification queries pass (Step 3)
- [ ] Rejection test succeeds (Step 4)
- [ ] All rejection verifications pass (Step 5)
- [ ] Edge case tests fail with expected errors (Step 6)
- [ ] Multi-rack distribution works correctly (Step 7)
- [ ] Test mode removed before production (Step 9)
- [ ] Frontend integration works end-to-end (Step 10)

---

## Migration Summary

| # | File | Status | Purpose |
|---|------|--------|---------|
| 1 | `20251109000001_FINAL_CORRECTED.sql` | ✅ Deployed | Core RPC functions |
| 2 | `20251109000001_FINAL_INDEXES.sql` | ✅ Deployed | Performance indexes |
| 3 | `20251109000002_atomic_approval_workflow.sql` | ✅ Deployed | Approval/rejection (initial) |
| 4 | `20251109000003_fix_approval_workflow_schema.sql` | ✅ Deployed | contact_email fix |
| 5 | `20251109000004_align_approval_with_actual_schema.sql` | ✅ Deployed | racks + notification_queue fix |
| 6 | `20251109000005_test_mode_admin_bypass.sql` | ✅ Deployed | is_admin_user() bypass |
| 7 | `20251109000006_fix_admin_user_id_test_mode.sql` | ⏳ **Deploy Now** | admin_user_id NULL fix |

---

## Next Steps After All Tests Pass

1. ✅ Remove test mode (Step 9)
2. 🔌 Add real admin users to `admin_users` table
3. 🧪 Test frontend integration (Step 10)
4. 🚀 Add virtualization to CompanyGroupCarousel (critical gap #6)
5. 📊 Monitor production for 1 week, check index usage stats

**Ready to deploy migration #7 and start testing!** 🚀
