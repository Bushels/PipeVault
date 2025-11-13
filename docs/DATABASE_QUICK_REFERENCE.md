# PipeVault Database Quick Reference

**Quick lookup guide for common database operations**

---

## Table Relationships (One-Liner)

```
companies → storage_requests → trucking_loads → trucking_documents (CASCADE)
                           ↓
                        inventory → racks
```

---

## Critical Foreign Keys

| Child → Parent | ON DELETE | Why |
|----------------|-----------|-----|
| `trucking_documents → trucking_loads` | CASCADE | Documents are artifacts |
| `trucking_loads → storage_requests` | RESTRICT | Prevent accidental deletion |
| `inventory → companies` | RESTRICT | Prevent accidental deletion |
| `storage_requests → companies` | RESTRICT | Prevent accidental deletion |

---

## RLS Quick Test

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

---

## Common Queries

### Check Orphaned Records
```sql
-- Orphaned loads
SELECT tl.id FROM trucking_loads tl
LEFT JOIN storage_requests sr ON tl.storage_request_id = sr.id
WHERE sr.id IS NULL;
```

### Check Capacity Issues
```sql
-- Overbooked racks
SELECT id, name, capacity, occupied
FROM racks
WHERE occupied > capacity;
```

### Check Load Totals Mismatch
```sql
-- Manifest vs inventory discrepancies
SELECT
  tl.id,
  tl.total_joints_completed,
  COUNT(i.id) AS actual_inventory
FROM trucking_loads tl
LEFT JOIN inventory i ON i.delivery_truck_load_id = tl.id
GROUP BY tl.id, tl.total_joints_completed
HAVING tl.total_joints_completed != COUNT(i.id);
```

---

## Key Indexes

| Index | Table | Columns | Why |
|-------|-------|---------|-----|
| `idx_trucking_loads_request` | trucking_loads | storage_request_id | FK join |
| `idx_inventory_request_status` | inventory | request_id, status | Compound query |
| `idx_inventory_status` | inventory | status WHERE IN_STORAGE | Partial index |
| `idx_trucking_documents_load` | trucking_documents | trucking_load_id | Manifest lookup |

---

## Stored Procedures

### Approve Request (Atomic)
```typescript
await supabase.rpc('approve_storage_request_atomic', {
  p_request_id: 'uuid',
  p_assigned_rack_ids: ['rack1-uuid', 'rack2-uuid'],
  p_required_joints: 200,
  p_notes: 'Approved'
});
```

### Reject Request (Atomic)
```typescript
await supabase.rpc('reject_storage_request_atomic', {
  p_request_id: 'uuid',
  p_rejection_reason: 'Insufficient capacity'
});
```

### Get Project Summaries (Admin Only)
```typescript
const { data } = await supabase.rpc('get_project_summaries_by_company');
// Returns JSON array of companies with nested projects
```

---

## Status Enums

### request_status
`DRAFT → PENDING → APPROVED/REJECTED → COMPLETED`

### trucking_load_status
`NEW → APPROVED → IN_TRANSIT → COMPLETED`

### pipe_status (inventory)
`PENDING_DELIVERY → IN_STORAGE → PICKED_UP → IN_TRANSIT`

---

## Performance Monitoring

### Find Slow Queries
```sql
SELECT query, mean_exec_time / 1000 AS avg_seconds
FROM pg_stat_statements
ORDER BY mean_exec_time DESC LIMIT 5;
```

### Check Index Usage
```sql
SELECT indexname, idx_scan
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;
```

### Table Sizes
```sql
SELECT tablename, pg_size_pretty(pg_total_relation_size('public.'||tablename))
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size('public.'||tablename) DESC;
```

---

## Troubleshooting

### Customer Can't See Data
1. Check company domain: `SELECT * FROM companies WHERE domain = 'example.com';`
2. Check RLS enabled: `SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'storage_requests';`
3. Test policy: `EXPLAIN SELECT * FROM storage_requests WHERE company_id = 'uuid';`

### Approval Fails with "Insufficient Capacity"
1. Check rack capacity: `SELECT id, capacity, occupied FROM racks WHERE id = ANY(ARRAY['uuid']);`
2. Check constraint: `SELECT conname FROM pg_constraint WHERE conrelid = 'racks'::regclass;`
3. Recalculate: `UPDATE racks SET occupied = (SELECT COUNT(*) FROM inventory WHERE storage_area_id = racks.id);`

### Notification Queue Stuck
1. Check pending: `SELECT * FROM notification_queue WHERE processed = false;`
2. Check errors: `SELECT type, last_error FROM notification_queue WHERE last_error IS NOT NULL;`
3. Retry: `UPDATE notification_queue SET attempts = 0, processed = false WHERE id = 'uuid';`

---

## Backup & Restore

### Backup
```bash
pg_dump "$DATABASE_URL" > backup_$(date +%Y%m%d).sql
```

### Restore
```bash
psql "$DATABASE_URL" < backup_20251110.sql
```

### Verify
```sql
SELECT tablename, n_live_tup FROM pg_stat_user_tables WHERE schemaname = 'public';
```

---

## Data Validation

### Run These Weekly
```sql
-- Orphaned trucking loads
SELECT COUNT(*) FROM trucking_loads tl
LEFT JOIN storage_requests sr ON tl.storage_request_id = sr.id
WHERE sr.id IS NULL;
-- Expected: 0

-- Capacity violations
SELECT COUNT(*) FROM racks WHERE occupied > capacity;
-- Expected: 0

-- Status inconsistencies
SELECT COUNT(*) FROM trucking_loads WHERE status = 'COMPLETED' AND completed_at IS NULL;
-- Expected: 0
```

---

## Security Checks

### Admin Authorization
```sql
-- Check if user is admin
SELECT EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid());
```

### RLS Policy Audit
```sql
-- List all RLS policies
SELECT tablename, policyname, cmd, qual
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

### Audit Log Review
```sql
-- Recent admin actions
SELECT admin_user_id, action, entity_type, created_at
FROM admin_audit_log
ORDER BY created_at DESC
LIMIT 20;
```

---

## Schema Migrations

### Check Applied Migrations
```bash
supabase migration list
```

### Apply Pending Migrations
```bash
supabase db push
```

### Create New Migration
```bash
supabase migration new migration_name
```

---

## Key Constraints

### Unique Constraints
- `companies.domain` - One company per email domain
- `(trucking_loads.storage_request_id, direction, sequence_number)` - No duplicate load sequences
- `admin_users.user_id` - One admin record per auth user

### Check Constraints
- `racks.occupied <= racks.capacity` - Prevent overbooking
- `trucking_loads.sequence_number > 0` - Positive sequences
- `trucking_documents.parsed_payload` is JSON array - Valid AI extraction format

---

## Emergency Commands

### Disable RLS (DANGEROUS - Test Only)
```sql
ALTER TABLE storage_requests DISABLE ROW LEVEL SECURITY;
-- DON'T FORGET TO RE-ENABLE:
ALTER TABLE storage_requests ENABLE ROW LEVEL SECURITY;
```

### Reset Rack Capacity
```sql
UPDATE racks SET occupied = (
  SELECT COALESCE(COUNT(*), 0)
  FROM inventory
  WHERE storage_area_id = racks.id AND status = 'IN_STORAGE'
);
```

### Clear Notification Queue
```sql
DELETE FROM notification_queue WHERE processed = true AND created_at < NOW() - INTERVAL '7 days';
```

---

## Documentation References

- **Full Schema:** `DATABASE_SCHEMA_AND_RLS.md`
- **Architecture:** `TECHNICAL_ARCHITECTURE.md`
- **Migrations:** `DEPLOYMENT_GUIDE_CORRECTED_MIGRATIONS.md`
- **Verification:** `supabase/VERIFICATION_QUERIES.sql`

---

**Last Updated:** 2025-11-10
