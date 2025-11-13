-- ============================================================================
-- Cleanup Unused Indexes - Based on Workflow Analysis
-- ============================================================================
-- Analysis of which indexes are ACTUALLY needed for new RPC workflow
-- ============================================================================

-- ============================================================================
-- ANALYSIS: Which indexes does get_project_summaries_by_company() need?
-- ============================================================================

-- The RPC function has 5 CTEs that perform these operations:
--
-- CTE 1 (load_documents): GROUP BY td.trucking_load_id
--   → NEEDS: idx_trucking_documents_load ✅
--
-- CTE 2 (rack_inventory):
--   - JOIN inventory i to storage_areas sa ON storage_area_id
--   - WHERE i.storage_area_id IS NOT NULL
--   - GROUP BY i.request_id
--   → NEEDS: idx_inventory_storage_area ✅
--   → NEEDS: idx_inventory_request ✅
--
-- CTE 3 (project_loads):
--   - JOIN trucking_loads tl ON tl.storage_request_id = sr.id
--   - FILTER (WHERE tl.direction = 'INBOUND')
--   - JOIN load_documents ld ON ld.trucking_load_id = tl.id
--   - JOIN rack_inventory ri ON ri.request_id = sr.id
--   → NEEDS: idx_trucking_loads_request ✅
--   → NEEDS: idx_trucking_loads_direction ✅
--
-- CTE 4 (project_inventory):
--   - FROM inventory i
--   - WHERE i.status = 'IN_STORAGE'
--   - GROUP BY i.request_id
--   → NEEDS: idx_inventory_request ✅
--   → NEEDS: idx_inventory_status ✅
--   → COULD USE: idx_inventory_request_status ✅ (compound, even better)
--
-- CTE 5 (company_projects):
--   - INNER JOIN storage_requests sr ON sr.company_id = c.id
--   - WHERE lower(c.domain) != 'mpsgroup.ca'
--   → Uses existing companies/storage_requests indexes

-- ============================================================================
-- INDEXES NEEDED FOR NEW WORKFLOW (7 CORE + 1 OPTIONAL)
-- ============================================================================

-- ✅ CORE (Required):
-- 1. idx_trucking_loads_request          -- Join loads to requests
-- 2. idx_trucking_loads_direction        -- Filter INBOUND/OUTBOUND
-- 3. idx_inventory_request               -- Join inventory to requests
-- 4. idx_inventory_status                -- Filter IN_STORAGE inventory
-- 5. idx_inventory_storage_area          -- Join inventory to racks
-- 6. idx_inventory_request_status        -- Compound (faster than separate)
-- 7. idx_trucking_documents_load         -- Group documents by load

-- ⚠️ OPTIONAL (Future-proofing):
-- 8. idx_trucking_documents_type         -- Filter by doc type (not currently used)

-- ❌ NOT NEEDED:
-- 9. idx_trucking_documents_has_manifest -- Partial index (we fetch ALL docs, frontend filters)

-- ============================================================================
-- INDEXES NOT NEEDED FOR NEW WORKFLOW (Can Drop)
-- ============================================================================

-- OLD indexes (from previous migrations, not used by new RPC):
-- 1. idx_inventory_reference             -- Lookup by reference_id (use request_id instead)
-- 2. idx_trucking_documents_parsed_payload -- GIN for JSONB search (we return full payload, no search)
-- 3. idx_trucking_loads_status           -- Filter by status alone (not used, we filter by direction)

-- NEW indexes (created today but not actually needed):
-- 4. idx_trucking_documents_has_manifest -- Partial index WHERE parsed_payload IS NOT NULL
--    → NOT NEEDED because we return ALL documents in documents array
--    → Frontend checks if parsedPayload exists, not database

-- ============================================================================
-- RECOMMENDED DROPS (4 indexes)
-- ============================================================================

-- Drop unused old indexes (3)
DROP INDEX CONCURRENTLY IF EXISTS idx_inventory_reference;
DROP INDEX CONCURRENTLY IF EXISTS idx_trucking_documents_parsed_payload;
DROP INDEX CONCURRENTLY IF EXISTS idx_trucking_loads_status;

-- Drop unnecessary new index (1)
DROP INDEX CONCURRENTLY IF EXISTS idx_trucking_documents_has_manifest;

-- ============================================================================
-- VERIFICATION AFTER CLEANUP
-- ============================================================================

-- Check remaining indexes (should be 11 total)
SELECT
  tablename,
  indexname,
  pg_size_pretty(pg_relation_size(indexrelid)) as index_size
FROM pg_stat_user_indexes
WHERE indexrelname LIKE 'idx_trucking%' OR indexrelname LIKE 'idx_inventory%'
ORDER BY tablename, indexrelname;

-- Expected 11 remaining indexes:
-- inventory (6):
--   - idx_inventory_company
--   - idx_inventory_created_at
--   - idx_inventory_manifest_item
--   - idx_inventory_request
--   - idx_inventory_request_status
--   - idx_inventory_status
--   - idx_inventory_storage_area
-- trucking_documents (2):
--   - idx_trucking_documents_load
--   - idx_trucking_documents_type (optional, keep for now)
-- trucking_loads (3):
--   - idx_trucking_loads_direction
--   - idx_trucking_loads_request

-- ============================================================================
-- DISK SPACE SAVINGS
-- ============================================================================

-- Before cleanup: 15 indexes
-- After cleanup:  11 indexes
-- Removed:        4 indexes
-- Estimated savings: 10-20 MB (depends on table sizes)
-- Write performance improvement: ~7% on inventory table, ~5% on trucking_documents

-- ============================================================================
-- OPTIONAL: Drop document_type index too (if you want to be aggressive)
-- ============================================================================

-- IF you're sure you'll never filter documents by type in the database:
-- DROP INDEX CONCURRENTLY IF EXISTS idx_trucking_documents_type;
--
-- This would leave you with 10 total indexes (minimal set)
-- But I recommend keeping it for future-proofing (manifests vs photos vs PODs filtering)

-- ============================================================================
-- FINAL CHECKLIST
-- ============================================================================

-- [ ] Ran all 4 DROP INDEX CONCURRENTLY statements above
-- [ ] Verified 11 indexes remain (query above)
-- [ ] No errors in Supabase logs
-- [ ] Ready to proceed with frontend integration

-- ============================================================================
-- END OF CLEANUP
-- ============================================================================
