-- ============================================================================
-- Check Index Usage Statistics
-- ============================================================================
-- This shows which indexes are actually being used by queries
-- ============================================================================

-- Query 1: Index usage summary for all our indexes
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan as times_used,
  idx_tup_read as tuples_read,
  idx_tup_fetch as tuples_fetched,
  pg_size_pretty(pg_relation_size(indexrelid)) as index_size,
  CASE
    WHEN idx_scan = 0 THEN '⚠️  NEVER USED'
    WHEN idx_scan < 10 THEN '⚠️  RARELY USED'
    WHEN idx_scan < 100 THEN '✅ USED'
    ELSE '✅ HEAVILY USED'
  END as usage_status
FROM pg_stat_user_indexes
WHERE indexrelname LIKE 'idx_trucking%' OR indexrelname LIKE 'idx_inventory%'
ORDER BY idx_scan DESC, tablename, indexrelname;

-- Query 2: Detailed breakdown by table
SELECT
  tablename,
  COUNT(*) as index_count,
  SUM(idx_scan) as total_scans,
  pg_size_pretty(SUM(pg_relation_size(indexrelid))) as total_index_size
FROM pg_stat_user_indexes
WHERE indexrelname LIKE 'idx_trucking%' OR indexrelname LIKE 'idx_inventory%'
GROUP BY tablename
ORDER BY total_scans DESC;

-- Query 3: Check if inventory.manifest_item_id and inventory.reference_id exist
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'inventory'
  AND column_name IN ('manifest_item_id', 'reference_id', 'company_id')
ORDER BY column_name;

-- Query 4: Unused indexes (candidates for removal)
SELECT
  schemaname,
  tablename,
  indexname,
  pg_size_pretty(pg_relation_size(indexrelid)) as index_size,
  idx_scan as times_used,
  'DROP INDEX CONCURRENTLY IF EXISTS ' || indexrelname || ';' as drop_command
FROM pg_stat_user_indexes
WHERE (indexrelname LIKE 'idx_trucking%' OR indexrelname LIKE 'idx_inventory%')
  AND idx_scan = 0  -- Never used
ORDER BY pg_relation_size(indexrelid) DESC;

-- Query 5: Redundant indexes check (indexes covering the same columns)
SELECT
  t.tablename,
  i1.indexname as index1,
  i2.indexname as index2,
  pg_get_indexdef(i1.indexrelid) as index1_def,
  pg_get_indexdef(i2.indexrelid) as index2_def
FROM pg_indexes t
INNER JOIN pg_indexes i1 ON i1.tablename = t.tablename
INNER JOIN pg_indexes i2 ON i2.tablename = t.tablename
WHERE t.tablename IN ('inventory', 'trucking_loads', 'trucking_documents')
  AND i1.indexname < i2.indexname
  AND pg_get_indexdef(i1.indexrelid) = pg_get_indexdef(i2.indexrelid)
ORDER BY t.tablename, i1.indexname;

-- Query 6: Check last stats reset (context for usage numbers)
SELECT
  stats_reset,
  NOW() - stats_reset as time_since_reset,
  CASE
    WHEN NOW() - stats_reset < INTERVAL '1 day' THEN '⚠️  Stats reset <1 day ago (not enough data)'
    WHEN NOW() - stats_reset < INTERVAL '7 days' THEN '✅ Stats reset <1 week ago (good data)'
    ELSE '✅ Stats reset >1 week ago (excellent data)'
  END as data_quality
FROM pg_stat_database
WHERE datname = current_database();

-- ============================================================================
-- RECOMMENDATIONS BASED ON RESULTS
-- ============================================================================

-- After running the above queries, use this decision tree:
--
-- IF index shows "NEVER USED" (idx_scan = 0):
--   AND stats_reset > 7 days ago:
--     → Safe to DROP (not used in production)
--   AND stats_reset < 7 days ago:
--     → Wait 1 week and re-check before dropping
--
-- IF index shows "RARELY USED" (idx_scan < 10):
--   → Check query patterns - might be for admin-only or edge case queries
--   → Keep if it supports critical low-frequency queries (reports, admin actions)
--
-- IF index shows "USED" or "HEAVILY USED":
--   → KEEP - clearly valuable
--
-- IF two indexes are redundant (Query 5 shows duplicates):
--   → Keep the one with more scans, drop the other

-- ============================================================================
-- SAFE REMOVAL SCRIPT (if needed)
-- ============================================================================

-- Only run these if Query 4 confirms the index is never used AND stats > 7 days old
-- Copy individual DROP commands from Query 4 results

-- Example (DO NOT run blindly):
-- DROP INDEX CONCURRENTLY IF EXISTS idx_inventory_manifest_item;
-- DROP INDEX CONCURRENTLY IF EXISTS idx_inventory_reference;
