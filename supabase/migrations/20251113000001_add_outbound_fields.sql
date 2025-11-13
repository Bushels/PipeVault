-- ============================================================================
-- MIGRATION: Add Outbound Workflow Fields
-- ============================================================================
--
-- Purpose: Extend schema to support outbound shipments (pickup from MPS to well site)
--
-- Changes:
-- 1. Add direction field to trucking_loads (INBOUND vs OUTBOUND)
-- 2. Add destination fields (LSD, Well Name, UWI)
-- 3. Add shipping method (Customer Arranged vs MPS Quote)
-- 4. Add pickup tracking to inventory
-- 5. Add archival tracking to storage_requests
-- 6. Add validation constraints
-- 7. Add performance indexes
--
-- ============================================================================

-- ============================================================================
-- STEP 1: Extend trucking_loads table for outbound loads
-- ============================================================================

-- Add direction field (default INBOUND for existing loads)
ALTER TABLE public.trucking_loads
ADD COLUMN direction TEXT NOT NULL DEFAULT 'INBOUND'
CHECK (direction IN ('INBOUND', 'OUTBOUND'));

-- Add destination fields for outbound loads
ALTER TABLE public.trucking_loads
ADD COLUMN destination_lsd TEXT; -- Legal Subdivision (e.g., "LSD 06-24-079-15W5")

ALTER TABLE public.trucking_loads
ADD COLUMN destination_well_name TEXT; -- Well name (e.g., "Alpha-7")

ALTER TABLE public.trucking_loads
ADD COLUMN destination_uwi TEXT; -- Unique Well Identifier (e.g., "100/06-24-079-15W5/0")

-- Add shipping method for outbound loads
ALTER TABLE public.trucking_loads
ADD COLUMN shipping_method TEXT
CHECK (shipping_method IN ('CUSTOMER_ARRANGED', 'MPS_QUOTE'));

ALTER TABLE public.trucking_loads
ADD COLUMN quote_amount NUMERIC(10, 2); -- Quote amount if MPS_QUOTE selected

-- Add validation constraint: For outbound loads, at least one of (well_name or uwi) must be provided
ALTER TABLE public.trucking_loads
ADD CONSTRAINT outbound_destination_check
CHECK (
  direction = 'INBOUND' OR
  (destination_well_name IS NOT NULL OR destination_uwi IS NOT NULL)
);

COMMENT ON COLUMN public.trucking_loads.direction IS 'Direction of shipment: INBOUND (to MPS) or OUTBOUND (from MPS to well site)';
COMMENT ON COLUMN public.trucking_loads.destination_lsd IS 'Legal Subdivision for outbound loads (e.g., "LSD 06-24-079-15W5")';
COMMENT ON COLUMN public.trucking_loads.destination_well_name IS 'Well name for outbound loads (optional if UWI provided)';
COMMENT ON COLUMN public.trucking_loads.destination_uwi IS 'Unique Well Identifier for outbound loads (optional if well name provided)';
COMMENT ON COLUMN public.trucking_loads.shipping_method IS 'Shipping method: CUSTOMER_ARRANGED or MPS_QUOTE';
COMMENT ON COLUMN public.trucking_loads.quote_amount IS 'Quote amount in CAD if shipping_method is MPS_QUOTE';

-- ============================================================================
-- STEP 2: Extend inventory table for pickup tracking
-- ============================================================================

-- Add pickup truck load reference
ALTER TABLE public.inventory
ADD COLUMN pickup_truck_load_id UUID REFERENCES public.trucking_loads(id) ON DELETE SET NULL;

-- Add pickup timestamp
ALTER TABLE public.inventory
ADD COLUMN pickup_timestamp TIMESTAMPTZ;

-- Update status constraint to include 'DELIVERED' (to well site)
ALTER TABLE public.inventory DROP CONSTRAINT IF EXISTS inventory_status_check;
ALTER TABLE public.inventory
ADD CONSTRAINT inventory_status_check
CHECK (status IN ('PENDING_DELIVERY', 'IN_STORAGE', 'PICKED_UP', 'DELIVERED', 'IN_TRANSIT'));

COMMENT ON COLUMN public.inventory.pickup_truck_load_id IS 'Reference to outbound load that picked up this inventory';
COMMENT ON COLUMN public.inventory.pickup_timestamp IS 'Timestamp when inventory was picked up from storage';

-- ============================================================================
-- STEP 3: Extend storage_requests table for archival
-- ============================================================================

-- Add archival flag
ALTER TABLE public.storage_requests
ADD COLUMN archived BOOLEAN NOT NULL DEFAULT FALSE;

-- Add archival timestamp
ALTER TABLE public.storage_requests
ADD COLUMN archived_at TIMESTAMPTZ;

-- Add archival user tracking
ALTER TABLE public.storage_requests
ADD COLUMN archived_by TEXT;

COMMENT ON COLUMN public.storage_requests.archived IS 'True if project is completed and archived';
COMMENT ON COLUMN public.storage_requests.archived_at IS 'Timestamp when project was archived';
COMMENT ON COLUMN public.storage_requests.archived_by IS 'Email of admin who archived the project';

-- ============================================================================
-- STEP 4: Add performance indexes
-- ============================================================================

-- Index for querying outbound loads by direction and status
CREATE INDEX IF NOT EXISTS idx_trucking_loads_direction
ON public.trucking_loads(direction, status);

-- Index for querying inventory by pickup load
CREATE INDEX IF NOT EXISTS idx_inventory_pickup
ON public.inventory(pickup_truck_load_id, pickup_timestamp)
WHERE pickup_truck_load_id IS NOT NULL;

-- Index for querying archived projects
CREATE INDEX IF NOT EXISTS idx_storage_requests_archived
ON public.storage_requests(archived, archived_at DESC);

-- Index for querying storage requests by company (improves dashboard performance)
CREATE INDEX IF NOT EXISTS idx_storage_requests_company
ON public.storage_requests(company_id, archived);

-- ============================================================================
-- STEP 5: Update company_summaries function to include outbound counts
-- ============================================================================

-- Drop existing function
DROP FUNCTION IF EXISTS public.get_company_summaries();

-- Recreate with outbound load counts
CREATE OR REPLACE FUNCTION public.get_company_summaries()
RETURNS TABLE (
    company_id UUID,
    company_name TEXT,
    company_domain TEXT,
    is_archived BOOLEAN,
    pending_requests BIGINT,
    approved_requests BIGINT,
    rejected_requests BIGINT,
    total_loads BIGINT,
    new_loads BIGINT,
    inbound_loads BIGINT,  -- NEW
    outbound_loads BIGINT, -- NEW
    in_storage_items BIGINT
) AS $$
BEGIN
    RETURN QUERY
    WITH company_request_counts AS (
        SELECT
            c.id AS company_id,
            COUNT(sr.id) FILTER (WHERE sr.status = 'PENDING') AS pending_requests,
            COUNT(sr.id) FILTER (WHERE sr.status = 'APPROVED') AS approved_requests,
            COUNT(sr.id) FILTER (WHERE sr.status = 'REJECTED') AS rejected_requests
        FROM public.companies c
        LEFT JOIN public.storage_requests sr ON sr.company_id = c.id
        GROUP BY c.id
    ),
    company_load_counts AS (
        SELECT
            c.id AS company_id,
            COUNT(tl.id) AS total_loads,
            COUNT(tl.id) FILTER (WHERE tl.status = 'NEW') AS new_loads,
            COUNT(tl.id) FILTER (WHERE tl.direction = 'INBOUND') AS inbound_loads,  -- NEW
            COUNT(tl.id) FILTER (WHERE tl.direction = 'OUTBOUND') AS outbound_loads -- NEW
        FROM public.companies c
        LEFT JOIN public.storage_requests sr ON sr.company_id = c.id
        LEFT JOIN public.trucking_loads tl ON tl.storage_request_id = sr.id
        GROUP BY c.id
    ),
    company_inventory_counts AS (
        SELECT
            c.id AS company_id,
            COUNT(i.id) FILTER (WHERE i.status = 'IN_STORAGE') AS in_storage_items
        FROM public.companies c
        LEFT JOIN public.inventory i ON i.company_id = c.id
        GROUP BY c.id
    )
    SELECT
        c.id AS company_id,
        c.name AS company_name,
        c.domain AS company_domain,
        COALESCE(c.is_archived, FALSE) AS is_archived,
        COALESCE(rc.pending_requests, 0) AS pending_requests,
        COALESCE(rc.approved_requests, 0) AS approved_requests,
        COALESCE(rc.rejected_requests, 0) AS rejected_requests,
        COALESCE(lc.total_loads, 0) AS total_loads,
        COALESCE(lc.new_loads, 0) AS new_loads,
        COALESCE(lc.inbound_loads, 0) AS inbound_loads,   -- NEW
        COALESCE(lc.outbound_loads, 0) AS outbound_loads, -- NEW
        COALESCE(ic.in_storage_items, 0) AS in_storage_items
    FROM public.companies c
    LEFT JOIN company_request_counts rc ON rc.company_id = c.id
    LEFT JOIN company_load_counts lc ON lc.company_id = c.id
    LEFT JOIN company_inventory_counts ic ON ic.company_id = c.id
    WHERE c.is_archived = FALSE  -- Exclude archived companies from dashboard
    ORDER BY c.name ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to authenticated users
REVOKE EXECUTE ON FUNCTION public.get_company_summaries() FROM public;
GRANT EXECUTE ON FUNCTION public.get_company_summaries() TO authenticated;

COMMENT ON FUNCTION public.get_company_summaries IS
'Returns summary statistics for all companies including inbound/outbound load counts. Used for admin dashboard company tiles.';

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Verify trucking_loads columns added
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'trucking_loads'
  AND column_name IN ('direction', 'destination_lsd', 'destination_well_name', 'destination_uwi', 'shipping_method', 'quote_amount')
ORDER BY column_name;

-- Verify inventory columns added
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'inventory'
  AND column_name IN ('pickup_truck_load_id', 'pickup_timestamp')
ORDER BY column_name;

-- Verify storage_requests columns added
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'storage_requests'
  AND column_name IN ('archived', 'archived_at', 'archived_by')
ORDER BY column_name;

-- Verify indexes created
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename IN ('trucking_loads', 'inventory', 'storage_requests')
  AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;

-- ============================================================================
-- SUCCESS CRITERIA
-- ============================================================================
-- ✅ trucking_loads has direction, destination, and shipping method fields
-- ✅ inventory has pickup tracking fields
-- ✅ storage_requests has archival fields
-- ✅ Constraints prevent invalid outbound load data
-- ✅ Indexes improve query performance for outbound workflows
-- ✅ get_company_summaries function includes inbound/outbound counts
-- ============================================================================
