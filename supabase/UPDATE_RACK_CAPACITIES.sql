-- Migration: Set default rack capacities
-- Purpose: Set all racks to 100 joints capacity as starting point
-- Date: 2025-11-05
--
-- This is a temporary default capacity that can be edited later.
-- Capacities will be updated as actual measurements are taken.

-- Update all racks to have capacity of 100 joints
-- Using 12 meters as average pipe joint length for capacity_meters calculation
UPDATE racks
SET
  capacity = 100,
  capacity_meters = 1200  -- 100 joints * 12m average pipe length
WHERE capacity < 100;  -- Only update racks that have lower capacity

-- Verify the update
SELECT
  COUNT(*) as total_racks,
  MIN(capacity) as min_capacity,
  MAX(capacity) as max_capacity,
  AVG(capacity) as avg_capacity,
  MIN(capacity_meters) as min_capacity_meters,
  MAX(capacity_meters) as max_capacity_meters
FROM racks;

-- Show a sample of updated racks
SELECT
  id,
  name,
  capacity,
  capacity_meters,
  occupied,
  occupied_meters,
  ROUND((occupied::numeric / NULLIF(capacity, 0)::numeric) * 100, 1) as occupancy_percent
FROM racks
ORDER BY id
LIMIT 10;
