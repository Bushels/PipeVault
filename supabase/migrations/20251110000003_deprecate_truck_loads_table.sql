-- ============================================================================
-- MIGRATION: Deprecate truck_loads, Standardize on trucking_loads
-- ============================================================================
-- Issue: Parallel trucking schemas causing data layer inconsistency
--
-- Current State:
--   - truck_loads: 0 rows, legacy schema, referenced by old frontend hooks
--   - trucking_loads: 4 rows, modern workflow schema, referenced by RPC functions
--   - Frontend writes to empty table, backend reads from populated table
--   - Result: Admin dashboard sees no load data
--
-- Solution:
--   1. Verify truck_loads is empty (safety check)
--   2. Drop truck_loads table
--   3. Add foreign key constraints to inventory → trucking_loads
--   4. Add indexes for performance
--   5. Document schema change
--
-- Frontend Update Required: Update useSupabaseData.ts to use trucking_loads
-- ============================================================================

-- ============================================================================
-- SAFETY CHECKS
-- ============================================================================

DO $$
DECLARE
  v_truck_loads_count INTEGER;
  v_trucking_loads_count INTEGER;
BEGIN
  -- Check row counts
  SELECT COUNT(*) INTO v_truck_loads_count FROM truck_loads;
  SELECT COUNT(*) INTO v_trucking_loads_count FROM trucking_loads;

  RAISE NOTICE 'truck_loads row count: %', v_truck_loads_count;
  RAISE NOTICE 'trucking_loads row count: %', v_trucking_loads_count;

  -- Safety check: Abort if truck_loads has data
  IF v_truck_loads_count > 0 THEN
    RAISE EXCEPTION 'SAFETY ABORT: truck_loads table has % rows. Manual data migration required before deprecation.', v_truck_loads_count
      USING HINT = 'Migrate data from truck_loads to trucking_loads before running this migration';
  END IF;

  RAISE NOTICE 'Safety check passed: truck_loads is empty, safe to drop';
END $$;

-- ============================================================================
-- DROP LEGACY TABLE
-- ============================================================================

-- Drop the empty legacy table
DROP TABLE IF EXISTS truck_loads CASCADE;

COMMENT ON SCHEMA public IS
'truck_loads table dropped in migration 20251110000003. Use trucking_loads for all trucking workflow operations.';

-- ============================================================================
-- ADD FOREIGN KEY CONSTRAINTS
-- ============================================================================

-- Link inventory.delivery_truck_load_id → trucking_loads.id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'inventory_delivery_truck_load_fkey'
  ) THEN
    ALTER TABLE inventory
    ADD CONSTRAINT inventory_delivery_truck_load_fkey
    FOREIGN KEY (delivery_truck_load_id)
    REFERENCES trucking_loads(id)
    ON DELETE SET NULL;

    RAISE NOTICE 'Added FK: inventory.delivery_truck_load_id → trucking_loads.id';
  END IF;
END $$;

-- Link inventory.pickup_truck_load_id → trucking_loads.id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'inventory_pickup_truck_load_fkey'
  ) THEN
    ALTER TABLE inventory
    ADD CONSTRAINT inventory_pickup_truck_load_fkey
    FOREIGN KEY (pickup_truck_load_id)
    REFERENCES trucking_loads(id)
    ON DELETE SET NULL;

    RAISE NOTICE 'Added FK: inventory.pickup_truck_load_id → trucking_loads.id';
  END IF;
END $$;

-- Link trucking_documents.trucking_load_id → trucking_loads.id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'trucking_documents_load_fkey'
  ) THEN
    ALTER TABLE trucking_documents
    ADD CONSTRAINT trucking_documents_load_fkey
    FOREIGN KEY (trucking_load_id)
    REFERENCES trucking_loads(id)
    ON DELETE CASCADE;

    RAISE NOTICE 'Added FK: trucking_documents.trucking_load_id → trucking_loads.id';
  END IF;
END $$;

-- ============================================================================
-- ADD PERFORMANCE INDEXES
-- ============================================================================

-- Index for inventory lookups by delivery load
CREATE INDEX IF NOT EXISTS idx_inventory_delivery_truck_load
ON inventory(delivery_truck_load_id)
WHERE delivery_truck_load_id IS NOT NULL;

-- Index for inventory lookups by pickup load
CREATE INDEX IF NOT EXISTS idx_inventory_pickup_truck_load
ON inventory(pickup_truck_load_id)
WHERE pickup_truck_load_id IS NOT NULL;

-- Index for trucking_loads by storage request (most common query)
CREATE INDEX IF NOT EXISTS idx_trucking_loads_storage_request
ON trucking_loads(storage_request_id);

-- Index for trucking_loads by status (for filtering workflows)
CREATE INDEX IF NOT EXISTS idx_trucking_loads_status
ON trucking_loads(status);

-- Index for trucking_loads by direction (INBOUND/OUTBOUND)
CREATE INDEX IF NOT EXISTS idx_trucking_loads_direction
ON trucking_loads(direction);

-- Composite index for common admin dashboard query pattern
CREATE INDEX IF NOT EXISTS idx_trucking_loads_request_direction
ON trucking_loads(storage_request_id, direction, sequence_number);

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE trucking_loads IS
'Unified trucking workflow table. Tracks inbound/outbound loads with 8-state workflow (NEW → IN_PROGRESS → COMPLETE). Linked to storage_requests, inventory, and trucking_documents.';

COMMENT ON COLUMN trucking_loads.direction IS
'INBOUND = delivery to MPS yard, OUTBOUND = pickup from MPS yard';

COMMENT ON COLUMN trucking_loads.sequence_number IS
'Order of loads within a storage request (1-based)';

COMMENT ON COLUMN trucking_loads.status IS
'Workflow state: NEW, SCHEDULED, IN_TRANSIT, ARRIVED, IN_PROGRESS, COMPLETED, CANCELLED, FAILED';

COMMENT ON COLUMN inventory.delivery_truck_load_id IS
'Foreign key to trucking_loads.id - tracks which INBOUND load delivered this inventory';

COMMENT ON COLUMN inventory.pickup_truck_load_id IS
'Foreign key to trucking_loads.id - tracks which OUTBOUND load will pick up this inventory';

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Verify truck_loads is dropped
SELECT CASE
  WHEN NOT EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_name = 'truck_loads'
  )
  THEN 'SUCCESS: truck_loads table dropped'
  ELSE 'ERROR: truck_loads table still exists'
END as truck_loads_status;

-- Verify foreign keys created
SELECT
  tc.constraint_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
LEFT JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.table_name IN ('inventory', 'trucking_documents')
  AND tc.constraint_type = 'FOREIGN KEY'
  AND ccu.table_name = 'trucking_loads'
ORDER BY tc.table_name, kcu.column_name;

-- Verify indexes created
SELECT
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename IN ('inventory', 'trucking_loads')
  AND indexname LIKE '%truck%'
ORDER BY tablename, indexname;

-- Show current trucking_loads data
SELECT
  id,
  storage_request_id,
  direction,
  sequence_number,
  status,
  trucking_company,
  total_joints_planned,
  created_at
FROM trucking_loads
ORDER BY created_at DESC;

-- ============================================================================
-- POST-DEPLOYMENT ACTIONS REQUIRED
-- ============================================================================

-- 1. UPDATE FRONTEND HOOKS (hooks/useSupabaseData.ts):
--
--    Change all references from 'truck_loads' to 'trucking_loads':
--
--    OLD:
--      .from('truck_loads')
--      queryKey: queryKeys.truckLoads
--
--    NEW:
--      .from('trucking_loads')
--      queryKey: queryKeys.truckingLoads
--
-- 2. UPDATE TYPE IMPORTS:
--
--    Remove: TruckLoad, TruckLoadRow
--    Use: TruckingLoad, TruckingLoadRow (already defined)
--
-- 3. UPDATE QUERY KEY CONSTANTS:
--
--    Remove: queryKeys.truckLoads
--    Add: queryKeys.truckingLoads
--
-- 4. REGENERATE TYPESCRIPT TYPES:
--
--    npx supabase gen types typescript --local > lib/database.types.ts
--
-- 5. TEST ADMIN DASHBOARD:
--
--    - Verify loads appear in project summaries
--    - Test load creation/editing
--    - Verify document uploads attach to correct load
--
-- ============================================================================
