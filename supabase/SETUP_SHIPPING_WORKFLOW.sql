-- ============================================================================
-- PIPEVAULT SHIPPING WORKFLOW SETUP
-- Creates tables, enums, indexes, and policies to support shipment scheduling,
-- truck management, dock appointments, and manifest ingestion.
-- ============================================================================

DO $$ BEGIN
  CREATE TYPE shipment_status AS ENUM (
    'DRAFT',
    'SCHEDULING',
    'SCHEDULED',
    'IN_TRANSIT',
    'RECEIVED',
    'CANCELLED'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE trucking_method AS ENUM (
    'MPS_QUOTE',
    'CUSTOMER_PROVIDED'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE shipment_truck_status AS ENUM (
    'PENDING',
    'SCHEDULED',
    'INBOUND',
    'ON_SITE',
    'RECEIVED',
    'CANCELLED'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE appointment_status AS ENUM (
    'PENDING',
    'CONFIRMED',
    'COMPLETED',
    'CANCELLED'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE manifest_document_status AS ENUM (
    'UPLOADED',
    'PROCESSING',
    'PARSED',
    'FAILED',
    'APPROVED'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE shipment_item_status AS ENUM (
    'IN_TRANSIT',
    'IN_STORAGE',
    'MISSING',
    'DAMAGED'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- SHIPMENTS
-- ============================================================================
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

CREATE INDEX IF NOT EXISTS idx_shipments_request ON shipments(request_id);
CREATE INDEX IF NOT EXISTS idx_shipments_company ON shipments(company_id);
CREATE INDEX IF NOT EXISTS idx_shipments_status ON shipments(status);

-- ============================================================================
-- SHIPMENT TRUCKS
-- ============================================================================
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

CREATE INDEX IF NOT EXISTS idx_shipment_trucks_shipment ON shipment_trucks(shipment_id);
CREATE INDEX IF NOT EXISTS idx_shipment_trucks_status ON shipment_trucks(status);

-- ============================================================================
-- DOCK APPOINTMENTS
-- ============================================================================
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

CREATE UNIQUE INDEX IF NOT EXISTS dock_appointments_unique_active_slot
  ON dock_appointments(slot_start)
  WHERE status IN ('PENDING', 'CONFIRMED');

CREATE INDEX IF NOT EXISTS idx_dock_appointments_shipment ON dock_appointments(shipment_id);
CREATE INDEX IF NOT EXISTS idx_dock_appointments_status ON dock_appointments(status);

-- ============================================================================
-- SHIPMENT DOCUMENTS
-- ============================================================================
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

CREATE INDEX IF NOT EXISTS idx_shipment_documents_shipment ON shipment_documents(shipment_id);
CREATE INDEX IF NOT EXISTS idx_shipment_documents_truck ON shipment_documents(truck_id);
CREATE INDEX IF NOT EXISTS idx_shipment_documents_status ON shipment_documents(status);

-- ============================================================================
-- SHIPMENT ITEMS (MANIFEST ROWS)
-- ============================================================================
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

CREATE INDEX IF NOT EXISTS idx_shipment_items_shipment ON shipment_items(shipment_id);
CREATE INDEX IF NOT EXISTS idx_shipment_items_truck ON shipment_items(truck_id);
CREATE INDEX IF NOT EXISTS idx_shipment_items_status ON shipment_items(status);

-- ============================================================================
-- INVENTORY LINK - MANIFEST ITEM
-- ============================================================================
ALTER TABLE inventory
  ADD COLUMN IF NOT EXISTS manifest_item_id UUID REFERENCES shipment_items(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_inventory_manifest_item ON inventory(manifest_item_id);

-- ============================================================================
-- ROW LEVEL SECURITY (placeholder policies - tighten in production)
-- ============================================================================
ALTER TABLE shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipment_trucks ENABLE ROW LEVEL SECURITY;
ALTER TABLE dock_appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipment_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipment_items ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY shipments_company_access ON shipments
    FOR SELECT USING (auth.uid() IS NOT NULL);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY shipment_trucks_company_access ON shipment_trucks
    FOR SELECT USING (auth.uid() IS NOT NULL);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY dock_appointments_access ON dock_appointments
    FOR SELECT USING (auth.uid() IS NOT NULL);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY shipment_documents_access ON shipment_documents
    FOR SELECT USING (auth.uid() IS NOT NULL);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY shipment_items_access ON shipment_items
    FOR SELECT USING (auth.uid() IS NOT NULL);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
