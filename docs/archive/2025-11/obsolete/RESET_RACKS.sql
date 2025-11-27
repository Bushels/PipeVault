-- Reset rack occupancy for testing
-- Run this in Supabase SQL Editor

UPDATE racks
SET
  occupied = 0,
  occupied_meters = 0,
  updated_at = now()
WHERE name IN ('A1-1', 'A1-2', 'A1-3', 'A1-4', 'A2-11');

-- Verify the reset
SELECT
  id,
  name,
  capacity,
  occupied,
  (capacity - occupied) as available
FROM racks
WHERE name IN ('A1-1', 'A1-2', 'A1-3', 'A1-4', 'A2-11')
ORDER BY name;

-- Optional: Reset ALL racks to empty for clean testing
-- UPDATE racks SET occupied = 0, occupied_meters = 0, updated_at = now();
