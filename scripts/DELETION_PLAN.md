# Test User Data Deletion Plan

## Executive Summary

This document outlines the comprehensive plan to safely delete ALL data associated with test users:
- `kyle@bushelsenergy.com`
- `kyle@ibelievefit.com`

## Foreign Key Constraint Analysis

### Parent-Child Relationships

The PipeVault database has the following hierarchical relationships that dictate deletion order:

```
companies (root)
  ├── storage_requests (ON DELETE CASCADE)
  │   ├── trucking_loads (ON DELETE CASCADE)
  │   │   ├── trucking_documents (ON DELETE CASCADE)
  │   │   └── inventory.delivery_truck_load_id (ON DELETE SET NULL)
  │   │   └── inventory.pickup_truck_load_id (ON DELETE SET NULL)
  │   ├── conversations (ON DELETE CASCADE)
  │   ├── documents (ON DELETE CASCADE)
  │   └── shipments (ON DELETE CASCADE)
  │       ├── shipment_trucks (ON DELETE CASCADE)
  │       ├── dock_appointments (ON DELETE CASCADE)
  │       ├── shipment_documents (ON DELETE CASCADE)
  │       └── shipment_items (ON DELETE CASCADE)
  ├── inventory (ON DELETE CASCADE)
  └── notifications (company_id FK)

auth.users (root)
  ├── auth.sessions (automatic cascade)
  └── notifications (user_id FK)

notification_queue (standalone, no FK dependencies)
```

### Critical FK Constraints

1. **inventory ↔ trucking_loads**: Bidirectional relationship
   - `inventory.delivery_truck_load_id` → `trucking_loads.id` (SET NULL)
   - `inventory.pickup_truck_load_id` → `trucking_loads.id` (SET NULL)
   - **MUST** delete inventory BEFORE trucking_loads to avoid constraint violations

2. **storage_requests → trucking_loads**: CASCADE
   - Deleting storage_requests will automatically delete trucking_loads
   - BUT we explicitly delete children first to handle inventory FKs

3. **trucking_loads → trucking_documents**: CASCADE
   - Deleting trucking_loads will automatically delete documents
   - We delete explicitly to track storage file cleanup

4. **companies → storage_requests**: CASCADE
   - Deleting companies will cascade to all child tables
   - We delete explicitly for better audit trail

## Deletion Order (Safe Sequence)

The script follows this exact order to respect FK constraints:

### Phase 1: Independent Tables
1. **notification_queue** - No FK dependencies, safe to delete first

### Phase 2: Leaf Tables (Children with No Children)
2. **notifications** - References users and companies
3. **shipment_items** - References shipments
4. **shipment_documents** - References shipments
5. **dock_appointments** - References shipments
6. **shipment_trucks** - References shipments

### Phase 3: Middle-Level Tables
7. **shipments** - References storage_requests and companies
8. **trucking_documents** - References trucking_loads

### Phase 4: Critical Dependency Resolution
9. **inventory** - MUST be deleted before trucking_loads (FK constraint)
10. **trucking_loads** - Can now be safely deleted

### Phase 5: Parent Tables
11. **conversations** - References storage_requests
12. **documents** - References storage_requests and companies
13. **storage_requests** - Parent of trucking_loads and conversations

### Phase 6: Root Tables
14. **companies** - Root parent of entire company hierarchy
15. **auth.sessions** - Cascades automatically when auth.users deleted
16. **auth.users** - Root parent of authentication hierarchy

### Phase 7: Storage Cleanup
17. **Supabase Storage Files** - Delete physical files from buckets

## Why This Order Matters

### Example 1: Deleting trucking_loads Before inventory

**WRONG ORDER** (will fail):
```sql
DELETE FROM trucking_loads WHERE id = 'abc';
-- ❌ ERROR: Cannot delete because inventory.delivery_truck_load_id references this load
```

**CORRECT ORDER**:
```sql
DELETE FROM inventory WHERE delivery_truck_load_id = 'abc';
-- ✅ Sets inventory FK to NULL

DELETE FROM trucking_loads WHERE id = 'abc';
-- ✅ Now safe to delete
```

### Example 2: Deleting storage_requests Before trucking_loads

While CASCADE would handle this, we delete children explicitly to:
1. Track exactly how many records are deleted from each table
2. Handle inventory FK constraints properly
3. Delete storage files before record deletion

## Affected Tables Summary

| Table | Deletion Method | Cascade Behavior | Notes |
|-------|----------------|------------------|-------|
| notification_queue | Direct DELETE | None | Standalone table |
| notifications | Direct DELETE | None | References users/companies |
| shipment_items | Direct DELETE | None | Child of shipments |
| shipment_documents | Direct DELETE | None | Child of shipments |
| dock_appointments | Direct DELETE | None | Child of shipments |
| shipment_trucks | Direct DELETE | None | Child of shipments |
| shipments | Direct DELETE | CASCADE children | Parent of shipment_* |
| trucking_documents | Direct DELETE | CASCADE from loads | Also deletes storage files |
| inventory | Direct DELETE | None | MUST be before trucking_loads |
| trucking_loads | Direct DELETE | CASCADE from requests | After inventory deleted |
| conversations | Direct DELETE | CASCADE from requests | Contains message history |
| documents | Direct DELETE | CASCADE from requests | Also deletes storage files |
| storage_requests | Direct DELETE | CASCADE to loads/docs | Parent of trucking hierarchy |
| companies | Direct DELETE | CASCADE to requests | Root parent |
| auth.sessions | Auto CASCADE | From auth.users | Automatic |
| auth.users | Admin API delete | CASCADE sessions | Requires service role |

## Storage File Deletion

Files to delete from Supabase Storage buckets:

### trucking_documents Table
- Bucket: `trucking-documents`
- Files: Manifest PDFs, BOLs, tally sheets
- Pattern: `{company_id}/{request_id}/{filename}`

### documents Table
- Bucket: `documents`
- Files: Uploaded documents, spreadsheets
- Pattern: `{company_id}/{request_id}/{filename}`

**IMPORTANT**: Delete files BEFORE deleting database records to preserve storage_path references.

## Rollback Strategy

⚠️ **There is NO automatic rollback!**

### Prevention Measures
1. **Discovery Phase**: Always run discovery FIRST to see what will be deleted
2. **Manual Review**: Review discovery report before proceeding
3. **5-Second Abort**: Script waits 5 seconds before deletion (Ctrl+C to abort)
4. **One-by-One SQL**: Manual SQL script allows running queries one at a time

### If You Need to Rollback
Since deletion is permanent, rollback options are limited:

1. **Supabase Point-in-Time Recovery** (if enabled)
   - Restore database to timestamp before deletion
   - May lose other recent changes

2. **Manual Data Re-entry**
   - If you have a copy of the discovery report, manually re-create records
   - Not recommended for large datasets

3. **Database Backup Restoration**
   - If you created a backup before cleanup, restore it
   - May require downtime

## RLS Policy Safety

### Policies That Will NOT Be Affected

The cleanup script ONLY deletes data. It does NOT modify:
- RLS policies
- Database functions
- Triggers
- Indexes
- Constraints

### Verification Queries

After cleanup, verify RLS policies are intact:

```sql
SELECT tablename, policyname, cmd, qual
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

Expected policies remain:
- `Customers view own company data` (SELECT)
- `Admins view all data` (SELECT)
- `Admins update all data` (UPDATE)
- `Admins delete documents` (DELETE)
- etc.

## Data Integrity Verification

After cleanup, run these queries to verify integrity:

### No Orphaned Records
```sql
-- Should return 0 rows
SELECT COUNT(*) FROM trucking_loads tl
LEFT JOIN storage_requests sr ON tl.storage_request_id = sr.id
WHERE sr.id IS NULL;
```

### No Constraint Violations
```sql
-- Should return 0 rows
SELECT COUNT(*) FROM inventory
WHERE delivery_truck_load_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM trucking_loads WHERE id = inventory.delivery_truck_load_id);
```

### No Duplicate Keys
```sql
-- Should return 0 rows
SELECT storage_request_id, direction, sequence_number, COUNT(*)
FROM trucking_loads
GROUP BY storage_request_id, direction, sequence_number
HAVING COUNT(*) > 1;
```

## Execution Options

### Option 1: TypeScript Script (Recommended)

**Pros**:
- Automated discovery, cleanup, and verification
- 5-second abort window
- Detailed progress logging
- Handles auth user deletion via API

**Cons**:
- Requires service role key in .env
- Requires Node.js and dependencies

**Usage**:
```bash
# 1. Add service role key to .env
echo "SUPABASE_SERVICE_ROLE_KEY=your_key_here" >> .env

# 2. Run discovery
npx tsx scripts/cleanup-test-users.ts discover

# 3. Review report, then cleanup
npx tsx scripts/cleanup-test-users.ts cleanup

# 4. Verify
npx tsx scripts/cleanup-test-users.ts verify
```

### Option 2: Manual SQL (Alternative)

**Pros**:
- No dependencies required
- Full control over each deletion step
- Can pause between steps
- No need for service role key in .env (use Supabase Dashboard)

**Cons**:
- Manual execution of each query
- Must delete auth users manually via Dashboard
- More prone to human error

**Usage**:
1. Open `scripts/cleanup_test_users_manual.sql`
2. Run SECTION 1 (Discovery) in Supabase SQL Editor
3. Review results
4. Run SECTION 2 (Cleanup) queries ONE BY ONE
5. Delete auth users via Supabase Dashboard > Authentication > Users
6. Run SECTION 3 (Verification)

## Estimated Impact

Based on typical test data:

| Table | Estimated Records |
|-------|------------------|
| auth.users | 2 |
| auth.sessions | 0-10 |
| companies | 2 |
| storage_requests | 0-50 |
| trucking_loads | 0-100 |
| trucking_documents | 0-200 |
| inventory | 0-500 |
| conversations | 0-50 |
| documents | 0-100 |
| shipments | 0-50 |
| notification_queue | 0-20 |

**Total estimated records**: 0-1,000+

**Estimated execution time**: 10-60 seconds (depending on data volume)

## Post-Cleanup Checklist

- [ ] All test user data deleted from database
- [ ] Auth users deleted from Supabase Auth
- [ ] Storage files deleted from buckets
- [ ] No orphaned records remain
- [ ] RLS policies intact
- [ ] Foreign key constraints valid
- [ ] Unique constraints enforced
- [ ] Admin dashboard shows no ghost tiles
- [ ] Customer dashboard clean

## Support

For questions or issues:
1. Review the discovery report carefully
2. Check the troubleshooting section in `CLEANUP_TEST_USERS_README.md`
3. Verify service role key is correct
4. Contact Database Integrity Guardian Agent

---

**Document Version**: 1.0
**Last Updated**: 2025-11-18
**Author**: Database Integrity Guardian Agent
