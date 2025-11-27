# PipeVault End-to-End Workflow Testing Plan

**Journey Stage Owner**: Customer Journey Orchestrator Agent
**Test Environment**: Fresh database (all test data wiped)
**Version**: v1.0
**Last Updated**: 2025-11-18

---

## Table of Contents

1. [Testing Overview](#testing-overview)
2. [Pre-Testing Setup](#pre-testing-setup)
3. [State Machine Reference](#state-machine-reference)
4. [Test Data Specifications](#test-data-specifications)
5. [Customer Journey Tests](#customer-journey-tests)
6. [Admin Workflow Tests](#admin-workflow-tests)
7. [Integration Point Tests](#integration-point-tests)
8. [Error Handling & Edge Cases](#error-handling--edge-cases)
9. [Data Integrity Checkpoints](#data-integrity-checkpoints)
10. [Known Issues & Workarounds](#known-issues--workarounds)

---

## Testing Overview

This document provides a comprehensive testing plan for the complete PipeVault customer journey, from initial sign-up through final delivery and invoice generation. The database has been completely wiped, allowing for clean end-to-end testing.

### Critical Success Criteria

- [ ] Complete customer journey from sign-up to final delivery without data loss
- [ ] All state transitions follow documented state machine
- [ ] Real-time updates function correctly (Supabase subscriptions)
- [ ] AI document extraction produces accurate results
- [ ] Email and Slack notifications sent at appropriate milestones
- [ ] RLS policies properly isolate data between companies
- [ ] No orphaned records or broken foreign key relationships

---

## Pre-Testing Setup

### Environment Variables Required

Verify these environment variables are configured:

```bash
# Supabase
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# Google AI (for manifest processing)
VITE_GOOGLE_AI_API_KEY=your-gemini-api-key

# Slack (for notifications)
SLACK_WEBHOOK_URL=your-slack-webhook

# Resend (for emails)
RESEND_API_KEY=your-resend-api-key
```

### Database Verification

Run these queries to confirm clean slate:

```sql
-- Should return 0 for all
SELECT
  (SELECT COUNT(*) FROM storage_requests) as requests,
  (SELECT COUNT(*) FROM trucking_loads) as loads,
  (SELECT COUNT(*) FROM trucking_documents) as documents,
  (SELECT COUNT(*) FROM companies WHERE name != 'Test Company') as companies,
  (SELECT COUNT(*) FROM inventory) as inventory;
```

### Application Startup

```bash
npm run dev
# Verify app loads at http://localhost:5173
# Check browser console for errors
```

---

## State Machine Reference

### Storage Request State Machine

```
NULL → PENDING → APPROVED → COMPLETE → ARCHIVED
              ↓
           REJECTED
```

**Valid Transitions**:
- `NULL → PENDING`: Customer submits storage request (StorageRequestWizard.tsx)
- `PENDING → APPROVED`: Admin approves request (AdminDashboard.tsx)
- `PENDING → REJECTED`: Admin rejects request
- `APPROVED → COMPLETE`: All loads delivered, inventory in storage
- `COMPLETE → ARCHIVED`: Admin archives completed project
- **INVALID**: Skipping states, reversing states (except unarchive)

### Trucking Load State Machine

```
NEW → APPROVED → IN_TRANSIT → COMPLETED
  ↓
CANCELLED
```

**Valid Transitions**:
- `NEW → APPROVED`: Admin approves load after manifest review
- `APPROVED → IN_TRANSIT`: Load marked as in transit
- `IN_TRANSIT → COMPLETED`: Load arrives and is processed
- `NEW → CANCELLED`: Admin cancels unapproved load
- `APPROVED → CANCELLED`: Approved load cancelled before transit

**Sequential Load Blocking**: Customers cannot book Load #2 until Load #1 is APPROVED

### Inventory State Machine

```
PENDING_DELIVERY → IN_STORAGE → PENDING_PICKUP → IN_TRANSIT → DELIVERED
```

**Valid Transitions**:
- `PENDING_DELIVERY → IN_STORAGE`: Inbound load completed, inventory created
- `IN_STORAGE → PENDING_PICKUP`: Outbound pickup scheduled
- `PENDING_PICKUP → IN_TRANSIT`: Outbound load departed
- `IN_TRANSIT → DELIVERED`: Outbound load completed

---

## Test Data Specifications

### Company 1: Atlas Energy (Customer)

```json
{
  "companyName": "Atlas Energy Ltd",
  "email": "john.smith@atlasenergytest.com",
  "password": "TestPass123!",
  "firstName": "John",
  "lastName": "Smith",
  "contactNumber": "(403) 555-1001"
}
```

**Storage Request Details**:
```json
{
  "referenceId": "ATLAS-AFE-2024-001",
  "itemType": "Blank Pipe",
  "casingSpec": {
    "size_in": 5.5,
    "weight_lbs_ft": 23.0
  },
  "grade": "L80",
  "connection": "BTC",
  "avgJointLength": 12.0,
  "totalJoints": 150,
  "storageStartDate": "2025-01-15",
  "storageEndDate": "2025-06-30"
}
```

**Inbound Load Details**:
```json
{
  "storageCompanyName": "Alberta Pipe Storage Inc",
  "storageYardAddress": "1234 Industry Rd NE, Calgary, AB T2E 8S5",
  "storageContactName": "Mike Johnson",
  "storageContactPhone": "(403) 555-2001",
  "storageContactEmail": "mike@albertapipe.com",
  "truckingCompanyName": "Fast Freight Trucking",
  "driverName": "Dave Williams",
  "driverPhone": "(403) 555-3001"
}
```

### Company 2: Northern Drilling (Customer)

```json
{
  "companyName": "Northern Drilling Corp",
  "email": "sarah.chen@northerndrillingtest.com",
  "password": "TestPass456!",
  "firstName": "Sarah",
  "lastName": "Chen",
  "contactNumber": "(780) 555-1002"
}
```

**Storage Request Details**:
```json
{
  "referenceId": "NORTH-WELL-04-2025",
  "itemType": "Sand Control",
  "sandControlScreenType": "DWW",
  "casingSpec": {
    "size_in": 7.0,
    "weight_lbs_ft": 29.7
  },
  "grade": "P110",
  "connection": "Premium",
  "avgJointLength": 12.5,
  "totalJoints": 80,
  "storageStartDate": "2025-02-01",
  "storageEndDate": "2025-07-31"
}
```

### Admin User

```json
{
  "email": "admin@mpspipestorage.com",
  "password": "AdminPass789!"
}
```

**Note**: Admin accounts are created via the admin login interface (click PipeVault logo to toggle to admin login)

---

## Customer Journey Tests

### Test Suite 1: Sign-Up & Authentication

**Files**: `C:\Users\kyle\MPS\PipeVault\components\Auth.tsx`

#### Test 1.1: Customer Sign-Up (Atlas Energy)

**Steps**:
1. Navigate to http://localhost:5173
2. Click "Create Account" tab
3. Fill in Atlas Energy details:
   - Email: `john.smith@atlasenergytest.com`
   - Password: `TestPass123!`
   - Confirm Password: `TestPass123!`
   - Company Name: `Atlas Energy Ltd`
   - First Name: `John`
   - Last Name: `Smith`
   - Contact Number: `(403) 555-1001`
4. Click "Create Account"

**Expected Outcomes**:
- [ ] Account created successfully
- [ ] User automatically signed in
- [ ] Redirected to Dashboard
- [ ] Welcome message shows: "Welcome, John Smith from Atlas Energy Ltd!"
- [ ] Database verification:
  ```sql
  SELECT * FROM companies WHERE name = 'Atlas Energy Ltd';
  -- Should return 1 row with company_id

  SELECT * FROM auth.users WHERE email = 'john.smith@atlasenergytest.com';
  -- Should return 1 row with user metadata
  ```
- [ ] Slack notification sent: "New user signup: john.smith@atlasenergytest.com (Atlas Energy Ltd)"

**UI State to Verify**:
- Empty dashboard with tiles:
  - "New Storage Request" (enabled)
  - "Schedule Delivery to MPS" (disabled - no approved requests)
  - "Request Pickup to Worksite" (disabled - no inventory)

#### Test 1.2: Customer Sign-Up (Northern Drilling)

Repeat Test 1.1 with Northern Drilling credentials.

**Expected Outcomes**: Same as Test 1.1

#### Test 1.3: Admin Account Creation

**Steps**:
1. Navigate to http://localhost:5173
2. Click PipeVault logo to switch to Admin login
3. Enter admin email: `admin@mpspipestorage.com`
4. Enter password: `AdminPass789!`
5. Click "Create Admin Account"
6. Sign in with credentials

**Expected Outcomes**:
- [ ] Admin account created
- [ ] Redirected to AdminDashboard
- [ ] See CompanyTileCarousel (should be empty - no requests yet)

---

### Test Suite 2: Storage Request Submission

**Files**:
- `C:\Users\kyle\MPS\PipeVault\components\StorageRequestWizard.tsx`
- `C:\Users\kyle\MPS\PipeVault\components\Dashboard.tsx`

#### Test 2.1: Create Storage Request (Atlas Energy)

**Pre-condition**: Signed in as `john.smith@atlasenergytest.com`

**Steps**:
1. Click "New Storage Request" tile
2. Verify contact info pre-populated:
   - Company: Atlas Energy Ltd
   - Name: John Smith
   - Email: john.smith@atlasenergytest.com
   - Phone: (403) 555-1001
3. Fill in pipe details:
   - Item Type: Blank Pipe
   - OD: Select "139.70 (5.5)"
   - Weight: Select "34.2 (23.0)"
   - Grade: L80
   - Connection: BTC
   - Average length of joint: 12.00
   - Total number of joints: 150
4. Fill in timeline:
   - Requested Start Date: 2025-01-15
   - Requested End Date: 2025-06-30
   - Project Reference Number: ATLAS-AFE-2024-001
5. Click "Submit Request"

**Expected Outcomes**:
- [ ] AI summary generated via Gemini API
- [ ] Request status = PENDING
- [ ] Success toast shown: "Request ATLAS-AFE-2024-001 submitted successfully!"
- [ ] Redirect to "submitted" confirmation screen
- [ ] Reference ID displayed prominently
- [ ] Database verification:
  ```sql
  SELECT * FROM storage_requests WHERE reference_id = 'ATLAS-AFE-2024-001';
  -- status should be 'PENDING'
  -- approval_summary should contain AI-generated text
  ```
- [ ] Slack notification sent: "New storage request: ATLAS-AFE-2024-001 from Atlas Energy Ltd"
- [ ] Click "Back to Dashboard" → see request in StorageRequestMenu

**UI State After Submission**:
- [ ] StorageRequestMenu shows ATLAS-AFE-2024-001 with status badge: PENDING (yellow)
- [ ] "Schedule Delivery to MPS" tile still disabled (not yet approved)

#### Test 2.2: Create Storage Request (Northern Drilling)

**Pre-condition**: Sign out, sign in as `sarah.chen@northerndrillingtest.com`

Repeat Test 2.1 with Northern Drilling data:
- Reference ID: NORTH-WELL-04-2025
- Sand Control screen type: DWW
- OD: 7.0 inches
- Weight: 29.7 lbs/ft
- Grade: P110
- Connection: Premium

**Expected Outcomes**: Same as Test 2.1

**RLS Verification**:
- [ ] Verify Atlas Energy request NOT visible to Northern Drilling
- [ ] Only NORTH-WELL-04-2025 appears in StorageRequestMenu

---

### Test Suite 3: Admin Approval Workflow

**Files**: `C:\Users\kyle\MPS\PipeVault\components\admin\AdminDashboard.tsx`

#### Test 3.1: Admin Reviews Requests

**Pre-condition**: Sign out, sign in as admin

**Steps**:
1. AdminDashboard loads
2. Verify CompanyTileCarousel shows 2 tiles:
   - Atlas Energy Ltd (1 pending request)
   - Northern Drilling Corp (1 pending request)
3. Click Atlas Energy tile to expand CompanyTile
4. Verify request details:
   - Reference ID: ATLAS-AFE-2024-001
   - Status: PENDING
   - AI Summary displayed
   - Requester: john.smith@atlasenergytest.com

**Expected Outcomes**:
- [ ] Both company tiles visible
- [ ] Each tile shows pending request count
- [ ] Request details accurate
- [ ] Approval buttons enabled

#### Test 3.2: Approve Atlas Energy Request

**Steps**:
1. In Atlas Energy CompanyTile, click "Approve Request"
2. Assign rack location: "A-N-1" (Rack 1, North, Yard A)
3. Click "Confirm Approval"

**Expected Outcomes**:
- [ ] Request status updated to APPROVED
- [ ] Status badge turns green
- [ ] Rack assignment stored: `assigned_rack_ids = ['A-N-1']`
- [ ] `approved_at` timestamp set
- [ ] `approved_by` = admin email
- [ ] Database verification:
  ```sql
  SELECT status, assigned_rack_ids, approved_at, approved_by
  FROM storage_requests
  WHERE reference_id = 'ATLAS-AFE-2024-001';
  -- status = 'APPROVED'
  -- assigned_rack_ids = ['A-N-1']
  ```
- [ ] Slack notification: "Request ATLAS-AFE-2024-001 approved, assigned to Rack A-N-1"
- [ ] Email notification to john.smith@atlasenergytest.com: "Your storage request has been approved"

#### Test 3.3: Approve Northern Drilling Request

Repeat Test 3.2 for Northern Drilling:
- Assign rack: "A-N-2"

---

### Test Suite 4: Inbound Delivery Scheduling

**Files**:
- `C:\Users\kyle\MPS\PipeVault\components\InboundShipmentWizard.tsx`
- `C:\Users\kyle\MPS\PipeVault\components\TimeSlotPicker.tsx`
- `C:\Users\kyle\MPS\PipeVault\components\StorageYardStep.tsx`
- `C:\Users\kyle\MPS\PipeVault\components\TruckingMethodStep.tsx`
- `C:\Users\kyle\MPS\PipeVault\components\TruckingDriverStep.tsx`

#### Test 4.1: Schedule Inbound Delivery (Atlas Energy - Load #1)

**Pre-condition**: Sign out, sign in as `john.smith@atlasenergytest.com`

**Steps**:

**Step 1: Storage Yard Information**
1. Click "Schedule Delivery to MPS" tile (now enabled post-approval)
2. Verify InboundShipmentWizard opens
3. Verify step indicator shows: Step 1 of 7 (Storage Yard)
4. Fill in storage yard details:
   - Storage Company Name: Alberta Pipe Storage Inc
   - Storage Yard Address: 1234 Industry Rd NE, Calgary, AB T2E 8S5
   - Contact Name: Mike Johnson
   - Contact Phone: (403) 555-2001
   - Contact Email: mike@albertapipe.com
5. Click "Continue to Transportation"

**Step 2: Transportation Method**
6. Verify step indicator: Step 2 of 7 (Transportation)
7. Select "Will Provide Trucking" (CUSTOMER_PROVIDED)
8. System auto-advances to Step 3

**Step 3: Trucking & Driver**
9. Verify step indicator: Step 3 of 7 (Trucking & Driver)
10. Fill in trucking details:
    - Trucking Company Name: Fast Freight Trucking
    - Driver Name: Dave Williams
    - Driver Phone: (403) 555-3001
11. Click "Continue to Time Slot"

**Step 4: Time Slot Selection**
12. Verify step indicator: Step 4 of 7 (Time Slot)
13. Select delivery slot: Tomorrow at 10:00 AM - 12:00 PM (regular hours)
14. Click "Continue to Documents"

**Step 5: Document Upload**
15. Verify step indicator: Step 5 of 7 (Documents)
16. Upload test manifest PDF (use sample manifest from `docs/testing/sample_manifest_atlas_load1.pdf`)
17. Verify AI processing starts:
    - "AI Processing..." indicator shown
    - After ~5-10 seconds, manifest data extracted
18. Verify LoadSummaryReview displays:
    - Total Joints: 150
    - Total Length: ~1800 ft
    - Total Weight: calculated based on 23.0 lbs/ft
19. Click "Continue to Review"

**Step 6: Review**
20. Verify step indicator: Step 6 of 7 (Review)
21. Verify summary shows:
    - Storage Yard: Alberta Pipe Storage Inc
    - Trucking: Fast Freight Trucking
    - Driver: Dave Williams
    - Time Slot: Tomorrow 10:00 AM - 12:00 PM
    - Load Summary with extracted totals
22. Click "Looks Good - Book Load"

**Step 7: Confirmation**
23. Verify step indicator: Step 7 of 7 (Confirmed)
24. Verify confirmation screen shows:
    - "Delivery Scheduled!" with green checkmark
    - Delivery date and time
    - Next steps info box
25. Click "Return to Dashboard"

**Expected Outcomes**:

**Database State**:
```sql
-- Trucking load created
SELECT * FROM trucking_loads
WHERE storage_request_id = (SELECT id FROM storage_requests WHERE reference_id = 'ATLAS-AFE-2024-001')
AND direction = 'INBOUND'
AND sequence_number = 1;

-- Expected fields:
-- status = 'NEW' (requires admin approval)
-- scheduled_slot_start = tomorrow 10:00 AM
-- scheduled_slot_end = tomorrow 12:00 PM
-- pickup_location = {company: "Alberta Pipe Storage Inc", address: "..."}
-- delivery_location = {facility: "MPS Pipe Storage", address: "..."}
-- trucking_company = "Fast Freight Trucking"
-- driver_name = "Dave Williams"
-- driver_phone = "(403) 555-3001"
-- total_joints_planned = 150
-- total_length_ft_planned = ~1800
-- total_weight_lbs_planned = calculated

-- Trucking document created
SELECT * FROM trucking_documents
WHERE trucking_load_id = (SELECT id FROM trucking_loads WHERE sequence_number = 1);

-- Expected:
-- file_name = uploaded manifest name
-- storage_path = Supabase storage path
-- document_type = 'manifest'
-- parsed_payload = JSON array of ManifestItem[]

-- Shipment/appointment records created
SELECT * FROM shipments WHERE request_id = (SELECT id FROM storage_requests WHERE reference_id = 'ATLAS-AFE-2024-001');
SELECT * FROM dock_appointments WHERE shipment_id = ...;
```

**Notifications**:
- [ ] Slack notification: "Inbound delivery scheduled: Atlas Energy Ltd, Load #1, Tomorrow 10:00 AM"
- [ ] Email to john.smith@atlasenergytest.com: "Load booking confirmation"
- [ ] Email contains calendar invite (.ics attachment)

**UI State**:
- [ ] Dashboard shows load in "In Transit" section with status badge: NEW (gray)
- [ ] "Schedule Delivery to MPS" tile remains enabled (can book Load #2 after Load #1 approved)

#### Test 4.2: Verify Sequential Load Blocking

**Pre-condition**: Still signed in as Atlas Energy customer

**Steps**:
1. Click "Schedule Delivery to MPS" tile again
2. Proceed through wizard to Time Slot step
3. **Expected**: Blocking UI appears

**Expected Blocking UI**:
- [ ] Orange warning box with exclamation icon
- [ ] Message: "Load #1 Pending Admin Approval"
- [ ] Sub-message: "Your previous load is awaiting admin review. You can schedule Load #2 after Load #1 has been approved."
- [ ] Pending load details card shows:
  - Load Number: #1
  - Scheduled Date: Tomorrow
  - Status: Pending Review (yellow badge)
- [ ] "What happens next?" info box
- [ ] Only "Return to Dashboard" button enabled (no time slot picker shown)

**Database Verification**:
```sql
-- Verify load exists with NEW status
SELECT sequence_number, status
FROM trucking_loads
WHERE storage_request_id = (SELECT id FROM storage_requests WHERE reference_id = 'ATLAS-AFE-2024-001')
AND direction = 'INBOUND';

-- Should return sequence_number = 1, status = 'NEW'
```

#### Test 4.3: Schedule Northern Drilling Load #1

**Pre-condition**: Sign out, sign in as `sarah.chen@northerndrillingtest.com`

Repeat Test 4.1 with Northern Drilling data:
- Storage Company: Northland Yards Ltd
- Address: 5678 Pipeline Ave, Edmonton, AB T6X 1A1
- Trucking Company: Northern Transport
- Driver: James Patterson, (780) 555-4001
- Joints: 80
- Time slot: Tomorrow 2:00 PM - 4:00 PM

**Expected Outcomes**: Same as Test 4.1

**RLS Verification**:
- [ ] Verify Northern Drilling CANNOT see Atlas Energy loads
- [ ] Only NORTH-WELL-04-2025 loads visible

---

### Test Suite 5: Admin Load Approval & Manifest Review

**Files**:
- `C:\Users\kyle\MPS\PipeVault\components\admin\AdminDashboard.tsx`
- `C:\Users\kyle\MPS\PipeVault\components\admin\tiles\PendingLoadsTile.tsx`
- `C:\Users\kyle\MPS\PipeVault\components\admin\LoadDetailModal.tsx`

#### Test 5.1: Admin Reviews Pending Loads

**Pre-condition**: Sign out, sign in as admin

**Steps**:
1. AdminDashboard loads
2. Verify CompanyTileCarousel shows updated tiles:
   - Atlas Energy Ltd: 1 pending load
   - Northern Drilling Corp: 1 pending load
3. Click Atlas Energy tile
4. Verify "Pending Loads" section shows:
   - Load #1: Inbound - NEW status
   - Scheduled: Tomorrow 10:00 AM - 12:00 PM
   - 150 joints planned
5. Click Load #1 to open LoadDetailModal

**Expected Outcomes**:
- [ ] LoadDetailModal opens
- [ ] Load details displayed:
  - Direction: INBOUND
  - Sequence: #1
  - Status: NEW (gray badge)
  - Pickup: Alberta Pipe Storage Inc, Calgary
  - Delivery: MPS Pipe Storage
  - Trucking: Fast Freight Trucking
  - Driver: Dave Williams (403) 555-3001
  - Scheduled Slot: Tomorrow 10:00 AM - 12:00 PM
  - Total Joints Planned: 150
  - Total Length Planned: ~1800 ft
  - Documents: 1 manifest uploaded

#### Test 5.2: Review AI-Extracted Manifest Data

**Steps**:
1. In LoadDetailModal, scroll to "Documents" section
2. Click "View" on the manifest document
3. Verify manifest opens in new tab (signed URL from Supabase Storage)
4. Return to LoadDetailModal
5. Scroll to "Extracted Manifest Data" section
6. Verify ManifestDataDisplay shows:
   - Table with columns: Manufacturer, Heat #, Serial #, Length (ft), Qty, Grade, OD (in), Weight (lbs/ft)
   - 150 rows (one per joint)
   - Data looks reasonable (no null manufacturers, valid heat numbers)
7. Check for validation errors/warnings
   - If errors exist: Fix manually or request correction
   - If warnings exist: Review and decide if acceptable

**Expected Outcomes**:
- [ ] Manifest PDF viewable
- [ ] Extracted data displayed in table
- [ ] No critical errors (missing manufacturer, invalid heat numbers)
- [ ] Totals match planned: 150 joints

#### Test 5.3: Approve Atlas Energy Load #1

**Steps**:
1. In LoadDetailModal, click "Approve Load"
2. Verify confirmation dialog
3. Click "Confirm Approval"

**Expected Outcomes**:
- [ ] Load status updated to APPROVED
- [ ] Status badge turns green
- [ ] `approved_at` timestamp set
- [ ] `approved_by` = admin email
- [ ] Database verification:
  ```sql
  SELECT status, approved_at, approved_by
  FROM trucking_loads
  WHERE sequence_number = 1
  AND storage_request_id = (SELECT id FROM storage_requests WHERE reference_id = 'ATLAS-AFE-2024-001');

  -- status = 'APPROVED'
  -- approved_at = current timestamp
  -- approved_by = admin email
  ```
- [ ] Slack notification: "Load #1 approved for Atlas Energy Ltd"
- [ ] Email to john.smith@atlasenergytest.com: "Load #1 has been approved and is ready for delivery"

#### Test 5.4: Approve Northern Drilling Load #1

Repeat Test 5.3 for Northern Drilling load

---

### Test Suite 6: Customer Books Load #2 (Sequential)

**Files**: `C:\Users\kyle\MPS\PipeVault\components\InboundShipmentWizard.tsx`

#### Test 6.1: Verify Load #2 Booking Now Enabled

**Pre-condition**: Sign out, sign in as `john.smith@atlasenergytest.com`

**Steps**:
1. Click "Schedule Delivery to MPS"
2. Proceed through wizard to Time Slot step
3. **Expected**: Time slot picker now visible (Load #1 approved, blocking removed)

**Expected Outcomes**:
- [ ] No blocking UI shown
- [ ] TimeSlotPicker displays available slots
- [ ] Can select slot and proceed

#### Test 6.2: Book Atlas Energy Load #2

**Steps**:
1. Follow same steps as Test 4.1
2. Use different manifest file (sample_manifest_atlas_load2.pdf)
3. Different trucking company: "Reliable Hauling Co"
4. Different driver: "Tom Anderson" (403) 555-5001
5. Different time slot: Day after tomorrow, 1:00 PM - 3:00 PM
6. Upload manifest, verify AI extraction
7. Complete booking

**Expected Outcomes**:
- [ ] Load #2 created with sequence_number = 2
- [ ] Status = NEW (requires approval again)
- [ ] Both Load #1 and Load #2 visible in dashboard
- [ ] Database verification:
  ```sql
  SELECT sequence_number, status FROM trucking_loads
  WHERE storage_request_id = (SELECT id FROM storage_requests WHERE reference_id = 'ATLAS-AFE-2024-001')
  AND direction = 'INBOUND'
  ORDER BY sequence_number;

  -- Should return 2 rows:
  -- sequence 1, status APPROVED
  -- sequence 2, status NEW
  ```

---

### Test Suite 7: Inbound Load Completion & Inventory Creation

**Files**:
- `C:\Users\kyle\MPS\PipeVault\components\admin\CompletionFormModal.tsx`
- `C:\Users\kyle\MPS\PipeVault\components\admin\TruckReceiving.tsx`

#### Test 7.1: Mark Atlas Energy Load #1 as IN_TRANSIT

**Pre-condition**: Sign in as admin

**Steps**:
1. In Atlas Energy CompanyTile, find Load #1 (status: APPROVED)
2. Click "Mark In Transit" button
3. Confirm action

**Expected Outcomes**:
- [ ] Load status updated to IN_TRANSIT
- [ ] Status badge turns blue
- [ ] `in_transit_at` timestamp set
- [ ] Slack notification: "Load #1 from Atlas Energy in transit to MPS"

#### Test 7.2: Complete Atlas Energy Load #1 Arrival

**Steps**:
1. Find Load #1 (status: IN_TRANSIT) in "In Transit" tile
2. Click "Complete Arrival" button
3. CompletionFormModal opens
4. Fill in arrival details:
   - Actual Joints Received: 150 (matches planned)
   - Actual Length: 1800 ft (matches planned)
   - Actual Weight: calculated
   - Notes: "All joints in good condition, no damage"
5. Click "Complete Load"

**Expected Outcomes**:

**Load Status Update**:
- [ ] Load status updated to COMPLETED
- [ ] Status badge turns gray
- [ ] `completed_at` timestamp set
- [ ] `total_joints_completed` = 150
- [ ] `total_length_ft_completed` = 1800
- [ ] `total_weight_lbs_completed` = calculated

**Inventory Creation**:
- [ ] 150 inventory records created (one per joint from manifest)
- [ ] Database verification:
  ```sql
  SELECT COUNT(*) FROM inventory
  WHERE company_id = (SELECT id FROM companies WHERE name = 'Atlas Energy Ltd')
  AND storage_request_id = (SELECT id FROM storage_requests WHERE reference_id = 'ATLAS-AFE-2024-001')
  AND delivery_truck_load_id = (SELECT id FROM trucking_loads WHERE sequence_number = 1);

  -- Should return 150

  -- Verify each inventory record has:
  SELECT
    status,
    storage_area_id,
    drop_off_timestamp,
    manifest_item_id
  FROM inventory
  WHERE company_id = (SELECT id FROM companies WHERE name = 'Atlas Energy Ltd')
  LIMIT 5;

  -- status = 'IN_STORAGE'
  -- storage_area_id = 'A-N-1' (from request approval)
  -- drop_off_timestamp = current timestamp
  -- manifest_item_id = link to parsed manifest data
  ```

**Rack Capacity Update**:
- [ ] Rack A-N-1 capacity updated:
  ```sql
  SELECT occupied, occupied_meters FROM racks WHERE id = 'A-N-1';
  -- occupied should increase by 150 joints
  -- occupied_meters should increase by ~549m (1800ft)
  ```

**Notifications**:
- [ ] Slack notification: "Load #1 completed for Atlas Energy Ltd - 150 joints now in storage at Rack A-N-1"
- [ ] Email to john.smith@atlasenergytest.com: "Your load has arrived and is now in storage"

#### Test 7.3: Complete Northern Drilling Load #1

Repeat Tests 7.1-7.2 for Northern Drilling load

---

### Test Suite 8: Outbound Pickup Scheduling

**Files**:
- `C:\Users\kyle\MPS\PipeVault\components\OutboundShipmentWizard.tsx`
- `C:\Users\kyle\MPS\PipeVault\components\TimeSlotPicker.tsx`

#### Test 8.1: Schedule Outbound Pickup (Atlas Energy)

**Pre-condition**: Sign in as `john.smith@atlasenergytest.com`

**Steps**:

**Step 1: Destination**
1. Click "Request Pickup to Worksite" tile (now enabled - inventory exists)
2. Verify OutboundShipmentWizard opens
3. Fill in destination:
   - LSD: 01-02-003-04W5M
   - Well Name: ATLAS HORIZONTAL 01
   - UWI: 100/01-02-003-04W5/0
   - Contact Name: Brad Cooper (site supervisor)
   - Contact Phone: (403) 555-6001
   - Special Instructions: "Call 30 min before arrival, gated entry"
4. Click "Next: Shipping Method"

**Step 2: Shipping Method**
5. Select "Customer Arranged"
6. Fill in trucking:
   - Trucking Company: Fast Freight Trucking
   - Driver: Dave Williams
   - Driver Phone: (403) 555-3001
7. Click "Next: Select Time Slot"

**Step 3: Time Slot**
8. Select pickup slot: 3 days from now, 9:00 AM - 11:00 AM
9. Verify time slot selected and "Review" step loads

**Step 4: Review**
10. Verify summary:
    - Destination: LSD 01-02-003-04W5M, ATLAS HORIZONTAL 01
    - Shipping: Customer Arranged (Fast Freight)
    - Pickup Time: 3 days from now, 9:00 AM - 11:00 AM
11. Click "Confirm & Submit"

**Step 5: Confirmation**
12. Verify confirmation screen
13. Click "Return to Dashboard"

**Expected Outcomes**:

**Database State**:
```sql
-- Outbound trucking load created
SELECT * FROM trucking_loads
WHERE storage_request_id = (SELECT id FROM storage_requests WHERE reference_id = 'ATLAS-AFE-2024-001')
AND direction = 'OUTBOUND'
AND sequence_number = 1;

-- Expected fields:
-- status = 'APPROVED' (outbound loads auto-approve)
-- scheduled_slot_start = 3 days from now, 9:00 AM
-- destination_lsd = '01-02-003-04W5M'
-- destination_well_name = 'ATLAS HORIZONTAL 01'
-- destination_uwi = '100/01-02-003-04W5/0'
-- shipping_method = 'CUSTOMER_ARRANGED'
-- trucking_company = 'Fast Freight Trucking'
-- driver_name = 'Dave Williams'
```

**Notifications**:
- [ ] Slack notification: "Outbound pickup scheduled: Atlas Energy Ltd to LSD 01-02-003-04W5M, 3 days from now"

---

### Test Suite 9: Outbound Load Completion & Inventory Update

**Files**: `C:\Users\kyle\MPS\PipeVault\components\admin\MarkPickedUpModal.tsx`

#### Test 9.1: Mark Outbound Load #1 as Picked Up

**Pre-condition**: Sign in as admin

**Steps**:
1. In Atlas Energy CompanyTile, find Outbound Load #1 in "Outbound Loads" tile
2. Click "Mark Picked Up"
3. MarkPickedUpModal opens
4. Select inventory to pick up:
   - Select all 150 joints (or subset if partial load)
5. Fill in pickup details:
   - Joints Picked Up: 150
   - Actual Pickup Time: (auto-populated to current time)
6. Click "Confirm Pickup"

**Expected Outcomes**:

**Load Status Update**:
- [ ] Load status updated to COMPLETED
- [ ] `completed_at` timestamp set
- [ ] `total_joints_completed` = 150

**Inventory Status Update**:
- [ ] 150 inventory records updated:
  ```sql
  SELECT status, pickup_truck_load_id, pick_up_timestamp
  FROM inventory
  WHERE company_id = (SELECT id FROM companies WHERE name = 'Atlas Energy Ltd')
  LIMIT 5;

  -- status = 'DELIVERED'
  -- pickup_truck_load_id = outbound load id
  -- pick_up_timestamp = current timestamp
  ```

**Rack Capacity Update**:
- [ ] Rack A-N-1 capacity freed:
  ```sql
  SELECT occupied, occupied_meters FROM racks WHERE id = 'A-N-1';
  -- occupied should decrease by 150 joints
  -- occupied_meters should decrease by ~549m
  ```

**Notifications**:
- [ ] Slack notification: "Outbound Load #1 picked up for Atlas Energy Ltd - 150 joints delivered to LSD 01-02-003-04W5M"
- [ ] Email to john.smith@atlasenergytest.com: "Your pipe has been picked up and is on the way to your well site"

---

### Test Suite 10: Project Completion & Archival

**Files**: `C:\Users\kyle\MPS\PipeVault\components\admin\AdminDashboard.tsx`

#### Test 10.1: Mark Project as Complete

**Pre-condition**: All loads completed, all inventory delivered

**Steps**:
1. Sign in as admin
2. In Atlas Energy CompanyTile, click "Mark Project Complete"
3. Verify confirmation dialog shows:
   - All inbound loads: COMPLETED
   - All outbound loads: COMPLETED
   - All inventory: DELIVERED
4. Click "Confirm Completion"

**Expected Outcomes**:
- [ ] Storage request status updated to COMPLETE
- [ ] `completed_at` timestamp set
- [ ] Database verification:
  ```sql
  SELECT status, completed_at FROM storage_requests WHERE reference_id = 'ATLAS-AFE-2024-001';
  -- status = 'COMPLETE'
  ```
- [ ] Slack notification: "Project ATLAS-AFE-2024-001 marked complete"
- [ ] Email to john.smith@atlasenergytest.com: "Your storage project is complete. Invoice will follow."

#### Test 10.2: Archive Completed Project

**Steps**:
1. In Atlas Energy CompanyTile, click "Archive Project"
2. Confirm action

**Expected Outcomes**:
- [ ] Request archived:
  ```sql
  SELECT archived, archived_at, archived_by FROM storage_requests WHERE reference_id = 'ATLAS-AFE-2024-001';
  -- archived = true
  -- archived_at = current timestamp
  -- archived_by = admin email
  ```
- [ ] CompanyTile no longer shows in carousel (archived projects hidden by default)
- [ ] Customer can still view archived project in dashboard (read-only)

---

## Admin Workflow Tests

### Test Suite 11: Admin Load Management

#### Test 11.1: Reject Load

**Steps**:
1. Sign in as admin
2. Approve Atlas Energy Load #2 first (from Test 6.2)
3. In Northern Drilling CompanyTile, find Load #2 (if booked)
4. Click "Reject Load" button
5. Fill in rejection reason: "Manifest data incomplete - missing heat numbers"
6. Click "Confirm Rejection"

**Expected Outcomes**:
- [ ] Load status updated to CANCELLED
- [ ] Rejection reason stored
- [ ] Email to customer with rejection reason
- [ ] Customer can re-book load after fixing issues

#### Test 11.2: Request Manifest Correction

**Steps**:
1. In LoadDetailModal, review manifest data
2. Find row with issue (e.g., missing manufacturer)
3. Click "Report Issue" button
4. Fill in issue description: "Row 45: Manufacturer missing, heat number unclear"
5. Click "Submit Issue Report"

**Expected Outcomes**:
- [ ] Slack notification sent to admin: "Manifest issue reported by john.smith@atlasenergytest.com for Load #1"
- [ ] Issue description included
- [ ] Admin can manually correct data or request customer re-upload

---

## Integration Point Tests

### Test Suite 12: AI Document Processing

**Files**:
- `C:\Users\kyle\MPS\PipeVault\services\manifestProcessingService.ts`
- `C:\Users\kyle\MPS\PipeVault\components\DocumentUploadStep.tsx`

#### Test 12.1: AI Manifest Extraction Success

**Pre-condition**: Valid manifest PDF with clear data

**Steps**:
1. In InboundShipmentWizard, upload clear manifest PDF
2. Monitor AI processing (15-30 seconds)

**Expected Outcomes**:
- [ ] Gemini Vision API call succeeds
- [ ] Extracted data contains:
  - All joints (quantity matches visual inspection)
  - Valid manufacturers (Tenaris, VAM, US Steel, etc.)
  - Heat numbers (alphanumeric, 5-10 chars)
  - Tally lengths (20-50 ft range)
  - Grades (L80, P110, etc.)
  - OD and weight values
- [ ] Load summary calculated:
  - Total joints
  - Total length (ft and m)
  - Total weight (lbs and kg)
- [ ] Validation passes (no critical errors)

#### Test 12.2: AI Extraction Error Handling

**Test Case A: Invalid File Type**

**Steps**:
1. Upload .txt file instead of PDF/image

**Expected Outcomes**:
- [ ] Error message: "Only PDF, JPG, PNG, and WebP files are supported"
- [ ] Upload rejected
- [ ] No API call made

**Test Case B: Unreadable Document**

**Steps**:
1. Upload heavily redacted/blurry image

**Expected Outcomes**:
- [ ] Gemini returns empty array or partial data
- [ ] Validation error: "No pipe data found in document"
- [ ] User prompted to retry or skip

**Test Case C: API Rate Limit**

**Steps**:
1. Upload multiple manifests rapidly (simulate rate limit)

**Expected Outcomes**:
- [ ] Error message: "AI service rate limit reached. Please try again in a few minutes."
- [ ] Graceful fallback: user can skip and proceed without AI extraction
- [ ] Manual entry option available

#### Test 12.3: Manifest Data Validation

**Steps**:
1. Upload manifest with intentional errors:
   - Duplicate serial numbers
   - Missing heat numbers
   - Impossible tally lengths (e.g., 100 ft)
2. Verify AI validation catches issues

**Expected Outcomes**:
- [ ] Validation errors displayed:
  - "Duplicate serial number: ABC-005 (also appears at index 12)"
  - "Missing heat number at row 23"
  - "Impossible tally length: 100 ft (expected 20-50 ft)"
- [ ] User can choose:
  - Fix and re-upload
  - Report issue to admin
  - Proceed with warnings (admin will review)

---

### Test Suite 13: Email Notifications

**Files**:
- `C:\Users\kyle\MPS\PipeVault\supabase\functions\process-notification-queue\index.ts`
- Email templates in Resend

#### Test 13.1: New User Signup Email

**Verification**:
- [ ] Recipient: Customer email
- [ ] Subject: "Welcome to PipeVault"
- [ ] Body includes:
  - Customer name
  - Company name
  - Link to dashboard
  - Contact support info

#### Test 13.2: Storage Request Approval Email

**Verification**:
- [ ] Recipient: Customer email
- [ ] Subject: "Your storage request has been approved - ATLAS-AFE-2024-001"
- [ ] Body includes:
  - Reference ID
  - Assigned rack location
  - Next steps (schedule delivery)
  - Link to dashboard

#### Test 13.3: Load Booking Confirmation Email

**Verification**:
- [ ] Recipient: Customer email
- [ ] Subject: "Delivery confirmed: Load #1 for ATLAS-AFE-2024-001"
- [ ] Body includes:
  - Load number
  - Delivery date and time
  - Storage yard pickup location
  - Trucking company and driver
  - Calendar invite (.ics attachment)

#### Test 13.4: Load Approval Email

**Verification**:
- [ ] Recipient: Customer email
- [ ] Subject: "Load #1 approved and ready for delivery"
- [ ] Body includes:
  - Confirmation of approval
  - Delivery date reminder
  - Admin contact info

#### Test 13.5: Load Arrival Email

**Verification**:
- [ ] Recipient: Customer email
- [ ] Subject: "Your load has arrived at MPS"
- [ ] Body includes:
  - Load number
  - Joints received
  - Storage location
  - Link to inventory dashboard

---

### Test Suite 14: Slack Notifications

**Files**: `C:\Users\kyle\MPS\PipeVault\services\slackService.ts`

#### Test 14.1: New User Signup Notification

**Expected Slack Message**:
```
New User Signup
Email: john.smith@atlasenergytest.com
Company: Atlas Energy Ltd
Timestamp: 2025-11-18 10:30 AM
```

#### Test 14.2: New Storage Request Notification

**Expected Slack Message**:
```
New Storage Request Submitted
Reference ID: ATLAS-AFE-2024-001
Company: Atlas Energy Ltd
Requester: john.smith@atlasenergytest.com
Item Type: Blank Pipe
Joints: 150
Grade: L80, 5.5" OD, 23.0 lbs/ft
Storage Period: 2025-01-15 to 2025-06-30
```

#### Test 14.3: Inbound Load Scheduled Notification

**Expected Slack Message**:
```
Inbound Load Scheduled
Company: Atlas Energy Ltd
Load #: 1
Reference: ATLAS-AFE-2024-001
Pickup: Alberta Pipe Storage Inc, Calgary
Delivery Date: Tomorrow, 10:00 AM - 12:00 PM
Trucking: Fast Freight Trucking
Driver: Dave Williams (403) 555-3001
Joints: 150
```

#### Test 14.4: Load Approval Notification

**Expected Slack Message**:
```
Load Approved
Company: Atlas Energy Ltd
Load #: 1
Approved by: admin@mpspipestorage.com
Delivery: Tomorrow 10:00 AM
```

#### Test 14.5: Outbound Pickup Notification

**Expected Slack Message**:
```
Outbound Pickup Scheduled
Company: Atlas Energy Ltd
Destination: LSD 01-02-003-04W5M, ATLAS HORIZONTAL 01
Pickup Date: 3 days from now, 9:00 AM
Trucking: Fast Freight Trucking
Joints: 150
```

---

### Test Suite 15: Real-Time Updates (Supabase Subscriptions)

**Files**: `C:\Users\kyle\MPS\PipeVault\hooks\useSupabaseData.ts`

#### Test 15.1: Customer Dashboard Real-Time Updates

**Setup**:
1. Open browser tab 1: Sign in as Atlas Energy customer
2. Open browser tab 2: Sign in as admin
3. Position tabs side-by-side

**Test Steps**:
1. In admin tab (tab 2): Approve Atlas Energy Load #2
2. Observe customer dashboard (tab 1)

**Expected Outcomes**:
- [ ] Customer dashboard updates within 1-2 seconds (no page refresh needed)
- [ ] Load #2 status badge changes from gray (NEW) to green (APPROVED)
- [ ] "Schedule Delivery to MPS" tile enabled for Load #3 booking

#### Test 15.2: Admin Dashboard Real-Time Updates

**Test Steps**:
1. In customer tab (tab 1): Book new inbound load (Load #3)
2. Observe admin dashboard (tab 2)

**Expected Outcomes**:
- [ ] Admin dashboard updates within 1-2 seconds
- [ ] Atlas Energy CompanyTile shows updated pending load count
- [ ] New load appears in Pending Loads tile

---

### Test Suite 16: Row-Level Security (RLS) Policies

**Files**: Supabase RLS policies on tables

#### Test 16.1: Customer Data Isolation

**Steps**:
1. Sign in as Atlas Energy customer
2. Open browser DevTools → Network tab
3. Observe API calls to Supabase

**Expected Outcomes**:
- [ ] Only Atlas Energy data returned:
  ```sql
  -- Customer can only SELECT their company's data
  SELECT * FROM storage_requests WHERE company_id = <atlas_company_id>;
  -- Should return only ATLAS-AFE-2024-001

  -- NOT allowed:
  SELECT * FROM storage_requests WHERE company_id != <atlas_company_id>;
  -- Should return 0 rows or error
  ```

#### Test 16.2: Customer Cannot Modify Admin-Only Fields

**Steps**:
1. As customer, attempt to update request status directly (via API):
   ```sql
   UPDATE storage_requests SET status = 'APPROVED' WHERE id = <request_id>;
   ```

**Expected Outcomes**:
- [ ] Update rejected by RLS policy
- [ ] Error: "Policy violation: Only admins can approve requests"

#### Test 16.3: Admin Can Access All Companies

**Steps**:
1. Sign in as admin
2. Verify AdminDashboard shows all companies:
   - Atlas Energy Ltd
   - Northern Drilling Corp

**Expected Outcomes**:
- [ ] Admin sees all company tiles
- [ ] Admin can query all requests:
  ```sql
  SELECT * FROM storage_requests;
  -- Should return all requests (Atlas + Northern)
  ```

---

## Error Handling & Edge Cases

### Test Suite 17: Network Failures

#### Test 17.1: AI API Timeout

**Simulate**: Disable internet before uploading manifest

**Expected Outcomes**:
- [ ] Error message after timeout (15-30 seconds)
- [ ] User prompted: "AI extraction failed. You can skip and proceed without AI, or retry later."
- [ ] "Skip Documents" button functional
- [ ] Wizard allows proceeding to Review step with empty load summary

#### Test 17.2: Email Service Failure

**Simulate**: Invalid Resend API key

**Expected Outcomes**:
- [ ] Load booking succeeds (core workflow not blocked)
- [ ] Error logged in Supabase logs
- [ ] Admin notified via Slack: "Email notification failed for Load #1"
- [ ] User still receives confirmation in UI

#### Test 17.3: Slack Webhook Failure

**Simulate**: Invalid Slack webhook URL

**Expected Outcomes**:
- [ ] Core workflow unaffected (non-blocking)
- [ ] Error logged
- [ ] Admin can manually check database for new loads

---

### Test Suite 18: Validation Errors

#### Test 18.1: Duplicate Reference ID

**Steps**:
1. Submit storage request with reference ID: ATLAS-AFE-2024-001 (already exists)

**Expected Outcomes**:
- [ ] Error message: "A storage request with this reference ID already exists. Please choose another reference ID."
- [ ] Form not submitted
- [ ] User prompted to change reference ID

#### Test 18.2: Missing Required Fields

**Test Case A: Storage Request**
**Steps**:
1. Leave "Project Reference Number" blank
2. Click "Submit Request"

**Expected Outcomes**:
- [ ] Inline validation error: "Please enter a project reference ID before continuing."
- [ ] Submit button disabled until field filled

**Test Case B: Inbound Wizard**
**Steps**:
1. Skip storage yard contact name
2. Click "Continue"

**Expected Outcomes**:
- [ ] Validation error: "Contact Name is required"
- [ ] Cannot proceed to next step

#### Test 18.3: Invalid Date Range

**Steps**:
1. Set storage end date before start date

**Expected Outcomes**:
- [ ] Validation error: "End date must be after start date"

---

### Test Suite 19: Concurrent Updates

#### Test 19.1: Two Admins Approve Same Load

**Setup**:
1. Open two admin sessions (different browsers)
2. Both view same pending load

**Steps**:
1. Admin 1: Click "Approve Load"
2. Admin 2: Click "Approve Load" (before Admin 1 completes)

**Expected Outcomes**:
- [ ] First approval succeeds
- [ ] Second approval fails gracefully: "Load already approved by <admin1_email>"
- [ ] No duplicate inventory created

#### Test 19.2: Customer Books Load While Admin Rejects

**Setup**:
1. Tab 1: Customer viewing Load #1 (status: APPROVED)
2. Tab 2: Admin viewing same load

**Steps**:
1. Admin: Rejects Load #1
2. Customer: Attempts to upload documents for Load #1

**Expected Outcomes**:
- [ ] Upload fails: "Load has been rejected and cannot be modified"
- [ ] Customer dashboard refreshes to show updated status

---

## Data Integrity Checkpoints

### Checkpoint 1: After Each Load Completion

**Verify**:
- [ ] Inventory count matches `total_joints_completed`
- [ ] All inventory records have `storage_area_id` (no unassigned inventory)
- [ ] Rack capacity updated correctly (no negative capacity, no over-capacity)
- [ ] No orphaned records:
  ```sql
  -- All inventory must have valid storage_request_id
  SELECT COUNT(*) FROM inventory WHERE storage_request_id IS NULL;
  -- Should return 0

  -- All trucking_documents must have valid trucking_load_id
  SELECT COUNT(*) FROM trucking_documents WHERE trucking_load_id IS NULL;
  -- Should return 0
  ```

### Checkpoint 2: After Project Completion

**Verify**:
- [ ] All inbound loads: status = COMPLETED
- [ ] All outbound loads: status = COMPLETED
- [ ] All inventory: status = DELIVERED
- [ ] Storage request: status = COMPLETE
- [ ] No inventory remaining in storage:
  ```sql
  SELECT COUNT(*) FROM inventory
  WHERE company_id = (SELECT id FROM companies WHERE name = 'Atlas Energy Ltd')
  AND status != 'DELIVERED';
  -- Should return 0
  ```

### Checkpoint 3: Foreign Key Integrity

**Verify**:
- [ ] All `storage_requests.company_id` → valid `companies.id`
- [ ] All `trucking_loads.storage_request_id` → valid `storage_requests.id`
- [ ] All `trucking_documents.trucking_load_id` → valid `trucking_loads.id`
- [ ] All `inventory.company_id` → valid `companies.id`
- [ ] All `inventory.storage_request_id` → valid `storage_requests.id`
- [ ] All `inventory.delivery_truck_load_id` → valid `trucking_loads.id`

**SQL Verification**:
```sql
-- Check for orphaned trucking loads
SELECT * FROM trucking_loads tl
LEFT JOIN storage_requests sr ON tl.storage_request_id = sr.id
WHERE sr.id IS NULL;
-- Should return 0 rows

-- Check for orphaned inventory
SELECT * FROM inventory i
LEFT JOIN companies c ON i.company_id = c.id
WHERE c.id IS NULL;
-- Should return 0 rows
```

---

## Known Issues & Workarounds

### Issue 1: AI Extraction Intermittent Failures

**Symptom**: Gemini API returns 429 error (rate limit) or 500 (server error)

**Workaround**:
1. Click "Skip Documents" to proceed without AI
2. Upload manifest manually later via "Upload Documents" tile
3. Admin can manually enter data from manifest

**Root Cause**: Free tier Gemini API quota or temporary service interruption

**Tracking**: Monitor Gemini API status page

### Issue 2: Email Delivery Delays

**Symptom**: Emails arrive 5-10 minutes late

**Workaround**:
- Check notification queue in Supabase:
  ```sql
  SELECT * FROM notification_queue WHERE status = 'PENDING' ORDER BY created_at DESC LIMIT 10;
  ```
- If stuck, manually trigger process-notification-queue Edge Function

**Root Cause**: Supabase Edge Function cold start or Resend API delays

### Issue 3: Real-Time Updates Not Propagating

**Symptom**: Dashboard doesn't update after admin action

**Workaround**:
1. Refresh browser (F5)
2. Check Supabase Realtime connection in DevTools Network tab

**Root Cause**: Realtime subscription may have disconnected

**Fix**: Ensure Realtime enabled in Supabase dashboard for tables:
- `storage_requests`
- `trucking_loads`
- `inventory`

### Issue 4: Rack Capacity Mismatch

**Symptom**: Rack shows negative occupied count or over-capacity

**Workaround**:
- Admin can use "Manual Rack Adjustment" modal to correct capacity
- Verify via SQL:
  ```sql
  SELECT id, occupied, capacity, occupied_meters, capacity_meters FROM racks WHERE occupied < 0 OR occupied > capacity;
  ```

**Root Cause**: Race condition in concurrent load completions

**Prevention**: Use database transaction for load completion + inventory creation

---

## Testing Execution Log

Use this section to track testing progress:

### Atlas Energy Customer Journey

- [ ] Test 1.1: Sign-Up - PASS / FAIL / SKIP
- [ ] Test 2.1: Storage Request Submission - PASS / FAIL / SKIP
- [ ] Test 4.1: Inbound Load #1 Booking - PASS / FAIL / SKIP
- [ ] Test 4.2: Sequential Load Blocking - PASS / FAIL / SKIP
- [ ] Test 6.1: Inbound Load #2 Booking - PASS / FAIL / SKIP
- [ ] Test 7.2: Load #1 Completion - PASS / FAIL / SKIP
- [ ] Test 8.1: Outbound Pickup Scheduling - PASS / FAIL / SKIP
- [ ] Test 9.1: Outbound Load Completion - PASS / FAIL / SKIP
- [ ] Test 10.1: Project Completion - PASS / FAIL / SKIP
- [ ] Test 10.2: Project Archival - PASS / FAIL / SKIP

### Northern Drilling Customer Journey

- [ ] Test 1.2: Sign-Up - PASS / FAIL / SKIP
- [ ] Test 2.2: Storage Request Submission - PASS / FAIL / SKIP
- [ ] Test 4.3: Inbound Load #1 Booking - PASS / FAIL / SKIP
- [ ] Test 7.3: Load #1 Completion - PASS / FAIL / SKIP

### Admin Workflows

- [ ] Test 3.1: Review Requests - PASS / FAIL / SKIP
- [ ] Test 3.2: Approve Atlas Request - PASS / FAIL / SKIP
- [ ] Test 3.3: Approve Northern Request - PASS / FAIL / SKIP
- [ ] Test 5.1: Review Pending Loads - PASS / FAIL / SKIP
- [ ] Test 5.2: Review Manifest Data - PASS / FAIL / SKIP
- [ ] Test 5.3: Approve Atlas Load #1 - PASS / FAIL / SKIP
- [ ] Test 11.1: Reject Load - PASS / FAIL / SKIP

### Integration Points

- [ ] Test 12.1: AI Extraction Success - PASS / FAIL / SKIP
- [ ] Test 12.2: AI Error Handling - PASS / FAIL / SKIP
- [ ] Test 13.1: New User Email - PASS / FAIL / SKIP
- [ ] Test 13.3: Load Booking Email - PASS / FAIL / SKIP
- [ ] Test 14.1: Slack New User - PASS / FAIL / SKIP
- [ ] Test 14.3: Slack Load Scheduled - PASS / FAIL / SKIP
- [ ] Test 15.1: Customer Real-Time - PASS / FAIL / SKIP
- [ ] Test 16.1: RLS Data Isolation - PASS / FAIL / SKIP

### Error Handling

- [ ] Test 17.1: AI Timeout - PASS / FAIL / SKIP
- [ ] Test 18.1: Duplicate Reference ID - PASS / FAIL / SKIP
- [ ] Test 19.1: Concurrent Approval - PASS / FAIL / SKIP

### Data Integrity

- [ ] Checkpoint 1: Inventory Integrity - PASS / FAIL
- [ ] Checkpoint 2: Project Completion - PASS / FAIL
- [ ] Checkpoint 3: Foreign Keys - PASS / FAIL

---

## Appendix: Sample Manifest Files

**Location**: `C:\Users\kyle\MPS\PipeVault\docs\testing\sample-manifests\`

### sample_manifest_atlas_load1.pdf

Mock pipe manifest for Atlas Energy Load #1:
- 150 joints of 5.5" L80 BTC casing
- Manufacturer: Tenaris
- Heat numbers: H12345 through H12494
- Tally lengths: 30.5 ft - 32.8 ft (Range 2)
- Serial numbers: TNS-001 through TNS-150

### sample_manifest_atlas_load2.pdf

Mock pipe manifest for Atlas Energy Load #2:
- 100 joints of 5.5" L80 BTC casing
- Manufacturer: VAM
- Heat numbers: VAM-67890 through VAM-67989
- Tally lengths: 31.0 ft - 33.2 ft
- Serial numbers: VAM-001 through VAM-100

### sample_manifest_northern_load1.pdf

Mock pipe manifest for Northern Drilling Load #1:
- 80 joints of 7.0" P110 Premium sand control
- Manufacturer: US Steel
- Heat numbers: USS-45678 through USS-45757
- Tally lengths: 39.0 ft - 41.5 ft (Range 3)
- Serial numbers: USS-001 through USS-080

---

## Summary

This comprehensive testing plan covers the complete PipeVault customer journey from sign-up through final delivery and archival. By systematically executing these tests, you will verify:

1. **State Machine Integrity**: All transitions follow documented rules
2. **Data Consistency**: No orphaned records, foreign keys intact
3. **Integration Points**: AI, email, Slack, real-time subscriptions working
4. **Security**: RLS policies enforcing company data isolation
5. **Error Handling**: Graceful degradation when services fail
6. **User Experience**: Clear progress indicators, validation, feedback

**Critical Success Metrics**:
- [ ] Zero data loss throughout complete journey
- [ ] Zero state machine violations
- [ ] 100% notification delivery (email + Slack)
- [ ] Real-time updates < 2 seconds latency
- [ ] AI extraction accuracy > 95% (on clear manifests)
- [ ] RLS policies preventing cross-company data access

**Next Steps After Testing**:
1. Document any failing tests with screenshots
2. Create GitHub issues for bugs found
3. Update state machine diagrams if new states discovered
4. Refine error messages based on user feedback
5. Consider load testing with 10+ concurrent users

**Files Referenced**:
- `C:\Users\kyle\MPS\PipeVault\components\Auth.tsx`
- `C:\Users\kyle\MPS\PipeVault\components\Dashboard.tsx`
- `C:\Users\kyle\MPS\PipeVault\components\StorageRequestWizard.tsx`
- `C:\Users\kyle\MPS\PipeVault\components\InboundShipmentWizard.tsx`
- `C:\Users\kyle\MPS\PipeVault\components\OutboundShipmentWizard.tsx`
- `C:\Users\kyle\MPS\PipeVault\components\RequestDocumentsPanel.tsx`
- `C:\Users\kyle\MPS\PipeVault\components\admin\AdminDashboard.tsx`
- `C:\Users\kyle\MPS\PipeVault\services\manifestProcessingService.ts`
- `C:\Users\kyle\MPS\PipeVault\types.ts`
