# Testing Guide

**Complete testing reference for PipeVault**

**Last Updated:** 2025-11-16
**Current Version:** 2.0.13

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Customer Workflow Testing](#customer-workflow-testing)
3. [Admin Workflow Testing](#admin-workflow-testing)
4. [Security Testing](#security-testing)
5. [Integration Testing](#integration-testing)
6. [Performance Testing](#performance-testing)
7. [Atomic Workflow Testing](#atomic-workflow-testing)
8. [Edge Case Testing](#edge-case-testing)
9. [Reporting Issues](#reporting-issues)

---

## Quick Start

### Admin Test Accounts

**Nathan Turchyn**: nathan@mpsgroup.ca
**Tyrel Turchyn**: tyrel@mpsgroup.ca

**Note**: After signing up, Kyle will grant you admin access in the database.

### What We're Testing

1. **AI Manifest Extraction**: Does Gemini accurately extract pipe data from PDFs?
2. **Workflow States**: Do loads transition correctly (NEW → APPROVED → IN_TRANSIT → COMPLETED)?
3. **Real-time Updates**: Do company tiles update when you approve loads?
4. **Inventory Creation**: Do all joints appear after marking completed?
5. **Rack Capacity**: Does it prevent over-capacity assignments?
6. **User Experience**: Is anything confusing, broken, or slow?

---

## Customer Workflow Testing

### Step 1: Sign Up & Request Storage

**Goal**: Test customer onboarding and storage request creation

**Steps**:
1. Go to app → Click **Sign Up**
2. Use a **real email** (you'll get a verification link)
3. Fill in company details (name, domain)
4. Create your first **Storage Request**:
   - Pipe type, grade, diameter, weight
   - Estimated quantity (joints)
   - Expected delivery date

**Expected**:
- ✅ Verification email received
- ✅ Storage request created with status PENDING
- ✅ Request appears in customer dashboard

**🚨 STUCK?** Mark which field confused you or what error you got.

---

### Step 2: Book Load #1

**Goal**: Test load booking wizard

**Steps**:
1. After creating request, click **"Request a Load"**
2. Pick delivery time slot
3. Enter driver/trucking company info
4. Click **Submit**

**Expected**:
- ✅ Load shows as "Pending Admin Approval"
- ✅ Load appears in customer dashboard

**🚨 STUCK?** Note if time slots don't load, form errors, or submission fails.

---

### Step 3: Upload Manifest

**Goal**: Test AI manifest extraction

**Steps**:
1. Go to **Documents** tab in your request
2. Select the load you just created
3. Upload a **PDF manifest** (shipping document with pipe list)
4. Wait 10-15 seconds for AI extraction

**Expected**:
- ✅ Loading spinner appears
- ✅ Success message: "Document uploaded and manifest data extracted successfully!"
- ✅ Load totals update automatically (joints, length, weight)

**🚨 STUCK?** Mark if:
- AI extraction fails
- Document won't upload
- Totals don't update

---

### Step 4: Wait for Admin Approval

**Goal**: Test status tracking

**Steps**:
1. Admin reviews your load (you'll see status change to "Approved")
2. Admin marks it "In Transit" when truck departs
3. You can track status in your dashboard

**Expected**:
- ✅ Loads show in your dashboard with current status
- ✅ Status badges update in real-time

**🚨 STUCK?** Can't see your load? Status stuck?

---

### Step 5: View Inventory

**Goal**: Test inventory display after load completion

**Steps**:
1. After admin marks load "Completed", go to **Inventory** tab
2. See your pipe listed with:
   - Rack location (e.g., "A-A1-5")
   - Quantity stored
   - Pipe specs

**Expected**:
- ✅ All joints from manifest appear as individual inventory items
- ✅ Rack locations displayed correctly
- ✅ Totals match manifest data

**🚨 STUCK?** Inventory missing? Wrong quantity? Can't find rack location?

---

## Admin Workflow Testing

### Step 1: Approve Pending Load

**Goal**: Test admin approval workflow

**Steps**:
1. Sign in as admin → Go to **Admin Dashboard**
2. Click on company tile showing **"1 new"** badge (orange)
3. Click on the pending load
4. Review:
   - Delivery time
   - Manifest data (if uploaded)
   - Pipe specs
5. Click **Approve Load**

**Expected**:
- ✅ Load disappears from "Pending Loads"
- ✅ Load appears in "Approved Loads"
- ✅ Success toast notification
- ✅ Company tile badge updates

**🚨 STUCK?** Mark if:
- Can't see company tile
- Badge count wrong
- Manifest data doesn't show
- Approval fails

**Verify in Database**:
```sql
-- Check request was updated
SELECT id, reference_id, status, assigned_rack_ids, admin_notes
FROM storage_requests
WHERE id = '<request-id>';

-- Check rack occupancy increased
SELECT id, name, capacity, occupied
FROM racks
WHERE id = ANY(ARRAY['<rack-id>']::text[]);

-- Check notification queued
SELECT * FROM notification_queue
WHERE payload->>'referenceId' = '<reference-id>'
ORDER BY created_at DESC LIMIT 1;
```

---

### Step 2: Mark Load In Transit

**Goal**: Test load status transition

**Steps**:
1. Go to **Approved Loads** tab
2. Click on the approved load
3. Click **Mark In Transit**

**Expected**:
- ✅ Load moves to "In Transit" tab
- ✅ Status badge updates
- ✅ Customer receives notification

**🚨 STUCK?** Button doesn't work? Load stuck in Approved?

---

### Step 3: Mark Load Completed

**Goal**: Test completion workflow with inventory creation

**Steps**:
1. Go to **In Transit** tab
2. Click on the load
3. Review manifest data (should show pipe list)
4. Select rack (e.g., "A-A1-5")
5. Enter actual joints received (must match manifest)
6. Add notes (optional)
7. Click **Mark Completed**

**Expected**:
- ✅ Success message
- ✅ Load status changes to COMPLETED
- ✅ Inventory created automatically (87 records if manifest had 87 joints)
- ✅ Rack occupancy updates
- ✅ Customer sees inventory in dashboard

**🚨 STUCK?** Mark if:
- "No manifest data found" error
- Rack capacity error
- Quantity mismatch error
- Inventory not created

**Verify in Database**:
```sql
-- Check load status
SELECT status, total_joints_completed, completed_at
FROM trucking_loads
WHERE id = '<load-id>';

-- Check inventory created
SELECT COUNT(*) as inventory_count
FROM inventory
WHERE delivery_truck_load_id = '<load-id>';

-- Check rack occupancy
SELECT occupied_count
FROM storage_areas
WHERE id = '<rack-id>';
```

---

### Step 4: View Company Inventory

**Goal**: Test inventory aggregation

**Steps**:
1. Click on company tile
2. Go to **Inventory** tab
3. See all pipe in storage with rack locations

**Expected**:
- ✅ Inventory count matches completed loads
- ✅ Each joint has rack location
- ✅ Totals are accurate

**🚨 STUCK?** Wrong totals? Missing inventory? Can't filter by company?

---

## Security Testing

### Test 1: Anonymous Admin Access Blocked

**Goal**: Verify anonymous users cannot call admin RPC functions

**Steps**:
1. Open Supabase SQL Editor
2. Run:
   ```sql
   SELECT is_admin_user() as is_admin;
   ```
3. **Expected**: Returns `false` (you are anonymous in SQL Editor)

4. Try to approve a request:
   ```sql
   SELECT approve_storage_request_atomic(
     'test-uuid'::uuid,
     ARRAY['A-A1-01']::text[],
     50,
     'test'
   );
   ```
5. **Expected**: ERROR: "Access denied. Admin privileges required."

**Pass Criteria**: ✅ Both queries return expected results

---

### Test 2: Admin User Can Access RPC Functions

**Goal**: Verify authenticated admin users CAN call RPC functions

**Prerequisites**: Add yourself to admin_users table:
```sql
-- Get your auth user ID
SELECT id, email FROM auth.users WHERE email = 'your-admin-email@example.com';

-- Add to admin_users table
INSERT INTO admin_users (user_id)
VALUES ('<your-auth-user-id>');
```

**Steps**:
1. Log in to PipeVault as admin
2. Navigate to Admin Dashboard
3. Find a PENDING storage request
4. Attempt to approve it

**Expected**:
- ✅ No "Access denied" errors
- ✅ Approval succeeds or shows validation error (e.g., "Insufficient capacity")

**Pass Criteria**: ✅ No access denied errors

---

### Test 3: RLS Policy Enforcement

**Goal**: Verify customers can only see their own data

**Steps**:
1. Log in as Customer A
2. Note request IDs visible
3. Log in as Customer B
4. Verify Customer A's requests NOT visible

**Expected**:
- ✅ Each customer sees only their company's data
- ✅ No data leakage between companies

---

## Integration Testing

### Test 1: Complete Customer Journey

**Goal**: Test full workflow from customer perspective

**Steps**:
1. Log out of admin account
2. Log in as customer user
3. Create new storage request
4. Log back in as admin
5. Approve the request
6. Check customer email for approval notification
7. Log back in as customer
8. Verify request shows as APPROVED in dashboard

**Expected**:
- ✅ Complete workflow succeeds without errors
- ✅ Customer sees approved request
- ✅ Customer receives email

**Pass Criteria**: ✅ Customer sees approved request and receives email

---

### Test 2: Multi-User Concurrent Approvals

**Goal**: Test atomic transactions with concurrent operations

**Steps** (requires 2 admin users):
1. Admin 1: Start approving Request A (don't confirm yet)
2. Admin 2: Start approving Request B (don't confirm yet)
3. Both click "Confirm" at same time

**Expected**:
- ✅ Both approvals succeed (no race conditions)
- ✅ Rack occupancy correctly updated
- ✅ No duplicate notifications

**Pass Criteria**: ✅ Both approvals process correctly

---

### Test 3: End-to-End Notification Test

**Goal**: Test full flow from approval → email sent

**Steps**:
1. Approve a storage request
2. Verify notification queued:
   ```sql
   SELECT * FROM notification_queue WHERE processed = false;
   ```
3. Run worker manually:
   ```bash
   npx supabase functions invoke process-notification-queue
   ```
4. Check your email inbox
5. Verify notification marked as processed:
   ```sql
   SELECT * FROM notification_queue WHERE processed = true;
   ```

**Expected**:
- ✅ Email received with approval details
- ✅ Notification marked processed
- ✅ Slack message sent (if configured)

**Pass Criteria**: ✅ Email received and notification processed

---

## Performance Testing

### Test 1: Project Summaries Load Time

**Goal**: Verify RPC query performance

**Steps**:
```sql
EXPLAIN ANALYZE
SELECT get_project_summaries_by_company();
```

**Expected**: Query completes in < 500ms

**Pass Criteria**: ✅ Acceptable performance

---

### Test 2: Admin Dashboard Load Time

**Goal**: Measure dashboard render time

**Steps**:
1. Open browser DevTools → Network tab
2. Clear cache
3. Reload Admin Dashboard
4. Measure time to interactive

**Expected**: < 2 seconds to full render

**Pass Criteria**: ✅ Dashboard loads quickly

---

### Test 3: Check Index Usage

**Goal**: Verify database indexes are being used

**Steps**:
```sql
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read
FROM pg_stat_user_indexes
WHERE indexname LIKE '%created_at%'
ORDER BY idx_scan DESC;
```

**Expected**: After admin dashboard loads a few times, `idx_scan` should be > 0

---

## Atomic Workflow Testing

### Test 1: Approve Storage Request

**Goal**: Test end-to-end approval workflow with atomic transaction

**Prerequisites**:
- At least 1 PENDING storage request exists
- At least 1 rack with available capacity

**Steps**:
1. Log in as admin
2. Go to Admin Dashboard
3. Find PENDING request
4. Click "Approve"
5. Select rack(s) with sufficient capacity
6. Enter notes: "Testing atomic approval workflow"
7. Click "Confirm"

**Expected**:
- ✅ Success toast notification
- ✅ Request status changes to APPROVED
- ✅ Console shows: `✅ Approval successful: { ... }`
- ✅ No partial state (if error occurs, no changes saved)

---

### Test 2: Reject Storage Request

**Goal**: Test rejection workflow with atomic transaction

**Steps**:
1. Find another PENDING request
2. Click "Reject"
3. Enter reason: "Insufficient capacity for requested duration"
4. Click "Confirm"

**Expected**:
- ✅ Success toast notification
- ✅ Request status changes to REJECTED
- ✅ Console shows: `✅ Rejection successful: { ... }`

**Verify in Database**:
```sql
SELECT id, reference_id, status, rejection_reason
FROM storage_requests
WHERE id = '<request-id>';

SELECT * FROM notification_queue
WHERE payload->>'referenceId' = '<reference-id>'
ORDER BY created_at DESC LIMIT 1;
```

**Pass Criteria**: ✅ Status = REJECTED, notification queued

---

## Edge Case Testing

### Test 1: Insufficient Capacity

**Goal**: Verify approval fails if rack capacity exceeded

**Steps**:
```sql
-- Try to approve with way more joints than available
SELECT approve_storage_request_atomic(
  p_request_id := 'request-uuid'::UUID,
  p_assigned_rack_ids := ARRAY['A-A1-10']::TEXT[],
  p_required_joints := 9999999,
  p_notes := 'Testing capacity validation'
);
```

**Expected Error**:
```
ERROR: Insufficient rack capacity: 9999999 joints required, X available across racks: A-A1-10
HINT: Assign additional racks or reduce required joints
```

**Verify No Changes**:
```sql
SELECT status FROM storage_requests WHERE id = 'request-uuid';
-- Expected: Status unchanged
```

**Pass Criteria**: ✅ Atomic rollback works, no partial state

---

### Test 2: Invalid Rack ID

**Goal**: Test validation with non-existent rack

**Steps**:
```sql
SELECT approve_storage_request_atomic(
  p_request_id := 'request-uuid'::UUID,
  p_assigned_rack_ids := ARRAY['INVALID-RACK']::TEXT[],
  p_required_joints := 50,
  p_notes := 'Testing validation'
);
```

**Expected Error**:
```
ERROR: One or more rack IDs are invalid
HINT: Check that all rack IDs exist in racks table
```

---

### Test 3: Already Approved Request

**Goal**: Prevent duplicate approvals

**Steps**:
```sql
-- Try to approve an already-approved request
SELECT approve_storage_request_atomic(
  p_request_id := 'approved-request-uuid'::UUID,
  p_assigned_rack_ids := ARRAY['A-A1-10']::TEXT[],
  p_required_joints := 50,
  p_notes := 'Testing duplicate approval'
);
```

**Expected Error**:
```
ERROR: Request REF-XXX is not pending (current status: APPROVED)
HINT: Only PENDING requests can be approved
```

---

### Test 4: Multi-Rack Distribution

**Goal**: Test inventory distributed across multiple racks

**Steps**:
1. Find 3 racks with available capacity (30+ joints each)
2. Create test request requiring 90 joints
3. Approve with 3 racks:
```sql
SELECT approve_storage_request_atomic(
  p_request_id := 'request-uuid'::UUID,
  p_assigned_rack_ids := ARRAY['rack1', 'rack2', 'rack3']::TEXT[],
  p_required_joints := 90,
  p_notes := 'Testing multi-rack distribution'
);
```

**Expected**:
- ✅ 90 joints distributed evenly (30 each)
- ✅ Each rack's occupancy increases by 30

---

### Test 5: Upload Edge Cases

**Test Cases**:
- Upload manifest with 1 joint (minimum)
- Upload manifest with 100 joints (large load)
- Try uploading a non-PDF (should reject)
- Try booking same time slot twice (should conflict)
- Upload corrupt PDF
- Upload PDF without pipe data

**Expected**: Appropriate error messages for each case

---

## Reporting Issues

### Issue Reporting Template

If you find issues during testing, report using this format:

```markdown
### Issue: [Brief description]

**Test**: [Which test from this guide]
**Expected**: [What should happen]
**Actual**: [What actually happened]
**Steps to Reproduce**:
1. ...
2. ...

**Error Messages**:
```
[paste console errors]
```

**Screenshots**: [if applicable]

**Database State**:
```sql
[relevant query results]
```
```

**When you get stuck**, note:

1. **Which step?** (e.g., "Customer Step 3: Upload Manifest")
2. **What happened?** (error message, wrong behavior, stuck loading)
3. **What you expected?** (what should have happened)
4. **Screenshot?** (if possible)

**Send to Kyle with**:
- Your email address
- Browser (Chrome, Firefox, etc.)
- Device (laptop, phone)

---

## Success Criteria

### Customer Test Complete When

- ✅ Signed up & verified email
- ✅ Created storage request
- ✅ Booked load with time slot
- ✅ Uploaded manifest (AI extracted data)
- ✅ Saw inventory after admin completed load

### Admin Test Complete When

- ✅ Approved a pending load
- ✅ Marked load in transit
- ✅ Marked load completed with manifest data
- ✅ Verified inventory was created correctly
- ✅ Saw company tile update in real-time

### All Tests Pass When

**Security**:
- [x] Anonymous users blocked from admin RPCs
- [x] Admin users can access RPC functions
- [x] RLS policies enforce company isolation

**Functionality**:
- [x] Project summaries return rack data
- [x] Admin dashboard loads without errors
- [x] Approval workflow succeeds
- [x] Rejection workflow succeeds
- [x] Capacity validation works
- [x] Complete customer journey works
- [x] Concurrent operations handled

**Performance**:
- [x] Queries complete in < 500ms
- [x] Dashboard loads in < 2 seconds
- [x] Indexes show usage in `pg_stat_user_indexes`

---

## Testing Tips

- **Use real data**: Actual company names, realistic pipe specs
- **Test on mobile**: Does it work on your phone?
- **Refresh the page**: Do changes persist?
- **Open two browsers**: Customer view + Admin view side-by-side
- **Monitor console**: Check for JavaScript errors
- **Check network**: Look for failed requests in DevTools

---

## Next Steps After All Tests Pass

1. ✅ Monitor production for 24 hours
2. 📊 Review notification queue processing stats
3. 🔍 Check for any failed notifications
4. 📧 Customize email templates (optional)
5. 🎨 Add company logo to emails (optional)
6. 📱 Set up alerting for failures (optional)

---

**Last Updated**: 2025-11-16
**Status**: Ready for testing
**Estimated Testing Time**: 45-60 minutes
