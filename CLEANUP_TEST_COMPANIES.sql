-- ============================================================================
-- CLEANUP SCRIPT: Delete Test Data for kyle@ibelievefit.com and kyle@bushelsenergy.com
-- ============================================================================
--
-- Purpose: Remove all test data so the workflow can be tested from scratch
-- with the fixed manifest extraction code.
--
-- This script deletes (in order):
-- 1. Trucking documents (files will remain in storage - manual cleanup needed)
-- 2. Trucking loads
-- 3. Inventory records
-- 4. Storage requests
-- 5. Companies (optional - uncomment if you want to delete companies too)
-- 6. Auth users (optional - uncomment if you want to delete auth accounts too)
--
-- IMPORTANT: Run this in Supabase Dashboard SQL Editor
-- ============================================================================

-- Get company IDs first (for verification)
SELECT id, name, domain
FROM companies
WHERE domain IN ('ibelievefit.com', 'bushelsenergy.com');

-- ============================================================================
-- STEP 1: Delete trucking documents
-- ============================================================================
-- Note: This deletes database records but NOT the actual files in storage.
-- Files remain in the 'documents' bucket and should be cleaned up manually
-- or with a separate storage management script.
DELETE FROM trucking_documents
WHERE trucking_load_id IN (
  SELECT tl.id
  FROM trucking_loads tl
  JOIN storage_requests sr ON sr.id = tl.storage_request_id
  JOIN companies c ON c.id = sr.company_id
  WHERE c.domain IN ('ibelievefit.com', 'bushelsenergy.com')
);

-- ============================================================================
-- STEP 2: Delete trucking loads
-- ============================================================================
DELETE FROM trucking_loads
WHERE storage_request_id IN (
  SELECT sr.id
  FROM storage_requests sr
  JOIN companies c ON c.id = sr.company_id
  WHERE c.domain IN ('ibelievefit.com', 'bushelsenergy.com')
);

-- ============================================================================
-- STEP 3: Delete inventory records
-- ============================================================================
DELETE FROM inventory
WHERE company_id IN (
  SELECT id FROM companies WHERE domain IN ('ibelievefit.com', 'bushelsenergy.com')
);

-- ============================================================================
-- STEP 4: Delete storage requests
-- ============================================================================
DELETE FROM storage_requests
WHERE company_id IN (
  SELECT id FROM companies WHERE domain IN ('ibelievefit.com', 'bushelsenergy.com')
);

-- ============================================================================
-- STEP 5: (OPTIONAL) Delete companies
-- ============================================================================
-- Uncomment the following lines if you want to delete the companies too.
-- If you keep the companies, you can just create new requests under them.

-- DELETE FROM companies
-- WHERE domain IN ('ibelievefit.com', 'bushelsenergy.com');

-- ============================================================================
-- STEP 6: (OPTIONAL) Delete auth users
-- ============================================================================
-- Uncomment the following lines if you want to delete the auth accounts.
-- This requires admin privileges on auth.users table.
-- If you keep the users, you can just sign in and create new requests.

-- DELETE FROM auth.users
-- WHERE email IN ('kyle@ibelievefit.com', 'kyle@bushelsenergy.com');

-- ============================================================================
-- VERIFICATION: Check cleanup was successful
-- ============================================================================

-- Should return 0 rows:
SELECT COUNT(*) as trucking_documents_remaining
FROM trucking_documents td
JOIN trucking_loads tl ON tl.id = td.trucking_load_id
JOIN storage_requests sr ON sr.id = tl.storage_request_id
JOIN companies c ON c.id = sr.company_id
WHERE c.domain IN ('ibelievefit.com', 'bushelsenergy.com');

SELECT COUNT(*) as trucking_loads_remaining
FROM trucking_loads tl
JOIN storage_requests sr ON sr.id = tl.storage_request_id
JOIN companies c ON c.id = sr.company_id
WHERE c.domain IN ('ibelievefit.com', 'bushelsenergy.com');

SELECT COUNT(*) as inventory_remaining
FROM inventory
WHERE company_id IN (
  SELECT id FROM companies WHERE domain IN ('ibelievefit.com', 'bushelsenergy.com')
);

SELECT COUNT(*) as storage_requests_remaining
FROM storage_requests
WHERE company_id IN (
  SELECT id FROM companies WHERE domain IN ('ibelievefit.com', 'bushelsenergy.com')
);

-- Show remaining companies (should still exist if you didn't delete them):
SELECT id, name, domain, is_archived
FROM companies
WHERE domain IN ('ibelievefit.com', 'bushelsenergy.com');

-- ============================================================================
-- STORAGE BUCKET CLEANUP (MANUAL)
-- ============================================================================
-- The documents are stored in the 'documents' bucket with paths like:
-- - {company_id}/{request_ref}/shipments/{load_id}/{timestamp}-{filename}
--
-- You can manually delete these in Supabase Dashboard:
-- 1. Go to Storage > documents bucket
-- 2. Navigate to the company folders
-- 3. Delete the folders for these test companies
--
-- Or use the Supabase CLI:
-- supabase storage rm documents/{company_id} --recursive
-- ============================================================================
