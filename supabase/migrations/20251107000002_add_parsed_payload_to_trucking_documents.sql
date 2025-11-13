-- Add parsed_payload column to trucking_documents table
-- This stores AI-extracted manifest data from document processing
-- Data structure: ManifestItem[] (array of JSON objects)

ALTER TABLE trucking_documents
ADD COLUMN parsed_payload JSONB;

-- Add a comment explaining the column
COMMENT ON COLUMN trucking_documents.parsed_payload IS 'AI-extracted manifest data from document processing. Array of ManifestItem objects with fields: manufacturer, heat_number, serial_number, tally_length_ft, quantity, grade, outer_diameter, weight_lbs_ft';

-- Create an index for faster JSONB queries (optional, but helpful for future analytics)
CREATE INDEX IF NOT EXISTS idx_trucking_documents_parsed_payload
ON trucking_documents USING GIN (parsed_payload);

-- Example data structure stored in parsed_payload:
-- [
--   {
--     "manufacturer": "Tenaris",
--     "heat_number": "H12345",
--     "serial_number": "TNS-001",
--     "tally_length_ft": 31.2,
--     "quantity": 1,
--     "grade": "L80",
--     "outer_diameter": 5.5,
--     "weight_lbs_ft": 23.0
--   }
-- ]
