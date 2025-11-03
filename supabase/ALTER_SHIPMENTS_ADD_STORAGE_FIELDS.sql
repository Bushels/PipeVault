-- ============================================================================
-- ALTER SHIPMENTS TABLE - Add Storage Yard Fields
-- ============================================================================
-- This migration adds fields for storage yard information to the shipments table
-- Separates storage location from trucking company details

-- Add storage yard fields
ALTER TABLE shipments
  ADD COLUMN IF NOT EXISTS storage_company_name TEXT,
  ADD COLUMN IF NOT EXISTS storage_yard_address TEXT,
  ADD COLUMN IF NOT EXISTS storage_contact_name TEXT,
  ADD COLUMN IF NOT EXISTS storage_contact_email TEXT,
  ADD COLUMN IF NOT EXISTS storage_contact_phone TEXT;

-- Add driver fields
ALTER TABLE shipments
  ADD COLUMN IF NOT EXISTS driver_name TEXT,
  ADD COLUMN IF NOT EXISTS driver_phone TEXT;

-- Add scheduled slot fields
ALTER TABLE shipments
  ADD COLUMN IF NOT EXISTS scheduled_slot_start TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS scheduled_slot_end TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS is_after_hours BOOLEAN DEFAULT FALSE;

-- Add load summary fields (from AI extraction)
ALTER TABLE shipments
  ADD COLUMN IF NOT EXISTS total_joints INTEGER,
  ADD COLUMN IF NOT EXISTS total_length_ft NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS total_length_m NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS total_weight_lbs NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS total_weight_kg NUMERIC(12, 2);

-- Add quote reference (if MPS trucking was requested)
ALTER TABLE shipments
  ADD COLUMN IF NOT EXISTS trucking_quote_id UUID REFERENCES trucking_quotes(id) ON DELETE SET NULL;

-- Create index for quote lookups
CREATE INDEX IF NOT EXISTS idx_shipments_quote ON shipments(trucking_quote_id);

-- Comments
COMMENT ON COLUMN shipments.storage_company_name IS 'Name of company where pipe is currently stored';
COMMENT ON COLUMN shipments.storage_yard_address IS 'Full address of storage yard for pickup';
COMMENT ON COLUMN shipments.trucking_company_name IS 'Name of trucking company handling transport';
COMMENT ON COLUMN shipments.driver_name IS 'Name of driver delivering the load';
COMMENT ON COLUMN shipments.driver_phone IS 'Driver contact phone number';
COMMENT ON COLUMN shipments.trucking_quote_id IS 'Reference to MPS trucking quote if applicable';
COMMENT ON COLUMN shipments.total_joints IS 'AI-extracted total joint count from manifest';
COMMENT ON COLUMN shipments.total_length_ft IS 'AI-extracted total length in feet';
COMMENT ON COLUMN shipments.total_weight_lbs IS 'AI-extracted total weight in pounds';
