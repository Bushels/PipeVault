# Load Lifecycle Data Flow Specification

**Version:** 1.0
**Date:** 2025-11-12
**Related:** LOAD_LIFECYCLE_STATE_MACHINE.md

---

## Overview

This document specifies the exact data flow between database tables at each state transition in the load lifecycle. Every transition must follow this specification precisely.

---

## Data Flow Diagram

```
Customer Booking (NEW)
         ↓
┌─────────────────────┐
│ trucking_loads      │
│ - status: NEW       │
│ - planned totals    │
│ - scheduled times   │
└─────────────────────┘
         ↓
┌─────────────────────┐
│ trucking_documents  │
│ - PDF files         │
│ - parsed_payload    │
└─────────────────────┘
         ↓
┌─────────────────────┐
│ Slack webhook       │
│ (admin notification)│
└─────────────────────┘

Admin Approval (APPROVED)
         ↓
┌─────────────────────┐
│ trucking_loads      │
│ - status: APPROVED  │
│ - approved_at       │
└─────────────────────┘
         ↓
┌─────────────────────┐
│ Slack webhook       │
│ (customer notif.)   │
└─────────────────────┘

Mark In Transit (IN_TRANSIT)
         ↓
┌─────────────────────┐
│ trucking_loads      │
│ - status: IN_TRANSIT│
│ - in_transit_at     │
└─────────────────────┘
         ↓
┌─────────────────────┐
│ Slack webhook       │
│ (customer notif.)   │
└─────────────────────┘

Mark Completed (COMPLETED)
         ↓
┌─────────────────────┐
│ trucking_loads      │
│ - status: COMPLETED │
│ - completed_at      │
│ - *_completed       │
└─────────────────────┘
         ↓
┌─────────────────────┐
│ inventory (bulk)    │
│ - one row per joint │
│ - from manifest     │
└─────────────────────┘
         ↓
┌─────────────────────┐
│ storage_areas       │
│ - occupied_count ++ │
└─────────────────────┘
         ↓
┌─────────────────────┐
│ storage_requests    │
│ - progress updated  │
└─────────────────────┘
         ↓
┌─────────────────────┐
│ Slack webhook       │
│ (customer notif.)   │
└─────────────────────┘
```

---

## Transition 1: Customer Books Load (→ NEW)

### Input Data
```typescript
interface LoadBookingInput {
  storageRequestId: string;
  companyId: string;
  customerId: string;

  // Storage location
  storageYardAddress: string;
  storageContactName: string;
  storageContactEmail: string;
  storageContactPhone: string;

  // Trucking details
  truckingCompanyName: string;
  driverName: string;
  driverPhone: string;

  // Scheduling
  scheduledSlotStart: string; // ISO timestamp
  scheduledSlotEnd: string;   // ISO timestamp
  isAfterHours: boolean;
  surchargeAmount?: number;

  // Documents
  uploadedDocuments: UploadedDocument[];

  // Manifest data (AI extracted or manual)
  parsedManifestItems?: ManifestItem[];
  totalJointsPlanned?: number;
  totalLengthFtPlanned?: number;
  totalWeightTonnesPlanned?: number;
}
```

### Database Operations

#### Step 1: Calculate Sequence Number
```sql
-- Query latest load for this request
SELECT MAX(sequence_number) as latest
FROM trucking_loads
WHERE storage_request_id = $1
  AND direction = 'INBOUND';

-- Increment: nextSequence = (latest ?? 0) + 1
```

#### Step 2: Insert trucking_loads Row
```sql
INSERT INTO trucking_loads (
  id,                      -- UUID generated
  storage_request_id,      -- From input
  company_id,              -- From input
  direction,               -- 'INBOUND'
  sequence_number,         -- From step 1
  status,                  -- 'NEW' (always)

  -- Scheduling
  scheduled_slot_start,    -- From input
  scheduled_slot_end,      -- From input
  is_after_hours,          -- From input
  after_hours_surcharge,   -- From input (if applicable)

  -- Trucking company
  trucking_company,        -- From input
  driver_name,             -- From input
  driver_phone,            -- From input

  -- Storage location
  origin_address,          -- From input (storageYardAddress)
  destination_address,     -- 'MPS Facility' (constant)

  -- Planned totals (from AI extraction or customer input)
  total_joints_planned,    -- From parsed manifest or input
  total_length_ft_planned, -- From parsed manifest or input
  total_weight_tonnes_planned, -- From parsed manifest or input

  -- Timestamps
  created_at,              -- NOW()
  updated_at               -- NOW()
)
RETURNING *;
```

#### Step 3: Insert trucking_documents Rows
```sql
-- For each uploaded document
INSERT INTO trucking_documents (
  id,                      -- UUID generated
  trucking_load_id,        -- From step 2
  company_id,              -- From input
  uploaded_by,             -- Customer user ID
  document_type,           -- 'MANIFEST' | 'BOL' | 'OTHER'
  file_name,               -- Original filename
  file_path,               -- Supabase Storage path
  file_size,               -- In bytes
  mime_type,               -- e.g. 'application/pdf'

  -- AI extraction results
  parsed_payload,          -- ManifestItem[] (JSONB)
  extraction_status,       -- 'SUCCESS' | 'FAILED' | 'PENDING'

  -- Timestamps
  uploaded_at              -- NOW()
)
RETURNING *;
```

#### Step 4: Send Slack Notification (Admin)
```typescript
await sendInboundDeliveryNotification({
  load: {
    id: newLoad.id,
    sequenceNumber: newLoad.sequence_number,
    scheduledSlotStart: newLoad.scheduled_slot_start,
    scheduledSlotEnd: newLoad.scheduled_slot_end,
  },
  company: {
    name: companyName,
  },
  driver: {
    name: newLoad.driver_name,
    phone: newLoad.driver_phone,
  },
  manifest: {
    joints: newLoad.total_joints_planned,
    hasDocuments: uploadedDocuments.length > 0,
  }
});
```

### Output State
```typescript
interface LoadCreatedState {
  load: TruckingLoad;        // status: 'NEW'
  documents: TruckingDocument[];
  nextSequence: number;
  notification: 'sent' | 'failed';
}
```

### Validation Rules
- ✅ `storage_request_id` must exist in `storage_requests`
- ✅ `company_id` must match request company
- ✅ `scheduled_slot_start` must be in future
- ✅ `scheduled_slot_end` > `scheduled_slot_start`
- ✅ `total_joints_planned` > 0 (if provided)
- ✅ At least one document uploaded (or manifest data provided)

---

## Transition 2: Admin Approves Load (NEW → APPROVED)

### Input Data
```typescript
interface ApproveLoadInput {
  loadId: string;
  adminUserId: string;
  adminEmail: string;
}
```

### Database Operations

#### Step 1: Fetch Current Load
```sql
SELECT *
FROM trucking_loads
WHERE id = $1;

-- Validate current status
IF status != 'NEW' THEN
  RAISE EXCEPTION 'Can only approve loads with status NEW';
END IF;
```

#### Step 2: Update trucking_loads Status
```sql
UPDATE trucking_loads
SET
  status = 'APPROVED',
  approved_at = NOW(),
  approved_by = $2,  -- Admin user ID
  updated_at = NOW()
WHERE id = $1
RETURNING *;
```

#### Step 3: Invalidate Query Caches
```typescript
queryClient.invalidateQueries({ queryKey: ['trucking-loads', 'pending'] });
queryClient.invalidateQueries({ queryKey: ['trucking-loads', 'pending', 'count'] });
queryClient.invalidateQueries({ queryKey: ['trucking-loads', 'details', loadId] });
queryClient.invalidateQueries({ queryKey: ['company-data', companyId] });

// CRITICAL: Invalidate blocking query so customer can book next load
queryClient.invalidateQueries({
  queryKey: ['trucking-loads', 'pending-for-request', storageRequestId]
});
```

#### Step 4: Send Slack Notification (Customer)
```typescript
await notifyLoadApproved({
  load: {
    id: load.id,
    sequenceNumber: load.sequence_number,
    scheduledSlotStart: load.scheduled_slot_start,
    scheduledSlotEnd: load.scheduled_slot_end,
    truckingCompany: load.trucking_company,
    driverName: load.driver_name,
    totalJointsPlanned: load.total_joints_planned,
  },
  company: {
    id: company.id,
    name: company.name,
    domain: company.domain,
  },
  admin: {
    userId: adminUserId,
    email: adminEmail,
  }
});
```

### Output State
```typescript
interface LoadApprovedState {
  load: TruckingLoad;        // status: 'APPROVED'
  approvedAt: Date;
  approvedBy: string;
  notification: 'sent' | 'failed';
}
```

### Side Effects
- ✅ Customer blocking cleared (can book next load)
- ✅ Load appears in admin "Approved Loads" tab
- ✅ Load removed from admin "Pending Loads" tab
- ✅ Customer sees "Load #X approved and scheduled"

---

## Transition 3: Admin Marks In Transit (APPROVED → IN_TRANSIT)

### Input Data
```typescript
interface MarkInTransitInput {
  loadId: string;
  adminUserId: string;
  departureTime?: Date;  // Optional, defaults to NOW()
}
```

### Database Operations

#### Step 1: Validate Current State
```sql
SELECT *
FROM trucking_loads
WHERE id = $1;

-- Validate transition
IF status != 'APPROVED' THEN
  RAISE EXCEPTION 'Can only mark APPROVED loads as in transit';
END IF;
```

#### Step 2: Update trucking_loads Status
```sql
UPDATE trucking_loads
SET
  status = 'IN_TRANSIT',
  in_transit_at = COALESCE($2, NOW()),  -- Use provided time or NOW()
  updated_at = NOW()
WHERE id = $1
RETURNING *;
```

#### Step 3: Invalidate Query Caches
```typescript
queryClient.invalidateQueries({ queryKey: ['trucking-loads', 'approved'] });
queryClient.invalidateQueries({ queryKey: ['trucking-loads', 'in-transit'] });
queryClient.invalidateQueries({ queryKey: ['trucking-loads', 'details', loadId] });
queryClient.invalidateQueries({ queryKey: ['company-data', companyId] });
```

#### Step 4: Send Slack Notification (Customer)
```typescript
await notifyLoadInTransit({
  load: {
    id: load.id,
    sequenceNumber: load.sequence_number,
    driverName: load.driver_name,
    driverPhone: load.driver_phone,
    estimatedArrival: load.scheduled_slot_end,
    totalJointsPlanned: load.total_joints_planned,
  },
  company: {
    id: company.id,
    name: company.name,
    domain: company.domain,
  }
});
```

### Output State
```typescript
interface LoadInTransitState {
  load: TruckingLoad;        // status: 'IN_TRANSIT'
  inTransitAt: Date;
  estimatedArrival: Date;
  notification: 'sent' | 'failed';
}
```

### Side Effects
- ✅ Load appears in admin "In Transit" tab
- ✅ Load removed from admin "Approved Loads" tab
- ✅ Customer sees "Load #X en route to MPS"
- ✅ ETA countdown shown to customer

---

## Transition 4: Admin Marks Completed (IN_TRANSIT → COMPLETED)

**This is the most complex transition - involves inventory creation**

### Input Data
```typescript
interface MarkCompletedInput {
  loadId: string;
  adminUserId: string;

  // Completion details (from admin form)
  arrivalTime?: Date;          // Defaults to NOW()
  actualJointsReceived: number; // Can differ from planned
  storageAreaId: string;        // Rack assignment (required)
  damageNotes?: string;
  photos?: UploadedFile[];

  // Manifest reconciliation
  manifestItems: ManifestItem[]; // From parsed_payload or manual entry
}

interface ManifestItem {
  serialNumber: string;
  heatNumber: string;
  pipeType: string;
  outerDiameter: number;
  wallThickness: number;
  grade: string;
  connectionType: string;
  lengthMeters: number;
  isDamaged?: boolean;
  damageNotes?: string;
}
```

### Database Operations (ATOMIC TRANSACTION REQUIRED)

#### Step 1: Validate Current State
```sql
SELECT *
FROM trucking_loads
WHERE id = $1;

-- Validate transition
IF status != 'IN_TRANSIT' THEN
  RAISE EXCEPTION 'Can only mark IN_TRANSIT loads as completed';
END IF;
```

#### Step 2: Validate Rack Capacity
```sql
SELECT capacity, occupied_count
FROM storage_areas
WHERE id = $2;

-- Check capacity
IF (occupied_count + $3) > capacity THEN
  RAISE EXCEPTION 'Rack capacity exceeded: % occupied, % capacity, % incoming',
    occupied_count, capacity, $3;
END IF;
```

#### Step 3: Update trucking_loads Status
```sql
UPDATE trucking_loads
SET
  status = 'COMPLETED',
  completed_at = COALESCE($2, NOW()),
  completed_by = $3,  -- Admin user ID

  -- Actual values (may differ from planned)
  total_joints_completed = $4,
  total_length_ft_completed = (
    SELECT SUM(length_meters * 3.28084)
    FROM parsed_manifest_items
  ),
  total_weight_tonnes_completed = (
    SELECT SUM(weight_kg / 1000)
    FROM parsed_manifest_items
  ),

  -- Completion notes
  completion_notes = $5,  -- Damage notes, if any

  updated_at = NOW()
WHERE id = $1
RETURNING *;
```

#### Step 4: Create Inventory Records (BULK INSERT)
```sql
-- Insert one inventory row per joint from manifest
INSERT INTO inventory (
  id,
  delivery_truck_load_id,
  company_id,
  storage_request_id,
  storage_area_id,  -- Rack assignment

  -- Pipe specifications
  pipe_type,
  outer_diameter,
  wall_thickness,
  grade,
  connection_type,
  heat_number,
  serial_number,
  length_meters,

  -- Status
  status,  -- 'IN_STORAGE' (not PENDING_DELIVERY)

  -- Damage tracking
  is_damaged,
  damage_notes,

  -- Timestamps
  created_at,
  received_at
)
SELECT
  gen_random_uuid(),
  $1,  -- load_id
  $2,  -- company_id
  $3,  -- storage_request_id
  $4,  -- storage_area_id (rack)

  -- From manifest items
  item.pipe_type,
  item.outer_diameter,
  item.wall_thickness,
  item.grade,
  item.connection_type,
  item.heat_number,
  item.serial_number,
  item.length_meters,

  'IN_STORAGE',  -- Status

  COALESCE(item.is_damaged, false),
  item.damage_notes,

  NOW(),
  NOW()
FROM UNNEST($5::manifest_item[]) AS item;  -- Bulk insert from array

-- Returns count of rows inserted
```

#### Step 5: Update Rack Occupancy
```sql
UPDATE storage_areas
SET
  occupied_count = occupied_count + $2,
  updated_at = NOW()
WHERE id = $1;
```

#### Step 6: Update Storage Request Progress
```sql
-- Aggregate totals from all COMPLETED loads for this request
WITH load_totals AS (
  SELECT
    storage_request_id,
    SUM(total_joints_completed) as total_delivered,
    SUM(total_length_ft_completed) as total_length,
    SUM(total_weight_tonnes_completed) as total_weight
  FROM trucking_loads
  WHERE storage_request_id = $1
    AND status = 'COMPLETED'
    AND direction = 'INBOUND'
  GROUP BY storage_request_id
)
UPDATE storage_requests sr
SET
  -- Update progress fields (if they exist in schema)
  joints_delivered = COALESCE(lt.total_delivered, 0),
  updated_at = NOW()
FROM load_totals lt
WHERE sr.id = lt.storage_request_id;
```

#### Step 7: Invalidate Query Caches
```typescript
queryClient.invalidateQueries({ queryKey: ['trucking-loads', 'in-transit'] });
queryClient.invalidateQueries({ queryKey: ['trucking-loads', 'completed'] });
queryClient.invalidateQueries({ queryKey: ['trucking-loads', 'details', loadId] });
queryClient.invalidateQueries({ queryKey: ['inventory', 'by-request', requestId] });
queryClient.invalidateQueries({ queryKey: ['storage-areas', rackId] });
queryClient.invalidateQueries({ queryKey: ['company-data', companyId] });
queryClient.invalidateQueries({ queryKey: ['storage-requests', requestId] });
```

#### Step 8: Send Slack Notification (Customer)
```typescript
await notifyLoadCompleted({
  load: {
    id: load.id,
    sequenceNumber: load.sequence_number,
    jointsReceived: actualJointsReceived,
    rackLocation: rackName,
    completedAt: completionTime,
  },
  company: {
    id: company.id,
    name: company.name,
    domain: company.domain,
  },
  inventory: {
    totalOnSite: totalJointsOnSite,
    availableCapacity: remainingCapacity,
  }
});
```

### Transaction Rollback Conditions
If ANY of the following fail, rollback entire transaction:
- ❌ Rack capacity validation fails
- ❌ Inventory bulk insert fails
- ❌ Rack occupancy update fails
- ❌ Load status update fails

**On rollback:** Load status remains IN_TRANSIT, no inventory created

### Output State
```typescript
interface LoadCompletedState {
  load: TruckingLoad;           // status: 'COMPLETED'
  completedAt: Date;
  completedBy: string;
  inventoryRecords: Inventory[]; // Array of created records
  rackUpdated: {
    id: string;
    occupiedCount: number;
    availableCount: number;
  };
  requestProgress: {
    jointsDelivered: number;
    totalJoints: number;
    percentComplete: number;
  };
  notification: 'sent' | 'failed';
}
```

### Side Effects
- ✅ Load appears in admin "Completed Loads" tab
- ✅ Load removed from admin "In Transit" tab
- ✅ Inventory records created (one per joint)
- ✅ Rack occupancy incremented
- ✅ Request progress updated
- ✅ Customer sees "Load #X stored at MPS"
- ✅ Customer can see inventory count
- ✅ Customer can book next load (if blocked)

---

## Transition 5: Admin Rejects Load (NEW → REJECTED)

### Input Data
```typescript
interface RejectLoadInput {
  loadId: string;
  adminUserId: string;
  reason: string;  // Min 10 characters
}
```

### Database Operations

#### Step 1: Validate Current State
```sql
SELECT *
FROM trucking_loads
WHERE id = $1;

-- Validate transition
IF status != 'NEW' THEN
  RAISE EXCEPTION 'Can only reject loads with status NEW';
END IF;
```

#### Step 2: Update trucking_loads Status
```sql
UPDATE trucking_loads
SET
  status = 'REJECTED',
  rejected_at = NOW(),
  rejected_by = $2,  -- Admin user ID
  rejection_reason = $3,
  updated_at = NOW()
WHERE id = $1
RETURNING *;
```

#### Step 3: Invalidate Query Caches
```typescript
queryClient.invalidateQueries({ queryKey: ['trucking-loads', 'pending'] });
queryClient.invalidateQueries({ queryKey: ['trucking-loads', 'pending', 'count'] });
queryClient.invalidateQueries({ queryKey: ['trucking-loads', 'rejected'] });
queryClient.invalidateQueries({ queryKey: ['trucking-loads', 'details', loadId] });

// Clear blocking query (customer can create new load)
queryClient.invalidateQueries({
  queryKey: ['trucking-loads', 'pending-for-request', storageRequestId]
});
```

#### Step 4: Send Slack Notification (Customer)
```typescript
await notifyLoadRejected({
  load: {
    id: load.id,
    sequenceNumber: load.sequence_number,
    scheduledSlotStart: load.scheduled_slot_start,
    truckingCompany: load.trucking_company,
    driverName: load.driver_name,
  },
  company: {
    id: company.id,
    name: company.name,
    domain: company.domain,
  },
  admin: {
    userId: adminUserId,
    email: adminEmail,
  },
  reason: rejectionReason
});
```

### Output State
```typescript
interface LoadRejectedState {
  load: TruckingLoad;        // status: 'REJECTED'
  rejectedAt: Date;
  rejectedBy: string;
  reason: string;
  notification: 'sent' | 'failed';
}
```

### Side Effects
- ✅ Load removed from admin "Pending Loads" tab
- ✅ Load appears in admin "Rejected Loads" (historical)
- ✅ Customer sees rejection with reason
- ✅ Customer can create new load
- ✅ Sequential blocking cleared

---

## Query Patterns

### Admin: Get Pending Loads
```sql
SELECT
  tl.*,
  sr.reference_id as request_reference,
  c.name as company_name,
  COUNT(td.id) as document_count
FROM trucking_loads tl
LEFT JOIN storage_requests sr ON tl.storage_request_id = sr.id
LEFT JOIN companies c ON tl.company_id = c.id
LEFT JOIN trucking_documents td ON td.trucking_load_id = tl.id
WHERE tl.status = 'NEW'
  AND tl.direction = 'INBOUND'
GROUP BY tl.id, sr.reference_id, c.name
ORDER BY tl.scheduled_slot_start ASC;
```

### Admin: Get Approved Loads (Awaiting Departure)
```sql
SELECT
  tl.*,
  sr.reference_id as request_reference,
  c.name as company_name,
  (tl.scheduled_slot_start - NOW()) as time_until_departure
FROM trucking_loads tl
LEFT JOIN storage_requests sr ON tl.storage_request_id = sr.id
LEFT JOIN companies c ON tl.company_id = c.id
WHERE tl.status = 'APPROVED'
  AND tl.direction = 'INBOUND'
ORDER BY tl.scheduled_slot_start ASC;
```

### Admin: Get In Transit Loads
```sql
SELECT
  tl.*,
  sr.reference_id as request_reference,
  c.name as company_name,
  (tl.scheduled_slot_end - NOW()) as eta
FROM trucking_loads tl
LEFT JOIN storage_requests sr ON tl.storage_request_id = sr.id
LEFT JOIN companies c ON tl.company_id = c.id
WHERE tl.status = 'IN_TRANSIT'
  AND tl.direction = 'INBOUND'
ORDER BY tl.scheduled_slot_end ASC;
```

### Customer: Get Load Status for Request
```sql
SELECT
  tl.*,
  sa.name as rack_name,
  sa.yard_id,
  COUNT(i.id) as inventory_count
FROM trucking_loads tl
LEFT JOIN storage_areas sa ON tl.storage_area_id = sa.id
LEFT JOIN inventory i ON i.delivery_truck_load_id = tl.id
WHERE tl.storage_request_id = $1
  AND tl.direction = 'INBOUND'
GROUP BY tl.id, sa.name, sa.yard_id
ORDER BY tl.sequence_number ASC;
```

### Customer: Check Sequential Blocking
```sql
SELECT *
FROM trucking_loads
WHERE storage_request_id = $1
  AND direction = 'INBOUND'
  AND status NOT IN ('COMPLETED', 'REJECTED')
ORDER BY sequence_number DESC
LIMIT 1;

-- If this returns a row, customer is blocked
-- If this returns NULL, customer can book
```

---

## Performance Optimization

### Database Indexes (Required)
```sql
-- Load queries by status
CREATE INDEX idx_trucking_loads_status_direction
ON trucking_loads(status, direction);

-- Sequential blocking query
CREATE INDEX idx_trucking_loads_request_status
ON trucking_loads(storage_request_id, status, direction);

-- Company load queries
CREATE INDEX idx_trucking_loads_company_status
ON trucking_loads(company_id, status, direction);

-- Inventory by load
CREATE INDEX idx_inventory_load
ON inventory(delivery_truck_load_id);

-- Inventory by request
CREATE INDEX idx_inventory_request_status
ON inventory(storage_request_id, status);
```

### Query Caching Strategy
```typescript
// Short-lived cache (10s) for real-time data
queryKey: ['trucking-loads', 'pending']
staleTime: 10 * 1000

// Medium cache (30s) for less dynamic data
queryKey: ['trucking-loads', 'details', loadId]
staleTime: 30 * 1000

// Long cache (60s) for historical data
queryKey: ['trucking-loads', 'completed']
staleTime: 60 * 1000
```

---

## Error Handling

### Database Errors
```typescript
try {
  await supabase.from('trucking_loads').update({ status: 'COMPLETED' });
} catch (error) {
  if (error.code === '23505') {
    // Unique constraint violation (e.g., duplicate serial number)
    return { error: 'Duplicate serial number detected' };
  }
  if (error.code === '23503') {
    // Foreign key violation (e.g., invalid rack ID)
    return { error: 'Invalid rack assignment' };
  }
  // Generic error
  return { error: 'Database operation failed' };
}
```

### Transaction Rollback
```typescript
// Pseudo-code for completion transaction
BEGIN TRANSACTION;
  UPDATE trucking_loads SET status = 'COMPLETED';
  INSERT INTO inventory (bulk);
  UPDATE storage_areas SET occupied_count = occupied_count + X;
  UPDATE storage_requests SET joints_delivered = joints_delivered + X;
COMMIT;

-- If ANY operation fails, entire transaction rolled back
-- Load remains IN_TRANSIT
```

---

**End of Data Flow Specification**

All mutations and data operations must follow these exact patterns.
