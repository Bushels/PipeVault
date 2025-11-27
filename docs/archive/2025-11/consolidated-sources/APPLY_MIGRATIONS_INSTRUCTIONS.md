# How to Apply Database Migrations

You need to apply 6 new migrations to fix the ghost tiles and add requester identity. Follow these steps:

## Apply via Supabase Dashboard

1. Go to: https://supabase.com/dashboard/project/YOUR_PROJECT/sql
2. Copy and paste each SQL file **in this exact order**:

### Migration 1: Add Company Lifecycle Columns
```sql
-- File: supabase/migrations/20251110000005_add_company_lifecycle_metadata.sql
-- Copy the entire contents of this file and run it
```

### Migration 2: Add Requester Identity + Ghost Filtering (COMBINED)
⚠️ **IMPORTANT**: Migrations 1 and 6 conflict. Use this COMBINED version instead:

```sql
-- Combined: Requester Identity + Ghost Filtering
DROP FUNCTION IF EXISTS public.get_company_summaries();

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
  -- Requester identity fields
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
  latest_pending_requests AS (
    SELECT DISTINCT ON (sr.company_id)
      sr.company_id,
      sr.id as request_id,
      sr.user_email,
      sr.created_at,
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
    NULLIF(lpr.full_name, '') as last_requester_name,
    lpr.user_email as last_requester_email,
    lpr.request_id as last_pending_request_id,
    lpr.created_at as last_pending_created_at
  FROM companies c
  LEFT JOIN company_request_counts rc ON rc.company_id = c.id
  LEFT JOIN company_inventory_counts ic ON ic.company_id = c.id
  LEFT JOIN company_load_counts lc ON lc.company_id = c.id
  LEFT JOIN latest_pending_requests lpr ON lpr.company_id = c.id
  WHERE
    -- GHOST FILTERING
    c.is_customer = true
    AND c.is_archived = false
    AND c.deleted_at IS NULL
    AND (
      EXISTS (
        SELECT 1
        FROM storage_requests sr
        JOIN auth.users u ON u.email = sr.user_email AND u.deleted_at IS NULL
        WHERE sr.company_id = c.id
      )
      OR rc.total_requests = 0
    )
  ORDER BY c.name;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_company_summaries() TO authenticated;

COMMENT ON FUNCTION public.get_company_summaries() IS
  'Returns active customer companies with requester identity and ghost filtering.';
```

### Migration 3: Cleanup Ghost Companies Data
```sql
-- File: supabase/migrations/20251110000007_cleanup_ghost_companies_data.sql
-- Copy the entire contents
```

### Migration 4: Add RLS Policies
```sql
-- File: supabase/migrations/20251110000008_add_company_metadata_rls_policies.sql
-- Copy the entire contents
```

### Migration 5: Add Lifecycle Functions
```sql
-- File: supabase/migrations/20251110000009_add_company_lifecycle_functions.sql
-- Copy the entire contents
```

## Option 2: Use Supabase CLI (If Linked)

If you have the Supabase CLI linked to your project:

```bash
cd C:\Users\kyle\MPS\PipeVault

# Link to your project (if not already linked)
npx supabase link --project-ref YOUR_PROJECT_REF

# Push all migrations
npx supabase db push
```

## Verification

After applying, run this query to verify ghost tiles are gone:

```sql
SELECT name, domain, is_customer, is_archived FROM get_company_summaries();
```

You should only see: **Bushels (bushelsenergy.com)**

Ghost tiles eliminated:
- ❌ Believe Fit (ibelievefit.com)
- ❌ Bushels (gmail.com)
- ❌ Mpsgroup (mpsgroup.ca)
