# Database Setup Guide

**Complete guide for PipeVault Supabase PostgreSQL database**

**Last Updated:** 2025-11-16
**Database:** Supabase (PostgreSQL 15)
**Multi-tenant:** Row-Level Security (RLS) enforced

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Applying Migrations](#applying-migrations)
3. [Schema Overview](#schema-overview)
4. [Row-Level Security (RLS)](#row-level-security-rls)
5. [Common Operations](#common-operations)
6. [Troubleshooting](#troubleshooting)
7. [Performance & Monitoring](#performance--monitoring)

---

## Quick Start

### Essential Table Relationships

```
companies → storage_requests → trucking_loads → trucking_documents (CASCADE)
                           ↓
                        inventory → racks
```

### Quick RLS Test

```sql
-- Test customer isolation
SET ROLE authenticated;
SET request.jwt.claims = '{"email":"user@acme.com"}';
SELECT * FROM storage_requests;
-- Should only see acme.com requests

-- Test admin access
SELECT is_admin_user();
-- Should return TRUE for admins
```

### Status Enums

- **request_status:** `DRAFT → PENDING → APPROVED/REJECTED → COMPLETED`
- **trucking_load_status:** `NEW → APPROVED → IN_TRANSIT → COMPLETED`
- **pipe_status (inventory):** `PENDING_DELIVERY → IN_STORAGE → PICKED_UP → IN_TRANSIT`

---

## Applying Migrations

### Option 1: Supabase Dashboard (Recommended)

1. Go to: `https://supabase.com/dashboard/project/YOUR_PROJECT/sql`
2. Copy and paste each SQL migration file
3. Click **Run** to execute
4. Verify with the provided verification queries

### Option 2: Supabase CLI

```bash
cd C:\Users\kyle\MPS\PipeVault

# Link to your project (if not already linked)
npx supabase link --project-ref YOUR_PROJECT_REF

# Push all pending migrations
npx supabase db push

# Check migration status
npx supabase migration list
```

### Option 3: psql CLI

```bash
# Connect to your Supabase database
psql "postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres"

# Execute each migration
\i supabase/migrations/[MIGRATION_FILE].sql
```

### Migration Execution Order

**Critical migrations (2025-11-05):**
1. `ENABLE_RLS_SYSTEM_TABLES.sql` - CRITICAL SECURITY FIX
2. `FIX_FUNCTION_SEARCH_PATH.sql` - Security improvements
3. `FIX_SECURITY_DEFINER_VIEWS.sql` - Security improvements
4. `ADD_RACK_CAPACITY_CONSTRAINTS.sql` - Functionality improvements
5. `CREATE_EMAIL_FAILURES_TABLE.sql` - Functionality improvements

**Ghost tiles fix (2025-11-10):**
1. `add_company_lifecycle_metadata.sql`
2. `add_requester_identity_ghost_filtering.sql` (combined)
3. `cleanup_ghost_companies_data.sql`
4. `add_company_metadata_rls_policies.sql`
5. `add_company_lifecycle_functions.sql`

### Post-Migration Verification

```sql
-- 1. Verify RLS is enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('admin_allowlist', 'notification_queue', 'notifications_log', 'email_failures')
ORDER BY tablename;
-- Expected: All show rls_enabled = true

-- 2. Verify rack constraints exist
SELECT conname, pg_get_constraintdef(c.oid)
FROM pg_constraint c
WHERE conrelid = 'public.racks'::regclass
  AND conname LIKE 'racks_%'
ORDER BY conname;
-- Expected: 4 constraints (capacity_check, capacity_meters_check, non_negative_occupied, non_negative_capacity)

-- 3. Verify functions have search_path set
SELECT proname, proconfig
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname IN ('enqueue_notification', 'is_admin', 'is_allowlisted_admin')
ORDER BY p.proname;
-- Expected: All show {search_path=public,pg_temp}
```

### Rollback Instructions

If you need to rollback any migration:

```sql
-- Rollback: ADD_RACK_CAPACITY_CONSTRAINTS.sql
ALTER TABLE racks DROP CONSTRAINT IF EXISTS racks_capacity_check;
ALTER TABLE racks DROP CONSTRAINT IF EXISTS racks_capacity_meters_check;
ALTER TABLE racks DROP CONSTRAINT IF EXISTS racks_non_negative_occupied;
ALTER TABLE racks DROP CONSTRAINT IF EXISTS racks_non_negative_capacity;

-- Rollback: CREATE_EMAIL_FAILURES_TABLE.sql
DROP FUNCTION IF EXISTS log_email_failure(text, text, uuid, text, text, jsonb);
DROP FUNCTION IF EXISTS resolve_email_failure(uuid);
DROP TABLE IF EXISTS email_failures;

-- ⚠️ WARNING: Only rollback RLS in emergency (re-exposes tables publicly)
ALTER TABLE admin_allowlist DISABLE ROW LEVEL SECURITY;
```

---

## Schema Overview

### Core Tables (13 total)

| Table | Purpose | RLS Enforced |
|-------|---------|--------------|
| `companies` | Customer organizations (multi-tenant root) | Yes |
| `storage_requests` | Customer pipe storage requests | Yes |
| `trucking_loads` | Inbound/outbound truck deliveries | Yes |
| `trucking_documents` | Manifest PDFs/images with AI-extracted data | Yes |
| `inventory` | Individual pipe items in physical storage | Yes |
| `racks` (storage_areas) | Physical storage locations | Yes |
| `yard_areas` | Yard sections containing racks | Yes |
| `yards` | Physical storage yards | Yes |
| `admin_users` | Authorized admin user IDs | Yes |
| `admin_audit_log` | Immutable audit trail | Yes |
| `notification_queue` | Email/Slack notification queue | Yes |
| `notifications_log` | Historical notification records | Yes |
| `email_failures` | Failed email tracking | Yes |

### Critical Foreign Keys

| Child → Parent | ON DELETE | Rationale |
|----------------|-----------|-----------|
| `trucking_documents → trucking_loads` | CASCADE | Documents are artifacts; delete with load |
| `trucking_loads → storage_requests` | RESTRICT | Prevent accidental deletion of requests with loads |
| `inventory → companies` | RESTRICT | Prevent deletion of companies with inventory |
| `inventory → racks` | NO ACTION | Nullable FK (inventory can be unassigned) |
| `storage_requests → companies` | RESTRICT | Prevent deletion of companies with requests |

### Key Constraints

**Unique Constraints:**
- `companies.domain` - One company per email domain
- `(trucking_loads.storage_request_id, direction, sequence_number)` - No duplicate load sequences
- `admin_users.user_id` - One admin record per auth user

**Check Constraints:**
- `racks.occupied <= racks.capacity` - Prevent overbooking
- `racks.occupied_meters <= racks.capacity_meters` - Prevent meter overbooking
- `trucking_loads.sequence_number > 0` - Positive sequences
- `trucking_documents.parsed_payload` is JSON array - Valid AI extraction format
- `inventory.quantity > 0`, `weight > 0`, `length > 0` - Positive values

### Key Indexes

| Index | Table | Columns | Purpose |
|-------|-------|---------|---------|
| `idx_trucking_loads_request` | trucking_loads | storage_request_id | FK join optimization |
| `idx_inventory_request_status` | inventory | request_id, status | Compound query |
| `idx_inventory_status` | inventory | status WHERE IN_STORAGE | Partial index (active inventory) |
| `idx_trucking_documents_load` | trucking_documents | trucking_load_id | Manifest lookup |
| `idx_storage_requests_created_at` | storage_requests | created_at DESC | Recent requests first |
| `idx_storage_requests_status_created_at` | storage_requests | status, created_at DESC | Pending requests (newest first) |

---

## Row-Level Security (RLS)

### RLS Architecture

PipeVault uses **Row-Level Security (RLS)** to enforce multi-tenant data isolation at the database level. This prevents customers from accessing other companies' data, even if application code has bugs.

### Customer Data Isolation Pattern

#### 1. Direct Company Isolation

For tables with `company_id` foreign key:

```sql
-- Example: storage_requests table
CREATE POLICY "Customers see only their company's requests"
ON storage_requests
FOR SELECT
TO authenticated
USING (
  company_id = (
    SELECT id FROM companies
    WHERE domain = split_part(auth.jwt()->>'email', '@', 2)
  )
);
```

**How it works:**
1. Extract user email from JWT: `auth.jwt()->>'email'` → "user@acme.com"
2. Extract domain: `split_part(..., '@', 2)` → "acme.com"
3. Find company: `SELECT id FROM companies WHERE domain = 'acme.com'`
4. Filter rows: `WHERE company_id = company_uuid`

#### 2. Indirect Isolation (via JOIN)

For tables without direct `company_id`:

```sql
-- Example: trucking_loads table
CREATE POLICY "Customers see only their company's loads"
ON trucking_loads
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM storage_requests sr
    INNER JOIN companies c ON c.id = sr.company_id
    WHERE sr.id = trucking_loads.storage_request_id
      AND c.domain = split_part(auth.jwt()->>'email', '@', 2)
  )
);
```

### Admin Bypass Pattern

Admins need access to ALL companies' data using **multiple RLS policies** (PERMISSIVE mode):

```sql
-- Customer policy (company-scoped)
CREATE POLICY "Customers see only their company's requests"
ON storage_requests FOR SELECT TO authenticated
USING (company_id IN (SELECT id FROM companies WHERE domain = split_part(auth.jwt()->>'email', '@', 2)));

-- Admin policy (all data)
CREATE POLICY "Admins see all requests"
ON storage_requests FOR SELECT TO authenticated
USING (is_admin());
```

**Admin Check Function:**
```sql
CREATE FUNCTION is_admin() RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM admin_users
    WHERE user_id = auth.uid() AND is_active = true
  );
END;
$$;
```

### SECURITY DEFINER Functions (RLS Bypass)

For admin operations requiring atomic multi-table updates:

```sql
CREATE FUNCTION approve_storage_request_atomic(...)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER  -- Runs with elevated privileges (bypasses RLS)
SET search_path = public
AS $$
BEGIN
  -- Step 1: Check admin authorization
  IF NOT is_admin_user() THEN
    RAISE EXCEPTION 'Access denied. Admin privileges required.';
  END IF;

  -- Step 2: Perform updates (RLS bypassed, transaction guarantees)
  UPDATE storage_requests SET status = 'APPROVED' WHERE id = p_request_id;
  UPDATE racks SET occupied = occupied + p_required_joints WHERE id = ANY(p_rack_ids);
  INSERT INTO admin_audit_log (...);

  -- All updates succeed or all fail (atomic transaction)
END;
$$;
```

---

## Common Operations

### Stored Procedures

#### Approve Request (Atomic)

```typescript
const { data, error } = await supabase.rpc('approve_storage_request_atomic', {
  p_request_id: 'uuid',
  p_assigned_rack_ids: ['rack1-uuid', 'rack2-uuid'],
  p_required_joints: 200,
  p_notes: 'Approved with standard terms'
});
```

#### Reject Request (Atomic)

```typescript
const { data, error } = await supabase.rpc('reject_storage_request_atomic', {
  p_request_id: 'uuid',
  p_rejection_reason: 'Insufficient capacity'
});
```

#### Get Project Summaries (Admin Only)

```typescript
const { data } = await supabase.rpc('get_project_summaries_by_company');
// Returns JSON array of companies with nested projects
```

### Common Queries

#### Check Orphaned Records

```sql
-- Orphaned trucking loads (no parent request)
SELECT tl.id, tl.storage_request_id
FROM trucking_loads tl
LEFT JOIN storage_requests sr ON tl.storage_request_id = sr.id
WHERE sr.id IS NULL;
-- Expected: 0 rows

-- Orphaned inventory (no parent company)
SELECT i.id, i.company_id
FROM inventory i
LEFT JOIN companies c ON i.company_id = c.id
WHERE c.id IS NULL;
-- Expected: 0 rows
```

#### Check Capacity Issues

```sql
-- Overbooked racks
SELECT id, name, capacity, occupied, (capacity - occupied) AS available
FROM racks
WHERE occupied > capacity;
-- Expected: 0 rows (CHECK constraint should prevent this)

-- Racks exceeding meter capacity
SELECT id, name, capacity_meters, occupied_meters
FROM racks
WHERE occupied_meters > capacity_meters;
-- Expected: 0 rows
```

#### Check Load Totals Mismatch

```sql
-- Manifest vs inventory discrepancies
SELECT
  tl.id,
  tl.reference_id,
  tl.total_joints_planned,
  tl.total_joints_completed,
  COALESCE(SUM(i.quantity), 0) AS actual_inventory_count
FROM trucking_loads tl
LEFT JOIN inventory i ON i.delivery_truck_load_id = tl.id
GROUP BY tl.id, tl.reference_id, tl.total_joints_planned, tl.total_joints_completed
HAVING ABS(tl.total_joints_completed - COALESCE(SUM(i.quantity), 0)) > 0;
-- Expected: 0 rows (or small tolerance for rounding)
```

#### Check Status Inconsistencies

```sql
-- COMPLETED loads without completed_at timestamp
SELECT id, status, completed_at
FROM trucking_loads
WHERE status = 'COMPLETED' AND completed_at IS NULL;
-- Expected: 0 rows

-- IN_STORAGE inventory without assigned rack
SELECT id, status, storage_area_id
FROM inventory
WHERE status = 'IN_STORAGE' AND storage_area_id IS NULL;
-- Expected: 0 rows
```

---

## Troubleshooting

### Issue 1: Customer Can't See Their Data

**Symptom:** Customer logs in, sees empty tables despite data existing.

**Diagnosis:**

```sql
-- Check user's company
SELECT id, name, domain
FROM companies
WHERE domain = split_part('user@example.com', '@', 2);
-- Should return 1 row

-- Check requests for that company
SELECT id, reference_id, company_id, status
FROM storage_requests
WHERE company_id = '...';
-- Should return rows

-- Check RLS is enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public' AND tablename = 'storage_requests';
-- rowsecurity should be TRUE
```

**Solution:**
1. Verify user email domain matches company domain
2. Check RLS policies: `\ddrp storage_requests` (psql)
3. Test with: `SET request.jwt.claims = '{"email":"user@example.com"}'; SELECT * FROM storage_requests;`

---

### Issue 2: Approval Fails with "Insufficient Capacity"

**Symptom:** Admin tries to approve request, gets capacity error despite racks appearing empty.

**Diagnosis:**

```sql
-- Check rack capacity
SELECT id, name, capacity, occupied, (capacity - occupied) AS available
FROM racks
WHERE id = ANY(ARRAY['rack1-uuid', 'rack2-uuid']);

-- Check if capacity constraints are enforced
SELECT conname, contype
FROM pg_constraint
WHERE conrelid = 'racks'::regclass AND contype = 'c';
-- Should show racks_capacity_check
```

**Solution:**
1. Verify `occupied <= capacity` for all racks
2. Investigate recent approvals: `SELECT * FROM admin_audit_log WHERE action = 'APPROVE_REQUEST' ORDER BY created_at DESC LIMIT 10;`
3. Manually fix occupancy:
   ```sql
   UPDATE racks SET occupied = (
     SELECT COUNT(*) FROM inventory WHERE storage_area_id = racks.id AND status = 'IN_STORAGE'
   );
   ```

---

### Issue 3: Orphaned Inventory Records

**Symptom:** Inventory exists but parent request is deleted.

**Diagnosis:**

```sql
-- Find orphaned inventory
SELECT i.id, i.request_id, i.reference_id
FROM inventory i
LEFT JOIN storage_requests sr ON sr.id = i.request_id
WHERE sr.id IS NULL;
```

**Solution:**
1. Check FK constraint exists: `\d inventory` (psql)
2. Re-add constraint if missing:
   ```sql
   ALTER TABLE inventory
   ADD CONSTRAINT inventory_request_id_fkey
   FOREIGN KEY (request_id) REFERENCES storage_requests(id);
   ```
3. Clean up orphans (if FK can't be added):
   ```sql
   UPDATE inventory SET request_id = NULL
   WHERE request_id NOT IN (SELECT id FROM storage_requests);
   ```

---

### Issue 4: Slow Admin Dashboard

**Symptom:** `get_project_summaries_by_company()` takes > 5 seconds.

**Diagnosis:**

```sql
EXPLAIN ANALYZE SELECT get_project_summaries_by_company();
```

Look for:
- Sequential scans on large tables
- Missing indexes on FK columns
- Nested loops with high row counts

**Solution:**
1. Verify indexes exist:
   ```sql
   SELECT indexname, idx_scan
   FROM pg_stat_user_indexes
   WHERE schemaname = 'public'
     AND indexname LIKE 'idx_%'
   ORDER BY idx_scan DESC;
   ```
2. Update statistics: `ANALYZE storage_requests; ANALYZE trucking_loads; ANALYZE inventory;`
3. Consider pagination for > 100 companies

---

### Issue 5: Document Upload Fails with RLS Error

**Symptom:** Customer uploads manifest, gets "RLS policy violation" error.

**Diagnosis:**

```sql
-- Check trucking_documents RLS policies
SELECT policyname, cmd, qual
FROM pg_policies
WHERE tablename = 'trucking_documents';

-- Verify load belongs to user's company
SELECT
  td.id,
  tl.storage_request_id,
  sr.company_id,
  c.domain
FROM trucking_documents td
JOIN trucking_loads tl ON tl.id = td.trucking_load_id
JOIN storage_requests sr ON sr.id = tl.storage_request_id
JOIN companies c ON c.id = sr.company_id
WHERE td.id = 'document-uuid';
```

**Solution:**
1. Verify user email domain matches company domain
2. Check INSERT policy allows: `WITH CHECK (trucking_load_id IN (SELECT id FROM trucking_loads WHERE ...))`
3. Test policy manually with user's JWT claims

---

### Issue 6: Notification Queue Stuck

**Symptom:** Notifications not sending, `processed = false` for hours.

**Diagnosis:**

```sql
-- Check pending notifications
SELECT id, type, attempts, last_error, created_at
FROM notification_queue
WHERE processed = false
ORDER BY created_at;

-- Check recent failures
SELECT type, COUNT(*) AS failures
FROM notification_queue
WHERE processed = true AND last_error IS NOT NULL
GROUP BY type;
```

**Solution:**
1. Check Edge Function logs for worker errors
2. Verify Supabase Vault secrets: `slack_webhook_url`, `resend_api_key`
3. Manually retry: `UPDATE notification_queue SET attempts = 0, processed = false WHERE id = '...';`
4. Check payload format: `SELECT payload FROM notification_queue WHERE id = '...';`

---

## Performance & Monitoring

### Find Slow Queries

```sql
-- Enable pg_stat_statements extension
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- Find slowest queries
SELECT
  query,
  calls,
  total_exec_time / 1000 AS total_seconds,
  mean_exec_time / 1000 AS mean_seconds,
  max_exec_time / 1000 AS max_seconds
FROM pg_stat_statements
WHERE query NOT LIKE '%pg_stat_statements%'
ORDER BY mean_exec_time DESC
LIMIT 10;
-- Action: Investigate queries with mean_seconds > 1.0
```

### Check Index Usage

```sql
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan AS index_scans,
  idx_tup_read AS tuples_read,
  CASE
    WHEN idx_scan = 0 THEN '❌ UNUSED'
    WHEN idx_scan < 100 THEN '⚠️ RARELY USED'
    ELSE '✅ ACTIVE'
  END AS usage_status
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;
-- Action: Drop indexes with idx_scan = 0 after 1 month in production
```

### Table Sizes

```sql
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS total_size,
  pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) AS table_size,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) - pg_relation_size(schemaname||'.'||tablename)) AS indexes_size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

### Connection Monitoring

```sql
SELECT
  datname AS database,
  usename AS username,
  application_name,
  client_addr,
  state,
  query_start,
  state_change,
  wait_event_type,
  wait_event,
  query
FROM pg_stat_activity
WHERE datname = current_database()
  AND state != 'idle'
ORDER BY query_start;
-- Look for: Long-running queries (> 1 hour), blocked queries (wait_event_type = 'Lock')
```

### Backup & Restore

#### Manual Backup

```bash
# Full database dump
pg_dump "$DATABASE_URL" > backup_$(date +%Y%m%d_%H%M%S).sql

# Schema only
pg_dump "$DATABASE_URL" --schema-only > schema_$(date +%Y%m%d).sql

# Data only
pg_dump "$DATABASE_URL" --data-only > data_$(date +%Y%m%d).sql
```

#### Restore

```bash
# Restore full backup
psql "$DATABASE_URL" < backup_20251116_143000.sql

# Restore schema only
psql "$DATABASE_URL" < schema_20251116.sql

# Restore data only
psql "$DATABASE_URL" < data_20251116.sql
```

#### Post-Restore Verification

```sql
-- Check table row counts
SELECT tablename, n_live_tup AS row_count
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- Check RLS status
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public';
-- All critical tables should have rowsecurity = TRUE

-- Check FK constraints
SELECT conname, conrelid::regclass AS table_name, confrelid::regclass AS referenced_table
FROM pg_constraint
WHERE contype = 'f' AND connamespace = 'public'::regnamespace;
```

---

## Emergency Commands

### Reset Rack Capacity

```sql
UPDATE racks SET occupied = (
  SELECT COALESCE(COUNT(*), 0)
  FROM inventory
  WHERE storage_area_id = racks.id AND status = 'IN_STORAGE'
);
```

### Clear Old Notifications

```sql
DELETE FROM notification_queue
WHERE processed = true AND created_at < NOW() - INTERVAL '7 days';
```

### Disable RLS (DANGEROUS - Test Only)

```sql
-- ⚠️ Only use in local development
ALTER TABLE storage_requests DISABLE ROW LEVEL SECURITY;

-- DON'T FORGET TO RE-ENABLE:
ALTER TABLE storage_requests ENABLE ROW LEVEL SECURITY;
```

---

## Weekly Data Validation

Run these queries weekly to detect integrity violations:

```sql
-- 1. Orphaned trucking loads
SELECT COUNT(*) AS orphaned_loads
FROM trucking_loads tl
LEFT JOIN storage_requests sr ON tl.storage_request_id = sr.id
WHERE sr.id IS NULL;
-- Expected: 0

-- 2. Capacity violations
SELECT COUNT(*) AS overbooked_racks
FROM racks
WHERE occupied > capacity;
-- Expected: 0

-- 3. Status inconsistencies
SELECT COUNT(*) AS inconsistent_loads
FROM trucking_loads
WHERE status = 'COMPLETED' AND completed_at IS NULL;
-- Expected: 0

-- 4. Orphaned inventory
SELECT COUNT(*) AS orphaned_inventory
FROM inventory i
LEFT JOIN companies c ON i.company_id = c.id
WHERE c.id IS NULL;
-- Expected: 0
```

---

## Related Documentation

- **Architecture:** `docs/architecture/DATABASE_SCHEMA.md`
- **State Machines:** `docs/architecture/STATE_MACHINES.md`
- **Testing Guide:** `docs/guides/TESTING_GUIDE.md`
- **Troubleshooting:** `TROUBLESHOOTING.md`

---

**Document Owner:** Database Integrity Guardian
**Last Review:** 2025-11-16
**Next Review:** 2026-02-16
