-- PipeVault Database Schema
-- Run this in Supabase SQL Editor to create all tables

-- ============================================================================
-- COMPANIES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  domain TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- STORAGE REQUESTS TABLE
-- ============================================================================
CREATE TYPE request_status AS ENUM (
  'DRAFT',
  'PENDING',
  'APPROVED',
  'REJECTED',
  'COMPLETED'
);

CREATE TABLE IF NOT EXISTS storage_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  user_email TEXT NOT NULL,
  reference_id TEXT NOT NULL,
  status request_status DEFAULT 'DRAFT',

  -- Request details (JSONB for flexibility)
  request_details JSONB,
  trucking_info JSONB,

  -- Assignments
  assigned_location TEXT,
  assigned_rack_ids TEXT[],

  -- AI generated summary
  approval_summary TEXT,
  rejection_reason TEXT,
  archived_at TIMESTAMPTZ,

  -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    approved_at TIMESTAMPTZ,
    approved_by TEXT,
    rejected_at TIMESTAMPTZ,
    internal_notes TEXT
  );

-- Index for faster queries
CREATE INDEX idx_requests_company ON storage_requests(company_id);
CREATE INDEX idx_requests_status ON storage_requests(status);
CREATE INDEX idx_requests_reference ON storage_requests(reference_id);

-- ============================================================================
-- PIPE INVENTORY TABLE
-- ============================================================================
CREATE TYPE pipe_type AS ENUM ('Drill Pipe', 'Casing', 'Tubing', 'Line Pipe');
CREATE TYPE pipe_status AS ENUM ('PENDING_DELIVERY', 'IN_STORAGE', 'PICKED_UP', 'IN_TRANSIT');

CREATE TABLE IF NOT EXISTS inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  request_id UUID REFERENCES storage_requests(id) ON DELETE SET NULL,
  reference_id TEXT NOT NULL,

  -- Pipe specifications
  type pipe_type NOT NULL,
  grade TEXT NOT NULL,
  outer_diameter NUMERIC(10, 3) NOT NULL,
  weight NUMERIC(10, 2) NOT NULL,
  length NUMERIC(10, 2) NOT NULL,
  quantity INTEGER NOT NULL,
  status pipe_status DEFAULT 'PENDING_DELIVERY',

  -- Tracking
  drop_off_timestamp TIMESTAMPTZ,
  pickup_timestamp TIMESTAMPTZ,
  storage_area_id TEXT,

  -- Well assignment (for pickups)
  assigned_uwi TEXT,
  assigned_well_name TEXT,

  -- Truck load references
  delivery_truck_load_id UUID,
  pickup_truck_load_id UUID,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_inventory_company ON inventory(company_id);
CREATE INDEX idx_inventory_reference ON inventory(reference_id);
CREATE INDEX idx_inventory_status ON inventory(status);
CREATE INDEX idx_inventory_storage_area ON inventory(storage_area_id);

-- ============================================================================
-- TRUCK LOADS TABLE
-- ============================================================================
CREATE TYPE truck_load_type AS ENUM ('DELIVERY', 'PICKUP');

CREATE TABLE IF NOT EXISTS truck_loads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type truck_load_type NOT NULL,

  -- Truck and driver info
  trucking_company TEXT NOT NULL,
  driver_name TEXT NOT NULL,
  driver_phone TEXT,

  -- Timing
  arrival_time TIMESTAMPTZ NOT NULL,
  departure_time TIMESTAMPTZ,

  -- Load details
  joints_count INTEGER NOT NULL,
  storage_area_id TEXT,

  -- Relations
  related_request_id UUID REFERENCES storage_requests(id) ON DELETE SET NULL,
  related_pipe_ids UUID[],

  -- For pickups
  assigned_uwi TEXT,
  assigned_well_name TEXT,

  -- Additional info
  notes TEXT,
  photo_urls TEXT[],

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_truck_loads_type ON truck_loads(type);
CREATE INDEX idx_truck_loads_arrival ON truck_loads(arrival_time);
CREATE INDEX idx_truck_loads_request ON truck_loads(related_request_id);

-- ============================================================================
-- SHIPMENTS
-- ============================================================================

CREATE TYPE IF NOT EXISTS shipment_status AS ENUM (
  'DRAFT',
  'SCHEDULING',
  'SCHEDULED',
  'IN_TRANSIT',
  'RECEIVED',
  'CANCELLED'
);

CREATE TYPE IF NOT EXISTS trucking_method AS ENUM (
  'MPS_QUOTE',
  'CUSTOMER_PROVIDED'
);

CREATE TYPE IF NOT EXISTS shipment_truck_status AS ENUM (
  'PENDING',
  'SCHEDULED',
  'INBOUND',
  'ON_SITE',
  'RECEIVED',
  'CANCELLED'
);

CREATE TYPE IF NOT EXISTS appointment_status AS ENUM (
  'PENDING',
  'CONFIRMED',
  'COMPLETED',
  'CANCELLED'
);

CREATE TYPE IF NOT EXISTS manifest_document_status AS ENUM (
  'UPLOADED',
  'PROCESSING',
  'PARSED',
  'FAILED',
  'APPROVED'
);

CREATE TYPE IF NOT EXISTS shipment_item_status AS ENUM (
  'IN_TRANSIT',
  'IN_STORAGE',
  'MISSING',
  'DAMAGED'
);

CREATE TABLE IF NOT EXISTS shipments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES storage_requests(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  created_by TEXT NOT NULL,
  status shipment_status NOT NULL DEFAULT 'DRAFT',
  trucking_method trucking_method NOT NULL,
  trucking_company TEXT,
  trucking_contact_name TEXT,
  trucking_contact_phone TEXT,
  trucking_contact_email TEXT,
  number_of_trucks INTEGER NOT NULL DEFAULT 1 CHECK (number_of_trucks > 0),
  estimated_joint_count INTEGER,
  estimated_total_length_ft NUMERIC(12, 2),
  special_instructions TEXT,
  surcharge_applicable BOOLEAN DEFAULT FALSE,
  surcharge_amount NUMERIC(10, 2) DEFAULT 0,
  documents_status TEXT,
  calendar_sync_status TEXT DEFAULT 'PENDING',
  latest_customer_notification_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_shipments_request ON shipments(request_id);
CREATE INDEX idx_shipments_company ON shipments(company_id);
CREATE INDEX idx_shipments_status ON shipments(status);

CREATE TABLE IF NOT EXISTS shipment_trucks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id UUID NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
  sequence_number INTEGER NOT NULL DEFAULT 1,
  status shipment_truck_status NOT NULL DEFAULT 'PENDING',
  trucking_company TEXT,
  contact_name TEXT,
  contact_phone TEXT,
  contact_email TEXT,
  scheduled_slot_start TIMESTAMPTZ,
  scheduled_slot_end TIMESTAMPTZ,
  arrival_time TIMESTAMPTZ,
  departure_time TIMESTAMPTZ,
  joints_count INTEGER,
  total_length_ft NUMERIC(12, 2),
  manifest_received BOOLEAN DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (shipment_id, sequence_number)
);

CREATE INDEX idx_shipment_trucks_shipment ON shipment_trucks(shipment_id);
CREATE INDEX idx_shipment_trucks_status ON shipment_trucks(status);

CREATE TABLE IF NOT EXISTS dock_appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id UUID NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
  truck_id UUID REFERENCES shipment_trucks(id) ON DELETE SET NULL,
  slot_start TIMESTAMPTZ NOT NULL,
  slot_end TIMESTAMPTZ NOT NULL,
  after_hours BOOLEAN DEFAULT FALSE,
  surcharge_applied BOOLEAN DEFAULT FALSE,
  status appointment_status NOT NULL DEFAULT 'PENDING',
  calendar_event_id TEXT,
  calendar_sync_status TEXT DEFAULT 'PENDING',
  reminder_24h_sent_at TIMESTAMPTZ,
  reminder_1h_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX dock_appointments_unique_active_slot
  ON dock_appointments(slot_start)
  WHERE status IN ('PENDING', 'CONFIRMED');

CREATE INDEX idx_dock_appointments_shipment ON dock_appointments(shipment_id);
CREATE INDEX idx_dock_appointments_status ON dock_appointments(status);

CREATE TABLE IF NOT EXISTS shipment_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id UUID NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
  truck_id UUID REFERENCES shipment_trucks(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL,
  status manifest_document_status NOT NULL DEFAULT 'UPLOADED',
  parsed_payload JSONB,
  processing_notes TEXT,
  uploaded_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_shipment_documents_shipment ON shipment_documents(shipment_id);
CREATE INDEX idx_shipment_documents_truck ON shipment_documents(truck_id);
CREATE INDEX idx_shipment_documents_status ON shipment_documents(status);

CREATE TABLE IF NOT EXISTS shipment_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id UUID NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
  truck_id UUID REFERENCES shipment_trucks(id) ON DELETE SET NULL,
  document_id UUID REFERENCES shipment_documents(id) ON DELETE SET NULL,
  inventory_id UUID REFERENCES inventory(id) ON DELETE SET NULL,
  manufacturer TEXT,
  heat_number TEXT,
  serial_number TEXT,
  tally_length_ft NUMERIC(12, 3),
  quantity INTEGER DEFAULT 1,
  status shipment_item_status NOT NULL DEFAULT 'IN_TRANSIT',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_shipment_items_shipment ON shipment_items(shipment_id);
CREATE INDEX idx_shipment_items_truck ON shipment_items(truck_id);
CREATE INDEX idx_shipment_items_status ON shipment_items(status);

ALTER TABLE inventory
  ADD COLUMN IF NOT EXISTS manifest_item_id UUID REFERENCES shipment_items(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_inventory_manifest_item ON inventory(manifest_item_id);

-- ============================================================================
-- CONVERSATIONS TABLE (for AI chat history)
-- ============================================================================
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- User identification
  user_email TEXT NOT NULL,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  reference_id TEXT,

  -- Related entities
  request_id UUID REFERENCES storage_requests(id) ON DELETE CASCADE,

  -- Conversation data
  messages JSONB NOT NULL DEFAULT '[]',

  -- Metadata
  conversation_type TEXT, -- 'storage_request', 'delivery_schedule', 'pickup_request', 'query'
  is_completed BOOLEAN DEFAULT FALSE,

  -- Timestamps
  started_at TIMESTAMPTZ DEFAULT NOW(),
  last_message_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX idx_conversations_user ON conversations(user_email);
CREATE INDEX idx_conversations_company ON conversations(company_id);
CREATE INDEX idx_conversations_request ON conversations(request_id);

-- ============================================================================
-- DOCUMENTS TABLE (uploaded PDFs and files)
-- ============================================================================
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Relations
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  request_id UUID REFERENCES storage_requests(id) ON DELETE CASCADE,
  inventory_id UUID REFERENCES inventory(id) ON DELETE SET NULL,

  -- File info
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  storage_path TEXT NOT NULL, -- Path in Supabase Storage

  -- AI extracted data
  extracted_data JSONB,
  is_processed BOOLEAN DEFAULT FALSE,

  -- Timestamps
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX idx_documents_company ON documents(company_id);
CREATE INDEX idx_documents_request ON documents(request_id);
CREATE INDEX idx_documents_inventory ON documents(inventory_id);

-- ============================================================================
-- YARD DATA TABLE (storage capacity tracking)
-- ============================================================================
CREATE TABLE IF NOT EXISTS yards (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS yard_areas (
  id TEXT PRIMARY KEY,
  yard_id TEXT REFERENCES yards(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS racks (
  id TEXT PRIMARY KEY,
  area_id TEXT REFERENCES yard_areas(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  capacity INTEGER NOT NULL DEFAULT 200,
  capacity_meters NUMERIC(10, 2) NOT NULL DEFAULT 2400,
  occupied INTEGER NOT NULL DEFAULT 0,
  occupied_meters NUMERIC(10, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_racks_area ON racks(area_id);

-- ============================================================================
-- ADMIN USERS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  role TEXT DEFAULT 'admin',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster admin lookups
CREATE INDEX IF NOT EXISTS idx_admin_users_user_id ON admin_users(user_id);

-- ============================================================================
-- NOTIFICATIONS TABLE (for admin alerts)
-- ============================================================================
CREATE TYPE notification_type AS ENUM (
  'NEW_REQUEST',
  'DELIVERY_SCHEDULED',
  'PICKUP_SCHEDULED',
  'URGENT_REQUEST',
  'CUSTOMER_MESSAGE'
);

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type notification_type NOT NULL,

  -- Target admin (null = all admins)
  admin_user_id UUID REFERENCES admin_users(id) ON DELETE CASCADE,

  -- Notification content
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  link TEXT,

  -- Related entity
  request_id UUID REFERENCES storage_requests(id) ON DELETE CASCADE,

  -- Status
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_notifications_admin ON notifications(admin_user_id);
CREATE INDEX idx_notifications_read ON notifications(is_read);
CREATE INDEX idx_notifications_created ON notifications(created_at);

-- ============================================================================
-- FUNCTIONS AND TRIGGERS
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to tables
CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON companies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_requests_updated_at BEFORE UPDATE ON storage_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_inventory_updated_at BEFORE UPDATE ON inventory
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_truck_loads_updated_at BEFORE UPDATE ON truck_loads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_shipments_updated_at BEFORE UPDATE ON shipments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_shipment_trucks_updated_at BEFORE UPDATE ON shipment_trucks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_dock_appointments_updated_at BEFORE UPDATE ON dock_appointments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_shipment_documents_updated_at BEFORE UPDATE ON shipment_documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_shipment_items_updated_at BEFORE UPDATE ON shipment_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_racks_updated_at BEFORE UPDATE ON racks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_admin_users_updated_at BEFORE UPDATE ON admin_users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE storage_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE truck_loads ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipment_trucks ENABLE ROW LEVEL SECURITY;
ALTER TABLE dock_appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipment_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipment_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Public can read companies (for signup)
CREATE POLICY "Anyone can read companies"
  ON companies FOR SELECT
  TO public
  USING (true);

-- Users can only see their own company's data
CREATE POLICY "Users can view own company requests"
  ON storage_requests FOR SELECT
  TO authenticated
  USING (company_id IN (
    SELECT id FROM companies WHERE domain = split_part(auth.jwt()->>'email', '@', 2)
  ));

CREATE POLICY "Users can view own company inventory"
  ON inventory FOR SELECT
  TO authenticated
  USING (company_id IN (
    SELECT id FROM companies WHERE domain = split_part(auth.jwt()->>'email', '@', 2)
  ));

CREATE POLICY "Users can view own company shipments"
  ON shipments FOR SELECT
  TO authenticated
  USING (company_id IN (
    SELECT id FROM companies WHERE domain = split_part(auth.jwt()->>'email', '@', 2)
  ));

CREATE POLICY "Users can view own company shipment trucks"
  ON shipment_trucks FOR SELECT
  TO authenticated
  USING (shipment_id IN (
    SELECT s.id FROM shipments s
    WHERE s.company_id IN (
      SELECT id FROM companies WHERE domain = split_part(auth.jwt()->>'email', '@', 2)
    )
  ));

CREATE POLICY "Users can view own company appointments"
  ON dock_appointments FOR SELECT
  TO authenticated
  USING (shipment_id IN (
    SELECT s.id FROM shipments s
    WHERE s.company_id IN (
      SELECT id FROM companies WHERE domain = split_part(auth.jwt()->>'email', '@', 2)
    )
  ));

CREATE POLICY "Users can view own shipment documents"
  ON shipment_documents FOR SELECT
  TO authenticated
  USING (shipment_id IN (
    SELECT s.id FROM shipments s
    WHERE s.company_id IN (
      SELECT id FROM companies WHERE domain = split_part(auth.jwt()->>'email', '@', 2)
    )
  ));

CREATE POLICY "Users can view own shipment items"
  ON shipment_items FOR SELECT
  TO authenticated
  USING (shipment_id IN (
    SELECT s.id FROM shipments s
    WHERE s.company_id IN (
      SELECT id FROM companies WHERE domain = split_part(auth.jwt()->>'email', '@', 2)
    )
  ));

CREATE POLICY "Users can view own conversations"
  ON conversations FOR SELECT
  TO authenticated
  USING (user_email = auth.jwt()->>'email');

-- Admins can see everything (you'll set this up with a custom claim)
-- For now, we'll use service role key for admin operations

-- ============================================================================
-- SEED DATA (initial yards)
-- ============================================================================

-- Insert yards
INSERT INTO yards (id, name) VALUES
  ('A', 'Yard A (Open Storage)'),
  ('B', 'Yard B (Fenced Storage)'),
  ('C', 'Yard C (Cold Storage)')
ON CONFLICT (id) DO NOTHING;

-- Insert areas for each yard
INSERT INTO yard_areas (id, yard_id, name) VALUES
  ('A-N', 'A', 'North'),
  ('A-E', 'A', 'East'),
  ('A-S', 'A', 'South'),
  ('A-W', 'A', 'West'),
  ('A-M', 'A', 'Middle'),
  ('B-N', 'B', 'North'),
  ('B-E', 'B', 'East'),
  ('B-S', 'B', 'South'),
  ('B-W', 'B', 'West'),
  ('B-M', 'B', 'Middle'),
  ('C-N', 'C', 'North'),
  ('C-E', 'C', 'East'),
  ('C-S', 'C', 'South'),
  ('C-W', 'C', 'West'),
  ('C-M', 'C', 'Middle')
ON CONFLICT (id) DO NOTHING;

-- Insert racks (9 per area)
DO $$
DECLARE
  area_record RECORD;
  i INTEGER;
BEGIN
  FOR area_record IN SELECT id, yard_id FROM yard_areas LOOP
    FOR i IN 1..9 LOOP
      INSERT INTO racks (id, area_id, name)
      VALUES (
        area_record.id || '-' || i,
        area_record.id,
        'Rack ' || i
      )
      ON CONFLICT (id) DO NOTHING;
    END LOOP;
  END LOOP;
END $$;

-- ============================================================================
-- REALTIME PUBLICATION (for admin notifications)
-- ============================================================================

-- Enable realtime for specific tables
ALTER PUBLICATION supabase_realtime ADD TABLE storage_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE inventory;
ALTER PUBLICATION supabase_realtime ADD TABLE shipments;
ALTER PUBLICATION supabase_realtime ADD TABLE shipment_trucks;
ALTER PUBLICATION supabase_realtime ADD TABLE dock_appointments;
ALTER PUBLICATION supabase_realtime ADD TABLE shipment_documents;
ALTER PUBLICATION supabase_realtime ADD TABLE shipment_items;

-- ============================================================================
-- VIEWS (helpful queries)
-- ============================================================================

-- View: Current inventory summary
CREATE OR REPLACE VIEW inventory_summary AS
SELECT
  i.company_id,
  c.name as company_name,
  i.reference_id,
  COUNT(*) as pipe_groups,
  SUM(i.quantity) as total_joints,
  SUM(i.quantity * i.length) as total_length_meters,
  COUNT(*) FILTER (WHERE i.status = 'IN_STORAGE') as active_groups,
  SUM(i.quantity) FILTER (WHERE i.status = 'IN_STORAGE') as active_joints
FROM inventory i
JOIN companies c ON i.company_id = c.id
GROUP BY i.company_id, c.name, i.reference_id;

-- View: Pending approvals
CREATE OR REPLACE VIEW pending_approvals AS
SELECT
  sr.*,
  c.name as company_name,
  COUNT(d.id) as document_count
FROM storage_requests sr
JOIN companies c ON sr.company_id = c.id
LEFT JOIN documents d ON sr.id = d.request_id
WHERE sr.status = 'PENDING'
GROUP BY sr.id, c.name
ORDER BY sr.created_at ASC;

-- View: Yard capacity
CREATE OR REPLACE VIEW yard_capacity AS
SELECT
  y.id as yard_id,
  y.name as yard_name,
  ya.id as area_id,
  ya.name as area_name,
  COUNT(r.id) as total_racks,
  SUM(r.capacity) as total_capacity_joints,
  SUM(r.occupied) as total_occupied_joints,
  SUM(r.capacity_meters) as total_capacity_meters,
  SUM(r.occupied_meters) as total_occupied_meters,
  ROUND((SUM(r.occupied)::NUMERIC / NULLIF(SUM(r.capacity), 0) * 100), 2) as occupancy_percentage
FROM yards y
JOIN yard_areas ya ON y.id = ya.yard_id
JOIN racks r ON ya.id = r.area_id
GROUP BY y.id, y.name, ya.id, ya.name;

-- ============================================================================
-- GRANTS (permissions)
-- ============================================================================

-- Grant access to authenticated users
GRANT SELECT ON companies TO authenticated;
GRANT SELECT ON storage_requests TO authenticated;
GRANT SELECT ON inventory TO authenticated;
GRANT SELECT ON shipments TO authenticated;
GRANT SELECT ON shipment_trucks TO authenticated;
GRANT SELECT ON dock_appointments TO authenticated;
GRANT SELECT ON shipment_documents TO authenticated;
GRANT SELECT ON shipment_items TO authenticated;
GRANT SELECT ON conversations TO authenticated;

-- Grant access to anon users (for public endpoints)
GRANT SELECT ON companies TO anon;

COMMENT ON TABLE companies IS 'Customer companies using PipeVault';
COMMENT ON TABLE storage_requests IS 'Pipe storage requests from customers';
COMMENT ON TABLE inventory IS 'Current pipe inventory in storage';
COMMENT ON TABLE truck_loads IS 'Delivery and pickup truck load tracking';
COMMENT ON TABLE shipments IS 'Inbound shipping workflow records per request';
COMMENT ON TABLE shipment_trucks IS 'Individual truck loads associated with shipments';
COMMENT ON TABLE dock_appointments IS 'Scheduled dock appointments and calendar sync data';
COMMENT ON TABLE shipment_documents IS 'Uploaded shipping/manifest documents';
COMMENT ON TABLE shipment_items IS 'Parsed manifest entries for inbound pipe';
COMMENT ON TABLE conversations IS 'AI chat conversation history';
COMMENT ON TABLE documents IS 'Uploaded documents (PDFs, photos)';
COMMENT ON TABLE notifications IS 'Admin notification queue';
