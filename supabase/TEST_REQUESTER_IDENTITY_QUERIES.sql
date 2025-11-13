-- Test Queries for Requester Identity Feature
-- Validates that get_company_summaries() correctly returns requester information
-- for companies with pending storage requests

-- =============================================================================
-- TEST 1: Basic Requester Identity Retrieval
-- =============================================================================
-- Expected: Companies with pending requests should show requester name and email
-- Failure: last_requester_name or last_requester_email is NULL when pending_requests > 0

SELECT
  name as company_name,
  pending_requests,
  last_requester_name,
  last_requester_email,
  last_pending_created_at
FROM get_company_summaries()
WHERE pending_requests > 0
ORDER BY last_pending_created_at DESC
LIMIT 10;

-- Validation checks:
-- 1. last_requester_email should NEVER be NULL when pending_requests > 0
-- 2. last_requester_name may be NULL if user metadata is missing (graceful degradation)
-- 3. last_pending_created_at should be a valid timestamp

-- =============================================================================
-- TEST 2: Most Recent Pending Request Selection
-- =============================================================================
-- Expected: Should return the MOST RECENT pending request per company
-- Failure: Returns older pending request instead of newest

WITH pending_requests_detailed AS (
  SELECT
    c.name as company_name,
    sr.reference_id,
    sr.user_email,
    sr.created_at,
    ROW_NUMBER() OVER (PARTITION BY sr.company_id ORDER BY sr.created_at DESC) as rn
  FROM storage_requests sr
  JOIN companies c ON c.id = sr.company_id
  WHERE sr.status = 'PENDING'
)
SELECT
  prd.company_name,
  prd.reference_id as actual_latest_request,
  prd.user_email as actual_latest_email,
  prd.created_at as actual_latest_timestamp,
  cs.last_requester_email as function_returned_email,
  cs.last_pending_created_at as function_returned_timestamp,
  -- Should be 'PASS' if function returns the same email and timestamp
  CASE
    WHEN prd.user_email = cs.last_requester_email
      AND prd.created_at = cs.last_pending_created_at
    THEN 'PASS'
    ELSE 'FAIL'
  END as test_result
FROM pending_requests_detailed prd
JOIN get_company_summaries() cs ON cs.name = prd.company_name
WHERE prd.rn = 1
ORDER BY test_result, prd.company_name;

-- Validation: All rows should show 'PASS' in test_result column

-- =============================================================================
-- TEST 3: User Metadata Extraction (Name Construction)
-- =============================================================================
-- Expected: last_requester_name should be "FirstName LastName" from auth.users
-- Failure: Name is NULL even though metadata exists

SELECT
  cs.name as company_name,
  cs.last_requester_email,
  cs.last_requester_name as function_returned_name,
  u.raw_user_meta_data->>'first_name' as user_first_name,
  u.raw_user_meta_data->>'last_name' as user_last_name,
  TRIM(
    COALESCE(u.raw_user_meta_data->>'first_name', '') || ' ' ||
    COALESCE(u.raw_user_meta_data->>'last_name', '')
  ) as expected_full_name,
  CASE
    WHEN cs.last_requester_name = TRIM(
      COALESCE(u.raw_user_meta_data->>'first_name', '') || ' ' ||
      COALESCE(u.raw_user_meta_data->>'last_name', '')
    ) THEN 'PASS'
    WHEN cs.last_requester_name IS NULL
      AND u.raw_user_meta_data IS NULL THEN 'PASS (No Metadata)'
    ELSE 'FAIL'
  END as test_result
FROM get_company_summaries() cs
LEFT JOIN auth.users u ON u.email = cs.last_requester_email
WHERE cs.pending_requests > 0
ORDER BY test_result, cs.name;

-- Validation: Should show 'PASS' or 'PASS (No Metadata)' for all rows

-- =============================================================================
-- TEST 4: No False Positives (Companies Without Pending Requests)
-- =============================================================================
-- Expected: Companies with 0 pending requests should have NULL requester fields
-- Failure: Requester data appears even when pending_requests = 0

SELECT
  name as company_name,
  pending_requests,
  approved_requests,
  rejected_requests,
  last_requester_name,
  last_requester_email,
  CASE
    WHEN last_requester_name IS NULL
      AND last_requester_email IS NULL
      AND last_pending_created_at IS NULL
    THEN 'PASS'
    ELSE 'FAIL'
  END as test_result
FROM get_company_summaries()
WHERE pending_requests = 0
ORDER BY test_result, name
LIMIT 20;

-- Validation: All rows should show 'PASS' in test_result column

-- =============================================================================
-- TEST 5: Performance Check
-- =============================================================================
-- Expected: Query should complete in < 500ms for 50 companies with 5,000 requests
-- Failure: Query takes > 1 second (indicates missing index or inefficient join)

EXPLAIN ANALYZE
SELECT * FROM get_company_summaries();

-- Look for in output:
-- 1. "Seq Scan" on storage_requests (BAD - should use index)
-- 2. "Index Scan" or "Bitmap Index Scan" (GOOD)
-- 3. Execution Time < 500ms (GOOD)
-- 4. Planning Time < 50ms (GOOD)

-- =============================================================================
-- TEST 6: Edge Case - Multiple Pending Requests from Same Company
-- =============================================================================
-- Expected: Should handle companies with multiple pending requests
-- Failure: Duplicate rows or incorrect requester selection

WITH company_pending_counts AS (
  SELECT
    c.id,
    c.name,
    COUNT(*) as actual_pending_count
  FROM companies c
  JOIN storage_requests sr ON sr.company_id = c.id
  WHERE sr.status = 'PENDING'
  GROUP BY c.id, c.name
  HAVING COUNT(*) > 1
)
SELECT
  cpc.name as company_name,
  cpc.actual_pending_count,
  cs.pending_requests as function_returned_count,
  cs.last_requester_email,
  cs.last_requester_name,
  CASE
    WHEN cpc.actual_pending_count = cs.pending_requests
      AND cs.last_requester_email IS NOT NULL
    THEN 'PASS'
    ELSE 'FAIL'
  END as test_result
FROM company_pending_counts cpc
JOIN get_company_summaries() cs ON cs.id = cpc.id
ORDER BY test_result, cpc.actual_pending_count DESC;

-- Validation: All rows should show 'PASS', pending counts should match

-- =============================================================================
-- TEST 7: Graceful Degradation - Missing Auth Users
-- =============================================================================
-- Expected: Should return email even if auth.users record doesn't exist
-- Failure: NULL email when storage_request has valid user_email

SELECT
  cs.name as company_name,
  cs.last_requester_email,
  cs.last_requester_name,
  sr.user_email as request_user_email,
  CASE
    WHEN u.id IS NULL THEN 'User Not Found in auth.users'
    ELSE 'User Found'
  END as auth_status,
  CASE
    WHEN cs.last_requester_email = sr.user_email THEN 'PASS'
    ELSE 'FAIL'
  END as test_result
FROM get_company_summaries() cs
JOIN storage_requests sr ON sr.id = cs.last_pending_request_id
LEFT JOIN auth.users u ON u.email = sr.user_email
WHERE cs.pending_requests > 0
ORDER BY auth_status, test_result;

-- Validation: test_result should always be 'PASS' regardless of auth_status

-- =============================================================================
-- TEST 8: Data Consistency Check
-- =============================================================================
-- Expected: last_pending_request_id should match a real storage request
-- Failure: UUID points to non-existent or non-pending request

SELECT
  cs.name as company_name,
  cs.last_pending_request_id,
  sr.id as actual_request_id,
  sr.reference_id,
  sr.status,
  CASE
    WHEN sr.id IS NULL THEN 'FAIL - Request Not Found'
    WHEN sr.status != 'PENDING' THEN 'FAIL - Request Not Pending'
    WHEN sr.company_id != cs.id THEN 'FAIL - Company Mismatch'
    ELSE 'PASS'
  END as test_result
FROM get_company_summaries() cs
LEFT JOIN storage_requests sr ON sr.id = cs.last_pending_request_id
WHERE cs.pending_requests > 0
ORDER BY test_result, cs.name;

-- Validation: All rows should show 'PASS'

-- =============================================================================
-- SUMMARY REPORT
-- =============================================================================
-- Run this to get a high-level overview of requester identity feature health

WITH summary AS (
  SELECT
    COUNT(*) as total_companies,
    COUNT(*) FILTER (WHERE pending_requests > 0) as companies_with_pending,
    COUNT(*) FILTER (WHERE pending_requests > 0 AND last_requester_email IS NOT NULL) as with_requester_email,
    COUNT(*) FILTER (WHERE pending_requests > 0 AND last_requester_name IS NOT NULL) as with_requester_name,
    COUNT(*) FILTER (WHERE pending_requests = 0 AND last_requester_email IS NOT NULL) as false_positives
  FROM get_company_summaries()
)
SELECT
  total_companies,
  companies_with_pending,
  with_requester_email,
  with_requester_name,
  false_positives,
  -- Calculate percentages
  ROUND(100.0 * with_requester_email / NULLIF(companies_with_pending, 0), 2) as pct_email_coverage,
  ROUND(100.0 * with_requester_name / NULLIF(companies_with_pending, 0), 2) as pct_name_coverage,
  -- Test results
  CASE
    WHEN false_positives > 0 THEN 'FAIL - False positives detected'
    WHEN with_requester_email < companies_with_pending THEN 'WARNING - Missing emails'
    WHEN pct_name_coverage < 80 THEN 'WARNING - Low name coverage'
    ELSE 'PASS - All checks passed'
  END as overall_status
FROM summary;

-- Expected output:
-- - pct_email_coverage: 100% (every pending request has email)
-- - pct_name_coverage: 80-100% (depends on user metadata completeness)
-- - false_positives: 0
-- - overall_status: 'PASS - All checks passed'
