# Trucking Documents Delete Fix

## Issue Summary
**Date**: 2025-11-06
**Reported By**: User
**Issue**: Document deletion not working from customer workflow after clicking the "tile upload button"

## Investigation

### Initial Analysis
The user reported that document deletion was not working despite a previous fix (commit 38c204d) that added React Query mutation hooks for proper cache invalidation.

### Document Upload Locations Identified
There are **two** locations where customers can upload documents:

1. **InboundShipmentWizard** (`components/InboundShipmentWizard.tsx`)
   - Used when scheduling a NEW delivery
   - Documents uploaded here are stored in local state during wizard flow
   - Only persisted to database when user completes the wizard (via `uploadDocumentsForShipment()`)
   - Delete function `handleRemoveDocument()` only removes from local state (CORRECT behavior)
   - No bug here

2. **RequestDocumentsPanel** (`components/RequestDocumentsPanel.tsx`)
   - Accessed via "Upload Documents" tile button on dashboard
   - Documents immediately persisted to database on upload
   - Uses `useDeleteTruckingDocument()` mutation hook (added in commit 38c204d)
   - Frontend code is CORRECT
   - **BUT deletion was failing due to database permissions**

### Root Cause Found
The `trucking_documents` table was missing:
1. DELETE RLS (Row Level Security) policy
2. GRANT DELETE permission for authenticated users

**Existing policies** (from `supabase/schema.sql` lines 694-712):
- ✅ "Users can view own trucking documents" (SELECT)
- ✅ "Users can attach trucking documents" (INSERT)
- ❌ **MISSING**: DELETE policy
- ❌ **MISSING**: UPDATE policy (not needed for current features)

**Existing grants** (from `supabase/schema.sql` lines 895-902):
- ✅ GRANT SELECT ON trucking_documents TO authenticated
- ✅ GRANT INSERT ON trucking_documents TO authenticated
- ❌ **MISSING**: GRANT DELETE ON trucking_documents TO authenticated

### Why the Frontend Fix Wasn't Enough
The previous fix (commit 38c204d) correctly implemented:
- React Query mutation hook with proper cache invalidation
- Correct deletion flow in `RequestDocumentsPanel.tsx`
- Proper error handling

However, when `supabase.from('trucking_documents').delete().eq('id', id)` was called, Supabase rejected the request because:
1. No DELETE policy exists to authorize the operation
2. No DELETE grant exists for authenticated users

The error likely appeared in browser console as a Supabase permission error, but users may not have noticed it.

## Solution

### Migration Created
File: `supabase/migrations/20251106000001_add_delete_policy_for_trucking_documents.sql`

The migration adds:

1. **DELETE RLS Policy**:
```sql
CREATE POLICY "Users can delete own trucking documents"
  ON trucking_documents FOR DELETE
  TO authenticated
  USING (trucking_load_id IN (
    SELECT tl.id FROM trucking_loads tl
    JOIN storage_requests sr ON sr.id = tl.storage_request_id
    JOIN companies c ON c.id = sr.company_id
    WHERE c.domain = split_part(auth.jwt()->>'email', '@', 2)
  ));
```

This policy ensures:
- Only authenticated users can delete
- Users can only delete documents from their own company's trucking loads
- Security is maintained via domain matching (same pattern as SELECT/INSERT policies)

2. **DELETE Grant**:
```sql
GRANT DELETE ON trucking_documents TO authenticated;
```

This gives authenticated users the base permission to perform DELETE operations (subject to RLS policy).

### Files Modified
1. ✅ `supabase/migrations/20251106000001_add_delete_policy_for_trucking_documents.sql` (NEW)
2. ✅ `TRUCKING_DOCUMENTS_DELETE_FIX.md` (NEW - this file)

### Files NOT Modified (Already Correct)
- ✅ `components/RequestDocumentsPanel.tsx` - Already has correct delete implementation (from commit 38c204d)
- ✅ `hooks/useSupabaseData.ts` - Already has correct `useDeleteTruckingDocument()` hook (from commit 38c204d)
- ✅ `components/InboundShipmentWizard.tsx` - Delete behavior is correct for wizard context

## Testing Checklist

After applying the migration:

- [ ] Upload a document via "Upload Documents" tile button
- [ ] Click "Delete" button on the uploaded document
- [ ] Confirm deletion in the dialog
- [ ] Verify document disappears from UI immediately
- [ ] Verify no errors in browser console
- [ ] Check Supabase Storage - file should be deleted
- [ ] Check `trucking_documents` table - record should be deleted
- [ ] Test with different company accounts to ensure cross-company deletion is blocked

## Deployment Steps

1. Apply migration to Supabase:
   ```bash
   # If using Supabase CLI
   supabase db push

   # OR manually run the SQL via Supabase Dashboard > SQL Editor
   ```

2. Verify migration:
   ```sql
   -- Check policies
   SELECT * FROM pg_policies WHERE tablename = 'trucking_documents';

   -- Should show 3 policies:
   -- 1. Users can view own trucking documents (SELECT)
   -- 2. Users can attach trucking documents (INSERT)
   -- 3. Users can delete own trucking documents (DELETE)
   ```

3. Test deletion in production/staging

4. Update CHANGELOG.md

## Related Commits
- `38c204d` - "fix: Document delete now properly updates UI with React Query cache invalidation"
- This fix - "fix: Add missing DELETE policy for trucking_documents table"

## Lessons Learned
1. **Frontend + Backend**: Mutation hooks need both correct frontend implementation AND database permissions
2. **RLS Policies**: Always check all CRUD operations (SELECT, INSERT, UPDATE, DELETE) when creating tables
3. **Testing**: Test with actual database, not just TypeScript compilation
4. **Error Visibility**: Supabase permission errors may be silent to users; check browser console

## Security Considerations
The DELETE policy uses the same security pattern as existing SELECT/INSERT policies:
- Domain-based company matching via `split_part(auth.jwt()->>'email', '@', 2)`
- Users can only delete documents from trucking loads belonging to their company
- No cross-company data access
- Maintains existing security model

## Performance Impact
- Minimal: DELETE operations are infrequent compared to SELECT/INSERT
- Policy uses indexed columns (trucking_load_id, storage_request_id, company_id)
- No additional indexes needed
