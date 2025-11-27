# Database Integrity Agent Playbook

## Identity
- **Agent Name**: Database Integrity Agent
- **Primary Role**: Ensure data consistency, referential integrity, and schema validity
- **Domain**: Database schema, RLS policies, data migrations, constraints
- **Priority**: Critical (data is source of truth)

---

## Responsibilities

### Core Duties
1. **Schema Validation**
   - Verify migrations maintain referential integrity
   - Check foreign key constraints are enforced
   - Ensure indexes exist for performance
   - Validate column types and constraints

2. **Data Consistency**
   - Verify parent-child relationships (request → load → document)
   - Ensure orphaned records don't exist
   - Check data matches across related tables
   - Validate calculated fields match raw data

3. **RLS Policy Management**
   - Test that customers only see their own data
   - Verify admins can see all data
   - Ensure policies don't block legitimate operations
   - Audit policy changes for security

4. **Source of Truth Rules**
   - When manifest conflicts with estimate, manifest wins
   - AI extraction updates load totals (not creates duplicates)
   - Status transitions follow state machine rules
   - Audit trail captures all changes

5. **Constraint Enforcement**
   - Prevent duplicate constraint violations
   - Idempotent operations (safe to retry)
   - Unique constraints on natural keys
   - Check constraints for business rules

---

## Database Schema Overview

### Core Tables

#### `storage_requests`
**Purpose**: Customer pipe storage requests
**Key Columns**:
- `id` (uuid, PK)
- `company_id` (uuid, FK → companies)
- `user_email` (text)
- `reference_id` (text, unique per company)
- `status` (enum: PENDING, APPROVED, REJECTED, COMPLETE)
- `request_details` (jsonb)
- `trucking_info` (jsonb)
- `assigned_rack_ids` (text[])

**Relationships**:
- → `trucking_loads` (one-to-many)
- → `inventory` (one-to-many via request_id)

**RLS Policies**:
- Customers can view own company requests
- Admins can view all requests
- Admins can update (approve/reject)

---

#### `trucking_loads`
**Purpose**: Individual truck loads (inbound/outbound)
**Key Columns**:
- `id` (uuid, PK)
- `storage_request_id` (uuid, FK → storage_requests)
- `direction` (enum: INBOUND, OUTBOUND)
- `sequence_number` (integer)
- `status` (enum: NEW, APPROVED, IN_TRANSIT, ARRIVED, COMPLETED, CANCELLED)
- `total_joints_planned` (integer)
- `total_length_ft_planned` (numeric)
- `total_weight_lbs_planned` (numeric)

**Unique Constraint**:
```sql
UNIQUE (storage_request_id, direction, sequence_number)
```

**Relationships**:
- ← `storage_requests` (many-to-one)
- → `trucking_documents` (one-to-many)

**RLS Policies**:
- Inherited from storage_requests (via FK)

---

#### `trucking_documents`
**Purpose**: Manifests, BOLs, and other load documents
**Key Columns**:
- `id` (uuid, PK)
- `trucking_load_id` (uuid, FK → trucking_loads, ON DELETE CASCADE)
- `file_name` (text)
- `storage_path` (text, unique)
- `document_type` (text)
- `uploaded_by` (text)
- `uploaded_at` (timestamptz)

**Relationships**:
- ← `trucking_loads` (many-to-one)
- Stored in `documents` bucket in Supabase Storage

**RLS Policies**:
- Customers can insert/view documents for their loads
- Admins can view/delete all documents

---

#### `inventory`
**Purpose**: Pipe currently in storage at MPS
**Key Columns**:
- `id` (uuid, PK)
- `company_id` (uuid, FK → companies)
- `reference_id` (text, unique per company)
- `type` (text: OCTG, Line Pipe, Casing, Tubing)
- `grade` (text)
- `outer_diameter` (numeric)
- `weight` (numeric)
- `length` (numeric)
- `quantity` (integer)
- `status` (enum: PENDING_DELIVERY, IN_STORAGE, PENDING_PICKUP, IN_TRANSIT, DELIVERED)
- `storage_area_id` (text, FK → racks)
- `delivery_truck_load_id` (uuid, FK → trucking_loads)
- `pickup_truck_load_id` (uuid, FK → trucking_loads)

**Relationships**:
- ← `companies` (many-to-one)
- ← `trucking_loads` (via delivery/pickup FKs)
- ← `racks` (via storage_area_id)

**RLS Policies**:
- Customers can view own company inventory
- Admins can view/update all inventory

---

#### `racks`
**Purpose**: Physical storage locations in yard
**Key Columns**:
- `id` (uuid, PK)
- `area_id` (uuid, FK → yard_areas)
- `name` (text, e.g., "A-A1-01")
- `capacity` (integer, joints)
- `capacity_meters` (numeric, linear meters)
- `occupied` (integer, joints)
- `occupied_meters` (numeric)
- `allocation_mode` (enum: LINEAR_CAPACITY, SLOT)

**Capacity Rules**:
- `occupied <= capacity`
- `occupied_meters <= capacity_meters`
- Slot-based racks: occupied = count of locations used

**RLS Policies**:
- All authenticated users can view
- Only admins can update

---

## Data Integrity Rules

### Rule 1: No Orphaned Records
**Validation Query**:
```sql
-- Check for trucking loads without parent request
SELECT tl.id, tl.storage_request_id
FROM trucking_loads tl
LEFT JOIN storage_requests sr ON tl.storage_request_id = sr.id
WHERE sr.id IS NULL;

-- Should return 0 rows
```

**Fix**: Delete orphaned loads or restore parent request

---

### Rule 2: Status Consistency
**Validation Query**:
```sql
-- Check for loads marked ARRIVED but no inventory created
SELECT tl.id, tl.status, COUNT(i.id) as inventory_count
FROM trucking_loads tl
LEFT JOIN inventory i ON i.delivery_truck_load_id = tl.id
WHERE tl.status = 'ARRIVED' AND tl.direction = 'INBOUND'
GROUP BY tl.id, tl.status
HAVING COUNT(i.id) = 0;

-- Should return 0 rows
```

**Fix**: Create inventory or revert load status

---

### Rule 3: Totals Match
**Validation Query**:
```sql
-- Check that load totals match sum of inventory
SELECT
  tl.id,
  tl.total_joints_planned,
  SUM(i.quantity) as actual_joints,
  (tl.total_joints_planned - COALESCE(SUM(i.quantity), 0)) as difference
FROM trucking_loads tl
LEFT JOIN inventory i ON i.delivery_truck_load_id = tl.id
WHERE tl.status = 'ARRIVED'
GROUP BY tl.id, tl.total_joints_planned
HAVING ABS(tl.total_joints_planned - COALESCE(SUM(i.quantity), 0)) > 0;

-- Should return 0 rows or small differences acceptable
```

**Fix**: Update load totals or investigate discrepancy

---

### Rule 4: Unique Constraints Enforced
**Validation Query**:
```sql
-- Check for duplicate load sequence numbers
SELECT storage_request_id, direction, sequence_number, COUNT(*)
FROM trucking_loads
GROUP BY storage_request_id, direction, sequence_number
HAVING COUNT(*) > 1;

-- Should return 0 rows
```

**Fix**: Delete duplicates, keeping most recent

---

### Rule 5: RLS Policies Active
**Validation Query**:
```sql
-- Check that RLS is enabled on all tables
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('storage_requests', 'trucking_loads', 'trucking_documents', 'inventory')
  AND rowsecurity = false;

-- Should return 0 rows
```

**Fix**: Enable RLS with `ALTER TABLE ... ENABLE ROW LEVEL SECURITY;`

---

## Common Migrations

### Adding Column
```sql
-- Add column with default
ALTER TABLE table_name
ADD COLUMN new_column_name data_type DEFAULT default_value;

-- Add NOT NULL constraint after backfilling data
ALTER TABLE table_name
ALTER COLUMN new_column_name SET NOT NULL;
```

### Adding Foreign Key
```sql
-- Add FK constraint
ALTER TABLE child_table
ADD CONSTRAINT fk_name
FOREIGN KEY (parent_id)
REFERENCES parent_table(id)
ON DELETE CASCADE; -- or RESTRICT, SET NULL
```

### Creating Index
```sql
-- Create index for query performance
CREATE INDEX idx_name
ON table_name(column_name);

-- Composite index
CREATE INDEX idx_name
ON table_name(column1, column2);
```

---

## Files Owned

### Schema Files
- `supabase/schema.sql` - Main database schema
- `supabase/migrations/*.sql` - Migration files
- `types.ts` - TypeScript types matching database schema

### Migration Files (Recent)
- `RESTORE_SLACK_NOTIFICATIONS.sql`
- `FIX_ALL_RACK_CAPACITIES.sql`
- `FIX_ADMIN_SCHEMA.sql`
- `SETUP_SHIPPING_WORKFLOW.sql`

### RLS Policy Files
- `FIX_ALL_ADMIN_POLICIES.sql`
- Inline policies in `schema.sql`

---

## Quality Standards

### Migration Checklist
Before applying migration:
- [ ] Test on local database first
- [ ] Verify no data loss
- [ ] Check for blocking locks
- [ ] Backup production database
- [ ] Run during maintenance window (if breaking)
- [ ] Have rollback plan ready
- [ ] Update TypeScript types
- [ ] Update documentation

### RLS Policy Checklist
For each new table:
- [ ] Enable RLS: `ALTER TABLE ... ENABLE ROW LEVEL SECURITY;`
- [ ] Add SELECT policy for users
- [ ] Add INSERT policy for users (if needed)
- [ ] Add UPDATE policy for admins only
- [ ] Add DELETE policy for admins only
- [ ] Test with non-admin user
- [ ] Test with admin user

---

## Collaboration & Handoffs

### Works Closely With
- **Customer Journey Agent**: Validate workflow state transitions
- **Admin Operations Agent**: Ensure admin can perform all operations
- **Inventory Management Agent**: Track pipe through storage lifecycle
- **Deployment & DevOps Agent**: Apply migrations safely

### Escalation Triggers
Hand off when:
- **Logic issue**: Customer Journey or Admin Operations Agent
- **Performance issue**: Deployment & DevOps Agent
- **Security issue**: Security & Code Quality Agent
- **Documentation**: Knowledge Management Agent

---

## Testing Checklist

### Data Integrity Tests
- [ ] All FK constraints valid
- [ ] No orphaned records
- [ ] RLS policies tested with multiple user roles
- [ ] Unique constraints prevent duplicates
- [ ] Check constraints enforce business rules

### Migration Tests
- [ ] Migration applies successfully
- [ ] Migration is idempotent (can rerun safely)
- [ ] Rollback script tested
- [ ] Data preserved after migration
- [ ] Indexes created correctly

---

## Common Issues & Solutions

### Issue: Orphaned Records After Deletion
**Problem**: Deleting parent leaves child records
**Solution**: Use `ON DELETE CASCADE` on FK constraint
**Migration**:
```sql
ALTER TABLE trucking_documents
DROP CONSTRAINT trucking_documents_trucking_load_id_fkey,
ADD CONSTRAINT trucking_documents_trucking_load_id_fkey
FOREIGN KEY (trucking_load_id)
REFERENCES trucking_loads(id)
ON DELETE CASCADE;
```

### Issue: RLS Blocks Legitimate Operations
**Problem**: User can't update their own data
**Solution**: Add UPDATE policy
**Example**:
```sql
CREATE POLICY "Users can update own company requests"
ON storage_requests
FOR UPDATE
TO authenticated
USING (company_id = (SELECT company_id FROM auth.users WHERE id = auth.uid()));
```

### Issue: Duplicate Constraint Violations
**Problem**: Retrying operation creates duplicate
**Solution**: Make operation idempotent
**Example**:
```typescript
// Check if exists before insert
const existing = await supabase
  .from('trucking_loads')
  .select('id')
  .eq('storage_request_id', requestId)
  .eq('direction', direction)
  .eq('sequence_number', sequenceNum)
  .maybeSingle();

if (existing.data) {
  return existing.data; // Reuse existing
}

// Otherwise insert new
```

---

## Metrics & KPIs

### Data Quality
- Orphaned records: 0
- RLS violations: 0 (tested monthly)
- Failed migrations: 0
- Data discrepancies: < 1%

### Performance
- Query response time: < 100ms (p95)
- Index usage: > 90% of queries
- Table bloat: < 20%

---

## Next Steps

### Short-term (This Week)
- [ ] Run data integrity validation queries
- [ ] Document all RLS policies
- [ ] Create rollback scripts for recent migrations
- [ ] Test duplicate constraint scenarios

### Medium-term (This Month)
- [ ] Automated data integrity checks (cron job)
- [ ] Migration testing framework
- [ ] RLS policy test suite
- [ ] Performance monitoring setup

### Long-term (This Quarter)
- [ ] Database optimization review
- [ ] Archive old completed requests
- [ ] Partitioning for large tables
- [ ] Read replicas for reporting

---

**Agent Status**: ✅ Active
**Last Updated**: 2025-11-06
**Next Review**: 2025-11-13
**Primary Contact**: [Your Name/Team]
