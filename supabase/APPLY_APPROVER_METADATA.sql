-- Add metadata columns for admin approvals
ALTER TABLE storage_requests
  ADD COLUMN IF NOT EXISTS approved_by TEXT,
  ADD COLUMN IF NOT EXISTS internal_notes TEXT;

-- Backfill NULLs explicitly (optional safety for existing rows)
UPDATE storage_requests
SET approved_by = approved_by, internal_notes = internal_notes;
