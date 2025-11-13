-- Add created_at indexes for ORDER BY queries
-- These indexes improve performance for:
-- - useCompanyDetails() ordering storage_requests and inventory by created_at DESC
-- - useRecentActivity() ordering storage_requests by created_at DESC

-- Storage requests: Used in useCompanyDetails and useRecentActivity
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_storage_requests_created_at
ON storage_requests(created_at DESC);

-- Inventory: Used in useCompanyDetails
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_inventory_created_at
ON inventory(created_at DESC);

-- Composite index for pending approvals + recent activity
-- Supports queries filtering by status AND ordering by created_at
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_storage_requests_status_created_at
ON storage_requests(status, created_at DESC);

-- Remove duplicate indexes (cleanup)
DROP INDEX CONCURRENTLY IF EXISTS idx_storage_requests_company_id;
DROP INDEX CONCURRENTLY IF EXISTS idx_trucking_loads_storage_request_id;

-- Add comment for documentation
COMMENT ON INDEX idx_storage_requests_created_at IS
  'Optimizes ORDER BY created_at DESC queries in admin dashboard. ' ||
  'Enables O(1) index scan instead of O(N log N) sort for recent activity feeds.';

COMMENT ON INDEX idx_inventory_created_at IS
  'Optimizes ORDER BY created_at DESC queries for company inventory display.';

COMMENT ON INDEX idx_storage_requests_status_created_at IS
  'Composite index for filtering by status and ordering by created_at. ' ||
  'Used by pending approvals queries with recent-first sorting.';
