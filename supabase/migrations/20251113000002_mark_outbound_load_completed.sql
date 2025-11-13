-- ============================================================================
-- MIGRATION: Outbound Load Completion Function
-- ============================================================================
--
-- Purpose: Atomically mark outbound load as picked up and decrement rack occupancy
--
-- Function: mark_outbound_load_completed_and_clear_rack
--
-- Steps:
-- 1. Validate load exists, is APPROVED, and is OUTBOUND direction
-- 2. Validate all inventory items belong to company and are IN_STORAGE
-- 3. Calculate total joints and meters from selected inventory
-- 4. Validate actual_joints_param matches inventory total
-- 5. Update inventory status: IN_STORAGE → PICKED_UP
-- 6. Link inventory to outbound load
-- 7. Decrement rack occupancy atomically (grouped by rack)
-- 8. Update load status: APPROVED → IN_TRANSIT
-- 9. Return summary JSON with pickup details
--
-- All operations wrapped in transaction - if any step fails, entire operation rolls back
-- ============================================================================

CREATE OR REPLACE FUNCTION public.mark_outbound_load_completed_and_clear_rack(
    load_id_param UUID,
    company_id_param UUID,
    request_id_param UUID,
    inventory_ids_param UUID[],  -- Array of inventory IDs to pick up
    actual_joints_param INTEGER,
    completion_notes_param TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
    inventory_record RECORD;
    rack_updates RECORD;
    inventory_updated_count INTEGER := 0;
    total_joints_selected INTEGER := 0;
    total_meters_selected NUMERIC := 0;
    current_timestamp TIMESTAMPTZ := NOW();
    load_storage_request_id UUID;
    load_current_status TEXT;
    load_direction TEXT;
    request_company_id UUID;
BEGIN
    -- ========================================================================
    -- INTEGRITY CHECKS: Validate cross-tenant relationships and state
    -- ========================================================================

    -- Check 1: Load exists, is APPROVED, is OUTBOUND, and belongs to request
    SELECT storage_request_id, status::TEXT, direction
    INTO load_storage_request_id, load_current_status, load_direction
    FROM public.trucking_loads
    WHERE id = load_id_param;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Load with ID % not found', load_id_param;
    END IF;

    IF load_direction != 'OUTBOUND' THEN
        RAISE EXCEPTION 'Load % is not an OUTBOUND load (direction: %). Use mark_load_completed_and_create_inventory for INBOUND loads.',
            load_id_param, load_direction;
    END IF;

    IF load_current_status != 'APPROVED' THEN
        RAISE EXCEPTION 'Load % must be APPROVED to mark as picked up (current status: %)',
            load_id_param, load_current_status;
    END IF;

    IF load_storage_request_id != request_id_param THEN
        RAISE EXCEPTION 'Load % does not belong to request %. Cross-tenant operation denied.',
            load_id_param, request_id_param;
    END IF;

    -- Check 2: Storage request belongs to company
    SELECT company_id
    INTO request_company_id
    FROM public.storage_requests
    WHERE id = request_id_param;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Storage request % not found', request_id_param;
    END IF;

    IF request_company_id != company_id_param THEN
        RAISE EXCEPTION 'Storage request % does not belong to company %. Cross-tenant operation denied.',
            request_id_param, company_id_param;
    END IF;

    -- Check 3: Validate all inventory items exist, belong to company, and are IN_STORAGE
    FOR inventory_record IN
        SELECT
            i.id,
            i.storage_area_id AS rack_id,
            i.quantity,
            i.length,
            i.status,
            i.company_id
        FROM public.inventory i
        WHERE i.id = ANY(inventory_ids_param)
    LOOP
        -- Validate company ownership
        IF inventory_record.company_id != company_id_param THEN
            RAISE EXCEPTION 'Inventory % does not belong to company %. Cross-tenant operation denied.',
                inventory_record.id, company_id_param;
        END IF;

        -- Validate status is IN_STORAGE
        IF inventory_record.status != 'IN_STORAGE' THEN
            RAISE EXCEPTION 'Inventory % is not IN_STORAGE (status: %). Cannot pick up inventory that is not currently stored.',
                inventory_record.id, inventory_record.status;
        END IF;

        -- Accumulate totals
        total_joints_selected := total_joints_selected + inventory_record.quantity;
        total_meters_selected := total_meters_selected + (inventory_record.quantity * inventory_record.length * 0.3048);
    END LOOP;

    -- Check 4: Validate we found all requested inventory IDs
    IF (SELECT COUNT(*) FROM public.inventory WHERE id = ANY(inventory_ids_param)) != array_length(inventory_ids_param, 1) THEN
        RAISE EXCEPTION 'Some inventory IDs in the request were not found. Expected %, found %',
            array_length(inventory_ids_param, 1),
            (SELECT COUNT(*) FROM public.inventory WHERE id = ANY(inventory_ids_param));
    END IF;

    -- ========================================================================
    -- VALIDATION: Actual joints must match selected inventory
    -- ========================================================================
    IF total_joints_selected != actual_joints_param THEN
        RAISE EXCEPTION 'Quantity mismatch: Selected inventory has % joints but admin entered %. Please verify the selection or adjust the actual joints loaded.',
            total_joints_selected, actual_joints_param;
    END IF;

    -- ========================================================================
    -- STEP 1: Update load status to IN_TRANSIT and set pickup time
    -- ========================================================================
    UPDATE public.trucking_loads
    SET
        status = 'IN_TRANSIT',
        completed_at = current_timestamp,  -- Using completed_at to track pickup time for outbound
        total_joints_completed = actual_joints_param,
        notes = COALESCE(completion_notes_param, notes)
    WHERE id = load_id_param;

    -- ========================================================================
    -- STEP 2: Update inventory status and link to outbound load
    -- ========================================================================
    UPDATE public.inventory
    SET
        status = 'PICKED_UP',
        pickup_truck_load_id = load_id_param,
        pickup_timestamp = current_timestamp
    WHERE id = ANY(inventory_ids_param);

    GET DIAGNOSTICS inventory_updated_count = ROW_COUNT;

    -- ========================================================================
    -- STEP 3: Decrement rack occupancy atomically (grouped by rack)
    -- ========================================================================
    -- Calculate rack updates: Sum joints and meters per rack
    FOR rack_updates IN
        SELECT
            i.storage_area_id AS rack_id,
            SUM(i.quantity) AS joints_removed,
            SUM(i.quantity * i.length * 0.3048) AS meters_removed
        FROM public.inventory i
        WHERE i.id = ANY(inventory_ids_param)
        GROUP BY i.storage_area_id
    LOOP
        -- Atomically decrement rack occupancy with validation
        UPDATE public.racks
        SET
            occupied = occupied - rack_updates.joints_removed,
            occupied_meters = occupied_meters - rack_updates.meters_removed
        WHERE id = rack_updates.rack_id
          AND occupied >= rack_updates.joints_removed
          AND occupied_meters >= rack_updates.meters_removed;

        IF NOT FOUND THEN
            -- Check if rack exists vs insufficient occupancy
            DECLARE
                rack_exists BOOLEAN;
                current_occupied INTEGER;
                current_occupied_meters NUMERIC;
            BEGIN
                SELECT TRUE, occupied, occupied_meters
                INTO rack_exists, current_occupied, current_occupied_meters
                FROM public.racks
                WHERE id = rack_updates.rack_id;

                IF rack_exists IS NULL THEN
                    RAISE EXCEPTION 'Rack % not found. Cannot decrement occupancy.', rack_updates.rack_id;
                ELSE
                    RAISE EXCEPTION 'Rack % has insufficient occupancy: % joints and %.2f meters currently occupied, but trying to remove % joints and %.2f meters. This indicates a data integrity issue.',
                        rack_updates.rack_id,
                        current_occupied,
                        current_occupied_meters,
                        rack_updates.joints_removed,
                        rack_updates.meters_removed;
                END IF;
            END;
        END IF;
    END LOOP;

    -- ========================================================================
    -- RETURN: Summary data for notifications and logging
    -- ========================================================================
    RETURN json_build_object(
        'load_id', load_id_param,
        'direction', 'OUTBOUND',
        'inventory_updated', inventory_updated_count,
        'total_joints_picked_up', total_joints_selected,
        'total_meters_picked_up', ROUND(total_meters_selected::NUMERIC, 2),
        'racks_updated', (SELECT COUNT(DISTINCT storage_area_id) FROM public.inventory WHERE id = ANY(inventory_ids_param)),
        'picked_up_at', current_timestamp
    );

-- If any step fails, the entire transaction is automatically rolled back
EXCEPTION
    WHEN OTHERS THEN
        -- Re-raise the exception with enhanced context including SQLSTATE
        RAISE EXCEPTION 'Outbound load pickup transaction failed [%]: %', SQLSTATE, SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- PERMISSIONS: Grant execute to authenticated users only
-- ============================================================================
REVOKE EXECUTE ON FUNCTION public.mark_outbound_load_completed_and_clear_rack(UUID, UUID, UUID, UUID[], INTEGER, TEXT) FROM public;
GRANT EXECUTE ON FUNCTION public.mark_outbound_load_completed_and_clear_rack(UUID, UUID, UUID, UUID[], INTEGER, TEXT) TO authenticated;

-- ============================================================================
-- COMMENTS: Document the function for future reference
-- ============================================================================
COMMENT ON FUNCTION public.mark_outbound_load_completed_and_clear_rack IS
'Atomically marks an outbound load as picked up (IN_TRANSIT), updates inventory status to PICKED_UP, and decrements rack occupancy. All operations wrapped in a transaction to ensure data integrity. For outbound loads only - use mark_load_completed_and_create_inventory for inbound loads.';

-- ============================================================================
-- VERIFICATION TEST QUERY
-- ============================================================================
-- Test the function signature exists and is callable:
-- SELECT public.mark_outbound_load_completed_and_clear_rack(
--     'LOAD_UUID'::UUID,
--     'COMPANY_UUID'::UUID,
--     'REQUEST_UUID'::UUID,
--     ARRAY['INVENTORY_UUID_1'::UUID, 'INVENTORY_UUID_2'::UUID],
--     42,
--     'Picked up by Acme Trucking - Driver: John Smith'
-- );

-- ============================================================================
-- SUCCESS CRITERIA
-- ============================================================================
-- ✅ Function validates load is OUTBOUND and APPROVED
-- ✅ Function validates all inventory belongs to company and is IN_STORAGE
-- ✅ Function validates actual joints matches selected inventory
-- ✅ Function updates inventory status to PICKED_UP
-- ✅ Function links inventory to outbound load
-- ✅ Function decrements rack occupancy atomically
-- ✅ Function prevents negative rack occupancy
-- ✅ Function updates load status to IN_TRANSIT
-- ✅ Function returns summary JSON with pickup details
-- ✅ All operations wrapped in transaction (rollback on failure)
-- ============================================================================
