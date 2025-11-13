-- ============================================================================
-- MIGRATION: Add Rack Capacity Constraint (Defense-in-Depth)
-- ============================================================================
--
-- Purpose: Add CHECK constraint to prevent rack over-capacity at database level
--
-- This constraint acts as a backup defense layer. The primary defense is the
-- optimistic locking logic in mark_load_completed_and_create_inventory() function.
-- However, this constraint ensures that even if application logic fails or is
-- bypassed, the database will reject any update that exceeds rack capacity.
--
-- Race Condition Scenario (Without This Constraint):
-- 1. Rack A-01: capacity=100, occupied=95 (5 available)
-- 2. Admin 1: Completes Load #1 with 3 joints (validates: 95+3=98 ✓)
-- 3. Admin 2: Completes Load #2 with 4 joints (validates: 95+4=99 ✓)
-- 4. Both transactions execute → occupied=102 ❌ (exceeds 100)
--
-- With This Constraint:
-- - First transaction succeeds: occupied=98
-- - Second transaction fails: CHECK constraint violation
-- - Application can retry with available capacity
--
-- ============================================================================

-- Add CHECK constraint to racks table
ALTER TABLE public.racks
ADD CONSTRAINT racks_capacity_check
CHECK (occupied <= capacity);

-- ============================================================================
-- COMMENT: Document the constraint for future reference
-- ============================================================================
COMMENT ON CONSTRAINT racks_capacity_check ON public.racks IS
'Ensures occupied joints never exceeds rack capacity. This is a backup defense; primary validation occurs in mark_load_completed_and_create_inventory() function.';
