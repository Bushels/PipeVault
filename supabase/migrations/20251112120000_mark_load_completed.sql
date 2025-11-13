-- ============================================================================
-- MIGRATION: Transactional Load Completion Function
-- ============================================================================
--
-- Purpose: Atomically complete a trucking load with inventory creation
--
-- This function ensures data integrity by wrapping the entire load completion
-- process in a single transaction. If any step fails, all changes are rolled back.
--
-- Process:
-- 1. Update trucking_loads status to COMPLETED with timestamp and quantity
-- 2. Fetch manifest data from trucking_documents.parsed_payload
-- 3. Create inventory records (bulk insert) from manifest data
-- 4. Update rack occupancy atomically
-- 5. Return summary data for notifications
--
-- Parameters:
-- - load_id_param: UUID of the trucking load to complete
-- - company_id_param: UUID of the company (for inventory linking)
-- - request_id_param: UUID of the storage request (for inventory linking)
-- - rack_id_param: TEXT rack ID (e.g., "A-A1-1", "B-B2-03") - matches racks.id schema
-- - actual_joints_param: Actual number of joints received (may differ from planned)
-- - completion_notes_param: Optional admin notes about the delivery
--
-- Returns: JSON object with:
-- - load_id: UUID of completed load
-- - inventory_created: Number of inventory records created
-- - rack_updated: Boolean indicating rack occupancy was updated
--
-- Security: SECURITY DEFINER allows authenticated users to execute
-- ============================================================================

-- ============================================================================
-- DROP OLD VERSION: Prevent function overloading conflict
-- ============================================================================
-- If an old version with UUID rack_id_param exists, drop it first.
-- This prevents ambiguity when calling the function with a TEXT rack ID.
-- CREATE OR REPLACE does not work when changing parameter types.
DROP FUNCTION IF EXISTS public.mark_load_completed_and_create_inventory(
    UUID,    -- load_id_param
    UUID,    -- company_id_param
    UUID,    -- request_id_param
    UUID,    -- rack_id_param (OLD: incorrect type - racks.id is TEXT)
    INTEGER, -- actual_joints_param
    TEXT     -- completion_notes_param
);

-- ============================================================================
-- CREATE NEW VERSION: With correct TEXT rack_id_param
-- ============================================================================
CREATE OR REPLACE FUNCTION public.mark_load_completed_and_create_inventory(
    load_id_param UUID,
    company_id_param UUID,
    request_id_param UUID,
    rack_id_param TEXT,  -- TEXT to match racks.id schema (e.g., "A-A1-1")
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
BEGIN
    -- ========================================================================
    -- INTEGRITY CHECKS: Validate cross-tenant relationships and state
    -- ========================================================================
    -- These checks ensure SECURITY DEFINER function only acts on allowed records

    -- Check 1: Load exists, not already COMPLETED, and belongs to request
    SELECT storage_request_id, status::TEXT
    INTO load_storage_request_id, load_current_status
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
        notes = COALESCE(completion_notes_param, notes)  -- Preserve existing notes if new ones not provided
    WHERE id = load_id_param;

    -- ========================================================================
    -- STEP 2: Fetch manifest data from trucking_documents
    -- ========================================================================
    SELECT parsed_payload INTO manifest_items
    FROM public.trucking_documents
    WHERE trucking_load_id = load_id_param
      AND parsed_payload IS NOT NULL
    ORDER BY uploaded_at DESC
    LIMIT 1;

    IF manifest_items IS NULL THEN
        RAISE EXCEPTION 'No manifest data found for load_id %', load_id_param;
    END IF;

    -- ========================================================================
    -- STEP 3: Create inventory records from manifest data (bulk insert)
    -- ========================================================================
    -- Iterate through each item in the manifest array
    -- Also compute manifest totals for validation and rack updates
    FOR manifest_item IN SELECT * FROM jsonb_array_elements(manifest_items)
    LOOP
        DECLARE
            item_quantity INTEGER := COALESCE((manifest_item->>'quantity')::INTEGER, 1);
            item_length NUMERIC := COALESCE((manifest_item->>'tally_length_ft')::NUMERIC, 0);
        BEGIN
            -- Accumulate manifest totals (source of truth for rack occupancy)
            manifest_total_joints := manifest_total_joints + item_quantity;
            manifest_total_meters := manifest_total_meters + (item_quantity * item_length * 0.3048);  -- Convert feet to meters

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
                'Drill Pipe',  -- Default type, can be parameterized if needed
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

    -- ========================================================================
    -- VALIDATION: Manifest total must match admin input (data integrity)
    -- ========================================================================
    IF manifest_total_joints != actual_joints_param THEN
        RAISE EXCEPTION 'Quantity mismatch: Manifest shows % joints but admin entered %. Please verify the manifest data or adjust the actual joints received.',
            manifest_total_joints, actual_joints_param;
    END IF;

    -- ========================================================================
    -- STEP 4: Update rack occupancy atomically with capacity validation
    -- ========================================================================
    -- This UPDATE includes a WHERE clause that validates capacity BEFORE updating
    -- If another admin is simultaneously completing a load, this prevents over-capacity
    -- Uses manifest_total_joints (validated to equal actual_joints_param) as source of truth
    UPDATE public.racks
    SET
        occupied = occupied + manifest_total_joints,
        occupied_meters = occupied_meters + manifest_total_meters
    WHERE id = rack_id_param
      AND (occupied + manifest_total_joints) <= capacity;  -- Optimistic lock: only succeed if capacity allows

    IF NOT FOUND THEN
        -- Check if rack exists vs capacity exceeded
        DECLARE
            rack_exists BOOLEAN;
            current_capacity INTEGER;
            current_occupied INTEGER;
        BEGIN
            SELECT TRUE, capacity, occupied
            INTO rack_exists, current_capacity, current_occupied
            FROM public.racks
            WHERE id = rack_id_param;

            IF rack_exists IS NULL THEN
                RAISE EXCEPTION 'Rack with ID % not found', rack_id_param;
            ELSE
                RAISE EXCEPTION 'Rack capacity exceeded: % joints requested but only % available (capacity: %, occupied: %)',
                    manifest_total_joints,
                    current_capacity - current_occupied,
                    current_capacity,
                    current_occupied;
            END IF;
        END;
    ELSE
        rack_updated := TRUE;
    END IF;

    -- ========================================================================
    -- RETURN: Summary data for notifications and logging
    -- ========================================================================
    RETURN json_build_object(
        'load_id', load_id_param,
        'inventory_created', inventory_created_count,
        'rack_updated', rack_updated,
        'completed_at', current_timestamp
    );

-- If any step fails, the entire transaction is automatically rolled back
EXCEPTION
    WHEN OTHERS THEN
        -- Re-raise the exception with enhanced context including SQLSTATE
        RAISE EXCEPTION 'Load completion transaction failed [%]: %', SQLSTATE, SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- PERMISSIONS: Grant execute to authenticated users only
-- ============================================================================
-- Security: Explicitly revoke from public, grant only to authenticated
REVOKE EXECUTE ON FUNCTION public.mark_load_completed_and_create_inventory(UUID, UUID, UUID, TEXT, INTEGER, TEXT) FROM public;
GRANT EXECUTE ON FUNCTION public.mark_load_completed_and_create_inventory(UUID, UUID, UUID, TEXT, INTEGER, TEXT) TO authenticated;

-- ============================================================================
-- COMMENTS: Document the function for future reference
-- ============================================================================
COMMENT ON FUNCTION public.mark_load_completed_and_create_inventory IS
'Atomically completes a trucking load by updating status, creating inventory records from manifest data, and updating rack occupancy. All operations are wrapped in a transaction to ensure data integrity.';
