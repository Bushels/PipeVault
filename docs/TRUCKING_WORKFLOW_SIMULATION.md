# PipeVault Trucking Workflow - Complete Simulation & Implementation Status

**Date:** 2025-11-11
**Purpose:** Simulate complete customer-to-admin trucking workflow and identify gaps
**Status:** Pre-Production Review

---

## WORKFLOW SIMULATION: Customer Perspective

### Scenario: Bushels Energy has 100 joints approved, needs to schedule delivery

**Initial State:**
- ✅ Storage request MPS-2025-001 is APPROVED
- ✅ Assigned to racks: A1-1, A1-2, A1-3
- ✅ Customer sees "Approved" status on dashboard
- ✅ "Schedule Delivery" button is visible

---

### Step 1: Customer Initiates Booking (Load #1)

**Action:** Customer clicks "Schedule Delivery"

**Expected Result:**
- ✅ WORKS: InboundShipmentWizard opens
- ✅ WORKS: Shows 8-step wizard interface
- ✅ WORKS: Pre-fills company info from request

**Implementation Status:** ✅ COMPLETE

---

### Step 2: Customer Chooses Transportation Method

**Action:** Customer selects one of two options:

#### Option A: "MPS to Provide Quote"

**Expected Flow:**
1. Customer clicks "Request MPS Quote"
2. System creates quote request
3. Status changes to "Awaiting MPS Quote"
4. Customer receives confirmation message
5. Returns to dashboard
6. Email notification sent to customer (confirmation)
7. Slack notification sent to admin (new quote request)
8. Customer waits 24-48 hours for MPS to respond via email

**Current Implementation Status:**
- ✅ WORKS: Quote request creation
- ✅ WORKS: Slack notification to admin
- ⚠️ PARTIAL: Status shows "Pending Trucking Approval" (close enough)
- ❌ MISSING: Customer email confirmation
- ❌ MISSING: Admin email workflow for sending quote back
- ❌ MISSING: Customer acceptance of quote to continue booking

**Gap Impact:** Medium - Customer can still proceed, but email loop is manual

---

#### Option B: "I Will Arrange My Own Trucking"

**Expected Flow:**
1. Customer provides trucking details (company, driver, contact)
2. Customer selects date/time slot from calendar
3. Customer uploads manifest documents (PDFs/photos)
4. AI extracts pipe data from documents
5. Customer verifies AI summary (joints, length, weight)
6. Customer confirms booking
7. Instant return to dashboard
8. Status shows relevant state based on time slot

**Current Implementation Status:**
- ✅ WORKS: All 8 wizard steps
- ✅ WORKS: Time slot selection with calendar
- ✅ WORKS: Document upload to Supabase Storage
- ✅ WORKS: AI extraction via Google Gemini Vision
- ✅ WORKS: Load summary calculation
- ✅ WORKS: Customer verification step
- ✅ WORKS: Slack notification to admin
- ❌ MISSING: Customer email confirmation

**Gap Impact:** Low - Core workflow complete, just missing email

---

### Step 3: After Booking Confirmation

**Expected Dashboard Status Display:**

| Time Slot Type | Expected Status | Current Status | Match? |
|----------------|----------------|----------------|--------|
| Regular hours (7AM-4PM weekday) | "Delivery Scheduled - [Date]" | "Delivery Scheduled" | ✅ Close |
| After-hours (weekends/early/late) | "Awaiting MPS Approval" | "Pending Trucking Approval" | ✅ Close |
| MPS Quote requested | "Awaiting MPS Quote" | "Pending Trucking Approval" | ⚠️ Not specific |

**Current Implementation:**
- ✅ Status badges exist
- ✅ Color coding implemented
- ⚠️ Status labels are close but could be more specific
- ❌ No email notification to customer

**Gap Impact:** Low - Visual indicators work

---

### Step 4: Booking Additional Loads

**Expected Behavior:**
- Customer should be able to book Load #2, Load #3, etc.
- Each load independent booking
- Can book multiple loads for same or different dates
- System tracks sequence (Load #1, Load #2, Load #3)

**Current Implementation:**
- ✅ WORKS: Can book multiple loads
- ✅ WORKS: Sequence numbering automatic
- ❌ MISSING: No blocking/validation requiring Load #1 approval before Load #2
- ❌ MISSING: No dashboard showing "Load #1 pending approval, cannot book Load #2"

**Gap Impact:** Medium - Could cause confusion if Load #2 approved before Load #1

**User's Requirement:** Implied that loads should be sequential (approve Load #1 before Load #2)

---

### Step 5: Tracking Load Progress

**Expected Customer View on Dashboard:**

```
Storage Request MPS-2025-001 - APPROVED
├── Load #1 (50 joints) - Awaiting MPS Approval - Jan 15, 2025 8:00 AM
├── Load #2 (50 joints) - [Cannot book until Load #1 approved]
```

**Current Implementation:**
- ✅ Shows requests on dashboard
- ❌ MISSING: Load-level detail view for customer
- ❌ MISSING: Sequential blocking logic
- ❌ MISSING: Progress indicator (50/100 joints delivered)

**Gap Impact:** High - Customer cannot track multi-load logistics

---

## WORKFLOW SIMULATION: MPS Admin Perspective

### Scenario: Admin receives notification that Bushels Energy booked Load #1

---

### Step 1: Notification Received

**Expected:**
- Slack notification: "New inbound delivery scheduled - Bushels Energy - Load #1 - Jan 15, 2025 8:00 AM"
- Contains: Company, reference ID, date/time, joint count, after-hours flag

**Current Implementation:**
- ✅ WORKS: Slack notification sent
- ✅ WORKS: Contains all required info
- ✅ WORKS: Uses Slack Block Kit formatting

**Implementation Status:** ✅ COMPLETE

---

### Step 2: Admin Reviews Load in Dashboard

**Expected UI:**
```
AdminDashboard
├── Overview Tab (existing)
├── Approvals Tab (existing - for storage requests)
├── Pending Loads Tab ❌ MISSING
│   └── Shows loads with status = NEW
│       ├── Company name
│       ├── Load # (sequence)
│       ├── Scheduled date/time
│       ├── After-hours flag + $450 surcharge indicator
│       ├── Document count
│       ├── AI extracted totals
│       └── "View Details" button
```

**Current Implementation:**
- ✅ AdminDashboard exists with tile-based layout
- ✅ Storage request approval workflow exists
- ❌ MISSING: "Pending Loads" tab
- ❌ MISSING: Load list query
- ❌ MISSING: Load detail modal

**Gap Impact:** CRITICAL - Admin has no UI to review loads

---

### Step 3: Admin Opens Load Details

**Expected Load Detail Modal:**

```
┌─────────────────────────────────────────────────────────┐
│ Load #1 - Bushels Energy - MPS-2025-001                │
├─────────────────────────────────────────────────────────┤
│ SCHEDULING                                               │
│ • Date: January 15, 2025                                │
│ • Time: 8:00 AM - 9:00 AM                               │
│ • After Hours: No                                        │
│ • Surcharge: $0                                          │
├─────────────────────────────────────────────────────────┤
│ TRUCKING DETAILS                                         │
│ • Company: ABC Trucking Ltd.                            │
│ • Driver: John Smith                                     │
│ • Phone: (403) 555-1234                                  │
│ • Contact Email: dispatch@abctrucking.com               │
├─────────────────────────────────────────────────────────┤
│ LOCATION                                                 │
│ • Pickup: Bushels Energy Yard                           │
│ • Address: 123 Industrial Ave, Calgary AB               │
│ • Delivery: MPS Pipe Storage - Nisku Facility           │
├─────────────────────────────────────────────────────────┤
│ AI EXTRACTED MANIFEST DATA                               │
│ • Total Joints: 50                                       │
│ • Total Length: 1,525.5 ft (465 m)                      │
│ • Total Weight: 45,234 lbs (20,518 kg)                  │
│                                                          │
│ Documents (2):                                           │
│ • manifest_load1_page1.pdf [View] [Download]            │
│ • manifest_load1_page2.pdf [View] [Download]            │
│                                                          │
│ Detailed Breakdown (from AI):                            │
│ ┌────────┬──────────┬────────┬──────┬────────┐         │
│ │ Serial │ Heat #   │ Length │ OD   │ Weight │         │
│ ├────────┼──────────┼────────┼──────┼────────┤         │
│ │ T12345 │ H789456  │ 31.2ft │ 4.5" │ 16.6#  │         │
│ │ T12346 │ H789456  │ 30.8ft │ 4.5" │ 16.6#  │         │
│ │ ...    │ ...      │ ...    │ ...  │ ...    │         │
│ └────────┴──────────┴────────┴──────┴────────┘         │
│                                                          │
│ ⚠ Validation Warnings:                                  │
│ • Serial T12389 is unusually short (18.2 ft)            │
├─────────────────────────────────────────────────────────┤
│ CUSTOMER INPUT (from original request)                  │
│ • Estimated Joints: 100                                  │
│ • Grade: X52                                             │
│ • Connection: BTC 8 Round                                │
│ • OD: 4.5"                                               │
├─────────────────────────────────────────────────────────┤
│ ADMIN ACTIONS                                            │
│ [Approve Load] [Request Correction] [Cancel Load]       │
└─────────────────────────────────────────────────────────┘
```

**Current Implementation:**
- ❌ MISSING: Entire modal component
- ❌ MISSING: Query to fetch load + documents + AI data
- ❌ MISSING: AI parsed_payload display formatter
- ❌ MISSING: Action buttons (Approve, Request Correction, Cancel)

**Gap Impact:** CRITICAL - Cannot verify or approve loads

---

### Step 4: Admin Double-Checks Documents

**Expected Flow:**
1. Admin clicks document thumbnail/link
2. PDF/image opens in modal viewer OR downloads
3. Admin visually compares AI extraction to physical document
4. Admin verifies:
   - All serials captured
   - Lengths match
   - No obvious OCR errors
   - Heat numbers correct

**Current Implementation:**
- ✅ Documents stored in Supabase Storage (trucking_documents table)
- ✅ parsed_payload contains AI extraction (JSON array)
- ❌ MISSING: Document viewer in modal
- ❌ MISSING: Side-by-side comparison view

**Gap Impact:** Medium - Admin can manually download and check

---

### Step 5: Admin Approves Load

**Expected Flow:**
1. Admin clicks "Approve Load"
2. Confirmation prompt: "Approve Load #1 for Bushels Energy? This will confirm the booking and notify the customer."
3. Admin confirms
4. Database update:
   ```sql
   UPDATE trucking_loads
   SET status = 'APPROVED', approved_at = NOW()
   WHERE id = 'load-uuid';
   ```
5. Notifications sent:
   - ✉️ Email to customer: "Load #1 approved for Jan 15, 2025 8:00 AM"
   - 📱 Slack to admin: "Load #1 approved - Bushels Energy"
6. Modal closes
7. Load removed from "Pending Loads" list
8. Customer dashboard updates to show "Delivery Scheduled - Jan 15, 2025"

**Current Implementation:**
- ❌ MISSING: "Approve Load" button
- ❌ MISSING: Approval mutation
- ❌ MISSING: Email notification to customer
- ❌ MISSING: Slack notification on approval
- ✅ Database schema supports status transition
- ✅ approved_at column exists

**Gap Impact:** CRITICAL - Core workflow blocked

---

### Step 6: Admin Tracks Approved Loads

**Expected View in Admin Dashboard:**

```
Upcoming Deliveries (Next 7 Days):
┌────────────────────────────────────────────────────────┐
│ Jan 15, 8:00 AM - Bushels Energy - Load #1 - 50 joints│
│ Jan 16, 9:00 AM - Apex Drilling - Load #1 - 75 joints │
│ Jan 16, 2:00 PM - Bushels Energy - Load #2 - 50 joints│
└────────────────────────────────────────────────────────┘
```

**Current Implementation:**
- ❌ MISSING: "Upcoming Deliveries" widget
- ❌ MISSING: Calendar view of approved loads
- ❌ MISSING: Daily schedule view

**Gap Impact:** Medium - Admin can check Slack or database directly

---

### Step 7: Truck Arrives at MPS Facility

**Expected Admin Workflow:**
1. Admin marks load as "In Transit" when truck departs origin
2. Admin marks load as "Arrived" when truck reaches MPS
3. Admin performs physical count and tally
4. Admin enters actual counts:
   - Actual joints: 48 (2 damaged, rejected)
   - Actual length: 1,465.2 ft
   - Actual weight: 43,456 lbs
5. Admin marks load as "Completed"
6. Database updates:
   ```sql
   UPDATE trucking_loads
   SET
     status = 'COMPLETED',
     completed_at = NOW(),
     total_joints_completed = 48,
     total_length_ft_completed = 1465.2,
     total_weight_lbs_completed = 43456
   WHERE id = 'load-uuid';
   ```
7. Inventory created:
   ```sql
   INSERT INTO inventory (
     company_id, request_id, delivery_truck_load_id,
     type, grade, outer_diameter, weight, length, quantity,
     status, storage_area_id
   ) VALUES (...);
   ```
8. Notifications:
   - ✉️ Email to customer: "Load #1 received - 48 joints (2 damaged)"
   - 📱 Slack to admin: "Load #1 complete - Bushels Energy"

**Current Implementation:**
- ❌ MISSING: "Mark In Transit" button
- ❌ MISSING: "Mark Arrived" button
- ❌ MISSING: "Mark Completed" form (with actual counts input)
- ✅ Database columns exist (total_joints_completed, etc.)
- ❌ MISSING: Inventory auto-creation from load completion
- ❌ MISSING: Email notifications for state transitions
- ❌ MISSING: Slack notifications for IN_TRANSIT and COMPLETED

**Gap Impact:** CRITICAL - No way to close out loads

---

### Step 8: Multi-Load Tracking

**Expected Behavior:**
- Admin sees all loads for a storage request grouped
- Progress indicator: "50/100 joints delivered (Load #1 complete, Load #2 pending)"
- Can track:
  - Which loads completed
  - Which loads pending approval
  - Which loads in transit
  - Total joints remaining to deliver

**Current Implementation:**
- ✅ Database supports multi-load per request (sequence_number)
- ✅ Utility functions exist: summarizeLoadTotals()
- ❌ MISSING: Multi-load dashboard view
- ❌ MISSING: Progress indicator UI
- ❌ MISSING: Grouping by storage request

**Gap Impact:** High - Multi-load logistics difficult to track

---

## WORKFLOW STATE MACHINE

### Complete Status Flow

```
[STORAGE REQUEST APPROVED]
         ↓
[Customer books Load #1]
         ↓
    ┌────────────────────────┐
    │ Transportation Choice  │
    └────────┬───────────────┘
             │
    ┌────────┴────────┐
    │                 │
[MPS Quote]    [Customer Provides]
    │                 │
    ↓                 ↓
┌──────────┐    ┌──────────┐
│ PENDING  │    │   NEW    │ ← After-hours slots
│  QUOTE   │    │          │ → Auto-APPROVED (regular hours)
└────┬─────┘    └────┬─────┘
     │               │
     │ (manual)      │ (admin approves)
     │               ↓
     │          ┌──────────┐
     │          │ APPROVED │
     │          └────┬─────┘
     │               │ (truck departs)
     │               ↓
     │          ┌──────────────┐
     │          │ IN_TRANSIT   │
     │          └────┬─────────┘
     │               │ (truck arrives + physical count)
     │               ↓
     └──────────→┌──────────┐
                 │ COMPLETED│
                 └──────────┘
                      ↓
            [Inventory Created]
            [Customer Notified]
            [Request Progress Updated]
```

### Status Transition Table

| From | To | Trigger | Notification | Current Implementation |
|------|----|---------|--------------|-----------------------|
| - | NEW | Customer books (after-hours) | Slack to admin | ✅ WORKS |
| - | APPROVED | Customer books (regular hours) | Slack to admin | ✅ WORKS |
| NEW | APPROVED | Admin clicks "Approve" | Email + Slack | ❌ MISSING |
| APPROVED | IN_TRANSIT | Admin clicks "Mark In Transit" | Email + Slack | ❌ MISSING |
| IN_TRANSIT | COMPLETED | Admin enters actual counts | Email + Slack | ❌ MISSING |
| Any | CANCELLED | Admin/Customer cancels | Email + Slack | ❌ MISSING |

---

## DATA FLOW: End-to-End

### Customer Booking → Database

```
InboundShipmentWizard (customer input)
    ↓
Validation (required fields, date/time logic)
    ↓
Document Upload → Supabase Storage
    ↓
AI Processing → manifestProcessingService.ts
    ↓ (Gemini Vision API)
Parsed Manifest Data (ManifestItem[])
    ↓
Load Summary Calculation
    ↓
Customer Verification
    ↓
Database Inserts:
    • trucking_loads (with status, totals_planned)
    • trucking_documents (with parsed_payload)
    • shipments (legacy, will phase out)
    • shipment_trucks
    • dock_appointments
    ↓
Slack Notification
    ↓
Customer Returns to Dashboard
```

### Admin Approval → Notification

```
AdminDashboard - Pending Loads Tab
    ↓
Admin Clicks Load Tile
    ↓
Load Detail Modal Opens (shows AI data + documents)
    ↓
Admin Reviews & Clicks "Approve Load"
    ↓
Database Update:
    UPDATE trucking_loads SET status = 'APPROVED', approved_at = NOW()
    ↓
Cache Invalidation:
    queryClient.invalidateQueries(['trucking-loads'])
    queryClient.invalidateQueries(['companies', 'summaries'])
    queryClient.invalidateQueries(['projectSummaries'])
    ↓
Notifications:
    • Email Service → Customer
    • Slack → Admin channel
    ↓
Modal Closes, List Refreshes (load removed from pending)
    ↓
Customer Dashboard Updates (shows "Delivery Scheduled")
```

### Truck Completion → Inventory

```
Admin Opens Approved Load
    ↓
Admin Clicks "Mark Completed"
    ↓
Form: Enter Actual Counts (joints, length, weight, notes)
    ↓
Submit
    ↓
Database Updates:
    • trucking_loads: status = 'COMPLETED', actual totals
    • inventory: Create records for received pipe
        - Link to: company_id, request_id, delivery_truck_load_id
        - Status: IN_STORAGE
        - Quantities: Actual counts from load
    ↓
Inventory Assignment:
    • storage_area_id from request.assignedRackIds
    • Update rack occupancy counts
    ↓
Notifications:
    • Email → Customer (load complete, discrepancies if any)
    • Slack → Admin (confirmation)
    ↓
Request Progress Update:
    • Calculate: total_joints_delivered / total_joints_requested
    • If all loads complete: Request status could change to "COMPLETED"
```

---

## IMPLEMENTATION GAP ANALYSIS

### ✅ What's Working (70-75%)

1. **Customer Booking Flow**
   - 8-step wizard complete
   - Form validation robust
   - Time slot selection with calendar
   - Document upload to Supabase Storage
   - AI extraction via Gemini Vision
   - Load summary calculation
   - Customer verification step

2. **Database Schema**
   - trucking_loads table complete
   - trucking_documents table complete
   - Foreign keys and indexes in place
   - Status enum values defined

3. **Notifications (Partial)**
   - Slack on load booking ✅
   - Slack on quote request ✅
   - Slack on manifest issues ✅

4. **Status Display**
   - Badge components exist
   - Color coding implemented
   - Status utility functions

---

### ❌ What's Missing (25-30%)

### CRITICAL (Blocks Production)

1. **Admin Load Verification UI**
   - [ ] "Pending Loads" dashboard tab
   - [ ] Load list query (status = NEW)
   - [ ] Load detail modal component
   - [ ] AI parsed data display formatter
   - [ ] Document viewer/download links
   - [ ] "Approve Load" button + handler
   - [ ] "Request Correction" button + handler

2. **Load State Transitions**
   - [ ] Admin "Mark In Transit" functionality
   - [ ] Admin "Mark Completed" functionality
   - [ ] Actual counts input form
   - [ ] Inventory auto-creation on completion

3. **Notifications (Complete)**
   - [ ] Email to customer on booking confirmation
   - [ ] Email to customer on load approval
   - [ ] Email to customer on load completion
   - [ ] Slack on load approval
   - [ ] Slack on load completion
   - [ ] Slack on load in-transit

### HIGH Priority

4. **Multi-Load Tracking**
   - [ ] Progress indicator (X/Y joints delivered)
   - [ ] Load grouping by storage request
   - [ ] Sequential load blocking (Load #2 waits for Load #1)
   - [ ] Dashboard showing all loads for a request

5. **Customer Communication**
   - [ ] Email service integration (Resend API)
   - [ ] Email templates for each state
   - [ ] Customer portal showing load status

### MEDIUM Priority

6. **Admin Workflow Enhancements**
   - [ ] Upcoming deliveries calendar view
   - [ ] Daily schedule report
   - [ ] Load cancellation workflow
   - [ ] Correction request handling

7. **Quote Workflow**
   - [ ] Admin quote management UI
   - [ ] Quote acceptance by customer
   - [ ] Quote-to-booking flow

---

## TECHNICAL DEBT & REFACTORING NEEDS

### Duplicate Tables (Legacy)
- `shipments` table: Being phased out, replaced by `trucking_loads`
- `shipment_trucks` table: Duplicate of trucking_loads
- Migration needed to consolidate

### Duplicate Foreign Keys
- `trucking_documents` has 2 FKs to trucking_loads (fixed in queries with !fk syntax)
- Should remove duplicate constraint

### Missing RLS Policies
- trucking_loads: Needs RLS for customer view access
- trucking_documents: Needs RLS for customer document access

---

## ESTIMATED EFFORT TO COMPLETE

| Component | Hours | Priority | Blocker? |
|-----------|-------|----------|----------|
| Admin Load Verification UI | 6-8 | CRITICAL | Yes |
| Load Approval Handler | 2-3 | CRITICAL | Yes |
| State Transition UI (In-Transit, Completed) | 4-5 | CRITICAL | Yes |
| Inventory Auto-Creation | 3-4 | CRITICAL | Yes |
| Email Notifications (all states) | 4-6 | HIGH | No |
| Slack Notifications (missing states) | 2-3 | HIGH | No |
| Multi-Load Tracking Dashboard | 3-4 | HIGH | No |
| Sequential Load Blocking | 2-3 | MEDIUM | No |
| Quote Management UI | 4-6 | MEDIUM | No |
| **TOTAL** | **30-42 hours** | | |

**Minimum Viable:** 15-20 hours (CRITICAL items only)
**Full Implementation:** 30-42 hours (CRITICAL + HIGH)
**Timeline:** 2-3 days (minimum) to 4-6 days (full)

---

## RECOMMENDED NEXT STEPS

### Immediate (Before Manual Testing)

1. **Build Admin Load Verification UI** (6-8 hours)
   - Create PendingLoadsTile component for AdminDashboard
   - Create LoadDetailModal component
   - Implement load list query
   - Add "Approve Load" button + handler

2. **Implement Load Approval Flow** (2-3 hours)
   - Create approveLoad mutation
   - Update trucking_loads.status to APPROVED
   - Invalidate relevant caches
   - Add Slack notification

3. **Test End-to-End** (2-3 hours)
   - Customer books load
   - Admin sees in pending list
   - Admin approves
   - Customer sees updated status

### Phase 2 (Production Ready)

4. **Complete State Transitions** (4-5 hours)
   - In-Transit functionality
   - Completion form with actual counts
   - Inventory auto-creation

5. **Email Notifications** (4-6 hours)
   - Integrate Resend API
   - Create email templates
   - Send on each state transition

6. **Multi-Load Tracking** (3-4 hours)
   - Progress indicators
   - Load grouping
   - Sequential blocking

---

## CODEX REVIEW CHECKLIST

Before manual testing, Codex should verify:

- [ ] InboundShipmentWizard complete and tested
- [ ] Admin can see pending loads in dashboard
- [ ] Admin can approve loads
- [ ] Load status transitions work correctly
- [ ] Notifications sent on booking and approval
- [ ] Customer dashboard shows updated status
- [ ] Multi-load scenarios handled
- [ ] Sequential load logic (if implemented)
- [ ] Database queries optimized
- [ ] RLS policies in place
- [ ] Error handling robust
- [ ] Loading states implemented
- [ ] Edge cases considered (cancellations, corrections)

---

**Status:** Ready for Codex review and implementation planning
**Confidence:** High - Core workflow is 70% complete, gaps clearly identified
**Risk:** Medium - Missing admin UI is critical but straightforward to implement
