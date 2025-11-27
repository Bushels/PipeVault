# Test User Data Cleanup Script

## Overview

This script safely removes ALL data associated with test user accounts:
- `kyle@bushelsenergy.com`
- `kyle@ibelievefit.com`

## Prerequisites

### 1. Get Supabase Service Role Key

The service role key is required to bypass RLS policies and access all data.

**Option A: From Supabase Dashboard**
1. Go to https://app.supabase.com/project/cvevhvjxnklbbhtqzyvw/settings/api
2. Scroll down to "Project API keys"
3. Copy the `service_role` key (NOT the `anon` key)

**Option B: From Local Supabase**
```bash
npx supabase status
# Look for "service_role key"
```

### 2. Add Service Role Key to .env

Add this line to your `.env` file:

```bash
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

⚠️ **IMPORTANT**: The service role key has FULL database access. NEVER commit it to git!

### 3. Install Dependencies

```bash
npm install
```

## Usage

### Step 1: Discovery Phase

First, run the discovery phase to see what data exists:

```bash
npx tsx scripts/cleanup-test-users.ts discover
```

This will output a comprehensive report showing:
- How many records exist in each table
- Which companies will be deleted
- Which files will be removed from storage
- Total counts across all tables

**Review this report carefully before proceeding!**

### Step 2: Cleanup Phase

Once you've reviewed the discovery report and confirmed it's safe to proceed:

```bash
npx tsx scripts/cleanup-test-users.ts cleanup
```

This will:
1. Show the discovery report again
2. Wait 5 seconds (giving you time to abort with Ctrl+C)
3. Delete all data in the correct order to respect foreign key constraints
4. Delete associated files from Supabase Storage
5. Run verification to ensure cleanup was successful

### Step 3: Verification Phase

To verify the cleanup was successful (or check status at any time):

```bash
npx tsx scripts/cleanup-test-users.ts verify
```

This will re-run the discovery queries and confirm:
- ✅ All test user data has been removed
- ✅ No orphaned records remain
- ❌ Or show what data still exists if cleanup was incomplete

## What Gets Deleted

### Database Tables (in deletion order)

The script deletes data in this specific order to avoid foreign key violations:

1. **notification_queue** - Queued email/Slack notifications
2. **notifications** - User notifications
3. **shipment_items** - Individual items in shipments
4. **shipment_documents** - Shipment manifest documents
5. **dock_appointments** - Scheduled dock appointments
6. **shipment_trucks** - Individual trucks in shipments
7. **shipments** - Shipment records
8. **trucking_documents** - Trucking manifests and BOLs
9. **inventory** - Pipe inventory records
10. **trucking_loads** - Individual truck loads
11. **conversations** - AI chat conversations
12. **documents** - Uploaded documents
13. **storage_requests** - Storage request records
14. **companies** - Company records for test domains
15. **auth.sessions** - Authentication sessions (cascades automatically)
16. **auth.users** - User accounts

### Storage Files

The script also deletes files from Supabase Storage buckets:
- Trucking documents (manifests, BOLs)
- General documents (PDFs, spreadsheets)

## Foreign Key Constraints

The script respects these FK relationships:

### Parent → Child Cascades

- `storage_requests` → `trucking_loads` (ON DELETE CASCADE)
- `trucking_loads` → `trucking_documents` (ON DELETE CASCADE)
- `companies` → `storage_requests` (ON DELETE CASCADE)
- `shipments` → `shipment_trucks` (ON DELETE CASCADE)
- `shipments` → `dock_appointments` (ON DELETE CASCADE)

### FK References (SET NULL or RESTRICT)

- `inventory.delivery_truck_load_id` → `trucking_loads` (ON DELETE SET NULL)
- `inventory.pickup_truck_load_id` → `trucking_loads` (ON DELETE SET NULL)
- `inventory.storage_area_id` → `racks` (ON DELETE SET NULL)

## RLS Policy Verification

After cleanup, the script does NOT modify any RLS policies. It only deletes data.

To verify RLS policies are intact:

```sql
-- Run this in Supabase SQL Editor
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

Expected policies should remain:
- Customer SELECT policies (view own company data)
- Admin SELECT policies (view all data)
- Admin UPDATE/DELETE policies
- Customer INSERT policies

## Safety Features

1. **Discovery First**: Always shows what will be deleted before deleting
2. **5-Second Abort Window**: Gives you time to abort with Ctrl+C
3. **Service Role Required**: Prevents accidental runs without proper credentials
4. **Explicit Deletion Order**: Respects FK constraints to avoid violations
5. **Verification Phase**: Confirms cleanup was successful
6. **No RLS Modifications**: Only deletes data, never modifies policies

## Troubleshooting

### Error: Missing SUPABASE_SERVICE_ROLE_KEY

```
❌ Missing environment variables:
   SUPABASE_SERVICE_ROLE_KEY: ✗
```

**Solution**: Add the service role key to your `.env` file (see Prerequisites above)

### Error: Foreign key violation

If you get FK errors during cleanup, the script's deletion order may need adjustment.

**Check the error message** to identify which constraint is failing, then:
1. Open `scripts/cleanup-test-users.ts`
2. Adjust the deletion order in `cleanupTestUserData()`
3. Ensure child records are deleted before parent records

### Error: RLS policy violation

If you get RLS errors, ensure you're using the **service_role** key, not the **anon** key.

The service role key bypasses RLS. The anon key does not.

### Some data remains after cleanup

Run the verify phase to see what's left:

```bash
npx tsx scripts/cleanup-test-users.ts verify
```

Review the output to identify:
- Which tables still have data
- Whether it's orphaned data or legitimate data

If orphaned data remains, you may need to:
1. Check for missing FK constraints in the schema
2. Manually delete orphaned records with SQL
3. Update the cleanup script to handle the new table

## Rollback

⚠️ **There is NO automatic rollback for this script!**

The deletions are permanent. Once data is deleted, it cannot be recovered unless you have:
- Database backups
- Point-in-time recovery enabled in Supabase

**Always run the discovery phase first** to confirm you're deleting the right data.

## Database Integrity Checks

After cleanup, run these queries to verify database integrity:

```sql
-- Check for orphaned trucking loads (should return 0 rows)
SELECT tl.id FROM trucking_loads tl
LEFT JOIN storage_requests sr ON tl.storage_request_id = sr.id
WHERE sr.id IS NULL;

-- Check for orphaned inventory (should return 0 rows)
SELECT i.id FROM inventory i
LEFT JOIN companies c ON i.company_id = c.id
WHERE c.id IS NULL;

-- Check for orphaned trucking documents (should return 0 rows)
SELECT td.id FROM trucking_documents td
LEFT JOIN trucking_loads tl ON td.trucking_load_id = tl.id
WHERE tl.id IS NULL;

-- Verify unique constraints are still enforced
SELECT
  storage_request_id,
  direction,
  sequence_number,
  COUNT(*)
FROM trucking_loads
GROUP BY storage_request_id, direction, sequence_number
HAVING COUNT(*) > 1;
-- Should return 0 rows (no duplicates)
```

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review the discovery report to understand what's being deleted
3. Examine the script code in `scripts/cleanup-test-users.ts`
4. Contact the Database Integrity Guardian Agent

## Change Log

- **2025-11-18**: Initial version
  - Comprehensive discovery phase
  - Safe deletion order respecting FK constraints
  - Verification phase
  - Storage file deletion
  - 5-second abort window
