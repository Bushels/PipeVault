-- ============================================================================
-- VERIFICATION QUERIES - Run These to Confirm Deployment
-- ============================================================================
-- Run each section and verify the expected results
-- ============================================================================

-- ============================================================================
-- SECTION 1: VERIFY FUNCTIONS EXIST
-- ============================================================================

-- Check both functions are created
SELECT
  proname as function_name,
  prosecdef as is_security_definer,
  proacl as permissions
FROM pg_proc
WHERE proname IN ('is_admin_user', 'get_project_summaries_by_company')
ORDER BY proname;

-- Expected Result:
-- function_name                      | is_security_definer | permissions
-- -----------------------------------+---------------------+---------------------------
-- get_project_summaries_by_company  | t                   | {authenticated=X/...}
-- is_admin_user                      | t                   | NULL (no public access)

-- ✅ If you see 2 rows with these values, functions are deployed correctly

-- ============================================================================
-- SECTION 2: VERIFY INDEXES EXIST
-- ============================================================================

-- Check all 9 indexes are created
SELECT
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE indexname LIKE 'idx_trucking%' OR indexname LIKE 'idx_inventory%'
ORDER BY tablename, indexname;

-- Expected Result: 9 rows showing:
-- inventory        | idx_inventory_request
-- inventory        | idx_inventory_request_status
-- inventory        | idx_inventory_status
-- inventory        | idx_inventory_storage_area
-- trucking_documents | idx_trucking_documents_has_manifest
-- trucking_documents | idx_trucking_documents_load
-- trucking_documents | idx_trucking_documents_type
-- trucking_loads   | idx_trucking_loads_direction
-- trucking_loads   | idx_trucking_loads_request

-- ✅ If you see all 9 indexes, indexes are deployed correctly

-- ============================================================================
-- SECTION 3: VERIFY INVENTORY COLUMN NAME IS CORRECT
-- ============================================================================

-- Verify the function uses the correct column name (request_id)
SELECT pg_get_functiondef('get_project_summaries_by_company'::regproc);

-- Search the output for "i.request_id" (should appear 3 times)
-- ❌ If you see "i.storage_request_id", the function has the old bug
-- ✅ If you see "i.request_id", the function is correct

-- ============================================================================
-- SECTION 4: TEST is_admin_user() SECURITY
-- ============================================================================

-- This should FAIL with permission denied (correct behavior)
SELECT is_admin_user();

-- Expected Result: ERROR: permission denied for function is_admin_user
-- ✅ If you get this error, security is working correctly
-- ❌ If it returns TRUE/FALSE, the function is publicly callable (security issue)

-- ============================================================================
-- SECTION 5: TEST get_project_summaries_by_company() (ADMIN ONLY)
-- ============================================================================

-- This will only work if you're logged in as an admin
SELECT get_project_summaries_by_company();

-- Expected Result (if you're an admin):
-- A JSON array like: [{"company": {...}, "projects": [...]}]
-- ✅ If you get JSON data, the function works

-- Expected Result (if you're NOT an admin):
-- ERROR: Access denied. Admin privileges required.
-- ✅ If you get this error as non-admin, security is working

-- ============================================================================
-- SECTION 6: VERIFY mpsgroup.ca IS FILTERED OUT
-- ============================================================================

-- Check that admin company is excluded (case-insensitive)
SELECT
  company->>'domain' as domain,
  company->>'name' as name
FROM json_array_elements(get_project_summaries_by_company()::json) AS companies,
     json_to_record(companies) AS (company json, projects json)
WHERE lower(company->>'domain') = 'mpsgroup.ca';

-- Expected Result: 0 rows (empty result set)
-- ✅ If empty, mpsgroup.ca is correctly filtered out
-- ❌ If you see rows, filtering is not working

-- ============================================================================
-- SECTION 7: VERIFY DOCUMENT STRUCTURE (parsedPayload included)
-- ============================================================================

-- Check that documents include parsedPayload field
SELECT
  p->>'referenceId' as reference_id,
  jsonb_array_length((p->'inboundLoads')::jsonb) as load_count,
  (p->'inboundLoads'->0->'documents'->0)::jsonb ? 'parsedPayload' as has_parsed_payload,
  jsonb_typeof((p->'inboundLoads'->0->'documents')::jsonb) as documents_type
FROM json_array_elements(get_project_summaries_by_company()::json) AS companies,
     json_array_elements(companies->'projects') AS p
WHERE jsonb_array_length((p->'inboundLoads')::jsonb) > 0
LIMIT 5;

-- Expected Result:
-- reference_id | load_count | has_parsed_payload | documents_type
-- -------------+------------+--------------------+---------------
-- REF-001      | 2          | t                  | array
-- REF-002      | 1          | t                  | array
-- ...

-- ✅ If has_parsed_payload = t, document structure is correct
-- ❌ If has_parsed_payload = f or NULL, parsedPayload is missing

-- ============================================================================
-- SECTION 8: VERIFY RACK INVENTORY STRUCTURE
-- ============================================================================

-- Check that assignedRacks includes per-rack details
SELECT
  p->>'referenceId' as reference_id,
  (p->'inboundLoads'->0->'assignedRacks')::jsonb as racks,
  jsonb_typeof((p->'inboundLoads'->0->'assignedRacks')::jsonb) as racks_type
FROM json_array_elements(get_project_summaries_by_company()::json) AS companies,
     json_array_elements(companies->'projects') AS p
WHERE (p->'inboundLoads'->0->'assignedRacks')::jsonb != '[]'::jsonb
LIMIT 3;

-- Expected Result:
-- reference_id | racks                                                   | racks_type
-- -------------+---------------------------------------------------------+-----------
-- REF-001      | [{"rackId": "...", "rackName": "A-B1-05", ...}]        | array
-- ...

-- ✅ If racks_type = array and racks contains rackId/rackName, structure is correct

-- ============================================================================
-- SECTION 9: VERIFY STATUSES FIELD (array, not single value)
-- ============================================================================

-- Check that rack inventory has 'statuses' (array), not 'status' (string)
SELECT
  p->>'referenceId' as reference_id,
  (p->'inboundLoads'->0->'assignedRacks'->0)::jsonb ? 'statuses' as has_statuses_array,
  (p->'inboundLoads'->0->'assignedRacks'->0)::jsonb ? 'status' as has_status_string,
  (p->'inboundLoads'->0->'assignedRacks'->0->'statuses')::jsonb as statuses_value
FROM json_array_elements(get_project_summaries_by_company()::json) AS companies,
     json_array_elements(companies->'projects') AS p
WHERE jsonb_array_length((p->'inboundLoads'->0->'assignedRacks')::jsonb) > 0
LIMIT 3;

-- Expected Result:
-- reference_id | has_statuses_array | has_status_string | statuses_value
-- -------------+--------------------+-------------------+----------------------
-- REF-001      | t                  | f                 | ["IN_STORAGE"]
-- ...

-- ✅ If has_statuses_array = t and has_status_string = f, the fix is applied
-- ❌ If has_status_string = t, old bug is still present

-- ============================================================================
-- SECTION 10: PERFORMANCE CHECK
-- ============================================================================

-- Time the RPC call (check it completes in reasonable time)
\timing on
SELECT get_project_summaries_by_company();
\timing off

-- Expected Result: Time: <500ms for 50-100 projects
--                  Time: <1000ms for 200+ projects
-- ✅ If under 1 second, performance is acceptable
-- ⚠️  If over 2 seconds, indexes may not be working

-- Check index usage (explain plan)
EXPLAIN ANALYZE
SELECT get_project_summaries_by_company();

-- Look for:
-- ✅ "Index Scan using idx_inventory_request"
-- ✅ "Index Scan using idx_trucking_loads_request"
-- ✅ "Index Scan using idx_trucking_documents_load"
-- ❌ "Seq Scan on inventory" (bad - means index not used)

-- ============================================================================
-- SECTION 11: QUICK SUMMARY CHECK
-- ============================================================================

-- All-in-one verification query
SELECT
  'Functions' as check_type,
  COUNT(*) as count,
  CASE
    WHEN COUNT(*) = 2 THEN '✅ PASS'
    ELSE '❌ FAIL'
  END as status
FROM pg_proc
WHERE proname IN ('is_admin_user', 'get_project_summaries_by_company')

UNION ALL

SELECT
  'Indexes' as check_type,
  COUNT(*) as count,
  CASE
    WHEN COUNT(*) = 9 THEN '✅ PASS'
    ELSE '❌ FAIL'
  END as status
FROM pg_indexes
WHERE indexname LIKE 'idx_trucking%' OR indexname LIKE 'idx_inventory%'

UNION ALL

SELECT
  'Companies' as check_type,
  json_array_length(get_project_summaries_by_company()::json) as count,
  CASE
    WHEN json_array_length(get_project_summaries_by_company()::json) > 0 THEN '✅ PASS'
    ELSE '⚠️  NO DATA'
  END as status;

-- Expected Result:
-- check_type | count | status
-- -----------+-------+----------
-- Functions  | 2     | ✅ PASS
-- Indexes    | 9     | ✅ PASS
-- Companies  | 3     | ✅ PASS (number depends on your data)

-- ============================================================================
-- SECTION 12: FINAL CHECKLIST
-- ============================================================================

-- Copy this checklist and mark each item:

-- [ ] Section 1: Both functions exist (2 rows)
-- [ ] Section 2: All indexes exist (9 rows)
-- [ ] Section 3: Function uses "i.request_id" (not storage_request_id)
-- [ ] Section 4: is_admin_user() is NOT publicly callable (error expected)
-- [ ] Section 5: get_project_summaries_by_company() works for admin
-- [ ] Section 6: mpsgroup.ca is filtered out (0 rows)
-- [ ] Section 7: Documents include parsedPayload (has_parsed_payload = t)
-- [ ] Section 8: Racks include per-rack details (racks_type = array)
-- [ ] Section 9: Rack statuses is array (has_statuses_array = t)
-- [ ] Section 10: Performance under 1 second
-- [ ] Section 11: Summary shows all PASS

-- If all checked ✅, deployment is SUCCESSFUL!

-- ============================================================================
-- END OF VERIFICATION
-- ============================================================================
