-- Add requester identity to get_company_summaries() function
-- This allows admins to see who submitted pending requests directly in the tile
-- without having to click "View Details"
--
-- Changes:
-- 1. Add last_requester_name and last_requester_email return columns
-- 2. Add last_pending_request_id and last_pending_created_at for context
-- 3. Use DISTINCT ON to get most recent pending request per company
-- 4. Join auth.users to extract name from metadata

CREATE OR REPLACE FUNCTION public.get_company_summaries()
RETURNS TABLE (
  id UUID,
  name TEXT,
  domain TEXT,
  total_requests BIGINT,
  pending_requests BIGINT,
  approved_requests BIGINT,
  rejected_requests BIGINT,
  total_inventory_items BIGINT,
  in_storage_items BIGINT,
  total_loads BIGINT,
  inbound_loads BIGINT,
  outbound_loads BIGINT,
  latest_activity TIMESTAMPTZ,
  -- NEW: Requester identity fields
  last_requester_name TEXT,
  last_requester_email TEXT,
  last_pending_request_id UUID,
  last_pending_created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH company_request_counts AS (
    SELECT
      sr.company_id,
      COUNT(*) as total_requests,
      COUNT(*) FILTER (WHERE sr.status = 'PENDING') as pending_requests,
      COUNT(*) FILTER (WHERE sr.status = 'APPROVED') as approved_requests,
      COUNT(*) FILTER (WHERE sr.status = 'REJECTED') as rejected_requests,
      MAX(sr.created_at) as latest_activity
    FROM storage_requests sr
    GROUP BY sr.company_id
  ),
  company_inventory_counts AS (
    SELECT
      inv.company_id,
      COUNT(*) as total_inventory_items,
      COUNT(*) FILTER (WHERE inv.status = 'IN_STORAGE') as in_storage_items
    FROM inventory inv
    GROUP BY inv.company_id
  ),
  company_load_counts AS (
    SELECT
      sr.company_id,
      COUNT(*) as total_loads,
      COUNT(*) FILTER (WHERE tl.direction = 'INBOUND') as inbound_loads,
      COUNT(*) FILTER (WHERE tl.direction = 'OUTBOUND') as outbound_loads
    FROM trucking_loads tl
    JOIN storage_requests sr ON sr.id = tl.storage_request_id
    GROUP BY sr.company_id
  ),
  -- NEW: Get most recent pending request per company with requester identity
  latest_pending_requests AS (
    SELECT DISTINCT ON (sr.company_id)
      sr.company_id,
      sr.id as request_id,
      sr.user_email,
      sr.created_at,
      -- Extract full name from auth.users metadata
      TRIM(
        COALESCE(u.raw_user_meta_data->>'first_name', '') || ' ' ||
        COALESCE(u.raw_user_meta_data->>'last_name', '')
      ) as full_name
    FROM storage_requests sr
    LEFT JOIN auth.users u ON u.email = sr.user_email
    WHERE sr.status = 'PENDING'
    ORDER BY sr.company_id, sr.created_at DESC
  )
  SELECT
    c.id,
    c.name,
    c.domain,
    COALESCE(rc.total_requests, 0) as total_requests,
    COALESCE(rc.pending_requests, 0) as pending_requests,
    COALESCE(rc.approved_requests, 0) as approved_requests,
    COALESCE(rc.rejected_requests, 0) as rejected_requests,
    COALESCE(ic.total_inventory_items, 0) as total_inventory_items,
    COALESCE(ic.in_storage_items, 0) as in_storage_items,
    COALESCE(lc.total_loads, 0) as total_loads,
    COALESCE(lc.inbound_loads, 0) as inbound_loads,
    COALESCE(lc.outbound_loads, 0) as outbound_loads,
    rc.latest_activity,
    -- NEW: Requester identity (NULL if no pending requests)
    NULLIF(lpr.full_name, '') as last_requester_name,
    lpr.user_email as last_requester_email,
    lpr.request_id as last_pending_request_id,
    lpr.created_at as last_pending_created_at
  FROM companies c
  LEFT JOIN company_request_counts rc ON rc.company_id = c.id
  LEFT JOIN company_inventory_counts ic ON ic.company_id = c.id
  LEFT JOIN company_load_counts lc ON lc.company_id = c.id
  LEFT JOIN latest_pending_requests lpr ON lpr.company_id = c.id
  ORDER BY c.name;
END;
$$;

-- Update function comment
COMMENT ON FUNCTION public.get_company_summaries() IS
  'Returns lightweight summary statistics for all companies with requester identity. ' ||
  'Used by admin dashboard tile carousel. ' ||
  'Optimized query using CTEs to avoid N+1 pattern. ' ||
  'Includes last_requester_name and last_requester_email for pending requests. ' ||
  'Performance: ~100-200ms for 50 companies with 5,000 requests.';

-- Grant remains the same
GRANT EXECUTE ON FUNCTION public.get_company_summaries() TO authenticated;
