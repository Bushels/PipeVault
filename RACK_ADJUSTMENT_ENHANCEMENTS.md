# Manual Rack Adjustment - Enhancement Considerations

## Deployment Status ✅

The manual rack adjustment feature has been successfully deployed to production:

- ✅ Function `manually_adjust_rack_occupancy` created as SECURITY DEFINER
- ✅ Permissions: revoked from public, granted to authenticated
- ✅ Admin validation via `admin_users` table using JWT email claim
- ✅ Capacity validation, reason enforcement (10 char min)
- ✅ Atomic updates to `racks` table with `updated_at = NOW()` for traceability
- ✅ Audit logging to `rack_occupancy_adjustments` table
- ✅ JSON summary returned on success

---

## Enhancement Question 1: RLS Policies on `racks` Table

### Question
> Add RLS policies on public.racks to ensure only this function can update occupancy?

### Analysis

**Current Security Posture**:
The `racks` table likely already has RLS enabled with policies that:
- Allow SELECT for authenticated users (to view storage visualization)
- Have NO explicit INSERT/UPDATE/DELETE policies for regular users
- Therefore, regular users **cannot** directly update racks

**SECURITY DEFINER Functions Bypass RLS**:
All three occupancy-modifying functions use SECURITY DEFINER:
1. `manually_adjust_rack_occupancy()` - Manual admin adjustments
2. `mark_load_completed_and_create_inventory()` - Inbound load completion
3. `mark_outbound_load_completed_and_clear_rack()` - Outbound pickup completion

These functions execute with the privileges of the function owner (typically the database owner), which **bypasses RLS policies entirely**.

### Recommendation: **NOT NEEDED** ✅

**Why**:
1. **RLS already prevents direct client updates** - No UPDATE policy exists for regular users
2. **SECURITY DEFINER functions bypass RLS** - All three functions can update regardless of RLS
3. **Adding restrictive RLS would NOT affect these functions** - They already bypass RLS
4. **Current design is secure** - Only admins (via function validation) or automated workflows can update occupancy

**What's Already Protecting Us**:
- Frontend uses `supabase.rpc()` to call functions (not direct `.update()`)
- Functions validate authorization internally (admin check, cross-tenant checks)
- Transaction atomicity ensures data consistency
- Audit trail logs all manual changes

**Verdict**: The current security model is appropriate. Adding explicit RLS policies to "lock down" the racks table would be redundant and wouldn't add meaningful security since SECURITY DEFINER functions already bypass RLS.

---

## Enhancement Question 2: Atomic Move Between Racks Function

### Question
> Create a complementary function to move joints between two racks in one call, auditing both changes atomically?

### Analysis

**Use Case**:
Admin needs to physically move pipe from Rack A1-10 to Rack B-3:
- Current approach: Two separate adjustments (decrement source, increment destination)
- Proposed: Single atomic operation with linked audit entries

**Benefits of Dedicated Move Function**:

1. **Atomicity Guarantee**:
   - Both racks updated in single transaction (all-or-nothing)
   - Prevents partial moves (e.g., decremented source but forgot destination)

2. **Better Audit Trail**:
   - Single audit entry linking source → destination
   - Clear context: "Moved 50 joints from A1-10 to B-3" (vs two separate "adjusted" entries)
   - Easier to trace physical movements in audit history

3. **Data Integrity**:
   - Validates source has sufficient occupancy before decrement
   - Validates destination has sufficient capacity before increment
   - Prevents "lost" inventory (sum of all racks remains constant)

4. **User Experience**:
   - Admin doesn't have to remember to adjust both racks
   - Single form: "Move X joints from Rack Y to Rack Z"
   - Reduces human error

**Drawbacks**:
- Additional complexity (new function, new UI modal)
- Current two-step approach already works (manual but functional)
- Not frequently needed (most adjustments are corrections, not moves)

### Recommendation: **OPTIONAL - NICE TO HAVE** 🟡

**Priority**: Low to Medium

**When to implement**:
- If admins frequently move pipe between racks in the yard
- If audit trail clarity becomes important for compliance
- If the two-step manual process causes errors or confusion

**When to skip**:
- If physical moves are rare (corrections are more common)
- If current two-step approach is sufficient
- If development resources are better spent on other features (e.g., outbound workflow)

### Implementation Preview

If you decide to implement, here's the function signature:

```sql
CREATE OR REPLACE FUNCTION public.move_joints_between_racks(
    p_source_rack_id TEXT,
    p_destination_rack_id TEXT,
    p_joints_to_move INTEGER,
    p_meters_to_move NUMERIC,
    p_reason TEXT
)
RETURNS JSON AS $$
DECLARE
    v_admin_email TEXT := auth.jwt()->>'email';
    v_source_old_joints INTEGER;
    v_source_old_meters NUMERIC;
    v_dest_old_joints INTEGER;
    v_dest_old_meters NUMERIC;
    v_dest_capacity_joints INTEGER;
    v_dest_capacity_meters NUMERIC;
BEGIN
    -- Validate admin access
    IF NOT EXISTS (SELECT 1 FROM public.admin_users WHERE email = v_admin_email) THEN
        RAISE EXCEPTION 'Unauthorized: Only admins can move joints between racks.';
    END IF;

    -- Validate reason
    IF p_reason IS NULL OR char_length(p_reason) < 10 THEN
        RAISE EXCEPTION 'A descriptive reason of at least 10 characters is required.';
    END IF;

    -- Get source rack state
    SELECT occupied, occupied_meters
    INTO v_source_old_joints, v_source_old_meters
    FROM public.racks
    WHERE id = p_source_rack_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Source rack % not found.', p_source_rack_id;
    END IF;

    -- Validate source has sufficient occupancy
    IF v_source_old_joints < p_joints_to_move THEN
        RAISE EXCEPTION 'Source rack % only has % joints (trying to move %)',
            p_source_rack_id, v_source_old_joints, p_joints_to_move;
    END IF;

    IF v_source_old_meters < p_meters_to_move THEN
        RAISE EXCEPTION 'Source rack % only has % meters (trying to move %)',
            p_source_rack_id, v_source_old_meters, p_meters_to_move;
    END IF;

    -- Get destination rack state and capacity
    SELECT occupied, occupied_meters, capacity, capacity_meters
    INTO v_dest_old_joints, v_dest_old_meters, v_dest_capacity_joints, v_dest_capacity_meters
    FROM public.racks
    WHERE id = p_destination_rack_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Destination rack % not found.', p_destination_rack_id;
    END IF;

    -- Validate destination has sufficient capacity
    IF (v_dest_old_joints + p_joints_to_move) > v_dest_capacity_joints THEN
        RAISE EXCEPTION 'Destination rack % would exceed capacity (% + % > %)',
            p_destination_rack_id, v_dest_old_joints, p_joints_to_move, v_dest_capacity_joints;
    END IF;

    IF (v_dest_old_meters + p_meters_to_move) > v_dest_capacity_meters THEN
        RAISE EXCEPTION 'Destination rack % would exceed capacity in meters',
            p_destination_rack_id;
    END IF;

    -- ATOMIC OPERATION: Decrement source
    UPDATE public.racks
    SET
        occupied = occupied - p_joints_to_move,
        occupied_meters = occupied_meters - p_meters_to_move,
        updated_at = NOW()
    WHERE id = p_source_rack_id;

    -- ATOMIC OPERATION: Increment destination
    UPDATE public.racks
    SET
        occupied = occupied + p_joints_to_move,
        occupied_meters = occupied_meters + p_meters_to_move,
        updated_at = NOW()
    WHERE id = p_destination_rack_id;

    -- Log the movement (single audit entry with source/destination context)
    INSERT INTO public.rack_move_audit (
        source_rack_id,
        destination_rack_id,
        moved_by,
        reason,
        joints_moved,
        meters_moved,
        source_before_joints,
        source_after_joints,
        dest_before_joints,
        dest_after_joints
    )
    VALUES (
        p_source_rack_id,
        p_destination_rack_id,
        v_admin_email,
        p_reason,
        p_joints_to_move,
        p_meters_to_move,
        v_source_old_joints,
        v_source_old_joints - p_joints_to_move,
        v_dest_old_joints,
        v_dest_old_joints + p_joints_to_move
    );

    -- Return summary
    RETURN json_build_object(
        'operation', 'move',
        'source_rack', p_source_rack_id,
        'destination_rack', p_destination_rack_id,
        'joints_moved', p_joints_to_move,
        'meters_moved', p_meters_to_move,
        'moved_by', v_admin_email,
        'moved_at', NOW()
    );

EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Rack move operation failed [%]: %', SQLSTATE, SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Additional Requirements**:
1. New audit table: `rack_move_audit` (separate from `rack_occupancy_adjustments`)
2. New UI modal: `MoveJointsBetweenRacksModal` with source/destination dropdowns
3. Updated UI: "Move to..." context menu option in Storage tab

---

## Summary & Recommendations

### Question 1: RLS Policies
**Answer**: ❌ **Not needed** - Current security model is already appropriate. SECURITY DEFINER functions bypass RLS, and regular users cannot directly update racks due to lack of UPDATE policies.

### Question 2: Move Between Racks Function
**Answer**: 🟡 **Nice to have, but not critical** - Implement if:
- Physical rack moves are frequent
- Audit trail clarity is important for compliance
- Two-step manual process causes errors

**Otherwise**: Current two-step approach (adjust source, adjust destination) is functional and sufficient.

---

## Current Priority: Outbound Workflow

**Recommendation**: Focus on completing the **outbound workflow** components first (OutboundShipmentWizard, MarkPickedUpModal, etc.) before adding the "move between racks" enhancement.

**Reasoning**:
- Outbound workflow is core business functionality (customer-facing)
- Move between racks is admin convenience feature (internal tooling)
- Current manual rack adjustment feature is already production-ready
- Can revisit move function later if admin feedback indicates it's needed

---

## Next Steps

1. ✅ **Deploy manual rack adjustment** - Already complete
2. ✅ **Test the feature** - Click racks in Storage tab to verify
3. ⏭️ **Continue outbound workflow** - OutboundShipmentWizard, admin tiles, etc.
4. 🔄 **Gather admin feedback** - Monitor how frequently admins need to move pipe between racks
5. 🔮 **Future enhancement** - Implement move function if usage patterns indicate need

---

**Decision**: Your call on whether to proceed with the move function now or defer it. I recommend deferring and continuing with outbound workflow, but I can implement it quickly if you prefer.
