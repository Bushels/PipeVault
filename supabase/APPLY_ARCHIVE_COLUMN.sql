-- Add archived_at column to storage_requests table
-- This enables the archive functionality for customer request cards

-- Add the column if it doesn't exist
ALTER TABLE storage_requests
ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

-- Optional: Add index for faster filtering of archived requests
CREATE INDEX IF NOT EXISTS idx_requests_archived
ON storage_requests(archived_at)
WHERE archived_at IS NOT NULL;

-- Verify the column was added
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'storage_requests'
AND column_name = 'archived_at';
