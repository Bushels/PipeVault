-- ============================================================================
-- MIGRATION: Create Rack Occupancy Adjustment Audit Trail
-- ============================================================================
--
-- Purpose: Create a table to log all manual adjustments to rack occupancy.
--          This provides a critical audit trail for data reconciliation.
--
-- Use Cases:
-- - Pipe physically moved between racks in yard
-- - Manual corrections for data discrepancies
-- - Emergency capacity adjustments
--
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.rack_occupancy_adjustments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rack_id TEXT NOT NULL REFERENCES public.racks(id), -- Note: racks.id is TEXT, not UUID
    adjusted_by TEXT NOT NULL, -- Email of admin who made the change
    adjusted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reason TEXT NOT NULL CHECK (char_length(reason) >= 10),

    old_joints_occupied INTEGER NOT NULL,
    new_joints_occupied INTEGER NOT NULL,

    old_meters_occupied NUMERIC(10, 2) NOT NULL,
    new_meters_occupied NUMERIC(10, 2) NOT NULL,

    CONSTRAINT check_new_values_are_not_negative
        CHECK (new_joints_occupied >= 0 AND new_meters_occupied >= 0)
);

-- Add comments for clarity
COMMENT ON TABLE public.rack_occupancy_adjustments IS
'Logs manual changes to rack occupancy for auditing and reconciliation.';

COMMENT ON COLUMN public.rack_occupancy_adjustments.rack_id IS
'The rack that was adjusted (e.g., "A-A1-5").';

COMMENT ON COLUMN public.rack_occupancy_adjustments.adjusted_by IS
'Email of the admin user who performed the adjustment.';

COMMENT ON COLUMN public.rack_occupancy_adjustments.reason IS
'The mandatory reason for the adjustment (minimum 10 characters).';

COMMENT ON COLUMN public.rack_occupancy_adjustments.old_joints_occupied IS
'The number of joints in the rack before the adjustment.';

COMMENT ON COLUMN public.rack_occupancy_adjustments.new_joints_occupied IS
'The number of joints in the rack after the adjustment.';

COMMENT ON COLUMN public.rack_occupancy_adjustments.old_meters_occupied IS
'The meters occupied in the rack before the adjustment.';

COMMENT ON COLUMN public.rack_occupancy_adjustments.new_meters_occupied IS
'The meters occupied in the rack after the adjustment.';

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_rack_occupancy_adjustments_rack_id
ON public.rack_occupancy_adjustments(rack_id, adjusted_at DESC);

CREATE INDEX IF NOT EXISTS idx_rack_occupancy_adjustments_adjusted_by
ON public.rack_occupancy_adjustments(adjusted_by);

CREATE INDEX IF NOT EXISTS idx_rack_occupancy_adjustments_recent
ON public.rack_occupancy_adjustments(adjusted_at DESC);

-- Enable RLS
ALTER TABLE public.rack_occupancy_adjustments ENABLE ROW LEVEL SECURITY;

-- Policies: Only admins can read audit logs
CREATE POLICY "Admins can view adjustment history"
ON public.rack_occupancy_adjustments
FOR SELECT
TO authenticated
USING (
  -- Allow if user is in admin_users table
  EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE admin_users.email = auth.jwt()->>'email'
  )
);

-- Only the system (via SECURITY DEFINER functions) can insert
CREATE POLICY "Only system can insert adjustments"
ON public.rack_occupancy_adjustments
FOR INSERT
TO authenticated
WITH CHECK (false); -- Enforces that only SECURITY DEFINER functions can insert

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Verify table created
SELECT table_name, table_type
FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'rack_occupancy_adjustments';

-- Verify indexes created
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'rack_occupancy_adjustments';

-- ============================================================================
-- SUCCESS CRITERIA
-- ============================================================================
-- ✅ rack_occupancy_adjustments table created
-- ✅ Audit columns capture before/after state
-- ✅ Reason field requires minimum 10 characters
-- ✅ RLS policies restrict access to admins
-- ✅ Indexes optimize query performance
-- ============================================================================
