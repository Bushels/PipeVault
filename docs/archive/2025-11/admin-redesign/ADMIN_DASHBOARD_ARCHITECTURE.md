# Admin Dashboard Architecture

**Version:** 2.0 (November 2025)
**Status:** Production-Ready
**Architecture:** Tile-Based with Atomic Approval Workflow

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Tile-Based Architecture](#tile-based-architecture)
3. [Atomic Approval Workflow](#atomic-approval-workflow)
4. [Project Summaries RPC System](#project-summaries-rpc-system)
5. [React Query Integration](#react-query-integration)
6. [Workflow State Machine](#workflow-state-machine)
7. [Admin Dashboard Data Flow](#admin-dashboard-data-flow)
8. [Security & Authorization](#security--authorization)
9. [Audit Logging](#audit-logging)
10. [Migration History](#migration-history)
11. [Troubleshooting Guide](#troubleshooting-guide)
12. [Performance Optimization](#performance-optimization)

---

## Executive Summary

The Roughneck Operations admin dashboard underwent a complete architectural redesign in November 2025, transitioning from a tab-based interface to a **tile-based carousel system** with **atomic approval workflows** powered by PostgreSQL stored procedures.

### Key Improvements

1. **Atomic Approval Workflow**
   - PostgreSQL stored procedures with ACID transaction guarantees
   - Server-side capacity validation BEFORE any database updates
   - Automatic rollback on any failure (no partial state)
   - Audit logging and notification queuing in same transaction

2. **Tile-Based Admin Dashboard**
   - Company-centric tiles (600×480px) with status-based glows
   - Horizontal scrolling carousel with wheel/touch support
   - Real-time updates via React Query and Supabase subscriptions
   - Lazy-loading of detailed data (summaries first, details on-demand)

3. **Project-Centric Data Model**
   - Single RPC function (`get_project_summaries_by_company()`) replaces N+1 queries
   - Nested JSON aggregation (company → projects → loads → documents)
   - AI-extracted manifest data included in load documents
   - Workflow state calculation (8 states from PENDING → COMPLETE)

4. **Performance Enhancements**
   - 151 queries → 1 query for 50 companies (99.3% reduction)
   - 9 database indexes for optimized joins
   - React Query caching (30s stale time, 60s polling)
   - Realtime subscriptions for instant UI updates

---

## Tile-Based Architecture

### Overview

The new admin dashboard uses a **tile-based carousel layout** inspired by modern dashboard UIs (e.g., Apple Home, Google Analytics). Each company gets a single tile displaying key metrics and recent activity.

### Layout Structure

```
┌─────────────────────────────────────────────────────────────┐
│  ADMIN DASHBOARD                                             │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  Company Overview                     Scroll to view all → │
│  ┌───────────┐  ┌───────────┐  ┌───────────┐              │
│  │  TILE 1   │  │  TILE 2   │  │  TILE 3   │  ...         │
│  │ (600x480) │  │ (600x480) │  │ (600x480) │              │
│  └───────────┘  └───────────┘  └───────────┘              │
│  ◄ ───────────────────────────────────────── ►             │
│                                                               │
│  [Selected Company Details Appear Below]                    │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

### Tile Components

All tile components are located in `components/admin/tiles/`:

#### 1. **CompanyTileCarousel.tsx**

**Purpose:** Horizontal scrolling container for company tiles

**Features:**
- Wheel scroll support (vertical mouse wheel → horizontal scroll)
- Prev/Next navigation buttons
- Touch/swipe support on mobile
- Keyboard navigation (arrow keys)
- Snap-to-tile scrolling
- Responsive breakpoints:
  - Desktop (>1024px): 2-3 tiles visible
  - Tablet (640-1024px): 1.5 tiles visible
  - Mobile (<640px): 1 tile visible

**Data Source:** `useCompanySummaries()` hook

**Code Example:**
```tsx
<CompanyTileCarousel
  onCompanyClick={(companyId) => setSelectedCompanyId(companyId)}
  selectedCompanyId={selectedCompanyId}
/>
```

#### 2. **CompanyTile.tsx**

**Purpose:** Individual company summary card (600×480px)

**Layout Sections:**
- **Header (80px):** Company name + status indicator
- **Stats Grid (200px):** 2×2 metrics grid
  - Pending Requests (yellow if > 0)
  - Approved Projects (green)
  - Trucking Loads (blue)
  - Inventory Items (purple)
- **Activity Feed (140px):** Last 3 activities
- **Actions (60px):** "View Details" + "Quick Approve" buttons

**Visual States:**
- **Default:** Neutral cyan glow
- **Has Pending:** Yellow glow (alerts admin)
- **Selected:** Cyan border highlight
- **Hover:** 3D glow effect (elevation)

**Code Example:**
```tsx
<CompanyTile
  company={companySummary}
  onClick={() => handleCompanyClick(company.id)}
  isSelected={selectedCompanyId === company.id}
/>
```

#### 3. **CompanyTileHeader.tsx**

**Purpose:** Company info with status badge and requester identity

**Displays:**
- Company name (truncated at 24 chars)
- Company domain
- Status badge (yellow pulsing dot if pending approvals)
- Company logo placeholder
- **NEW: Requester identity card (when pending requests exist)**
  - Customer name (from `auth.users.raw_user_meta_data`)
  - Customer email
  - "Latest pending request" label
  - Yellow-themed box to match pending state visual language

**Layout:**
```
┌─────────────────────────────────────┐
│ [Icon] Company Name        [●]      │  ← Status dot (pulsing yellow)
│        company@domain.com           │
├─────────────────────────────────────┤
│ [👤] John Smith                     │  ← Requester card (yellow theme)
│      john.smith@customer.com        │
│      Latest pending request         │
└─────────────────────────────────────┘
```

**Data Source:**
- `lastRequesterName` and `lastRequesterEmail` from `CompanySummary` type
- Populated by `get_company_summaries()` RPC function
- Shows most recent pending request requester (DISTINCT ON created_at DESC)

**Graceful Degradation:**
- If `lastRequesterName` is NULL, falls back to email username
- If both are NULL, shows "Unknown User" (edge case)
- Requester card only renders when `pendingRequests > 0` AND requester data exists

#### 4. **CompanyTileStats.tsx**

**Purpose:** 2×2 metrics grid

**Metrics Displayed:**
1. **Pending Requests:** Count of `status='PENDING'` projects
2. **Approved Projects:** Count of `status='APPROVED'` projects
3. **Trucking Loads:** Total inbound + outbound loads
4. **Inventory Items:** Total joints in storage

**Visual Design:**
- Each metric has icon + count + label
- Color-coded by status (yellow for pending, green for approved, etc.)
- Animated count-up on load (optional)

#### 5. **CompanyTileActions.tsx**

**Purpose:** Action buttons for admin workflow

**Buttons:**
1. **View Details:** Opens company detail panel
2. **Quick Approve:** Opens approval modal for first pending request

**Interaction:**
- Buttons use `e.stopPropagation()` to prevent tile click bubbling
- Disabled states when no pending requests

### Responsive Behavior

**Desktop (>1024px):**
```
[ Tile 1 ][ Tile 2 ][ Tile 3 ]
          ← Prev    Next →
```

**Tablet (640-1024px):**
```
[ Tile 1 ][Tile 2]
    ← Prev  Next →
```

**Mobile (<640px):**
```
[    Tile 1    ]
   Scroll dots
      • • •
```

### Performance Considerations

1. **Lazy Loading:** Tile carousel loads summaries first (lightweight), then details on-demand
2. **Virtualization:** Not currently implemented (max 50 companies), but could use `react-window` if scaling beyond 100 companies
3. **Image Optimization:** Company logos use `loading="lazy"` attribute
4. **Debounced Scroll:** Scroll buttons have 200ms debounce to prevent rapid firing

---

## Atomic Approval Workflow

### Architecture

The approval workflow uses **PostgreSQL stored procedures** with `SECURITY DEFINER` to ensure **ACID transaction guarantees**. All operations (status update, rack assignment, inventory creation, notifications) succeed together or fail together.

### Database Functions

#### 1. **approve_storage_request_atomic()**

**Purpose:** Atomically approve a storage request with rack assignment

**Parameters:**
- `p_request_id` (UUID): Storage request ID
- `p_assigned_rack_ids` (UUID[]): Array of rack IDs to assign
- `p_required_joints` (INTEGER): Total joints to store
- `p_notes` (TEXT, optional): Admin notes
- `p_admin_user_id` (TEXT, optional): Admin user ID (defaults to `auth.uid()`)

**Returns:** JSON object with approval result:
```json
{
  "success": true,
  "requestId": "uuid",
  "referenceId": "REF-001",
  "status": "APPROVED",
  "assignedRacks": ["A-A1-10", "A-A1-11"],
  "requiredJoints": 100,
  "availableCapacity": 50,
  "message": "Request REF-001 approved successfully. Assigned to racks: A-A1-10, A-A1-11"
}
```

**Transaction Steps:**

```sql
BEGIN TRANSACTION;  -- Implicit in PostgreSQL function

-- 1. Security check
IF NOT is_admin_user() THEN
  RAISE EXCEPTION 'Access denied';
END IF;

-- 2. Validate request exists and is PENDING
SELECT company_id, reference_id, status
INTO v_company_id, v_reference_id, v_current_status
FROM storage_requests
WHERE id = p_request_id;

IF v_current_status != 'PENDING' THEN
  RAISE EXCEPTION 'Request not pending';
END IF;

-- 3. Validate rack capacity BEFORE any updates
FOR v_rack_record IN
  SELECT id, name, capacity, occupied
  FROM storage_areas
  WHERE id = ANY(p_assigned_rack_ids)
LOOP
  v_available_capacity := v_available_capacity + (v_rack_record.capacity - v_rack_record.occupied);
END LOOP;

IF v_available_capacity < p_required_joints THEN
  RAISE EXCEPTION 'Insufficient capacity';  -- Rollback triggered
END IF;

-- 4. Update request status
UPDATE storage_requests
SET status = 'APPROVED',
    assigned_rack_ids = p_assigned_rack_ids,
    admin_notes = p_notes,
    updated_at = NOW()
WHERE id = p_request_id;

-- 5. Update rack occupancy
UPDATE storage_areas
SET occupied = occupied + (distributed_joints),
    updated_at = NOW()
WHERE id = ANY(p_assigned_rack_ids);

-- 6. Create audit log entry
INSERT INTO admin_audit_log (
  admin_user_id, action, entity_type, entity_id, details
) VALUES (
  COALESCE(p_admin_user_id, auth.uid()::text),
  'APPROVE_REQUEST',
  'storage_request',
  p_request_id,
  json_build_object(...)
);

-- 7. Queue email notification
INSERT INTO notification_queue (
  notification_type, recipient_email, subject, payload, status
) VALUES (
  'storage_request_approved',
  v_company_email,
  'Storage Request Approved - ' || v_reference_id,
  json_build_object(...),
  'PENDING'
);

COMMIT;  -- All operations succeed or all rollback
```

**Error Handling:**

| Error Type | User-Facing Message |
|------------|---------------------|
| Access denied | "Admin privileges required to approve requests." |
| Request not found | "Storage request not found." |
| Request already approved | "Request has already been approved or rejected." |
| Insufficient capacity | "Rack capacity exceeded: 100 joints required, 50 available across racks: A-A1-10" |
| Invalid rack IDs | "One or more rack IDs are invalid" |

#### 2. **reject_storage_request_atomic()**

**Purpose:** Atomically reject a storage request with reason

**Parameters:**
- `p_request_id` (UUID): Storage request ID
- `p_rejection_reason` (TEXT): Reason for rejection (required)
- `p_notes` (TEXT, optional): Additional admin notes
- `p_admin_user_id` (TEXT, optional): Admin user ID

**Returns:** JSON object with rejection result:
```json
{
  "success": true,
  "requestId": "uuid",
  "referenceId": "REF-001",
  "status": "REJECTED",
  "rejectionReason": "Insufficient capacity at this time",
  "message": "Request REF-001 rejected successfully"
}
```

**Transaction Steps:**
1. Security check (`is_admin_user()`)
2. Validate request is PENDING
3. Update request status to REJECTED
4. Set rejection reason
5. Create audit log entry
6. Queue rejection email notification

**Note:** Rejection does NOT update rack occupancy (no capacity was reserved).

---

## Approval Flow (Step-by-Step)

### User Journey: Admin Approves Storage Request

#### Step 1: Admin Views Pending Request

**UI Location:** Pending Approvals tile OR Approvals tab

**Data Displayed:**
- Customer company name
- Reference ID (e.g., "REF-001")
- Pipe specifications:
  - Grade (e.g., "L80")
  - Connection type with thread (e.g., "EUE 8RD")
  - Size (e.g., "5.5")
  - Weight (e.g., "17.00 lb/ft")
  - Quantity (e.g., "150 joints")
- Storage duration (e.g., "90 days")
- Trucking preferences (e.g., "Company XYZ, Contact: John Doe")
- AI-generated summary (if available)

#### Step 2: Admin Selects Rack(s)

**UI Component:** Multi-select dropdown or rack picker

**Logic:**
- Shows available racks with capacity info
- Displays: "Rack A-A1-10 (50/100 joints available)"
- Supports multi-rack selection for large loads
- Calculates total available capacity across selected racks

**Validation (Client-Side):**
```tsx
const totalAvailable = selectedRacks.reduce(
  (sum, rack) => sum + (rack.capacity - rack.occupied),
  0
);

if (totalAvailable < requiredJoints) {
  toast.error('Selected racks have insufficient capacity');
  return;
}
```

#### Step 3: Admin Enters Notes (Optional)

**UI Component:** Textarea input

**Example Notes:**
- "Approved for 90-day storage in Area A"
- "Customer requested specific rack location"
- "Expedited approval due to time constraints"

#### Step 4: Admin Clicks "Approve" Button

**UI State:** Button shows loading spinner, disabled during mutation

```tsx
<Button
  onClick={handleApprove}
  disabled={approveRequest.isPending}
  variant="primary"
>
  {approveRequest.isPending ? 'Approving...' : 'Approve Request'}
</Button>
```

#### Step 5: Frontend Calls `useApproveRequest()` Hook

**Code Example:**
```tsx
const approveRequest = useApproveRequest();

const handleApprove = async () => {
  try {
    const result = await approveRequest.mutateAsync({
      requestId: request.id,
      assignedRackIds: selectedRacks.map(r => r.id),
      requiredJoints: request.pipeDetails.totalJointsEstimate,
      notes: adminNotes || undefined,
    });

    toast.success(`Request ${result.referenceId} approved!`);
  } catch (error) {
    toast.error(error.message);
  }
};
```

#### Step 6: Hook Invokes `approve_storage_request_atomic()` RPC

**Supabase RPC Call:**
```tsx
const { data, error } = await supabase.rpc('approve_storage_request_atomic', {
  p_request_id: request.requestId,
  p_assigned_rack_ids: request.assignedRackIds,
  p_required_joints: request.requiredJoints,
  p_notes: request.notes || null,
});
```

#### Step 7: Server-Side Atomic Transaction Executes

**Database Operations (All-or-Nothing):**

| Operation | Table | Action |
|-----------|-------|--------|
| 1 | `storage_requests` | Update `status = 'APPROVED'` |
| 2 | `storage_requests` | Set `assigned_rack_ids` |
| 3 | `storage_requests` | Set `admin_notes` |
| 4 | `storage_areas` | Increment `occupied` for each rack |
| 5 | `admin_audit_log` | Insert approval record |
| 6 | `notification_queue` | Insert email notification |

**SQL Executed:**
```sql
-- Operation 1-3: Update request
UPDATE storage_requests
SET status = 'APPROVED',
    assigned_rack_ids = ARRAY['rack-uuid-1', 'rack-uuid-2'],
    admin_notes = 'Approved for 90-day storage',
    updated_at = NOW()
WHERE id = 'request-uuid';

-- Operation 4: Update racks (example: 100 joints split evenly across 2 racks)
UPDATE storage_areas
SET occupied = occupied + 50,
    updated_at = NOW()
WHERE id = 'rack-uuid-1';

UPDATE storage_areas
SET occupied = occupied + 50,
    updated_at = NOW()
WHERE id = 'rack-uuid-2';

-- Operation 5: Audit log
INSERT INTO admin_audit_log (
  admin_user_id, action, entity_type, entity_id, details, created_at
) VALUES (
  'admin-uuid',
  'APPROVE_REQUEST',
  'storage_request',
  'request-uuid',
  '{"referenceId": "REF-001", "assignedRacks": ["A-A1-10", "A-A1-11"], ...}',
  NOW()
);

-- Operation 6: Notification queue
INSERT INTO notification_queue (
  notification_type, recipient_email, subject, payload, status, created_at
) VALUES (
  'storage_request_approved',
  'customer@example.com',
  'Storage Request Approved - REF-001',
  '{"referenceId": "REF-001", "assignedRacks": ["A-A1-10", "A-A1-11"], ...}',
  'PENDING',
  NOW()
);
```

#### Step 8: Transaction Commits or Rolls Back

**Success Scenario:**
- All 6 operations succeed
- Transaction commits
- Database state updated
- Function returns success JSON

**Failure Scenario (e.g., Capacity Check Fails):**
```sql
-- Example: Rack at capacity
IF v_available_capacity < p_required_joints THEN
  RAISE EXCEPTION 'Insufficient capacity: 100 joints required, 50 available';
  -- PostgreSQL automatically rolls back ALL operations
  -- NO partial state (request still PENDING, racks unchanged)
END IF;
```

#### Step 9: Frontend Invalidates React Query Cache

**Code in `useApprovalWorkflow.ts`:**
```tsx
onSuccess: (result, request) => {
  // Invalidate ALL project summaries to refetch fresh data
  queryClient.invalidateQueries({ queryKey: ['projectSummaries'] });

  // Optionally invalidate specific company for faster update
  if (result.companyId) {
    queryClient.invalidateQueries({
      queryKey: ['projectSummaries', 'company', result.companyId],
    });
  }
}
```

#### Step 10: UI Updates Immediately

**React Query Behavior:**
1. Cache invalidation triggers automatic refetch of `useProjectSummaries()`
2. RPC function `get_project_summaries_by_company()` executes
3. New data includes approved request with updated status
4. Company tile re-renders with updated metrics
5. Pending count decreases by 1
6. Approved count increases by 1

**UI Changes:**
- Pending Approvals badge: `3 → 2`
- Company tile glow: Yellow → Cyan (no more pending)
- Request status badge: "Pending Approval" → "Waiting on Load #1"
- Success toast: "Request REF-001 approved!"

#### Step 11: Customer Receives Email Notification

**Email Sent By:** Background notification worker (Edge Function or cron job)

**Email Content:**
```
Subject: Storage Request Approved - REF-001

Dear Customer,

Your storage request REF-001 has been approved by Roughneck Operations.

Assigned Racks:
- Rack A-A1-10
- Rack A-A1-11

Total Capacity Allocated: 100 joints

Next Steps:
1. Schedule your first delivery load via the Customer Portal
2. Upload your trucking manifest documents
3. Coordinate with our yard operations team

Questions? Contact us at operations@roughneckops.com

Thank you,
Roughneck Operations Team
```

**Email Service:** Resend API (configured via `.env` variable `RESEND_API_KEY`)

---

## Rejection Workflow

### User Journey: Admin Rejects Storage Request

#### Step 1: Admin Views Pending Request

Same as approval workflow (see above).

#### Step 2: Admin Clicks "Reject" Button

**UI Component:** Red "Reject" button in request details panel

#### Step 3: Modal Opens for Rejection Reason Entry

**Modal UI:**
```
┌─────────────────────────────────────────┐
│  Reject Storage Request                 │
├─────────────────────────────────────────┤
│                                          │
│  Request: REF-001                        │
│  Company: Apex Drilling                  │
│                                          │
│  Rejection Reason (Required):           │
│  ┌────────────────────────────────────┐ │
│  │ Insufficient capacity for requested│ │
│  │ storage duration. Please contact   │ │
│  │ us to discuss alternatives.        │ │
│  └────────────────────────────────────┘ │
│                                          │
│  Internal Notes (Optional):             │
│  ┌────────────────────────────────────┐ │
│  │ Customer requested 6-month storage,│ │
│  │ but we're at capacity.             │ │
│  └────────────────────────────────────┘ │
│                                          │
│  [Cancel]  [Confirm Rejection]          │
└─────────────────────────────────────────┘
```

#### Step 4: Admin Enters Rejection Reason (Required)

**Validation:**
- Rejection reason must be at least 10 characters
- Cannot be empty or whitespace-only

#### Step 5: Admin Clicks "Confirm Rejection"

**Frontend Calls:**
```tsx
const rejectRequest = useRejectRequest();

const handleReject = async () => {
  try {
    const result = await rejectRequest.mutateAsync({
      requestId: request.id,
      rejectionReason: rejectionReasonInput,
      notes: internalNotesInput || undefined,
    });

    toast.success('Request rejected. Customer has been notified.');
    closeModal();
  } catch (error) {
    toast.error(error.message);
  }
};
```

#### Step 6: Server-Side Atomic Transaction

**Database Operations:**

| Operation | Table | Action |
|-----------|-------|--------|
| 1 | `storage_requests` | Update `status = 'REJECTED'` |
| 2 | `storage_requests` | Set `rejection_reason` |
| 3 | `storage_requests` | Set `admin_notes` (if provided) |
| 4 | `admin_audit_log` | Insert rejection record |
| 5 | `notification_queue` | Insert rejection email |

**Note:** NO rack updates (capacity was never allocated).

#### Step 7: UI Updates

- Pending Approvals count: `3 → 2`
- Request status badge: "Pending Approval" → "Rejected" (red)
- Request moves to "Rejected" filter in Requests tab
- Success toast shown

#### Step 8: Customer Receives Rejection Email

**Email Content:**
```
Subject: Storage Request Rejected - REF-001

Dear Customer,

We regret to inform you that your storage request REF-001 has been rejected.

Reason for Rejection:
Insufficient capacity for requested storage duration. Please contact us to discuss alternatives.

If you have questions or would like to discuss alternative options, please contact us at operations@roughneckops.com.

Thank you for your understanding,
Roughneck Operations Team
```

---

## Project Summaries RPC System

### RPC Function: `get_project_summaries_by_company()`

**Purpose:** Returns nested project data grouped by company for admin dashboard tiles.

**Access Control:** Admin-only (uses `is_admin_user()` security check)

**File Location:** `c:\Users\kyle\MPS\PipeVault\supabase\migrations\20251109000001_FINAL_CORRECTED.sql`

### Response Structure

```typescript
[
  {
    company: {
      id: "uuid",
      name: "Apex Drilling",
      domain: "apexdrilling.com",
      contactEmail: "contact@apexdrilling.com",
      contactPhone: "+1-555-0100"
    },
    projects: [
      {
        id: "uuid",
        referenceId: "REF-001",
        status: "APPROVED",
        submittedBy: "user@apexdrilling.com",
        contactEmail: "user@apexdrilling.com",
        contactPhone: "+1-555-0101",
        createdAt: "2025-11-01T10:00:00Z",
        updatedAt: "2025-11-02T14:30:00Z",

        pipeDetails: {
          pipeType: "Tubing",
          pipeGrade: "L80",
          outerDiameter: 5.5,
          connectionType: "EUE 8RD",
          totalJointsEstimate: 150,
          storageStartDate: "2025-11-15",
          estimatedDuration: 3,
          specialHandling: "Temperature-controlled storage required"
        },

        inboundLoads: [
          {
            id: "uuid",
            sequenceNumber: 1,
            status: "COMPLETED",
            scheduledSlotStart: "2025-11-15T08:00:00Z",
            scheduledSlotEnd: "2025-11-15T09:00:00Z",
            totalJointsPlanned: 75,
            totalJointsCompleted: 75,
            totalWeightLbsPlanned: 10000,
            totalWeightLbsCompleted: 10050,
            approvedAt: "2025-11-14T10:00:00Z",
            completedAt: "2025-11-15T08:45:00Z",
            truckingCompany: "ABC Trucking",
            contactName: "John Doe",
            contactPhone: "+1-555-0200",
            notes: "Load arrived on time, manifest verified",

            documents: [
              {
                id: "uuid",
                fileName: "manifest-load1.pdf",
                storagePath: "documents/manifests/...",
                documentType: "manifest",
                parsedPayload: [
                  {
                    pipeType: "Tubing",
                    pipeGrade: "L80",
                    outerDiameter: 5.5,
                    connection: "EUE",
                    threadType: "8RD",
                    weight: 17.0,
                    quantity: 75,
                    totalLengthFt: 2250.0
                  }
                ],
                uploadedBy: "user@apexdrilling.com",
                uploadedAt: "2025-11-15T09:00:00Z"
              }
            ],

            assignedRacks: [
              {
                rackId: "uuid",
                rackName: "A-A1-10",
                jointCount: 75,
                totalLengthFt: 2250.0,
                totalWeightLbs: 10050,
                statuses: ["IN_STORAGE"],
                assignedAt: "2025-11-15T09:00:00Z",
                lastUpdated: "2025-11-15T09:00:00Z"
              }
            ]
          },
          {
            id: "uuid",
            sequenceNumber: 2,
            status: "SCHEDULED",
            scheduledSlotStart: "2025-11-20T10:00:00Z",
            scheduledSlotEnd: "2025-11-20T11:00:00Z",
            totalJointsPlanned: 75,
            totalJointsCompleted: null,
            truckingCompany: "ABC Trucking",
            contactName: "Jane Smith",
            contactPhone: "+1-555-0201",
            notes: null,
            documents: [],
            assignedRacks: []
          }
        ],

        outboundLoads: [],

        inventorySummary: {
          totalJoints: 75,
          totalLengthFt: 2250.0,
          totalWeightLbs: 10050,
          rackNames: ["A-A1-10"]
        }
      }
    ]
  }
]
```

### Data Aggregation

The RPC function performs complex SQL aggregations using **Common Table Expressions (CTEs)**:

#### CTE 1: Load Documents

```sql
load_documents AS (
  SELECT
    td.trucking_load_id,
    json_agg(
      json_build_object(
        'id', td.id,
        'fileName', td.file_name,
        'storagePath', td.storage_path,
        'documentType', td.document_type,
        'parsedPayload', td.parsed_payload,  -- AI-extracted manifest data
        'uploadedBy', td.uploaded_by,
        'uploadedAt', td.uploaded_at
      )
      ORDER BY td.uploaded_at DESC
    ) as documents_json
  FROM trucking_documents td
  GROUP BY td.trucking_load_id
)
```

**Purpose:** Aggregate all documents for each trucking load, including AI-extracted manifest data (`parsedPayload`).

#### CTE 2: Per-Rack Inventory Details

```sql
rack_inventory AS (
  SELECT
    i.request_id,
    i.trucking_load_id,
    json_agg(
      json_build_object(
        'rackId', sa.id,
        'rackName', sa.name,
        'jointCount', COUNT(i.id),
        'totalLengthFt', SUM(i.length),
        'totalWeightLbs', SUM(i.weight),
        'statuses', array_agg(DISTINCT i.status ORDER BY i.status),
        'assignedAt', MIN(i.created_at),
        'lastUpdated', MAX(i.updated_at)
      )
      ORDER BY sa.name
    ) as racks_json
  FROM inventory i
  LEFT JOIN storage_areas sa ON sa.id = i.storage_area_id
  WHERE i.storage_area_id IS NOT NULL
  GROUP BY i.request_id, i.trucking_load_id, sa.id, sa.name
)
```

**Purpose:** Group inventory items by rack, showing joint counts and weights per rack.

#### CTE 3: Project Loads (Inbound + Outbound)

```sql
project_loads AS (
  SELECT
    sr.id as project_id,

    -- Inbound loads (JSON array)
    COALESCE(
      json_agg(...) FILTER (WHERE tl.direction = 'INBOUND'),
      '[]'::json
    ) as inbound_loads_json,

    -- Outbound loads (JSON array)
    COALESCE(
      json_agg(...) FILTER (WHERE tl.direction = 'OUTBOUND'),
      '[]'::json
    ) as outbound_loads_json

  FROM storage_requests sr
  LEFT JOIN trucking_loads tl ON tl.storage_request_id = sr.id
  LEFT JOIN load_documents ld ON ld.trucking_load_id = tl.id
  LEFT JOIN rack_inventory ri ON ri.request_id = sr.id
  GROUP BY sr.id
)
```

**Purpose:** Separate loads by direction (INBOUND vs OUTBOUND) and nest documents/racks within each load.

#### CTE 4: Project Inventory Summary

```sql
project_inventory AS (
  SELECT
    i.request_id,
    COUNT(i.id) as total_joints,
    SUM(i.length) as total_length_ft,
    SUM(i.weight) as total_weight_lbs,
    array_agg(DISTINCT sa.name ORDER BY sa.name) FILTER (WHERE sa.name IS NOT NULL) as rack_names
  FROM inventory i
  LEFT JOIN storage_areas sa ON sa.id = i.storage_area_id
  WHERE i.status = 'IN_STORAGE'
  GROUP BY i.request_id
)
```

**Purpose:** Aggregate total inventory counts across all racks for each project.

#### CTE 5: Company Projects

```sql
company_projects AS (
  SELECT
    c.id as company_id,
    c.name as company_name,
    c.domain as company_domain,
    c.contact_email as company_contact_email,
    c.contact_phone as company_contact_phone,

    json_agg(
      json_build_object(
        'id', sr.id,
        'referenceId', sr.reference_id,
        'status', sr.status,
        -- ... all project fields ...
        'inboundLoads', pl.inbound_loads_json,
        'outboundLoads', pl.outbound_loads_json,
        'inventorySummary', COALESCE(pi.inventory_json, default_json)
      )
      ORDER BY sr.created_at DESC
    ) as projects_json

  FROM companies c
  INNER JOIN storage_requests sr ON sr.company_id = c.id
  LEFT JOIN project_loads pl ON pl.project_id = sr.id
  LEFT JOIN project_inventory pi ON pi.request_id = sr.id
  WHERE lower(c.domain) != 'mpsgroup.ca'  -- Exclude internal company
  GROUP BY c.id, c.name, c.domain, c.contact_email, c.contact_phone
)
```

**Purpose:** Group all projects by company and nest all related data.

#### Final SELECT

```sql
SELECT json_agg(
  json_build_object(
    'company', json_build_object(...),
    'projects', projects_json
  )
  ORDER BY company_name
)
FROM company_projects;
```

**Purpose:** Return final nested JSON structure with companies and their projects.

### Performance Optimization

**Database Indexes (9 total):**

Created in migration `20251109000001_FINAL_INDEXES.sql`:

1. `idx_storage_requests_company_status` - Filter requests by company and status
2. `idx_trucking_loads_request_direction` - Filter loads by request and direction
3. `idx_trucking_documents_load_id` - Join documents to loads
4. `idx_inventory_request_status` - Filter inventory by request and status
5. `idx_inventory_storage_area` - Join inventory to racks
6. `idx_storage_areas_capacity` - Calculate available capacity
7. `idx_companies_domain` - Filter companies (excludes internal domain)
8. `idx_admin_audit_log_entity` - Query audit logs by entity
9. `idx_notification_queue_status` - Query pending notifications

**Query Optimization:**
- Single complex query vs N+1 pattern (151 queries → 1 query)
- Database-side JSON aggregation (no client-side merging)
- Filtered aggregations using `FILTER (WHERE ...)` clause
- LEFT JOINs for optional data (documents, inventory)

**Execution Time:**
- ~100-200ms for 50 companies with 500 projects and 2,000 loads
- Scales linearly with data volume (not exponentially)

---

## React Query Integration

### Hooks Architecture

All React Query hooks are located in `hooks/` directory:

#### 1. **useProjectSummaries()**

**File:** `hooks/useProjectSummaries.ts`

**Purpose:** Fetch all project summaries grouped by company

**Usage:**
```tsx
const { data, isLoading, error, refetch } = useProjectSummaries();

// data: ProjectSummariesResponse (array of CompanyWithProjects)
// isLoading: boolean
// error: Error | null
// refetch: () => Promise<void>
```

**Caching Strategy:**
```tsx
{
  queryKey: ['projectSummaries'],
  staleTime: 30 * 1000,        // Consider data fresh for 30 seconds
  refetchOnMount: 'always',     // Always fetch latest on component mount
  refetchOnWindowFocus: true,   // Refetch when user returns to tab
  refetchInterval: 60 * 1000,   // Poll every 60 seconds for live updates
  retry: 2,                     // Retry failed requests twice
  gcTime: 5 * 60 * 1000,       // Keep unused data in cache for 5 minutes
}
```

**Error Handling:**
```tsx
if (error.message?.includes('Access denied')) {
  throw new Error('Admin privileges required. Please contact support.');
}
throw new Error(`Failed to fetch project summaries: ${error.message}`);
```

#### 2. **useCompanyProjects()**

**Purpose:** Get a specific company's projects by company ID

**Derived from `useProjectSummaries()` data (no additional query):**
```tsx
export function useCompanyProjects(companyId: string | null) {
  const { data, ...queryResult } = useProjectSummaries();

  const companyData = data?.find(c => c.company.id === companyId);

  return {
    ...queryResult,
    data: companyData || null,
    projects: companyData?.projects || [],
  };
}
```

**Usage:**
```tsx
const { projects, isLoading, error } = useCompanyProjects(selectedCompanyId);
```

#### 3. **useProjectById()**

**Purpose:** Get a specific project by ID

**Derived from `useProjectSummaries()` data:**
```tsx
export function useProjectById(projectId: string | null) {
  const { data, ...queryResult } = useProjectSummaries();

  let foundProject = null;
  if (data && projectId) {
    for (const companyGroup of data) {
      const project = companyGroup.projects.find(p => p.id === projectId);
      if (project) {
        foundProject = {
          company: companyGroup.company,
          project,
        };
        break;
      }
    }
  }

  return {
    ...queryResult,
    data: foundProject,
  };
}
```

#### 4. **useAdminMetrics()**

**Purpose:** Get summary statistics across all companies

**Derived from `useProjectSummaries()` data:**
```tsx
export function useAdminMetrics() {
  const { data, ...queryResult } = useProjectSummaries();

  const metrics = {
    totalCompanies: data?.length || 0,
    totalProjects: data?.reduce((sum, c) => sum + c.projects.length, 0) || 0,
    pendingApprovals: data?.reduce(
      (sum, c) => sum + c.projects.filter(p => p.status === 'PENDING').length,
      0
    ) || 0,
    approvedProjects: data?.reduce(
      (sum, c) => sum + c.projects.filter(p => p.status === 'APPROVED').length,
      0
    ) || 0,
    totalInventoryJoints: data?.reduce(
      (sum, c) => sum + c.projects.reduce((s, p) => s + p.inventorySummary.totalJoints, 0),
      0
    ) || 0,
    totalLoads: data?.reduce(
      (sum, c) => sum + c.projects.reduce(
        (s, p) => s + p.inboundLoads.length + p.outboundLoads.length,
        0
      ),
      0
    ) || 0,
  };

  return {
    ...queryResult,
    metrics,
  };
}
```

**Usage:**
```tsx
const { metrics, isLoading } = useAdminMetrics();

// Display in header:
// "50 Companies • 247 Projects • 12 Pending Approvals"
```

#### 5. **useProjectSummariesRealtime()**

**Purpose:** Subscribe to Supabase realtime updates and invalidate cache

**Usage:**
```tsx
// Call once in AdminDashboard component
useProjectSummariesRealtime();
```

**Implementation:**
```tsx
export function useProjectSummariesRealtime() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const subscription = supabase
      .channel('admin-project-updates')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'storage_requests' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['projectSummaries'] });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'trucking_loads' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['projectSummaries'] });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'inventory' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['projectSummaries'] });
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [queryClient]);
}
```

**Behavior:**
- Any change to `storage_requests`, `trucking_loads`, or `inventory` tables triggers cache invalidation
- React Query automatically refetches data
- All components using `useProjectSummaries()` re-render with fresh data
- Works across browser tabs (if user has multiple admin dashboards open)

#### 6. **useApprovalWorkflow()**

**File:** `hooks/useApprovalWorkflow.ts`

**Exports:**
- `useApproveRequest()` - Mutation hook for approvals
- `useRejectRequest()` - Mutation hook for rejections

**useApproveRequest() Usage:**
```tsx
const approveRequest = useApproveRequest();

const handleApprove = async () => {
  try {
    const result = await approveRequest.mutateAsync({
      requestId: 'uuid',
      assignedRackIds: ['rack-uuid-1', 'rack-uuid-2'],
      requiredJoints: 150,
      notes: 'Approved for 90-day storage',
    });

    toast.success(`Request ${result.referenceId} approved!`);
  } catch (error) {
    toast.error(error.message);
  }
};

// Check loading state
if (approveRequest.isPending) {
  // Show loading spinner
}

// Check error state
if (approveRequest.isError) {
  // Show error message
}
```

**useRejectRequest() Usage:**
```tsx
const rejectRequest = useRejectRequest();

const handleReject = async () => {
  try {
    const result = await rejectRequest.mutateAsync({
      requestId: 'uuid',
      rejectionReason: 'Insufficient capacity at this time',
      notes: 'Customer requested 6-month storage but we are at capacity',
    });

    toast.success('Request rejected. Customer has been notified.');
  } catch (error) {
    toast.error(error.message);
  }
};
```

**Automatic Cache Invalidation:**

Both hooks include `onSuccess` callback that invalidates React Query cache:

```tsx
onSuccess: (result, request) => {
  // Invalidate ALL project summaries to refetch fresh data
  queryClient.invalidateQueries({ queryKey: ['projectSummaries'] });

  // Optionally invalidate specific company data for faster update
  if (result.companyId) {
    queryClient.invalidateQueries({
      queryKey: ['projectSummaries', 'company', result.companyId],
    });
  }

  console.log(`✅ Request ${result.requestId} approved successfully`);
}
```

### Type Safety

All hooks return typed responses using TypeScript interfaces from `types/projectSummaries.ts`:

```typescript
// Approval mutation types
interface ApprovalRequest {
  requestId: string;
  assignedRackIds: string[];
  requiredJoints: number;
  notes?: string;
}

interface ApprovalResult {
  success: boolean;
  requestId: string;
  referenceId: string;
  status: 'APPROVED' | 'REJECTED';
  companyId?: string;
  assignedRacks?: string[];
  requiredJoints?: number;
  availableCapacity?: number;
  rejectionReason?: string;
  notificationQueued?: boolean;
  message: string;
}

// Rejection mutation types
interface RejectionRequest {
  requestId: string;
  rejectionReason: string;
  notes?: string;
}
```

---

## Workflow State Machine

### 8 Workflow States

The workflow state machine is implemented in `utils/workflowStates.ts` using immutable operations (no in-place array modifications).

#### State 1: Pending Approval

**Trigger:** New storage request submitted by customer

**Database:** `storage_requests.status = 'PENDING'`

**Customer View:** "Awaiting Admin Approval" badge (yellow)

**Admin View:** Appears in Pending Approvals tile

**Next Action:** "Admin must approve or reject this request"

**Code:**
```typescript
if (status === 'PENDING') {
  return {
    state: 'Pending Approval',
    label: 'Pending Admin Approval',
    badgeTone: 'pending',
    nextAction: 'Admin must approve or reject this request',
  };
}
```

#### State 2: Waiting on Load #N to MPS

**Trigger:** Request approved but inbound load not arrived

**Database:** `status='APPROVED'`, inbound load `status IN ('PENDING', 'SCHEDULED')`

**Customer View:** "Waiting on Load #1" badge (blue)

**Admin View:** Scheduled in Inbound Loads tile

**Next Action:** "Customer must schedule first delivery" OR "Load #1 scheduled for 2025-11-15"

**Code:**
```typescript
const nextPendingInbound = sortedInbound.find(
  load => load.status === 'PENDING' || load.status === 'SCHEDULED'
);

if (nextPendingInbound) {
  const loadNumber = nextPendingInbound.sequenceNumber;
  const scheduledDate = nextPendingInbound.scheduledSlotStart
    ? new Date(nextPendingInbound.scheduledSlotStart).toLocaleDateString()
    : 'TBD';

  return {
    state: 'Waiting on Load #N to MPS',
    label: `Waiting on Load #${loadNumber} to MPS`,
    badgeTone: 'info',
    nextAction: `Load #${loadNumber} scheduled for ${scheduledDate}`,
  };
}
```

#### State 3: All Loads Received

**Trigger:** All inbound loads `status='COMPLETED'` but manifests not processed

**Database:** All inbound loads completed, `trucking_documents.parsed_payload` is NULL

**Customer View:** "Processing Manifests" badge (blue)

**Admin View:** Appears in "Needs Manifest Review" filter

**Next Action:** "Admin must upload and process manifest documents"

**Code:**
```typescript
const allInboundArrived = sortedInbound.length > 0 && sortedInbound.every(
  load => load.status === 'COMPLETED' || load.status === 'ARRIVED'
);

const allManifestsProcessed = sortedInbound.every(
  load => load.documents.some(doc => doc.parsedPayload)
);

if (allInboundArrived && !allManifestsProcessed) {
  return {
    state: 'All Loads Received',
    label: 'Processing Manifests',
    badgeTone: 'info',
    nextAction: 'Admin must upload and process manifest documents',
  };
}
```

#### State 4: In Storage

**Trigger:** All loads received and manifests processed

**Database:** `inventory.status='IN_STORAGE'`

**Customer View:** "In Storage" badge (green)

**Admin View:** Active Projects tile, capacity tracking

**Next Action:** "Inventory stored. Awaiting customer pickup request."

**Code:**
```typescript
const hasInventory = inventorySummary.totalJoints > 0;
const noOutboundRequests = sortedOutbound.length === 0;

if (allInboundArrived && hasInventory && noOutboundRequests) {
  return {
    state: 'In Storage',
    label: 'In Storage',
    badgeTone: 'success',
    nextAction: 'Inventory stored. Awaiting customer pickup request.',
  };
}
```

#### State 5: Pending Pickup Request

**Trigger:** Storage duration approaching end (not yet implemented)

**Customer View:** "Request Pickup" button enabled

**Next Action:** "Customer initiates pickup request"

**Note:** This state is reserved for future pickup request feature.

#### State 6: Pickup Requested

**Trigger:** Customer submitted pickup request

**Database:** Outbound load created (`direction='OUTBOUND'`)

**Admin View:** Outbound Loads tile

**Next Action:** "Admin schedules pickup"

**Code:**
```typescript
if (sortedOutbound.length > 0) {
  const nextPendingOutbound = sortedOutbound.find(
    load => load.status === 'PENDING' || load.status === 'SCHEDULED'
  );

  if (nextPendingOutbound) {
    // ... (see State 7)
  } else {
    return {
      state: 'Pickup Requested',
      label: 'Pickup in Progress',
      badgeTone: 'info',
      nextAction: 'Outbound loads being prepared for pickup',
    };
  }
}
```

#### State 7: Waiting on Load #N Pickup

**Trigger:** Outbound load scheduled

**Customer View:** "Pickup Scheduled" with date

**Admin View:** Upcoming pickups

**Next Action:** "Truck arrives, load departs"

**Code:**
```typescript
if (nextPendingOutbound) {
  const loadNumber = nextPendingOutbound.sequenceNumber;
  const scheduledDate = nextPendingOutbound.scheduledSlotStart
    ? new Date(nextPendingOutbound.scheduledSlotStart).toLocaleDateString()
    : 'TBD';

  return {
    state: 'Waiting on Load #N Pickup',
    label: `Waiting on Load #${loadNumber} Pickup`,
    badgeTone: 'info',
    nextAction: `Pickup scheduled for ${scheduledDate}`,
  };
}
```

#### State 8: Complete

**Trigger:** All outbound loads completed

**Database:** `status='COMPLETED'`, all inventory `status='PICKED_UP'`

**Customer View:** "Complete" badge (gray)

**Admin View:** Archived projects

**Next Action:** None (terminal state)

**Code:**
```typescript
const allOutboundComplete = sortedOutbound.every(load => load.status === 'COMPLETED');

if (allOutboundComplete && inventorySummary.totalJoints === 0) {
  return {
    state: 'Complete',
    label: 'All Pipe Returned',
    badgeTone: 'success',
    nextAction: null,
  };
}
```

### State Transition Diagram

```
┌─────────────────┐
│ 1. PENDING      │ ← New request submitted
│    APPROVAL     │
└────────┬────────┘
         │
         │ Admin approves
         ▼
┌─────────────────┐
│ 2. WAITING ON   │ ← Customer books load
│    LOAD #1      │
└────────┬────────┘
         │
         │ Load arrives
         ▼
┌─────────────────┐
│ 3. ALL LOADS    │ ← Admin uploads manifest
│    RECEIVED     │
└────────┬────────┘
         │
         │ Manifest processed
         ▼
┌─────────────────┐
│ 4. IN STORAGE   │ ← Inventory assigned to racks
│                 │
└────────┬────────┘
         │
         │ Customer requests pickup
         ▼
┌─────────────────┐
│ 6. PICKUP       │ ← Admin schedules pickup
│    REQUESTED    │
└────────┬────────┘
         │
         │ Pickup scheduled
         ▼
┌─────────────────┐
│ 7. WAITING ON   │ ← Truck arrives
│    PICKUP #1    │
└────────┬────────┘
         │
         │ Pickup completed
         ▼
┌─────────────────┐
│ 8. COMPLETE     │ ← All pipe returned
│                 │
└─────────────────┘
```

### State Calculation Logic

**File:** `utils/workflowStates.ts`

**Function:** `calculateWorkflowState(project: ProjectSummary): WorkflowStateResult`

**Immutable Operations:**

The function creates defensive copies before sorting to prevent mutation of input data:

```typescript
// ✅ Correct: Defensive copy before sorting
const sortedInbound = [...inboundLoads].sort((a, b) => a.sequenceNumber - b.sequenceNumber);
const sortedOutbound = [...outboundLoads].sort((a, b) => a.sequenceNumber - b.sequenceNumber);

// ❌ Incorrect: Mutates input array
// inboundLoads.sort((a, b) => a.sequenceNumber - b.sequenceNumber);
```

**Fallback Behavior:**

If none of the state conditions match (should never happen), the function logs a warning and returns a default state:

```typescript
console.warn('Unexpected workflow state for project:', project.referenceId, {
  status,
  inboundCount: sortedInbound.length,
  outboundCount: sortedOutbound.length,
  inventoryJoints: inventorySummary.totalJoints,
});

return {
  state: 'In Storage',
  label: 'In Storage',
  badgeTone: 'neutral',
  nextAction: null,
};
```

### Helper Functions

#### getWorkflowBadgeClass()

**Purpose:** Get CSS classes for workflow state badges

**Usage:**
```tsx
const badgeClass = getWorkflowBadgeClass('pending');
// Returns: "bg-yellow-500/20 text-yellow-300 border border-yellow-500/30"
```

**Badge Color Mapping:**
```typescript
const badgeClasses: Record<WorkflowBadgeTone, string> = {
  pending: 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30',
  info: 'bg-blue-500/20 text-blue-300 border border-blue-500/30',
  success: 'bg-green-500/20 text-green-300 border border-green-500/30',
  danger: 'bg-red-500/20 text-red-300 border border-red-500/30',
  neutral: 'bg-gray-500/20 text-gray-300 border border-gray-500/30',
};
```

#### calculateProjectProgress()

**Purpose:** Get progress percentage for project (0-100)

**Usage:**
```tsx
const progress = calculateProjectProgress(project);
// Returns: 70 (70% complete)
```

**Progress Calculation:**
- Rejected: 0%
- Pending: 10%
- Approved but no loads: 20%
- Inbound progress: 20% → 60% (based on completed loads)
- In storage: 70%
- Outbound progress: 70% → 100% (based on completed pickups)

#### requiresAdminAction()

**Purpose:** Check if project requires admin action

**Usage:**
```tsx
const needsAttention = requiresAdminAction(project);
// Returns: true if pending approval or manifests need processing
```

**Admin Action Triggers:**
1. `status === 'PENDING'` (needs approval/rejection)
2. All loads arrived but manifests not processed

#### getNextMilestone()

**Purpose:** Get next milestone for project

**Usage:**
```tsx
const nextStep = getNextMilestone(project);
// Returns: "Load #2 scheduled for 2025-11-20"
```

---

## Admin Dashboard Data Flow

### On Dashboard Load

**Sequence:**

1. **User navigates to `/admin`**
   - React Router renders `AdminDashboard` component
   - `useProjectSummaries()` hook initializes
   - React Query checks cache for `['projectSummaries']` key

2. **Cache Check**
   - If data exists and is fresh (< 30 seconds old): Return cached data
   - If data is stale (> 30 seconds old): Return cached data AND refetch in background
   - If no cache: Show loading state, fetch data

3. **Server RPC Call**
   ```tsx
   const { data, error } = await supabase.rpc('get_project_summaries_by_company');
   ```

4. **PostgreSQL Execution**
   - `get_project_summaries_by_company()` function executes
   - Security check: `is_admin_user()` verifies admin privileges
   - 5 CTEs execute in sequence (load_documents → rack_inventory → project_loads → project_inventory → company_projects)
   - Final JSON aggregation builds nested response
   - Execution time: ~100-200ms for 50 companies

5. **Response Returned as JSON**
   ```json
   [
     {
       "company": { ... },
       "projects": [ ... ]
     }
   ]
   ```

6. **React Query Caches Result**
   - Data stored in React Query cache with key `['projectSummaries']`
   - Cache entry marked as fresh (staleTime: 30s)
   - GC timer set (gcTime: 5 minutes)

7. **Tiles Render with Cached Data**
   - `CompanyTileCarousel` receives data from `useProjectSummaries()`
   - Maps over companies to render `CompanyTile` components
   - Each tile displays metrics derived from project data

8. **Realtime Subscription Established**
   ```tsx
   useProjectSummariesRealtime(); // Called in AdminDashboard
   ```
   - Subscribes to `storage_requests`, `trucking_loads`, `inventory` table changes
   - Subscription active for component lifetime

9. **Polling Starts**
   - React Query starts 60-second polling interval
   - Refetches data every 60 seconds (even if no realtime events)

### On Approval Action

**Sequence:**

1. **Admin Clicks "Approve" Button**
   - Button click handler invokes `handleApprove()`
   - `useApproveRequest()` mutation called
   - Button shows loading spinner (`isPending` state)

2. **Mutation Executes**
   ```tsx
   await approveRequest.mutateAsync({
     requestId: 'uuid',
     assignedRackIds: ['rack-uuid-1'],
     requiredJoints: 100,
     notes: 'Approved for 90-day storage',
   });
   ```

3. **Supabase RPC Call**
   ```tsx
   const { data, error } = await supabase.rpc('approve_storage_request_atomic', {
     p_request_id: 'uuid',
     p_assigned_rack_ids: ['rack-uuid-1'],
     p_required_joints: 100,
     p_notes: 'Approved for 90-day storage',
   });
   ```

4. **PostgreSQL Transaction Executes**
   - Security check
   - Validate request is PENDING
   - Validate rack capacity
   - Update `storage_requests.status = 'APPROVED'`
   - Update `storage_areas.occupied += 100`
   - Insert `admin_audit_log` entry
   - Insert `notification_queue` entry
   - COMMIT (all operations succeed or all rollback)

5. **Success Response Returned**
   ```json
   {
     "success": true,
     "requestId": "uuid",
     "referenceId": "REF-001",
     "status": "APPROVED",
     "assignedRacks": ["A-A1-10"],
     "message": "Request REF-001 approved successfully"
   }
   ```

6. **Mutation `onSuccess` Callback Fires**
   ```tsx
   onSuccess: (result, request) => {
     // Invalidate ALL project summaries
     queryClient.invalidateQueries({ queryKey: ['projectSummaries'] });
   }
   ```

7. **React Query Cache Invalidated**
   - `['projectSummaries']` cache entry marked as stale
   - Automatic refetch triggered (because component is still mounted)

8. **Refetch Executes**
   - New RPC call to `get_project_summaries_by_company()`
   - Returns updated data (request now APPROVED)

9. **Tiles Re-Render with Updated Data**
   - Company tile shows updated metrics:
     - Pending Requests: `3 → 2`
     - Approved Projects: `10 → 11`
   - Tile glow changes from yellow to cyan (no more pending)
   - Request status badge: "Pending Approval" → "Waiting on Load #1"

10. **Toast Notification Shown**
    ```tsx
    toast.success(`Request ${result.referenceId} approved!`);
    ```

### On Realtime Event

**Scenario:** Another admin (or customer) updates data in a different browser tab or device.

**Sequence:**

1. **Database Change Occurs**
   - Example: Customer books a trucking load via customer portal
   - `INSERT INTO trucking_loads (...)` executed

2. **Supabase Detects Change**
   - Supabase Realtime engine monitors table changes
   - Broadcasts event to all subscribed clients

3. **Subscription Receives Event**
   ```tsx
   .on(
     'postgres_changes',
     { event: '*', schema: 'public', table: 'trucking_loads' },
     (payload) => {
       queryClient.invalidateQueries({ queryKey: ['projectSummaries'] });
     }
   )
   ```

4. **Cache Invalidated**
   - `['projectSummaries']` cache entry marked as stale

5. **Query Refetches Immediately**
   - React Query triggers refetch (because component is mounted)
   - New RPC call executes

6. **UI Updates for All Connected Admins**
   - Admin #1 (who triggered the change): Already has updated data
   - Admin #2 (viewing dashboard in another tab): Sees instant update via realtime
   - Admin #3 (viewing on mobile device): Sees instant update via realtime

**Benefits:**
- No need to manually refresh page
- Multi-user collaboration without conflicts
- Near-instant updates (< 1 second latency)

---

## Security & Authorization

### Admin User Authorization

**Admin Users Table:**

```sql
CREATE TABLE admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);
```

**Adding Admin Users:**

```sql
-- Insert admin user by email
INSERT INTO admin_users (user_id, email)
SELECT id, email
FROM auth.users
WHERE email = 'admin@roughneckops.com';
```

**Security Check Function:**

```sql
CREATE OR REPLACE FUNCTION is_admin_user()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM admin_users
    WHERE user_id = auth.uid()
  );
END;
$$;
```

**Permissions:**
- `SECURITY DEFINER`: Function executes with privileges of function owner (not caller)
- Revoked from PUBLIC, anon, authenticated (internal use only)
- Only callable from other SECURITY DEFINER functions

### RPC Function Security

**Approval Functions:**

```sql
CREATE OR REPLACE FUNCTION approve_storage_request_atomic(...)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_admin_user() THEN
    RAISE EXCEPTION 'Access denied. Admin privileges required.';
  END IF;

  -- ... rest of function
END;
$$;

-- Permissions
REVOKE ALL ON FUNCTION approve_storage_request_atomic FROM PUBLIC;
GRANT EXECUTE ON FUNCTION approve_storage_request_atomic TO authenticated;
```

**Security Model:**
1. Function is `SECURITY DEFINER` (executes as function owner, not caller)
2. First line checks `is_admin_user()` (throws exception if not admin)
3. Function granted to `authenticated` role (any logged-in user can attempt to call)
4. Admin check prevents non-admins from executing sensitive operations

**RLS Bypass:**

Because functions use `SECURITY DEFINER`, they bypass Row-Level Security (RLS) policies. This is intentional:
- Admins need to see all companies' data (not just their own)
- RPC functions enforce security at function level (via `is_admin_user()` check)
- Alternative approach (RLS-based) would require complex policies with admin role checks

### Frontend Authorization

**AuthContext:**

```tsx
interface AuthContextType {
  user: User | null;
  isAdmin: boolean;
  loading: boolean;
  // ...
}

const AuthContext = React.createContext<AuthContextType>({
  user: null,
  isAdmin: false,
  loading: true,
});
```

**Admin Route Protection:**

```tsx
// In App.tsx or AdminRoute.tsx
{isAdmin ? (
  <AdminDashboard ... />
) : (
  <Navigate to="/unauthorized" replace />
)}
```

**Admin Check on Login:**

```tsx
useEffect(() => {
  const checkAdminStatus = async () => {
    const { data, error } = await supabase.rpc('is_admin_user');
    setIsAdmin(data === true);
  };

  if (user) {
    checkAdminStatus();
  }
}, [user]);
```

### Test Mode (REMOVE BEFORE PRODUCTION)

**Migration:** `20251109000005_test_mode_admin_bypass.sql`

**WARNING:** This migration bypasses admin checks for testing. **MUST BE REMOVED** before production deployment.

```sql
-- TEST MODE: Bypass admin check (REMOVE BEFORE PRODUCTION)
CREATE OR REPLACE FUNCTION is_admin_user()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN TRUE;  -- Always returns true for testing
END;
$$;
```

**To Remove Test Mode:**

```sql
-- Restore production admin check
CREATE OR REPLACE FUNCTION is_admin_user()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM admin_users
    WHERE user_id = auth.uid()
  );
END;
$$;
```

---

## Audit Logging

### admin_audit_log Table

**Schema:**

```sql
CREATE TABLE admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_admin_audit_log_user ON admin_audit_log(admin_user_id);
CREATE INDEX idx_admin_audit_log_entity ON admin_audit_log(entity_type, entity_id);
CREATE INDEX idx_admin_audit_log_created ON admin_audit_log(created_at DESC);
```

### Logged Actions

**Action Types:**
- `APPROVE_REQUEST` - Storage request approved
- `REJECT_REQUEST` - Storage request rejected
- `UPDATE_LOAD` - Trucking load modified
- `DELETE_LOAD` - Trucking load deleted
- `ASSIGN_RACK` - Rack assigned to inventory
- `UPDATE_INVENTORY` - Inventory item modified

**Example Audit Log Entry (Approval):**

```json
{
  "id": "uuid",
  "admin_user_id": "admin-uuid",
  "action": "APPROVE_REQUEST",
  "entity_type": "storage_request",
  "entity_id": "request-uuid",
  "details": {
    "referenceId": "REF-001",
    "companyName": "Apex Drilling",
    "assignedRacks": ["A-A1-10", "A-A1-11"],
    "requiredJoints": 150,
    "notes": "Approved for 90-day storage"
  },
  "created_at": "2025-11-10T14:30:00Z"
}
```

### Querying Audit Logs

**Get Recent Admin Actions:**

```sql
SELECT
  aal.created_at,
  aal.action,
  au.email as admin_email,
  aal.entity_type,
  aal.details->>'referenceId' as reference_id,
  aal.details
FROM admin_audit_log aal
LEFT JOIN admin_users au ON au.user_id::text = aal.admin_user_id
ORDER BY aal.created_at DESC
LIMIT 50;
```

**Get All Actions for Specific Request:**

```sql
SELECT *
FROM admin_audit_log
WHERE entity_type = 'storage_request'
  AND entity_id = 'request-uuid'
ORDER BY created_at DESC;
```

**Get All Actions by Specific Admin:**

```sql
SELECT
  aal.created_at,
  aal.action,
  aal.entity_type,
  aal.details->>'referenceId' as reference_id
FROM admin_audit_log aal
WHERE admin_user_id = 'admin-uuid'
ORDER BY created_at DESC;
```

### Compliance & Retention

**Audit Log Retention Policy:**

Not currently implemented. Future considerations:
- Retain audit logs for 7 years (compliance requirement)
- Archive old logs to separate table or cold storage
- Implement log rotation (monthly partitions)

**Data Privacy:**

Audit logs may contain PII (customer names, emails). Considerations:
- Encrypt `details` JSONB column
- Implement access controls (only senior admins can view)
- GDPR right-to-erasure: Redact customer data from audit logs when customer account deleted

---

## Migration History

### Migration Sequence (November 2025)

#### 0. `20251110000001_add_requester_identity_to_company_summaries.sql` (Requester Identity)

**Purpose:** Add requester identity to `get_company_summaries()` function

**Changes:**
- Added `last_requester_name`, `last_requester_email`, `last_pending_request_id`, `last_pending_created_at` to return columns
- Added `latest_pending_requests` CTE to extract most recent pending request per company
- Joins `auth.users` to get full name from `raw_user_meta_data` (first_name + last_name)
- Uses `DISTINCT ON (company_id)` to select most recent pending request
- Graceful handling: Returns NULL if no pending requests exist

**Business Value:**
- Admins can see WHO submitted pending requests directly in Company Tile
- Eliminates need to click "View Details" to identify requester
- Matches Slack notification context (name + email visible immediately)
- Improves approval workflow efficiency

**Verification:**
```sql
-- Test: Should show requester for companies with pending requests
SELECT
  name,
  pending_requests,
  last_requester_name,
  last_requester_email
FROM get_company_summaries()
WHERE pending_requests > 0;
```

**Migration File:** `supabase/migrations/20251110000001_add_requester_identity_to_company_summaries.sql`

**Related Components:**
- `hooks/useCompanyData.ts`: Maps new fields to `CompanySummary` type
- `components/admin/tiles/CompanyTileHeader.tsx`: Displays requester card when pending
- `supabase/TEST_REQUESTER_IDENTITY_QUERIES.sql`: Comprehensive test suite (8 tests)

---

#### 1. `20251109000001_FINAL_CORRECTED.sql` (Core RPC Functions)

**Purpose:** Create `get_project_summaries_by_company()` RPC function

**Changes:**
- Created `is_admin_user()` security check function
- Created `get_project_summaries_by_company()` RPC with 5 CTEs
- Fixed critical bug: `inventory.request_id` (not `storage_request_id`)
- Deprecated old `get_company_summaries()` function

**Verification:**
```sql
-- Test RPC call
SELECT get_project_summaries_by_company();
```

#### 2. `20251109000001_FINAL_INDEXES.sql` (Performance Indexes)

**Purpose:** Add 9 database indexes for optimized query performance

**Indexes Created:**
1. `idx_storage_requests_company_status`
2. `idx_trucking_loads_request_direction`
3. `idx_trucking_documents_load_id`
4. `idx_inventory_request_status`
5. `idx_inventory_storage_area`
6. `idx_storage_areas_capacity`
7. `idx_companies_domain`
8. `idx_admin_audit_log_entity`
9. `idx_notification_queue_status`

**Verification:**
```sql
-- Check index usage
SELECT schemaname, tablename, indexname
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;
```

#### 3. `20251109000002_atomic_approval_workflow.sql` (Approval/Rejection Functions)

**Purpose:** Create atomic approval and rejection stored procedures

**Changes:**
- Created `approve_storage_request_atomic()` function
- Created `reject_storage_request_atomic()` function
- Created `admin_audit_log` table
- Created `notification_queue` table

**Verification:**
```sql
-- Test approval (will fail if not admin)
SELECT approve_storage_request_atomic(
  p_request_id := 'uuid',
  p_assigned_rack_ids := ARRAY['rack-uuid'],
  p_required_joints := 100,
  p_notes := 'Test approval'
);
```

#### 4. `20251109000003_fix_approval_workflow_schema.sql` (Schema Fixes)

**Purpose:** Fix schema mismatches in approval functions

**Changes:**
- Updated column references to match actual database schema
- Fixed rack capacity calculation logic
- Added error handling for missing columns

#### 5. `20251109000004_align_approval_with_actual_schema.sql` (Racks + Notifications Alignment)

**Purpose:** Align approval functions with racks table and notification queue

**Changes:**
- Updated `storage_areas` references (racks table name)
- Fixed notification queue payload structure
- Added company email lookup for notifications

#### 6. `20251109000005_test_mode_admin_bypass.sql` (Test Mode - REMOVE BEFORE PRODUCTION)

**Purpose:** Bypass admin checks for testing

**WARNING:** This migration makes `is_admin_user()` always return TRUE. **MUST BE REMOVED** before production.

**Changes:**
- Modified `is_admin_user()` to return TRUE unconditionally

**To Remove:**
```sql
-- Run migration 20251109000003_fix_approval_workflow_schema.sql again
-- to restore production admin check
```

#### 7. `20251109000006_fix_admin_user_id_test_mode.sql` (NULL Handling for Test Mode)

**Purpose:** Fix NULL `admin_user_id` handling in test mode

**Changes:**
- Updated approval functions to use `COALESCE(p_admin_user_id, auth.uid()::text)`
- Prevents crashes when `auth.uid()` is NULL (test mode)

### Rollback Strategy

**If migration fails:**

1. **Identify failed migration:**
   ```sql
   SELECT * FROM supabase_migrations.schema_migrations
   ORDER BY version DESC
   LIMIT 5;
   ```

2. **Rollback to previous version:**
   - Manually drop created functions/tables
   - Re-run previous migration

3. **Example rollback for migration 20251109000002:**
   ```sql
   DROP FUNCTION IF EXISTS approve_storage_request_atomic;
   DROP FUNCTION IF EXISTS reject_storage_request_atomic;
   DROP TABLE IF EXISTS notification_queue;
   DROP TABLE IF EXISTS admin_audit_log;
   ```

---

## Troubleshooting Guide

### Common Issues & Solutions

#### Issue 1: "Access denied. Admin privileges required."

**Cause:** User is not in `admin_users` table

**Solution:**
```sql
-- Check if user is admin
SELECT * FROM admin_users WHERE email = 'user@example.com';

-- Add user as admin
INSERT INTO admin_users (user_id, email)
SELECT id, email
FROM auth.users
WHERE email = 'user@example.com';
```

#### Issue 2: "Insufficient rack capacity"

**Cause:** Selected racks don't have enough available space

**Diagnosis:**
```sql
SELECT
  sa.name,
  sa.capacity,
  sa.occupied,
  (sa.capacity - sa.occupied) as available
FROM storage_areas sa
WHERE sa.id = ANY(ARRAY['rack-uuid-1', 'rack-uuid-2']);
```

**Solution:**
- Assign additional racks
- Reduce `requiredJoints` parameter
- Free up capacity by completing outbound loads

#### Issue 3: Tiles not updating after approval

**Cause:** React Query cache not invalidating

**Diagnosis:**
- Open browser DevTools
- Check Network tab for RPC call to `get_project_summaries_by_company`
- If no call, cache invalidation failed

**Solution:**
```tsx
// Manually invalidate cache
import { useQueryClient } from '@tanstack/react-query';

const queryClient = useQueryClient();
queryClient.invalidateQueries({ queryKey: ['projectSummaries'] });
```

#### Issue 4: Realtime updates not working

**Cause:** Supabase subscription not established

**Diagnosis:**
```tsx
// Check subscription status
useEffect(() => {
  const subscription = supabase
    .channel('admin-project-updates')
    .on('postgres_changes', { ... }, () => { ... })
    .subscribe((status) => {
      console.log('Subscription status:', status);
    });

  return () => {
    subscription.unsubscribe();
  };
}, []);
```

**Solution:**
- Verify Supabase Realtime is enabled in project settings
- Check for browser console errors
- Ensure table has REPLICA IDENTITY set to FULL:
  ```sql
  ALTER TABLE storage_requests REPLICA IDENTITY FULL;
  ALTER TABLE trucking_loads REPLICA IDENTITY FULL;
  ALTER TABLE inventory REPLICA IDENTITY FULL;
  ```

#### Issue 5: Email notifications not sending

**Cause:** Notification worker not processing `notification_queue`

**Diagnosis:**
```sql
-- Check pending notifications
SELECT * FROM notification_queue
WHERE status = 'PENDING'
ORDER BY created_at DESC;
```

**Solution:**
1. Verify `RESEND_API_KEY` is set in `.env`
2. Check notification worker logs (Edge Function or cron job)
3. Manually process notification:
   ```sql
   -- Mark as sent (for testing)
   UPDATE notification_queue
   SET status = 'SENT', sent_at = NOW()
   WHERE id = 'notification-uuid';
   ```

#### Issue 6: RPC function returns empty array

**Cause:** User is not admin OR no companies have projects

**Diagnosis:**
```sql
-- Check admin status
SELECT is_admin_user();

-- Check company count
SELECT COUNT(*) FROM companies;

-- Check request count
SELECT COUNT(*) FROM storage_requests;
```

**Solution:**
- Ensure user is in `admin_users` table
- Create test data if database is empty
- Check RPC function logs for errors

#### Issue 7: Workflow state calculation incorrect

**Cause:** Missing or invalid data in loads/inventory

**Diagnosis:**
```typescript
import { calculateWorkflowState } from '../utils/workflowStates';

const state = calculateWorkflowState(project);
console.log('Workflow state:', state);
```

**Solution:**
- Verify all inbound loads have `sequenceNumber` set
- Ensure load `status` is valid enum value
- Check for orphaned inventory records (no `storage_area_id`)

#### Issue 8: Approval transaction rollback

**Cause:** Database constraint violation or capacity check failure

**Diagnosis:**
- Check PostgreSQL logs for error message
- Look for ROLLBACK message in logs
- Error thrown by `RAISE EXCEPTION`

**Solution:**
```sql
-- Check constraint violations
SELECT * FROM pg_constraint WHERE conrelid = 'storage_requests'::regclass;

-- Verify rack capacity calculation
SELECT
  sa.name,
  sa.capacity,
  sa.occupied,
  (sa.capacity - sa.occupied) as available
FROM storage_areas sa;
```

---

## Performance Optimization

### Query Performance

**Baseline (Before Optimization):**
- 151 queries for 50 companies (N+1 pattern)
- ~5-10 seconds total execution time
- Sequential queries (not parallelized)

**After Optimization:**
- 1 query for 50 companies (RPC with CTEs)
- ~100-200ms total execution time
- **99.3% reduction in query count**

**Optimization Techniques:**

1. **Common Table Expressions (CTEs):**
   - Break complex query into logical steps
   - Improve readability and maintainability
   - PostgreSQL optimizer can cache CTE results

2. **JSON Aggregation:**
   - Build nested JSON structure in database (not client-side)
   - Reduces data transfer size
   - Eliminates client-side merging logic

3. **Filtered Aggregations:**
   ```sql
   -- Instead of 2 queries:
   SELECT * FROM trucking_loads WHERE direction = 'INBOUND';
   SELECT * FROM trucking_loads WHERE direction = 'OUTBOUND';

   -- Use FILTER clause:
   json_agg(...) FILTER (WHERE tl.direction = 'INBOUND')
   json_agg(...) FILTER (WHERE tl.direction = 'OUTBOUND')
   ```

4. **Strategic Indexes:**
   - Composite indexes for common query patterns
   - Partial indexes for filtered queries (e.g., `status = 'PENDING'`)
   - Index on foreign keys for fast joins

### React Query Caching

**Cache Configuration:**

```tsx
{
  staleTime: 30 * 1000,        // 30 seconds
  gcTime: 5 * 60 * 1000,       // 5 minutes
  refetchOnMount: 'always',
  refetchOnWindowFocus: true,
  refetchInterval: 60 * 1000,  // 60 seconds
}
```

**Tradeoffs:**

| Setting | Value | Benefit | Tradeoff |
|---------|-------|---------|----------|
| `staleTime` | 30s | Reduces unnecessary refetches | Data may be up to 30s stale |
| `gcTime` | 5 min | Keeps data in memory for quick access | Higher memory usage |
| `refetchInterval` | 60s | Ensures data freshness | Increased server load |

**Optimization Opportunities:**

1. **Increase `staleTime` for less critical data:**
   ```tsx
   // Company summaries (rarely change)
   staleTime: 5 * 60 * 1000,  // 5 minutes

   // Pending approvals (change frequently)
   staleTime: 10 * 1000,  // 10 seconds
   ```

2. **Disable polling for inactive tabs:**
   ```tsx
   refetchInterval: (query) => {
     return document.hidden ? false : 60 * 1000;
   }
   ```

3. **Use `keepPreviousData` for pagination:**
   ```tsx
   {
     queryKey: ['inventory', { page }],
     keepPreviousData: true,  // Show old data while fetching new page
   }
   ```

### Frontend Performance

**Code Splitting:**

```tsx
// Lazy load admin dashboard
const AdminDashboard = React.lazy(() => import('./components/admin/AdminDashboard'));

// In router
<Suspense fallback={<LoadingSpinner />}>
  <AdminDashboard />
</Suspense>
```

**Memoization:**

```tsx
// Memoize expensive calculations
const metrics = useMemo(() => {
  return calculateMetrics(projectSummaries);
}, [projectSummaries]);

// Memoize callbacks
const handleCompanyClick = useCallback((companyId: string) => {
  setSelectedCompanyId(companyId);
}, []);
```

**Virtualization (Future Optimization):**

For >100 companies, implement virtualization:
```tsx
import { FixedSizeList } from 'react-window';

<FixedSizeList
  height={600}
  itemCount={companies.length}
  itemSize={480}
  width="100%"
>
  {({ index, style }) => (
    <div style={style}>
      <CompanyTile company={companies[index]} />
    </div>
  )}
</FixedSizeList>
```

### Database Optimization

**Index Maintenance:**

```sql
-- Analyze table statistics (run weekly)
ANALYZE storage_requests;
ANALYZE trucking_loads;
ANALYZE inventory;

-- Reindex tables (run monthly)
REINDEX TABLE storage_requests;
REINDEX TABLE trucking_loads;
```

**Vacuum (Automatic):**

Supabase runs `VACUUM` automatically, but for heavy write workloads:
```sql
-- Manual vacuum (only if needed)
VACUUM ANALYZE storage_requests;
```

**Query Plan Analysis:**

```sql
EXPLAIN ANALYZE
SELECT get_project_summaries_by_company();
```

Look for:
- Sequential scans (should be index scans)
- High execution time in specific CTEs
- Nested loop joins with high row counts

### Monitoring & Metrics

**Performance Metrics to Track:**

1. **RPC Execution Time:**
   - P50: < 100ms
   - P95: < 500ms
   - P99: < 1000ms

2. **React Query Cache Hit Rate:**
   - Target: > 80%
   - Measure: Ratio of cache hits to total queries

3. **Realtime Subscription Latency:**
   - Target: < 1 second from database change to UI update

4. **Approval Transaction Duration:**
   - Target: < 200ms
   - Includes all 6 operations (request update, rack update, audit log, notification)

**Monitoring Setup (Future):**

- Use Supabase Dashboard → Performance tab
- Set up Sentry for frontend error tracking
- Implement custom logging for RPC function execution times
- Create Grafana dashboard for key metrics

---

## Company Lifecycle Management

### Overview

As of November 10, 2025, the admin dashboard includes **ghost tile filtering** to eliminate tiles for deleted users, admin accounts, and inactive companies. This is accomplished through lifecycle metadata on the `companies` table.

### Company Lifecycle States

Each company can be in one of four lifecycle states:

```
┌──────────────────────────────────────────────────────────┐
│  COMPANY LIFECYCLE STATE MACHINE                          │
├──────────────────────────────────────────────────────────┤
│                                                            │
│  1. ACTIVE CUSTOMER                                        │
│     is_customer = true                                     │
│     is_archived = false                                    │
│     deleted_at = NULL                                      │
│     → Shows in admin dashboard                             │
│                                                            │
│  2. ARCHIVED CUSTOMER                                      │
│     is_customer = true                                     │
│     is_archived = true                                     │
│     archived_at = timestamp                                │
│     → Hidden from dashboard (user deleted or inactive)     │
│                                                            │
│  3. ADMIN ACCOUNT                                          │
│     is_customer = false                                    │
│     → Hidden from customer tiles (internal use)            │
│                                                            │
│  4. SOFT-DELETED                                           │
│     deleted_at = timestamp                                 │
│     → GDPR compliance, data anonymized                     │
│                                                            │
└──────────────────────────────────────────────────────────┘
```

### Schema Changes

**Migration:** `20251110000005_add_company_lifecycle_metadata.sql`

```sql
ALTER TABLE companies
  ADD COLUMN is_customer BOOLEAN DEFAULT true,
  ADD COLUMN is_archived BOOLEAN DEFAULT false,
  ADD COLUMN archived_at TIMESTAMPTZ,
  ADD COLUMN deleted_at TIMESTAMPTZ;

-- Partial index for active customers (optimizes get_company_summaries)
CREATE INDEX idx_companies_active_customers
  ON companies(id, name, domain)
  WHERE is_customer = true AND is_archived = false AND deleted_at IS NULL;
```

### Ghost Filtering Logic

**Migration:** `20251110000006_update_company_summaries_filter_ghosts.sql`

The `get_company_summaries()` RPC function now filters companies with this WHERE clause:

```sql
WHERE
  c.is_customer = true              -- Exclude admin accounts (mpsgroup.ca)
  AND c.is_archived = false         -- Exclude archived companies
  AND c.deleted_at IS NULL          -- Exclude soft-deleted companies
  AND (
    -- Only show if at least one user email exists in auth.users
    EXISTS (
      SELECT 1
      FROM storage_requests sr
      JOIN auth.users u ON u.email = sr.user_email AND u.deleted_at IS NULL
      WHERE sr.company_id = c.id
    )
    OR total_requests = 0  -- Allow companies with zero requests (new customers)
  )
```

**Result:** Admin dashboard now shows ONLY active customers with existing auth users.

### Admin Utility Functions

**Migration:** `20251110000009_add_company_lifecycle_functions.sql`

#### 1. archive_company(company_id UUID)

Archives a company (hides from dashboard):

```typescript
const { data, error } = await supabase.rpc('archive_company', {
  company_id_param: 'uuid-here'
});

// Returns: { success: true, company_name: "...", archived_at: "..." }
```

**Use Cases:**
- User deleted their account
- Company is inactive/no longer a customer
- Test company should be hidden

#### 2. unarchive_company(company_id UUID)

Restores an archived company:

```typescript
const { data, error } = await supabase.rpc('unarchive_company', {
  company_id_param: 'uuid-here'
});

// Returns: { success: true, company_name: "...", unarchived_at: "..." }
```

**Use Cases:**
- User returns after deleting account
- Company becomes active again
- Accidental archival

#### 3. soft_delete_company(company_id UUID)

Soft deletes a company for GDPR compliance:

```typescript
const { data, error } = await supabase.rpc('soft_delete_company', {
  company_id_param: 'uuid-here'
});

// Also anonymizes internal_notes and admin_notes in storage_requests
```

**⚠️ WARNING:** This is permanent. Use `archive_company()` for temporary hiding.

#### 4. mark_company_as_admin(company_id UUID)

Marks a company as internal/non-customer:

```typescript
const { data, error } = await supabase.rpc('mark_company_as_admin', {
  company_id_param: 'uuid-here'
});

// Sets is_customer = false (hides from customer tile carousel)
```

**Use Cases:**
- Internal admin accounts (e.g., mpsgroup.ca)
- Test companies that shouldn't appear as customers

#### 5. get_archived_companies()

Retrieves list of archived companies for admin review:

```typescript
const { data, error } = await supabase.rpc('get_archived_companies');

// Returns array:
// [
//   {
//     id: "uuid",
//     name: "Company Name",
//     domain: "example.com",
//     is_customer: true,
//     archived_at: "2025-11-10T...",
//     deleted_at: null,
//     request_count: 5,
//     last_request_date: "2025-11-05T..."
//   }
// ]
```

### Automatic Archival (Data Migration)

**Migration:** `20251110000007_cleanup_ghost_companies_data.sql`

This migration automatically archives companies with deleted auth users:

```sql
UPDATE companies c
SET is_archived = true, archived_at = now()
WHERE
  is_customer = true
  AND NOT EXISTS (
    SELECT 1
    FROM storage_requests sr
    JOIN auth.users u ON u.email = sr.user_email AND u.deleted_at IS NULL
    WHERE sr.company_id = c.id
  )
  AND EXISTS (
    SELECT 1 FROM storage_requests WHERE company_id = c.id
  );
```

**Also archives:**
- Companies with generic domains (gmail.com, yahoo.com, etc.) and zero requests
- Admin accounts like mpsgroup.ca (marked as `is_customer = false`)

### React Query Cache Settings

**File:** `hooks/useCompanyData.ts`

```typescript
export function useCompanySummaries() {
  return useQuery<CompanySummary[]>({
    queryKey: companyQueryKeys.summaries,
    queryFn: async () => {
      const { data } = await supabase.rpc('get_company_summaries');
      return data;
    },
    staleTime: 30 * 1000, // 30 seconds (reduced from 5 min)
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });
}
```

**Why 30 seconds?**
- Fast enough to remove ghost tiles quickly after archival
- Slow enough to avoid excessive database queries
- Balanced with realtime subscriptions for instant updates on data changes

### Monitoring & Maintenance

#### Weekly Query: Detect Orphaned Companies

Run this query weekly to detect companies that should be archived:

```sql
SELECT id, name, domain, created_at
FROM companies
WHERE is_customer = true
  AND is_archived = false
  AND NOT EXISTS (
    SELECT 1
    FROM storage_requests sr
    JOIN auth.users u ON u.email = sr.user_email AND u.deleted_at IS NULL
    WHERE sr.company_id = companies.id
  )
  AND EXISTS (
    SELECT 1 FROM storage_requests WHERE company_id = companies.id
  );
```

**Expected:** Should return 0 rows. If rows found, investigate or archive.

#### Monthly Report: Archive Rate

```sql
SELECT
  DATE_TRUNC('month', archived_at) as month,
  COUNT(*) as archived_count,
  ARRAY_AGG(name) as company_names
FROM companies
WHERE archived_at IS NOT NULL
GROUP BY month
ORDER BY month DESC;
```

### Troubleshooting

#### Problem: Admin sees NO tiles after deployment

**Cause:** All companies were archived.

**Fix:**
1. Check archived companies:
   ```sql
   SELECT * FROM get_archived_companies();
   ```
2. Unarchive legitimate customers:
   ```sql
   SELECT unarchive_company('company-uuid');
   ```

#### Problem: Ghost tiles still appear after 30 seconds

**Cause:** React Query cache not invalidated or browser cache.

**Fix:**
1. Hard refresh (Ctrl+Shift+R)
2. Check network tab - verify `get_company_summaries()` returns correct data
3. Check database directly:
   ```sql
   SELECT * FROM get_company_summaries();
   ```

#### Problem: Company archived but still has active users

**Cause:** Manual archival or bug in data migration.

**Fix:**
```sql
-- Check if company has active users
SELECT sr.user_email, u.deleted_at
FROM storage_requests sr
JOIN auth.users u ON u.email = sr.user_email
WHERE sr.company_id = 'company-uuid';

-- If active users exist, unarchive
SELECT unarchive_company('company-uuid');
```

### Security Considerations

**RLS Policies:**

- Only admins can UPDATE company metadata (is_customer, is_archived, etc.)
- Customers can still SELECT their own company (existing behavior)
- DELETE is prevented entirely (must use soft delete)

**Migration:** `20251110000008_add_company_metadata_rls_policies.sql`

```sql
CREATE POLICY "Admins can manage company metadata"
  ON companies
  FOR UPDATE
  TO authenticated
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Prevent company deletion"
  ON companies
  FOR DELETE
  TO authenticated
  USING (false);  -- Never allow DELETE
```

### Future Improvements

1. **Automated Archival Cron Job**
   - Run weekly to auto-archive companies with deleted users
   - Send notification to admin when company is auto-archived

2. **Grace Period Before Archival**
   - Add 30-day grace period before auto-archiving
   - Allow user to return and reactivate account

3. **Unarchive UI**
   - Add admin interface to view and unarchive companies
   - Show list of archived companies with "Restore" button

4. **Audit Trail for Lifecycle Changes**
   - Log who archived/unarchived companies and when
   - Store reason for archival (user deleted, manual, etc.)

### Related Migrations

- `20251110000005_add_company_lifecycle_metadata.sql` - Schema changes
- `20251110000006_update_company_summaries_filter_ghosts.sql` - RPC update
- `20251110000007_cleanup_ghost_companies_data.sql` - Data cleanup
- `20251110000008_add_company_metadata_rls_policies.sql` - Security
- `20251110000009_add_company_lifecycle_functions.sql` - Utility functions

### Related Documentation

- **Deployment Guide:** `docs/GHOST_TILES_ELIMINATION_GUIDE.md`
- **Verification Queries:** `supabase/VERIFICATION_GHOST_TILES_ELIMINATION.sql`
- **Database Schema:** `docs/DATABASE_SCHEMA_AND_RLS.md`

---

## Conclusion

The tile-based admin dashboard architecture with atomic approval workflow provides a robust, performant, and maintainable system for managing Roughneck Operations' storage requests, trucking loads, and inventory.

**Key Takeaways:**

1. **Atomic Transactions:** All approval operations succeed or fail together (no partial state)
2. **Optimized Queries:** 99.3% reduction in query count (151 → 1)
3. **Real-time Updates:** Instant UI updates across all connected admins
4. **Type Safety:** Full TypeScript coverage for all data structures
5. **Audit Trail:** Complete logging of all admin actions for compliance

**Next Steps:**

1. **Remove Test Mode:** Delete `20251109000005_test_mode_admin_bypass.sql` migration before production
2. **Add Monitoring:** Set up performance tracking and error alerting
3. **Implement Pickup Workflow:** Add "Pending Pickup Request" state logic
4. **Optimize for Scale:** Implement virtualization if company count exceeds 100
5. **Enhance Security:** Add MFA for admin users, encrypt audit log details

**Support:**

For questions or issues, contact:
- Technical Lead: [Your Name]
- DevOps: [DevOps Contact]
- Product Manager: [PM Contact]

**Document Version:** 1.0 (November 10, 2025)
