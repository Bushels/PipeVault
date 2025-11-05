-- Migration: Fix all rack capacities to 100 joints
-- Purpose: Update racks with incorrect capacity=1 to proper capacity=100
-- Date: 2025-11-05
--
-- Issue: All racks in Yard A (and potentially other yards) have capacity=1 instead of 100
-- Root Cause: Initial rack setup used wrong default capacity
--
-- Solution: Update all racks to have capacity=100 joints (1200 meters)

-- Show current state before update
SELECT
  ya.yard_id,
  COUNT(*) as rack_count,
  MIN(r.capacity) as min_capacity,
  MAX(r.capacity) as max_capacity,
  AVG(r.capacity) as avg_capacity,
  SUM(r.capacity - r.occupied) as total_free_space
FROM racks r
JOIN yard_areas ya ON r.area_id = ya.id
GROUP BY ya.yard_id
ORDER BY ya.yard_id;

-- Update all racks to have capacity of 100 joints
-- Using 12 meters as average pipe joint length for capacity_meters calculation
UPDATE racks
SET
  capacity = 100,
  capacity_meters = 1200  -- 100 joints * 12m average pipe length
WHERE capacity < 100;  -- Only update racks that need fixing

-- Show results after update
SELECT
  ya.yard_id,
  y.name as yard_name,
  COUNT(*) as rack_count,
  MIN(r.capacity) as min_capacity,
  MAX(r.capacity) as max_capacity,
  AVG(r.capacity) as avg_capacity,
  SUM(r.capacity) as total_capacity,
  SUM(r.occupied) as total_occupied,
  SUM(r.capacity - r.occupied) as total_free_space
FROM racks r
JOIN yard_areas ya ON r.area_id = ya.id
JOIN yards y ON ya.yard_id = y.id
GROUP BY ya.yard_id, y.name
ORDER BY ya.yard_id;

-- Show detailed sample of updated Yard A racks
SELECT
  r.id,
  r.name,
  ya.name as area_name,
  r.capacity,
  r.occupied,
  (r.capacity - r.occupied) as free_space,
  r.capacity_meters,
  r.occupied_meters,
  ROUND((r.occupied::numeric / NULLIF(r.capacity, 0)::numeric) * 100, 1) as occupancy_percent
FROM racks r
JOIN yard_areas ya ON r.area_id = ya.id
WHERE ya.yard_id = 'A'
ORDER BY r.name
LIMIT 10;
