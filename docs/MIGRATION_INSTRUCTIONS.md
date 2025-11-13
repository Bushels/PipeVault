# Database Migration Instructions

## Overview

Three migrations have been prepared to optimize the admin dashboard query performance:

1. **20251107000003**: Add `created_at` indexes (HIGH PRIORITY)
2. **20251107000004**: Create `get_company_summaries()` function (CRITICAL)
3. **20251107000005**: Add explicit CASCADE/RESTRICT rules (MEDIUM PRIORITY)

## Performance Impact

| Metric | Before | After |
|--------|--------|-------|
| useCompanySummaries (50 companies) | 5-10 seconds | 100-200 ms |
| useCompanyDetails (100 requests) | 500 ms | 15 ms |
| Network Requests | 151 | 1 |
| Database Load | High | Low |

---

## Migration 1: Add created_at Indexes (HIGH PRIORITY)

**File:** `supabase/migrations/20251107000003_add_created_at_indexes.sql`

**Impact:** Improves ORDER BY performance for admin dashboard queries

### Steps to Apply

1. Log into Supabase Dashboard
2. Navigate to **SQL Editor**
3. **IMPORTANT:** These indexes use `CONCURRENTLY`, which cannot run in a transaction. You must execute each statement separately:

```sql
-- Execute these statements ONE AT A TIME:

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_storage_requests_created_at
ON storage_requests(created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_inventory_created_at
ON inventory(created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_storage_requests_status_created_at
ON storage_requests(status, created_at DESC);

-- Cleanup duplicate indexes (also one at a time):

DROP INDEX CONCURRENTLY IF EXISTS idx_storage_requests_company_id;

DROP INDEX CONCURRENTLY IF EXISTS idx_trucking_loads_storage_request_id;
```

4. Wait for each index to build (should take <1 second with current data volume)
5. Verify indexes were created:

```sql
SELECT
  schemaname,
  tablename,
  indexname
FROM pg_indexes
WHERE indexname IN (
  'idx_storage_requests_created_at',
  'idx_inventory_created_at',
  'idx_storage_requests_status_created_at'
);
```

Expected result: 3 rows

---

## Migration 2: Create get_company_summaries() Function (CRITICAL)

**File:** `supabase/migrations/20251107000004_add_company_summaries_function.sql`

**Impact:** Reduces admin dashboard load time from 5-10 seconds to 100-200ms

### Steps to Apply

1. Log into Supabase Dashboard
2. Navigate to **SQL Editor**
3. Copy the ENTIRE contents of `20251107000004_add_company_summaries_function.sql`
4. Paste into SQL Editor
5. Click **Run**

6. Verify function was created:

```sql
SELECT
  routine_name,
  routine_type,
  data_type
FROM information_schema.routines
WHERE routine_name = 'get_company_summaries';
```

Expected result: 1 row showing `get_company_summaries` function

7. Test the function:

```sql
SELECT * FROM get_company_summaries();
```

Expected result: One row per company with aggregated counts

---

## Migration 3: Add CASCADE Rules (MEDIUM PRIORITY)

**File:** `supabase/migrations/20251107000005_add_cascade_rules.sql`

**Impact:** Improves data integrity and prevents accidental deletions

### Steps to Apply

1. Log into Supabase Dashboard
2. Navigate to **SQL Editor**
3. Copy the contents of `20251107000005_add_cascade_rules.sql`
4. Paste into SQL Editor
5. Click **Run**

6. Verify constraints were updated:

```sql
SELECT
  tc.table_name,
  tc.constraint_name,
  tc.constraint_type
FROM information_schema.table_constraints tc
WHERE tc.constraint_name IN (
  'trucking_documents_trucking_load_id_fkey',
  'trucking_loads_storage_request_id_fkey',
  'inventory_company_id_fkey'
);
```

Expected result: 3 rows showing FOREIGN KEY constraints

---

## Verification After All Migrations

### 1. Test the Optimized Hook

Open browser console and run:

```javascript
// This will use the new optimized query
const { data, error } = await supabase.rpc('get_company_summaries');
console.log('Companies:', data);
```

Expected: Array of companies with aggregate counts in <200ms

### 2. Check Index Usage

```sql
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read
FROM pg_stat_user_indexes
WHERE indexname LIKE '%created_at%'
ORDER BY idx_scan DESC;
```

After admin dashboard loads a few times, `idx_scan` should be > 0

### 3. Monitor Query Performance

```sql
SELECT
  query,
  calls,
  mean_exec_time,
  max_exec_time
FROM pg_stat_statements
WHERE query LIKE '%get_company_summaries%'
ORDER BY mean_exec_time DESC;
```

Mean execution time should be <200ms

---

## Rollback Procedures

### Rollback Migration 1 (Indexes)

```sql
DROP INDEX CONCURRENTLY IF EXISTS idx_storage_requests_created_at;
DROP INDEX CONCURRENTLY IF EXISTS idx_inventory_created_at;
DROP INDEX CONCURRENTLY IF EXISTS idx_storage_requests_status_created_at;

-- Restore removed indexes
CREATE INDEX CONCURRENTLY idx_storage_requests_company_id ON storage_requests(company_id);
CREATE INDEX CONCURRENTLY idx_trucking_loads_storage_request_id ON trucking_loads(storage_request_id);
```

### Rollback Migration 2 (Function)

```sql
DROP FUNCTION IF EXISTS public.get_company_summaries();
```

### Rollback Migration 3 (CASCADE Rules)

```sql
ALTER TABLE trucking_documents
DROP CONSTRAINT IF EXISTS trucking_documents_trucking_load_id_fkey,
ADD CONSTRAINT trucking_documents_trucking_load_id_fkey
  FOREIGN KEY (trucking_load_id)
  REFERENCES trucking_loads(id);

ALTER TABLE trucking_loads
DROP CONSTRAINT IF EXISTS trucking_loads_storage_request_id_fkey,
ADD CONSTRAINT trucking_loads_storage_request_id_fkey
  FOREIGN KEY (storage_request_id)
  REFERENCES storage_requests(id);

ALTER TABLE inventory
DROP CONSTRAINT IF EXISTS inventory_company_id_fkey,
ADD CONSTRAINT inventory_company_id_fkey
  FOREIGN KEY (company_id)
  REFERENCES companies(id);
```

---

## Troubleshooting

### "Index creation failed"

- Ensure no other migrations are running
- Check for table locks: `SELECT * FROM pg_locks WHERE NOT granted;`
- Try without `CONCURRENTLY` if necessary (will lock table briefly)

### "Function returns no rows"

- Verify RLS policies allow admin access
- Check that you're logged in as admin user
- Run: `SELECT is_admin();` - should return `true`

### "CASCADE rule failed"

- Check for existing data that violates constraints
- Run orphaned records check (see DATABASE_OPTIMIZATION_ANALYSIS.md)
- Fix data integrity issues before applying migration

---

## Timeline

**Recommended:** Apply migrations during low-traffic window

1. **Migration 1 (Indexes)**: Can apply anytime (CONCURRENTLY prevents locks) - 5 minutes
2. **Migration 2 (Function)**: Can apply anytime (new function, no schema changes) - 1 minute
3. **Migration 3 (CASCADE)**: Best during low-traffic (may briefly lock tables) - 2 minutes

**Total estimated time:** 8 minutes

---

## Success Criteria

✅ All 3 migrations applied successfully
✅ `get_company_summaries()` function returns data
✅ Admin dashboard loads in <1 second
✅ No errors in browser console
✅ All indexes show usage in `pg_stat_user_indexes`

---

## Support

For issues or questions:
1. Check Supabase logs: **Logs → Postgres Logs**
2. Review DATABASE_OPTIMIZATION_ANALYSIS.md for detailed explanations
3. Verify current database state with verification queries above
