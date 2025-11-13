-- Add explicit CASCADE and RESTRICT rules to foreign keys
-- This ensures data integrity when deleting parent records

-- Documents cascade delete when load is deleted
-- (Documents are dependent artifacts)
ALTER TABLE trucking_documents
DROP CONSTRAINT IF EXISTS trucking_documents_trucking_load_id_fkey,
ADD CONSTRAINT trucking_documents_trucking_load_id_fkey
  FOREIGN KEY (trucking_load_id)
  REFERENCES trucking_loads(id)
  ON DELETE CASCADE
  ON UPDATE CASCADE;

-- Loads restrict deletion when storage_request is deleted
-- (Prevents accidental deletion of requests with loads)
ALTER TABLE trucking_loads
DROP CONSTRAINT IF EXISTS trucking_loads_storage_request_id_fkey,
ADD CONSTRAINT trucking_loads_storage_request_id_fkey
  FOREIGN KEY (storage_request_id)
  REFERENCES storage_requests(id)
  ON DELETE RESTRICT
  ON UPDATE CASCADE;

-- Inventory restricts deletion when company is deleted
-- (Prevents accidental deletion of companies with inventory)
ALTER TABLE inventory
DROP CONSTRAINT IF EXISTS inventory_company_id_fkey,
ADD CONSTRAINT inventory_company_id_fkey
  FOREIGN KEY (company_id)
  REFERENCES companies(id)
  ON DELETE RESTRICT
  ON UPDATE CASCADE;

-- Add comments for documentation
COMMENT ON CONSTRAINT trucking_documents_trucking_load_id_fkey ON trucking_documents IS
  'CASCADE: Documents are dependent artifacts. Deleting a load automatically removes its documents.';

COMMENT ON CONSTRAINT trucking_loads_storage_request_id_fkey ON trucking_loads IS
  'RESTRICT: Prevents accidental deletion of requests that have loads. Admin must delete loads first.';

COMMENT ON CONSTRAINT inventory_company_id_fkey ON inventory IS
  'RESTRICT: Prevents accidental deletion of companies that have inventory. Admin must handle cleanup first.';
