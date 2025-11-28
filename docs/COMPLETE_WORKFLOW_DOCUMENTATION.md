# PipeVault Complete Workflow Documentation

## Production Readiness Audit - November 2024

This document provides a comprehensive step-by-step walkthrough of the entire PipeVault application workflow, including customer actions, admin responses, and all automated triggers.

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Customer Workflow](#2-customer-workflow)
3. [Admin Workflow](#3-admin-workflow)
4. [Notification & Trigger System](#4-notification--trigger-system)
5. [Status Transitions & State Machine](#5-status-transitions--state-machine)
6. [Production Issues & Gaps](#6-production-issues--gaps)
7. [Database Integrity Concerns](#7-database-integrity-concerns)
8. [Recommendations](#8-recommendations)

---

## 1. System Overview

### What PipeVault Does
PipeVault is an enterprise pipe storage management portal that handles:
- Customer storage request submissions
- Admin approval/rejection workflows
- Inbound delivery scheduling and tracking
- Inventory management across storage yards/racks
- Outbound pickup coordination
- Real-time multi-admin collaboration

### Technology Stack
| Component | Technology |
|-----------|------------|
| Frontend | React 19 + TypeScript + Vite |
| Database | Supabase (PostgreSQL 15) |
| Auth | Supabase Auth (JWT) |
| Real-time | Supabase Realtime (WebSockets) |
| Storage | Supabase Storage |
| Email | Resend API |
| Slack | Incoming Webhooks |
| AI | Google Gemini 2.0/2.5 Flash |

---

## 2. Customer Workflow

### Phase 1: Account Creation

#### Step 1.1: Customer Signs Up
**Location:** `/components/Auth.tsx`

| Action | Details |
|--------|---------|
| Entry Point | Customer visits PipeVault URL |
| Options | Email/Password OR OAuth (Google, Apple, Azure) |
| Required Fields | Email, Password (8+ chars), Company Name, First Name, Last Name, Phone |

**Process Flow:**
```
1. Customer fills registration form
2. Form validation (Zod schema)
3. Supabase Auth signUp() called
4. User metadata stored: { company_name, first_name, last_name, contact_number }
5. Verification email sent automatically by Supabase
6. Customer must verify email before accessing dashboard
```

**Triggers Fired:**
| Trigger | Channel | Content |
|---------|---------|---------|
| `on_auth_user_created` | Slack | "🆕 New Customer Sign-up" with customer details |

#### Step 1.2: Company Auto-Creation
**Location:** `/lib/AuthContext.tsx` → `ensureCompanyForUser()`

```
1. Extract domain from email (user@company.com → company.com)
2. Check if company exists in `companies` table
3. IF NOT EXISTS: Create company with name derived from domain
4. Associate user with company via domain matching
```

**Database Records Created:**
- `auth.users` - User authentication record
- `companies` - Company record (if new domain)

---

### Phase 2: Storage Request Creation

#### Step 2.1: Start New Request
**Location:** `/components/StorageRequestWizard.tsx`

**Wizard Steps:**

##### Step 1 of 3: Project Details
| Field | Required | Validation |
|-------|----------|------------|
| Project Reference ID | ✅ | Max 50 chars, unique per company |
| Item Type | ✅ | Enum: Blank Pipe, Sand Control, Flow Control, Tools, Other |
| Screen Type | If Sand Control | DWW, PPS, SL, Other |
| Outer Diameter | ✅ | From CASING_DATA lookup |
| Weight (lbs/ft) | ✅ | Filtered by selected OD |
| Grade | Optional | Free text |
| Connection | Optional | Free text |
| Avg Joint Length (ft) | ✅ | Min 0.1 |
| Total Joints | ✅ | Min 1, integer |

##### Step 2 of 3: Storage & Trucking
| Field | Required | Validation |
|-------|----------|------------|
| Storage Start Date | ✅ | Future date |
| Storage End Date | ✅ | After start date |
| Trucking Type | ✅ | none / quote / provided |
| Storage Company Name | If type=provided | Min 1 char |
| Storage Contact Name | If type=provided | Min 1 char |
| Storage Contact Email | If type=provided | Valid email |
| Storage Contact Phone | If type=provided | Min 1 char |
| Storage Location Address | If type=provided | Min 1 char |
| Special Instructions | Optional | Free text |

##### Step 3 of 3: Review & Submit
- Display all entered information
- Customer confirms accuracy
- Submit creates record

#### Step 2.2: Request Submission
**Database Action:**
```sql
INSERT INTO storage_requests (
  company_id,
  user_email,
  reference_id,
  status,           -- 'PENDING'
  request_details,  -- JSONB with all form data
  trucking_info,    -- JSONB with trucking preferences
  created_at,
  updated_at
)
```

**Triggers Fired:**
| Trigger | Channel | Timing | Content |
|---------|---------|--------|---------|
| `trigger_notify_slack_storage_request` | Slack (DB) | Immediate | Project ref, company, contact, item type, quantity, dates |
| `sendNewRequestNotification()` | Slack (Frontend) | Immediate | Formatted Block Kit message with "Review in PipeVault" button |

**Customer State After:** Request visible in dashboard with status "PENDING"

---

### Phase 3: Awaiting Approval

#### Step 3.1: Customer Waits
- Dashboard shows request with "Pending Approval" status (yellow badge)
- Customer can view request details but cannot edit
- No actions available until admin responds

#### Step 3.2: Admin Approves or Rejects
*See [Admin Workflow - Phase 1](#phase-1-request-approval)*

**If APPROVED:**
- Customer receives email notification
- Dashboard status changes to "Approved" (green badge)
- "Truck to MPS" button becomes available

**If REJECTED:**
- Customer receives email with rejection reason
- Dashboard status changes to "Rejected" (red badge)
- Customer must create new request to try again

---

### Phase 4: Inbound Delivery Scheduling

#### Step 4.1: Customer Opens Inbound Wizard
**Location:** `/components/InboundShipmentWizard.tsx`

**Prerequisites:**
- Storage request must be APPROVED
- No pending inbound loads blocking (checked via `usePendingLoadForRequest`)

**Wizard Steps:**

##### Step 1: Storage Yard Selection
| Field | Required | Validation |
|-------|----------|------------|
| Storage Company Name | ✅ | Min 2 chars |
| Storage Yard Address | ✅ | Min 1 char |
| Storage Contact Name | ✅ | Min 1 char |
| Storage Contact Email | ✅ | Valid email |
| Storage Contact Phone | ✅ | Min 1 char |

##### Step 2: Trucking Method Selection
| Option | Flow |
|--------|------|
| **CUSTOMER_PROVIDED** | Continue to Steps 3-7 |
| **MPS_QUOTE** | Create quote request → Jump to confirmation |

**If MPS_QUOTE Selected:**
```
1. Generate quote number (PV-0001, PV-0002, etc.)
2. Create trucking_quotes record with status='PENDING'
3. Send Slack notification with quote request details
4. Show "Quote request submitted! MPS will review within 24-48 hours"
5. Customer waits for quote response
```

##### Step 3: Trucking & Driver Details (if CUSTOMER_PROVIDED)
| Field | Required | Validation |
|-------|----------|------------|
| Trucking Company Name | ✅ | Min 2 chars |
| Driver Name | Optional | Free text |
| Driver Phone | Optional | Free text |

##### Step 4: Time Slot Selection
**Location:** `/components/TimeSlotPicker.tsx`

**MPS Receiving Hours:**
- Regular: Monday-Friday, 7:00 AM - 4:00 PM (Mountain Time)
- Off-Hours: All other times
- Off-Hours Surcharge: **$450 per slot**

**Slot Configuration:**
- 14-day rolling window
- 1-hour slots from 6:00 AM - 6:00 PM
- Weekend/off-hours slots marked with surcharge indicator

##### Step 5: Document Upload
**Location:** `/components/DocumentUploadStep.tsx`

| Setting | Value |
|---------|-------|
| Allowed Types | PDF, JPG, PNG, WebP |
| Max File Size | 10 MB per file |
| Drag & Drop | Supported |

**AI Manifest Extraction Process:**
```
1. File uploaded to Supabase Storage
2. Document record created with status='UPLOADED'
3. Gemini Vision API processes image/PDF
4. Status changes: UPLOADED → PROCESSING → PARSED/FAILED
5. Extracted data: manufacturer, heat_number, serial_number, tally_length_ft, quantity
6. LoadSummary calculated: total_joints, total_length_ft/m, total_weight_lbs/kg
```

##### Step 6: Review Load Summary
- Display AI-extracted totals
- Show document upload status
- Option to report issues with manifest data
- Option to skip documents (with confirmation)

##### Step 7: Confirmation
**Final Submission Creates:**

```sql
-- Trucking Load Record
INSERT INTO trucking_loads (
  storage_request_id,
  company_id,
  direction,           -- 'INBOUND'
  sequence_number,     -- 1, 2, 3...
  status,              -- 'APPROVED' (auto-approved for customer-initiated)
  scheduled_slot_start,
  scheduled_slot_end,
  trucking_company_name,
  driver_name,
  driver_phone
)

-- Trucking Documents (for each uploaded file)
INSERT INTO trucking_documents (
  trucking_load_id,
  document_id,
  document_type
)
```

**Triggers Fired:**
| Trigger | Channel | Content |
|---------|---------|---------|
| `trigger_notify_slack_inbound_load` | Slack (DB) | Load #, company, delivery date/time, after-hours warning |
| `sendInboundDeliveryNotification()` | Slack (Frontend) | Full delivery details with document list |
| `sendLoadBookingConfirmation()` | Slack (Frontend) | Booking confirmation with admin dashboard link |

**Customer State After:**
- Dashboard shows "Inbound Scheduled" with delivery date/time
- Load appears in admin "Pending Loads" queue

---

### Phase 5: Delivery Tracking

#### Step 5.1: Load Status Progression
Customer can track their load through these statuses:

| Status | Meaning | Customer Action |
|--------|---------|-----------------|
| NEW | Load created, awaiting admin review | Wait |
| APPROVED | Admin confirmed delivery slot | Wait for delivery day |
| IN_TRANSIT | Truck en route to MPS | Monitor |
| COMPLETED | Delivered and stored at MPS | Schedule pickup when ready |

**Automatic Notifications:**
| Status Change | Email | Slack |
|---------------|-------|-------|
| → APPROVED | ✅ "Delivery Confirmed" | ✅ Admin notified |
| → IN_TRANSIT | ✅ "Truck En Route" with driver info | ✅ Admin notified |
| → COMPLETED | ✅ "Delivery Complete" with inventory count | ✅ Admin notified |

---

### Phase 6: Outbound Pickup Scheduling

#### Step 6.1: Customer Opens Outbound Wizard
**Location:** `/components/OutboundShipmentWizard.tsx`

**Prerequisites:**
- Storage request APPROVED
- At least one inbound load COMPLETED (implied)
- No pending outbound loads blocking

**Wizard Steps:**

##### Step 1: Destination Entry
| Field | Required | Validation |
|-------|----------|------------|
| LSD (Legal Subdivision) | ✅ | Any string (no format validation) |
| Well Name | One required | If UWI not provided |
| UWI (Unique Well Identifier) | One required | If Well Name not provided |
| Contact Name | ✅ | Min 1 char |
| Contact Phone | ✅ | Valid phone |
| Special Instructions | Optional | Free text |

##### Step 2: Shipping Method
| Option | Status |
|--------|--------|
| **CUSTOMER_ARRANGED** | Continue to time slot |
| **MPS_QUOTE** | ⚠️ "Coming Soon" - Not implemented |

##### Step 3: Time Slot Selection
- Same TimeSlotPicker as inbound
- Same hours and surcharge rules

##### Step 4: Review
- Display pickup summary
- Destination details
- Time slot

##### Step 5: Confirmation
**Database Action:**
```sql
INSERT INTO trucking_loads (
  storage_request_id,
  company_id,
  direction,              -- 'OUTBOUND'
  sequence_number,
  status,                 -- 'APPROVED' (auto-approved)
  scheduled_slot_start,
  scheduled_slot_end,
  destination_lsd,
  destination_well_name,
  destination_uwi,
  shipping_method,
  notes
)
```

**Triggers Fired:**
| Trigger | Channel | Content |
|---------|---------|---------|
| `sendOutboundPickupNotification()` | Slack (Frontend) | Pickup details, destination, contact info |

---

### Phase 7: Project Completion

#### Step 7.1: All Inventory Picked Up
When the last outbound load is marked COMPLETED and no inventory remains:

**Trigger Fired:**
| Trigger | Channel | Content |
|---------|---------|---------|
| `notify_slack_project_complete()` | Slack (DB) | "✅ Project Complete: All pipe for [REF] has been moved out" |

**Customer State After:**
- Dashboard shows request as "COMPLETE"
- All loads show COMPLETED status
- Project archived for historical reference

---

## 3. Admin Workflow

### Phase 1: Request Approval

#### Step A1.1: Admin Reviews Pending Requests
**Location:** `/components/admin/AdminDashboard.tsx` → Approvals Tab

**Display:**
- List of all PENDING storage requests
- Each shows: Reference ID, Company, Contact, Item Type, Quantity, Dates

#### Step A1.2: Admin Opens ApprovalCard
**Component:** `ApprovalCard` (lines 2773-3123)

**Information Displayed:**
```
┌─ Header ─────────────────────────────────────────┐
│ Reference ID + Company Name | PENDING badge      │
├─ Request Summary ────────────────────────────────┤
│ Contact Info | Total Volume (joints) | Timeline  │
│ Pipe Info (Type, Grade, Connection, etc.)        │
│ Trucking Info (Type, Location, Contact)          │
├─ Internal Notes ─────────────────────────────────┤
│ [Textarea] - Admin-only visible notes            │
├─ Rack Selection ─────────────────────────────────┤
│ [RackSelector] - Multi-yard rack picker          │
│ Capacity Status: [Red/Green/Blue banner]         │
├─ Action Buttons ─────────────────────────────────┤
│ [Approve] (green) | [Reject] (red)               │
└──────────────────────────────────────────────────┘
```

#### Step A1.3: Admin Selects Racks
**Component:** `/components/admin/RackSelector.tsx`

**Capacity Validation:**
| Status | Color | Approve Button |
|--------|-------|----------------|
| Insufficient capacity | Red | DISABLED |
| Exact fit | Green | Enabled |
| Excess capacity | Blue | Enabled |

#### Step A1.4a: Admin Approves Request
**Function:** `approve_storage_request_atomic()` (PostgreSQL RPC)

**Atomic Transaction Steps:**
```
1. SECURITY CHECK: Verify admin privileges
2. VALIDATE: Request exists and status = 'PENDING'
3. VALIDATE: All selected racks exist
4. VALIDATE: Total rack capacity >= required joints
5. UPDATE: storage_requests SET status = 'APPROVED'
6. UPDATE: Each rack's occupied count
7. INSERT: admin_audit_log entry
8. INSERT: notification_queue entry (email)
9. RETURN: Success JSON with details
```

**Triggers Fired:**
| Trigger | Channel | Content |
|---------|---------|---------|
| Email (queued) | Customer Email | "Congratulations! Your FREE Pipe Storage has been Approved!" |
| Real-time | WebSocket | Cache invalidation for all connected admins |

#### Step A1.4b: Admin Rejects Request
**Function:** `reject_storage_request_atomic()` (PostgreSQL RPC)

**Required Input:** Rejection reason (text)

**Atomic Transaction Steps:**
```
1. SECURITY CHECK: Verify admin privileges
2. VALIDATE: Request exists and status = 'PENDING'
3. UPDATE: storage_requests SET status = 'REJECTED', rejection_reason = [reason]
4. INSERT: admin_audit_log entry
5. INSERT: notification_queue entry (email)
6. RETURN: Success JSON
```

**Triggers Fired:**
| Trigger | Channel | Content |
|---------|---------|---------|
| Email (queued) | Customer Email | "Update on Your PipeVault Storage Request" with reason |

---

### Phase 2: Load Management

#### Step A2.1: Admin Reviews Pending Loads
**Location:** `/components/admin/tiles/PendingLoadsTile.tsx`

**Display:** All trucking_loads with status = 'NEW'

#### Step A2.2: Admin Opens LoadDetailModal
**Component:** `/components/admin/LoadDetailModal.tsx`

**Content Sections:**
```
┌─ Header ──────────────────────────────────────────┐
│ Load #123 - Company Name [domain.com]             │
├─ Scheduling ──────────────────────────────────────┤
│ Date & Time | After Hours (Yes/No) | Surcharge    │
├─ Trucking Details ────────────────────────────────┤
│ Company | Driver | Contact Phone | Email          │
├─ Locations ───────────────────────────────────────┤
│ Pickup Location | Delivery Location               │
├─ AI Extracted Manifest Data ──────────────────────┤
│ Total Joints | Total Length | Total Weight        │
│ Line Items Table (Serial#, Heat#, Length, etc.)   │
├─ Original Customer Request ───────────────────────┤
│ Item Type | Grade | Connection | Specs            │
├─ Action Buttons ──────────────────────────────────┤
│ [Request Correction] | [Reject] | [✓ Approve]     │
└───────────────────────────────────────────────────┘
```

#### Step A2.3a: Admin Requests Correction
**Modal:** `RequestCorrectionModal`

**Predefined Issues (checkboxes):**
- Missing heat numbers
- Missing serial numbers
- Duplicate serial numbers
- Missing tally lengths
- Missing pipe specs
- Illegible handwriting
- Incomplete manifest
- Quantity mismatch

**Result:**
- Status remains 'NEW'
- Slack notification sent to customer with issues list
- Customer re-uploads corrected manifest

#### Step A2.3b: Admin Rejects Load
**Modal:** `RejectLoadModal`

**Required:** Rejection reason (min 10 chars)

**Result:**
- Status: NEW → REJECTED
- Slack notification with rejection reason
- Email notification to customer

#### Step A2.3c: Admin Approves Load
**Result:**
- Status: NEW → APPROVED
- Email notification sent (via queue)
- Slack notification sent

**Triggers Fired:**
| Trigger | Channel | Content |
|---------|---------|---------|
| `trigger_load_approved_email` | Email (queued) | Delivery date/time, trucking company, driver, joints |

---

### Phase 3: Transit & Completion

#### Step A3.1: Mark Load In-Transit
**Triggered by:** Admin or driver notification

**Result:**
- Status: APPROVED → IN_TRANSIT
- Email notification to customer with driver info and ETA

**Triggers Fired:**
| Trigger | Channel | Content |
|---------|---------|---------|
| `trigger_load_in_transit_email` | Email (queued) | Driver name/phone, ETA, expected joints |

#### Step A3.2: Mark Load Completed
**Modal:** `CompletionFormModal.tsx`

**Form Fields:**
| Field | Required | Validation |
|-------|----------|------------|
| Rack Selection | ✅ | Must have capacity |
| Actual Joints Received | ✅ | Pre-filled, editable, > 0 |
| Notes | Optional | Free text |

**Function:** `mark_load_completed_and_create_inventory()` (PostgreSQL RPC)

**Atomic Transaction Steps:**
```
1. UPDATE: trucking_loads SET status = 'COMPLETED', completed_at = NOW()
2. UPDATE: trucking_loads SET total_joints_completed = actualJointsReceived
3. INSERT: inventory records from manifest data (bulk)
4. UPDATE: rack occupancy (atomic increment)
5. RETURN: Success with inventory count
```

**Triggers Fired:**
| Trigger | Channel | Content |
|---------|---------|---------|
| `trigger_load_completed_email` | Email (queued) | Joints received, rack location, project totals |
| Real-time | WebSocket | Inventory + rack cache invalidation |

---

### Phase 4: Real-Time Collaboration

#### Multi-Admin Sync
**Hook:** `useRealtimeUpdates()` (AdminDashboard line 144)

**Subscribed Tables:**
| Table | Events | Invalidates |
|-------|--------|-------------|
| `trucking_loads` | INSERT/UPDATE/DELETE | loads, load-details, pending-loads |
| `inventory` | INSERT/UPDATE/DELETE | inventory, company-details, racks |
| `racks` | INSERT/UPDATE | racks, yards, analytics |
| `storage_requests` | INSERT/UPDATE | requests, analytics |

**Behavior:**
- Admin A approves load
- Database trigger fires pg_notify
- Admin B's dashboard auto-refreshes (500ms debounce)
- No manual refresh needed

---

## 4. Notification & Trigger System

### Database Triggers (PostgreSQL)

| Trigger Name | Table | Event | Function | Channel |
|--------------|-------|-------|----------|---------|
| `trigger_notify_slack_storage_request` | storage_requests | INSERT/UPDATE | `notify_slack_storage_request()` | Slack |
| `trigger_notify_slack_inbound_load` | trucking_loads | INSERT (INBOUND) | `notify_slack_inbound_load()` | Slack |
| `on_auth_user_created` | auth.users | INSERT | `notify_slack_new_user()` | Slack |
| `on_trucking_load_complete` | trucking_loads | UPDATE (OUTBOUND→COMPLETED) | `notify_slack_project_complete()` | Slack |
| `trigger_load_approved_email` | trucking_loads | UPDATE (→APPROVED) | `notify_load_approved()` | Email Queue |
| `trigger_load_completed_email` | trucking_loads | UPDATE (→COMPLETED) | `notify_load_completed()` | Email Queue |
| `trigger_load_in_transit_email` | trucking_loads | UPDATE (→IN_TRANSIT) | `notify_load_in_transit()` | Email Queue |
| `trigger_broadcast_load_status` | trucking_loads | INSERT/UPDATE | `broadcast_load_status_change()` | Realtime |
| `trigger_broadcast_inventory` | inventory | INSERT/UPDATE/DELETE | `broadcast_inventory_change()` | Realtime |
| `trigger_broadcast_rack_occupancy` | racks | INSERT/UPDATE | `broadcast_rack_occupancy_change()` | Realtime |

### Frontend Slack Functions

| Function | Trigger Point | Content |
|----------|---------------|---------|
| `sendNewRequestNotification()` | Request submission | New request details |
| `sendTruckingQuoteRequest()` | MPS quote requested | Quote # and pickup location |
| `sendTruckingQuoteApproved()` | Admin approves quote | Quote details and amount |
| `sendInboundDeliveryNotification()` | Inbound wizard complete | Full delivery details |
| `sendManifestIssueNotification()` | Customer reports issue | Issue description, AI data |
| `sendLoadBookingConfirmation()` | Load booked | Booking confirmation |
| `sendOutboundPickupNotification()` | Outbound wizard complete | Pickup and destination details |

### Email Templates (Resend API)

| Function | Subject | Trigger |
|----------|---------|---------|
| `sendApprovalEmail()` | "Congratulations! Your FREE Pipe Storage has been Approved!" | Request approved |
| `sendRejectionEmail()` | "Update on Your PipeVault Storage Request" | Request rejected |
| `sendShipmentReceivedEmail()` | "PipeVault Update: Shipment Received" | Load completed |

### Notification Queue Processing

**Edge Function:** `process-notification-queue`
- **Schedule:** Every 5 minutes (cron)
- **Batch Size:** 50 notifications per run
- **Max Retries:** 3 attempts per notification
- **Deduplication:** Unique index prevents duplicate sends

---

## 5. Status Transitions & State Machine

### Storage Request Statuses

```
┌─────────┐
│  DRAFT  │ (Reserved, not currently used)
└────┬────┘
     │ Customer submits
     ▼
┌─────────┐
│ PENDING │
└────┬────┘
     │
     ├─── Admin approves ──────► ┌──────────┐
     │                           │ APPROVED │
     │                           └────┬─────┘
     │                                │ All pickups done
     │                                ▼
     │                           ┌───────────┐
     │                           │ COMPLETED │
     │                           └───────────┘
     │
     └─── Admin rejects ───────► ┌──────────┐
                                 │ REJECTED │ (Terminal)
                                 └──────────┘
```

### Trucking Load Statuses

```
┌─────┐
│ NEW │ ◄── Customer creates inbound/outbound
└──┬──┘
   │
   ├─── Admin approves ────────► ┌──────────┐
   │                             │ APPROVED │
   │                             └────┬─────┘
   │                                  │ Truck departs
   │                                  ▼
   │                             ┌────────────┐
   │                             │ IN_TRANSIT │
   │                             └─────┬──────┘
   │                                   │ Arrives at destination
   │                                   ▼
   │                             ┌───────────┐
   │                             │ COMPLETED │
   │                             └───────────┘
   │
   └─── Admin rejects ─────────► ┌───────────┐
                                 │ REJECTED  │ (Terminal)
                                 └───────────┘
```

### Inventory Statuses

```
┌──────────────────┐
│ PENDING_DELIVERY │ ◄── Created when load scheduled
└────────┬─────────┘
         │ Load completed, assigned to rack
         ▼
┌────────────┐
│ IN_STORAGE │
└─────┬──────┘
      │ Outbound pickup initiated
      ▼
┌────────────┐
│ IN_TRANSIT │
└─────┬──────┘
      │ Delivered to well site
      ▼
┌───────────┐
│ PICKED_UP │ (Terminal)
└───────────┘
```

---

## 6. Production Issues & Gaps

### Critical Issues (Must Fix)

#### Issue #1: No Draft Auto-Save
**Impact:** HIGH - Data loss risk
**Location:** All wizard components
**Problem:** Users lose all progress if browser refreshes or closes
**Fix Required:** Implement localStorage persistence or auto-save to database

#### Issue #2: Manifest Extraction Failure Handling
**Impact:** HIGH - Blocking workflow
**Location:** `/components/DocumentUploadStep.tsx`
**Problem:** No retry mechanism if Gemini API fails; no manual data entry fallback
**Fix Required:** Add retry button and manual entry fallback form

#### Issue #3: Time Slot Conflicts Not Checked
**Impact:** HIGH - Double-booking risk
**Location:** `/components/TimeSlotPicker.tsx`
**Problem:** Multiple customers can book the same time slot
**Fix Required:** Real-time availability check against dock_appointments table

#### Issue #4: MPS Quote Not Implemented for Outbound
**Impact:** MEDIUM - Feature incomplete
**Location:** `/components/OutboundShipmentWizard.tsx`
**Problem:** Shows "Coming Soon" placeholder, no actual quote creation
**Fix Required:** Implement quote workflow or remove option

#### Issue #5: Missing Admin User Management
**Impact:** MEDIUM - Operational limitation
**Location:** AdminDashboard
**Problem:** Cannot create/edit/deactivate admin accounts from UI
**Fix Required:** Add admin management panel

### Security Issues

#### Issue #6: Public Can Read All Companies
**Impact:** MEDIUM - Information leakage
**Location:** `schema.sql` line 556-559
**Problem:** RLS policy allows unauthenticated read of all companies
**Fix Required:** Restrict to authenticated users

#### Issue #7: Hardcoded Admin Email Allowlist
**Impact:** MEDIUM - Maintenance burden
**Location:** `rls-policies-fix.sql` (multiple locations)
**Problem:** Admin emails hardcoded in policies instead of using admin_users table
**Fix Required:** Refactor all policies to use admin_users table lookup

#### Issue #8: Audit Tables Missing RLS
**Impact:** MEDIUM - Security gap
**Tables:** `admin_audit_log`, `notification_queue`
**Problem:** No RLS enabled, any authenticated user could query
**Fix Required:** Add RLS policies

### Data Validation Issues

#### Issue #9: LSD Format Not Validated
**Impact:** LOW - Data quality
**Location:** Outbound wizard
**Problem:** Accepts any string for Legal Subdivision Description
**Fix Required:** Add regex validation (e.g., `\d{2}-\d{2}-\d{3}-\d{2}W\d`)

#### Issue #10: No Status Transition Validation
**Impact:** MEDIUM - Data integrity
**Location:** Database level
**Problem:** No CHECK constraint preventing invalid transitions
**Fix Required:** Add trigger to validate transitions

### User Experience Issues

#### Issue #11: No Request Edit After Submission
**Impact:** LOW - UX limitation
**Problem:** Cannot edit rejected requests; must create new
**Fix Required:** Allow edit and resubmit for REJECTED status

#### Issue #12: Email Verification Blocking
**Impact:** LOW - Onboarding friction
**Problem:** No "Resend verification email" option visible in UI
**Fix Required:** Add resend button on login screen

---

## 7. Database Integrity Concerns

### Foreign Key Cascade Conflicts

```sql
-- CONFLICT: These rules can create orphaned records
inventory.request_id → storage_requests.id ON DELETE SET NULL
inventory.company_id → companies.id ON DELETE RESTRICT
```

**Risk:** Deleting a storage_request orphans inventory records (request_id=NULL) but company cannot be deleted due to RESTRICT.

### Missing NOT NULL Constraints

| Table | Column | Issue |
|-------|--------|-------|
| storage_requests | approved_by | Should be NOT NULL when status='APPROVED' |
| storage_requests | rejected_at | Should be NOT NULL when status='REJECTED' |

### Index Gaps

| Table | Missing Index | Impact |
|-------|---------------|--------|
| trucking_loads | (direction, status) composite | Slow INBOUND/OUTBOUND queries |
| racks | (capacity, occupied) | Slow "available racks" queries |
| shipment_items | inventory_id | Slow JOIN performance |
| shipment_items | document_id | Slow JOIN performance |

---

## 8. Recommendations

### Immediate (Before Production)

1. **Add Draft Auto-Save**
   - Use localStorage for form state persistence
   - Add "Save Draft" button to wizards
   - Resume from draft on page return

2. **Add Time Slot Availability Check**
   - Query dock_appointments before confirming
   - Show "slot unavailable" if already booked
   - Offer next available slot

3. **Enable RLS on Audit Tables**
   ```sql
   ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;
   CREATE POLICY "Only admins can view audit logs"
     ON admin_audit_log FOR SELECT
     TO authenticated
     USING (EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid()::text));
   ```

4. **Add Manifest Extraction Retry**
   - Add "Retry Extraction" button for FAILED documents
   - Add manual entry form as fallback

### Short-Term (Post-Launch)

5. **Consolidate Admin Checks**
   - Replace all hardcoded email allowlists
   - Use admin_users table as single source of truth

6. **Add Status Transition Validation**
   ```sql
   CREATE OR REPLACE FUNCTION validate_request_status_transition()
   RETURNS TRIGGER AS $$
   BEGIN
     IF OLD.status = 'APPROVED' AND NEW.status = 'PENDING' THEN
       RAISE EXCEPTION 'Cannot transition from APPROVED to PENDING';
     END IF;
     -- Add more transition rules
     RETURN NEW;
   END;
   $$ LANGUAGE plpgsql;
   ```

7. **Implement Outbound MPS Quote**
   - Mirror inbound quote workflow
   - Or remove option from UI

### Long-Term (Enhancement)

8. **Add Admin User Management UI**
   - CRUD for admin_users table
   - Role-based permissions

9. **Add Request Edit Workflow**
   - Allow editing rejected requests
   - Create amendment workflow for approved requests

10. **Performance Optimization**
    - Add missing indexes
    - Refactor RLS policies to use function-based checks

---

## Complete Workflow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CUSTOMER JOURNEY                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────┐    ┌───────────────┐    ┌─────────────┐    ┌──────────────┐  │
│  │  SIGNUP  │───►│ CREATE REQUEST│───►│   PENDING   │───►│   APPROVED   │  │
│  └──────────┘    └───────────────┘    └──────┬──────┘    └──────┬───────┘  │
│       │                                      │                   │          │
│       │ [Slack: New User]    [Slack: New Request]                │          │
│       │                                      │                   │          │
│       │                            [Email: Rejection]            │          │
│       │                                      │                   │          │
│       │                                      ▼                   │          │
│       │                              ┌──────────────┐            │          │
│       │                              │   REJECTED   │            │          │
│       │                              └──────────────┘            │          │
│       │                                                          │          │
│       │                                                          ▼          │
│       │                                              ┌───────────────────┐  │
│       │                                              │ SCHEDULE INBOUND  │  │
│       │                                              │ (InboundWizard)   │  │
│       │                                              └─────────┬─────────┘  │
│       │                                                        │            │
│       │                                    [Slack: Inbound Scheduled]       │
│       │                                                        │            │
│       │                                                        ▼            │
│       │         ┌──────────────────────────────────────────────────────┐   │
│       │         │                  ADMIN REVIEWS LOAD                   │   │
│       │         │  ┌─────────┐   ┌──────────┐   ┌───────────┐          │   │
│       │         │  │Correction│   │  Reject  │   │  Approve  │          │   │
│       │         │  └────┬────┘   └────┬─────┘   └─────┬─────┘          │   │
│       │         │       │             │               │                 │   │
│       │         │  Customer       [Email]         [Email]               │   │
│       │         │  re-uploads    Rejection        Approved              │   │
│       │         └──────────────────────────────────────┬────────────────┘   │
│       │                                                │                    │
│       │                                                ▼                    │
│       │                                    ┌───────────────────┐            │
│       │                                    │    IN_TRANSIT     │            │
│       │                                    │ [Email: En Route] │            │
│       │                                    └─────────┬─────────┘            │
│       │                                              │                      │
│       │                                              ▼                      │
│       │                                    ┌───────────────────┐            │
│       │                                    │    COMPLETED      │            │
│       │                                    │ [Email: Received] │            │
│       │                                    │ Inventory Created │            │
│       │                                    └─────────┬─────────┘            │
│       │                                              │                      │
│       │                                              ▼                      │
│       │                                    ┌───────────────────┐            │
│       │                                    │ SCHEDULE OUTBOUND │            │
│       │                                    │ (OutboundWizard)  │            │
│       │                                    └─────────┬─────────┘            │
│       │                                              │                      │
│       │                                    [Slack: Pickup Scheduled]        │
│       │                                              │                      │
│       │                                              ▼                      │
│       │                                    ┌───────────────────┐            │
│       │                                    │  PICKUP COMPLETE  │            │
│       │                                    │ [Slack: Project   │            │
│       │                                    │  Complete]        │            │
│       │                                    └───────────────────┘            │
│       │                                                                     │
└───────┴─────────────────────────────────────────────────────────────────────┘
```

---

*Document generated: November 2024*
*Version: 1.0*
*Status: Production Readiness Audit Complete*
