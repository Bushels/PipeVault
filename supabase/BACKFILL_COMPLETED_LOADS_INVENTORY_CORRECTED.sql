-- ============================================================================
-- BACKFILL SCRIPT: Create Inventory for COMPLETED Loads (CORRECTED)
-- ============================================================================
--
-- CORRECTION: Uses total_length_ft_planned / total_joints_planned to calculate
--             average joint length (avg_joint_length_ft column doesn't exist)
--
-- Purpose: Find all COMPLETED trucking loads that don't have inventory records
--          and create simplified inventory entries for them.
--
-- Safety Features:
-- - Idempotent: Safe to run multiple times
-- - Read-only analysis mode available
-- - Detailed logging of all actions
-- - Transaction-based (all-or-nothing)
--
-- Usage:
-- 1. Run in analysis mode first (set run_mode = 'ANALYZE')
-- 2. Review the output to see what would be backfilled
-- 3. Run in execute mode (set run_mode = 'EXECUTE') to apply changes
--
-- ============================================================================

DO $$
DECLARE
    -- CONFIGURATION: Set to 'ANALYZE' to preview, 'EXECUTE' to apply changes
    run_mode TEXT := 'ANALYZE';  -- Change to 'EXECUTE' to actually backfill

    -- Counters
    loads_found INTEGER := 0;
    loads_processed INTEGER := 0;
    inventory_created INTEGER := 0;

    -- Record variables
    load_record RECORD;
    current_ts TIMESTAMPTZ := NOW();
BEGIN
    RAISE NOTICE '============================================================================';
    RAISE NOTICE 'BACKFILL COMPLETED LOADS INVENTORY - %', run_mode;
    RAISE NOTICE 'Started at: %', current_ts;
    RAISE NOTICE '============================================================================';
    RAISE NOTICE '';

    -- ========================================================================
    -- STEP 1: Find COMPLETED loads without inventory
    -- ========================================================================
    RAISE NOTICE 'STEP 1: Analyzing COMPLETED loads...';
    RAISE NOTICE '';

    FOR load_record IN
        SELECT
            tl.id AS load_id,
            tl.storage_request_id,
            tl.sequence_number,
            tl.total_joints_completed,
            tl.total_joints_planned,
            tl.total_length_ft_planned,
            tl.total_length_ft_completed,
            -- Calculate avg joint length from available data
            CASE
                WHEN tl.total_joints_completed > 0 AND tl.total_length_ft_completed > 0
                THEN tl.total_length_ft_completed / tl.total_joints_completed
                WHEN tl.total_joints_planned > 0 AND tl.total_length_ft_planned > 0
                THEN tl.total_length_ft_planned / tl.total_joints_planned
                ELSE 30.0  -- Default to 30 ft if no data available
            END AS avg_joint_length_ft,
            tl.completed_at,
            sr.company_id,
            sr.reference_id AS request_reference,
            c.name AS company_name,
            -- Count existing inventory
            (SELECT COUNT(*) FROM inventory WHERE delivery_truck_load_id = tl.id) AS existing_inventory_count
        FROM trucking_loads tl
        INNER JOIN storage_requests sr ON sr.id = tl.storage_request_id
        INNER JOIN companies c ON c.id = sr.company_id
        WHERE tl.status = 'COMPLETED'
          AND tl.completed_at IS NOT NULL
        ORDER BY tl.completed_at ASC
    LOOP
        loads_found := loads_found + 1;

        -- Check if this load already has inventory
        IF load_record.existing_inventory_count > 0 THEN
            RAISE NOTICE '[SKIP] Load #% (%) - Already has % inventory records',
                load_record.sequence_number,
                load_record.load_id,
                load_record.existing_inventory_count;
            CONTINUE;
        END IF;

        -- This load needs backfill
        RAISE NOTICE '[NEEDS BACKFILL] Load #% (%)',
            load_record.sequence_number,
            load_record.load_id;
        RAISE NOTICE '  Company: %', load_record.company_name;
        RAISE NOTICE '  Request: %', load_record.request_reference;
        RAISE NOTICE '  Completed: %', load_record.completed_at;
        RAISE NOTICE '  Joints: % (planned: %)',
            COALESCE(load_record.total_joints_completed, load_record.total_joints_planned, 0),
            load_record.total_joints_planned;
        RAISE NOTICE '  Total Length: % ft (planned: % ft)',
            load_record.total_length_ft_completed,
            load_record.total_length_ft_planned;
        RAISE NOTICE '  Calculated Avg Length: % ft', load_record.avg_joint_length_ft;

        -- ====================================================================
        -- STEP 2: Create inventory record (if in EXECUTE mode)
        -- ====================================================================
        IF run_mode = 'EXECUTE' THEN
            DECLARE
                joints_qty INTEGER := COALESCE(load_record.total_joints_completed, load_record.total_joints_planned, 0);
                avg_length_ft NUMERIC := load_record.avg_joint_length_ft;
            BEGIN
                -- Only process if we have a valid quantity
                IF joints_qty > 0 THEN
                    INSERT INTO inventory (
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
                        drop_off_timestamp,
                        created_at
                    )
                    VALUES (
                        load_record.company_id,
                        load_record.storage_request_id,
                        'BACKFILL-' || load_record.load_id::TEXT,
                        'Drill Pipe',
                        'Unknown',
                        0,  -- OD unknown
                        0,  -- Weight unknown
                        avg_length_ft,
                        joints_qty,
                        'IN_STORAGE',  -- Assume still in storage (may need manual review)
                        NULL,  -- Rack unknown - admin should assign manually
                        load_record.load_id,
                        load_record.completed_at,
                        current_ts
                    );

                    loads_processed := loads_processed + 1;
                    inventory_created := inventory_created + 1;

                    RAISE NOTICE '  ✓ Created inventory record: % joints, % ft avg length',
                        joints_qty,
                        avg_length_ft;
                ELSE
                    RAISE WARNING '  ⚠ Skipped: No quantity data available (joints_completed=%, joints_planned=%)',
                        load_record.total_joints_completed,
                        load_record.total_joints_planned;
                END IF;
            END;
        ELSE
            -- Analysis mode - just count what would be processed
            IF COALESCE(load_record.total_joints_completed, load_record.total_joints_planned, 0) > 0 THEN
                loads_processed := loads_processed + 1;
                inventory_created := inventory_created + 1;
                RAISE NOTICE '  → Would create inventory record';
            ELSE
                RAISE WARNING '  ⚠ Would skip: No quantity data';
            END IF;
        END IF;

        RAISE NOTICE '';
    END LOOP;

    -- ========================================================================
    -- STEP 3: Summary Report
    -- ========================================================================
    RAISE NOTICE '============================================================================';
    RAISE NOTICE 'SUMMARY';
    RAISE NOTICE '============================================================================';
    RAISE NOTICE 'Mode: %', run_mode;
    RAISE NOTICE 'Total COMPLETED loads found: %', loads_found;
    RAISE NOTICE 'Loads requiring backfill: %', loads_processed;
    RAISE NOTICE 'Inventory records %: %',
        CASE WHEN run_mode = 'EXECUTE' THEN 'created' ELSE 'that would be created' END,
        inventory_created;
    RAISE NOTICE '';

    IF run_mode = 'ANALYZE' THEN
        RAISE NOTICE '⚠ ANALYSIS MODE - No changes were made';
        RAISE NOTICE '  To apply changes, set run_mode = ''EXECUTE'' and run again';
    ELSE
        RAISE NOTICE '✓ EXECUTION COMPLETE';
        RAISE NOTICE '  % inventory records created', inventory_created;
        RAISE NOTICE '';
        RAISE NOTICE 'IMPORTANT NEXT STEPS:';
        RAISE NOTICE '1. Review created inventory records:';
        RAISE NOTICE '   SELECT * FROM inventory WHERE reference_id LIKE ''BACKFILL-%'';';
        RAISE NOTICE '';
        RAISE NOTICE '2. Assign racks to backfilled inventory (storage_area_id is NULL):';
        RAISE NOTICE '   UPDATE inventory SET storage_area_id = ''A-A1-01''';
        RAISE NOTICE '   WHERE reference_id LIKE ''BACKFILL-%'' AND storage_area_id IS NULL;';
        RAISE NOTICE '';
        RAISE NOTICE '3. Update rack occupancy for assigned inventory:';
        RAISE NOTICE '   Run rack occupancy recalculation or use ManualRackAdjustmentModal';
    END IF;

    RAISE NOTICE '============================================================================';
    RAISE NOTICE 'Completed at: %', NOW();
    RAISE NOTICE '============================================================================';

END $$;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- 1. Show all backfilled inventory
-- SELECT
--     i.id,
--     i.reference_id,
--     i.quantity,
--     i.length,
--     i.status,
--     i.storage_area_id,
--     c.name AS company_name,
--     sr.reference_id AS request_reference,
--     tl.sequence_number AS load_number
-- FROM inventory i
-- INNER JOIN companies c ON c.id = i.company_id
-- INNER JOIN storage_requests sr ON sr.id = i.request_id
-- INNER JOIN trucking_loads tl ON tl.id = i.delivery_truck_load_id
-- WHERE i.reference_id LIKE 'BACKFILL-%'
-- ORDER BY i.created_at DESC;

-- 2. Check for COMPLETED loads still missing inventory (should be 0 after backfill)
-- SELECT
--     tl.id,
--     tl.sequence_number,
--     tl.completed_at,
--     c.name AS company_name,
--     (SELECT COUNT(*) FROM inventory WHERE delivery_truck_load_id = tl.id) AS inventory_count
-- FROM trucking_loads tl
-- INNER JOIN storage_requests sr ON sr.id = tl.storage_request_id
-- INNER JOIN companies c ON c.id = sr.company_id
-- WHERE tl.status = 'COMPLETED'
--   AND tl.completed_at IS NOT NULL
--   AND NOT EXISTS (
--       SELECT 1 FROM inventory WHERE delivery_truck_load_id = tl.id
--   )
-- ORDER BY tl.completed_at ASC;

-- 3. Summary stats
-- SELECT
--     COUNT(*) AS total_completed_loads,
--     COUNT(*) FILTER (WHERE has_inventory) AS loads_with_inventory,
--     COUNT(*) FILTER (WHERE NOT has_inventory) AS loads_without_inventory
-- FROM (
--     SELECT
--         tl.id,
--         EXISTS(SELECT 1 FROM inventory WHERE delivery_truck_load_id = tl.id) AS has_inventory
--     FROM trucking_loads tl
--     WHERE tl.status = 'COMPLETED'
-- ) stats;
