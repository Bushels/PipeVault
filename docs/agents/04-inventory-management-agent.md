# Inventory Management Agent Playbook

## Identity
- **Agent Name**: Inventory Management Agent
- **Primary Role**: Track pipe from arrival to delivery, manage quantities and locations
- **Domain**: Inventory lifecycle, rack allocation, quantity tracking, storage logistics
- **Priority**: Critical (physical asset management)

---

## Responsibilities

### Core Duties
1. **Inventory Lifecycle Tracking**
   - Track pipe from arrival at MPS to delivery at well site
   - Manage status transitions (PENDING_DELIVERY → IN_STORAGE → PENDING_PICKUP → IN_TRANSIT → DELIVERED)
   - Ensure every joint is accounted for
   - Handle partial pickups and deliveries

2. **Rack Location Management**
   - Assign inventory to specific racks on arrival
   - Update rack occupancy when inventory added/removed
   - Support multiple allocation modes (LINEAR_CAPACITY, SLOT)
   - Track which customer owns which pipe in which rack

3. **Quantity Reconciliation**
   - Match delivered quantities to manifest data
   - Compare AI-extracted totals vs physical counts
   - Flag discrepancies for admin review
   - Maintain accurate joint/length/weight records

4. **Storage Area Coordination**
   - Manage 3 yard areas (A, B, C) with different capacities
   - Area A: 22 slots (slot-based allocation)
   - Areas B/C: Joint-based capacity tracking
   - Prevent over-allocation

5. **Company Segregation**
   - Ensure inventory properly scoped to company_id
   - Prevent mixing customer pipe in same rack (business rule)
   - Track which companies have pipe in which areas
   - Support RLS policies for customer visibility

6. **Reporting & Analytics**
   - Generate inventory reports by company
   - Calculate total pipe in storage (joints, meters, tonnes)
   - Track dwell time (days in storage)
   - Identify slow-moving inventory

---

## Inventory Data Model

### `inventory` Table
**Schema**: `supabase/schema.sql`

```sql
CREATE TABLE inventory (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id),
  reference_id TEXT NOT NULL,
  type TEXT NOT NULL, -- OCTG, Line Pipe, Casing, Tubing
  grade TEXT, -- L80, P110, X52, etc.
  outer_diameter NUMERIC, -- inches
  weight NUMERIC, -- lbs/ft
  length NUMERIC, -- feet per joint
  quantity INTEGER NOT NULL, -- number of joints
  status TEXT NOT NULL, -- inventory_status enum
  storage_area_id TEXT REFERENCES racks(id),
  delivery_truck_load_id UUID REFERENCES trucking_loads(id),
  pickup_truck_load_id UUID REFERENCES trucking_loads(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, reference_id)
);
```

### Status Enum
```sql
CREATE TYPE inventory_status AS ENUM (
  'PENDING_DELIVERY',  -- Scheduled but not arrived
  'IN_STORAGE',        -- Arrived and stored at MPS
  'PENDING_PICKUP',    -- Outbound scheduled
  'IN_TRANSIT',        -- On truck to well site
  'DELIVERED'          -- Delivered to customer site
);
```

### Relationships
- **company_id** → `companies` table (ownership)
- **storage_area_id** → `racks` table (physical location)
- **delivery_truck_load_id** → `trucking_loads` (inbound shipment)
- **pickup_truck_load_id** → `trucking_loads` (outbound shipment)

---

## Inventory Lifecycle

### Stage 1: Pending Delivery
**Trigger**: Admin approves storage request, customer schedules inbound delivery
**Status**: `PENDING_DELIVERY`
**Actions**:
- Create inventory record with estimated quantities
- Link to inbound trucking_load via delivery_truck_load_id
- storage_area_id = NULL (not yet assigned)

**Example**:
```typescript
const inventoryRecord = {
  company_id: request.company_id,
  reference_id: request.reference_id,
  type: request.request_details.item_type,
  grade: request.request_details.grade,
  outer_diameter: request.request_details.outer_diameter,
  quantity: estimatedJoints, // From customer estimate
  status: 'PENDING_DELIVERY',
  delivery_truck_load_id: truckLoad.id,
};
```

---

### Stage 2: Arrival & Rack Assignment
**Trigger**: Admin marks trucking load as ARRIVED
**Status**: `PENDING_DELIVERY` → `IN_STORAGE`
**Actions**:
1. Admin reviews manifest (AI-extracted data)
2. Admin assigns rack location (storage_area_id)
3. Update inventory status to IN_STORAGE
4. Update rack occupancy (increment by quantity)
5. Reconcile manifest vs estimate (flag discrepancies)

**Rack Assignment Logic**:
```typescript
const assignToRack = async (inventoryId: string, rackId: string, actualJoints: number) => {
  // 1. Get rack details
  const rack = await supabase
    .from('racks')
    .select('*')
    .eq('id', rackId)
    .single();

  // 2. Check capacity
  const available = rack.capacity - rack.occupied;
  if (actualJoints > available) {
    throw new Error(`Insufficient capacity. Available: ${available}, Required: ${actualJoints}`);
  }

  // 3. Update inventory
  await supabase
    .from('inventory')
    .update({
      status: 'IN_STORAGE',
      storage_area_id: rackId,
      quantity: actualJoints, // Update from manifest
    })
    .eq('id', inventoryId);

  // 4. Update rack occupancy
  await supabase
    .from('racks')
    .update({
      occupied: rack.occupied + actualJoints,
    })
    .eq('id', rackId);
};
```

**File**: Logic currently in `components/admin/AdminDashboard.tsx` (approval handler)

---

### Stage 3: Storage Period
**Status**: `IN_STORAGE`
**Actions**:
- Track dwell time (days since arrival)
- Monitor for storage deadline approaching
- Display in customer dashboard with rack location
- Include in inventory reports

**Customer View**: `components/Dashboard.tsx`
- Shows rack location (e.g., "Yard A, Rack A-A1-05")
- Displays quantity in storage
- Shows storage duration (days)

---

### Stage 4: Pickup Request
**Trigger**: Customer requests outbound delivery to well site
**Status**: `IN_STORAGE` → `PENDING_PICKUP`
**Actions**:
1. Customer creates outbound trucking load
2. Selects which inventory to pick up (can be partial)
3. Link inventory to pickup_truck_load_id
4. Status changes to PENDING_PICKUP
5. Rack occupancy NOT updated yet (pipe still physically there)

**Partial Pickup**:
```typescript
// If customer picks up 50 of 100 joints:
// 1. Update existing inventory to quantity=50, status=IN_STORAGE
// 2. Create new inventory record: quantity=50, status=PENDING_PICKUP
```

---

### Stage 5: Outbound Transit
**Trigger**: Truck departs MPS facility
**Status**: `PENDING_PICKUP` → `IN_TRANSIT`
**Actions**:
1. Admin marks trucking load as IN_TRANSIT
2. Update inventory status to IN_TRANSIT
3. Update rack occupancy (decrement by quantity)
4. Send email to customer: "Your pipe is on the way!"

**Rack Occupancy Update**:
```typescript
const markInTransit = async (inventoryId: string) => {
  const inventory = await supabase
    .from('inventory')
    .select('*, racks(*)')
    .eq('id', inventoryId)
    .single();

  // Update rack occupancy
  await supabase
    .from('racks')
    .update({
      occupied: inventory.racks.occupied - inventory.quantity,
    })
    .eq('id', inventory.storage_area_id);

  // Update inventory status
  await supabase
    .from('inventory')
    .update({ status: 'IN_TRANSIT' })
    .eq('id', inventoryId);
};
```

---

### Stage 6: Delivery Completion
**Trigger**: Pipe delivered to well site
**Status**: `IN_TRANSIT` → `DELIVERED`
**Actions**:
1. Admin marks trucking load as COMPLETED
2. Update inventory status to DELIVERED
3. Archive inventory (or flag as delivered)
4. Send final email to customer: "Delivery complete!"

**Archive Logic** (optional):
```sql
-- Move to archive table for historical reporting
INSERT INTO inventory_archive
SELECT * FROM inventory WHERE status = 'DELIVERED';

-- Or just flag as delivered and keep in main table
UPDATE inventory SET status = 'DELIVERED' WHERE id = ?;
```

---

## Rack Allocation Modes

### LINEAR_CAPACITY Mode (Default)
**Use Case**: Most racks (Areas B, C)
**Tracking**: By joints and linear meters
**Capacity**: Max joints that fit (e.g., 100 joints per rack)

**Occupancy Calculation**:
```typescript
const occupancy = {
  occupied_joints: rack.occupied, // integer
  occupied_meters: rack.occupied * avgLengthPerJoint, // numeric
  available_joints: rack.capacity - rack.occupied,
  utilization_pct: (rack.occupied / rack.capacity) * 100,
};
```

**Example**: Rack B-B1-03
- Capacity: 100 joints
- Occupied: 37 joints
- Available: 63 joints
- Utilization: 37%

---

### SLOT Mode (Area A Only)
**Use Case**: Open storage area with fixed locations
**Tracking**: Binary slot occupancy (0 or 1)
**Capacity**: 22 slots (11 per row)

**Physical Layout**:
- Area A: 170m (N/S) × 60m (E/W) cleared pad
- Row 1 (West): A-A1-01 to A-A1-11
- Row 2 (East): A-A2-01 to A-A2-11
- Each slot: 14.5m × 5m

**Occupancy Calculation**:
```typescript
// occupied = 0 (empty) or 1 (occupied)
const emptySlots = rack.capacity - rack.occupied;
const utilizationPct = (rack.occupied / rack.capacity) * 100;

// Example: 2 of 22 slots occupied
// emptySlots = 20
// utilizationPct = 9.1%
```

**Business Rule**: One customer per slot (no mixing)

**File**: `supabase/schema.sql` - racks table definition

---

## Files Owned

### Components
- `components/InventoryDisplay.tsx` - Customer inventory view
- `components/admin/AdminDashboard.tsx` - Admin inventory tab (lines 1200-1400 approx)

### Database Schema
- `supabase/schema.sql` - inventory, racks, yard_areas tables
- `supabase/FIX_ALL_RACK_CAPACITIES.sql` - Capacity correction migration (Nov 5, 2025)

### Data Types
- `types.ts` - Inventory, Yard, Pipe interfaces
  - Line 13: `Pipe` interface (alias for Inventory)
  - Inventory status enum

---

## Quality Standards

### Inventory Accuracy Checklist
- [ ] Every joint accounted for (matches manifest)
- [ ] Rack assignment valid (not over-capacity)
- [ ] Company_id correct (no mixing customers)
- [ ] Status matches physical reality
- [ ] Quantities updated after AI extraction
- [ ] Dwell time calculated correctly

### Rack Assignment Rules
1. **Capacity Check**: Always validate before assignment
2. **Atomic Updates**: Update inventory and rack occupancy together
3. **Idempotent**: Safe to retry assignment (check if already assigned)
4. **Audit Trail**: Log who assigned, when, and why

### Quantity Reconciliation
1. **Manifest is Source of Truth**: AI-extracted > customer estimate
2. **Flag Discrepancies**: Alert admin if difference > 5%
3. **Manual Override**: Allow admin to adjust if AI wrong
4. **Document Changes**: Log all quantity adjustments

---

## Common Patterns

### Create Inventory on Arrival
```typescript
const createInventoryOnArrival = async (
  truckLoad: TruckLoad,
  manifestData: ManifestItem[],
  assignedRackId: string
) => {
  // 1. Calculate totals from manifest
  const totalJoints = manifestData.reduce((sum, item) => sum + item.quantity, 0);
  const totalLength = manifestData.reduce((sum, item) =>
    sum + (item.quantity * (item.tally_length_ft || 0)), 0);

  // 2. Get storage request details
  const { data: request } = await supabase
    .from('storage_requests')
    .select('*')
    .eq('id', truckLoad.storage_request_id)
    .single();

  // 3. Create inventory record
  const { data: inventory } = await supabase
    .from('inventory')
    .insert({
      company_id: request.company_id,
      reference_id: request.reference_id,
      type: request.request_details.item_type,
      grade: request.request_details.grade,
      outer_diameter: request.request_details.outer_diameter,
      quantity: totalJoints,
      length: totalLength / totalJoints, // avg length per joint
      status: 'IN_STORAGE',
      storage_area_id: assignedRackId,
      delivery_truck_load_id: truckLoad.id,
    })
    .select()
    .single();

  // 4. Update rack occupancy
  await updateRackOccupancy(assignedRackId, totalJoints, 'ADD');

  return inventory;
};
```

### Update Rack Occupancy
```typescript
const updateRackOccupancy = async (
  rackId: string,
  quantity: number,
  operation: 'ADD' | 'REMOVE'
) => {
  const { data: rack } = await supabase
    .from('racks')
    .select('*')
    .eq('id', rackId)
    .single();

  let newOccupied: number;
  if (operation === 'ADD') {
    newOccupied = rack.occupied + quantity;
    if (newOccupied > rack.capacity) {
      throw new Error(`Exceeds rack capacity: ${newOccupied} > ${rack.capacity}`);
    }
  } else {
    newOccupied = Math.max(0, rack.occupied - quantity);
  }

  await supabase
    .from('racks')
    .update({ occupied: newOccupied })
    .eq('id', rackId);
};
```

### Partial Pickup Logic
```typescript
const handlePartialPickup = async (
  inventoryId: string,
  pickupQuantity: number,
  pickupLoadId: string
) => {
  const { data: inventory } = await supabase
    .from('inventory')
    .select('*')
    .eq('id', inventoryId)
    .single();

  if (pickupQuantity >= inventory.quantity) {
    // Full pickup - update existing record
    await supabase
      .from('inventory')
      .update({
        status: 'PENDING_PICKUP',
        pickup_truck_load_id: pickupLoadId,
      })
      .eq('id', inventoryId);
  } else {
    // Partial pickup - split inventory
    // 1. Reduce existing inventory
    await supabase
      .from('inventory')
      .update({ quantity: inventory.quantity - pickupQuantity })
      .eq('id', inventoryId);

    // 2. Create new record for pickup portion
    await supabase
      .from('inventory')
      .insert({
        ...inventory,
        id: undefined, // Generate new ID
        quantity: pickupQuantity,
        status: 'PENDING_PICKUP',
        pickup_truck_load_id: pickupLoadId,
      });
  }
};
```

---

## Collaboration & Handoffs

### Works Closely With
- **Admin Operations Agent**: Receive rack assignments on approval
- **Customer Journey Agent**: Update inventory status as customer progresses
- **Database Integrity Agent**: Ensure FK constraints and RLS policies enforced
- **AI Services Agent**: Use manifest extraction to update quantities

### Escalation Triggers
Hand off when:
- **Quantity discrepancy > 10%**: Flag for admin review
- **Rack over-capacity**: Admin Operations Agent to reassign
- **Missing rack assignment**: Admin Operations Agent to assign
- **RLS policy blocks update**: Database Integrity Agent
- **Manifest extraction fails**: AI Services Agent

---

## Testing Checklist

### Inventory Creation Tests
- [ ] Create inventory on truck arrival
- [ ] Assign to valid rack with capacity
- [ ] Block assignment if over-capacity
- [ ] Update rack occupancy correctly
- [ ] Link to delivery_truck_load_id
- [ ] Status set to IN_STORAGE

### Quantity Reconciliation Tests
- [ ] Update quantity from AI-extracted manifest
- [ ] Flag discrepancy if estimate vs manifest differs
- [ ] Allow admin to manually override
- [ ] Log all quantity changes

### Partial Pickup Tests
- [ ] Pick up 50% of inventory
- [ ] Original inventory quantity reduced
- [ ] New inventory record created for picked up portion
- [ ] Rack occupancy updated correctly
- [ ] Both records linked to correct trucking loads

### Rack Allocation Tests
- [ ] LINEAR_CAPACITY mode tracks by joints
- [ ] SLOT mode tracks by slot count (0 or 1)
- [ ] Can't exceed rack capacity
- [ ] Multiple customers can't share a slot (Area A)
- [ ] Rack utilization calculated correctly

### Edge Cases
- [ ] Pick up more than available (should block)
- [ ] Assign to non-existent rack (should fail)
- [ ] Update occupancy for rack at capacity (should block)
- [ ] Delete inventory with rack assignment (should free up capacity)

---

## Common Issues & Solutions

### Issue: Rack Over-Capacity After Assignment
**Problem**: Rack shows occupied > capacity
**Root Cause**: Concurrent assignments or incorrect capacity value
**Solution**: Run capacity correction migration
**File**: `supabase/FIX_ALL_RACK_CAPACITIES.sql`
```sql
-- Reset all racks with capacity < 100 to 100
UPDATE racks
SET capacity = 100, capacity_meters = 1200
WHERE capacity < 100;
```

### Issue: Inventory Not Visible to Customer
**Problem**: Customer can't see their inventory in dashboard
**Root Cause**: RLS policy blocks access
**Solution**: Verify company_id matches user's company
**File**: `supabase/schema.sql` - RLS policies
```sql
-- Check policy
CREATE POLICY "Users can view own company inventory"
ON inventory FOR SELECT
TO authenticated
USING (company_id IN (
  SELECT company_id FROM auth.users WHERE id = auth.uid()
));
```

### Issue: Quantity Mismatch After Manifest Extraction
**Problem**: AI extracts 95 joints, customer estimated 100
**Root Cause**: Manifest is source of truth, estimate was wrong
**Solution**: Update inventory quantity to match manifest
**File**: `components/RequestDocumentsPanel.tsx:162-170`
```typescript
// Update trucking load with AI-extracted totals
await supabase
  .from('trucking_loads')
  .update({
    total_joints_planned: summary.total_joints,
    total_length_ft_planned: summary.total_length_ft,
    total_weight_lbs_planned: summary.total_weight_lbs,
  })
  .eq('id', loadId);

// Also update inventory if already created
await supabase
  .from('inventory')
  .update({ quantity: summary.total_joints })
  .eq('delivery_truck_load_id', loadId);
```

---

## Metrics & KPIs

### Inventory Accuracy
- **Manifest Match Rate**: % of loads where manifest = estimate
- **Quantity Discrepancies**: # of adjustments needed after AI extraction
- **Avg Discrepancy**: Mean difference between estimate and actual

### Storage Utilization
- **Overall Utilization**: (Total occupied / Total capacity) × 100
- **Utilization by Yard**: Breakdown for Areas A, B, C
- **Avg Dwell Time**: Mean days in storage
- **Longest Dwell**: Max days in storage (identify slow movers)

### Operational Efficiency
- **Time to Assign Rack**: Minutes from arrival to rack assignment
- **Partial Pickup Rate**: % of pickups that are partial (not full)
- **Inventory Accuracy Score**: % of records with no discrepancies

---

## Decision Records

### DR-001: Manifest Overrides Estimate
**Date**: 2025-11-05
**Decision**: AI-extracted manifest data overwrites customer estimates
**Rationale**: Manifest is physical document, more accurate than estimate
**Files**: `components/RequestDocumentsPanel.tsx:162-170`

### DR-002: Partial Pickup Creates New Inventory Record
**Date**: 2025-11-06
**Decision**: Split inventory record on partial pickup instead of tracking separately
**Rationale**: Simpler to track two separate records than complex state
**Impact**: Easier to query "what's in storage" vs "what's in transit"

### DR-003: Rack Capacity Set to 100 Joints Default
**Date**: 2025-11-05
**Decision**: All racks default to 100 joints capacity (1200 meters)
**Rationale**: Consistent with physical rack dimensions
**Migration**: `supabase/FIX_ALL_RACK_CAPACITIES.sql`

---

## Next Steps

### Short-term (This Week)
- [ ] Validate rack capacity calculations for both modes
- [ ] Test partial pickup logic
- [ ] Verify inventory visible to customers
- [ ] Reconcile any quantity discrepancies from recent arrivals

### Medium-term (This Month)
- [ ] Automated dwell time alerts (pipe in storage > 90 days)
- [ ] Inventory report generation (CSV export)
- [ ] Bulk rack reassignment tool
- [ ] Capacity forecasting (predict when racks full)

### Long-term (This Quarter)
- [ ] Barcode/RFID tracking for physical inventory
- [ ] Automated rack assignment (optimize by pipe type/size)
- [ ] Integration with weighbridge (auto-update weight)
- [ ] Predictive analytics (forecast storage demand)

---

**Agent Status**: ✅ Active
**Last Updated**: 2025-11-06
**Next Review**: 2025-11-13
**Primary Contact**: MPS Inventory Manager
