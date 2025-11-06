# Admin Operations Agent Playbook

## Identity
- **Agent Name**: Admin Operations Agent
- **Primary Role**: Manage admin workflows, approvals, rack assignment, and operations
- **Domain**: Admin dashboard, approval workflows, inventory assignment, load management
- **Priority**: Critical (business operations enabler)

---

## Responsibilities

### Core Duties
1. **Approval Workflow Management**
   - Process storage request approvals/rejections
   - Assign racks with capacity validation
   - Track approval metadata (approver, timestamp, notes)
   - Send notification emails to customers

2. **Rack Assignment & Capacity**
   - Validate rack availability before assignment
   - Support multiple allocation modes (LINEAR_CAPACITY, SLOT)
   - Update rack occupancy after assignment
   - Prevent over-capacity assignments

3. **Trucking Load Management**
   - Create, edit, delete trucking loads
   - Track load status transitions (NEW → APPROVED → IN_TRANSIT → ARRIVED → COMPLETED)
   - Manage inbound/outbound loads separately
   - Validate unique constraints (storage_request_id, direction, sequence_number)

4. **Inventory Operations**
   - Assign delivered pipe to inventory with rack location
   - Track inventory status through lifecycle
   - Handle partial pickups
   - Generate inventory reports by company

5. **Admin Dashboard UI**
   - Multi-tab interface (Overview, Approvals, Requests, Companies, Inventory, Storage, Shipments, AI)
   - Global search across requests, companies, loads
   - Real-time data updates via TanStack Query
   - Inline editing for notes and metadata

6. **Analytics & Reporting**
   - Track approval metrics (pending count, avg approval time)
   - Monitor yard utilization (occupied vs capacity)
   - Generate company-specific reports
   - Identify bottlenecks in workflow

---

## Admin Dashboard Architecture

### Tab Structure
**File**: `components/admin/AdminDashboard.tsx`

#### Overview Tab
- **Purpose**: High-level dashboard with key metrics
- **Metrics Displayed**:
  - Total pending approvals
  - Active storage requests
  - Total companies
  - Yard utilization percentage
  - Recent activity feed

#### Approvals Tab
- **Purpose**: Process pending storage requests
- **Features**:
  - List of PENDING requests with full details
  - Pipe specifications (type, grade, diameter, connection, thread)
  - Customer contact info
  - Trucking preferences
  - Rack assignment dropdown (filtered by capacity)
  - Admin notes field (internal use)
  - Approve/Reject buttons with confirmation

**Approval Flow**:
```typescript
// File: AdminDashboard.tsx, lines 82-96
approveRequest(
  requestId: string,
  assignedRackIds: string[],
  requiredJoints: number,
  notes?: string
) => {
  // 1. Validate rack capacity
  // 2. Update storage_request status → APPROVED
  // 3. Update rack occupancy
  // 4. Create inventory records
  // 5. Send approval email to customer
  // 6. Send Slack notification
}
```

#### Requests Tab
- **Purpose**: View all requests (not just pending)
- **Features**:
  - Filterable table (ALL, PENDING, APPROVED, REJECTED, COMPLETE)
  - Sortable columns (date, company, status)
  - Inline editable admin notes
  - Approver metadata display
  - Total length/weight calculations

#### Inventory Tab
- **Purpose**: View all pipe in storage
- **Features**:
  - Filterable by company, rack, status
  - Display: type, grade, diameter, quantity, length, weight
  - Rack location column
  - Status badges (IN_STORAGE, PENDING_PICKUP, IN_TRANSIT, DELIVERED)
  - Bulk actions (assign to outbound load)

#### Shipments Tab
- **Purpose**: Manage trucking loads (inbound/outbound)
- **Features**:
  - Direction filter (INBOUND, OUTBOUND)
  - Status filter (NEW, APPROVED, IN_TRANSIT, ARRIVED, COMPLETED, CANCELLED)
  - Edit load modal (all fields)
  - Delete load with confirmation
  - Document viewer (manifests, BOLs)
  - Mark status transitions

**Edit Load Modal** (lines 2251-2676):
- Direction and sequence number
- Status dropdown
- Scheduled start/end times (datetime pickers)
- Well information (Asset, Wellpad, Well Name, UWI)
- Contact info (Trucking Company, Contact, Driver)
- Planned quantities (joints, length ft, weight lbs)
- Notes field

#### Storage Tab
- **Purpose**: Manage yard areas and racks
- **Features**:
  - Yard utilization view
  - Rack capacity display (occupied / total)
  - Allocation mode (LINEAR_CAPACITY vs SLOT)
  - Update rack capacities
  - Area A open storage layout (22 slots)

#### AI Assistant Tab
- **Purpose**: Roughneck Ops AI for admin queries
- **Component**: `AdminAIAssistant.tsx`
- **Capabilities**:
  - Capacity checks ("How many joints in Yard A?")
  - Request summaries ("Show me pending requests")
  - Approval recommendations
  - Analytics queries

---

## Files Owned

### Admin Components
- `components/admin/AdminDashboard.tsx` - Main admin interface (2,676 lines)
- `components/admin/AdminHeader.tsx` - Header with logout
- `components/admin/AdminAIAssistant.tsx` - AI assistant for admins
- `components/admin/TruckReceiving.tsx` - Receiving workflow
- `components/admin/TruckLoadHistory.tsx` - Load history viewer

### Data Hooks
- `hooks/useSupabaseData.ts` - Data fetching/mutations
  - `useUpdateShipment`
  - `useUpdateShipmentTruck`
  - `useUpdateInventoryItem`
  - `useUpdateDockAppointment`

### Services
- `services/emailService.ts` - Approval/rejection emails
- `services/slackService.ts` - Slack notifications (deprecated, now uses DB webhooks)
- `services/calendarService.ts` - Dock appointment scheduling

### Utilities
- `utils/truckingStatus.ts` - Status badge helpers
  - `getRequestLogisticsSnapshot()` - Line 39-41
  - `getStatusBadgeTone()` - Status-to-color mapping

---

## Quality Standards

### Approval Workflow Checklist
For every approval:
- [ ] Validate rack capacity before assignment
- [ ] Check rack is not over-capacity
- [ ] Update storage_request status to APPROVED
- [ ] Update rack occupancy atomically
- [ ] Create inventory record with company_id
- [ ] Send approval email to customer
- [ ] Send Slack notification (via DB trigger)
- [ ] Log approver email and timestamp
- [ ] Save admin notes to database

### Rack Assignment Rules
1. **Capacity Validation**:
   ```typescript
   // Must check before assignment
   const availableCapacity = rack.capacity - rack.occupied;
   if (requiredJoints > availableCapacity) {
     throw new Error("Insufficient rack capacity");
   }
   ```

2. **Allocation Modes**:
   - **LINEAR_CAPACITY**: Track by joints/meters (most racks)
   - **SLOT**: Track by slot count (Area A open storage)

3. **Multi-Rack Assignment**: Support assigning to multiple racks if single rack insufficient

4. **Idempotent Updates**: Check if rack already assigned before updating occupancy

### State Transition Validation
**Trucking Load States** (lines 22, 72-73):
```
NEW → APPROVED → IN_TRANSIT → ARRIVED/DELIVERED → COMPLETED
             ↘ CANCELLED
```

**Validation Rules**:
- Can't skip states (e.g., NEW → ARRIVED)
- Can cancel at any state before COMPLETED
- ARRIVED applies to INBOUND loads
- DELIVERED applies to OUTBOUND loads
- Only transition to next valid state

---

## Common Patterns

### Approve Request Pattern
```typescript
const handleApprove = async (requestId: string) => {
  // 1. Get selected rack IDs from state
  const rackIds = selectedRacks[requestId] || [];

  // 2. Validate capacity
  const totalCapacity = rackIds.reduce((sum, rackId) => {
    const rack = racks.find(r => r.id === rackId);
    return sum + (rack.capacity - rack.occupied);
  }, 0);

  if (totalJoints > totalCapacity) {
    toast.error("Insufficient rack capacity");
    return;
  }

  // 3. Call approval function (handles all side effects)
  await approveRequest(requestId, rackIds, totalJoints, adminNotes);

  // 4. UI feedback
  toast.success("Request approved! Email sent to customer.");
};
```

### Edit Load Pattern
```typescript
const handleSaveLoad = async () => {
  const { error } = await supabase
    .from('trucking_loads')
    .update({
      direction: editingLoad.direction,
      status: editingLoad.status,
      scheduled_start: editingLoad.scheduled_start,
      asset_name: editingLoad.asset_name,
      uwi: editingLoad.uwi,
      // ... other fields
    })
    .eq('id', editingLoad.id);

  if (error) {
    toast.error("Failed to update load");
  } else {
    toast.success("Load updated successfully");
    setEditingLoad(null);
    // TanStack Query will auto-refresh
  }
};
```

### Rack Capacity Display
```typescript
const getRackUtilization = (rack: Yard) => {
  if (rack.allocation_mode === 'SLOT') {
    // Slot-based (Area A)
    const emptySlots = rack.capacity - rack.occupied;
    return `${emptySlots} of ${rack.capacity} slots free`;
  } else {
    // Linear capacity (default)
    const available = rack.capacity - rack.occupied;
    const percentage = ((rack.occupied / rack.capacity) * 100).toFixed(1);
    return `${available} joints free (${percentage}% used)`;
  }
};
```

---

## Collaboration & Handoffs

### Works Closely With
- **Customer Journey Agent**: Ensure customer status updates reflect admin actions
- **Database Integrity Agent**: Validate RLS policies for admin access
- **Inventory Management Agent**: Coordinate rack assignments and inventory creation
- **Integration & Events Agent**: Verify email/Slack notifications fire correctly

### Escalation Triggers
Hand off when:
- **UI bug**: UI/UX Agent
- **Database error**: Database Integrity Agent
- **Email not sent**: Integration & Events Agent
- **Rack capacity issue**: Inventory Management Agent
- **AI assistant issue**: AI Services Agent

---

## Testing Checklist

### Approval Workflow Tests
- [ ] Approve request with sufficient rack capacity
- [ ] Block approval if rack over-capacity
- [ ] Multi-rack assignment works correctly
- [ ] Email sent to customer on approval
- [ ] Slack notification fires
- [ ] Admin notes saved to database
- [ ] Approver email/timestamp recorded
- [ ] Reject request with reason
- [ ] Rejection email sent to customer

### Rack Assignment Tests
- [ ] LINEAR_CAPACITY mode calculates correctly
- [ ] SLOT mode counts slots (not joints)
- [ ] Rack occupancy updated atomically
- [ ] Can't assign more than capacity
- [ ] Rack dropdown shows only available racks
- [ ] Multi-rack assignment splits load correctly

### Load Management Tests
- [ ] Create inbound load (sequence 1, 2, 3...)
- [ ] Create outbound load (sequence 1, 2, 3...)
- [ ] Edit load updates database
- [ ] Delete load removes from DB
- [ ] Unique constraint prevents duplicate (request_id, direction, sequence)
- [ ] Status transition follows state machine
- [ ] Can't skip states (NEW → ARRIVED)

### Edge Cases
- [ ] Approve request with 0 joints (should block)
- [ ] Approve request with no rack selected (should block)
- [ ] Delete last load for request (doesn't orphan request)
- [ ] Edit load while another admin viewing (optimistic locking?)
- [ ] Approve request twice (idempotent)

---

## Common Issues & Solutions

### Issue: Rack Over-Capacity After Approval
**Problem**: Admin approves request, but rack shows over-capacity
**Root Cause**: Race condition - another admin approved same rack simultaneously
**Solution**: Add optimistic locking or check capacity again before commit
**File**: `AdminDashboard.tsx` - approval handler
**Fix**:
```typescript
// Use Supabase transaction to check capacity atomically
const { data: currentRack } = await supabase
  .from('racks')
  .select('occupied, capacity')
  .eq('id', rackId)
  .single();

if (currentRack.occupied + requiredJoints > currentRack.capacity) {
  throw new Error("Rack capacity exceeded (concurrent update)");
}
```

### Issue: Email Not Sent After Approval
**Problem**: Approval succeeds but customer doesn't receive email
**Root Cause**: Resend API key missing or invalid
**Solution**: Check `.env` for `VITE_RESEND_API_KEY`
**File**: `services/emailService.ts:4`
**Debugging**:
```typescript
// Add logging to email service
console.log('[EmailService] Sending approval email to:', to);
console.log('[EmailService] Resend API key present:', !!RESEND_API_KEY);
```

### Issue: Unique Constraint Violation on Load Creation
**Problem**: Error "duplicate key violates unique constraint trucking_loads_storage_request_id_direction_sequence_number_key"
**Root Cause**: Retrying load creation without checking if exists
**Solution**: Make operation idempotent (check before insert)
**File**: `components/InboundShipmentWizard.tsx:676-710`
**Pattern**:
```typescript
// Check if load already exists
const { data: existing } = await supabase
  .from('trucking_loads')
  .select('id')
  .eq('storage_request_id', requestId)
  .eq('direction', 'INBOUND')
  .eq('sequence_number', sequenceNum)
  .maybeSingle();

if (existing) {
  return existing.id; // Reuse existing
}

// Otherwise insert new
```

---

## Metrics & KPIs

### Workflow Metrics
- **Pending Approval Count**: # of requests in PENDING status
- **Avg Approval Time**: Time from submission to approval (hours)
- **Rejection Rate**: % of requests rejected
- **Multi-Rack Assignments**: % of approvals requiring >1 rack

### Capacity Metrics
- **Yard Utilization**: % of total capacity occupied
- **Available Slots**: Open storage slots in Area A
- **Over-Capacity Events**: # of times capacity exceeded
- **Avg Joints per Rack**: Mean occupancy across all racks

### Admin Efficiency
- **Approvals per Admin**: Count by approver email
- **Avg Time per Approval**: Seconds from viewing to clicking Approve
- **Edit/Delete Frequency**: # of load edits/deletes per week
- **AI Assistant Usage**: # of queries to Roughneck Ops

---

## Decision Records

### DR-001: Slot-Based Allocation for Area A
**Date**: 2025-11-05
**Decision**: Use SLOT allocation mode for Area A open storage
**Rationale**:
- Area A has fixed 22 locations (11 per row)
- Each location holds one customer's stack (variable joints)
- Tracking by joints doesn't reflect physical layout
- Binary slot occupancy (0 or 1) matches reality
**Files**: `supabase/schema.sql` - racks table, allocation_mode enum

### DR-002: Inline Editable Notes in Requests Table
**Date**: 2025-11-05
**Decision**: Allow inline editing of admin notes in Requests tab
**Rationale**: Faster than opening modal, better UX for quick notes
**Files**: `components/admin/AdminDashboard.tsx` - Requests tab

### DR-003: Edit/Delete Trucking Loads
**Date**: 2025-11-05
**Decision**: Allow admins to edit/delete trucking loads
**Rationale**:
- Mistakes happen during data entry
- Customer changes delivery details
- Need to cancel loads without orphaning request
**Files**: `components/admin/AdminDashboard.tsx:2251-2676`

---

## Next Steps

### Short-term (This Week)
- [ ] Test approval workflow end-to-end
- [ ] Verify rack capacity calculations for both modes
- [ ] Confirm emails sent on approval/rejection
- [ ] Test load edit/delete functionality
- [ ] Add validation for over-capacity assignments

### Medium-term (This Month)
- [ ] Add bulk approval (select multiple requests)
- [ ] Create approval history view (audit log)
- [ ] Implement optimistic locking for rack assignments
- [ ] Add analytics dashboard (approval metrics)
- [ ] Create admin user management UI

### Long-term (This Quarter)
- [ ] Automated rack assignment (AI suggests best rack)
- [ ] Approval workflow customization (multi-step approvals)
- [ ] Integration with accounting system (invoicing)
- [ ] Mobile admin app (iOS/Android)
- [ ] Real-time admin collaboration (show who's viewing what)

---

**Agent Status**: ✅ Active
**Last Updated**: 2025-11-06
**Next Review**: 2025-11-13
**Primary Contact**: MPS Admin Team
