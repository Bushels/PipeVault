-- ============================================================================
-- FINAL CORRECTED INDEXES - inventory.request_id (NOT storage_request_id)
-- ============================================================================
-- ⚠️  Run each CREATE INDEX statement INDIVIDUALLY (one at a time)
-- ============================================================================

-- Drop old indexes (can run together)
DROP INDEX IF EXISTS idx_trucking_loads_request CASCADE;
DROP INDEX IF EXISTS idx_trucking_loads_direction CASCADE;
DROP INDEX IF EXISTS idx_inventory_request CASCADE;
DROP INDEX IF EXISTS idx_inventory_status CASCADE;
DROP INDEX IF EXISTS idx_trucking_documents_load CASCADE;

-- ============================================================================
-- RUN EACH OF THE FOLLOWING INDIVIDUALLY
-- ============================================================================

-- Index 1: Trucking loads by storage request
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_trucking_loads_request
  ON trucking_loads(storage_request_id);

-- Index 2: Trucking loads by direction
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_trucking_loads_direction
  ON trucking_loads(direction)
  WHERE direction IS NOT NULL;

-- Index 3: Inventory by request ✅ FIXED: request_id
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_inventory_request
  ON inventory(request_id);

-- Index 4: Inventory by status
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_inventory_status
  ON inventory(status)
  WHERE status = 'IN_STORAGE';

-- Index 5: Inventory by storage area (for rack joins)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_inventory_storage_area
  ON inventory(storage_area_id)
  WHERE storage_area_id IS NOT NULL;

-- Index 6: Compound index for inventory queries ✅ FIXED: request_id
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_inventory_request_status
  ON inventory(request_id, status)
  WHERE status = 'IN_STORAGE';

-- Index 7: Trucking documents by load
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_trucking_documents_load
  ON trucking_documents(trucking_load_id);

-- Index 8: Trucking documents by type
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_trucking_documents_type
  ON trucking_documents(document_type)
  WHERE document_type IS NOT NULL;

-- Index 9: Trucking documents with parsed manifests
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_trucking_documents_has_manifest
  ON trucking_documents(trucking_load_id)
  WHERE parsed_payload IS NOT NULL;

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- Run after all indexes created:

SELECT
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE indexname LIKE 'idx_trucking%' OR indexname LIKE 'idx_inventory%'
ORDER BY tablename, indexname;
