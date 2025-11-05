-- Migration: Create email_failures tracking table
-- Purpose: Track email notification failures for debugging and retry logic (Critical Issue #5)
-- Date: 2025-11-05
--
-- This table logs all failed email attempts to enable:
-- 1. Debugging email delivery issues
-- 2. Automatic retry mechanism via Edge Functions
-- 3. Monitoring email service health
-- 4. Audit trail for compliance

-- Create email_failures table
CREATE TABLE IF NOT EXISTS email_failures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_email TEXT NOT NULL,
  email_type TEXT NOT NULL, -- 'storage_request', 'trucking_load', 'shipment', etc.
  related_id UUID, -- ID of the related entity (storage_request_id, trucking_load_id, etc.)
  error_message TEXT NOT NULL,
  error_code TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  last_retry_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB -- Store email template data for retry
);

-- Add indexes for common queries
CREATE INDEX idx_email_failures_recipient ON email_failures(recipient_email);
CREATE INDEX idx_email_failures_type ON email_failures(email_type);
CREATE INDEX idx_email_failures_created_at ON email_failures(created_at DESC);
CREATE INDEX idx_email_failures_unresolved ON email_failures(resolved_at) WHERE resolved_at IS NULL;
CREATE INDEX idx_email_failures_related_id ON email_failures(related_id) WHERE related_id IS NOT NULL;

-- Add constraint to ensure retry_count is non-negative
ALTER TABLE email_failures
ADD CONSTRAINT email_failures_retry_count_check
CHECK (retry_count >= 0);

-- Add constraint to ensure valid email types
ALTER TABLE email_failures
ADD CONSTRAINT email_failures_type_check
CHECK (email_type IN (
  'storage_request_submitted',
  'storage_request_approved',
  'storage_request_rejected',
  'trucking_load_scheduled',
  'trucking_load_completed',
  'shipment_scheduled',
  'shipment_completed',
  'user_signup',
  'other'
));

-- Enable RLS on email_failures (admin-only access)
ALTER TABLE email_failures ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Only admins can view email failures
CREATE POLICY "Admins can view all email failures"
ON email_failures
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM admin_users
    WHERE admin_users.email = auth.jwt() ->> 'email'
  )
);

-- RLS Policy: Service role can insert email failures (for Edge Functions)
CREATE POLICY "Service role can insert email failures"
ON email_failures
FOR INSERT
TO service_role
WITH CHECK (true);

-- RLS Policy: Service role can update email failures (for retry mechanism)
CREATE POLICY "Service role can update email failures"
ON email_failures
FOR UPDATE
TO service_role
USING (true);

-- Add comments for documentation
COMMENT ON TABLE email_failures IS 'Tracks failed email notification attempts for debugging and retry logic';
COMMENT ON COLUMN email_failures.recipient_email IS 'Email address that failed to receive notification';
COMMENT ON COLUMN email_failures.email_type IS 'Type of email that failed (e.g., storage_request_submitted)';
COMMENT ON COLUMN email_failures.related_id IS 'UUID of the related entity (storage_request_id, trucking_load_id, etc.)';
COMMENT ON COLUMN email_failures.retry_count IS 'Number of retry attempts made';
COMMENT ON COLUMN email_failures.resolved_at IS 'Timestamp when the email was successfully delivered after retry';
COMMENT ON COLUMN email_failures.metadata IS 'JSON data for email template (used for retry attempts)';

-- Create a function to log email failures (called from Edge Functions)
CREATE OR REPLACE FUNCTION log_email_failure(
  p_recipient_email TEXT,
  p_email_type TEXT,
  p_related_id UUID,
  p_error_message TEXT,
  p_error_code TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_failure_id UUID;
BEGIN
  INSERT INTO email_failures (
    recipient_email,
    email_type,
    related_id,
    error_message,
    error_code,
    metadata
  ) VALUES (
    p_recipient_email,
    p_email_type,
    p_related_id,
    p_error_message,
    p_error_code,
    p_metadata
  ) RETURNING id INTO v_failure_id;

  RETURN v_failure_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp;

-- Create a function to mark email failure as resolved
CREATE OR REPLACE FUNCTION resolve_email_failure(p_failure_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE email_failures
  SET resolved_at = now()
  WHERE id = p_failure_id
    AND resolved_at IS NULL;

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp;

-- Grant execute permissions to service role
GRANT EXECUTE ON FUNCTION log_email_failure TO service_role;
GRANT EXECUTE ON FUNCTION resolve_email_failure TO service_role;

-- Verify table was created successfully
SELECT
  table_name,
  (SELECT count(*) FROM information_schema.columns WHERE table_name = 'email_failures') as column_count,
  (SELECT count(*) FROM pg_indexes WHERE tablename = 'email_failures') as index_count
FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'email_failures';
