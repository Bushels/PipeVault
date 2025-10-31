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
GRANT SELECT ON conversations TO authenticated;

-- Grant access to anon users (for public endpoints)
GRANT SELECT ON companies TO anon;

COMMENT ON TABLE companies IS 'Customer companies using PipeVault';
COMMENT ON TABLE storage_requests IS 'Pipe storage requests from customers';
COMMENT ON TABLE inventory IS 'Current pipe inventory in storage';
COMMENT ON TABLE truck_loads IS 'Delivery and pickup truck load tracking';
COMMENT ON TABLE conversations IS 'AI chat conversation history';
COMMENT ON TABLE documents IS 'Uploaded documents (PDFs, photos)';
COMMENT ON TABLE notifications IS 'Admin notification queue';
