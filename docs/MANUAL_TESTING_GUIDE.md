# Manual Testing Guide - Post-Deployment

**Status**: Ready for Manual Testing
**Date**: 2025-11-10
**Prerequisites**: All 3 migrations deployed and verified

---

## Testing Checklist

Use this guide to manually test PipeVault after deploying the critical audit fixes.

---

## Part 1: Security Testing

### Test 1.1: Anonymous Admin Access Blocked

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

### Test 1.2: Admin User Can Access RPC Functions

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
- No "Access denied" errors
- Approval succeeds or shows validation error (e.g., "Insufficient capacity")

**Pass Criteria**: ✅ No access denied errors

---

## Part 2: RPC Schema Testing

### Test 2.1: Project Summaries Load

**Goal**: Verify get_project_summaries_by_company() returns data with rack information

**Steps**:
1. Run in SQL Editor:
   ```sql
   SELECT jsonb_pretty(get_project_summaries_by_company()::jsonb) LIMIT 1;
   ```

**Expected**: Valid nested JSON with structure:
```json
[
  {
    "company": {
      "id": "...",
      "name": "...",
      "domain": "..."
    },
    "projects": [
      {
        "id": "...",
        "referenceId": "REF-...",
        "status": "APPROVED",
        "pipeDetails": { ... },
        "inboundLoads": [
          {
            "id": "...",
            "status": "NEW",
            "documents": [ ... ],
            "assignedRacks": [
              {
                "rackId": "A-A1-01",
                "rackName": "A-A1-01",
                "jointCount": 50,
                "statuses": ["IN_STORAGE"]
              }
            ]
          }
        ],
        "inventorySummary": {
          "total": 50,
          "inStorage": 50,
          "rackNames": ["A-A1-01"]
        }
      }
    ]
  }
]
```

**Pass Criteria**:
- ✅ Query returns valid JSON
- ✅ `assignedRacks` array contains rack data (not empty)
- ✅ `inventorySummary.rackNames` array populated

---

### Test 2.2: Admin Dashboard Loads Without Errors

**Goal**: Verify AdminDashboard renders without console errors

**Steps**:
1. Open browser DevTools (F12) → Console tab
2. Log in as admin user
3. Navigate to Admin Dashboard
4. Check console for errors

**Expected**: No errors related to:
- `truckLoads is not defined`
- `Cannot read property 'filter' of undefined`
- RPC function errors

**Pass Criteria**: ✅ Dashboard loads, no console errors

---

## Part 3: Atomic Approval Workflow Testing

### Test 3.1: Approve Storage Request

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

**Pass Criteria**:
- ✅ All 3 database checks pass
- ✅ No errors in console
- ✅ UI updates immediately

---

### Test 3.2: Reject Storage Request

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

### Test 3.3: Capacity Validation

**Goal**: Verify approval fails if rack capacity exceeded

**Steps**:
1. Find rack with low capacity (e.g., 10 available)
2. Try to approve request requiring more joints (e.g., 50)

**Expected**:
- ❌ Error toast: "Rack capacity exceeded: ..."
- ✅ Request remains PENDING (not partially approved)
- ✅ Rack occupancy unchanged

**Pass Criteria**: ✅ Atomic rollback works, no partial state

---

## Part 4: Trucking Schema Testing

### Test 4.1: Verify truck_loads Table Dropped

**Goal**: Confirm legacy table no longer exists

**Steps**:
```sql
SELECT * FROM truck_loads LIMIT 1;
```

**Expected**: ERROR: relation "truck_loads" does not exist

**Pass Criteria**: ✅ Table does not exist

---

### Test 4.2: Verify trucking_loads Has Data

**Goal**: Confirm new table has data and foreign keys

**Steps**:
```sql
-- Check row count
SELECT COUNT(*) FROM trucking_loads;

-- Check foreign keys exist
SELECT
  tc.constraint_name,
  kcu.column_name,
  ccu.table_name AS foreign_table
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
LEFT JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.table_name = 'inventory'
  AND tc.constraint_type = 'FOREIGN KEY'
  AND kcu.column_name LIKE '%truck%';
```

**Expected**:
- trucking_loads has 4+ rows
- 2 foreign keys on inventory table (delivery_truck_load_id, pickup_truck_load_id)

**Pass Criteria**: ✅ Data exists, foreign keys created

---

### Test 4.3: Old Hook Deprecation

**Goal**: Verify deprecated hooks throw errors if accidentally called

**Steps**:
1. Open browser console
2. In console, try to access old hook:
   ```javascript
   // This should throw error if old code is still present
   ```

3. Check that AdminDashboard does NOT import `useTruckLoads` or `useAddTruckLoad`

**Expected**: No references to old hooks in active code

**Pass Criteria**: ✅ Old hooks not used anywhere

---

## Part 5: Notification Worker Testing

### Test 5.1: Deploy Edge Function

**Goal**: Deploy notification worker to Supabase

**Steps**:
1. Set environment variables in Supabase Dashboard:
   - `RESEND_API_KEY` = your Resend API key
   - `SLACK_WEBHOOK_URL` = your Slack webhook (optional)

2. Deploy Edge Function:
   ```bash
   npx supabase functions deploy process-notification-queue
   ```

3. Test manually:
   ```bash
   npx supabase functions invoke process-notification-queue
   ```

**Expected**: Function deploys successfully, returns:
```json
{
  "message": "No notifications to process",
  "processed": 0
}
```

**Pass Criteria**: ✅ Function deployed, responds without errors

---

### Test 5.2: End-to-End Notification Test

**Goal**: Test full flow from approval → email sent

**Steps**:
1. Approve a storage request (Test 3.1)
2. Verify notification queued:
   ```sql
   SELECT * FROM notification_queue WHERE processed = false;
   ```
3. Run worker manually:
   ```bash
   npx supabase functions invoke process-notification-queue
   ```
4. Check your email inbox (use your email as test request user)
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

### Test 5.3: Set Up Cron Schedule

**Goal**: Configure worker to run automatically every 5 minutes

**Steps**:
1. Enable pg_cron extension:
   ```sql
   CREATE EXTENSION IF NOT EXISTS pg_cron;
   ```

2. Schedule cron job:
   ```sql
   SELECT cron.schedule(
     'process-notification-queue',
     '*/5 * * * *',
     $$
     SELECT net.http_post(
       url := 'https://<your-project-ref>.supabase.co/functions/v1/process-notification-queue',
       headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')),
       body := '{}'::jsonb
     );
     $$
   );
   ```

3. Verify cron job:
   ```sql
   SELECT * FROM cron.job WHERE jobname = 'process-notification-queue';
   ```

**Expected**: Cron job appears in list

**Pass Criteria**: ✅ Cron job scheduled

---

## Part 6: Integration Testing

### Test 6.1: Complete Customer Journey

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

**Expected**: Complete workflow succeeds without errors

**Pass Criteria**: ✅ Customer sees approved request and receives email

---

### Test 6.2: Multi-User Concurrent Approvals

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

## Part 7: Performance Testing

### Test 7.1: Project Summaries Load Time

**Goal**: Verify RPC query performance after schema fixes

**Steps**:
```sql
EXPLAIN ANALYZE
SELECT get_project_summaries_by_company();
```

**Expected**: Query completes in < 500ms

**Pass Criteria**: ✅ Acceptable performance

---

### Test 7.2: Admin Dashboard Load Time

**Goal**: Measure dashboard render time

**Steps**:
1. Open browser DevTools → Network tab
2. Clear cache
3. Reload Admin Dashboard
4. Measure time to interactive

**Expected**: < 2 seconds to full render

**Pass Criteria**: ✅ Dashboard loads quickly

---

## Issue Reporting Template

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

---

## Success Criteria Summary

All tests pass when:

**Security** (Part 1):
- [x] Anonymous users blocked from admin RPCs
- [x] Admin users can access RPC functions

**RPC Schema** (Part 2):
- [x] Project summaries return rack data
- [x] Admin dashboard loads without errors

**Atomic Workflow** (Part 3):
- [x] Approval workflow succeeds
- [x] Rejection workflow succeeds
- [x] Capacity validation works

**Trucking Schema** (Part 4):
- [x] truck_loads table dropped
- [x] trucking_loads has data and foreign keys
- [x] Old hooks deprecated

**Notifications** (Part 5):
- [x] Edge function deployed
- [x] Email notifications sent
- [x] Cron schedule configured

**Integration** (Part 6):
- [x] Complete customer journey works
- [x] Concurrent operations handled

**Performance** (Part 7):
- [x] Queries complete in < 500ms
- [x] Dashboard loads in < 2 seconds

---

## Next Steps After All Tests Pass

1. ✅ Monitor production for 24 hours
2. 📊 Review notification queue processing stats
3. 🔍 Check for any failed notifications
4. 📧 Customize email templates (optional)
5. 🎨 Add company logo to emails (optional)
6. 📱 Set up alerting for failures (optional)

---

**Last Updated**: 2025-11-10
**Status**: Ready for manual testing
**Estimated Testing Time**: 45-60 minutes
