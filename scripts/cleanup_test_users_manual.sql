-- ============================================================================
-- MANUAL TEST USER DATA CLEANUP SCRIPT
-- ============================================================================
-- Target users: kyle@bushelsenergy.com, kyle@ibelievefit.com
-- Database: PipeVault Production (cvevhvjxnklbbhtqzyvw.supabase.co)
-- Author: Database Integrity Guardian Agent
-- Date: 2025-11-18
--
-- IMPORTANT: This script performs PERMANENT DELETIONS!
-- Run the discovery queries first, review the results, then run cleanup queries.
--
-- Usage:
--   1. Run SECTION 1 (Discovery) in Supabase SQL Editor
--   2. Review the results carefully
--   3. If safe to proceed, run SECTION 2 (Cleanup) queries ONE BY ONE
--   4. Run SECTION 3 (Verification) to confirm cleanup
-- ============================================================================

-- ============================================================================
-- SECTION 1: DISCOVERY QUERIES
-- ============================================================================
-- Run these queries first to see what data exists
-- DO NOT SKIP THIS STEP!
-- ============================================================================

-- 1.1: Find auth users
SELECT '========== AUTH USERS ==========' as section;
SELECT
  id,
  email,
  raw_user_meta_data->>'company_id' as company_id,
  created_at,
  last_sign_in_at
FROM auth.users
WHERE email IN ('kyle@bushelsenergy.com', 'kyle@ibelievefit.com');

-- 1.2: Find companies
SELECT '========== COMPANIES ==========' as section;
WITH test_user_companies AS (
  SELECT DISTINCT (raw_user_meta_data->>'company_id')::uuid as company_id
  FROM auth.users
  WHERE email IN ('kyle@bushelsenergy.com', 'kyle@ibelievefit.com')
    AND raw_user_meta_data->>'company_id' IS NOT NULL
)
SELECT
  c.id,
  c.name,
  c.domain,
  c.is_customer,
  c.is_archived,
  c.created_at,
  (SELECT COUNT(*) FROM storage_requests WHERE company_id = c.id) as request_count,
  (SELECT COUNT(*) FROM inventory WHERE company_id = c.id) as inventory_count
FROM companies c
WHERE c.domain IN ('bushelsenergy.com', 'ibelievefit.com')
   OR c.id IN (SELECT company_id FROM test_user_companies);

-- 1.3: SUMMARY COUNTS
SELECT '========== SUMMARY COUNTS ==========' as section;
WITH test_users AS (
  SELECT id FROM auth.users
  WHERE email IN ('kyle@bushelsenergy.com', 'kyle@ibelievefit.com')
),
test_companies AS (
  SELECT c.id
  FROM companies c
  WHERE c.domain IN ('bushelsenergy.com', 'ibelievefit.com')
     OR c.id IN (
       SELECT (raw_user_meta_data->>'company_id')::uuid
       FROM auth.users
       WHERE email IN ('kyle@bushelsenergy.com', 'kyle@ibelievefit.com')
         AND raw_user_meta_data->>'company_id' IS NOT NULL
     )
),
test_requests AS (
  SELECT sr.id
  FROM storage_requests sr
  WHERE sr.company_id IN (SELECT id FROM test_companies)
     OR sr.user_email IN ('kyle@bushelsenergy.com', 'kyle@ibelievefit.com')
),
test_loads AS (
  SELECT tl.id
  FROM trucking_loads tl
  WHERE tl.storage_request_id IN (SELECT id FROM test_requests)
),
test_shipments AS (
  SELECT s.id
  FROM shipments s
  WHERE s.request_id IN (SELECT id FROM test_requests)
     OR s.company_id IN (SELECT id FROM test_companies)
)
SELECT
  (SELECT COUNT(*) FROM test_users) as auth_users,
  (SELECT COUNT(*) FROM auth.sessions WHERE user_id IN (SELECT id FROM test_users)) as auth_sessions,
  (SELECT COUNT(*) FROM test_companies) as companies,
  (SELECT COUNT(*) FROM test_requests) as storage_requests,
  (SELECT COUNT(*) FROM test_loads) as trucking_loads,
  (SELECT COUNT(*) FROM trucking_documents WHERE trucking_load_id IN (SELECT id FROM test_loads)) as trucking_documents,
  (SELECT COUNT(*) FROM inventory WHERE company_id IN (SELECT id FROM test_companies)) as inventory_items,
  (SELECT COUNT(*) FROM conversations WHERE user_email IN ('kyle@bushelsenergy.com', 'kyle@ibelievefit.com')) as conversations,
  (SELECT COUNT(*) FROM documents WHERE company_id IN (SELECT id FROM test_companies)) as documents,
  (SELECT COUNT(*) FROM test_shipments) as shipments,
  (SELECT COUNT(*) FROM notification_queue WHERE recipient_email IN ('kyle@bushelsenergy.com', 'kyle@ibelievefit.com')) as notification_queue;

-- ============================================================================
-- SECTION 2: CLEANUP QUERIES
-- ============================================================================
-- ⚠️ WARNING: These queries PERMANENTLY DELETE data!
-- Only run these after reviewing the discovery results above.
-- Run queries ONE BY ONE in the order shown below.
-- ============================================================================

-- ============================================================================
-- STEP 1: Delete notification queue entries
-- ============================================================================
DELETE FROM notification_queue
WHERE recipient_email IN ('kyle@bushelsenergy.com', 'kyle@ibelievefit.com');
-- Check result: Should show "X rows deleted"

-- ============================================================================
-- STEP 2: Delete notifications
-- ============================================================================
WITH test_users AS (
  SELECT id FROM auth.users
  WHERE email IN ('kyle@bushelsenergy.com', 'kyle@ibelievefit.com')
),
test_companies AS (
  SELECT c.id
  FROM companies c
  WHERE c.domain IN ('bushelsenergy.com', 'ibelievefit.com')
)
DELETE FROM notifications
WHERE user_id IN (SELECT id FROM test_users)
   OR company_id IN (SELECT id FROM test_companies);
-- Check result: Should show "X rows deleted"

-- ============================================================================
-- STEP 3: Delete shipment items
-- ============================================================================
WITH test_companies AS (
  SELECT c.id
  FROM companies c
  WHERE c.domain IN ('bushelsenergy.com', 'ibelievefit.com')
),
test_requests AS (
  SELECT sr.id
  FROM storage_requests sr
  WHERE sr.company_id IN (SELECT id FROM test_companies)
     OR sr.user_email IN ('kyle@bushelsenergy.com', 'kyle@ibelievefit.com')
),
test_shipments AS (
  SELECT s.id
  FROM shipments s
  WHERE s.request_id IN (SELECT id FROM test_requests)
     OR s.company_id IN (SELECT id FROM test_companies)
)
DELETE FROM shipment_items
WHERE shipment_id IN (SELECT id FROM test_shipments);
-- Check result: Should show "X rows deleted"

-- ============================================================================
-- STEP 4: Delete shipment documents
-- ============================================================================
WITH test_companies AS (
  SELECT c.id
  FROM companies c
  WHERE c.domain IN ('bushelsenergy.com', 'ibelievefit.com')
),
test_requests AS (
  SELECT sr.id
  FROM storage_requests sr
  WHERE sr.company_id IN (SELECT id FROM test_companies)
     OR sr.user_email IN ('kyle@bushelsenergy.com', 'kyle@ibelievefit.com')
),
test_shipments AS (
  SELECT s.id
  FROM shipments s
  WHERE s.request_id IN (SELECT id FROM test_requests)
     OR s.company_id IN (SELECT id FROM test_companies)
)
DELETE FROM shipment_documents
WHERE shipment_id IN (SELECT id FROM test_shipments);
-- Check result: Should show "X rows deleted"

-- ============================================================================
-- STEP 5: Delete dock appointments
-- ============================================================================
WITH test_companies AS (
  SELECT c.id
  FROM companies c
  WHERE c.domain IN ('bushelsenergy.com', 'ibelievefit.com')
),
test_requests AS (
  SELECT sr.id
  FROM storage_requests sr
  WHERE sr.company_id IN (SELECT id FROM test_companies)
     OR sr.user_email IN ('kyle@bushelsenergy.com', 'kyle@ibelievefit.com')
),
test_shipments AS (
  SELECT s.id
  FROM shipments s
  WHERE s.request_id IN (SELECT id FROM test_requests)
     OR s.company_id IN (SELECT id FROM test_companies)
)
DELETE FROM dock_appointments
WHERE shipment_id IN (SELECT id FROM test_shipments);
-- Check result: Should show "X rows deleted"

-- ============================================================================
-- STEP 6: Delete shipment trucks
-- ============================================================================
WITH test_companies AS (
  SELECT c.id
  FROM companies c
  WHERE c.domain IN ('bushelsenergy.com', 'ibelievefit.com')
),
test_requests AS (
  SELECT sr.id
  FROM storage_requests sr
  WHERE sr.company_id IN (SELECT id FROM test_companies)
     OR sr.user_email IN ('kyle@bushelsenergy.com', 'kyle@ibelievefit.com')
),
test_shipments AS (
  SELECT s.id
  FROM shipments s
  WHERE s.request_id IN (SELECT id FROM test_requests)
     OR s.company_id IN (SELECT id FROM test_companies)
)
DELETE FROM shipment_trucks
WHERE shipment_id IN (SELECT id FROM test_shipments);
-- Check result: Should show "X rows deleted"

-- ============================================================================
-- STEP 7: Delete shipments
-- ============================================================================
WITH test_companies AS (
  SELECT c.id
  FROM companies c
  WHERE c.domain IN ('bushelsenergy.com', 'ibelievefit.com')
),
test_requests AS (
  SELECT sr.id
  FROM storage_requests sr
  WHERE sr.company_id IN (SELECT id FROM test_companies)
     OR sr.user_email IN ('kyle@bushelsenergy.com', 'kyle@ibelievefit.com')
)
DELETE FROM shipments
WHERE request_id IN (SELECT id FROM test_requests)
   OR company_id IN (SELECT id FROM test_companies);
-- Check result: Should show "X rows deleted"

-- ============================================================================
-- STEP 8: Delete trucking documents
-- ============================================================================
WITH test_companies AS (
  SELECT c.id
  FROM companies c
  WHERE c.domain IN ('bushelsenergy.com', 'ibelievefit.com')
),
test_requests AS (
  SELECT sr.id
  FROM storage_requests sr
  WHERE sr.company_id IN (SELECT id FROM test_companies)
     OR sr.user_email IN ('kyle@bushelsenergy.com', 'kyle@ibelievefit.com')
),
test_loads AS (
  SELECT tl.id
  FROM trucking_loads tl
  WHERE tl.storage_request_id IN (SELECT id FROM test_requests)
)
DELETE FROM trucking_documents
WHERE trucking_load_id IN (SELECT id FROM test_loads);
-- Check result: Should show "X rows deleted"

-- ============================================================================
-- STEP 9: Delete inventory
-- ============================================================================
WITH test_companies AS (
  SELECT c.id
  FROM companies c
  WHERE c.domain IN ('bushelsenergy.com', 'ibelievefit.com')
)
DELETE FROM inventory
WHERE company_id IN (SELECT id FROM test_companies);
-- Check result: Should show "X rows deleted"

-- ============================================================================
-- STEP 10: Delete trucking loads
-- ============================================================================
WITH test_companies AS (
  SELECT c.id
  FROM companies c
  WHERE c.domain IN ('bushelsenergy.com', 'ibelievefit.com')
),
test_requests AS (
  SELECT sr.id
  FROM storage_requests sr
  WHERE sr.company_id IN (SELECT id FROM test_companies)
     OR sr.user_email IN ('kyle@bushelsenergy.com', 'kyle@ibelievefit.com')
)
DELETE FROM trucking_loads
WHERE storage_request_id IN (SELECT id FROM test_requests);
-- Check result: Should show "X rows deleted"

-- ============================================================================
-- STEP 11: Delete conversations
-- ============================================================================
WITH test_companies AS (
  SELECT c.id
  FROM companies c
  WHERE c.domain IN ('bushelsenergy.com', 'ibelievefit.com')
),
test_requests AS (
  SELECT sr.id
  FROM storage_requests sr
  WHERE sr.company_id IN (SELECT id FROM test_companies)
     OR sr.user_email IN ('kyle@bushelsenergy.com', 'kyle@ibelievefit.com')
)
DELETE FROM conversations
WHERE user_email IN ('kyle@bushelsenergy.com', 'kyle@ibelievefit.com')
   OR request_id IN (SELECT id FROM test_requests)
   OR company_id IN (SELECT id FROM test_companies);
-- Check result: Should show "X rows deleted"

-- ============================================================================
-- STEP 12: Delete documents
-- ============================================================================
WITH test_companies AS (
  SELECT c.id
  FROM companies c
  WHERE c.domain IN ('bushelsenergy.com', 'ibelievefit.com')
),
test_requests AS (
  SELECT sr.id
  FROM storage_requests sr
  WHERE sr.company_id IN (SELECT id FROM test_companies)
     OR sr.user_email IN ('kyle@bushelsenergy.com', 'kyle@ibelievefit.com')
)
DELETE FROM documents
WHERE request_id IN (SELECT id FROM test_requests)
   OR company_id IN (SELECT id FROM test_companies);
-- Check result: Should show "X rows deleted"

-- ============================================================================
-- STEP 13: Delete storage requests
-- ============================================================================
WITH test_companies AS (
  SELECT c.id
  FROM companies c
  WHERE c.domain IN ('bushelsenergy.com', 'ibelievefit.com')
)
DELETE FROM storage_requests
WHERE company_id IN (SELECT id FROM test_companies)
   OR user_email IN ('kyle@bushelsenergy.com', 'kyle@ibelievefit.com');
-- Check result: Should show "X rows deleted"

-- ============================================================================
-- STEP 14: Delete companies
-- ============================================================================
DELETE FROM companies
WHERE domain IN ('bushelsenergy.com', 'ibelievefit.com');
-- Check result: Should show "X rows deleted"

-- ============================================================================
-- STEP 15 & 16: Delete auth users and sessions
-- ============================================================================
-- ⚠️ NOTE: Auth user deletion must be done via Supabase Auth Admin API or Dashboard
--
-- To delete auth users:
-- 1. Go to Supabase Dashboard > Authentication > Users
-- 2. Find kyle@bushelsenergy.com and kyle@ibelievefit.com
-- 3. Click the "..." menu next to each user
-- 4. Select "Delete user"
--
-- OR use the Supabase CLI:
-- supabase auth users delete <user-id>
--
-- OR use the TypeScript cleanup script:
-- npx tsx scripts/cleanup-test-users.ts cleanup
-- ============================================================================

-- ============================================================================
-- SECTION 3: VERIFICATION QUERIES
-- ============================================================================
-- Run these after cleanup to verify all data was removed
-- ============================================================================

-- 3.1: Verify no data remains
SELECT '========== VERIFICATION ==========' as section;
WITH test_companies AS (
  SELECT c.id
  FROM companies c
  WHERE c.domain IN ('bushelsenergy.com', 'ibelievefit.com')
),
test_requests AS (
  SELECT sr.id
  FROM storage_requests sr
  WHERE sr.user_email IN ('kyle@bushelsenergy.com', 'kyle@ibelievefit.com')
),
test_loads AS (
  SELECT tl.id
  FROM trucking_loads tl
  WHERE tl.storage_request_id IN (SELECT id FROM test_requests)
)
SELECT
  (SELECT COUNT(*) FROM test_companies) as remaining_companies,
  (SELECT COUNT(*) FROM test_requests) as remaining_requests,
  (SELECT COUNT(*) FROM test_loads) as remaining_loads,
  (SELECT COUNT(*) FROM inventory WHERE company_id IN (SELECT id FROM test_companies)) as remaining_inventory,
  (SELECT COUNT(*) FROM conversations WHERE user_email IN ('kyle@bushelsenergy.com', 'kyle@ibelievefit.com')) as remaining_conversations,
  (SELECT COUNT(*) FROM notification_queue WHERE recipient_email IN ('kyle@bushelsenergy.com', 'kyle@ibelievefit.com')) as remaining_queue;

-- Expected result: All counts should be 0

-- 3.2: Check for orphaned records
SELECT '========== ORPHANED RECORDS CHECK ==========' as section;

-- Orphaned trucking loads (should return 0 rows)
SELECT 'Orphaned trucking_loads' as check_type, COUNT(*) as count
FROM trucking_loads tl
LEFT JOIN storage_requests sr ON tl.storage_request_id = sr.id
WHERE sr.id IS NULL;

-- Orphaned trucking documents (should return 0 rows)
SELECT 'Orphaned trucking_documents' as check_type, COUNT(*) as count
FROM trucking_documents td
LEFT JOIN trucking_loads tl ON td.trucking_load_id = tl.id
WHERE tl.id IS NULL;

-- Orphaned inventory (should return 0 rows)
SELECT 'Orphaned inventory (company)' as check_type, COUNT(*) as count
FROM inventory i
LEFT JOIN companies c ON i.company_id = c.id
WHERE c.id IS NULL;

-- Orphaned shipments (should return 0 rows)
SELECT 'Orphaned shipments (request)' as check_type, COUNT(*) as count
FROM shipments s
LEFT JOIN storage_requests sr ON s.request_id = sr.id
WHERE sr.id IS NULL;

-- 3.3: Verify RLS policies are intact
SELECT '========== RLS POLICIES CHECK ==========' as section;
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  cmd as command
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'companies',
    'storage_requests',
    'trucking_loads',
    'trucking_documents',
    'inventory',
    'conversations'
  )
ORDER BY tablename, policyname;

-- Expected: All RLS policies should still exist and be unchanged

-- ============================================================================
-- SECTION 4: DATABASE INTEGRITY CHECKS
-- ============================================================================

-- 4.1: Verify unique constraints (should return 0 rows)
SELECT 'Duplicate trucking_loads' as check_type, storage_request_id, direction, sequence_number, COUNT(*) as count
FROM trucking_loads
GROUP BY storage_request_id, direction, sequence_number
HAVING COUNT(*) > 1;

-- 4.2: Verify foreign key integrity (should return 0 rows)
SELECT 'Invalid FK: inventory.delivery_truck_load_id' as check_type, COUNT(*) as count
FROM inventory
WHERE delivery_truck_load_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM trucking_loads WHERE id = inventory.delivery_truck_load_id);

SELECT 'Invalid FK: inventory.pickup_truck_load_id' as check_type, COUNT(*) as count
FROM inventory
WHERE pickup_truck_load_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM trucking_loads WHERE id = inventory.pickup_truck_load_id);

-- ============================================================================
-- END OF CLEANUP SCRIPT
-- ============================================================================
-- If all verification queries return 0 counts:
--   ✅ Cleanup was successful!
--   ✅ No orphaned records
--   ✅ Database integrity intact
--   ✅ RLS policies preserved
--
-- Remember to delete the auth users manually via Dashboard or API!
-- ============================================================================
