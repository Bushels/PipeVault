-- ============================================================================
-- PART 2: INDEXES (MUST run outside transaction - use CONCURRENTLY)
-- ============================================================================
-- ⚠️  IMPORTANT: This file must be executed separately with autocommit ON
-- ⚠️  CONCURRENTLY indexes cannot run inside a transaction block
-- ⚠️  Execute each statement individually in Supabase SQL Editor
-- ============================================================================

-- Drop old indexes if they exist (from previous migration)
-- These can run in transaction
DROP INDEX IF EXISTS idx_trucking_loads_request CASCADE;
DROP INDEX IF EXISTS idx_trucking_loads_direction CASCADE;
DROP INDEX IF EXISTS idx_inventory_request CASCADE;
DROP INDEX IF EXISTS idx_inventory_status CASCADE;
DROP INDEX IF EXISTS idx_trucking_documents_load CASCADE;

-- ============================================================================
-- EXECUTE EACH OF THE FOLLOWING STATEMENTS SEPARATELY
-- Copy-paste one at a time into Supabase SQL Editor
-- ============================================================================

-- Index 1: Trucking loads by storage request (for project_loads CTE)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_trucking_loads_request
  ON trucking_loads(storage_request_id);

-- Index 2: Trucking loads by direction (for INBOUND/OUTBOUND filtering)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_trucking_loads_direction
  ON trucking_loads(direction)
  WHERE direction IS NOT NULL;

-- Index 3: Inventory by storage request (for project_inventory CTE)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_inventory_request
  ON inventory(storage_request_id);

-- Index 4: Inventory by status (for IN_STORAGE filtering)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_inventory_status
  ON inventory(status)
  WHERE status = 'IN_STORAGE';

-- ✅ FIX #5: New index for inventory by storage_area_id (for rack joins)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_inventory_storage_area
  ON inventory(storage_area_id)
  WHERE storage_area_id IS NOT NULL;

-- ✅ FIX #5: Compound index for inventory requests by status (performance boost)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_inventory_request_status
  ON inventory(storage_request_id, status)
  WHERE status = 'IN_STORAGE';

-- Index 5: Trucking documents by load (for load_documents CTE)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_trucking_documents_load
  ON trucking_documents(trucking_load_id);

-- Index 6: Trucking documents by type (for filtering manifests vs other docs)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_trucking_documents_type
  ON trucking_documents(document_type)
  WHERE document_type IS NOT NULL;

-- Index 7: Trucking documents with parsed manifests (for hasManifest queries)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_trucking_documents_has_manifest
  ON trucking_documents(trucking_load_id)
  WHERE parsed_payload IS NOT NULL;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================
-- Run these after all indexes are created to verify:

-- Check all indexes exist
SELECT
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE indexname LIKE 'idx_trucking%' OR indexname LIKE 'idx_inventory%'
ORDER BY tablename, indexname;

-- Check index sizes (ensure they're reasonable)
SELECT
  schemaname,
  tablename,
  indexname,
  pg_size_pretty(pg_relation_size(indexrelid)) as index_size
FROM pg_stat_user_indexes
WHERE indexrelname LIKE 'idx_trucking%' OR indexrelname LIKE 'idx_inventory%'
ORDER BY pg_relation_size(indexrelid) DESC;

-- ============================================================================
-- END OF PART 2 (non-transactional indexes)
-- ============================================================================
