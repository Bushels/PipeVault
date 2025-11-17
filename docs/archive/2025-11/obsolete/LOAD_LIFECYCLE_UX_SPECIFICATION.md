# Load Lifecycle UX Specification

**Version:** 1.0
**Date:** 2025-11-12
**Related:** LOAD_LIFECYCLE_STATE_MACHINE.md, LOAD_LIFECYCLE_DATA_FLOW.md

---

## Overview

This document specifies the exact user experience for both admin and customer interfaces at each state in the load lifecycle. All UI implementations must match these specifications.

---

## Admin Dashboard: Tab Structure

### Tab 1: Pending Loads (status = NEW)
**Purpose:** Admin reviews and approves/rejects new load bookings

**Display:**
- Load #X
- Company name
- Scheduled date/time
- Total joints planned
- Document count
- Time since submission

**Actions:**
- Click load → Opens LoadDetailModal
- Modal actions:
  - Approve Load (green)
  - Reject Load (red)
  - Request Correction (orange)

---

### Tab 2: Approved Loads (status = APPROVED)
**Purpose:** Admin marks when trucks depart

**Display:**
- Load #X
- Company name
- Driver name & phone
- Scheduled departure time
- Countdown to departure
- Total joints

**Actions:**
- Click load → Opens LoadDetailModal
- Modal actions:
  - Mark as In Transit (blue)
  - Cancel/Reject with reason (red)

---

### Tab 3: In Transit (status = IN_TRANSIT)
**Purpose:** Admin marks when trucks arrive and creates inventory

**Display:**
- Load #X
- Company name
- Driver name & phone
- ETA
- Time in transit
- Expected joints

**Actions:**
- Click load → Opens LoadDetailModal
- Modal actions:
  - Mark as Completed (green) → Opens completion form

---

### Tab 4: Completed Loads (status = COMPLETED)
**Purpose:** Historical view of completed deliveries

**Display:**
- Load #X
- Company name
- Completion date
- Joints received (actual)
- Rack location
- Days since completion

**Actions:**
- Click load → Opens LoadDetailModal (read-only)
- Modal actions:
  - Download Manifest (PDF)
  - View Inventory Records
  - View Photos (if uploaded)
- No status changes allowed

---

## Admin: LoadDetailModal Specification

### Header Section (All States)
```
┌──────────────────────────────────────────────────────────┐
│  Load #1 - Acme Drilling Inc.                       [X] │
│  Status: [Badge with color based on status]             │
│  Scheduled: Monday, Jan 15 at 9:00 AM - 11:00 AM        │
└──────────────────────────────────────────────────────────┘
```

**Status Badge Colors:**
- NEW: Yellow background, "Pending Review"
- APPROVED: Blue background, "Approved"
- IN_TRANSIT: Purple background, "In Transit"
- COMPLETED: Green background, "Completed"
- REJECTED: Red background, "Rejected"

---

### Body Section: Tabs

#### Tab 1: Load Details
**Always Visible**

```
┌─────────────────────────────────────────────────┐
│ SCHEDULING                                      │
│ Pickup: 123 Storage Yard Rd, Calgary AB        │
│ Delivery: MPS Facility, [address]              │
│ Date: Monday, January 15, 2025                  │
│ Time: 9:00 AM - 11:00 AM                        │
│ After Hours: No                                 │
│                                                 │
│ TRUCKING COMPANY                                │
│ Company: ABC Trucking Ltd.                      │
│ Driver: John Smith                              │
│ Phone: (555) 123-4567                           │
│                                                 │
│ EXPECTED CARGO                                  │
│ Total Joints: 48 joints                         │
│ Total Length: 1,440 ft                          │
│ Total Weight: 12.5 tonnes                       │
│                                                 │
│ STATUS HISTORY                                  │
│ Created: Jan 10 at 2:30 PM (5 days ago)        │
│ Approved: Jan 11 at 9:15 AM (4 days ago)       │
│ In Transit: Jan 15 at 9:00 AM (2 hours ago)    │
│ Completed: [Not yet completed]                 │
└─────────────────────────────────────────────────┘
```

#### Tab 2: Manifest Data
**Visible if AI extraction succeeded**

```
┌─────────────────────────────────────────────────┐
│ AI EXTRACTED MANIFEST DATA                      │
│                                                 │
│ Extraction Status: ✅ Success (95% confidence) │
│                                                 │
│ [Table View]                                    │
│ Serial # | Heat # | Type | OD | WT | Grade     │
│ ──────────────────────────────────────────────  │
│ 12345    | H9876  | OCTG | 4.5| 0.5| J55       │
│ 12346    | H9876  | OCTG | 4.5| 0.5| J55       │
│ ... (48 rows total)                             │
│                                                 │
│ [Pagination: 1 2 3 4 5 Next]                    │
│                                                 │
│ ⚠️  Issues Detected:                            │
│ - 3 joints missing heat numbers                 │
│ - 1 duplicate serial number (12399)             │
└─────────────────────────────────────────────────┘
```

#### Tab 3: Documents
**Always Visible**

```
┌─────────────────────────────────────────────────┐
│ UPLOADED DOCUMENTS (2 files)                    │
│                                                 │
│ 📄 manifest_jan15.pdf                           │
│    Size: 2.4 MB | Uploaded: Jan 10, 2:30 PM    │
│    [👁️ View] [⬇️ Download]                      │
│                                                 │
│ 📄 bill_of_lading.pdf                           │
│    Size: 1.1 MB | Uploaded: Jan 10, 2:32 PM    │
│    [👁️ View] [⬇️ Download]                      │
└─────────────────────────────────────────────────┘
```

---

### Footer Section: Actions (State-Dependent)

#### When status = NEW
```
┌─────────────────────────────────────────────────┐
│ [Close]  [Request Correction] [Reject] [✅ Approve] │
└─────────────────────────────────────────────────┘
```

#### When status = APPROVED
```
┌─────────────────────────────────────────────────┐
│ [Close]  [Cancel/Reject]  [🚛 Mark as In Transit] │
└─────────────────────────────────────────────────┘
```

#### When status = IN_TRANSIT
```
┌─────────────────────────────────────────────────┐
│ [Close]  [✅ Mark as Completed]                    │
└─────────────────────────────────────────────────┘
```

#### When status = COMPLETED
```
┌─────────────────────────────────────────────────┐
│ [Close]  [📄 Download Manifest]  [📦 View Inventory] │
└─────────────────────────────────────────────────┘
```

#### When status = REJECTED
```
┌─────────────────────────────────────────────────┐
│ [Close]                                         │
│                                                 │
│ ❌ Rejection Reason:                            │
│ "Manifest data incomplete - missing heat        │
│  numbers for 15 joints. Please re-upload       │
│  corrected manifest."                           │
└─────────────────────────────────────────────────┘
```

---

## Admin: Completion Form Modal

**Triggered when:** Admin clicks "Mark as Completed" on IN_TRANSIT load

### Form Layout
```
┌──────────────────────────────────────────────────────────┐
│  Complete Load #1                                    [X] │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  ARRIVAL CONFIRMATION                                    │
│  Arrival Time: [2025-01-15 11:00] [Now]                 │
│                                                          │
│  JOINT COUNT RECONCILIATION                              │
│  Expected Joints: 48 joints (from manifest)              │
│  Actual Joints Received: [48] joints                     │
│                                                          │
│  ⚠️  Discrepancy: 0 joints                               │
│     (If non-zero, requires explanation)                  │
│                                                          │
│  RACK ASSIGNMENT (Required)                              │
│  Yard: [Dropdown: Yard A, Yard B, Yard C]               │
│  Section: [Dropdown: Section B1]                         │
│  Rack: [Dropdown: B-B1-05]                               │
│                                                          │
│  Available Capacity: 452 / 500 joints                    │
│  After This Load: 404 / 500 joints (80% full)           │
│                                                          │
│  DAMAGE ASSESSMENT                                       │
│  Any Damaged Joints? [No ▾] [Yes ▾]                      │
│                                                          │
│  [If Yes selected:]                                      │
│  Number of Damaged Joints: [__] joints                   │
│  Damage Notes:                                           │
│  ┌────────────────────────────────────────┐             │
│  │ [Text area for damage description]     │             │
│  │                                        │             │
│  └────────────────────────────────────────┘             │
│                                                          │
│  Upload Photos (Optional):                               │
│  [📷 Upload Photos] [Drag & drop files here]             │
│                                                          │
│  COMPLETION NOTES (Optional)                             │
│  ┌────────────────────────────────────────┐             │
│  │ [Text area for admin notes]            │             │
│  │ e.g., "Driver arrived early, smooth    │             │
│  │ unload, no issues"                     │             │
│  └────────────────────────────────────────┘             │
│                                                          │
├──────────────────────────────────────────────────────────┤
│  [Cancel]  [✅ Complete & Create Inventory]              │
└──────────────────────────────────────────────────────────┘
```

### Validation Rules
- ✅ Arrival time cannot be in future
- ✅ Actual joints must be > 0
- ✅ Rack must be selected
- ✅ Rack capacity must not be exceeded
- ✅ If damaged joints > 0, damage notes required
- ✅ Discrepancy > 5% triggers warning (not blocker)

### On Submit
1. Show loading spinner: "Creating inventory records..."
2. Database transaction:
   - Update trucking_loads → COMPLETED
   - Insert inventory rows (one per joint)
   - Update storage_areas occupancy
   - Update storage_requests progress
3. On success:
   - Show success toast: "Load #1 completed. 48 joints added to inventory."
   - Close modal
   - Invalidate caches
   - Send Slack notification to customer
4. On error:
   - Show error toast: "Inventory creation failed: [reason]"
   - Keep form open
   - Load status remains IN_TRANSIT
   - Allow retry

---

## Customer Dashboard: Load Status Display

### Location: StorageRequestMenu.tsx (per request card)

#### When status = NEW
```
┌─────────────────────────────────────────────────┐
│ Load #1                                         │
│ Status: 🟡 Pending Confirmation                 │
│ Scheduled: Mon, Jan 15 at 9:00 AM               │
│                                                 │
│ Your delivery is awaiting admin review.        │
│ We'll notify you once approved.                │
└─────────────────────────────────────────────────┘
```

#### When status = APPROVED
```
┌─────────────────────────────────────────────────┐
│ Load #1                                         │
│ Status: 🔵 Approved & Scheduled                 │
│ Departure: Mon, Jan 15 at 9:00 AM (2 days)     │
│                                                 │
│ Driver: John Smith (555-123-4567)              │
│ Expected: 48 joints                             │
│                                                 │
│ We'll notify you when the truck departs.       │
└─────────────────────────────────────────────────┘
```

#### When status = IN_TRANSIT
```
┌─────────────────────────────────────────────────┐
│ Load #1                                         │
│ Status: 🚛 En Route to MPS                      │
│ ETA: Mon, Jan 15 at 11:00 AM (1 hour)          │
│                                                 │
│ Driver: John Smith (555-123-4567)              │
│ Expected: 48 joints                             │
│                                                 │
│ We'll notify you when the truck arrives.       │
└─────────────────────────────────────────────────┘
```

#### When status = COMPLETED
```
┌─────────────────────────────────────────────────┐
│ Load #1                                         │
│ Status: ✅ Stored at MPS                        │
│ Completed: Mon, Jan 15 at 11:30 AM             │
│                                                 │
│ Received: 48 joints                             │
│ Location: Rack B-B1-05                          │
│                                                 │
│ [📦 View Inventory] [📄 Download Manifest]      │
└─────────────────────────────────────────────────┘
```

#### When status = REJECTED
```
┌─────────────────────────────────────────────────┐
│ Load #1                                         │
│ Status: ❌ Rejected                             │
│                                                 │
│ Reason: Manifest data incomplete - missing      │
│ heat numbers for 15 joints.                     │
│                                                 │
│ [🔄 Schedule New Delivery]                      │
└─────────────────────────────────────────────────┘
```

---

## Customer Dashboard: Timeline View

### Location: New component - LoadTimelineView.tsx

**Display:** Vertical timeline showing all loads for a request

```
┌──────────────────────────────────────────────────────────┐
│  Delivery Timeline - Request #SR-2025-001                │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  ✅ Load #1 - COMPLETED                                  │
│     ├─ Booked: Jan 10 at 2:30 PM                        │
│     ├─ Approved: Jan 11 at 9:15 AM                      │
│     ├─ In Transit: Jan 15 at 9:00 AM                    │
│     └─ Completed: Jan 15 at 11:30 AM                    │
│        📦 48 joints stored in Rack B-B1-05               │
│                                                          │
│  🔵 Load #2 - APPROVED                                   │
│     ├─ Booked: Jan 15 at 12:00 PM                       │
│     ├─ Approved: Jan 15 at 2:00 PM                      │
│     └─ Departure: Jan 20 at 9:00 AM (5 days)            │
│        Expected: 52 joints                               │
│                                                          │
│  ⏳ Load #3 - Available                                  │
│     [🚛 Schedule Next Delivery]                          │
│                                                          │
│  SUMMARY                                                 │
│  Total Delivered: 48 / 150 joints (32%)                 │
│  Total On Site: 48 joints                               │
│  Remaining: 102 joints                                   │
└──────────────────────────────────────────────────────────┘
```

---

## Customer Dashboard: Inventory Summary

### Location: Dashboard.tsx - Inventory Tile

**Before any loads completed:**
```
┌─────────────────────────────────────────────────┐
│ 📦 My Inventory                                 │
│                                                 │
│ No pipe in storage yet                          │
│                                                 │
│ Schedule your first delivery to start storing  │
│ pipe at MPS.                                    │
│                                                 │
│ [🚛 Schedule Delivery]                          │
└─────────────────────────────────────────────────┘
```

**After loads completed:**
```
┌─────────────────────────────────────────────────┐
│ 📦 My Inventory                                 │
│                                                 │
│ Total Pipe On Site: 48 joints                  │
│ Total Length: 1,440 ft                          │
│ Total Weight: 12.5 tonnes                       │
│                                                 │
│ BREAKDOWN BY REQUEST                            │
│ SR-2025-001: 48 joints (32% complete)          │
│   └─ Rack B-B1-05: 48 joints                   │
│                                                 │
│ [📦 View Full Inventory] [🚛 Schedule Pickup]   │
└─────────────────────────────────────────────────┘
```

---

## Customer: Sequential Blocking UI

### Location: InboundShipmentWizard.tsx - Time Slot Step

**When Load #1 status < COMPLETED:**
```
┌──────────────────────────────────────────────────────────┐
│  ⚠️  Load #1 Pending Admin Approval                      │
│                                                          │
│  Your previous load is awaiting admin review and        │
│  approval. You can schedule Load #2 after Load #1 has   │
│  been approved.                                          │
│                                                          │
│  PENDING LOAD DETAILS                                    │
│  ┌────────────────────────────────────────────────┐     │
│  │ Load Number: #1                                │     │
│  │ Scheduled: Monday, Jan 15 at 9:00 AM           │     │
│  │ Status: 🟡 Pending Review                      │     │
│  │ Expected: 48 joints                            │     │
│  └────────────────────────────────────────────────┘     │
│                                                          │
│  WHAT HAPPENS NEXT?                                      │
│  1. MPS admin will review your manifest                 │
│  2. You'll receive a Slack notification once approved   │
│  3. After approval, you can return here to schedule     │
│     your next load                                       │
│                                                          │
│  [Return to Dashboard]                                   │
└──────────────────────────────────────────────────────────┘
```

**Updated Rule:** Block until status = COMPLETED (not just APPROVED)

```typescript
// Old blocking logic (WRONG)
const hasPendingLoad = loads.some(load => load.status === 'NEW');

// New blocking logic (CORRECT)
const hasIncompleteLoad = loads.some(load =>
  !['COMPLETED', 'REJECTED'].includes(load.status)
);
```

**Rationale:** Inventory must be reconciled before next truck arrival

---

## Notification Specifications

### Slack Notification: Load Approved
**Channel:** Customer company channel
**Format:**
```
✅ Load #1 Approved

Your delivery has been approved and scheduled.

📅 Scheduled: Monday, Jan 15 at 9:00 AM
🚛 Driver: John Smith (555-123-4567)
📦 Expected: 48 joints

Next steps:
• Truck will depart on schedule
• You'll receive notification when in transit
• Estimated unload time: 2 hours

Questions? Reply in this channel or contact support@mpsgroup.com
```

### Slack Notification: Load In Transit
**Channel:** Customer company channel
**Format:**
```
🚛 Load #1 In Transit

Your delivery is on the way to MPS facility.

🚛 Driver: John Smith (555-123-4567)
📍 ETA: Monday, Jan 15 at 11:00 AM
📦 Expected: 48 joints

We'll notify you when the truck arrives and unloading is complete.

Track your delivery status in your dashboard: https://app.mpsgroup.com
```

### Slack Notification: Load Completed
**Channel:** Customer company channel
**Format:**
```
✅ Load #1 Stored at MPS

Your pipe has been unloaded and stored.

📦 Received: 48 joints (as expected)
📍 Location: Rack B-B1-05
🕐 Completed: Monday, Jan 15 at 11:30 AM

INVENTORY SUMMARY
• Total pipe on site: 48 joints
• Available capacity: 452 joints remaining
• Request progress: 48 / 150 joints (32%)

You can now schedule your next delivery: https://app.mpsgroup.com

Questions? Contact us at support@mpsgroup.com
```

---

## Mobile Responsiveness

### Admin Dashboard (Tablet/Mobile)
- Tabs stack vertically on mobile
- Load cards full-width
- Modal scrollable
- Actions stack vertically
- Table views convert to card views

### Customer Dashboard (Mobile)
- Load timeline collapses to accordion
- Status badges remain visible
- Actions move to bottom sheet
- Inventory summary shows key metrics only
- Full details on tap/expand

---

## Accessibility Requirements

### Color Blindness
- Status badges use icons + color
- Critical actions have text labels
- Error states have clear text descriptions

### Screen Readers
- Status announcements: "Load number 1, status: pending review"
- Action buttons: "Approve load number 1"
- Timeline: "Load 1 completed on January 15 at 11:30 AM"

### Keyboard Navigation
- Tab through all interactive elements
- Enter/Space to activate buttons
- Escape to close modals
- Arrow keys for dropdown navigation

---

## Loading States

### Admin: Approving Load
```
Button text: "Approving..."
Button disabled: true
Spinner icon: Visible
```

### Admin: Marking In Transit
```
Button text: "Updating..."
Button disabled: true
Spinner icon: Visible
```

### Admin: Completing Load
```
Modal overlay: Semi-transparent with spinner
Text: "Creating inventory records..."
Progress: "48 / 48 joints processed"
```

### Customer: Checking Blocking
```
Time slot picker: Hidden
Spinner: "Checking for pending loads..."
```

---

## Error States

### Admin: Approval Failed
```
┌─────────────────────────────────────────────────┐
│ ❌ Failed to approve load                       │
│                                                 │
│ Error: Database connection lost                │
│                                                 │
│ [Retry] [Cancel]                                │
└─────────────────────────────────────────────────┘
```

### Admin: Inventory Creation Failed
```
┌─────────────────────────────────────────────────┐
│ ❌ Inventory creation failed                    │
│                                                 │
│ Error: Duplicate serial number detected (12399)│
│                                                 │
│ Load status remains IN_TRANSIT. Please fix the │
│ manifest data and try again.                    │
│                                                 │
│ [Edit Manifest] [Retry Completion]              │
└─────────────────────────────────────────────────┘
```

### Customer: Booking Failed
```
┌─────────────────────────────────────────────────┐
│ ❌ Failed to create load                        │
│                                                 │
│ Error: Selected time slot is no longer available│
│                                                 │
│ Please select a different time slot.           │
│                                                 │
│ [Back to Time Selection]                        │
└─────────────────────────────────────────────────┘
```

---

**End of UX Specification**

All UI implementations must match these exact specifications for consistency and user experience.
