-- ============================================================================
-- Ghost Tiles Elimination - Verification Queries
-- ============================================================================
-- Purpose: Validate that ghost companies are properly filtered from admin dashboard
-- Run these queries AFTER applying migrations 20251110000005 through 20251110000009
--
-- Expected Results:
-- 1. Schema changes applied successfully
-- 2. Ghost companies (ibelievefit.com, gmail.com) are archived
-- 3. Admin account (mpsgroup.ca) is marked as non-customer
-- 4. get_company_summaries() returns only active customers
-- 5. Only bushelsenergy.com should appear in admin dashboard
-- ============================================================================

-- ============================================================================
-- STEP 1: Verify Schema Changes Applied
-- ============================================================================

\echo '=== STEP 1: Verify Metadata Columns Exist ==='
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'companies'
  AND column_name IN ('is_customer', 'is_archived', 'archived_at', 'deleted_at')
ORDER BY column_name;

-- Expected: 4 rows showing all metadata columns exist

\echo ''
\echo '=== STEP 2: Verify Indexes Created ==='
SELECT
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'companies'
  AND indexname LIKE 'idx_companies_%'
ORDER BY indexname;

-- Expected: At least 2 indexes (idx_companies_active_customers, idx_companies_archived_at)

-- ============================================================================
-- STEP 3: Verify Data Cleanup Applied Correctly
-- ============================================================================

\echo ''
\echo '=== STEP 3: Current Company Status Breakdown ==='
SELECT
  is_customer,
  is_archived,
  COUNT(*) as count,
  ARRAY_AGG(name || ' (' || domain || ')') as companies
FROM public.companies
GROUP BY is_customer, is_archived
ORDER BY is_customer DESC, is_archived;

-- Expected:
-- is_customer=true,  is_archived=false: 1 company (Bushels/bushelsenergy.com)
-- is_customer=true,  is_archived=true:  2 companies (Believe Fit, Bushels/gmail.com)
-- is_customer=false, is_archived=false: 1 company (Mpsgroup)

\echo ''
\echo '=== STEP 4: Ghost Companies Should Be Archived ==='
SELECT
  id,
  name,
  domain,
  is_customer,
  is_archived,
  archived_at,
  deleted_at
FROM public.companies
WHERE is_archived = true OR is_customer = false
ORDER BY name;

-- Expected: 3 rows
-- 1. Believe Fit (ibelievefit.com) - is_archived=true
-- 2. Bushels (gmail.com) - is_archived=true
-- 3. Mpsgroup (mpsgroup.ca) - is_customer=false

\echo ''
\echo '=== STEP 5: Active Customers (What Admin Dashboard Will Show) ==='
SELECT
  id,
  name,
  domain,
  is_customer,
  is_archived,
  deleted_at,
  created_at
FROM public.companies
WHERE is_customer = true
  AND is_archived = false
  AND deleted_at IS NULL
ORDER BY name;

-- Expected: 1 row
-- Bushels (bushelsenergy.com) with active user kyle@bushelsenergy.com

-- ============================================================================
-- STEP 6: Verify get_company_summaries() Filters Correctly
-- ============================================================================

\echo ''
\echo '=== STEP 6: get_company_summaries() Result ==='
SELECT
  id,
  name,
  domain,
  total_requests,
  pending_requests,
  approved_requests,
  total_inventory_items,
  total_loads
FROM public.get_company_summaries()
ORDER BY name;

-- Expected: 1 row
-- Bushels (bushelsenergy.com) with their request/inventory stats
-- NO ibelievefit.com (archived)
-- NO gmail.com (archived)
-- NO mpsgroup.ca (non-customer)

\echo ''
\echo '=== STEP 7: Verify Auth Users Exist for Active Companies ==='
SELECT
  c.id as company_id,
  c.name as company_name,
  c.domain,
  sr.user_email,
  u.id as auth_user_id,
  u.deleted_at as user_deleted_at,
  CASE
    WHEN u.id IS NULL THEN 'NO AUTH USER'
    WHEN u.deleted_at IS NOT NULL THEN 'USER DELETED'
    ELSE 'ACTIVE USER'
  END as status
FROM public.companies c
LEFT JOIN public.storage_requests sr ON sr.company_id = c.id
LEFT JOIN auth.users u ON u.email = sr.user_email
WHERE c.is_customer = true AND c.is_archived = false
ORDER BY c.name, sr.user_email;

-- Expected: All active companies should have at least one ACTIVE USER

\echo ''
\echo '=== STEP 8: Orphaned Companies (Should Be Archived) ==='
SELECT
  c.id,
  c.name,
  c.domain,
  c.is_archived,
  ARRAY_AGG(DISTINCT sr.user_email) as user_emails
FROM public.companies c
LEFT JOIN public.storage_requests sr ON sr.company_id = c.id
WHERE
  c.is_customer = true
  AND NOT EXISTS (
    SELECT 1
    FROM storage_requests sr2
    JOIN auth.users u ON u.email = sr2.user_email AND u.deleted_at IS NULL
    WHERE sr2.company_id = c.id
  )
  AND EXISTS (
    SELECT 1 FROM storage_requests sr3 WHERE sr3.company_id = c.id
  )
GROUP BY c.id, c.name, c.domain, c.is_archived
ORDER BY c.name;

-- Expected: All returned rows should have is_archived=true
-- If any have is_archived=false, they are still ghosts

-- ============================================================================
-- STEP 9: Test Admin Utility Functions (Run as Admin User)
-- ============================================================================

\echo ''
\echo '=== STEP 9: Test get_archived_companies() Function ==='
SELECT
  id,
  name,
  domain,
  is_customer,
  archived_at,
  deleted_at,
  request_count,
  last_request_date
FROM public.get_archived_companies()
ORDER BY archived_at DESC;

-- Expected: Shows all archived companies with their metadata
-- Should include ibelievefit.com and gmail.com

-- ============================================================================
-- STEP 10: Performance Verification
-- ============================================================================

\echo ''
\echo '=== STEP 10: Verify Index Usage for get_company_summaries() ==='
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM public.get_company_summaries();

-- Expected: Should use idx_companies_active_customers index
-- Execution time should be < 200ms

-- ============================================================================
-- STEP 11: RLS Policy Verification
-- ============================================================================

\echo ''
\echo '=== STEP 11: List RLS Policies on Companies Table ==='
SELECT
  polname as policy_name,
  polcmd as command,
  polpermissive as permissive,
  pg_get_expr(polqual, polrelid) as using_expression,
  pg_get_expr(polwithcheck, polrelid) as with_check_expression
FROM pg_policy
WHERE polrelid = 'public.companies'::regclass
ORDER BY polname;

-- Expected: Should see policies for UPDATE (admin only) and DELETE (prevented)

-- ============================================================================
-- SUCCESS CRITERIA
-- ============================================================================
-- All tests pass if:
-- ✓ Metadata columns exist with correct types
-- ✓ Partial indexes created successfully
-- ✓ ibelievefit.com is archived (is_archived=true)
-- ✓ gmail.com is archived (is_archived=true)
-- ✓ mpsgroup.ca is marked as non-customer (is_customer=false)
-- ✓ get_company_summaries() returns ONLY bushelsenergy.com
-- ✓ No orphaned companies remain with is_archived=false
-- ✓ Admin utility functions execute without errors
-- ✓ RLS policies protect company metadata
-- ============================================================================

\echo ''
\echo '=== Verification Complete ==='
\echo 'Review results above to confirm ghost tiles are eliminated.'
\echo 'Expected: Only bushelsenergy.com appears in get_company_summaries()'
