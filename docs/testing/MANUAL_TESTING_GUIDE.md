# PipeVault Manual Testing Guide

**Database Status:** ✅ Clean and Ready
**Test Date:** 2025-11-18
**Tester:** Kyle
**Application URL:** http://localhost:3001/

---

## Quick Start

This guide provides a simple checklist for manually testing the complete PipeVault workflow from sign-up to delivery.

---

## Test Account Credentials

### Customer 1: Atlas Energy

- **Email:** kyle@bushelsenergy.com
- **Password:** (Create during sign-up)
- **Company:** Atlas Energy Ltd
- **Domain:** bushelsenergy.com
- **Test Data:** 150 joints, 5.5" L80 BTC casing

### Customer 2: Northern Drilling

- **Email:** kyle@ibelievefit.com
- **Password:** (Create during sign-up)
- **Company:** Northern Drilling Corp
- **Domain:** ibelievefit.com
- **Test Data:** 80 joints, 7.0" P110 Premium sand control

---

## Testing Checklist

### Phase 1: Customer Sign-Up & Authentication

#### Test 1.1: Atlas Energy Sign-Up

- [ ] Navigate to http://localhost:3001/
- [ ] Click "Sign Up"
- [ ] Enter:
  - First Name: Kyle
  - Last Name: Bushels
  - Email: kyle@bushelsenergy.com
  - Password: TestPassword123!
  - Company Name: Atlas Energy Ltd
  - Domain: bushelsenergy.com
- [ ] Click "Sign Up"
- [ ] ✅ **Expected:** Redirected to Dashboard
- [ ] ✅ **Expected:** See "Welcome, Kyle Bushels" in header
- [ ] ✅ **Expected:** Dashboard shows 4 tiles (Recent Requests, Quick Actions, Roughneck AI, Support)

**Database Verification:**

```sql
-- Run this in Supabase SQL Editor
SELECT id, email, raw_user_meta_data->>'first_name' as first_name, raw_user_meta_data->>'last_name' as last_name
FROM auth.users
WHERE email = 'kyle@bushelsenergy.com';

SELECT id, name, domain, admin_emails
FROM companies
WHERE domain = 'bushelsenergy.com';
```

**Expected Results:**

- 1 auth user found with correct first_name and last_name
- 1 company found with name "Atlas Energy Ltd"

---

#### Test 1.2: Northern Drilling Sign-Up

- [ ] Log out
- [ ] Sign up with kyle@ibelievefit.com
- [ ] Use company name "Northern Drilling Corp" and domain "ibelievefit.com"
- [ ] ✅ **Expected:** Successfully created and redirected to dashboard

**Database Verification:**

```sql
SELECT COUNT(*) FROM auth.users WHERE email IN ('kyle@bushelsenergy.com', 'kyle@ibelievefit.com');
-- Expected: 2

SELECT COUNT(*) FROM companies WHERE domain IN ('bushelsenergy.com', 'ibelievefit.com');
-- Expected: 2
```

---

### Phase 2: Storage Request Submission

#### Test 2.1: Atlas Energy Storage Request

- [ ] Log in as kyle@bushelsenergy.com
- [ ] Click "Create New Request" tile
- [ ] Fill out the wizard:
  - **Step 1 - Contact:**
    - Contact Name: Kyle Bushels
    - Phone: 780-555-0123
    - Email: kyle@bushelsenergy.com
  - **Step 2 - Pipe Details:**
    - Pipe Type: Casing
    - Size: 5.5
    - Grade: L80
    - Connection: BTC 8 Round
  - **Step 3 - Quantity:**
    - Total Joints: 150
    - Total Meters: 1500
  - **Step 4 - Duration:**
    - Estimated Start: (Today's date)
    - Estimated End: (30 days from today)
  - **Step 5 - Delivery:**
    - UWI: 100/12-34-056-07W5/0
    - Well Name: Atlas Alpha-7
    - Notes: "Test storage request for Atlas Energy"
- [ ] Click "Submit Request"
- [ ] ✅ **Expected:** Success message shown
- [ ] ✅ **Expected:** Redirected to Dashboard
- [ ] ✅ **Expected:** See new request in "Recent Requests" tile

**Database Verification:**

```sql
SELECT id, reference_id, status, pipe_type, size, grade, connection,
       total_joints, total_meters, uwi, well_name
FROM storage_requests
WHERE company_id = (SELECT id FROM companies WHERE domain = 'bushelsenergy.com');
-- Expected: 1 request with status = 'PENDING'
```

---

#### Test 2.2: RLS Policy Validation (Critical!)

- [ ] Log out
- [ ] Log in as kyle@ibelievefit.com (Northern Drilling)
- [ ] Check Dashboard
- [ ] ✅ **Expected:** Do NOT see Atlas Energy's storage request
- [ ] ✅ **Expected:** "Recent Requests" tile shows empty state

**Database Verification:**

```sql
-- This should return 0 when executed as Northern Drilling user via RLS
SELECT COUNT(*)
FROM storage_requests
WHERE company_id = (SELECT id FROM companies WHERE domain = 'bushelsenergy.com');
-- When run with service_role: Expected 1
-- When run as kyle@ibelievefit.com via RLS: Expected 0
```

---

### Phase 3: Admin Approval Workflow

**Note:** You'll need to add kyle@bushelsenergy.com or kyle@ibelievefit.com to the `admin_users` table to access the admin dashboard.

#### Test 3.1: Grant Admin Access

Run this SQL in Supabase SQL Editor:

```sql
INSERT INTO admin_users (email, created_at)
VALUES ('kyle@bushelsenergy.com', NOW())
ON CONFLICT (email) DO NOTHING;
```

#### Test 3.2: Admin Dashboard Access

- [ ] Log in as kyle@bushelsenergy.com
- [ ] Navigate to http://localhost:3001/admin
- [ ] ✅ **Expected:** Admin Dashboard loads successfully
- [ ] ✅ **Expected:** See Atlas Energy's storage request in "Pending Approvals"

---

#### Test 3.3: Approve Storage Request

- [ ] Click on the Atlas Energy storage request
- [ ] Review request details
- [ ] Select rack assignment (e.g., "Yard A - Row A1 - Rack 05")
- [ ] Click "Approve Request"
- [ ] ✅ **Expected:** Success message shown
- [ ] ✅ **Expected:** Request disappears from "Pending Approvals"
- [ ] ✅ **Expected:** Request appears in "Approved Requests"

**Database Verification:**

```sql
SELECT id, reference_id, status, storage_area_id, approved_at, approved_by
FROM storage_requests
WHERE company_id = (SELECT id FROM companies WHERE domain = 'bushelsenergy.com');
-- Expected: status = 'APPROVED', storage_area_id NOT NULL, approved_at NOT NULL
```

**Email Verification:**

- [ ] Check if approval email was sent to kyle@bushelsenergy.com
- [ ] ✅ **Expected:** Email contains rack assignment and next steps

---

### Phase 4: Inbound Delivery Scheduling

#### Test 4.1: Schedule First Inbound Load

- [ ] Log out from admin
- [ ] Log in as kyle@bushelsenergy.com
- [ ] Navigate to Dashboard
- [ ] Click on the approved storage request
- [ ] Click "Schedule Inbound Delivery"
- [ ] Fill out InboundShipmentWizard:
  - **Step 1 - Select Request:** (Pre-selected)
  - **Step 2 - Delivery Details:**
    - Expected Delivery Date: (Tomorrow's date)
    - Carrier Name: ABC Trucking
    - Driver Name: John Driver
    - Truck License: ABC-1234
  - **Step 3 - Load Details:**
    - Load Number: 1
    - Estimated Joints: 75 (half of total)
  - **Step 4 - Upload Documents:**
    - Upload a test manifest PDF (or skip for now)
  - **Step 5 - Review:**
    - Review all details
- [ ] Click "Submit Delivery"
- [ ] ✅ **Expected:** Success message
- [ ] ✅ **Expected:** See trucking load created

**Database Verification:**

```sql
SELECT tl.id, tl.reference_id, tl.status, tl.expected_delivery_date,
       tl.carrier_name, tl.driver_name, tl.load_number, tl.estimated_joints
FROM trucking_loads tl
JOIN storage_requests sr ON tl.storage_request_id = sr.id
WHERE sr.company_id = (SELECT id FROM companies WHERE domain = 'bushelsenergy.com');
-- Expected: 1 trucking_load with status = 'NEW', load_number = 1
```

---

#### Test 4.2: Sequential Load Blocking Validation

- [ ] Try to schedule a second inbound load (Load #2)
- [ ] ✅ **Expected:** System should block or warn that Load #1 must be approved first
- [ ] ✅ **Expected:** Cannot proceed until Load #1 is marked as APPROVED

**This tests the critical sequential load blocking feature.**

---

### Phase 5: Admin Load Approval & Arrival

#### Test 5.1: Approve Load #1

- [ ] Log in as admin (kyle@bushelsenergy.com with admin access)
- [ ] Navigate to Admin Dashboard
- [ ] Find Load #1 in pending loads
- [ ] Click "Approve Load"
- [ ] ✅ **Expected:** Load status changes to APPROVED

**Database Verification:**

```sql
SELECT id, reference_id, status, approved_at
FROM trucking_loads
WHERE load_number = 1
  AND storage_request_id = (
    SELECT id FROM storage_requests
    WHERE company_id = (SELECT id FROM companies WHERE domain = 'bushelsenergy.com')
  );
-- Expected: status = 'APPROVED', approved_at NOT NULL
```

---

#### Test 5.2: Mark Load as Arrived

- [ ] In Admin Dashboard, find Load #1
- [ ] Click "Mark as Arrived"
- [ ] Assign to rack (e.g., "Yard A - Row A1 - Rack 05")
- [ ] Enter actual quantity received (e.g., 75 joints)
- [ ] ✅ **Expected:** Inventory created
- [ ] ✅ **Expected:** Load status = IN_TRANSIT or COMPLETED (check your state machine)

**Database Verification:**

```sql
-- Check trucking load status
SELECT id, reference_id, status, actual_joints, delivered_at
FROM trucking_loads
WHERE load_number = 1;
-- Expected: status = 'COMPLETED', actual_joints = 75, delivered_at NOT NULL

-- Check inventory created
SELECT id, company_id, storage_area_id, quantity_joints, status
FROM inventory
WHERE trucking_load_id = (
  SELECT id FROM trucking_loads WHERE load_number = 1
);
-- Expected: 1 inventory record, status = 'IN_STORAGE', quantity_joints = 75
```

---

### Phase 6: Outbound Pickup Scheduling

#### Test 6.1: Schedule Outbound Pickup

- [ ] Log in as kyle@bushelsenergy.com
- [ ] Navigate to Dashboard
- [ ] Click on inventory or storage request
- [ ] Click "Schedule Outbound Pickup"
- [ ] Fill out OutboundShipmentWizard:
  - **Step 1 - Select Inventory:**
    - Select the 75 joints in storage
  - **Step 2 - Pickup Details:**
    - Pickup Date: (3 days from now)
    - Carrier: XYZ Trucking
    - Driver: Jane Driver
    - Truck License: XYZ-5678
  - **Step 3 - Destination:**
    - Destination UWI: 100/13-35-057-08W5/0
    - Well Name: Atlas Beta-9
  - **Step 4 - Review:**
    - Confirm all details
- [ ] Click "Submit Pickup Request"
- [ ] ✅ **Expected:** Outbound trucking load created
- [ ] ✅ **Expected:** Inventory status changes to PENDING_PICKUP

**Database Verification:**

```sql
-- Check outbound trucking load
SELECT id, reference_id, status, expected_pickup_date, carrier_name
FROM trucking_loads
WHERE direction = 'OUTBOUND'
  AND storage_request_id = (
    SELECT id FROM storage_requests
    WHERE company_id = (SELECT id FROM companies WHERE domain = 'bushelsenergy.com')
  );
-- Expected: 1 outbound load with status = 'NEW' or 'APPROVED'

-- Check inventory status
SELECT id, status
FROM inventory
WHERE company_id = (SELECT id FROM companies WHERE domain = 'bushelsenergy.com');
-- Expected: status = 'PENDING_PICKUP'
```

---

### Phase 7: Complete Workflow

#### Test 7.1: Admin Marks Pickup Complete

- [ ] Log in as admin
- [ ] Find the outbound load
- [ ] Click "Mark as Picked Up"
- [ ] ✅ **Expected:** Load status = IN_TRANSIT
- [ ] ✅ **Expected:** Inventory status = IN_TRANSIT

#### Test 7.2: Mark Delivery Complete

- [ ] Admin marks load as "Delivered"
- [ ] ✅ **Expected:** Load status = COMPLETED
- [ ] ✅ **Expected:** Inventory status = DELIVERED

**Database Verification:**

```sql
-- Check final states
SELECT
  sr.reference_id as request_ref,
  sr.status as request_status,
  COUNT(DISTINCT tl.id) as total_loads,
  SUM(CASE WHEN inv.status = 'DELIVERED' THEN 1 ELSE 0 END) as delivered_inventory
FROM storage_requests sr
LEFT JOIN trucking_loads tl ON sr.id = tl.storage_request_id
LEFT JOIN inventory inv ON sr.company_id = inv.company_id
WHERE sr.company_id = (SELECT id FROM companies WHERE domain = 'bushelsenergy.com')
GROUP BY sr.id;
-- Expected: request_status = 'APPROVED', total_loads = 2 (1 inbound + 1 outbound), delivered_inventory = 1
```

---

## Critical Checkpoints

### Data Integrity Checks

Run these queries after completing all tests:

```sql
-- No orphaned trucking loads
SELECT COUNT(*)
FROM trucking_loads tl
LEFT JOIN storage_requests sr ON tl.storage_request_id = sr.id
WHERE sr.id IS NULL;
-- Expected: 0

-- No orphaned inventory
SELECT COUNT(*)
FROM inventory inv
LEFT JOIN companies c ON inv.company_id = c.id
WHERE c.id IS NULL;
-- Expected: 0

-- All inventory has valid storage areas
SELECT COUNT(*)
FROM inventory
WHERE storage_area_id IS NULL AND status = 'IN_STORAGE';
-- Expected: 0

-- Rack capacity not exceeded
SELECT sa.name, sa.capacity, COUNT(inv.id) as occupied
FROM storage_areas sa
LEFT JOIN inventory inv ON sa.id = inv.storage_area_id AND inv.status = 'IN_STORAGE'
GROUP BY sa.id
HAVING COUNT(inv.id) > sa.capacity;
-- Expected: 0 rows (no overbooked racks)
```

---

## Known Issues to Watch For

1. **AI Extraction Failures**
   - Manifest upload may timeout or fail
   - Workaround: Skip document upload initially

2. **Email Notification Delays**
   - Approval emails may take 5-30 seconds to arrive
   - Check Supabase Edge Function logs if > 1 minute

3. **Real-Time Update Lag**
   - Dashboard may not update immediately after state changes
   - Workaround: Refresh page manually

4. **Rack Capacity Race Conditions**
   - Multiple admins approving simultaneously may exceed rack capacity
   - Verify capacity checks are atomic

---

## Bug Report Template

If you find issues during testing, document them using this template:

````markdown
### Bug Report #[NUMBER]

**Severity:** [P0 - Blocker | P1 - Critical | P2 - Major | P3 - Minor]

**Title:** [Short description]

**Steps to Reproduce:**

1.
2.
3.

**Expected Behavior:**

**Actual Behavior:**

**Screenshots/Logs:**

**Database State:**

```sql
-- Paste relevant SQL query results
```
````

**Browser:** [Chrome/Firefox/Edge]
**Console Errors:** [Paste any JavaScript errors]

**Workaround:** [If available]

```

---

## Testing Progress

Track your progress here:

### Phase 1: Authentication
- [ ] Test 1.1: Atlas Energy Sign-Up
- [ ] Test 1.2: Northern Drilling Sign-Up

### Phase 2: Storage Requests
- [ ] Test 2.1: Atlas Energy Storage Request
- [ ] Test 2.2: RLS Policy Validation

### Phase 3: Admin Approval
- [ ] Test 3.1: Grant Admin Access
- [ ] Test 3.2: Admin Dashboard Access
- [ ] Test 3.3: Approve Storage Request

### Phase 4: Inbound Delivery
- [ ] Test 4.1: Schedule First Inbound Load
- [ ] Test 4.2: Sequential Load Blocking Validation

### Phase 5: Admin Load Management
- [ ] Test 5.1: Approve Load #1
- [ ] Test 5.2: Mark Load as Arrived

### Phase 6: Outbound Pickup
- [ ] Test 6.1: Schedule Outbound Pickup

### Phase 7: Completion
- [ ] Test 7.1: Admin Marks Pickup Complete
- [ ] Test 7.2: Mark Delivery Complete

### Data Integrity
- [ ] All data integrity checks pass
- [ ] No orphaned records
- [ ] Rack capacities valid

---

## Summary

**Total Tests:** 15
**Tests Passed:** ___
**Tests Failed:** ___
**Bugs Found:** ___
**Blockers:** ___

**Overall Status:** [ ] PASS | [ ] FAIL | [ ] BLOCKED

**Notes:**


---

**Testing Complete!** 🎉

If all tests pass, the PipeVault workflow is functioning correctly end-to-end.
```
