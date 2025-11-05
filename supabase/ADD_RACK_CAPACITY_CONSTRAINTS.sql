-- Migration: Add capacity validation constraints to racks table
-- Purpose: Prevents over-allocation of rack space (Critical Issue #1 from assessment)
-- Date: 2025-11-05
--
-- This migration adds CHECK constraints to ensure:
-- 1. Occupied joints never exceed total capacity
-- 2. Occupied meters never exceed total capacity in meters
-- 3. Occupied values are always non-negative
-- 4. Capacity values are always positive

-- Add constraint to ensure non-negative occupied values (always valid)
ALTER TABLE racks
ADD CONSTRAINT racks_non_negative_occupied
CHECK (occupied >= 0 AND occupied_meters >= 0);

-- Add constraint to ensure non-negative capacity values (allow 0 for racks under construction)
ALTER TABLE racks
ADD CONSTRAINT racks_non_negative_capacity
CHECK (capacity >= 0 AND capacity_meters >= 0);

-- Add conditional constraint: only enforce capacity limits if capacity > 0
-- This allows flexibility while racks are being built and measured
ALTER TABLE racks
ADD CONSTRAINT racks_capacity_check
CHECK (
  capacity = 0 OR  -- Skip check if capacity not set yet
  occupied <= capacity
);

ALTER TABLE racks
ADD CONSTRAINT racks_capacity_meters_check
CHECK (
  capacity_meters = 0 OR  -- Skip check if capacity not set yet
  occupied_meters <= capacity_meters
);

-- Add comments for documentation
COMMENT ON CONSTRAINT racks_capacity_check ON racks
IS 'Ensures occupied joints never exceed total rack capacity (skipped if capacity = 0 for racks under construction)';

COMMENT ON CONSTRAINT racks_capacity_meters_check ON racks
IS 'Ensures occupied meters never exceed total rack capacity in meters (skipped if capacity_meters = 0 for racks under construction)';

COMMENT ON CONSTRAINT racks_non_negative_occupied ON racks
IS 'Ensures occupied values are always non-negative';

COMMENT ON CONSTRAINT racks_non_negative_capacity ON racks
IS 'Ensures capacity values are always non-negative (0 allowed for racks under construction)';

-- Verify constraints were added successfully
SELECT
  conname AS constraint_name,
  pg_get_constraintdef(c.oid) AS constraint_definition
FROM pg_constraint c
JOIN pg_namespace n ON n.oid = c.connamespace
WHERE conrelid = 'public.racks'::regclass
  AND conname LIKE 'racks_%_check'
ORDER BY conname;
