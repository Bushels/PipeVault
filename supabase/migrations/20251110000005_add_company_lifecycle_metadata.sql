-- Migration: Add Company Lifecycle Metadata Columns
-- Purpose: Track customer status, archival, and soft-deletion to eliminate ghost tiles
-- Author: Database Integrity Guardian Agent
-- Date: 2025-11-10
--
-- Problem: Admin dashboard shows tiles for:
-- 1. Deleted auth users (kyle@ibelievefit.com, buperac@gmail.com)
-- 2. Admin accounts (mpsgroup.ca) that shouldn't appear as customers
-- 3. Test companies with no active users (gmail.com domain)
--
-- Solution: Add metadata columns to enable proper filtering in get_company_summaries()

-- ============================================================================
-- STEP 1: Add Metadata Columns
-- ============================================================================

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS is_customer BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Add column comments for documentation
COMMENT ON COLUMN public.companies.is_customer IS
  'True for customer accounts, false for admin/internal accounts. ' ||
  'Admin accounts (e.g., mpsgroup.ca) should have is_customer = false to hide from customer tile carousel.';

COMMENT ON COLUMN public.companies.is_archived IS
  'True when company should be hidden from active lists. ' ||
  'Used for companies with deleted auth users or companies that are no longer active. ' ||
  'Archived companies are not shown in get_company_summaries() results.';

COMMENT ON COLUMN public.companies.archived_at IS
  'Timestamp when company was archived. NULL if never archived.';

COMMENT ON COLUMN public.companies.deleted_at IS
  'Soft delete timestamp for GDPR compliance. ' ||
  'When set, company data should be anonymized and hidden from all queries. ' ||
  'NULL indicates company is not deleted.';

-- ============================================================================
-- STEP 2: Create Performance Index
-- ============================================================================

-- Partial index for active customer queries
-- Only indexes rows where is_customer = true AND is_archived = false
-- This optimizes the get_company_summaries() WHERE clause
CREATE INDEX IF NOT EXISTS idx_companies_active_customers
  ON public.companies(id, name, domain)
  WHERE is_customer = true AND is_archived = false AND deleted_at IS NULL;

-- Index for archived_at queries (for admin reporting)
CREATE INDEX IF NOT EXISTS idx_companies_archived_at
  ON public.companies(archived_at)
  WHERE archived_at IS NOT NULL;

-- ============================================================================
-- STEP 3: Update Table Comments
-- ============================================================================

COMMENT ON TABLE public.companies IS
  'Customer companies using PipeVault. ' ||
  'Lifecycle states: ' ||
  '- Active customer: is_customer=true, is_archived=false, deleted_at=NULL ' ||
  '- Archived customer: is_archived=true (e.g., deleted auth user) ' ||
  '- Admin account: is_customer=false (e.g., mpsgroup.ca) ' ||
  '- Soft-deleted: deleted_at IS NOT NULL (GDPR compliance)';

-- ============================================================================
-- VALIDATION QUERIES (Run manually after migration)
-- ============================================================================

-- Verify columns were added
-- SELECT column_name, data_type, is_nullable, column_default
-- FROM information_schema.columns
-- WHERE table_schema = 'public' AND table_name = 'companies'
-- AND column_name IN ('is_customer', 'is_archived', 'archived_at', 'deleted_at');

-- Verify indexes were created
-- SELECT indexname, indexdef
-- FROM pg_indexes
-- WHERE schemaname = 'public'
-- AND tablename = 'companies'
-- AND indexname LIKE 'idx_companies_%';
