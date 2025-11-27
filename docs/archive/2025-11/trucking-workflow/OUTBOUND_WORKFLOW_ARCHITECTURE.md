# Outbound Workflow Architecture

## Overview
The outbound workflow handles customer requests to pick up stored pipe and deliver to well sites. It mirrors the inbound workflow but operates in reverse, decrementing rack occupancy and transitioning inventory from `IN_STORAGE` to `PICKED_UP`.

---

## Trigger Condition

**When**: Total delivered joints equals total requested joints (100% fulfillment)

**Formula**:
```typescript
const totalDelivered = completedInboundLoads.reduce((sum, load) => sum + load.total_joints_completed, 0);
const totalRequested = storageRequest.estimated_quantity;
const isFullyDelivered = totalDelivered >= totalRequested;
```

**UI Impact**:
- Dashboard shows **"Request Outbound Shipment"** button
- Button disabled until 100% delivered
- Tooltip: "X of Y joints delivered - Z more needed"

---

## Customer Workflow (5 Steps)

### Step 1: Request Outbound Shipment
Customer clicks **"Request Outbound Shipment"** from dashboard.

**Wizard Opens**: OutboundShipmentWizard (similar to InboundShipmentWizard)

---

### Step 2: Specify Destination
Customer must provide:
- **Surface Location (LSD)**: Legal Subdivision (e.g., "LSD 06-24-079-15W5")
- **Well Name** (optional): Human-readable name (e.g., "Alpha-7")
- **UWI** (optional): Unique Well Identifier (e.g., "100/06-24-079-15W5/0")

**Validation**: At least ONE of (Well Name OR UWI) must be provided

**Example Form**:
```
Surface Location (LSD): _____________ (required)
Well Name: _____________ (optional if UWI provided)
UWI: _____________ (optional if Well Name provided)
```

---

### Step 3: Choose Shipping Method
- **Customer Arranges**: Customer books their own trucking company
- **MPS Quote**: MPS provides quote and arranges shipping

**If Customer Arranges**:
- Provide trucking company name
- Provide driver name + phone
- Book pickup time slot

**If MPS Quote**:
- MPS admin provides quote amount in approval step
- Customer accepts/rejects quote
- MPS arranges trucking and provides details

---

### Step 4: Book Pickup Time
Same time slot picker as inbound, but:
- **Pickup Location**: Always "MPS E Range Rd #3264, Pierceland, SK S0M 2K0"
- **Delivery Location**: Well site (from Step 2)
- No "Delivery Location" field needed (it's the destination from Step 2)

---

### Step 5: Upload Documents (Optional)
- Bill of Lading (BOL)
- Shipping Manifest
- Well site access permit (if required)

**Note**: Manifest upload is optional for outbound (it's required for inbound because AI extraction is needed)

---

## Admin Workflow (4 Steps)

### Step 1: Review Outbound Request
Admin sees outbound request in **"Pending Outbound Loads"** tab.

**Displays**:
- Company name
- Destination (LSD + Well Name/UWI)
- Requested joints to pick up
- Shipping method (Customer Arranged vs MPS Quote)
- Requested pickup time

**Actions**:
- Approve (moves to "Approved Outbound Loads")
- Reject (with reason - customer can revise and resubmit)
- If MPS Quote: Enter quote amount before approving

---

### Step 2: Mark In Transit
When truck arrives at MPS and loads pipe:

**Admin clicks**: "Mark In Transit"

**Modal opens**: "Mark Picked Up"
- Select which inventory to load (by rack)
- Enter actual joints loaded (must not exceed available)
- Verify manifest (if uploaded)
- Add notes

**Database actions**:
1. Update outbound load status: APPROVED → IN_TRANSIT
2. Update inventory status: IN_STORAGE → PICKED_UP
3. Link inventory to outbound load: `pickup_truck_load_id`
4. **Decrement rack occupancy atomically**:
   - `occupied = occupied - joints_picked_up`
   - `occupied_meters = occupied_meters - meters_picked_up`
5. Record pickup timestamp

---

### Step 3: Mark Delivered to Well
When truck delivers pipe to well site:

**Admin clicks**: "Mark Delivered"

**Database actions**:
1. Update outbound load status: IN_TRANSIT → COMPLETED
2. Update inventory status: PICKED_UP → DELIVERED (new status)
3. Record delivery timestamp

---

### Step 4: Archive Project (When Complete)
When ALL outbound loads are completed:

**Condition**:
```sql
SELECT COUNT(*) FROM inventory
WHERE request_id = ? AND status != 'DELIVERED'
-- If count = 0, all pipe has been picked up
```

**Admin action**: "Archive Project"

**Archives by**:
- Year: Extract from `created_at` (e.g., "2025")
- Company: company.name
- Customer: Request contact name
- Project: storage_requests.reference_id

**Database**:
```sql
UPDATE storage_requests
SET
  archived = true,
  archived_at = NOW(),
  archived_by = 'admin@mpsgroup.ca'
WHERE id = ?;
```

**UI**: Archived projects move to "Archived" tab with filters

---

## Database Schema Changes

### 1. Extend `trucking_loads` Table

```sql
-- Add direction field to distinguish inbound vs outbound
ALTER TABLE trucking_loads ADD COLUMN direction TEXT DEFAULT 'INBOUND' CHECK (direction IN ('INBOUND', 'OUTBOUND'));

-- Add destination fields for outbound loads
ALTER TABLE trucking_loads ADD COLUMN destination_lsd TEXT; -- Legal Subdivision
ALTER TABLE trucking_loads ADD COLUMN destination_well_name TEXT; -- Well name (optional)
ALTER TABLE trucking_loads ADD COLUMN destination_uwi TEXT; -- Unique Well Identifier (optional)

-- Add shipping method for outbound loads
ALTER TABLE trucking_loads ADD COLUMN shipping_method TEXT CHECK (shipping_method IN ('CUSTOMER_ARRANGED', 'MPS_QUOTE'));
ALTER TABLE trucking_loads ADD COLUMN quote_amount NUMERIC(10, 2); -- If MPS_QUOTE selected

-- Add validation constraint: For outbound loads, at least one of (well_name or uwi) must be provided
ALTER TABLE trucking_loads ADD CONSTRAINT outbound_destination_check
CHECK (
  direction = 'INBOUND' OR
  (destination_well_name IS NOT NULL OR destination_uwi IS NOT NULL)
);
```

---

### 2. Extend `inventory` Table

```sql
-- Add pickup tracking fields
ALTER TABLE inventory ADD COLUMN pickup_truck_load_id UUID REFERENCES trucking_loads(id) ON DELETE SET NULL;
ALTER TABLE inventory ADD COLUMN pickup_timestamp TIMESTAMPTZ;

-- Update status enum to include 'DELIVERED' (to well site)
ALTER TABLE inventory DROP CONSTRAINT IF EXISTS inventory_status_check;
ALTER TABLE inventory ADD CONSTRAINT inventory_status_check
CHECK (status IN ('PENDING_DELIVERY', 'IN_STORAGE', 'PICKED_UP', 'DELIVERED', 'IN_TRANSIT'));
```

---

### 3. Extend `storage_requests` Table

```sql
-- Add archival tracking
ALTER TABLE storage_requests ADD COLUMN archived BOOLEAN DEFAULT FALSE;
ALTER TABLE storage_requests ADD COLUMN archived_at TIMESTAMPTZ;
ALTER TABLE storage_requests ADD COLUMN archived_by TEXT;

-- Add index for archived projects filtering
CREATE INDEX idx_storage_requests_archived ON storage_requests(archived, archived_at DESC);
```

---

## SQL Function: `mark_outbound_load_completed_and_clear_rack`

**Purpose**: Atomically mark outbound load as picked up and decrement rack occupancy

**Signature**:
```sql
CREATE OR REPLACE FUNCTION mark_outbound_load_completed_and_clear_rack(
  load_id_param UUID,
  company_id_param UUID,
  request_id_param UUID,
  inventory_ids_param UUID[], -- Array of inventory IDs to pick up
  actual_joints_param INTEGER,
  completion_notes_param TEXT DEFAULT NULL
)
RETURNS JSON
```

**Logic**:
1. Validate load exists and is APPROVED
2. Validate inventory IDs belong to company and are IN_STORAGE
3. Calculate total joints and meters from selected inventory
4. Validate actual_joints_param matches inventory total
5. Update inventory status: IN_STORAGE → PICKED_UP
6. Link inventory to outbound load
7. **Decrement rack occupancy atomically** (one UPDATE per rack affected)
8. Update load status: APPROVED → IN_TRANSIT
9. Return summary JSON

**Atomic Rack Update**:
```sql
-- For each distinct rack in selected inventory:
UPDATE racks
SET
  occupied = occupied - joints_removed,
  occupied_meters = occupied_meters - meters_removed
WHERE id = rack_id
  AND occupied >= joints_removed  -- Safety: prevent negative occupancy
  AND occupied_meters >= meters_removed;

IF NOT FOUND THEN
  RAISE EXCEPTION 'Rack % has insufficient occupancy to remove % joints', rack_id, joints_removed;
END IF;
```

---

## TypeScript Type Changes

### Update `TruckingLoad` Interface

```typescript
export type LoadDirection = 'INBOUND' | 'OUTBOUND';
export type ShippingMethod = 'CUSTOMER_ARRANGED' | 'MPS_QUOTE';

export interface TruckingLoad {
  id: string;
  storageRequestId: string;
  sequenceNumber: number;
  status: TruckingLoadStatus;
  direction: LoadDirection; // NEW

  // Inbound fields (existing)
  scheduledSlotStart?: string;
  scheduledSlotEnd?: string;
  deliveryLocation?: string;

  // Outbound fields (NEW)
  destinationLsd?: string; // Legal Subdivision
  destinationWellName?: string; // Optional if UWI provided
  destinationUwi?: string; // Optional if Well Name provided
  shippingMethod?: ShippingMethod;
  quoteAmount?: number;

  // Common fields
  truckingCompany?: string;
  driverName?: string;
  driverPhone?: string;
  // ... rest of existing fields
}
```

### Update `PipeStatus` Type

```typescript
export type PipeStatus =
  | 'PENDING_DELIVERY' // Inbound: load not yet arrived
  | 'IN_STORAGE'       // At MPS facility
  | 'PICKED_UP'        // Outbound: loaded on truck
  | 'DELIVERED'        // Outbound: delivered to well site
  | 'IN_TRANSIT';      // Either direction: on truck
```

---

## React Components

### New Components

1. **OutboundShipmentWizard.tsx**
   - Similar structure to InboundShipmentWizard
   - Steps: Destination → Shipping Method → Time Slot → Documents → Review

2. **DestinationForm.tsx**
   - Input: Surface Location (LSD)
   - Input: Well Name (optional)
   - Input: UWI (optional)
   - Validation: At least one of (Well Name OR UWI)

3. **MarkPickedUpModal.tsx**
   - Inventory selector (checkboxes by rack)
   - Shows available joints per rack
   - Calculates total joints + meters selected
   - Input: Actual joints loaded
   - Validation: Must match selected inventory

4. **OutboundLoadsTile.tsx**
   - Shows pending/approved/in-transit outbound loads
   - Click to open MarkPickedUpModal

5. **ArchivedProjectsTile.tsx**
   - Shows archived storage requests
   - Filters: Year, Company, Customer, Project
   - Read-only view of completed projects

### Updated Components

1. **Dashboard.tsx**
   - Add "Request Outbound Shipment" button
   - Show condition: `totalDelivered >= totalRequested`
   - Show progress: "87 of 100 joints delivered"

2. **AdminDashboard.tsx**
   - Add "Outbound Loads" tab
   - Add "Archived" tab

---

## Remaining Storage Display

After each outbound load is marked picked up, display:

**Card in Dashboard**:
```
📦 Pipe Remaining in Storage

Total Joints: 13
Total Length: 403.6 ft (123.0 m)
Total Weight: 9,282 lbs (4,210 kg)

Stored in Racks:
- A-A1-5: 8 joints
- A-A1-6: 5 joints
```

**Formula**:
```typescript
const remainingInventory = inventory.filter(i => i.status === 'IN_STORAGE');
const totalJoints = remainingInventory.length;
const totalLength = remainingInventory.reduce((sum, i) => sum + (i.length * i.quantity), 0);
const totalWeight = remainingInventory.reduce((sum, i) => sum + (i.weight * i.length * i.quantity), 0);
```

---

## Validation Rules

### Outbound Load Creation
- ✅ All inbound loads must be COMPLETED
- ✅ `totalDelivered >= totalRequested`
- ✅ Destination LSD format: "LSD XX-XX-XXX-XXW[4|5|6]" (regex validation)
- ✅ At least one of (Well Name OR UWI) provided
- ✅ Pickup time slot available
- ✅ If MPS_QUOTE: Quote amount > 0

### Mark Picked Up
- ✅ Load status = APPROVED
- ✅ Selected inventory all belong to company
- ✅ Selected inventory all status = IN_STORAGE
- ✅ Actual joints loaded = total selected inventory
- ✅ Rack has sufficient occupancy to decrement

### Archival
- ✅ All inventory status = DELIVERED
- ✅ All outbound loads status = COMPLETED
- ✅ No pending inbound or outbound loads

---

## Error Handling

### Common Errors

**Outbound Creation**:
- "Cannot request outbound shipment: Only X of Y joints delivered"
- "Invalid LSD format: Must match LSD XX-XX-XXX-XXW[4|5|6]"
- "Must provide either Well Name or UWI"

**Mark Picked Up**:
- "Rack A-A1-5 has insufficient occupancy: 10 available, 15 requested"
- "Inventory mismatch: Selected 42 joints but entered 45 actual joints"
- "Cannot pick up inventory from rack A-A1-5: Rack not found"

**Archival**:
- "Cannot archive: 13 joints still in storage"
- "Cannot archive: Outbound load #2 still in transit"

---

## Success Criteria

### Outbound Workflow Complete When:
- ✅ Customer can request outbound shipment when 100% delivered
- ✅ Destination validation works (LSD + Well Name OR UWI)
- ✅ Admin can approve/reject outbound requests
- ✅ Admin can mark loads picked up with inventory selection
- ✅ Rack occupancy decrements correctly
- ✅ Remaining storage totals update in real-time
- ✅ Project archives when all loads completed
- ✅ Archived projects filterable by Year/Company/Customer/Project

---

## Testing Checklist (For Kyle)

### Outbound Request
- [ ] Button only appears when 100% delivered
- [ ] LSD validation rejects invalid formats
- [ ] Form rejects if neither Well Name nor UWI provided
- [ ] Time slot picker works for pickup times
- [ ] MPS Quote vs Customer Arranged both work

### Admin Pickup
- [ ] Inventory selector shows correct racks
- [ ] Can't select more joints than available
- [ ] Rack occupancy decrements correctly
- [ ] Can't pick up same inventory twice

### Archival
- [ ] Can't archive until all loads completed
- [ ] Archived projects appear in "Archived" tab
- [ ] Filters work (Year/Company/Customer/Project)
- [ ] Archived projects are read-only

---

## Performance Considerations

### Indexes
```sql
-- Speed up outbound load queries
CREATE INDEX idx_trucking_loads_direction ON trucking_loads(direction, status);

-- Speed up inventory pickup queries
CREATE INDEX idx_inventory_pickup ON inventory(pickup_truck_load_id, pickup_timestamp) WHERE pickup_truck_load_id IS NOT NULL;

-- Speed up archived project queries
CREATE INDEX idx_storage_requests_archived ON storage_requests(archived, archived_at DESC);
```

---

## Deployment Notes

**Migration Order**:
1. `20251113000001_add_outbound_fields.sql` - Add columns to tables
2. `20251113000002_mark_outbound_load_completed.sql` - Create SQL function
3. Deploy frontend code with new components
4. Test with one company end-to-end
5. Monitor error logs for 24 hours
6. Full rollout

**Rollback Plan**:
- Migrations are additive (new columns nullable)
- Can roll back frontend without breaking existing data
- If critical bug: disable "Request Outbound Shipment" button via feature flag

---

## Future Enhancements (Not in Scope)

- Email notifications when outbound load approved
- SMS alerts when truck arrives for pickup
- GPS tracking for outbound loads
- Automatic BOL generation with QR codes
- Customer portal to track pipe in transit
- Integration with well site access scheduling systems
