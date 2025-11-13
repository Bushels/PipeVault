-- ============================================================================
-- MIGRATION: Create Manual Rack Adjustment Function
-- ============================================================================
--
-- Purpose: Create a secure RPC function to handle manual rack adjustments.
--          This function updates rack occupancy and logs the change to the audit table.
--
-- Security: SECURITY DEFINER ensures admin-only access
-- Atomicity: All changes wrapped in transaction
--
-- ============================================================================

CREATE OR REPLACE FUNCTION public.manually_adjust_rack_occupancy(
    p_rack_id TEXT,
    p_new_joints INTEGER,
    p_new_meters NUMERIC,
    p_reason TEXT
)
RETURNS JSON AS $$
DECLARE
    v_rack_capacity_joints INTEGER;
    v_rack_capacity_meters NUMERIC;
    v_old_joints INTEGER;
    v_old_meters NUMERIC;
    v_admin_email TEXT := auth.jwt()->>'email';
BEGIN
    -- ========================================================================
    -- STEP 1: Verify admin access
    -- ========================================================================
    IF NOT EXISTS (SELECT 1 FROM public.admin_users WHERE email = v_admin_email) THEN
        RAISE EXCEPTION 'Unauthorized: Only admins can manually adjust rack occupancy.';
    END IF;

    -- ========================================================================
    -- STEP 2: Get current rack state and capacity
    -- ========================================================================
    SELECT capacity, capacity_meters, occupied, occupied_meters
    INTO v_rack_capacity_joints, v_rack_capacity_meters, v_old_joints, v_old_meters
    FROM public.racks
    WHERE id = p_rack_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Rack with ID % not found.', p_rack_id;
    END IF;

    -- ========================================================================
    -- STEP 3: Validation
    -- ========================================================================
    IF p_new_joints > v_rack_capacity_joints THEN
        RAISE EXCEPTION 'New joints (%) exceed rack capacity (%). Max capacity: % joints.',
            p_new_joints, v_rack_capacity_joints, v_rack_capacity_joints;
    END IF;

    IF p_new_meters > v_rack_capacity_meters THEN
        RAISE EXCEPTION 'New meters (%) exceed rack capacity (%). Max capacity: % meters.',
            p_new_meters, v_rack_capacity_meters, v_rack_capacity_meters;
    END IF;

    IF p_new_joints < 0 OR p_new_meters < 0 THEN
        RAISE EXCEPTION 'Occupancy values cannot be negative.';
    END IF;

    IF p_reason IS NULL OR char_length(p_reason) < 10 THEN
        RAISE EXCEPTION 'A descriptive reason of at least 10 characters is required for manual adjustments.';
    END IF;

    -- ========================================================================
    -- STEP 4: Update the rack occupancy atomically
    -- ========================================================================
    UPDATE public.racks
    SET
        occupied = p_new_joints,
        occupied_meters = p_new_meters
    WHERE id = p_rack_id;

    -- ========================================================================
    -- STEP 5: Log the event to the audit table
    -- ========================================================================
    INSERT INTO public.rack_occupancy_adjustments (
        rack_id,
        adjusted_by,
        reason,
        old_joints_occupied,
        new_joints_occupied,
        old_meters_occupied,
        new_meters_occupied
    )
    VALUES (
        p_rack_id,
        v_admin_email,
        p_reason,
        v_old_joints,
        p_new_joints,
        v_old_meters,
        p_new_meters
    );

    -- ========================================================================
    -- STEP 6: Return summary
    -- ========================================================================
    RETURN json_build_object(
        'rack_id', p_rack_id,
        'old_joints', v_old_joints,
        'new_joints', p_new_joints,
        'old_meters', v_old_meters,
        'new_meters', p_new_meters,
        'adjusted_by', v_admin_email,
        'adjusted_at', NOW()
    );

-- If any step fails, the entire transaction is automatically rolled back
EXCEPTION
    WHEN OTHERS THEN
        -- Re-raise the exception with enhanced context
        RAISE EXCEPTION 'Manual rack adjustment failed [%]: %', SQLSTATE, SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- PERMISSIONS: Grant execute to authenticated users only
-- ============================================================================
REVOKE EXECUTE ON FUNCTION public.manually_adjust_rack_occupancy(TEXT, INTEGER, NUMERIC, TEXT) FROM public;
GRANT EXECUTE ON FUNCTION public.manually_adjust_rack_occupancy(TEXT, INTEGER, NUMERIC, TEXT) TO authenticated;

-- ============================================================================
-- COMMENTS: Document the function for future reference
-- ============================================================================
COMMENT ON FUNCTION public.manually_adjust_rack_occupancy IS
'Securely adjusts rack occupancy with full audit trail. Admin-only access. Use cases: pipe physically moved between racks, data corrections, emergency capacity adjustments. All changes logged to rack_occupancy_adjustments table.';

-- ============================================================================
-- VERIFICATION TEST QUERY
-- ============================================================================
-- Test the function signature exists and is callable (run as admin):
-- SELECT public.manually_adjust_rack_occupancy(
--     'A-A1-5'::TEXT,
--     25::INTEGER,
--     780.5::NUMERIC,
--     'Manual adjustment for testing - pipe physically moved from A-A1-10'::TEXT
-- );

-- View audit history:
-- SELECT * FROM rack_occupancy_adjustments ORDER BY adjusted_at DESC LIMIT 10;

-- ============================================================================
-- SUCCESS CRITERIA
-- ============================================================================
-- ✅ Function validates admin access before any changes
-- ✅ Function validates rack exists and capacity not exceeded
-- ✅ Function requires reason minimum 10 characters
-- ✅ Function updates rack occupancy atomically
-- ✅ Function logs change to audit table
-- ✅ Function returns summary JSON
-- ✅ All operations wrapped in transaction (rollback on failure)
-- ✅ Only admins can execute function
-- ============================================================================
