-- ============================================================================
-- Clear Specific Racks in Yard A
-- ============================================================================
--
-- Clears occupancy for:
-- - A1-10: 50/100 → 0/100
-- - A2-1: 50/100 → 0/100
--
-- Run this in Supabase Dashboard → SQL Editor
-- ============================================================================

-- Verify current state before clearing
SELECT id, name, capacity, occupied, occupied_meters
FROM racks
WHERE id IN ('A1-10', 'A2-1')
ORDER BY id;

-- Expected output:
-- A1-10 | A1-10 | 100 | 50  | (some value)
-- A2-1  | A2-1  | 100 | 50  | (some value)

-- Clear the racks
UPDATE racks
SET
  occupied = 0,
  occupied_meters = 0
WHERE id IN ('A1-10', 'A2-1');

-- Verify racks cleared
SELECT id, name, capacity, occupied, occupied_meters
FROM racks
WHERE id IN ('A1-10', 'A2-1')
ORDER BY id;

-- Expected output:
-- A1-10 | A1-10 | 100 | 0 | 0
-- A2-1  | A2-1  | 100 | 0 | 0

-- ============================================================================
-- OPTIONAL: If you want to clear ALL racks in Yard A
-- ============================================================================
-- Uncomment the following to clear the entire yard:

-- UPDATE racks
-- SET occupied = 0, occupied_meters = 0
-- WHERE id LIKE 'A%';
