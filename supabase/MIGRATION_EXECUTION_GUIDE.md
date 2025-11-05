# SQL Migration Execution Guide

## Overview
This guide documents the SQL migrations created to fix critical security and functionality issues identified in the comprehensive assessment. All migrations should be applied in the order specified below.

## Created: 2025-11-05

---

## Migration Files Created

### 1. **ADD_RACK_CAPACITY_CONSTRAINTS.sql**
**Priority:** HIGH
**Purpose:** Prevent over-allocation of rack space
**Impact:** Adds CHECK constraints to racks table
**Rollback Risk:** LOW (constraints can be dropped if needed)

**What it does:**
- Adds capacity validation constraints (with flexibility for racks under construction)
- Allows capacity = 0 for racks being measured/built
- Enforces capacity limits only when capacity > 0
- Prevents negative occupied/capacity values

**Dependencies:** None

---

### 2. **CREATE_EMAIL_FAILURES_TABLE.sql**
**Priority:** HIGH
**Purpose:** Track email notification failures for debugging and retry logic
**Impact:** Creates new table + 2 helper functions
**Rollback Risk:** LOW (can drop table if needed)

**What it does:**
- Creates `email_failures` table with proper indexes
- Adds RLS policies (admin-only access)
- Creates `log_email_failure()` function for Edge Functions
- Creates `resolve_email_failure()` function for retry mechanism
- Enables tracking of failed emails by type, recipient, and error details

**Dependencies:** Requires `admin_users` table (already exists)

---

### 3. **ENABLE_RLS_SYSTEM_TABLES.sql**
**Priority:** CRITICAL
**Purpose:** Fix security vulnerability - 3 tables exposed without RLS
**Impact:** Enables RLS and adds policies to 3 system tables
**Rollback Risk:** LOW (can disable RLS if needed)

**What it does:**
- Enables RLS on `admin_allowlist` (admin-only access)
- Enables RLS on `notification_queue` (service role + admin access)
- Enables RLS on `notifications_log` (users can view their own, admins can view all)

**Dependencies:** Requires `admin_users` table (already exists)

**⚠️ IMPORTANT:** This is a CRITICAL security fix. These tables are currently publicly accessible via PostgREST API.

---

### 4. **FIX_SECURITY_DEFINER_VIEWS.sql**
**Priority:** HIGH
**Purpose:** Fix security issue - views bypass RLS with SECURITY DEFINER
**Impact:** Recreates 3 views without SECURITY DEFINER
**Rollback Risk:** LOW (can recreate views with SECURITY DEFINER if needed)

**What it does:**
- Recreates `inventory_summary` view (respects RLS on inventory + companies tables)
- Recreates `yard_capacity` view (respects RLS on yards + yard_areas + racks tables)
- Recreates `pending_approvals` view (respects RLS on storage_requests + companies + documents)
- Adds `archived_at` filter to `pending_approvals` to exclude archived requests

**Dependencies:** Requires underlying tables with proper RLS policies (already configured)

---

### 5. **FIX_FUNCTION_SEARCH_PATH.sql**
**Priority:** HIGH
**Purpose:** Fix search_path security vulnerability in 10 functions
**Impact:** Adds immutable search_path to all functions
**Rollback Risk:** LOW (functions remain functionally identical)

**What it does:**
- Adds `SET search_path = public, pg_temp` to 10 functions
- Prevents SQL injection via search_path manipulation attacks
- Functions affected:
  1. `enqueue_notification`
  2. `is_admin`
  3. `is_allowlisted_admin`
  4. `jwt_domain`
  5. `update_updated_at_column`
  6. `notify_enqueue`
  7. `notify_slack_storage_request`
  8. `trg_storage_requests_email`
  9. `trg_trucking_loads_email`
  10. `trg_shipments_email`

**Dependencies:** None (all functions already exist)

---

## Execution Order

Execute migrations in this order to avoid dependency issues:

```bash
# 1. CRITICAL SECURITY FIX - Run first
psql < supabase/ENABLE_RLS_SYSTEM_TABLES.sql

# 2. Security improvements
psql < supabase/FIX_FUNCTION_SEARCH_PATH.sql
psql < supabase/FIX_SECURITY_DEFINER_VIEWS.sql

# 3. Functionality improvements
psql < supabase/ADD_RACK_CAPACITY_CONSTRAINTS.sql
psql < supabase/CREATE_EMAIL_FAILURES_TABLE.sql
```

---

## How to Apply Migrations

### Option 1: Via Supabase Dashboard (Recommended for Production)

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Copy/paste each migration file content
4. Review the SQL carefully
5. Click **Run** to execute
6. Check the results/verification queries at the bottom of each file

### Option 2: Via Supabase CLI (Local Development)

```bash
# If using local Supabase development
npx supabase db push

# Or apply migrations individually
npx supabase db execute -f supabase/ENABLE_RLS_SYSTEM_TABLES.sql
npx supabase db execute -f supabase/FIX_FUNCTION_SEARCH_PATH.sql
npx supabase db execute -f supabase/FIX_SECURITY_DEFINER_VIEWS.sql
npx supabase db execute -f supabase/ADD_RACK_CAPACITY_CONSTRAINTS.sql
npx supabase db execute -f supabase/CREATE_EMAIL_FAILURES_TABLE.sql
```

### Option 3: Via psql CLI

```bash
# Connect to your Supabase database
psql "postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres"

# Execute each migration
\i supabase/ENABLE_RLS_SYSTEM_TABLES.sql
\i supabase/FIX_FUNCTION_SEARCH_PATH.sql
\i supabase/FIX_SECURITY_DEFINER_VIEWS.sql
\i supabase/ADD_RACK_CAPACITY_CONSTRAINTS.sql
\i supabase/CREATE_EMAIL_FAILURES_TABLE.sql
```

---

## Verification Steps

After applying all migrations, run these verification queries:

### 1. Verify RLS is enabled on all tables
```sql
SELECT
  schemaname,
  tablename,
  rowsecurity AS rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('admin_allowlist', 'notification_queue', 'notifications_log', 'email_failures')
ORDER BY tablename;
```
**Expected:** All tables should show `rls_enabled = true`

### 2. Verify rack constraints exist
```sql
SELECT
  conname AS constraint_name,
  pg_get_constraintdef(c.oid) AS constraint_definition
FROM pg_constraint c
JOIN pg_namespace n ON n.oid = c.connamespace
WHERE conrelid = 'public.racks'::regclass
  AND conname LIKE 'racks_%'
ORDER BY conname;
```
**Expected:** Should see 4 new constraints (capacity_check, capacity_meters_check, non_negative_occupied, non_negative_capacity)

### 3. Verify email_failures table exists
```sql
SELECT
  table_name,
  (SELECT count(*) FROM information_schema.columns WHERE table_name = 'email_failures') as column_count,
  (SELECT count(*) FROM pg_indexes WHERE tablename = 'email_failures') as index_count
FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'email_failures';
```
**Expected:** Should show 1 row with column_count = 10, index_count = 5

### 4. Verify functions have search_path set
```sql
SELECT
  p.proname AS function_name,
  p.proconfig AS config_settings
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname IN (
    'enqueue_notification', 'is_admin', 'is_allowlisted_admin',
    'jwt_domain', 'update_updated_at_column', 'notify_enqueue',
    'notify_slack_storage_request', 'trg_storage_requests_email',
    'trg_trucking_loads_email', 'trg_shipments_email'
  )
ORDER BY p.proname;
```
**Expected:** All functions should show `{search_path=public,pg_temp}` in config_settings

### 5. Verify views don't have SECURITY DEFINER
```sql
SELECT
  n.nspname as schema,
  c.relname as view_name
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind = 'v'
  AND n.nspname = 'public'
  AND c.relname IN ('inventory_summary', 'yard_capacity', 'pending_approvals')
  AND pg_get_viewdef(c.oid) ILIKE '%security definer%';
```
**Expected:** Should return 0 rows (no views with SECURITY DEFINER)

---

## Rollback Instructions

If you need to rollback any migration:

### Rollback: ADD_RACK_CAPACITY_CONSTRAINTS.sql
```sql
ALTER TABLE racks DROP CONSTRAINT IF EXISTS racks_capacity_check;
ALTER TABLE racks DROP CONSTRAINT IF EXISTS racks_capacity_meters_check;
ALTER TABLE racks DROP CONSTRAINT IF EXISTS racks_non_negative_occupied;
ALTER TABLE racks DROP CONSTRAINT IF EXISTS racks_non_negative_capacity;
```

### Rollback: CREATE_EMAIL_FAILURES_TABLE.sql
```sql
DROP FUNCTION IF EXISTS log_email_failure(text, text, uuid, text, text, jsonb);
DROP FUNCTION IF EXISTS resolve_email_failure(uuid);
DROP TABLE IF EXISTS email_failures;
```

### Rollback: ENABLE_RLS_SYSTEM_TABLES.sql
```sql
ALTER TABLE admin_allowlist DISABLE ROW LEVEL SECURITY;
ALTER TABLE notification_queue DISABLE ROW LEVEL SECURITY;
ALTER TABLE notifications_log DISABLE ROW LEVEL SECURITY;
```
**⚠️ WARNING:** This will re-expose tables publicly. Only rollback if absolutely necessary.

### Rollback: FIX_SECURITY_DEFINER_VIEWS.sql
Re-run the views with `SECURITY DEFINER` option added (not recommended for security reasons).

### Rollback: FIX_FUNCTION_SEARCH_PATH.sql
Remove `SET search_path = public, pg_temp` from each function definition (not recommended for security reasons).

---

## Post-Migration Tasks

After applying all migrations:

1. ✅ **Update emailService.ts** to log failures to `email_failures` table
2. ✅ **Update AdminDashboard.tsx** to implement capacity validation UI
3. ✅ **Create Edge Function** for email retry mechanism
4. ✅ **Test RLS policies** with non-admin user accounts
5. ✅ **Monitor Supabase logs** for any constraint violations
6. ✅ **Run security advisors** again to verify fixes:
   ```bash
   # Check if security issues are resolved
   SELECT name, level, title FROM supabase_advisors WHERE level IN ('ERROR', 'WARN');
   ```

---

## Notes

- All migrations include verification queries at the end
- All migrations are idempotent where possible (using IF EXISTS/IF NOT EXISTS)
- All migrations include detailed comments explaining changes
- All migrations add COMMENT ON statements for documentation
- Estimated total execution time: < 1 minute

---

## Security Impact Summary

**Before Migrations:**
- 3 tables exposed without RLS (CRITICAL)
- 3 views bypassing RLS with SECURITY DEFINER (HIGH)
- 10 functions vulnerable to search_path attacks (HIGH)
- No rack capacity validation (MEDIUM)
- No email failure tracking (MEDIUM)

**After Migrations:**
- All tables protected with RLS ✅
- All views respect RLS policies ✅
- All functions have immutable search_path ✅
- Rack capacity validated (flexible for construction) ✅
- Email failures tracked and retryable ✅

**Security Score Improvement:** Expected to resolve 16 security advisories from Supabase linter.
