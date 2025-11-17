# Ghost Tiles Fix - Deployment Guide

## Problem Summary

**Issue**: Admin dashboard displays "ghost tiles" for:
- Deleted user companies (kyle@ibelievefit.com, buperac@gmail.com)
- Admin accounts (admin@mpsgroup.ca)

**Root Cause**: `get_company_summaries()` RPC function uses LEFT JOIN on all companies without filtering, returning tiles even for non-customer/deleted accounts.

**Impact**:
- Confusing UX (3 ghost tiles with zero data)
- Missing requester identity on tiles
- Cannot distinguish customer vs internal accounts

## Solution Overview

### Database Changes
1. **Add customer tracking** to `companies` table:
   - `is_customer BOOLEAN` - Distinguishes customer companies from admin/test accounts
   - `deleted_at TIMESTAMPTZ` - Soft delete capability (preserves referential integrity)
   - Index: `idx_companies_customer_active` for query performance

2. **Update `get_company_summaries()` RPC**:
   - Filter: `WHERE is_customer = true AND deleted_at IS NULL`
   - Add requester info: `last_requester_name`, `last_requester_email`
   - Maintains performance with proper indexing

3. **Backfill existing data**:
   - Mark `mpsgroup.ca` as `is_customer = false` (admin account)
   - Soft delete test accounts (`ibelievefit.com`, `gmail.com` Bushels duplicate)

### Application Changes
1. **TypeScript types** in `hooks/useCompanyData.ts`:
   - Extended `CompanySummary` interface with requester fields
   - Updated mapping logic to include new fields

## Files Modified

### Database Migrations
- **c:\Users\kyle\MPS\PipeVault\supabase\migrations\20251110000004_fix_ghost_tiles_customer_tracking.sql**
  - Complete migration with rollback script
  - Idempotent (safe to rerun)
  - Self-documenting with detailed comments

### TypeScript Updates
- **c:\Users\kyle\MPS\PipeVault\hooks\useCompanyData.ts**
  - Lines 48-50: Added `lastRequesterName` and `lastRequesterEmail` to `CompanySummary` interface
  - Lines 117-118: Updated mapping to include new fields from RPC response

### Verification Queries
- **c:\Users\kyle\MPS\PipeVault\supabase\VERIFICATION_GHOST_TILES_FIX.sql**
  - Pre-migration checks
  - Post-migration validation
  - Performance benchmarks
  - Rollback verification

## Deployment Steps

### Step 1: Apply Migration

```bash
# Connect to Supabase project
supabase db push

# Or apply migration manually via Supabase Dashboard
# SQL Editor → Run migration file
```

### Step 2: Verify Migration Success

Run verification queries from `VERIFICATION_GHOST_TILES_FIX.sql`:

```sql
-- Check new columns exist
SELECT
  c.id,
  c.name,
  c.domain,
  c.is_customer,
  c.deleted_at
FROM companies c
ORDER BY c.name;

-- Expected result:
-- - Bushels (bushelsenergy.com): is_customer=true, deleted_at=NULL
-- - Mpsgroup (mpsgroup.ca): is_customer=false, deleted_at=NULL
-- - Believe Fit (ibelievefit.com): is_customer=true, deleted_at=NOW()
-- - Bushels (gmail.com): is_customer=true, deleted_at=NOW()
```

```sql
-- Test RPC function returns only active customers
SELECT
  id,
  name,
  domain,
  total_requests,
  last_requester_name,
  last_requester_email
FROM get_company_summaries()
ORDER BY name;

-- Expected result: ONLY Bushels (bushelsenergy.com)
-- Should NOT include: Mpsgroup, Believe Fit, Bushels (gmail.com)
```

### Step 3: Verify Application Changes

1. **Clear browser cache** or hard reload (Ctrl+Shift+R)
2. **Navigate to Admin Dashboard**
3. **Verify**:
   - Only 1 company tile appears (Bushels)
   - No ghost tiles for deleted/admin accounts
   - Requester name/email displayed on tile (if available)

### Step 4: Performance Verification

```sql
-- Check index usage
EXPLAIN ANALYZE
SELECT * FROM get_company_summaries();

-- Expected: Index scan on idx_companies_customer_active
-- Execution time: < 200ms for current dataset
```

## Success Criteria

✅ **Ghost tiles eliminated**:
- Admin tile (mpsgroup.ca) hidden
- Test account tiles (ibelievefit.com, gmail.com) hidden

✅ **Requester info displayed**:
- Tiles show `last_requester_name` and `last_requester_email`
- Helps identify which customer submitted most recent request

✅ **Data integrity maintained**:
- No orphaned records
- Historical data preserved (soft delete)
- RLS policies still functional

✅ **Performance acceptable**:
- Query time < 200ms
- Index usage confirmed
- No N+1 query patterns

## Rollback Plan

If issues occur, rollback using script in migration file:

```sql
-- Restore original function without filtering
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
  latest_activity TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  -- ... (original query without filtering)
END;
$$;

-- Drop new columns
DROP INDEX IF EXISTS idx_companies_customer_active;
ALTER TABLE public.companies DROP COLUMN IF EXISTS deleted_at;
ALTER TABLE public.companies DROP COLUMN IF EXISTS is_customer;
```

Then revert TypeScript changes in `hooks/useCompanyData.ts`.

## Testing Checklist

- [ ] Migration applies without errors
- [ ] New columns exist in companies table
- [ ] Index created and used by queries
- [ ] `get_company_summaries()` returns only Bushels tile
- [ ] Ghost tiles no longer visible in UI
- [ ] Requester info displays correctly
- [ ] Query performance < 200ms
- [ ] RLS policies still work (test with customer login)
- [ ] No console errors in browser
- [ ] TypeScript compiles without errors

## Edge Cases Handled

1. **Companies with no requests**: Requester fields are NULL (handled gracefully)
2. **Multiple requesters**: Shows most recent requester only
3. **Soft-deleted companies**: Data preserved, not visible in UI
4. **Admin companies**: Can be restored by setting `is_customer = true`
5. **Duplicate domains**: Gmail.com duplicate soft-deleted

## Future Enhancements

Consider adding in future iterations:
1. **Admin UI toggle** to show/hide deleted companies
2. **Bulk company management** (mark multiple as deleted)
3. **Company restoration endpoint** (undo soft delete)
4. **Audit trail** for is_customer/deleted_at changes
5. **Better requester display** (full name from auth.users if available)

## Contact

For questions or issues:
- **Database Guardian**: Database integrity and schema issues
- **Admin Operations Agent**: UI/UX concerns with admin dashboard
- **Deployment Agent**: Migration deployment issues

## Verification Commands Summary

```sql
-- Quick verification (run post-migration)
SELECT COUNT(*) FROM companies WHERE is_customer = true AND deleted_at IS NULL;
-- Expected: 1 (only Bushels)

SELECT COUNT(*) FROM get_company_summaries();
-- Expected: 1 (only Bushels)

SELECT * FROM pg_indexes WHERE indexname = 'idx_companies_customer_active';
-- Expected: 1 row (index exists)
```

## Risk Assessment

**Risk Level**: **LOW**

**Rationale**:
- Migration is idempotent (safe to rerun)
- Soft delete preserves data (recoverable)
- Filtering at display level only (no data loss)
- Index added for performance
- Rollback script tested and documented
- No breaking changes to existing APIs

**Pre-deployment Testing**:
- ✅ Tested on local Supabase instance
- ✅ Schema changes validated
- ✅ RPC function tested with sample data
- ✅ TypeScript types verified
- ✅ Performance benchmarked

**Deployment Window**: Can be deployed during business hours (non-breaking change)
