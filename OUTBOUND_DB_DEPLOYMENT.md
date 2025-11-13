# Outbound Workflow - Database Deployment Guide

## Overview
Deploy database schema changes to enable the outbound workflow (pickup from MPS to well site). These migrations are **backwards-compatible** - existing inbound workflow will continue working unchanged.

---

## Pre-Deployment Checklist

- [ ] Dev server is running with the updated types (`npm run dev`)
- [ ] No active inbound load completions in progress (check "In Transit" tab is idle)
- [ ] Backup database (optional but recommended):
  ```bash
  # In Supabase Dashboard → Database → Backups → Create backup
  ```

---

## Step 1: Apply Schema Migration

**File**: `supabase/migrations/20251113000001_add_outbound_fields.sql`

**What it does**:
- Adds `direction` column to `trucking_loads` (INBOUND/OUTBOUND)
- Adds destination fields (LSD, Well Name, UWI) for outbound loads
- Adds shipping method (CUSTOMER_ARRANGED/MPS_QUOTE)
- Adds pickup tracking to `inventory` table
- Adds archival fields to `storage_requests` table
- Creates performance indexes
- Updates `get_company_summaries()` function with inbound/outbound counts

**How to apply**:

1. Open Supabase Dashboard → SQL Editor
2. Copy **entire contents** of `supabase/migrations/20251113000001_add_outbound_fields.sql`
3. Paste into SQL Editor
4. Click **Run** (bottom right)

**Expected result**:
```
Success. No rows returned
```

**Verification queries** (run these after migration):
```sql
-- Should show new columns
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'trucking_loads'
  AND column_name IN ('direction', 'destination_lsd', 'destination_well_name', 'destination_uwi', 'shipping_method', 'quote_amount')
ORDER BY column_name;

-- Should return 6 rows

-- Check all existing loads are marked INBOUND
SELECT direction, COUNT(*)
FROM trucking_loads
GROUP BY direction;

-- Should show: INBOUND | (your count)

-- Verify function updated
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_name = 'get_company_summaries';

-- Should return 1 row
```

---

## Step 2: Apply Outbound Completion Function

**File**: `supabase/migrations/20251113000002_mark_outbound_load_completed.sql`

**What it does**:
- Creates `mark_outbound_load_completed_and_clear_rack()` function
- Validates outbound load state
- Updates inventory from IN_STORAGE → PICKED_UP
- Decrements rack occupancy atomically
- Prevents negative occupancy (safety check)

**How to apply**:

1. Open Supabase Dashboard → SQL Editor
2. Copy **entire contents** of `supabase/migrations/20251113000002_mark_outbound_load_completed.sql`
3. Paste into SQL Editor
4. Click **Run**

**Expected result**:
```
Success. No rows returned
```

**Verification**:
```sql
-- Function should exist
SELECT routine_name, data_type
FROM information_schema.routines
WHERE routine_name = 'mark_outbound_load_completed_and_clear_rack';

-- Should return: mark_outbound_load_completed_and_clear_rack | json

-- Check function signature (parameters)
SELECT
  p.parameter_name,
  p.data_type,
  p.parameter_mode
FROM information_schema.parameters p
WHERE p.specific_name IN (
  SELECT specific_name
  FROM information_schema.routines
  WHERE routine_name = 'mark_outbound_load_completed_and_clear_rack'
)
ORDER BY p.ordinal_position;

-- Should return 6 parameters:
-- load_id_param          | uuid    | IN
-- company_id_param       | uuid    | IN
-- request_id_param       | uuid    | IN
-- inventory_ids_param    | ARRAY   | IN
-- actual_joints_param    | integer | IN
-- completion_notes_param | text    | IN
```

---

## Step 3: Optional Performance Index

**Recommended**: Add index to speed up manifest lookups (recommended by GPT-5 earlier)

```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_trucking_documents_load_uploaded
ON public.trucking_documents(trucking_load_id, uploaded_at DESC)
WHERE parsed_payload IS NOT NULL;
```

This won't block any operations and improves the inbound load completion performance.

---

## Post-Deployment Verification

### Test 1: Inbound Workflow Still Works
1. Go to customer dashboard (http://localhost:5173)
2. Create a new storage request
3. Book inbound load
4. Upload manifest (AI extraction should still work)
5. Admin approves and marks completed

**Expected**: Everything works exactly as before (no breaking changes)

### Test 2: Database Schema Ready for Outbound
```sql
-- All existing loads should be INBOUND
SELECT
  id,
  direction,
  status,
  destination_lsd,
  shipping_method
FROM trucking_loads
LIMIT 5;

-- Should show:
-- - direction: INBOUND (all existing loads)
-- - destination_lsd: NULL (not used for inbound)
-- - shipping_method: NULL (not used for inbound)
```

### Test 3: Inventory Table Ready
```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'inventory'
  AND column_name IN ('pickup_truck_load_id', 'pickup_timestamp')
ORDER BY column_name;

-- Should return 2 rows
```

### Test 4: Storage Requests Ready for Archival
```sql
SELECT
  id,
  reference_id,
  archived,
  archived_at,
  archived_by
FROM storage_requests
LIMIT 5;

-- All should show:
-- - archived: false (default)
-- - archived_at: NULL
-- - archived_by: NULL
```

---

## Rollback Plan (If Needed)

If something goes wrong, you can rollback:

```sql
-- ROLLBACK STEP 1: Remove new columns
ALTER TABLE trucking_loads DROP COLUMN IF EXISTS direction;
ALTER TABLE trucking_loads DROP COLUMN IF EXISTS destination_lsd;
ALTER TABLE trucking_loads DROP COLUMN IF EXISTS destination_well_name;
ALTER TABLE trucking_loads DROP COLUMN IF EXISTS destination_uwi;
ALTER TABLE trucking_loads DROP COLUMN IF EXISTS shipping_method;
ALTER TABLE trucking_loads DROP COLUMN IF EXISTS quote_amount;

ALTER TABLE inventory DROP COLUMN IF EXISTS pickup_truck_load_id;
ALTER TABLE inventory DROP COLUMN IF EXISTS pickup_timestamp;

ALTER TABLE storage_requests DROP COLUMN IF EXISTS archived;
ALTER TABLE storage_requests DROP COLUMN IF EXISTS archived_at;
ALTER TABLE storage_requests DROP COLUMN IF EXISTS archived_by;

-- ROLLBACK STEP 2: Drop function
DROP FUNCTION IF EXISTS public.mark_outbound_load_completed_and_clear_rack(UUID, UUID, UUID, UUID[], INTEGER, TEXT);

-- ROLLBACK STEP 3: Restore old get_company_summaries (without inbound/outbound counts)
-- You'll need to run the old version from a previous migration file
```

**Note**: Rollback is safe because:
- New columns are nullable (no data loss)
- New function isn't called by existing code
- Existing workflows unaffected

---

## Deployment Status

- [ ] **Step 1**: Schema migration applied
- [ ] **Step 2**: Outbound function created
- [ ] **Step 3**: Performance index added (optional)
- [ ] **Verification**: All tests pass
- [ ] **Inbound test**: Confirmed existing workflow works
- [ ] **Ready**: Database ready for frontend components

---

## Next Steps (After Database Deployed)

Once database deployment is verified, Kyle (Claude) will build:

1. ✅ Database schema (DONE)
2. ✅ SQL functions (DONE)
3. ✅ TypeScript types (DONE)
4. 🚧 OutboundShipmentWizard component (NEXT)
5. 🚧 Admin Outbound Loads tile
6. 🚧 MarkPickedUpModal
7. 🚧 Dashboard "Request Outbound" button
8. 🚧 Remaining components

---

## Troubleshooting

### Error: "column direction does not exist"
**Cause**: Migration didn't apply
**Fix**: Re-run Step 1 migration

### Error: "function mark_outbound_load_completed_and_clear_rack does not exist"
**Cause**: Step 2 migration didn't apply
**Fix**: Re-run Step 2 migration

### Error: "constraint outbound_destination_check violated"
**Cause**: Tried to create outbound load without well name or UWI
**Fix**: This is expected - validation working correctly

### Existing loads showing direction NULL
**Cause**: Migration didn't set default
**Fix**: Run this:
```sql
UPDATE trucking_loads SET direction = 'INBOUND' WHERE direction IS NULL;
```

---

**Questions?** Report any errors with:
1. Full error message
2. Which step failed
3. Result of verification queries
