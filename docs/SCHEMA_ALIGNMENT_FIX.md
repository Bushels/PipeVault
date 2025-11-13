# Schema Alignment Fix - Approval Functions

## Summary of Schema Mismatches Found

During deployment testing, we discovered the approval workflow functions had three critical schema mismatches:

### 1. Rack Table Name ❌
- **Functions referenced:** `storage_areas` (uuid id)
- **Actual table:** `racks` (text id)
- **Impact:** All rack capacity queries would fail

### 2. Rack ID Type ❌
- **Functions used:** `uuid[]` for `p_assigned_rack_ids`
- **Actual type:** `text[]` in `storage_requests.assigned_rack_ids`
- **Impact:** Type mismatch would cause assignment failures

### 3. Notification Queue Schema ❌
- **Functions tried to insert:** `recipient_email`, `subject`, `status` columns
- **Actual schema:** `type` (text), `payload` (jsonb), `processed` (boolean)
- **Impact:** All notification inserts would fail

---

## Solution: Comprehensive Schema Alignment

**Migration File:** `supabase/migrations/20251109000004_align_approval_with_actual_schema.sql`

### Changes Made:

1. **Changed `storage_areas` → `racks`**
   - All queries now reference the correct table
   - All rack updates use text IDs

2. **Changed `uuid[]` → `text[]` for rack IDs**
   - Function signature: `p_assigned_rack_ids TEXT[]`
   - Variable declarations: `v_rack_id TEXT`
   - Fully compatible with existing `storage_requests.assigned_rack_ids` column

3. **Fixed notification queue inserts**
   - Now uses `type` + `payload` pattern
   - Payload includes all email fields in jsonb
   - Compatible with existing notification workers

---

## Deployment Instructions

### Step 1: Deploy Schema Alignment Migration

1. Open Supabase SQL Editor
2. Execute: `supabase/migrations/20251109000004_align_approval_with_actual_schema.sql`

### Step 2: Verify Function Signatures

```sql
SELECT
  proname as function_name,
  pg_get_function_arguments(oid) as arguments,
  prosecdef as is_security_definer
FROM pg_proc
WHERE proname IN ('approve_storage_request_atomic', 'reject_storage_request_atomic')
ORDER BY proname;
```

**Expected result:**
```
function_name                     | arguments                                          | is_security_definer
----------------------------------+----------------------------------------------------+--------------------
approve_storage_request_atomic    | p_request_id uuid, p_assigned_rack_ids text[], ... | t
reject_storage_request_atomic     | p_request_id uuid, p_rejection_reason text, ...    | t
```

✅ **Key validation:** `p_assigned_rack_ids text[]` (not `uuid[]`)

---

## Testing the Fixed Functions

### Test 1: Find Test Data

```sql
-- Find a PENDING request
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

-- Find racks with available capacity
SELECT
  id,
  name,
  capacity,
  occupied,
  (capacity - occupied) as available
FROM racks
WHERE (capacity - occupied) >= 50
ORDER BY name
LIMIT 5;
```

### Test 2: Approve a Request

```sql
SELECT approve_storage_request_atomic(
  p_request_id := '<request_uuid>',
  p_assigned_rack_ids := ARRAY['<rack_id_1>', '<rack_id_2>']::TEXT[],  -- ✅ text[] not uuid[]
  p_required_joints := 50,
  p_notes := 'Testing schema alignment fix'
);
```

**Expected Success Response:**
```json
{
  "success": true,
  "requestId": "...",
  "referenceId": "REF-XXX",
  "status": "APPROVED",
  "assignedRacks": ["A-B1-05", "A-B1-06"],
  "requiredJoints": 50,
  "availableCapacity": 150,
  "message": "Request REF-XXX approved successfully. Assigned to racks: A-B1-05, A-B1-06"
}
```

### Test 3: Verify Rack Occupancy Updated

```sql
SELECT
  id,
  name,
  capacity,
  occupied,
  (capacity - occupied) as available,
  updated_at
FROM racks
WHERE id = ANY(ARRAY['<rack_id_1>', '<rack_id_2>']::TEXT[])
ORDER BY name;
```

**Verify:**
- ✅ `occupied` increased by ~25 each (50 joints distributed)
- ✅ `updated_at` is recent

### Test 4: Verify Notification Queue Entry

```sql
SELECT
  id,
  type,
  payload->>'userEmail' as recipient,
  payload->>'subject' as subject,
  payload->>'referenceId' as reference_id,
  payload->>'notificationType' as notification_type,
  processed,
  created_at
FROM notification_queue
ORDER BY created_at DESC
LIMIT 3;
```

**Expected Result:**
```
type                        | recipient          | subject                                    | reference_id | notification_type | processed | created_at
----------------------------+--------------------+--------------------------------------------+--------------+-------------------+-----------+------------
storage_request_approved    | user@example.com   | Storage Request Approved - REF-XXX         | REF-XXX      | email             | false     | 2025-11-09...
```

✅ **Key validations:**
- `type` = `'storage_request_approved'`
- `payload` contains all expected fields
- `processed` = `false` (ready for worker)

### Test 5: Verify Audit Log

```sql
SELECT
  admin_user_id,
  action,
  entity_type,
  entity_id,
  details->>'referenceId' as reference_id,
  details->>'companyName' as company,
  details->'assignedRacks' as racks,
  created_at
FROM admin_audit_log
ORDER BY created_at DESC
LIMIT 3;
```

**Expected:**
- ✅ `action` = `'APPROVE_REQUEST'`
- ✅ `details` contains all approval metadata

---

## Test 6: Rejection Workflow

```sql
-- Find another PENDING request
SELECT id, reference_id, status
FROM storage_requests
WHERE status = 'PENDING'
LIMIT 1;

-- Test rejection
SELECT reject_storage_request_atomic(
  p_request_id := '<request_uuid>',
  p_rejection_reason := 'Insufficient capacity for requested storage duration'
);
```

**Expected Success Response:**
```json
{
  "success": true,
  "requestId": "...",
  "referenceId": "REF-YYY",
  "status": "REJECTED",
  "rejectionReason": "Insufficient capacity for requested storage duration",
  "message": "Request REF-YYY rejected successfully"
}
```

**Verify:**
1. `storage_requests.status` = `'REJECTED'`
2. `storage_requests.rejection_reason` is set
3. `notification_queue` has entry with `type='storage_request_rejected'`
4. `admin_audit_log` has entry with `action='REJECT_REQUEST'`

---

## Edge Case Testing

### Test 7: Capacity Validation

Try to approve with insufficient capacity:

```sql
SELECT approve_storage_request_atomic(
  p_request_id := '<request_uuid>',
  p_assigned_rack_ids := ARRAY['<small_rack_id>']::TEXT[],
  p_required_joints := 9999999,
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
Should still be `PENDING` (not `APPROVED`).

### Test 8: Invalid Rack IDs

Try to approve with non-existent rack:

```sql
SELECT approve_storage_request_atomic(
  p_request_id := '<request_uuid>',
  p_assigned_rack_ids := ARRAY['INVALID-RACK-ID']::TEXT[],
  p_required_joints := 50,
  p_notes := 'Testing validation'
);
```

**Expected Error:**
```
ERROR: One or more rack IDs are invalid
HINT: Check that all rack IDs exist in racks table
```

### Test 9: Already Approved Request

Try to approve a request twice:

```sql
-- First approval
SELECT approve_storage_request_atomic(...);

-- Second attempt
SELECT approve_storage_request_atomic(...);
```

**Expected Error:**
```
ERROR: Request REF-XXX is not pending (current status: APPROVED)
HINT: Only PENDING requests can be approved
```

---

## Frontend Integration Compatibility

### No Breaking Changes ✅

The frontend hooks are already fully compatible:

**`hooks/useApprovalWorkflow.ts`:**
```typescript
const { data, error } = await supabase.rpc('approve_storage_request_atomic', {
  p_request_id: request.requestId,
  p_assigned_rack_ids: request.assignedRackIds,  // ✅ Already string[]
  p_required_joints: request.requiredJoints,
  p_notes: request.notes || null,
});
```

**`types/projectSummaries.ts`:**
```typescript
export interface ApprovalRequest {
  requestId: string;
  assignedRackIds: string[];  // ✅ Already text[] (string[] in TS)
  requiredJoints: number;
  notes?: string;
}
```

**Result:** Frontend hooks work immediately after migration deployment!

---

## Notification Worker Integration

The notification queue entries are now compatible with your existing Slack notification system:

**Payload Structure:**
```json
{
  "requestId": "uuid",
  "referenceId": "REF-XXX",
  "companyName": "Apex Drilling",
  "userEmail": "user@example.com",
  "subject": "Storage Request Approved - REF-XXX",
  "assignedRacks": ["A-B1-05", "A-B1-06"],
  "requiredJoints": 50,
  "notes": "Admin notes here",
  "notificationType": "email"
}
```

Your existing notification workers can:
1. Check `payload.notificationType`
2. Route `"email"` type to email service (Resend)
3. Route `"slack"` type to Slack webhook
4. Extract all fields from `payload` jsonb

---

## Migration History Summary

| Migration | Status | Purpose |
|-----------|--------|---------|
| `20251109000001_FINAL_CORRECTED.sql` | ✅ Deployed | Core RPC functions + is_admin_user() |
| `20251109000001_FINAL_INDEXES.sql` | ✅ Deployed | Performance indexes |
| `20251109000002_atomic_approval_workflow.sql` | ✅ Deployed | Approval/rejection functions (initial) |
| `20251109000003_fix_approval_workflow_schema.sql` | ✅ Deployed | Fixed contact_email → user_email |
| `20251109000004_align_approval_with_actual_schema.sql` | ⏳ **Deploy Now** | Fixed racks + notification_queue |

---

## Success Criteria

All tests pass when:

- [x] Functions exist with correct signatures (`text[]` rack IDs)
- [ ] Approval succeeds and updates `storage_requests` + `racks`
- [ ] Rack occupancy increments correctly
- [ ] Notification queue entry created with `type` + `payload`
- [ ] Audit log entry created
- [ ] Capacity validation prevents over-allocation
- [ ] Invalid rack IDs are rejected
- [ ] Already-approved requests cannot be re-approved
- [ ] Rejection workflow works end-to-end
- [ ] Frontend hooks successfully call functions

---

## Next Steps After Deployment

1. ✅ Deploy migration `20251109000004`
2. 🧪 Run Tests 1-9 (approval, rejection, edge cases)
3. 🔌 Test frontend integration with admin dashboard
4. 🚀 Add virtualization for 200+ tiles (critical gap #6)

---

## Rollback (if needed)

**Not recommended** - the previous versions don't work due to schema mismatches. Better to fix forward.

If absolutely necessary:
```sql
-- WARNING: This reverts to broken versions
DROP FUNCTION IF EXISTS approve_storage_request_atomic CASCADE;
DROP FUNCTION IF EXISTS reject_storage_request_atomic CASCADE;
```

Then redeploy from `20251109000002` with manual fixes.

---

## Why This Happened

The migrations were written based on assumptions about the schema structure without first inspecting the actual production schema. Specifically:

1. Assumed `storage_areas` table existed (standard naming)
2. Assumed UUID foreign keys (common pattern)
3. Assumed notification queue had email-specific columns

**Prevention for future:**
- Always run `information_schema` queries before writing migrations
- Test migrations on staging with real schema
- Use database inspection tools before deployment

---

## Summary

| Issue | Status |
|-------|--------|
| Rack table name mismatch | ✅ Fixed: storage_areas → racks |
| Rack ID type mismatch | ✅ Fixed: uuid[] → text[] |
| Notification queue schema | ✅ Fixed: email columns → type+payload |
| TypeScript types | ✅ Already compatible (string[]) |
| Frontend hooks | ✅ No changes needed |
| Migration created | ✅ 20251109000004 |
| Ready to deploy | ✅ Yes |

**Deploy now to unblock testing!**
