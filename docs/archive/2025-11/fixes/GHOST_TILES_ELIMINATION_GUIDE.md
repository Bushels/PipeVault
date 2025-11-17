# Ghost Tiles Elimination - Deployment Guide

**Author**: Database Integrity Guardian Agent
**Date**: 2025-11-10
**Risk Level**: **MEDIUM** (Schema changes + data updates)

---

## Executive Summary

This deployment eliminates "ghost tiles" from the admin dashboard that appear for:
1. **Deleted auth users** (kyle@ibelievefit.com, buperac@gmail.com)
2. **Admin accounts** (mpsgroup.ca) that shouldn't appear as customers
3. **Test companies** with no active users (gmail.com domain)

### Solution Overview

We add lifecycle metadata to the `companies` table to track:
- `is_customer` - Boolean flag (false for admin accounts)
- `is_archived` - Boolean flag (true for inactive companies)
- `archived_at` - Timestamp when archived
- `deleted_at` - Soft delete timestamp (GDPR compliance)

The `get_company_summaries()` RPC is updated to filter companies based on these flags.

---

## Pre-Deployment Checklist

### 1. Verify Current State
Run these queries to understand current data:

```sql
-- Check current companies
SELECT id, name, domain, created_at
FROM companies
ORDER BY name;

-- Check auth users
SELECT id, email, deleted_at
FROM auth.users
ORDER BY email;

-- Check current get_company_summaries() result
SELECT name, domain, total_requests
FROM get_company_summaries()
ORDER BY name;
```

**Expected Current State**:
- 4 companies total
- 2 active auth users (kylegronning@mpsgroup.ca, kyle@bushelsenergy.com)
- get_company_summaries() returns all 4 companies (including ghosts)

### 2. Backup Strategy
```bash
# Backup companies table
supabase db dump --data-only -t companies > backup_companies_20251110.sql

# Backup storage_requests (in case cleanup affects them)
supabase db dump --data-only -t storage_requests > backup_requests_20251110.sql
```

### 3. Test Environment Verification
- [ ] Test in local Supabase instance first
- [ ] Verify migrations are idempotent (safe to rerun)
- [ ] Test with both admin and non-admin users

---

## Migration Files

Apply in this exact order:

### Migration 1: Add Metadata Columns (SCHEMA)
**File**: `supabase/migrations/20251110000005_add_company_lifecycle_metadata.sql`

**What it does**:
- Adds 4 new columns to `companies` table
- Creates partial indexes for performance
- No data changes (all defaults)

**Rollback**:
```sql
ALTER TABLE companies
  DROP COLUMN IF EXISTS is_customer,
  DROP COLUMN IF EXISTS is_archived,
  DROP COLUMN IF EXISTS archived_at,
  DROP COLUMN IF EXISTS deleted_at;

DROP INDEX IF EXISTS idx_companies_active_customers;
DROP INDEX IF EXISTS idx_companies_archived_at;
```

**Validation**:
```sql
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'companies'
  AND column_name IN ('is_customer', 'is_archived', 'archived_at', 'deleted_at');
```

---

### Migration 2: Update RPC Function (SCHEMA)
**File**: `supabase/migrations/20251110000006_update_company_summaries_filter_ghosts.sql`

**What it does**:
- Replaces `get_company_summaries()` with filtered version
- Adds WHERE clause to exclude non-customers, archived, and deleted companies
- Checks auth.users to ensure user still exists

**Rollback**:
Restore previous function from:
`supabase/migrations/20251107000004_add_company_summaries_function.sql`

**Validation**:
```sql
-- Function should still work (but returns all companies until data cleanup)
SELECT * FROM get_company_summaries();
```

---

### Migration 3: Cleanup Ghost Data (DATA)
**File**: `supabase/migrations/20251110000007_cleanup_ghost_companies_data.sql`

**What it does**:
- Marks mpsgroup.ca as `is_customer = false`
- Archives companies with deleted auth users (ibelievefit.com)
- Archives test companies with generic domains (gmail.com)

**⚠️ CRITICAL**: This is a DATA MIGRATION. Review carefully before applying.

**Affected Records**:
```sql
-- Preview what will be archived
SELECT id, name, domain, 'will be archived' as action
FROM companies
WHERE is_customer = true
  AND NOT EXISTS (
    SELECT 1
    FROM storage_requests sr
    JOIN auth.users u ON u.email = sr.user_email AND u.deleted_at IS NULL
    WHERE sr.company_id = companies.id
  )
  AND EXISTS (
    SELECT 1 FROM storage_requests sr WHERE sr.company_id = companies.id
  );
```

**Rollback**:
```sql
-- Restore archived companies
UPDATE companies
SET is_archived = false,
    archived_at = NULL
WHERE archived_at >= '2025-11-10';  -- Adjust timestamp

-- Restore admin account to customer
UPDATE companies
SET is_customer = true
WHERE domain = 'mpsgroup.ca';
```

**Validation**:
```sql
-- Should return only bushelsenergy.com
SELECT * FROM get_company_summaries();

-- Should return 3 archived/non-customer records
SELECT name, domain, is_customer, is_archived
FROM companies
WHERE is_archived = true OR is_customer = false;
```

---

### Migration 4: Add RLS Policies (SECURITY)
**File**: `supabase/migrations/20251110000008_add_company_metadata_rls_policies.sql`

**What it does**:
- Allows admins to UPDATE company metadata
- Prevents DELETE (enforces soft delete)
- Adds `is_admin()` helper function

**Rollback**:
```sql
DROP POLICY IF EXISTS "Admins can manage company metadata" ON companies;
DROP POLICY IF EXISTS "Prevent company deletion" ON companies;
DROP FUNCTION IF EXISTS is_admin(UUID);
```

**Validation**:
```sql
-- As admin user, should succeed
UPDATE companies SET is_archived = true WHERE id = '<test-uuid>';

-- As non-admin user, should fail with RLS violation
UPDATE companies SET is_archived = true WHERE id = '<test-uuid>';
```

---

### Migration 5: Add Utility Functions (ADMIN TOOLS)
**File**: `supabase/migrations/20251110000009_add_company_lifecycle_functions.sql`

**What it does**:
- Adds `archive_company(uuid)` function
- Adds `unarchive_company(uuid)` function
- Adds `soft_delete_company(uuid)` function (GDPR)
- Adds `mark_company_as_admin(uuid)` function
- Adds `get_archived_companies()` function

**Rollback**:
```sql
DROP FUNCTION IF EXISTS archive_company(UUID);
DROP FUNCTION IF EXISTS unarchive_company(UUID);
DROP FUNCTION IF EXISTS soft_delete_company(UUID);
DROP FUNCTION IF EXISTS mark_company_as_admin(UUID);
DROP FUNCTION IF EXISTS get_archived_companies();
```

**Validation**:
```sql
-- Test archive function (as admin)
SELECT archive_company('<uuid-of-test-company>');

-- Test get archived
SELECT * FROM get_archived_companies();

-- Test unarchive
SELECT unarchive_company('<uuid-of-test-company>');
```

---

## Deployment Steps

### Step 1: Apply Migrations
```bash
cd supabase

# Apply all 5 migrations in order
supabase db push
```

### Step 2: Run Verification Queries
```bash
psql <connection-string> -f VERIFICATION_GHOST_TILES_ELIMINATION.sql
```

Review output carefully. Expected results:
- ✓ 4 metadata columns exist
- ✓ 2 partial indexes created
- ✓ 3 companies archived/marked non-customer
- ✓ 1 active customer (bushelsenergy.com)
- ✓ get_company_summaries() returns 1 row

### Step 3: Test in Admin Dashboard
1. Open admin dashboard
2. Wait 30 seconds for cache to expire
3. Verify only **Bushels (bushelsenergy.com)** tile appears
4. Verify ibelievefit.com, gmail.com, mpsgroup.ca tiles are GONE

### Step 4: Test Admin Functions
```typescript
// Test archiving a company
const { data, error } = await supabase.rpc('archive_company', {
  company_id_param: '<test-uuid>'
});

// Test viewing archived companies
const { data, error } = await supabase.rpc('get_archived_companies');
```

---

## Post-Deployment Validation

### Success Criteria

Run these queries to confirm success:

```sql
-- 1. Only 1 active customer
SELECT COUNT(*) FROM get_company_summaries();
-- Expected: 1

-- 2. Ghost companies are archived
SELECT COUNT(*) FROM companies WHERE is_archived = true;
-- Expected: 2 (ibelievefit.com, gmail.com)

-- 3. Admin account marked correctly
SELECT COUNT(*) FROM companies WHERE is_customer = false;
-- Expected: 1 (mpsgroup.ca)

-- 4. No orphaned companies
SELECT COUNT(*) FROM companies
WHERE is_customer = true
  AND is_archived = false
  AND NOT EXISTS (
    SELECT 1 FROM storage_requests sr
    JOIN auth.users u ON u.email = sr.user_email AND u.deleted_at IS NULL
    WHERE sr.company_id = companies.id
  );
-- Expected: 0
```

### Performance Validation

```sql
-- Query should use idx_companies_active_customers
EXPLAIN ANALYZE SELECT * FROM get_company_summaries();
-- Expected: < 200ms, uses partial index
```

---

## Rollback Plan

If issues occur, rollback in **reverse order**:

### Full Rollback (All Migrations)
```sql
-- Drop utility functions
DROP FUNCTION IF EXISTS archive_company(UUID);
DROP FUNCTION IF EXISTS unarchive_company(UUID);
DROP FUNCTION IF EXISTS soft_delete_company(UUID);
DROP FUNCTION IF EXISTS mark_company_as_admin(UUID);
DROP FUNCTION IF EXISTS get_archived_companies();

-- Drop RLS policies
DROP POLICY IF EXISTS "Admins can manage company metadata" ON companies;
DROP POLICY IF EXISTS "Prevent company deletion" ON companies;
DROP FUNCTION IF EXISTS is_admin(UUID);

-- Restore data (from backup or manual)
UPDATE companies SET is_archived = false, archived_at = NULL WHERE archived_at IS NOT NULL;
UPDATE companies SET is_customer = true WHERE is_customer = false;

-- Restore old RPC function
-- (Restore from 20251107000004_add_company_summaries_function.sql)

-- Drop metadata columns
ALTER TABLE companies
  DROP COLUMN IF EXISTS is_customer,
  DROP COLUMN IF EXISTS is_archived,
  DROP COLUMN IF EXISTS archived_at,
  DROP COLUMN IF EXISTS deleted_at;

DROP INDEX IF EXISTS idx_companies_active_customers;
DROP INDEX IF EXISTS idx_companies_archived_at;
```

### Partial Rollback (Just Unarchive Companies)
```sql
-- Restore specific companies to active status
UPDATE companies
SET is_archived = false,
    archived_at = NULL,
    updated_at = now()
WHERE domain IN ('ibelievefit.com', 'gmail.com');

-- Or use utility function
SELECT unarchive_company('<company-uuid>');
```

---

## Known Issues & Edge Cases

### Issue 1: New Company with Zero Requests
**Scenario**: Admin creates a new company before any user signs up.
**Current Behavior**: Will appear in get_company_summaries() (has OR clause for zero requests).
**Fix**: Intentional - allows new companies to appear.

### Issue 2: User Creates Multiple Requests Then Deletes Account
**Scenario**: User creates requests, then deletes their account.
**Current Behavior**: Company automatically archived by data cleanup.
**Fix**: Use `unarchive_company()` if user returns.

### Issue 3: Company with Multiple Users, One Deleted
**Scenario**: Company has 2 users, one deletes their account.
**Current Behavior**: Company remains active (at least one active user exists).
**Fix**: Works as designed.

---

## Frontend Changes Required

### Update useCompanyData.ts
The cache is already set to 30 seconds, which is optimal for this change. No frontend changes required beyond what's already committed.

**Verification**:
```typescript
// File: hooks/useCompanyData.ts
staleTime: 30 * 1000, // 30 seconds (already optimized)
```

---

## Monitoring & Alerting

### Queries to Monitor

1. **Orphaned Companies Check** (run weekly):
```sql
SELECT id, name, domain FROM companies
WHERE is_customer = true AND is_archived = false
  AND NOT EXISTS (
    SELECT 1 FROM storage_requests sr
    JOIN auth.users u ON u.email = sr.user_email AND u.deleted_at IS NULL
    WHERE sr.company_id = companies.id
  );
```

2. **Archive Rate** (run monthly):
```sql
SELECT
  DATE_TRUNC('month', archived_at) as month,
  COUNT(*) as archived_count
FROM companies
WHERE archived_at IS NOT NULL
GROUP BY month
ORDER BY month DESC;
```

---

## Future Improvements

1. **Automated Archival**: Create a cron job to auto-archive companies with deleted users
2. **Notification**: Alert admin when company is auto-archived
3. **Grace Period**: Add 30-day grace period before archival (in case user returns)
4. **Unarchive UI**: Add admin UI to view and unarchive companies
5. **Audit Log**: Track who archived/unarchived companies and when

---

## Support & Troubleshooting

### Admin sees NO tiles after deployment
**Cause**: All companies were archived.
**Fix**: Check archived companies and unarchive legitimate customers:
```sql
SELECT * FROM get_archived_companies();
SELECT unarchive_company('<company-uuid>');
```

### Admin still sees ghost tiles after 30 seconds
**Cause**: React Query cache not invalidated.
**Fix**:
1. Hard refresh browser (Ctrl+Shift+R)
2. Clear browser cache
3. Check network tab - verify get_company_summaries() returns correct data

### Non-admin user can't view their own company
**Cause**: RLS policy blocking customer access.
**Fix**: Verify SELECT policies still exist:
```sql
SELECT * FROM pg_policies WHERE tablename = 'companies' AND cmd = 'SELECT';
```

---

## Documentation Updates

After deployment, update these docs:

1. **DATABASE_SCHEMA_AND_RLS.md** - Add company lifecycle columns
2. **ADMIN_DASHBOARD_ARCHITECTURE.md** - Document ghost filtering
3. **TECHNICAL_ARCHITECTURE.md** - Add company lifecycle state machine

---

## Deployment Sign-Off

| Role | Name | Date | Status |
|------|------|------|--------|
| Database Integrity Guardian | Agent | 2025-11-10 | ✅ Ready |
| Deployment Lead | - | - | Pending |
| QA Verification | - | - | Pending |
| Production Deploy | - | - | Pending |

---

**END OF DEPLOYMENT GUIDE**
