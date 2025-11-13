-- Migration: Add DELETE policy for trucking_documents table
-- Date: 2025-11-06
-- Description: Fixes bug where customers cannot delete their own trucking documents
--              Root cause: Missing DELETE RLS policy and GRANT DELETE permission

-- Add DELETE policy for trucking_documents table
-- This allows customers to delete documents from their own trucking loads
CREATE POLICY "Users can delete own trucking documents"
  ON trucking_documents FOR DELETE
  TO authenticated
  USING (trucking_load_id IN (
    SELECT tl.id FROM trucking_loads tl
    JOIN storage_requests sr ON sr.id = tl.storage_request_id
    JOIN companies c ON c.id = sr.company_id
    WHERE c.domain = split_part(auth.jwt()->>'email', '@', 2)
  ));

-- Grant DELETE permission to authenticated users
GRANT DELETE ON trucking_documents TO authenticated;

-- Note: This complements the existing SELECT and INSERT policies:
-- - "Users can view own trucking documents" (SELECT)
-- - "Users can attach trucking documents" (INSERT)
