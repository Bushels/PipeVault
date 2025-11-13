-- ============================================================================
-- MIGRATION: Enable Realtime Broadcasts for Admin Dashboard
-- ============================================================================
--
-- Purpose: Enable real-time updates for trucking loads, inventory, and racks
--          so multiple admins see changes instantly without refreshing.
--
-- How it works:
-- 1. Supabase Realtime is already enabled on these tables
-- 2. This migration adds custom broadcast triggers for specific events
-- 3. Frontend subscribes to these broadcasts and invalidates React Query caches
--
-- Events broadcast:
-- - load_status_changed: When trucking_loads.status changes
-- - inventory_updated: When inventory is created/updated/deleted
-- - rack_occupancy_changed: When rack occupied/occupied_meters changes
--
-- ============================================================================

-- ============================================================================
-- TRIGGER FUNCTION: Broadcast load status changes
-- ============================================================================
CREATE OR REPLACE FUNCTION public.broadcast_load_status_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Only broadcast if status actually changed
    IF (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status) OR TG_OP = 'INSERT' THEN
        -- Perform a notification with the load details
        PERFORM pg_notify(
            'load_status_changed',
            json_build_object(
                'operation', TG_OP,
                'load_id', NEW.id,
                'old_status', CASE WHEN TG_OP = 'UPDATE' THEN OLD.status ELSE NULL END,
                'new_status', NEW.status,
                'sequence_number', NEW.sequence_number,
                'storage_request_id', NEW.storage_request_id,
                'timestamp', NOW()
            )::text
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGER FUNCTION: Broadcast inventory changes
-- ============================================================================
CREATE OR REPLACE FUNCTION public.broadcast_inventory_change()
RETURNS TRIGGER AS $$
DECLARE
    inv_data JSON;
BEGIN
    -- Build payload based on operation
    IF TG_OP = 'DELETE' THEN
        inv_data := json_build_object(
            'operation', 'DELETE',
            'inventory_id', OLD.id,
            'company_id', OLD.company_id,
            'request_id', OLD.request_id,
            'storage_area_id', OLD.storage_area_id,
            'timestamp', NOW()
        );
    ELSE
        inv_data := json_build_object(
            'operation', TG_OP,
            'inventory_id', NEW.id,
            'company_id', NEW.company_id,
            'request_id', NEW.request_id,
            'storage_area_id', NEW.storage_area_id,
            'status', NEW.status,
            'quantity', NEW.quantity,
            'timestamp', NOW()
        );
    END IF;

    PERFORM pg_notify('inventory_updated', inv_data::text);

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGER FUNCTION: Broadcast rack occupancy changes
-- ============================================================================
CREATE OR REPLACE FUNCTION public.broadcast_rack_occupancy_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Only broadcast if occupancy actually changed
    IF (TG_OP = 'UPDATE' AND (
        OLD.occupied IS DISTINCT FROM NEW.occupied OR
        OLD.occupied_meters IS DISTINCT FROM NEW.occupied_meters
    )) OR TG_OP = 'INSERT' THEN
        PERFORM pg_notify(
            'rack_occupancy_changed',
            json_build_object(
                'operation', TG_OP,
                'rack_id', NEW.id,
                'yard_id', NEW.yard_id,
                'area_id', NEW.area_id,
                'old_occupied', CASE WHEN TG_OP = 'UPDATE' THEN OLD.occupied ELSE NULL END,
                'new_occupied', NEW.occupied,
                'old_occupied_meters', CASE WHEN TG_OP = 'UPDATE' THEN OLD.occupied_meters ELSE NULL END,
                'new_occupied_meters', NEW.occupied_meters,
                'capacity', NEW.capacity,
                'capacity_meters', NEW.capacity_meters,
                'utilization_pct', CASE
                    WHEN NEW.capacity > 0
                    THEN ROUND((NEW.occupied::NUMERIC / NEW.capacity * 100)::NUMERIC, 1)
                    ELSE 0
                END,
                'timestamp', NOW()
            )::text
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- ATTACH TRIGGERS TO TABLES
-- ============================================================================

-- Drop existing triggers if they exist (idempotent)
DROP TRIGGER IF EXISTS trigger_broadcast_load_status ON public.trucking_loads;
DROP TRIGGER IF EXISTS trigger_broadcast_inventory ON public.inventory;
DROP TRIGGER IF EXISTS trigger_broadcast_rack_occupancy ON public.racks;

-- Create triggers for load status changes
CREATE TRIGGER trigger_broadcast_load_status
    AFTER INSERT OR UPDATE ON public.trucking_loads
    FOR EACH ROW
    EXECUTE FUNCTION public.broadcast_load_status_change();

-- Create triggers for inventory changes
CREATE TRIGGER trigger_broadcast_inventory
    AFTER INSERT OR UPDATE OR DELETE ON public.inventory
    FOR EACH ROW
    EXECUTE FUNCTION public.broadcast_inventory_change();

-- Create triggers for rack occupancy changes
CREATE TRIGGER trigger_broadcast_rack_occupancy
    AFTER INSERT OR UPDATE ON public.racks
    FOR EACH ROW
    EXECUTE FUNCTION public.broadcast_rack_occupancy_change();

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================
COMMENT ON FUNCTION public.broadcast_load_status_change IS
'Broadcasts pg_notify event when trucking_loads.status changes. Frontend can listen to load_status_changed channel to receive real-time updates.';

COMMENT ON FUNCTION public.broadcast_inventory_change IS
'Broadcasts pg_notify event when inventory is created, updated, or deleted. Frontend can listen to inventory_updated channel to receive real-time updates.';

COMMENT ON FUNCTION public.broadcast_rack_occupancy_change IS
'Broadcasts pg_notify event when rack occupancy changes. Frontend can listen to rack_occupancy_changed channel to receive real-time updates and refresh capacity displays.';

-- ============================================================================
-- TESTING THE BROADCASTS (Run in SQL Editor to test)
-- ============================================================================

-- Test 1: Listen for load status changes
-- LISTEN load_status_changed;

-- Test 2: Trigger a status change (in another tab)
-- UPDATE trucking_loads SET status = 'IN_TRANSIT'
-- WHERE id = '...' AND status = 'APPROVED';

-- Test 3: You should see the notification appear in the LISTEN tab

-- To stop listening:
-- UNLISTEN load_status_changed;

-- ============================================================================
-- FRONTEND INTEGRATION NOTES
-- ============================================================================

-- The frontend will use Supabase Realtime client to subscribe to these events:
--
-- import { supabase } from './lib/supabase';
--
-- // Subscribe to load status changes
-- const channel = supabase.channel('admin-updates')
--   .on('postgres_changes', {
--     event: '*',
--     schema: 'public',
--     table: 'trucking_loads'
--   }, (payload) => {
--     console.log('Load updated:', payload);
--     queryClient.invalidateQueries(['loads']);
--   })
--   .subscribe();
--
-- // Cleanup
-- channel.unsubscribe();

-- ============================================================================
-- PERFORMANCE CONSIDERATIONS
-- ============================================================================

-- These triggers fire on EVERY row change, so they add minimal overhead.
-- The pg_notify payload is small (< 8KB limit) and asynchronous.
-- Supabase Realtime handles delivery to connected clients efficiently.

-- If you have thousands of concurrent clients, consider:
-- 1. Rate limiting notifications (only broadcast every N seconds)
-- 2. Using Supabase Realtime filters to reduce client-side load
-- 3. Batching notifications for bulk operations
