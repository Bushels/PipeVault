-- ============================================================================
-- VALIDATION SCRIPT: Rack Reservation Constraints
-- ============================================================================
-- Run this script in the Supabase SQL Editor to verify the schema and constraints.

-- 1. Check Table Definition & Constraints
SELECT 
    conname as constraint_name, 
    pg_get_constraintdef(oid) as definition
FROM pg_constraint 
WHERE conrelid = 'public.rack_reservations'::regclass
ORDER BY conname;

-- 2. Check Triggers
SELECT 
    trigger_name, 
    event_manipulation, 
    action_statement
FROM information_schema.triggers
WHERE event_object_table = 'rack_reservations'
ORDER BY trigger_name;

-- 3. Check RLS Policies
SELECT 
    policyname, 
    permissive, 
    roles, 
    cmd, 
    qual, 
    with_check 
FROM pg_policies 
WHERE tablename = 'rack_reservations';

-- 4. Check Indexes
SELECT 
    indexname, 
    indexdef 
FROM pg_indexes 
WHERE tablename = 'rack_reservations'
ORDER BY indexname;

-- 5. Verify NOT NULL columns
SELECT 
    column_name, 
    is_nullable, 
    data_type 
FROM information_schema.columns 
WHERE table_name = 'rack_reservations'
ORDER BY column_name;
