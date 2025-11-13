# Data Integrity & Realtime Features - Implementation Guide

## Overview

This document covers three critical features implemented to improve data integrity, historical data consistency, and multi-admin collaboration:

1. **Rack Capacity Safeguard** - Prevents over-allocation during load completion
2. **Inventory Backfill Script** - Creates inventory for COMPLETED loads missing records
3. **Realtime Updates** - Enables multi-admin collaboration with automatic UI refresh

---

## Feature 1: Rack Capacity Safeguard

### Problem
The `mark_load_completed_and_create_inventory` function was incrementing rack occupancy without checking capacity limits. This could lead to:
- Physical over-allocation of rack space
- Rack capacity exceeded without warning
- Data integrity issues in capacity tracking

### Solution
Added capacity validation before updating rack occupancy. The function now:
1. Checks current rack capacity and occupancy
2. Calculates available space (joints and linear meters)
3. Validates that the load fits before incrementing
4. Throws descriptive error if capacity would be exceeded

### Implementation

**Migration**: [supabase/migrations/20251113000006_add_rack_capacity_safeguard.sql](../supabase/migrations/20251113000006_add_rack_capacity_safeguard.sql)

**Key Logic**:
```sql
-- Calculate available capacity
rack_available_joints := rack_capacity - rack_current_occupied;
rack_available_meters := rack_capacity_meters - rack_current_occupied_meters;

-- Validate before updating
IF manifest_total_joints > rack_available_joints THEN
    RAISE EXCEPTION 'Capacity exceeded: Rack % can only hold % more joints...',
        rack_id_param, rack_available_joints;
END IF;
```

### Error Messages

**Joint Capacity Exceeded**:
```
Capacity exceeded: Rack A-A1-01 can only hold 25 more joints (capacity: 100, occupied: 75),
but load contains 30 joints. Please select a different rack or reduce the quantity.
```

**Linear Capacity Exceeded**:
```
Linear capacity exceeded: Rack A-A1-01 can only hold 72.50 more meters (capacity: 300.00 m,
occupied: 227.50 m), but load contains 90.00 meters. Please select a different rack.
```

### How to Apply

```bash
# Option 1: Via Supabase Dashboard
1. Open Supabase Dashboard → SQL Editor
2. Copy contents of 20251113000006_add_rack_capacity_safeguard.sql
3. Paste and run
4. Verify: SELECT routine_name FROM information_schema.routines
   WHERE routine_name = 'mark_load_completed_and_create_inventory';
```

### Testing

**Test Case 1: Within Capacity**
```
Rack: capacity=100, occupied=75 (25 available)
Load: 20 joints
Result: ✅ Success - Rack updated to 95 occupied
```

**Test Case 2: Exactly At Capacity**
```
Rack: capacity=100, occupied=75 (25 available)
Load: 25 joints
Result: ✅ Success - Rack updated to 100 occupied (full)
```

**Test Case 3: Exceeding Capacity**
```
Rack: capacity=100, occupied=75 (25 available)
Load: 30 joints
Result: ❌ Error - Capacity exceeded exception thrown
```

---

## Feature 2: Inventory Backfill Script

### Problem
Some COMPLETED loads (like Load #1) were completed before we implemented manifest processing and inventory creation. These loads are marked COMPLETED but have no inventory records, leading to:
- Incomplete inventory tracking
- Missing historical data
- Rack occupancy inconsistencies

### Solution
Created a safe, idempotent script that:
1. Finds all COMPLETED loads without inventory
2. Creates simplified inventory records for them
3. Logs all actions taken
4. Runs in ANALYZE mode first for safety

### Implementation

**Script**: [supabase/BACKFILL_COMPLETED_LOADS_INVENTORY.sql](../supabase/BACKFILL_COMPLETED_LOADS_INVENTORY.sql)

**Features**:
- **Idempotent**: Safe to run multiple times
- **Dry-run mode**: ANALYZE mode previews changes
- **Detailed logging**: Shows exactly what will be done
- **Transaction-based**: All-or-nothing execution

### Usage

#### Step 1: Analysis Mode (Preview)
```sql
-- Edit the script, set:
run_mode TEXT := 'ANALYZE';

-- Run in SQL Editor
-- You'll see output like:
-- [NEEDS BACKFILL] Load #1 (40b4f12f-...)
--   Company: Bushels
--   Request: REQ-001
--   Completed: 2025-11-12
--   Joints: 87 (planned: 100)
--   Avg Length: 30.0 ft
--   → Would create inventory record
--
-- SUMMARY
-- Total COMPLETED loads found: 15
-- Loads requiring backfill: 3
-- Inventory records that would be created: 3
```

#### Step 2: Execute Mode (Apply Changes)
```sql
-- Edit the script, set:
run_mode TEXT := 'EXECUTE';

-- Run in SQL Editor
-- You'll see:
-- [NEEDS BACKFILL] Load #1 (40b4f12f-...)
--   ✓ Created inventory record: 87 joints, 30.0 ft avg length
--
-- SUMMARY
-- Mode: EXECUTE
-- Total COMPLETED loads found: 15
-- Loads requiring backfill: 3
-- Inventory records created: 3
```

#### Step 3: Review Backfilled Inventory
```sql
-- View all backfilled records
SELECT
    i.id,
    i.reference_id,
    i.quantity,
    i.length,
    i.status,
    i.storage_area_id,
    c.name AS company_name,
    tl.sequence_number AS load_number
FROM inventory i
INNER JOIN companies c ON c.id = i.company_id
INNER JOIN trucking_loads tl ON tl.id = i.delivery_truck_load_id
WHERE i.reference_id LIKE 'BACKFILL-%'
ORDER BY i.created_at DESC;
```

#### Step 4: Assign Racks (Manual)
```sql
-- Backfilled inventory has storage_area_id = NULL
-- Assign racks manually based on where pipe is actually located
UPDATE inventory
SET storage_area_id = 'A-A1-01'
WHERE reference_id LIKE 'BACKFILL-%'
  AND storage_area_id IS NULL;
```

#### Step 5: Update Rack Occupancy
Use the ManualRackAdjustmentModal in the admin dashboard to recalculate rack occupancy based on actual inventory.

### Backfilled Inventory Fields

| Field | Value | Notes |
|-------|-------|-------|
| `reference_id` | `BACKFILL-{load_id}` | Unique identifier |
| `quantity` | Actual joints completed | From `total_joints_completed` or `total_joints_planned` |
| `length` | Avg joint length (ft) | From `avg_joint_length_ft` or default 30.0 |
| `status` | `IN_STORAGE` | Assumes pipe still in storage |
| `storage_area_id` | `NULL` | **Requires manual assignment** |
| `grade` | `Unknown` | No manifest data available |
| `outer_diameter` | `0` | No manifest data available |
| `weight` | `0` | No manifest data available |

---

## Feature 3: Realtime Updates

### Problem
When multiple admins work simultaneously, changes made by one admin (completing a load, updating inventory, assigning racks) are not immediately visible to other admins without manually refreshing the page.

### Solution
Implemented PostgreSQL NOTIFY triggers + Supabase Realtime subscriptions to broadcast changes and automatically invalidate React Query caches.

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ Database Layer (PostgreSQL)                                 │
│                                                              │
│  Trigger Functions:                                         │
│  • broadcast_load_status_change()                          │
│  • broadcast_inventory_change()                            │
│  • broadcast_rack_occupancy_change()                       │
│                                                              │
│  Channels:                                                  │
│  • load_status_changed                                     │
│  • inventory_updated                                       │
│  • rack_occupancy_changed                                  │
└─────────────────────────────────────────────────────────────┘
                          ↓ pg_notify
┌─────────────────────────────────────────────────────────────┐
│ Supabase Realtime (Middleware)                             │
│                                                              │
│  Channels:                                                  │
│  • postgres_changes:trucking_loads                         │
│  • postgres_changes:inventory                              │
│  • postgres_changes:racks                                  │
│  • postgres_changes:storage_requests                       │
└─────────────────────────────────────────────────────────────┘
                          ↓ WebSocket
┌─────────────────────────────────────────────────────────────┐
│ Frontend (React)                                            │
│                                                              │
│  useRealtimeUpdates Hook                                   │
│  ├─ Subscribes to database changes                         │
│  ├─ Debounces invalidations (500ms)                        │
│  └─ Invalidates React Query caches                         │
│                                                              │
│  React Query                                                │
│  ├─ Detects cache invalidation                             │
│  ├─ Refetches affected queries                             │
│  └─ Updates UI automatically                                │
└─────────────────────────────────────────────────────────────┘
```

### Implementation

**Migration**: [supabase/migrations/20251113000007_enable_realtime_broadcasts.sql](../supabase/migrations/20251113000007_enable_realtime_broadcasts.sql)

**Frontend Hook**: [hooks/useRealtimeUpdates.ts](../hooks/useRealtimeUpdates.ts)

**Integration**: [components/admin/AdminDashboard.tsx:136](../components/admin/AdminDashboard.tsx#L136)

### Events Broadcast

| Event | Trigger | Payload | Invalidated Queries |
|-------|---------|---------|---------------------|
| **load_status_changed** | Status changes (PENDING → APPROVED → IN_TRANSIT → COMPLETED) | load_id, old_status, new_status, sequence_number | loads, load-details, pending-loads, approved-loads, in-transit-loads, requests |
| **inventory_updated** | Inventory created/updated/deleted | inventory_id, company_id, request_id, storage_area_id, status, quantity | inventory, company-details, requests, racks |
| **rack_occupancy_changed** | Rack occupied/occupied_meters changes | rack_id, old_occupied, new_occupied, capacity, utilization_pct | racks, yards, analytics |

### Configuration

```typescript
// Enable realtime (default settings)
useRealtimeUpdates({ enabled: true });

// Enable with debug logging
useRealtimeUpdates({ enabled: true, debug: true });

// Custom debounce delay
useRealtimeUpdates({ enabled: true, debounceMs: 1000 });

// Disable for specific component
useRealtimeUpdates({ enabled: false });
```

### Testing Realtime Updates

#### Test Setup
1. Open admin dashboard in two browser windows (Admin A and Admin B)
2. Both admins should be logged in
3. Navigate to same tab (e.g., "In Transit")

#### Test Case 1: Load Completion
```
Admin A Actions:
1. Click on Load #1 in "In Transit" tab
2. Click "Receive Load #1"
3. Select rack A-A1-01
4. Enter 87 joints
5. Click "Complete Receipt"

Expected Result (Admin B):
• "In Transit" badge count decreases from 5 → 4 (within 500ms)
• Load #1 disappears from list
• "Racks" tab badge updates to show +1 rack with pipe
• No manual refresh needed
```

#### Test Case 2: Inventory Assignment
```
Admin A Actions:
1. Navigate to "Inventory" tab
2. Update inventory status from IN_STORAGE to PENDING_PICKUP

Expected Result (Admin B):
• Inventory count updates automatically
• Company detail modal (if open) refreshes
• Racks tab shows updated occupancy
```

#### Test Case 3: Rack Occupancy Adjustment
```
Admin A Actions:
1. Navigate to "Racks" tab (formerly "Storage")
2. Click on rack A-A1-01
3. Use Manual Adjustment Modal
4. Add +10 joints

Expected Result (Admin B):
• Rack occupancy updates from 75 → 85
• Capacity utilization percentage recalculates
• Analytics refreshes automatically
```

### Debugging Realtime

**Enable Debug Mode**:
```typescript
// In AdminDashboard.tsx, change line 136:
useRealtimeUpdates({ enabled: true, debug: true });
```

**Console Output**:
```
[useRealtimeUpdates] Initializing realtime subscriptions...
✅ Real-time updates enabled - Admin dashboard will auto-refresh
[useRealtimeUpdates] trucking_loads change: { eventType: 'UPDATE', ... }
[useRealtimeUpdates] Invalidating queries: ['loads']
[useRealtimeUpdates] Invalidating queries: ['in-transit-loads']
```

**Check Subscription Status**:
```typescript
// Open browser DevTools → Console
// Look for Supabase Realtime messages:
// "Realtime: SUBSCRIBED to postgres_changes:public:trucking_loads"
```

### Performance Considerations

**Debouncing**: Changes are debounced by 500ms to prevent excessive refetches when multiple rapid updates occur.

**Selective Invalidation**: Only affected queries are invalidated, not the entire cache.

**Connection Pooling**: Supabase handles WebSocket connection management automatically.

**Graceful Degradation**: If realtime fails, users can still manually refresh (F5).

---

## Deployment Checklist

### Database Migrations

- [ ] **Capacity Safeguard** (Critical - Run First)
  ```bash
  # In Supabase Dashboard → SQL Editor
  # Copy/paste: 20251113000006_add_rack_capacity_safeguard.sql
  # Click "Run"
  ```

- [ ] **Realtime Triggers**
  ```bash
  # In Supabase Dashboard → SQL Editor
  # Copy/paste: 20251113000007_enable_realtime_broadcasts.sql
  # Click "Run"
  ```

- [ ] **Backfill Inventory** (Optional - Run in ANALYZE mode first)
  ```bash
  # In Supabase Dashboard → SQL Editor
  # Copy/paste: BACKFILL_COMPLETED_LOADS_INVENTORY.sql
  # Set run_mode = 'ANALYZE'
  # Click "Run" and review output
  # If satisfied, set run_mode = 'EXECUTE' and run again
  ```

### Frontend Deployment

- [x] useRealtimeUpdates hook created
- [x] Hook integrated into AdminDashboard
- [x] Build verified (229 modules compiled successfully)
- [ ] Deploy to GitHub Pages (automatic on push)
- [ ] Test realtime updates with multiple admins

### Verification

- [ ] Test capacity safeguard with over-capacity load
- [ ] Review backfilled inventory records
- [ ] Assign racks to backfilled inventory
- [ ] Test realtime updates with two admins
- [ ] Monitor console for realtime connection status

---

## Rollback Procedures

### Capacity Safeguard
To remove capacity validation (not recommended):
```sql
-- Restore old version without capacity checks
-- Re-run migration: 20251113000005_handle_missing_manifest_data.sql
```

### Realtime Triggers
To disable realtime broadcasts:
```sql
DROP TRIGGER IF EXISTS trigger_broadcast_load_status ON public.trucking_loads;
DROP TRIGGER IF EXISTS trigger_broadcast_inventory ON public.inventory;
DROP TRIGGER IF EXISTS trigger_broadcast_rack_occupancy ON public.racks;
```

### Frontend Realtime
To disable in emergency:
```typescript
// In AdminDashboard.tsx line 136:
useRealtimeUpdates({ enabled: false });
```

---

## Future Enhancements

### 1. Rate Limiting for High-Frequency Updates
If racks are being updated hundreds of times per second (bulk operations):
```sql
-- Only notify if > 5 seconds since last notification
CREATE OR REPLACE FUNCTION broadcast_rack_occupancy_change()
RETURNS TRIGGER AS $$
DECLARE
    last_notify TIMESTAMP;
BEGIN
    last_notify := current_setting('app.last_rack_notify', true)::TIMESTAMP;

    IF last_notify IS NULL OR (NOW() - last_notify) > interval '5 seconds' THEN
        PERFORM pg_notify('rack_occupancy_changed', ...);
        PERFORM set_config('app.last_rack_notify', NOW()::TEXT, false);
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### 2. Notification Batching
Group multiple inventory changes into a single notification:
```sql
-- Collect changes in temporary table
-- Broadcast summary every N seconds
```

### 3. User Presence Indicators
Show which admins are currently online:
```typescript
// Track admin presence via Supabase Realtime
channel.track({ user_id: session.user.id, name: 'Admin Name' });
```

---

## Troubleshooting

### Issue: Capacity Error on Valid Load
**Symptom**: Capacity error thrown even though rack should have space

**Diagnosis**:
```sql
-- Check rack current state
SELECT id, capacity, occupied, capacity - occupied AS available
FROM racks
WHERE id = 'A-A1-01';

-- Check if there's orphaned inventory
SELECT COUNT(*), SUM(quantity)
FROM inventory
WHERE storage_area_id = 'A-A1-01' AND status = 'IN_STORAGE';
```

**Solution**: Use ManualRackAdjustmentModal to reconcile occupancy with actual inventory.

### Issue: Realtime Updates Not Working
**Symptom**: Changes not appearing in other admin's browser

**Diagnosis**:
```typescript
// Check browser console for errors
// Look for: "Realtime: SUBSCRIBED" message
// Enable debug mode: useRealtimeUpdates({ debug: true })
```

**Solutions**:
1. Check Supabase project is not paused
2. Verify migrations were applied
3. Check browser WebSocket connection (DevTools → Network → WS)
4. Ensure both admins are on same environment (prod vs staging)

### Issue: Backfill Created Duplicate Inventory
**Symptom**: Multiple inventory records for same load

**Diagnosis**:
```sql
-- Check for duplicates
SELECT delivery_truck_load_id, COUNT(*) AS count
FROM inventory
GROUP BY delivery_truck_load_id
HAVING COUNT(*) > 1;
```

**Solution**:
```sql
-- Delete backfilled duplicates (keep manifest-based records)
DELETE FROM inventory
WHERE reference_id LIKE 'BACKFILL-%'
  AND delivery_truck_load_id IN (
      SELECT delivery_truck_load_id
      FROM inventory
      WHERE reference_id NOT LIKE 'BACKFILL-%'
  );
```

---

## Files Modified/Created

### Database Migrations
- ✅ `supabase/migrations/20251113000006_add_rack_capacity_safeguard.sql`
- ✅ `supabase/migrations/20251113000007_enable_realtime_broadcasts.sql`
- ✅ `supabase/BACKFILL_COMPLETED_LOADS_INVENTORY.sql`

### Frontend
- ✅ `hooks/useRealtimeUpdates.ts` (new)
- ✅ `components/admin/AdminDashboard.tsx` (modified)

### Documentation
- ✅ This file

---

**Created**: 2025-11-13
**Session**: Data Integrity & Realtime Features
**Status**: Ready for Deployment
