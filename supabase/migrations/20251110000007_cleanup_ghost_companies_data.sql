-- Migration: Cleanup Ghost Companies Data
-- Purpose: Mark admin accounts and deleted-user companies appropriately
-- Author: Database Integrity Guardian Agent
-- Date: 2025-11-10
--
-- This is a DATA MIGRATION that updates existing company records.
-- Run this AFTER the schema migrations (20251110000005 and 20251110000006).
--
-- Target ghost companies:
-- 1. Mpsgroup (mpsgroup.ca) - Admin account, not a customer
-- 2. Believe Fit (ibelievefit.com) - User deleted (deleted+ibelievefit@test.local)
-- 3. Bushels (gmail.com) - Test company with no requests, should be archived

-- ============================================================================
-- STEP 1: Mark Admin Accounts as Non-Customers
-- ============================================================================

-- Mark mpsgroup.ca as admin account (not a customer)
UPDATE public.companies
SET
  is_customer = false,
  updated_at = now()
WHERE domain = 'mpsgroup.ca';

-- Verify: Should update 1 row
-- SELECT id, name, domain, is_customer FROM companies WHERE domain = 'mpsgroup.ca';

-- ============================================================================
-- STEP 2: Archive Companies with Deleted Auth Users
-- ============================================================================

-- Archive companies where all associated user_emails have been deleted
-- Strategy: Mark company as archived if no active auth.users exist for any user_email
UPDATE public.companies c
SET
  is_archived = true,
  archived_at = now(),
  updated_at = now()
WHERE
  is_customer = true  -- Only affect customer accounts
  AND is_archived = false  -- Don't re-archive
  AND NOT EXISTS (
    -- Check if ANY active auth user exists for this company
    SELECT 1
    FROM storage_requests sr
    JOIN auth.users u ON u.email = sr.user_email
    WHERE sr.company_id = c.id
      AND u.deleted_at IS NULL  -- User not deleted
  )
  AND EXISTS (
    -- But company DOES have storage requests (not a new company with zero data)
    SELECT 1
    FROM storage_requests sr
    WHERE sr.company_id = c.id
  );

-- This should archive:
-- - Believe Fit (ibelievefit.com) - user_email is 'deleted+ibelievefit@test.local'
-- - Bushelsenergy partial (if deleted+bushelsenergy@test.local is the only user)

-- Verify archived companies:
-- SELECT id, name, domain, is_archived, archived_at
-- FROM companies
-- WHERE is_archived = true;

-- ============================================================================
-- STEP 3: Archive Test Companies with No Activity
-- ============================================================================

-- Archive test companies with generic domains and no storage requests
UPDATE public.companies
SET
  is_archived = true,
  archived_at = now(),
  updated_at = now()
WHERE
  is_customer = true
  AND is_archived = false
  AND (
    -- Generic email domains (not real company domains)
    domain IN ('gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com')
    OR
    -- Test/example domains
    domain LIKE '%example.com%'
    OR domain LIKE '%test.%'
  )
  AND NOT EXISTS (
    -- No storage requests (pure test data)
    SELECT 1 FROM storage_requests sr WHERE sr.company_id = companies.id
  );

-- This should archive:
-- - Bushels (gmail.com) - 0 requests, generic domain

-- Verify:
-- SELECT id, name, domain, is_archived, archived_at
-- FROM companies
-- WHERE domain IN ('gmail.com', 'yahoo.com', 'hotmail.com');

-- ============================================================================
-- STEP 4: Add Audit Comments
-- ============================================================================

-- Log the cleanup in a comment
COMMENT ON TABLE public.companies IS
  'Customer companies using PipeVault. ' ||
  'Lifecycle states: ' ||
  '- Active customer: is_customer=true, is_archived=false, deleted_at=NULL ' ||
  '- Archived customer: is_archived=true (e.g., deleted auth user) ' ||
  '- Admin account: is_customer=false (e.g., mpsgroup.ca) ' ||
  '- Soft-deleted: deleted_at IS NOT NULL (GDPR compliance) ' ||
  'Last cleanup: 2025-11-10 (removed ghost tiles from admin dashboard)';

-- ============================================================================
-- VALIDATION QUERIES (Run manually after migration)
-- ============================================================================

-- Count companies by status
-- SELECT
--   is_customer,
--   is_archived,
--   COUNT(*) as count
-- FROM companies
-- GROUP BY is_customer, is_archived;

-- Show active customers (what admin dashboard will show)
-- SELECT id, name, domain, is_customer, is_archived
-- FROM companies
-- WHERE is_customer = true AND is_archived = false AND deleted_at IS NULL;

-- Show archived companies (hidden from dashboard)
-- SELECT id, name, domain, is_archived, archived_at
-- FROM companies
-- WHERE is_archived = true
-- ORDER BY archived_at DESC;

-- Show admin accounts (hidden from customer tiles)
-- SELECT id, name, domain, is_customer
-- FROM companies
-- WHERE is_customer = false;

-- Verify get_company_summaries() excludes ghosts
-- SELECT COUNT(*) as active_customer_count FROM get_company_summaries();
