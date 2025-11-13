-- ============================================================================
-- MIGRATION: Handle Missing Manifest Data in Load Completion
-- ============================================================================
--
-- Purpose: Update mark_load_completed_and_create_inventory to handle loads
--          without manifest data (legacy loads created before manifest processing)
--
-- Changes:
-- 1. Make manifest data optional instead of required
-- 2. If manifest exists: Create detailed inventory records (existing behavior)
-- 3. If no manifest: Create single simplified inventory record with planned quantities
--
-- This enables completing legacy loads (like Load #1) that don't have AI-extracted
-- manifest data, while maintaining detailed inventory creation for newer loads.
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
BEGIN
    -- ========================================================================
    -- INTEGRITY CHECKS: Validate cross-tenant relationships and state
    -- ========================================================================

    -- Check 1: Load exists, not already COMPLETED, and belongs to request
    SELECT
        storage_request_id,
        status::TEXT,
        total_joints_planned,
        COALESCE(avg_joint_length_ft, 30.0)  -- Default 30 ft if not specified
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

    -- Check 3: Rack exists
    IF NOT EXISTS (SELECT 1 FROM public.racks WHERE id = rack_id_param) THEN
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
        -- Process manifest items (original detailed logic)
        FOR manifest_item IN SELECT * FROM jsonb_array_elements(manifest_items)
        LOOP
            DECLARE
                item_quantity INTEGER := COALESCE((manifest_item->>'quantity')::INTEGER, 1);
                item_length NUMERIC := COALESCE((manifest_item->>'tally_length_ft')::NUMERIC, 0);
            BEGIN
                -- Accumulate manifest totals
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
        -- No manifest data - create single inventory record with planned quantities
        -- This handles legacy loads created before manifest processing
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
            'LEGACY-' || load_id_param::TEXT,  -- Unique reference for legacy loads
            'Drill Pipe',
            'Unknown',  -- Grade unknown without manifest
            0,          -- OD unknown
            0,          -- Weight unknown
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
    -- STEP 4: Update rack occupancy (atomic increment)
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
        'had_manifest', manifest_items IS NOT NULL
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.mark_load_completed_and_create_inventory TO authenticated;

-- Add comment documenting the change
COMMENT ON FUNCTION public.mark_load_completed_and_create_inventory IS
'Atomically completes a trucking load. Handles both loads with manifest data (detailed inventory) and legacy loads without manifests (simplified inventory). Updated 2025-11-13 to support legacy loads.';
