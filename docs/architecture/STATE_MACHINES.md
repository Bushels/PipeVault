# Load Lifecycle State Machine Specification

**Version:** 1.0
**Date:** 2025-11-12
**Status:** Canonical Reference - All code must implement this exact specification

---

## State Machine Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        LOAD LIFECYCLE                            │
└─────────────────────────────────────────────────────────────────┘

[Customer Books Load]
         ↓
    ┌────────┐
    │  NEW   │ ← Load created, awaiting admin review
    └────────┘
         ↓
    Admin Reviews Manifest
         ↓
    ┌─────────┬─────────┬─────────────────┐
    ↓         ↓         ↓                 ↓
┌──────────┐ ┌──────────┐ ┌──────────────────┐
│ APPROVED │ │ REJECTED │ │ REQUEST          │
│          │ │          │ │ CORRECTION       │
└──────────┘ └──────────┘ │ (stays NEW)      │
    ↓         (FINAL)    └──────────────────┘
    │                           ↓
    │                    [Customer re-uploads]
    │                           ↓
    │                      [Admin reviews again]
    │                           ↓
    └───────────────────────────┘
                ↓
         [Truck Departs]
         Admin marks departure
                ↓
        ┌──────────────┐
        │  IN_TRANSIT  │ ← Truck en route to MPS
        └──────────────┘
                ↓
         [Truck Arrives]
         Admin marks arrival
                ↓
        ┌──────────────┐
        │  COMPLETED   │ ← Final state
        └──────────────┘
                ↓
        [System Actions:]
        1. Create inventory records
        2. Update rack occupancy
        3. Update request progress
        4. Send completion notification
```

---

## State Definitions

### NEW (Pending Admin Review)
- **Entry Condition:** Customer completes InboundShipmentWizard
- **Database State:** `trucking_loads.status = 'NEW'`
- **Admin View:** Appears in "Pending Loads" tile
- **Customer View:** "Load #X pending confirmation"
- **Valid Transitions:** APPROVED, REJECTED, (stays NEW if correction requested)
- **System Behavior:**
  - Slack notification sent to admin immediately
  - Customer blocked from booking next load
  - Load appears in admin Pending Loads queue
  - Manifest data stored in `trucking_documents.parsed_payload`

### APPROVED (Approved, Awaiting Departure)
- **Entry Condition:** Admin clicks "Approve Load" button
- **Database State:** `trucking_loads.status = 'APPROVED'`
- **Admin View:** Appears in "Approved Loads" tab (awaiting departure)
- **Customer View:** "Load #X approved and scheduled"
- **Valid Transitions:** IN_TRANSIT only
- **System Behavior:**
  - Slack notification sent to customer
  - Customer can now book next load (blocking cleared)
  - Admin can mark as "In Transit" when truck departs
  - Cannot be reverted to NEW

### IN_TRANSIT (Truck En Route)
- **Entry Condition:** Admin marks truck as departed
- **Database State:** `trucking_loads.status = 'IN_TRANSIT'`
- **Admin View:** Appears in "In Transit" tab
- **Customer View:** "Load #X en route to MPS"
- **Valid Transitions:** COMPLETED only
- **System Behavior:**
  - Slack notification sent to customer
  - Admin can mark as "Completed" when truck arrives
  - Cannot be reverted to APPROVED
  - Estimated arrival time shown (from scheduled_slot_end)

### COMPLETED (Arrived and Unloaded)
- **Entry Condition:** Admin marks truck as arrived
- **Database State:** `trucking_loads.status = 'COMPLETED'`
- **Admin View:** Appears in "Completed Loads" (historical)
- **Customer View:** "Load #X stored at MPS"
- **Valid Transitions:** None (final state)
- **System Behavior:**
  - **CRITICAL:** Inventory auto-creation triggered
  - Slack notification sent to customer
  - Rack occupancy updated
  - Request progress totals updated
  - Cannot be changed after completion
  - Total joints stored in `total_joints_completed`

### REJECTED (Load Rejected)
- **Entry Condition:** Admin clicks "Reject Load" with reason
- **Database State:** `trucking_loads.status = 'REJECTED'`
- **Admin View:** Appears in "Rejected Loads" (historical)
- **Customer View:** "Load #X rejected - see reason"
- **Valid Transitions:** None (final state)
- **System Behavior:**
  - Slack notification sent to customer with reason
  - Customer can create new load (fresh booking)
  - Cannot be changed after rejection
  - Rejection reason stored for audit trail

---

## Transition Matrix

| From State   | To State   | Trigger                          | Validation Required                     |
|-------------|-----------|----------------------------------|-----------------------------------------|
| NEW         | APPROVED  | Admin "Approve" button           | Manifest reviewed, time slot valid      |
| NEW         | REJECTED  | Admin "Reject" button + reason   | Reason ≥ 10 characters                  |
| NEW         | NEW       | Admin "Request Correction"       | Issues list provided (≥ 1 issue)        |
| APPROVED    | IN_TRANSIT| Admin "Mark as In Transit"       | None                                    |
| IN_TRANSIT  | COMPLETED | Admin "Mark as Completed"        | Arrival confirmed, inventory data ready |
| COMPLETED   | (none)    | Final state                      | N/A                                     |
| REJECTED    | (none)    | Final state                      | N/A                                     |

**Invalid Transitions (Blocked by Code):**
- APPROVED → NEW (cannot unapprove)
- IN_TRANSIT → APPROVED (cannot reverse transit)
- COMPLETED → anything (immutable)
- REJECTED → anything (immutable)

---

## Data Integrity Rules

### Rule 1: Sequential Blocking
- A storage request can have multiple loads (Load #1, Load #2, Load #3...)
- **Load #N+1 cannot be booked until Load #N status ≥ COMPLETED**
- Rationale: Inventory must be reconciled before next delivery
- Implementation: `usePendingLoadForRequest()` checks for any loads with status < COMPLETED

### Rule 2: Immutable Final States
- Once a load reaches COMPLETED or REJECTED, its status cannot change
- Rationale: Audit trail integrity, inventory already created
- Implementation: `validateTransition()` returns error for final state changes

### Rule 3: State Transition Validation
- All status changes must pass `validateTransition(from, to)` check
- Invalid transitions throw errors before database update
- Implementation: Call validator in all mutation hooks before Supabase update

### Rule 4: Inventory Creation Atomicity
- Inventory creation must happen within COMPLETED transaction
- If inventory creation fails, load status must remain IN_TRANSIT
- Implementation: Database transaction or rollback mechanism

---

## Customer Experience Map

### Booking Flow
```
1. Customer clicks "Schedule Inbound Delivery"
2. Checks for pending loads via usePendingLoadForRequest()
3a. If Load #N pending/in-transit → Show blocking UI
3b. If no pending → Show wizard
4. Customer completes wizard → Load created with status=NEW
5. Customer sees "Load #X pending confirmation"
```

### Waiting for Approval
```
1. Customer dashboard shows "Load #1 pending confirmation"
2. Status badge: Yellow "Pending Review"
3. No action available (waiting for admin)
4. Receives Slack notification when approved
```

### After Approval
```
1. Customer dashboard shows "Load #1 approved and scheduled"
2. Status badge: Blue "Approved"
3. Blocking cleared → Can book Load #2
4. Waits for "in transit" notification
```

### Truck En Route
```
1. Customer dashboard shows "Load #1 en route to MPS"
2. Status badge: Blue "In Transit"
3. Estimated arrival time shown
4. No action available (waiting for arrival)
```

### After Completion
```
1. Customer dashboard shows "Load #1 stored at MPS"
2. Status badge: Green "Stored"
3. Inventory count updated: "48 joints added on Jan 15"
4. Total pipe on site: Updated
5. Can book Load #2 (if not already booked)
```

---

## Admin Experience Map

### Pending Loads Tab (NEW)
```
Display: List of loads with status=NEW
Columns: Load #, Company, Scheduled Date/Time, Joints, Documents
Actions per load:
  - View Details (opens LoadDetailModal)

LoadDetailModal Actions:
  - Approve Load → status: APPROVED
  - Reject Load (with reason) → status: REJECTED
  - Request Correction (with issues) → status: stays NEW
```

### Approved Loads Tab (APPROVED)
```
Display: List of loads with status=APPROVED
Columns: Load #, Company, Scheduled Date/Time, Joints, Time Until Departure
Actions per load:
  - View Details (opens LoadDetailModal)

LoadDetailModal Actions:
  - Mark as In Transit → status: IN_TRANSIT
  - Cancel/Reject (with reason) → status: REJECTED
```

### In Transit Tab (IN_TRANSIT)
```
Display: List of loads with status=IN_TRANSIT
Columns: Load #, Company, Driver, ETA, Joints Expected
Actions per load:
  - View Details (opens LoadDetailModal)

LoadDetailModal Actions:
  - Mark as Completed → status: COMPLETED
    - Opens completion form:
      - Actual joints received (default: planned)
      - Rack assignment (required)
      - Damage notes (optional)
      - Photos (optional)
    - Creates inventory records
    - Updates rack occupancy
```

### Completed Loads Tab (COMPLETED)
```
Display: Historical list of completed loads
Columns: Load #, Company, Completed Date, Joints Received, Rack Location
Actions per load:
  - View Details (read-only modal)
  - Download Manifest
  - View Inventory Records
No status changes allowed (immutable)
```

---

## Notification Events

### Event 1: Load Approved
- **Trigger:** Admin approves load (NEW → APPROVED)
- **Recipients:** Customer (company Slack channel)
- **Message Format:**
  ```
  ✅ Load #1 Approved
  Your delivery has been approved and scheduled.

  Scheduled: Monday, Jan 15 at 9:00 AM
  Driver: John Smith (555-123-4567)
  Expected: 48 joints

  Next steps:
  - Truck will depart on schedule
  - You'll receive notification when in transit
  - Estimated unload time: 2 hours
  ```

### Event 2: Load In Transit
- **Trigger:** Admin marks load as departed (APPROVED → IN_TRANSIT)
- **Recipients:** Customer (company Slack channel)
- **Message Format:**
  ```
  🚛 Load #1 In Transit
  Your delivery is on the way to MPS facility.

  Driver: John Smith (555-123-4567)
  ETA: Monday, Jan 15 at 9:30 AM
  Expected: 48 joints

  We'll notify you when the truck arrives.
  ```

### Event 3: Load Completed
- **Trigger:** Admin marks load as arrived (IN_TRANSIT → COMPLETED)
- **Recipients:** Customer (company Slack channel)
- **Message Format:**
  ```
  ✅ Load #1 Stored at MPS
  Your pipe has been unloaded and stored.

  Received: 48 joints (as expected)
  Storage Location: Rack B-B1-05
  Completed: Monday, Jan 15 at 10:30 AM

  Inventory Summary:
  - Total pipe on site: 48 joints
  - Available capacity: 452 joints remaining

  You can now schedule your next delivery.
  ```

### Event 4: Load Rejected
- **Trigger:** Admin rejects load (NEW → REJECTED)
- **Recipients:** Customer (company Slack channel)
- **Message Format:**
  ```
  ❌ Load #1 Rejected
  Your delivery request could not be approved.

  Reason: Manifest data incomplete - missing heat numbers for 15 joints

  Next steps:
  - Correct the manifest data
  - Re-submit your delivery request
  - Contact us if you need assistance: support@mpsgroup.com
  ```

### Event 5: Correction Requested
- **Trigger:** Admin requests manifest correction (NEW stays NEW)
- **Recipients:** Customer (company Slack channel)
- **Message Format:**
  ```
  ⚠️ Load #1 Needs Correction
  We need you to update your manifest before we can approve.

  Issues found:
  - Missing heat numbers
  - Duplicate serial numbers (3 found)
  - Missing tally lengths

  Please:
  1. Log in to your dashboard
  2. Upload corrected manifest
  3. We'll review and approve quickly
  ```

---

## Database Schema Impact

### trucking_loads Table
```sql
-- Status field drives entire state machine
status: 'NEW' | 'APPROVED' | 'IN_TRANSIT' | 'COMPLETED' | 'REJECTED'

-- Planned values (from manifest extraction)
total_joints_planned: integer
total_length_ft_planned: numeric
total_weight_tonnes_planned: numeric

-- Actual values (set during completion)
total_joints_completed: integer  -- Admin can adjust during completion
total_length_ft_completed: numeric
total_weight_tonnes_completed: numeric

-- Timestamps track lifecycle
created_at: timestamp (when status=NEW)
approved_at: timestamp (when status=APPROVED)
in_transit_at: timestamp (when status=IN_TRANSIT)
completed_at: timestamp (when status=COMPLETED)
```

### inventory Table
```sql
-- Created when load status → COMPLETED
delivery_truck_load_id: uuid (links to trucking_loads.id)
company_id: uuid
storage_request_id: uuid
storage_area_id: uuid (rack assignment - required)

-- Pipe specifications (from manifest)
pipe_type: text
outer_diameter: numeric
wall_thickness: numeric
grade: text
connection_type: text
heat_number: text
serial_number: text
length_meters: numeric

-- Status tracking
status: 'PENDING_DELIVERY' initially
          ↓
       'IN_STORAGE' after completion
          ↓
       'PENDING_PICKUP' when outbound scheduled
          ↓
       'PICKED_UP' when removed

created_at: timestamp (when load completes)
```

### storage_areas Table (Racks)
```sql
-- Updated when inventory created
occupied_count: integer (increments when load completes)
available_count: computed (capacity - occupied_count)

-- Validation during completion:
-- occupied_count + joints_received ≤ capacity
```

---

## Error Handling Scenarios

### Scenario 1: Invalid Transition Attempted
```typescript
// Admin tries to mark COMPLETED load as IN_TRANSIT
const error = validateTransition('COMPLETED', 'IN_TRANSIT');
// Returns: "Cannot change status of a completed load"

// UI shows error toast
// Database update prevented
// Load status unchanged
```

### Scenario 2: Rack Over-Capacity
```typescript
// Admin tries to complete load but rack full
// During completion form validation:
const rackCapacity = 500;
const currentOccupancy = 480;
const incomingJoints = 48;

if (currentOccupancy + incomingJoints > rackCapacity) {
  throw new Error('Rack B-B1-05 at capacity. Select different rack.');
}

// Admin must choose different rack before completing
```

### Scenario 3: Inventory Creation Failure
```typescript
// Load marked COMPLETED but inventory insert fails
try {
  await createInventoryRecords(loadData);
} catch (error) {
  // Rollback: status stays IN_TRANSIT
  // Log error for admin investigation
  // Show error: "Inventory creation failed. Contact support."
  // Load can be retried later
}
```

### Scenario 4: Missing Manifest Data
```typescript
// Admin marks load COMPLETED but no parsed manifest
const parsedData = trucking_documents.parsed_payload;

if (!parsedData || parsedData.length === 0) {
  // Show completion form with manual entry
  // Admin enters: joints, pipe specs, serial numbers
  // System creates inventory from admin input
  // Flag for later manifest audit
}
```

---

## Testing Checklist

### Unit Tests Required
- [ ] `validateTransition()` for all valid transitions
- [ ] `validateTransition()` blocks all invalid transitions
- [ ] `isValidTransition()` returns correct boolean
- [ ] State machine constants match TypeScript types

### Integration Tests Required
- [ ] NEW → APPROVED creates notification
- [ ] APPROVED → IN_TRANSIT updates timestamps
- [ ] IN_TRANSIT → COMPLETED creates inventory
- [ ] COMPLETED load cannot be changed
- [ ] REJECTED load cannot be changed
- [ ] Sequential blocking prevents Load #2 when Load #1 < COMPLETED

### E2E Tests Required
- [ ] Customer books load → Admin approves → Mark in transit → Mark completed → Inventory appears
- [ ] Customer books Load #1 → Blocked from Load #2 → Admin completes Load #1 → Customer can book Load #2
- [ ] Admin rejects load → Customer sees rejection → Customer can create new load
- [ ] Admin requests correction → Customer re-uploads → Admin approves

---

## Performance Considerations

### Database Indexes Required
```sql
-- For admin load queries
CREATE INDEX idx_trucking_loads_status ON trucking_loads(status);
CREATE INDEX idx_trucking_loads_company_status ON trucking_loads(company_id, status);

-- For sequential blocking query
CREATE INDEX idx_trucking_loads_request_status ON trucking_loads(storage_request_id, status);

-- For inventory lookups
CREATE INDEX idx_inventory_load ON inventory(delivery_truck_load_id);
CREATE INDEX idx_inventory_request ON inventory(storage_request_id);
```

### Query Optimization
- Pending loads query: `WHERE status = 'NEW'` (indexed)
- Sequential blocking: `WHERE storage_request_id = ? AND status NOT IN ('COMPLETED', 'REJECTED')` (indexed)
- Customer status: Join trucking_loads with storage_requests (foreign key indexed)

---

## Security Considerations

### RLS Policies
```sql
-- Admin can see all loads
CREATE POLICY admin_all_loads ON trucking_loads
  FOR ALL USING (EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid()));

-- Customer can only see their company's loads
CREATE POLICY customer_own_loads ON trucking_loads
  FOR SELECT USING (company_id IN (
    SELECT company_id FROM company_users WHERE user_id = auth.uid()
  ));
```

### Action Permissions
- **Approve/Reject/Mark Transit/Complete:** Admin only
- **Book Load:** Customer only
- **View Load Details:** Admin (all), Customer (own company only)
- **Modify Completed Load:** Nobody (immutable)

---

## Rollback Procedures

### If Inventory Creation Fails Mid-Flight
1. Database transaction ensures atomic completion
2. If transaction fails, status remains IN_TRANSIT
3. Admin can retry completion after fixing issue
4. No partial inventory records created

### If Admin Marks Wrong Status
- APPROVED by accident → Admin can reject with reason
- IN_TRANSIT by accident → Cannot rollback (notify admin to mark completed ASAP)
- COMPLETED by accident → Cannot rollback (contact support for manual fix)

---

**End of Specification**

All code implementations must reference this document as the canonical source of truth.
