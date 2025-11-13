-- ============================================================================
-- Add admin_notes Column to storage_requests
-- ============================================================================
-- This is a prerequisite for the atomic approval workflow migration.
-- The approval/rejection functions store internal admin notes in this column.
-- ============================================================================

ALTER TABLE storage_requests
ADD COLUMN IF NOT EXISTS admin_notes TEXT;

COMMENT ON COLUMN storage_requests.admin_notes IS
'Internal notes added by admin during approval or rejection process. Not visible to customers.';

-- Verification: Check column was added
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'storage_requests'
  AND column_name = 'admin_notes';

-- Expected result:
-- column_name  | data_type | is_nullable
-- -------------+-----------+-------------
-- admin_notes  | text      | YES
