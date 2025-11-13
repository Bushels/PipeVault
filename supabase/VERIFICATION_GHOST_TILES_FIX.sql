-- ============================================================================
-- VERIFICATION QUERIES: Ghost Tiles Fix
-- ============================================================================
-- Run these queries BEFORE and AFTER applying migration 20251110000004
-- to verify the fix eliminates ghost tiles while preserving data integrity

-- ============================================================================
-- PRE-MIGRATION CHECKS
-- ============================================================================

-- 1. Show all companies that will be affected by filtering
SELECT
  c.id,
  c.name,
  c.domain,
  COUNT(sr.id) as request_count,
  MAX(sr.created_at) as latest_request,
  CASE
    WHEN c.domain = 'mpsgroup.ca' THEN 'ADMIN (will be filtered)'
    WHEN c.domain IN ('ibelievefit.com', 'gmail.com') THEN 'TEST ACCOUNT (will be soft deleted)'
    ELSE 'CUSTOMER (will remain visible)'
  END as expected_status
FROM companies c
LEFT JOIN storage_requests sr ON sr.company_id = c.id
GROUP BY c.id, c.name, c.domain
ORDER BY c.name;

-- 2. Check for user accounts that may reference these companies
SELECT
  c.name as company_name,
  c.domain,
  COUNT(DISTINCT sr.user_email) as unique_requesters,
  STRING_AGG(DISTINCT sr.user_email, ', ') as requester_emails
FROM companies c
LEFT JOIN storage_requests sr ON sr.company_id = c.id
GROUP BY c.id, c.name, c.domain
ORDER BY c.name;

-- 3. Preview what get_company_summaries() currently returns
SELECT
  id,
  name,
  domain,
  'BEFORE MIGRATION' as status
FROM companies
ORDER BY name;

-- ============================================================================
-- POST-MIGRATION CHECKS
-- ============================================================================

-- 4. Verify new columns exist and are populated correctly
SELECT
  c.id,
  c.name,
  c.domain,
  c.is_customer,
  c.deleted_at,
  CASE
    WHEN c.is_customer = false THEN 'Hidden: Admin account'
    WHEN c.deleted_at IS NOT NULL THEN 'Hidden: Soft deleted'
    ELSE 'Visible in dashboard'
  END as visibility_status
FROM companies c
ORDER BY c.name;

-- 5. Test get_company_summaries() returns only customer companies
SELECT
  id,
  name,
  domain,
  total_requests,
  pending_requests,
  last_requester_name,
  last_requester_email,
  'AFTER MIGRATION - VISIBLE' as status
FROM get_company_summaries()
ORDER BY name;

-- Expected result: Only Bushels (bushelsenergy.com) should appear
-- Should NOT include: Mpsgroup (admin), Believe Fit (deleted), Bushels (gmail.com duplicate)

-- 6. Verify index was created for performance
SELECT
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'companies'
  AND indexname = 'idx_companies_customer_active';

-- Expected: Index exists on (is_customer, deleted_at) WHERE is_customer = true AND deleted_at IS NULL

-- 7. Check query performance with EXPLAIN
EXPLAIN ANALYZE
SELECT * FROM get_company_summaries();

-- Expected: Query should use idx_companies_customer_active for filtering
-- Execution time should be < 200ms for small datasets

-- ============================================================================
-- DATA INTEGRITY CHECKS
-- ============================================================================

-- 8. Verify no orphaned storage_requests (all reference valid companies)
SELECT
  sr.id as request_id,
  sr.reference_id,
  sr.company_id,
  c.name as company_name,
  c.is_customer,
  c.deleted_at
FROM storage_requests sr
LEFT JOIN companies c ON c.id = sr.company_id
WHERE c.id IS NULL OR c.deleted_at IS NOT NULL OR c.is_customer = false
ORDER BY sr.created_at DESC;

-- Expected: Requests may reference soft-deleted/admin companies (this is OK for audit trail)
-- We filter at the DISPLAY level, not the DATA level

-- 9. Verify requester info is populated correctly
SELECT
  id,
  name,
  domain,
  last_requester_name,
  last_requester_email,
  total_requests
FROM get_company_summaries()
WHERE last_requester_email IS NOT NULL
ORDER BY name;

-- Expected: All companies with requests should have requester info

-- 10. Check for duplicate company records by domain
SELECT
  domain,
  COUNT(*) as company_count,
  STRING_AGG(name, ', ') as company_names
FROM companies
WHERE is_customer = true AND deleted_at IS NULL
GROUP BY domain
HAVING COUNT(*) > 1;

-- Expected: No duplicates (gmail.com duplicate should be soft deleted)

-- ============================================================================
-- RLS POLICY CHECKS
-- ============================================================================

-- 11. Verify RLS policies still work correctly after schema changes
-- (Run as non-admin user to test customer isolation)
SET LOCAL ROLE authenticated;

SELECT id, name, domain FROM companies LIMIT 5;

-- Expected: Customers should only see their own company
-- Admins should see all active customer companies

RESET ROLE;

-- ============================================================================
-- ROLLBACK VALIDATION QUERIES
-- ============================================================================

-- 12. If rollback is needed, verify original state is restored
-- (Run these AFTER running the rollback script from migration file)

-- Check columns were dropped
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'companies'
  AND column_name IN ('is_customer', 'deleted_at');

-- Expected: Empty result set (columns should not exist)

-- Check index was dropped
SELECT indexname
FROM pg_indexes
WHERE tablename = 'companies'
  AND indexname = 'idx_companies_customer_active';

-- Expected: Empty result set (index should not exist)

-- Check function signature reverted
SELECT
  routine_name,
  data_type,
  character_maximum_length
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'get_company_summaries';

-- Expected: Function should exist but return original columns (no last_requester_* fields)

-- ============================================================================
-- PERFORMANCE BENCHMARKS
-- ============================================================================

-- 13. Compare query times before/after migration
-- Run this multiple times and average results
DO $$
DECLARE
  start_time TIMESTAMPTZ;
  end_time TIMESTAMPTZ;
  duration INTERVAL;
BEGIN
  start_time := clock_timestamp();

  PERFORM * FROM get_company_summaries();

  end_time := clock_timestamp();
  duration := end_time - start_time;

  RAISE NOTICE 'get_company_summaries() execution time: %', duration;
END $$;

-- Expected: < 200ms for datasets with < 1000 companies and < 10,000 requests
-- Performance should be similar to pre-migration (filtering adds negligible overhead)

-- ============================================================================
-- SUMMARY CHECKLIST
-- ============================================================================

/*
After running all verification queries, confirm:

✓ 1. New columns (is_customer, deleted_at) exist in companies table
✓ 2. Index idx_companies_customer_active exists and is used by queries
✓ 3. get_company_summaries() returns only active customer companies
✓ 4. Ghost tiles (admin, deleted) no longer appear in results
✓ 5. Requester name/email fields are populated for companies with requests
✓ 6. No duplicate company domains in active results
✓ 7. Query performance remains acceptable (< 200ms)
✓ 8. RLS policies still function correctly
✓ 9. Data integrity maintained (no orphaned records)
✓ 10. Rollback script works if needed

If all checks pass, migration is successful.
If any checks fail, investigate before deploying to production.
*/
