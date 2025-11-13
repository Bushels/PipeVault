-- ============================================================================
-- MIGRATION: Add Rack Capacity Safeguard to Load Completion (CORRECTED)
-- ============================================================================
--
-- Purpose: Prevent rack occupancy from exceeding capacity during load completion
--
-- CORRECTION: Uses total_length_ft_planned / total_joints_planned to calculate
--             average joint length (avg_joint_length_ft column doesn't exist)
--
-- ============================================================================

CREATE OR REPLACE FUNCTION public.mark_load_completed_and_create_inventory(
    load_id_param UUID,
    company_id_param UUID,
    request_id_param UUID,
    rack_id_param TEXT,
    actual_joints_param INTEGER,
    completion_notes_param TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
    manifest_items JSONB;
    manifest_item JSONB;
    inventory_created_count INTEGER := 0;
    manifest_total_joints INTEGER := 0;
    manifest_total_meters NUMERIC := 0;
    rack_updated BOOLEAN := FALSE;
    current_timestamp TIMESTAMPTZ := NOW();
    load_storage_request_id UUID;
    load_current_status TEXT;
    request_company_id UUID;
    load_planned_joints INTEGER;
    load_avg_joint_length NUMERIC;
    -- Capacity safeguard variables
    rack_capacity INTEGER;
    rack_current_occupied INTEGER;
    rack_capacity_meters NUMERIC;
    rack_current_occupied_meters NUMERIC;
    rack_available_joints INTEGER;
    rack_available_meters NUMERIC;
BEGIN
    -- ========================================================================
    -- INTEGRITY CHECKS: Validate cross-tenant relationships and state
    -- ========================================================================

    -- Check 1: Load exists, not already COMPLETED, and belongs to request
    -- CORRECTED: Calculate avg_joint_length from total_length_ft / total_joints
    SELECT
        storage_request_id,
        status::TEXT,
        total_joints_planned,
        CASE
            WHEN total_joints_planned > 0 AND total_length_ft_planned > 0
            THEN total_length_ft_planned / total_joints_planned
            ELSE 30.0  -- Default to 30 ft if data unavailable
        END
    INTO
        load_storage_request_id,
        load_current_status,
        load_planned_joints,
        load_avg_joint_length
    FROM public.trucking_loads
    WHERE id = load_id_param;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Load with ID % not found', load_id_param;
    END IF;

    IF load_current_status = 'COMPLETED' THEN
        RAISE EXCEPTION 'Load % is already COMPLETED. Cannot mark completed again.', load_id_param;
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

    -- Check 3: Rack exists and get current capacity
    SELECT
        capacity,
        occupied,
        COALESCE(capacity_meters, 0),
        COALESCE(occupied_meters, 0)
    INTO
        rack_capacity,
        rack_current_occupied,
        rack_capacity_meters,
        rack_current_occupied_meters
    FROM public.racks
    WHERE id = rack_id_param;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Rack with ID % not found', rack_id_param;
    END IF;

    -- ========================================================================
    -- STEP 1: Update trucking load status to COMPLETED
    -- ========================================================================
    UPDATE public.trucking_loads
    SET
        status = 'COMPLETED',
        completed_at = current_timestamp,
        total_joints_completed = actual_joints_param,
        notes = COALESCE(completion_notes_param, notes)
    WHERE id = load_id_param;

    -- ========================================================================
    -- STEP 2: Fetch manifest data (if available)
    -- ========================================================================
    SELECT parsed_payload INTO manifest_items
    FROM public.trucking_documents
    WHERE trucking_load_id = load_id_param
      AND parsed_payload IS NOT NULL
    ORDER BY uploaded_at DESC
    LIMIT 1;

    -- ========================================================================
    -- STEP 3a: If manifest exists, create detailed inventory records
    -- ========================================================================
    IF manifest_items IS NOT NULL THEN
        FOR manifest_item IN SELECT * FROM jsonb_array_elements(manifest_items)
        LOOP
            DECLARE
                item_quantity INTEGER := COALESCE((manifest_item->>'quantity')::INTEGER, 1);
                item_length NUMERIC := COALESCE((manifest_item->>'tally_length_ft')::NUMERIC, 0);
            BEGIN
                manifest_total_joints := manifest_total_joints + item_quantity;
                manifest_total_meters := manifest_total_meters + (item_quantity * item_length * 0.3048);

                INSERT INTO public.inventory (
                    company_id,
                    request_id,
                    reference_id,
                    type,
                    grade,
                    outer_diameter,
                    weight,
                    length,
                    quantity,
                    status,
                    storage_area_id,
                    delivery_truck_load_id,
                    drop_off_timestamp
                )
                VALUES (
                    company_id_param,
                    request_id_param,
                    COALESCE(manifest_item->>'serial_number', manifest_item->>'heat_number', 'UNKNOWN'),
                    'Drill Pipe',
                    COALESCE(manifest_item->>'grade', 'Unknown'),
                    COALESCE((manifest_item->>'outer_diameter')::NUMERIC, 0),
                    COALESCE((manifest_item->>'weight_lbs_ft')::NUMERIC, 0),
                    item_length,
                    item_quantity,
                    'IN_STORAGE',
                    rack_id_param,
                    load_id_param,
                    current_timestamp
                );

                inventory_created_count := inventory_created_count + 1;
            END;
        END LOOP;

        -- Validate manifest total matches admin input
        IF manifest_total_joints != actual_joints_param THEN
            RAISE EXCEPTION 'Quantity mismatch: Manifest shows % joints but admin entered %. Please verify the manifest data or adjust the actual joints received.',
                manifest_total_joints, actual_joints_param;
        END IF;

    -- ========================================================================
    -- STEP 3b: If NO manifest, create single simplified inventory record
    -- ========================================================================
    ELSE
        INSERT INTO public.inventory (
            company_id,
            request_id,
            reference_id,
            type,
            grade,
            outer_diameter,
            weight,
            length,
            quantity,
            status,
            storage_area_id,
            delivery_truck_load_id,
            drop_off_timestamp
        )
        VALUES (
            company_id_param,
            request_id_param,
            'LEGACY-' || load_id_param::TEXT,
            'Drill Pipe',
            'Unknown',
            0,
            0,
            load_avg_joint_length,
            actual_joints_param,
            'IN_STORAGE',
            rack_id_param,
            load_id_param,
            current_timestamp
        );

        inventory_created_count := 1;
        manifest_total_joints := actual_joints_param;
        manifest_total_meters := actual_joints_param * load_avg_joint_length * 0.3048;
    END IF;

    -- ========================================================================
    -- CAPACITY SAFEGUARD: Validate before updating rack occupancy
    -- ========================================================================
    rack_available_joints := rack_capacity - rack_current_occupied;
    rack_available_meters := rack_capacity_meters - rack_current_occupied_meters;

    -- Check joint capacity
    IF manifest_total_joints > rack_available_joints THEN
        RAISE EXCEPTION 'Capacity exceeded: Rack % can only hold % more joints (capacity: %, occupied: %), but load contains % joints. Please select a different rack or reduce the quantity.',
            rack_id_param,
            rack_available_joints,
            rack_capacity,
            rack_current_occupied,
            manifest_total_joints;
    END IF;

    -- Check linear meters capacity (if tracked)
    IF rack_capacity_meters > 0 AND manifest_total_meters > rack_available_meters THEN
        RAISE EXCEPTION 'Linear capacity exceeded: Rack % can only hold %.2f more meters (capacity: %.2f m, occupied: %.2f m), but load contains %.2f meters. Please select a different rack or reduce the quantity.',
            rack_id_param,
            rack_available_meters,
            rack_capacity_meters,
            rack_current_occupied_meters,
            manifest_total_meters;
    END IF;

    -- ========================================================================
    -- STEP 4: Update rack occupancy (atomic increment) - SAFE after validation
    -- ========================================================================
    UPDATE public.racks
    SET
        occupied = occupied + manifest_total_joints,
        occupied_meters = COALESCE(occupied_meters, 0) + manifest_total_meters
    WHERE id = rack_id_param;

    IF FOUND THEN
        rack_updated := TRUE;
    ELSE
        RAISE EXCEPTION 'Failed to update rack % occupancy', rack_id_param;
    END IF;

    -- ========================================================================
    -- RETURN: Summary for notifications
    -- ========================================================================
    RETURN json_build_object(
        'load_id', load_id_param,
        'inventory_created', inventory_created_count,
        'rack_updated', rack_updated,
        'total_joints', manifest_total_joints,
        'total_meters', manifest_total_meters,
        'had_manifest', manifest_items IS NOT NULL,
        'rack_capacity_after', rack_current_occupied + manifest_total_joints,
        'rack_available_after', rack_capacity - (rack_current_occupied + manifest_total_joints)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.mark_load_completed_and_create_inventory TO authenticated;

-- Add comment documenting the fix
COMMENT ON FUNCTION public.mark_load_completed_and_create_inventory IS
'Atomically completes a trucking load with capacity safeguard. Validates rack capacity before incrementing occupancy to prevent over-allocation. Calculates avg joint length from total_length_ft / total_joints. Handles both loads with manifest data (detailed inventory) and legacy loads without manifests (simplified inventory). Updated 2025-11-13 with schema correction.';
