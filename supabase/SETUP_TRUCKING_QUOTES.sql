-- ============================================================================
-- TRUCKING QUOTES TABLE
-- ============================================================================
-- This table stores MPS trucking quote requests and approvals
-- When customers request MPS to quote trucking, a record is created here
-- MPS admin fills out quote details, customer approves/rejects in their dashboard

-- Create quote status enum
CREATE TYPE IF NOT EXISTS quote_status AS ENUM (
  'PENDING',      -- Waiting for MPS to provide quote
  'QUOTED',       -- MPS has provided quote, waiting for customer approval
  'APPROVED',     -- Customer approved quote
  'REJECTED',     -- Customer rejected quote
  'EXPIRED'       -- Quote expired (not used yet)
);

-- Create trucking quotes table
CREATE TABLE IF NOT EXISTS trucking_quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES storage_requests(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  created_by TEXT NOT NULL,

  -- Quote identification
  quote_number TEXT NOT NULL UNIQUE, -- PV-0001, PV-0002, etc.

  -- Location details
  origin_address TEXT NOT NULL,
  destination_address TEXT NOT NULL,

  -- Quote details (filled by admin)
  quoted_amount NUMERIC(10, 2), -- Price in dollars
  distance_km NUMERIC(10, 2),   -- Distance calculated by admin
  estimated_duration_hours NUMERIC(5, 2), -- Estimated transit time
  admin_notes TEXT,             -- Internal notes from MPS admin
  customer_notes TEXT,          -- Notes from customer when requesting quote

  -- Status tracking
  status quote_status NOT NULL DEFAULT 'PENDING',

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  quoted_at TIMESTAMPTZ,        -- When admin provided quote
  approved_at TIMESTAMPTZ,      -- When customer approved
  rejected_at TIMESTAMPTZ,      -- When customer rejected
  rejection_reason TEXT         -- Why customer rejected (optional)
);

-- Indexes for faster queries
CREATE INDEX idx_trucking_quotes_request ON trucking_quotes(request_id);
CREATE INDEX idx_trucking_quotes_company ON trucking_quotes(company_id);
CREATE INDEX idx_trucking_quotes_status ON trucking_quotes(status);
CREATE INDEX idx_trucking_quotes_quote_number ON trucking_quotes(quote_number);

-- Trigger for updated_at
CREATE TRIGGER update_trucking_quotes_updated_at BEFORE UPDATE ON trucking_quotes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security
ALTER TABLE trucking_quotes ENABLE ROW LEVEL SECURITY;

-- Users can view their own company's quotes
CREATE POLICY "Users can view own company quotes"
  ON trucking_quotes FOR SELECT
  TO authenticated
  USING (company_id IN (
    SELECT id FROM companies WHERE domain = split_part(auth.jwt()->>'email', '@', 2)
  ));

-- Users can insert quotes for their own company
CREATE POLICY "Users can create quotes for own company"
  ON trucking_quotes FOR INSERT
  TO authenticated
  WITH CHECK (company_id IN (
    SELECT id FROM companies WHERE domain = split_part(auth.jwt()->>'email', '@', 2)
  ));

-- Users can update their own company's quotes (for approval/rejection)
CREATE POLICY "Users can update own company quotes"
  ON trucking_quotes FOR UPDATE
  TO authenticated
  USING (company_id IN (
    SELECT id FROM companies WHERE domain = split_part(auth.jwt()->>'email', '@', 2)
  ));

-- Grant access
GRANT SELECT, INSERT, UPDATE ON trucking_quotes TO authenticated;

-- Enable realtime for quote updates
ALTER PUBLICATION supabase_realtime ADD TABLE trucking_quotes;

-- Comments
COMMENT ON TABLE trucking_quotes IS 'MPS trucking quote requests and approvals';
COMMENT ON COLUMN trucking_quotes.quote_number IS 'Unique quote identifier (PV-0001, PV-0002, etc.)';
COMMENT ON COLUMN trucking_quotes.status IS 'Current status: PENDING → QUOTED → APPROVED/REJECTED';
