# PipeVault Database Schema & Row-Level Security Documentation

**Document Version:** 1.0
**Last Updated:** 2025-11-10
**Database:** Supabase (PostgreSQL 15)
**Purpose:** Comprehensive database architecture, RLS policies, and data integrity documentation

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Database Architecture](#database-architecture)
3. [Complete Schema Reference](#complete-schema-reference)
4. [Row-Level Security (RLS)](#row-level-security-rls)
5. [Data Integrity Patterns](#data-integrity-patterns)
6. [Atomic Transaction Patterns](#atomic-transaction-patterns)
7. [Index Strategy](#index-strategy)
8. [Stored Procedures & Functions](#stored-procedures--functions)
9. [Performance Monitoring](#performance-monitoring)
10. [Troubleshooting Guide](#troubleshooting-guide)

---

## Executive Summary

PipeVault uses a multi-tenant PostgreSQL database with strict data isolation enforced at the database level through Row-Level Security (RLS). The schema is designed around a customer storage request workflow with inbound/outbound trucking coordination and physical inventory tracking.

**Key Security Principles:**
- **Multi-tenant isolation:** Customers can only access their company's data
- **Admin bypass via SECURITY DEFINER:** Admin operations use stored procedures that bypass RLS after authorization checks
- **Atomic operations:** Critical workflows (approval, rejection) use transactional stored procedures
- **Audit trail:** All admin actions are logged in `admin_audit_log`

**Data Flow:**
1. Customer submits `storage_request`
2. Admin approves → assigns `racks`, updates capacity atomically
3. Trucking loads (`trucking_loads`) are created for inbound/outbound shipments
4. Manifests uploaded as `trucking_documents` with AI-extracted data in `parsed_payload`
5. Physical inventory tracked in `inventory` table linked to racks and loads
6. Notifications queued in `notification_queue` for email/Slack delivery

---

## Database Architecture

### Entity Relationship Overview

```
companies (multi-tenant root)
  ↓
  ├─→ storage_requests (customer requests)
  │     ↓
  │     ├─→ trucking_loads (inbound/outbound)
  │     │     ↓
  │     │     └─→ trucking_documents (manifests, BOLs)
  │     │           ↓
  │     │           └─→ parsed_payload (AI-extracted data)
  │     │
  │     └─→ inventory (pipe items)
  │           ↓
  │           └─→ storage_area_id → racks
  │
  └─→ admin_users (authorization)
        ↓
        └─→ admin_audit_log (compliance)
```

### Core Design Principles

1. **Foreign Key Constraints:** All relationships enforced with explicit CASCADE/RESTRICT behavior
2. **Check Constraints:** Business rules enforced at database level (capacity limits, positive quantities)
3. **Unique Constraints:** Prevent duplicates (reference IDs, sequence numbers)
4. **Partial Indexes:** Optimize queries for common filters (status = 'IN_STORAGE')
5. **Compound Indexes:** Support multi-column queries (request_id + status)

---

## Complete Schema Reference

### 1. companies

**Purpose:** Customer organizations (multi-tenant root table)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | uuid | PK, default gen_random_uuid() | Unique company identifier |
| `name` | text | NOT NULL | Company name |
| `domain` | text | NOT NULL, UNIQUE | Email domain (e.g., "acme.com") |
| `created_at` | timestamptz | default now() | Creation timestamp |
| `updated_at` | timestamptz | default now() | Last update timestamp |

**Indexes:**
- Primary key: `companies_pkey` (id)
- Unique: `companies_domain_key` (domain)
- Performance: `idx_companies_domain` (domain)

**RLS Policies:**
- SELECT: Public (all authenticated users can view company names)
- INSERT: Authenticated users can self-register (domain matches email)
- UPDATE: Admin only
- DELETE: Admin only

**Cascade Behavior:**
- `storage_requests.company_id` → RESTRICT (prevent deletion of companies with requests)
- `inventory.company_id` → RESTRICT (prevent deletion of companies with inventory)

**Business Rules:**
- Domain must be unique (one company per domain)
- Domain extracted from user email (`split_part(email, '@', 2)`)

---

### 2. storage_requests

**Purpose:** Customer pipe storage requests

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | uuid | PK, default gen_random_uuid() | Unique request identifier |
| `company_id` | uuid | FK → companies.id | Owning company |
| `user_email` | text | NOT NULL | Submitting user email |
| `reference_id` | text | NOT NULL | Human-readable reference (REF-YYYYMMDD-NNN) |
| `status` | request_status enum | default 'DRAFT' | DRAFT, PENDING, APPROVED, REJECTED, COMPLETED |
| `request_details` | jsonb | nullable | Pipe specifications, storage duration |
| `trucking_info` | jsonb | nullable | Delivery preferences |
| `assigned_rack_ids` | text[] | nullable | Array of assigned rack IDs |
| `admin_notes` | text | nullable | Internal admin notes (not visible to customer) |
| `rejection_reason` | text | nullable | Reason for rejection (visible to customer) |
| `approved_at` | timestamptz | nullable | Approval timestamp |
| `rejected_at` | timestamptz | nullable | Rejection timestamp |
| `archived_at` | timestamptz | nullable | Archive timestamp |
| `created_at` | timestamptz | default now() | Creation timestamp |
| `updated_at` | timestamptz | default now() | Last update timestamp |

**Indexes:**
- Primary key: `storage_requests_pkey` (id)
- Foreign key: `idx_requests_company` (company_id)
- Status: `idx_requests_status` (status)
- Reference: `idx_requests_reference` (reference_id)
- Performance: `idx_storage_requests_created_at` (created_at DESC)
- Compound: `idx_storage_requests_status_created_at` (status, created_at DESC)
- Partial: `idx_requests_archived` (archived_at) WHERE archived_at IS NOT NULL

**RLS Policies:**
- SELECT: Customers see only their company's requests (via company_id join)
- INSERT: Customers can create for their company
- UPDATE: Customers can update DRAFT/PENDING status; Admins can update all
- DELETE: Admin only

**Cascade Behavior:**
- Parent: `companies.id` → RESTRICT
- Children: `trucking_loads.storage_request_id` → RESTRICT (must delete loads first)

**Business Rules:**
- Status transitions: DRAFT → PENDING → APPROVED/REJECTED → COMPLETED
- Only PENDING requests can be approved/rejected
- `reference_id` should be unique (application enforced)
- `admin_notes` hidden from customer, `rejection_reason` visible to customer

**State Machine:**
```
DRAFT → PENDING → APPROVED → COMPLETED
              ↘ REJECTED
```

---

### 3. trucking_loads

**Purpose:** Individual inbound/outbound truck deliveries

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | uuid | PK, default gen_random_uuid() | Unique load identifier |
| `storage_request_id` | uuid | FK → storage_requests.id | Parent request |
| `direction` | trucking_load_direction enum | NOT NULL | INBOUND, OUTBOUND |
| `sequence_number` | integer | CHECK > 0 | Load #1, #2, #3 per request |
| `status` | trucking_load_status enum | default 'NEW' | NEW, APPROVED, IN_TRANSIT, COMPLETED, CANCELLED |
| `scheduled_slot_start` | timestamptz | nullable | Scheduled arrival start time |
| `scheduled_slot_end` | timestamptz | nullable | Scheduled arrival end time |
| `trucking_company` | text | nullable | Trucking company name |
| `contact_name` | text | nullable | Contact person name |
| `contact_phone` | text | nullable | Contact phone |
| `driver_name` | text | nullable | Driver name |
| `driver_phone` | text | nullable | Driver phone |
| `notes` | text | nullable | Special instructions |
| `total_joints_planned` | integer | nullable | Estimated joint count |
| `total_weight_lbs_planned` | numeric | nullable | Estimated weight |
| `total_joints_completed` | integer | default 0 | Actual joints delivered |
| `total_weight_lbs_completed` | numeric | default 0 | Actual weight delivered |
| `approved_at` | timestamptz | nullable | Approval timestamp |
| `completed_at` | timestamptz | nullable | Completion timestamp |
| `created_at` | timestamptz | default now() | Creation timestamp |
| `updated_at` | timestamptz | default now() | Last update timestamp |

**Indexes:**
- Primary key: `trucking_loads_pkey` (id)
- Foreign key: `idx_trucking_loads_request` (storage_request_id)
- Direction: `idx_trucking_loads_direction` (direction) WHERE direction IS NOT NULL
- Unique: `trucking_loads_storage_request_id_direction_sequence_number_key` (storage_request_id, direction, sequence_number)

**RLS Policies:**
- SELECT: Customers see only their company's loads (via storage_request join)
- INSERT: Customers can create for their requests
- UPDATE: Customers can update until APPROVED; Admins can update all
- DELETE: Admin only

**Cascade Behavior:**
- Parent: `storage_requests.id` → RESTRICT
- Children: `trucking_documents.trucking_load_id` → CASCADE (documents deleted with load)

**Business Rules:**
- `sequence_number` must be unique per (storage_request_id, direction) combination
- `sequence_number` must be positive
- Planned totals are estimates; completed totals are actuals (from manifest AI extraction)
- Status transitions: NEW → APPROVED → IN_TRANSIT → COMPLETED

**Unique Constraint Enforcement:**
```sql
UNIQUE (storage_request_id, direction, sequence_number)
```
This prevents duplicate load sequences like "Inbound Load #1" appearing twice.

---

### 4. trucking_documents

**Purpose:** Manifest PDFs/images with AI-extracted data

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | uuid | PK, default gen_random_uuid() | Unique document identifier |
| `trucking_load_id` | uuid | FK → trucking_loads.id | Parent load |
| `file_name` | text | NOT NULL | Original filename |
| `storage_path` | text | NOT NULL | Supabase Storage path |
| `document_type` | text | nullable | "manifest", "bill_of_lading", etc. |
| `parsed_payload` | jsonb | nullable, CHECK array | AI-extracted ManifestItem[] array |
| `uploaded_by` | text | nullable | User email |
| `uploaded_at` | timestamptz | default now() | Upload timestamp |

**Indexes:**
- Primary key: `trucking_documents_pkey` (id)
- Foreign key: `idx_trucking_documents_load` (trucking_load_id)
- Type: `idx_trucking_documents_type` (document_type) WHERE document_type IS NOT NULL

**RLS Policies:**
- SELECT: Customers see only their documents (via load → request → company join)
- INSERT: Customers can upload for their loads
- DELETE: Customers can delete within time window; Admins can delete any
- UPDATE: Admin only

**Cascade Behavior:**
- Parent: `trucking_loads.id` → CASCADE (documents deleted when load deleted)

**Business Rules:**
- `parsed_payload` must be JSON array if not NULL
- Check constraint: `jsonb_typeof(parsed_payload) = 'array'`
- Storage path format: `trucking-documents/{company_id}/{load_id}/{filename}`

**AI Extraction Format:**
```json
{
  "parsed_payload": [
    {
      "manufacturer": "TENARIS",
      "heat_number": "H123456",
      "serial_number": "S789012",
      "tally_length_ft": 31.5,
      "quantity": 100,
      "grade": "X52",
      "outer_diameter": 4.5,
      "weight_lbs_ft": 14.6
    }
  ]
}
```

**Important:** When AI extraction updates `parsed_payload`, it should also update the parent load's `total_joints_completed` and `total_weight_lbs_completed` fields. This is the **source of truth** for actual delivered quantities (manifest wins over estimate).

---

### 5. inventory

**Purpose:** Individual pipe items tracked in physical storage

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | uuid | PK, default gen_random_uuid() | Unique inventory item identifier |
| `company_id` | uuid | FK → companies.id | Owning company |
| `request_id` | uuid | FK → storage_requests.id | Parent request |
| `reference_id` | text | NOT NULL | Customer reference ID |
| `type` | pipe_type enum | NOT NULL | Drill Pipe, Casing, Tubing, Line Pipe |
| `grade` | text | NOT NULL | Steel grade (e.g., X52, L80) |
| `outer_diameter` | numeric | NOT NULL | OD in inches |
| `weight` | numeric | NOT NULL | Weight per foot (lbs/ft) |
| `length` | numeric | NOT NULL | Length in feet |
| `quantity` | integer | NOT NULL | Number of joints |
| `status` | pipe_status enum | default 'PENDING_DELIVERY' | PENDING_DELIVERY, IN_STORAGE, PICKED_UP, IN_TRANSIT |
| `storage_area_id` | text | FK → racks.id, nullable | Physical rack location |
| `delivery_truck_load_id` | uuid | FK → trucking_loads.id, nullable | Inbound load that delivered this |
| `pickup_truck_load_id` | uuid | FK → trucking_loads.id, nullable | Outbound load that picked this up |
| `manifest_item_id` | uuid | nullable | Links to shipment_items (AI extraction correlation) |
| `created_at` | timestamptz | default now() | Creation timestamp |
| `updated_at` | timestamptz | default now() | Last update timestamp |

**Indexes:**
- Primary key: `inventory_pkey` (id)
- Foreign keys:
  - `idx_inventory_company` (company_id)
  - `idx_inventory_request` (request_id)
  - `idx_inventory_storage_area` (storage_area_id)
- Performance: `idx_inventory_created_at` (created_at DESC)
- Status: `idx_inventory_status` (status) WHERE status = 'IN_STORAGE'
- Compound: `idx_inventory_request_status` (request_id, status) WHERE status = 'IN_STORAGE'
- Manifest: `idx_inventory_manifest_item` (manifest_item_id)

**RLS Policies:**
- SELECT: Customers see only their company's inventory
- INSERT: Customers can create for their company
- UPDATE: Admin only (rack assignments, status changes)
- DELETE: Admin only

**Cascade Behavior:**
- Parent: `companies.id` → RESTRICT
- Parent: `storage_requests.id` → NO ACTION
- Parent: `racks.id` → NO ACTION (nullable FK)

**Business Rules:**
- `quantity` must be positive
- `weight` must be positive
- `length` must be positive
- Status transitions: PENDING_DELIVERY → IN_STORAGE → PICKED_UP → IN_TRANSIT
- When status = 'IN_STORAGE', `storage_area_id` should be NOT NULL
- When status = 'PENDING_DELIVERY', `delivery_truck_load_id` should be set
- When status = 'PICKED_UP', `pickup_truck_load_id` should be set

**Important:** This table links inventory to both the original delivery load and the eventual pickup load, allowing full lifecycle tracking.

---

### 6. racks (storage_areas)

**Purpose:** Physical storage locations in the yard

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | text | PK | Rack identifier (e.g., "A-B1-05") |
| `area_id` | text | FK → yard_areas.id | Yard area (e.g., "A-B1") |
| `name` | text | NOT NULL | Display name |
| `capacity` | integer | CHECK >= 0, default 200 | Max joints or 1 for slot mode |
| `capacity_meters` | numeric | default 2400 | Max linear meters |
| `occupied` | integer | CHECK >= 0, default 0 | Current joints occupied |
| `occupied_meters` | numeric | default 0 | Current linear meters occupied |
| `allocation_mode` | text | CHECK IN ('LINEAR_CAPACITY', 'SLOT'), default 'LINEAR_CAPACITY' | Capacity tracking mode |
| `length_meters` | numeric | nullable | Physical rack length |
| `width_meters` | numeric | nullable | Physical rack width |
| `created_at` | timestamptz | default now() | Creation timestamp |
| `updated_at` | timestamptz | default now() | Last update timestamp |

**Indexes:**
- Primary key: `racks_pkey` (id)
- Foreign key: `idx_racks_area` (area_id)

**RLS Policies:**
- SELECT: Public (all authenticated users can view rack names/capacity)
- INSERT: Admin only
- UPDATE: Admin only (capacity changes during approval workflow)
- DELETE: Admin only

**Cascade Behavior:**
- Parent: `yard_areas.id` → NO ACTION
- Children: `inventory.storage_area_id` → NO ACTION (nullable FK)

**Business Rules:**
- `occupied` <= `capacity` (enforced by CHECK constraint)
- `occupied_meters` <= `capacity_meters`
- `allocation_mode = 'SLOT'` means rack can hold 1 load (binary occupancy)
- `allocation_mode = 'LINEAR_CAPACITY'` means rack capacity is joint-based

**Capacity Validation (Critical):**
```sql
ALTER TABLE racks ADD CONSTRAINT racks_capacity_check
  CHECK (occupied <= capacity);
ALTER TABLE racks ADD CONSTRAINT racks_meters_check
  CHECK (occupied_meters <= capacity_meters);
```

**Important:** During approval workflow, the atomic function `approve_storage_request_atomic()` validates available capacity BEFORE updating `occupied` fields, ensuring no race conditions.

---

### 7. admin_users

**Purpose:** Authorized admin user IDs

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | uuid | PK, default gen_random_uuid() | Unique admin record ID |
| `user_id` | uuid | FK → auth.users.id, UNIQUE | Supabase Auth UID |
| `email` | text | NOT NULL, UNIQUE | Admin email |
| `name` | text | NOT NULL | Admin name |
| `role` | text | default 'admin' | Admin role |
| `is_active` | boolean | default true | Active status |
| `created_at` | timestamptz | default now() | Creation timestamp |
| `updated_at` | timestamptz | default now() | Last update timestamp |

**Indexes:**
- Primary key: `admin_users_pkey` (id)
- Unique: `admin_users_user_id_key` (user_id)
- Unique: `admin_users_email_key` (email)
- Performance: `idx_admin_users_user_id` (user_id)

**RLS Policies:**
- SELECT: Authenticated users can read (used by RLS policies to check admin status)
- INSERT: System only
- UPDATE: Admin only
- DELETE: Admin only

**Cascade Behavior:**
- Parent: `auth.users.id` → NO ACTION
- Children: None (used for authorization checks only)

**Business Rules:**
- `user_id` links to Supabase Auth `auth.users.id`
- Used by `is_admin_user()` function to authorize SECURITY DEFINER procedures
- Admin status checked via: `EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid())`

**Security Pattern:**
```sql
CREATE FUNCTION is_admin_user() RETURNS BOOLEAN
SECURITY DEFINER -- Runs with elevated privileges
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM admin_users
    WHERE user_id = auth.uid() AND is_active = true
  );
END;
$$;
```

---

### 8. admin_audit_log

**Purpose:** Immutable audit trail of admin actions

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | uuid | PK, default gen_random_uuid() | Unique audit log entry ID |
| `admin_user_id` | text | NOT NULL | Admin user ID or "service_role" in test mode |
| `action` | text | NOT NULL | Action type (APPROVE_REQUEST, REJECT_REQUEST, etc.) |
| `entity_type` | text | NOT NULL | Entity type (storage_request, trucking_load, etc.) |
| `entity_id` | uuid | NOT NULL | Entity ID being acted upon |
| `details` | jsonb | nullable | Action-specific metadata |
| `created_at` | timestamptz | NOT NULL, default now() | Action timestamp |

**Indexes:**
- Primary key: `admin_audit_log_pkey` (id)
- User activity: `idx_admin_audit_log_user` (admin_user_id)
- Entity history: `idx_admin_audit_log_entity` (entity_type, entity_id)
- Recent activity: `idx_admin_audit_log_created` (created_at DESC)

**RLS Policies:**
- SELECT: Admin only
- INSERT: System only (via SECURITY DEFINER functions)
- UPDATE: Never (immutable log)
- DELETE: Never (compliance requirement)

**Cascade Behavior:**
- None (audit logs are independent records)

**Business Rules:**
- Records are immutable (no UPDATE/DELETE allowed)
- All admin actions must create audit log entry
- `admin_user_id` can be "service_role" for system actions
- `details` JSON structure varies by action type

**Example Audit Entry:**
```json
{
  "admin_user_id": "auth-uid-123",
  "action": "APPROVE_REQUEST",
  "entity_type": "storage_request",
  "entity_id": "request-uuid-456",
  "details": {
    "referenceId": "REF-20251110-001",
    "companyName": "Acme Corp",
    "assignedRacks": ["A-B1-05", "A-B1-06"],
    "requiredJoints": 200,
    "notes": "Approved with standard terms"
  },
  "created_at": "2025-11-10T14:30:00Z"
}
```

---

### 9. notification_queue

**Purpose:** Email and Slack notification queue for async processing

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | uuid | PK, default gen_random_uuid() | Unique notification ID |
| `type` | text | NOT NULL | Notification type (EMAIL, SLACK, storage_request_approved, etc.) |
| `payload` | jsonb | NOT NULL | Notification data |
| `webhook_key` | text | default 'slack_webhook_url' | Supabase Vault key for webhook URL |
| `attempts` | integer | default 0 | Retry attempt count |
| `last_error` | text | nullable | Last error message |
| `processed` | boolean | default false | Processing status |
| `processed_at` | timestamptz | nullable | Processing completion timestamp |
| `created_at` | timestamptz | NOT NULL, default now() | Creation timestamp |

**Indexes:**
- Primary key: `notification_queue_pkey` (id)
- Worker queries: Partial index on `processed` WHERE processed = false
- Debugging: Index on `created_at DESC`

**RLS Policies:**
- SELECT: Admin only
- INSERT: System only (via SECURITY DEFINER functions and triggers)
- UPDATE: System only (notification worker)
- DELETE: System only

**Cascade Behavior:**
- None (independent queue)

**Business Rules:**
- Workers poll `WHERE processed = false` to find pending notifications
- Max retry attempts: 3 (application enforced)
- After 3 failures, notification is marked as processed with error
- Webhook URL retrieved from Supabase Vault using `webhook_key`

**Notification Types:**
- `storage_request_approved` - Customer notification of approval
- `storage_request_rejected` - Customer notification of rejection
- `load_scheduled` - Trucking company notification of scheduled load
- `EMAIL` - Generic email notification
- `SLACK` - Slack webhook notification

---

## Row-Level Security (RLS)

### RLS Architecture

PipeVault uses **Row-Level Security (RLS)** to enforce multi-tenant data isolation at the database level. This prevents customers from accidentally or maliciously accessing other companies' data, even if application code has bugs.

**Core Principle:** RLS policies filter queries based on the authenticated user's identity (extracted from JWT token).

---

### Customer Data Isolation Pattern

#### 1. Company-Based Isolation (Direct)

For tables with direct `company_id` foreign key:

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
3. Find company: `SELECT id FROM companies WHERE domain = 'acme.com'` → company_uuid
4. Filter rows: `WHERE company_id = company_uuid`

**Applied to:**
- `storage_requests`
- `inventory`
- `documents`
- `shipments`

---

#### 2. Company-Based Isolation (Indirect via JOIN)

For tables without direct `company_id` (linked via parent table):

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

**How it works:**
1. For each `trucking_loads` row, check if parent `storage_request` belongs to user's company
2. Use `EXISTS` subquery for efficiency (stops after first match)
3. JOIN through: `trucking_loads → storage_requests → companies`

**Applied to:**
- `trucking_loads` (via storage_request)
- `trucking_documents` (via trucking_load → storage_request)
- `shipment_trucks` (via shipment)
- `dock_appointments` (via shipment)

---

#### 3. Self-Owned Data Pattern

For user-specific data (not company-wide):

```sql
-- Example: conversations table
CREATE POLICY "Users can view own conversations"
ON conversations
FOR SELECT
TO authenticated
USING (
  user_email = (auth.jwt()->>'email')
);
```

**Applied to:**
- `conversations` (AI chat history)

---

### Admin Bypass Pattern

Admins need access to ALL companies' data. This is achieved using **multiple RLS policies** (PERMISSIVE mode combines them with OR logic):

```sql
-- Customer policy (company-scoped)
CREATE POLICY "Customers see only their company's requests"
ON storage_requests FOR SELECT TO authenticated
USING (
  company_id IN (
    SELECT id FROM companies
    WHERE domain = split_part(auth.jwt()->>'email', '@', 2)
  )
);

-- Admin policy (all data)
CREATE POLICY "Admins see all requests"
ON storage_requests FOR SELECT TO authenticated
USING (
  is_admin()
);
```

**Result:** User can see rows if EITHER:
- Row belongs to their company (customer policy), OR
- User is an admin (admin policy)

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

---

### INSERT/UPDATE/DELETE Policies

#### Customer INSERT

```sql
CREATE POLICY "Users can create requests for own company"
ON storage_requests
FOR INSERT
TO authenticated
WITH CHECK (
  company_id IN (
    SELECT id FROM companies
    WHERE domain = split_part(auth.jwt()->>'email', '@', 2)
  )
);
```

**Key:** `WITH CHECK` clause validates the **new row** being inserted matches the policy.

---

#### Customer UPDATE

```sql
CREATE POLICY "Users can update own company requests"
ON storage_requests
FOR UPDATE
TO authenticated
USING (
  -- Must currently own the row (before update)
  company_id IN (
    SELECT id FROM companies
    WHERE domain = split_part(auth.jwt()->>'email', '@', 2)
  )
)
WITH CHECK (
  -- Updated row must still belong to same company (after update)
  company_id IN (
    SELECT id FROM companies
    WHERE domain = split_part(auth.jwt()->>'email', '@', 2)
  )
);
```

**Key:** Both `USING` (old row) and `WITH CHECK` (new row) must pass.

---

#### Admin-Only Operations

```sql
CREATE POLICY "storage_requests_admin_delete"
ON storage_requests
FOR DELETE
TO authenticated
USING (is_admin());
```

**Applied to:**
- DELETE operations (admin only)
- UPDATE operations on sensitive fields (e.g., `admin_notes`, `assigned_rack_ids`)

---

### SECURITY DEFINER Functions (RLS Bypass)

For admin operations that need to update multiple tables atomically, use **SECURITY DEFINER** functions that bypass RLS after authorization checks:

```sql
CREATE FUNCTION approve_storage_request_atomic(...)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER  -- Runs with function owner's privileges (bypasses RLS)
SET search_path = public
AS $$
BEGIN
  -- Step 1: Check admin authorization
  IF NOT is_admin_user() THEN
    RAISE EXCEPTION 'Access denied. Admin privileges required.';
  END IF;

  -- Step 2: Perform updates (RLS bypassed)
  UPDATE storage_requests SET status = 'APPROVED' WHERE id = p_request_id;
  UPDATE racks SET occupied = occupied + p_required_joints WHERE id = ANY(p_rack_ids);
  INSERT INTO admin_audit_log (...);

  -- All updates succeed or all fail (atomic transaction)
END;
$$;
```

**Why SECURITY DEFINER is safe:**
1. Authorization checked at function entry (`is_admin_user()`)
2. Function logic is trusted (written by developers, not users)
3. Atomic transaction ensures consistency
4. Audit log records all actions

**When to use:**
- Multi-table updates (approval workflow)
- Operations requiring elevated privileges (capacity updates)
- Operations needing atomicity guarantees

---

### RLS Testing Protocol

**Test RLS policies before deploying to production:**

1. **Create test users** for different companies:
```sql
-- Create test company 1
INSERT INTO companies (id, name, domain)
VALUES ('company1-uuid', 'Acme Corp', 'acme.com');

-- Create test company 2
INSERT INTO companies (id, name, domain)
VALUES ('company2-uuid', 'TechCo', 'techco.com');
```

2. **Create test storage requests:**
```sql
INSERT INTO storage_requests (id, company_id, user_email, reference_id, status)
VALUES
  ('request1-uuid', 'company1-uuid', 'user@acme.com', 'REF-001', 'PENDING'),
  ('request2-uuid', 'company2-uuid', 'user@techco.com', 'REF-002', 'PENDING');
```

3. **Test customer isolation** (using Supabase client with user JWT):
```javascript
// Login as user@acme.com
const { data: acmeRequests } = await supabase
  .from('storage_requests')
  .select('*');

console.log(acmeRequests);
// Expected: Only REF-001 (acme.com requests)
// Should NOT see REF-002 (techco.com request)
```

4. **Test admin access:**
```javascript
// Login as admin user
const { data: allRequests } = await supabase
  .from('storage_requests')
  .select('*');

console.log(allRequests);
// Expected: Both REF-001 and REF-002 (all requests)
```

5. **Test unauthorized operations:**
```javascript
// Login as user@acme.com
const { error } = await supabase
  .from('storage_requests')
  .delete()
  .eq('id', 'request1-uuid');

console.log(error);
// Expected: Error (customers cannot delete requests)
```

---

## Data Integrity Patterns

### Foreign Key Relationships

All parent-child relationships enforced with explicit `ON DELETE` and `ON UPDATE` behaviors:

| Child Table | FK Column | Parent Table | ON DELETE | ON UPDATE | Rationale |
|------------|-----------|--------------|-----------|-----------|-----------|
| storage_requests | company_id | companies.id | RESTRICT | CASCADE | Prevent deletion of companies with requests |
| trucking_loads | storage_request_id | storage_requests.id | RESTRICT | CASCADE | Prevent deletion of requests with loads |
| trucking_documents | trucking_load_id | trucking_loads.id | CASCADE | CASCADE | Documents are artifacts; delete with load |
| inventory | company_id | companies.id | RESTRICT | CASCADE | Prevent deletion of companies with inventory |
| inventory | request_id | storage_requests.id | NO ACTION | CASCADE | Inventory outlives request (archived) |
| inventory | storage_area_id | racks.id | NO ACTION | CASCADE | Inventory can be unassigned (nullable FK) |

**Key Patterns:**

1. **CASCADE:** Child records are **dependent artifacts** (e.g., documents, photos)
   - Deleting parent automatically deletes children
   - Use when child has no independent lifecycle

2. **RESTRICT:** Child records are **independent entities** (e.g., loads, inventory)
   - Deleting parent fails if children exist
   - Forces explicit cleanup before deletion
   - Prevents accidental data loss

3. **NO ACTION:** Child records are **loosely coupled** (e.g., inventory → rack)
   - Foreign key can be NULL
   - Parent can be deleted if FK is NULL or explicitly handled

---

### Check Constraints

Business rules enforced at database level:

#### 1. Capacity Constraints (racks)

```sql
ALTER TABLE racks
ADD CONSTRAINT racks_capacity_check
  CHECK (occupied <= capacity);

ALTER TABLE racks
ADD CONSTRAINT racks_meters_check
  CHECK (occupied_meters <= capacity_meters);
```

**Prevents:** Overbooking racks beyond physical capacity

---

#### 2. Positive Quantity Constraints

```sql
ALTER TABLE trucking_loads
ADD CONSTRAINT trucking_loads_sequence_check
  CHECK (sequence_number > 0);

-- Similar constraints on inventory (quantity, weight, length > 0)
```

**Prevents:** Negative or zero quantities

---

#### 3. Enum Value Constraints

```sql
ALTER TABLE racks
ADD CONSTRAINT racks_allocation_mode_check
  CHECK (allocation_mode IN ('LINEAR_CAPACITY', 'SLOT'));
```

**Prevents:** Invalid allocation modes

---

#### 4. JSON Type Constraints

```sql
ALTER TABLE trucking_documents
ADD CONSTRAINT trucking_documents_parsed_payload_check
  CHECK (
    parsed_payload IS NULL OR
    jsonb_typeof(parsed_payload) = 'array'
  );
```

**Prevents:** Invalid JSON structure in `parsed_payload`

---

### Unique Constraints

Prevent business logic duplicates:

#### 1. Global Uniqueness

```sql
-- One company per domain
ALTER TABLE companies
ADD CONSTRAINT companies_domain_key UNIQUE (domain);

-- One admin per user_id
ALTER TABLE admin_users
ADD CONSTRAINT admin_users_user_id_key UNIQUE (user_id);
```

---

#### 2. Composite Uniqueness

```sql
-- No duplicate load sequences per request/direction
ALTER TABLE trucking_loads
ADD CONSTRAINT trucking_loads_storage_request_id_direction_sequence_number_key
  UNIQUE (storage_request_id, direction, sequence_number);
```

**Prevents:** Creating "Inbound Load #1" twice for same request

---

#### 3. Conditional Uniqueness (Partial Index)

```sql
-- Only one active dock appointment per time slot
CREATE UNIQUE INDEX dock_appointments_unique_active_slot
ON dock_appointments (slot_start)
WHERE status IN ('PENDING', 'CONFIRMED');
```

**Prevents:** Double-booking time slots (cancelled appointments excluded)

---

### Data Validation Queries

Run these queries regularly to detect integrity violations:

#### 1. Orphaned Records (Missing Parent)

```sql
-- Orphaned trucking loads (no parent request)
SELECT tl.id, tl.storage_request_id
FROM trucking_loads tl
LEFT JOIN storage_requests sr ON tl.storage_request_id = sr.id
WHERE sr.id IS NULL;
-- Expected: 0 rows
```

```sql
-- Orphaned inventory (no parent company)
SELECT i.id, i.company_id
FROM inventory i
LEFT JOIN companies c ON i.company_id = c.id
WHERE c.id IS NULL;
-- Expected: 0 rows
```

---

#### 2. Status Inconsistencies

```sql
-- COMPLETED loads without completed_at timestamp
SELECT id, status, completed_at
FROM trucking_loads
WHERE status = 'COMPLETED' AND completed_at IS NULL;
-- Expected: 0 rows
```

```sql
-- IN_STORAGE inventory without assigned rack
SELECT id, status, storage_area_id
FROM inventory
WHERE status = 'IN_STORAGE' AND storage_area_id IS NULL;
-- Expected: 0 rows (or investigate why unassigned)
```

---

#### 3. Capacity Violations

```sql
-- Racks exceeding capacity
SELECT id, name, capacity, occupied
FROM racks
WHERE occupied > capacity;
-- Expected: 0 rows (CHECK constraint should prevent this)
```

```sql
-- Racks exceeding meter capacity
SELECT id, name, capacity_meters, occupied_meters
FROM racks
WHERE occupied_meters > capacity_meters;
-- Expected: 0 rows
```

---

#### 4. Total Mismatches (Load vs. Inventory)

```sql
-- Loads with inventory count mismatch
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

**Why this matters:** Manifest data (`total_joints_completed`) should match actual inventory created. Mismatches indicate:
- AI extraction errors
- Manual inventory adjustments
- Missing inventory records

---

#### 5. Duplicate Sequence Numbers

```sql
-- Duplicate load sequences (violates unique constraint)
SELECT
  storage_request_id,
  direction,
  sequence_number,
  COUNT(*) AS count
FROM trucking_loads
GROUP BY storage_request_id, direction, sequence_number
HAVING COUNT(*) > 1;
-- Expected: 0 rows (unique constraint should prevent this)
```

---

## Atomic Transaction Patterns

### Problem: Non-Atomic Approval Workflow

**Before:** Client-side approval logic issued multiple Supabase updates in try/catch:
```typescript
try {
  await supabase.from('storage_requests').update({ status: 'APPROVED' }).eq('id', requestId);
  await supabase.from('racks').update({ occupied: occupied + requiredJoints }).eq('id', rackId);
  await supabase.from('admin_audit_log').insert({ ... });
} catch (error) {
  // ❌ Partial state possible: request approved but racks not updated
}
```

**Issues:**
- Network failure between updates → partial state
- Race condition: two admins approve same request simultaneously
- No capacity validation before updates
- No guarantee audit log is created

---

### Solution: Atomic Stored Procedures

**Pattern:** Move workflow into single PostgreSQL function with transaction guarantees:

```sql
CREATE FUNCTION approve_storage_request_atomic(
  p_request_id UUID,
  p_assigned_rack_ids UUID[],
  p_required_joints INTEGER,
  p_notes TEXT DEFAULT NULL,
  p_admin_user_id TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER  -- Bypass RLS after authorization
SET search_path = public
AS $$
DECLARE
  v_available_capacity INTEGER := 0;
BEGIN
  -- ========================================
  -- STEP 1: Authorization Check
  -- ========================================
  IF NOT is_admin_user() THEN
    RAISE EXCEPTION 'Access denied. Admin privileges required.';
  END IF;

  -- ========================================
  -- STEP 2: Validate Capacity (ATOMIC)
  -- ========================================
  SELECT SUM(capacity - occupied) INTO v_available_capacity
  FROM racks
  WHERE id = ANY(p_assigned_rack_ids);

  IF v_available_capacity < p_required_joints THEN
    RAISE EXCEPTION 'Insufficient capacity: % required, % available',
      p_required_joints, v_available_capacity;
  END IF;

  -- ========================================
  -- STEP 3: Update Request Status
  -- ========================================
  UPDATE storage_requests
  SET
    status = 'APPROVED',
    assigned_rack_ids = p_assigned_rack_ids,
    admin_notes = p_notes,
    approved_at = NOW(),
    updated_at = NOW()
  WHERE id = p_request_id AND status = 'PENDING';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found or not in PENDING status';
  END IF;

  -- ========================================
  -- STEP 4: Update Rack Occupancy
  -- ========================================
  UPDATE racks
  SET
    occupied = occupied + (p_required_joints / array_length(p_assigned_rack_ids, 1)),
    updated_at = NOW()
  WHERE id = ANY(p_assigned_rack_ids);

  -- ========================================
  -- STEP 5: Create Audit Log Entry
  -- ========================================
  INSERT INTO admin_audit_log (
    admin_user_id,
    action,
    entity_type,
    entity_id,
    details,
    created_at
  ) VALUES (
    COALESCE(p_admin_user_id, auth.uid()::text),
    'APPROVE_REQUEST',
    'storage_request',
    p_request_id,
    json_build_object(
      'assignedRacks', p_assigned_rack_ids,
      'requiredJoints', p_required_joints,
      'notes', p_notes
    ),
    NOW()
  );

  -- ========================================
  -- STEP 6: Queue Notifications
  -- ========================================
  INSERT INTO notification_queue (type, payload, created_at)
  VALUES ('storage_request_approved', json_build_object('requestId', p_request_id), NOW());

  -- ========================================
  -- RETURN SUCCESS
  -- ========================================
  RETURN json_build_object(
    'success', true,
    'requestId', p_request_id,
    'status', 'APPROVED',
    'message', 'Request approved successfully'
  );

EXCEPTION
  WHEN OTHERS THEN
    -- All updates automatically rolled back (ACID guarantee)
    RAISE EXCEPTION 'Approval failed: %. All changes rolled back.', SQLERRM;
END;
$$;
```

---

### Usage Pattern

**Client-side code:**
```typescript
try {
  const { data, error } = await supabase.rpc('approve_storage_request_atomic', {
    p_request_id: requestId,
    p_assigned_rack_ids: [rackId1, rackId2],
    p_required_joints: 200,
    p_notes: 'Approved with standard terms'
  });

  if (error) throw error;

  console.log(data); // { success: true, requestId: "...", status: "APPROVED", message: "..." }
} catch (error) {
  // ✅ No partial state: Either ALL operations succeeded or ALL were rolled back
  console.error('Approval failed:', error.message);
}
```

---

### ACID Guarantees

1. **Atomicity:** All operations succeed together or fail together (no partial state)
2. **Consistency:** Capacity validation ensures business rules are met before updates
3. **Isolation:** Transaction locks prevent race conditions (two admins can't approve same request)
4. **Durability:** Once committed, changes are permanent (even if server crashes)

---

### Transaction Rollback Scenarios

**Scenario 1: Insufficient Capacity**
```sql
-- Approval fails at capacity validation step
ERROR: Insufficient capacity: 200 required, 150 available
-- Result: NO changes to database (request still PENDING, racks unchanged)
```

**Scenario 2: Network Failure Mid-Transaction**
```
-- Client sends RPC call
-- Server validates capacity ✅
-- Server updates request ✅
-- Server updates racks ✅
-- Network disconnects before response sent ❌
-- Result: Transaction COMMITS (all changes saved)
-- Client retries → idempotent check prevents duplicate approval
```

**Scenario 3: Invalid Request Status**
```sql
-- Approval fails at UPDATE step (request already approved)
ERROR: Request not found or not in PENDING status
-- Result: NO changes to database
```

---

### Idempotency Pattern

For safe retries, add idempotency checks:

```sql
-- Check if already approved
IF EXISTS (SELECT 1 FROM storage_requests WHERE id = p_request_id AND status = 'APPROVED') THEN
  RETURN json_build_object('success', true, 'message', 'Already approved');
END IF;
```

---

## Index Strategy

### Performance Indexes

**Goal:** Optimize common query patterns without over-indexing (indexes slow down writes).

#### 1. Foreign Key Indexes (Join Performance)

```sql
-- Trucking loads by storage request
CREATE INDEX idx_trucking_loads_request
ON trucking_loads(storage_request_id);
-- Query: SELECT * FROM trucking_loads WHERE storage_request_id = ?
-- Usage: Admin dashboard, customer request details
```

```sql
-- Inventory by request
CREATE INDEX idx_inventory_request
ON inventory(request_id);
-- Query: SELECT * FROM inventory WHERE request_id = ?
-- Usage: Inventory summaries, rack assignments
```

```sql
-- Trucking documents by load
CREATE INDEX idx_trucking_documents_load
ON trucking_documents(trucking_load_id);
-- Query: SELECT * FROM trucking_documents WHERE trucking_load_id = ?
-- Usage: Manifest display, document download
```

---

#### 2. Status Filters (Partial Indexes)

```sql
-- Active inventory only
CREATE INDEX idx_inventory_status
ON inventory(status)
WHERE status = 'IN_STORAGE';
-- Query: SELECT * FROM inventory WHERE status = 'IN_STORAGE'
-- Usage: Current inventory reports (filters out delivered/picked up)
```

**Why partial:** Index only includes `IN_STORAGE` rows (smaller, faster). Other statuses rarely queried.

---

#### 3. Compound Indexes (Multi-Column Queries)

```sql
-- Inventory by request + status
CREATE INDEX idx_inventory_request_status
ON inventory(request_id, status)
WHERE status = 'IN_STORAGE';
-- Query: SELECT * FROM inventory WHERE request_id = ? AND status = 'IN_STORAGE'
-- Usage: "Show active inventory for this request"
```

**Why compound:** Single index supports both filters efficiently. Order matters: `(request_id, status)` supports queries on `request_id` alone OR `request_id + status`.

---

#### 4. Sorting Indexes (ORDER BY Performance)

```sql
-- Recent requests first
CREATE INDEX idx_storage_requests_created_at
ON storage_requests(created_at DESC);
-- Query: SELECT * FROM storage_requests ORDER BY created_at DESC LIMIT 20
-- Usage: Admin dashboard "Recent Requests"
```

```sql
-- Compound sort + filter
CREATE INDEX idx_storage_requests_status_created_at
ON storage_requests(status, created_at DESC);
-- Query: SELECT * FROM storage_requests WHERE status = 'PENDING' ORDER BY created_at DESC
-- Usage: Admin dashboard "Pending Requests (newest first)"
```

---

#### 5. Correlation Indexes (AI Extraction)

```sql
-- Inventory linked to manifest items
CREATE INDEX idx_inventory_manifest_item
ON inventory(manifest_item_id);
-- Query: SELECT * FROM inventory WHERE manifest_item_id = ?
-- Usage: Correlating manifest AI extraction to physical inventory
```

**Rationale:** After AI processes manifest, system creates inventory records. This index allows quick lookup to update inventory with extracted data.

---

### Index Maintenance

#### Check Index Usage

```sql
-- Find unused indexes
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan AS scans,
  idx_tup_read AS tuples_read,
  idx_tup_fetch AS tuples_fetched
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
  AND idx_scan = 0  -- Never used
ORDER BY relname, indexname;
```

**Action:** Drop indexes with `idx_scan = 0` after 1 month in production (they're not being used).

---

#### Check Index Size

```sql
-- Find largest indexes
SELECT
  schemaname,
  tablename,
  indexname,
  pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY pg_relation_size(indexrelid) DESC
LIMIT 10;
```

**Action:** Evaluate if large indexes are justified by query performance gains.

---

#### REINDEX (Rebuild Bloated Indexes)

```sql
-- Rebuild single index
REINDEX INDEX CONCURRENTLY idx_inventory_request;

-- Rebuild all indexes on table
REINDEX TABLE CONCURRENTLY inventory;
```

**When to run:** After large DELETE operations or bulk data imports (index bloat).

---

### Removed Indexes (Lessons Learned)

#### 1. Low Selectivity Indexes

```sql
-- ❌ REMOVED: idx_trucking_loads_status
CREATE INDEX idx_trucking_loads_status ON trucking_loads(status);
```

**Why removed:** Status has only 5 values (NEW, APPROVED, IN_TRANSIT, COMPLETED, CANCELLED). PostgreSQL prefers sequential scans for low selectivity. Index was never used.

**Lesson:** Don't index columns with < 10 distinct values unless combined with other filters (compound index).

---

#### 2. Redundant Indexes

```sql
-- ❌ REMOVED: idx_trucking_documents_parsed_payload
CREATE INDEX idx_trucking_documents_parsed_payload ON trucking_documents USING GIN(parsed_payload);
```

**Why removed:** GIN index on entire JSONB payload was slow and rarely used. Specific queries needed different approach (application-level filtering).

**Lesson:** GIN indexes are expensive. Only create if you regularly query JSON fields with `@>`, `?`, `?|` operators.

---

#### 3. Unused Indexes

```sql
-- ❌ REMOVED: idx_inventory_reference
CREATE INDEX idx_inventory_reference ON inventory(reference_id);
```

**Why removed:** Query analysis showed `reference_id` was never used in WHERE clauses (always queried by `request_id` or `company_id`).

**Lesson:** Monitor index usage for 1 month before keeping. Drop if `idx_scan = 0`.

---

## Stored Procedures & Functions

### 1. is_admin_user()

**Purpose:** Check if authenticated user is an admin

```sql
CREATE FUNCTION is_admin_user()
RETURNS BOOLEAN
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

**Usage:**
- Called by RLS policies: `USING (is_admin())`
- Called by SECURITY DEFINER functions for authorization
- Returns `TRUE` if user is active admin, `FALSE` otherwise

**Security:**
- `SECURITY DEFINER`: Runs with elevated privileges (can read `admin_users` table)
- `SET search_path = public`: Prevents schema injection attacks
- No `GRANT EXECUTE TO PUBLIC`: Function not directly callable by users

---

### 2. approve_storage_request_atomic()

**Purpose:** Atomically approve storage request with rack assignment

**Signature:**
```sql
approve_storage_request_atomic(
  p_request_id UUID,
  p_assigned_rack_ids UUID[],
  p_required_joints INTEGER,
  p_notes TEXT DEFAULT NULL,
  p_admin_user_id TEXT DEFAULT NULL
) RETURNS JSON
```

**Parameters:**
- `p_request_id`: Storage request UUID to approve
- `p_assigned_rack_ids`: Array of rack UUIDs to assign
- `p_required_joints`: Total joints needed (capacity validation)
- `p_notes`: Optional admin notes (stored in `admin_notes` field)
- `p_admin_user_id`: Optional admin user ID (defaults to `auth.uid()`)

**Returns:**
```json
{
  "success": true,
  "requestId": "uuid",
  "status": "APPROVED",
  "assignedRacks": ["A-B1-05", "A-B1-06"],
  "message": "Request approved successfully"
}
```

**Transaction Flow:**
1. Check admin authorization (`is_admin_user()`)
2. Validate rack capacity (atomic SELECT)
3. Update request status to APPROVED
4. Update rack occupancy (distributed across assigned racks)
5. Insert audit log entry
6. Queue notification
7. Return success JSON

**Error Handling:**
- Authorization failure → EXCEPTION (no changes)
- Insufficient capacity → EXCEPTION (no changes)
- Invalid request status → EXCEPTION (no changes)
- Any error → Automatic rollback (ACID guarantee)

---

### 3. reject_storage_request_atomic()

**Purpose:** Atomically reject storage request with reason

**Signature:**
```sql
reject_storage_request_atomic(
  p_request_id UUID,
  p_rejection_reason TEXT,
  p_admin_user_id TEXT DEFAULT NULL
) RETURNS JSON
```

**Transaction Flow:**
1. Check admin authorization
2. Update request status to REJECTED
3. Set rejection_reason (visible to customer)
4. Insert audit log entry
5. Queue notification
6. Return success JSON

---

### 4. get_project_summaries_by_company()

**Purpose:** Admin-only function returning project data grouped by company

**Signature:**
```sql
get_project_summaries_by_company() RETURNS JSON
```

**Returns:**
```json
[
  {
    "company": {
      "id": "uuid",
      "name": "Acme Corp",
      "domain": "acme.com"
    },
    "projects": [
      {
        "id": "uuid",
        "referenceId": "REF-20251110-001",
        "status": "APPROVED",
        "pipeDetails": { ... },
        "inboundLoads": [
          {
            "id": "uuid",
            "sequenceNumber": 1,
            "status": "COMPLETED",
            "documents": [
              {
                "id": "uuid",
                "fileName": "manifest.pdf",
                "parsedPayload": [ ... ]
              }
            ],
            "assignedRacks": [ ... ]
          }
        ],
        "outboundLoads": [ ... ],
        "inventorySummary": {
          "totalJoints": 200,
          "totalWeightLbs": 2920,
          "rackNames": ["A-B1-05", "A-B1-06"]
        }
      }
    ]
  }
]
```

**Query Strategy:**
- Uses CTEs (Common Table Expressions) for readability
- Joins: `companies → storage_requests → trucking_loads → trucking_documents`
- Aggregates: Counts, sums per request/load
- Filters: Excludes admin company (`mpsgroup.ca`)
- Performance: Uses indexes on FK columns

**Security:**
- Admin-only: `IF NOT is_admin_user() THEN RAISE EXCEPTION`
- SECURITY DEFINER: Bypasses RLS to access all companies

---

## Performance Monitoring

### Query Performance

#### 1. Slow Query Log

**Enable pg_stat_statements extension:**
```sql
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
```

**Find slowest queries:**
```sql
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
```

**Action:** Investigate queries with `mean_seconds > 1.0`.

---

#### 2. EXPLAIN ANALYZE

**Test specific query:**
```sql
EXPLAIN ANALYZE
SELECT * FROM inventory
WHERE request_id = 'some-uuid' AND status = 'IN_STORAGE';
```

**Look for:**
- ✅ `Index Scan using idx_inventory_request_status`
- ❌ `Seq Scan on inventory` (bad - not using index)
- ✅ Actual time < 100ms
- ❌ Actual time > 1000ms (needs optimization)

---

#### 3. Index Usage Statistics

```sql
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan AS index_scans,
  idx_tup_read AS tuples_read,
  idx_tup_fetch AS tuples_fetched,
  CASE
    WHEN idx_scan = 0 THEN '❌ UNUSED'
    WHEN idx_scan < 100 THEN '⚠️ RARELY USED'
    ELSE '✅ ACTIVE'
  END AS usage_status
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;
```

---

### Table Statistics

#### 1. Table Sizes

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

---

#### 2. Row Counts

```sql
SELECT
  schemaname,
  relname AS tablename,
  n_live_tup AS row_count,
  n_dead_tup AS dead_rows,
  last_vacuum,
  last_autovacuum
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY n_live_tup DESC;
```

**Action:** If `dead_rows > 20% of row_count`, run `VACUUM ANALYZE tablename`.

---

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
```

**Look for:**
- Long-running queries (`query_start > 1 hour ago`)
- Blocked queries (`wait_event_type = 'Lock'`)
- Too many connections (`count(*) > max_connections`)

---

## Troubleshooting Guide

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
2. Check RLS policies with `\ddrp storage_requests` (psql command)
3. Test policy: `SET ROLE authenticated; SET request.jwt.claims = '{"email":"user@example.com"}'; SELECT * FROM storage_requests;`

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
SELECT conname, contype, consrc
FROM pg_constraint
WHERE conrelid = 'racks'::regclass AND contype = 'c';
-- Should show racks_capacity_check
```

**Solution:**
1. Verify `occupied <= capacity` for all racks
2. If mismatch, investigate recent approvals (check `admin_audit_log`)
3. Manually fix: `UPDATE racks SET occupied = (SELECT COUNT(*) FROM inventory WHERE storage_area_id = racks.id)`

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
1. If FK constraint exists, this shouldn't happen (check constraints)
2. If migration removed FK temporarily, re-add: `ALTER TABLE inventory ADD CONSTRAINT inventory_request_id_fkey FOREIGN KEY (request_id) REFERENCES storage_requests(id);`
3. Clean up orphans: `UPDATE inventory SET request_id = NULL WHERE request_id NOT IN (SELECT id FROM storage_requests);`

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
1. Verify indexes exist: `idx_trucking_loads_request`, `idx_inventory_request`, `idx_trucking_documents_load`
2. Check index usage: `SELECT * FROM pg_stat_user_indexes WHERE indexname LIKE 'idx_%';`
3. If indexes not used, run `ANALYZE` to update statistics: `ANALYZE storage_requests; ANALYZE trucking_loads;`
4. Consider pagination if returning > 100 companies

---

### Issue 5: Document Upload Fails

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

### Issue 6: Atomic Function Returns "Access Denied"

**Symptom:** Admin user calls `approve_storage_request_atomic()`, gets "Access denied. Admin privileges required."

**Diagnosis:**
```sql
-- Check if user is in admin_users table
SELECT * FROM admin_users WHERE user_id = auth.uid();
-- Should return 1 row

-- Check if user_id matches auth.users.id
SELECT id, email FROM auth.users WHERE id = auth.uid();

-- Test is_admin_user() directly (via service role)
SELECT is_admin_user();
```

**Solution:**
1. Verify user exists in `admin_users` with matching `user_id`
2. Verify `is_active = TRUE`
3. If test mode, check bypass: `IF auth.uid() IS NULL THEN RETURN true;`
4. Remove test mode bypass before production: See migration `20251109000006_fix_admin_user_id_test_mode.sql`

---

### Issue 7: Notification Queue Stuck

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
2. Verify Supabase Vault secrets exist: `slack_webhook_url`, `resend_api_key`
3. Manually retry: `UPDATE notification_queue SET attempts = 0, processed = false WHERE id = '...';`
4. If repeated failures, check payload format: `SELECT payload FROM notification_queue WHERE id = '...';`

---

## Backup & Recovery

### Automated Backups

Supabase provides:
- **Daily backups** (free tier): Retained for 7 days
- **Point-in-time recovery** (Pro tier): Up to 30 days
- **Manual backups**: Available via Supabase dashboard

---

### Manual Backup

```bash
# Full database dump
pg_dump "$DATABASE_URL" > backup_$(date +%Y%m%d_%H%M%S).sql

# Schema only
pg_dump "$DATABASE_URL" --schema-only > schema_$(date +%Y%m%d).sql

# Data only
pg_dump "$DATABASE_URL" --data-only > data_$(date +%Y%m%d).sql
```

---

### Restore Process

```bash
# Restore full backup
psql "$DATABASE_URL" < backup_20251110_143000.sql

# Restore schema only (for fresh database)
psql "$DATABASE_URL" < schema_20251110.sql

# Restore data only (into existing schema)
psql "$DATABASE_URL" < data_20251110.sql
```

---

### Post-Restore Verification

1. **Check table counts:**
```sql
SELECT
  schemaname,
  tablename,
  n_live_tup AS row_count
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY tablename;
```

2. **Check RLS status:**
```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public';
-- All critical tables should have rowsecurity = TRUE
```

3. **Check trigger functionality:**
```sql
-- Insert test record and verify trigger fires
INSERT INTO storage_requests (...) VALUES (...);
SELECT * FROM notification_queue WHERE type = 'storage_request' ORDER BY created_at DESC LIMIT 1;
```

4. **Check FK constraints:**
```sql
SELECT
  conname,
  conrelid::regclass AS table_name,
  confrelid::regclass AS referenced_table
FROM pg_constraint
WHERE contype = 'f' AND connamespace = 'public'::regnamespace;
```

---

## Summary Checklist

Use this checklist for database health checks:

**Weekly:**
- [ ] Run orphaned record queries (Section 5.3)
- [ ] Check slow query log (Section 9.1)
- [ ] Verify index usage (Section 9.3)

**Monthly:**
- [ ] Run capacity validation queries
- [ ] Check for unused indexes (drop if `idx_scan = 0`)
- [ ] Review admin_audit_log for anomalies
- [ ] Test RLS policies with test users
- [ ] Verify backup restore process

**Quarterly:**
- [ ] Run VACUUM ANALYZE on all tables
- [ ] REINDEX large tables (if bloated)
- [ ] Review and update this documentation
- [ ] Test disaster recovery procedure

---

## Document Maintenance

**Last Updated:** 2025-11-10
**Next Review:** 2026-02-10
**Owner:** Database Integrity Guardian

**Change Log:**
- 2025-11-10: Initial comprehensive documentation (v1.0)

---

**For questions or issues, consult:**
- Technical Architecture: `TECHNICAL_ARCHITECTURE.md`
- Deployment Guide: `DEPLOYMENT_GUIDE_CORRECTED_MIGRATIONS.md`
- API Reference: `docs/ADMIN_COMPONENT_ARCHITECTURE.md`
