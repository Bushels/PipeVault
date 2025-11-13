# Inbound Trucking Workflow Analysis
**Date**: 2025-11-07
**Agents**: Customer Journey Agent, Database Integrity Agent, Integration & Events Agent

---

## Executive Summary

Analyzed the complete inbound trucking workflow from customer booking through admin verification. **Foundation is solid** with 80% of components implemented, but **missing critical verification and approval workflow** between customer and admin.

### Status Overview
- ✅ **Exists**: Customer booking wizard, AI document processing, time slot selection, database schema
- ❌ **Missing**: Customer verification buttons, admin load verification UI, sequential load blocking, state transition notifications
- ⚠️ **Partial**: Admin dashboard has general features but lacks load-specific verification

---

## Current Workflow Components

### ✅ Customer Side (Implemented)

**InboundShipmentWizard.tsx** - 8-step wizard:
1. **Storage Info**: Company, contact, address
2. **Method**: MPS_QUOTE or CUSTOMER_PROVIDED
3. **Trucking**: Company and driver details
4. **Time Slot**: Conflict-prevented calendar picker
5. **Documents**: Drag-drop upload (PDF, JPG, PNG)
6. **Review**: Load summary (joints, length, weight)
7. **Confirmation**: Success message
8. **Quote Pending**: If MPS quote requested

**Key Features**:
- AI document processing via Google Gemini Vision API ([manifestProcessingService.ts](../utils/manifestProcessingService.ts))
- Extracts: manufacturer, heat_number, serial_number, tally_length_ft, quantity
- Load summary calculation (automatic totals)
- Time slot picker with MPS hours (7am-4pm weekdays)
- After-hours surcharge handling ($450)
- 14-day booking window
- Blocked slots for conflict prevention

### ✅ Database Schema (Ready)

**trucking_loads** table:
```sql
id, storage_request_id, direction (INBOUND/OUTBOUND)
sequence_number (1, 2, 3... for Load tracking)
status: 'NEW' | 'APPROVED' | 'IN_TRANSIT' | 'COMPLETED' | 'CANCELLED'
scheduled_slot_start, scheduled_slot_end
trucking_company, driver_name, driver_phone
total_joints_planned, total_length_ft_planned, total_weight_lbs_planned
approved_at, completed_at
```

**Related tables**: trucking_documents, shipments, dock_appointments, shipment_trucks

### ✅ Existing Slack Notifications

- `sendInboundDeliveryNotification` - Initial booking (includes customer name, company, load details, AI summary)

---

## Missing Features (Implementation Required)

### ❌ Priority 1: Customer Verification Step

**Current State**: After seeing load summary, wizard auto-submits to next step
**Expected**: Two-button verification:
- "Verify - This is Correct" → Proceeds normally
- "Incorrect, Notify MPS" → Sends Slack alert to admin

**Slack Notification Needed**:
```typescript
sendManifestIssueNotification({
  referenceId: string;
  companyName: string;
  loadNumber: number;
  issueDescription: string;
  documentNames: string[];
})
```

**Implementation Location**: LoadSummaryReview.tsx or InboundShipmentWizard.tsx review step

---

### ❌ Priority 2: Admin Load Verification UI

**Current State**: AdminDashboard has general request approval, no load-specific verification
**Expected**:
- "Pending Loads" tab in admin dashboard
- Show all loads with status = 'NEW'
- Display AI-extracted data side-by-side with raw document
- "Approve Load" button → Sets status to 'APPROVED', updates approved_at timestamp
- "Request Correction" button → Notifies customer

**Missing Admin Views**:
- No way to see AI-extracted manifest data (ManifestItem[] array)
- No per-load verification interface
- No status badges (NEW vs APPROVED vs IN_TRANSIT)
- No clear sequence_number display (Load #1, #2, #3)

**Database Update Needed**:
```typescript
// When admin clicks "Approve Load"
await supabase
  .from('trucking_loads')
  .update({
    status: 'APPROVED',
    approved_at: new Date().toISOString()
  })
  .eq('id', loadId);
```

---

### ❌ Priority 3: Sequential Load Blocking

**Current State**: Customer can book Load #1, #2, #3 simultaneously
**Expected**: Customer must wait for admin to approve Load #1 before booking Load #2

**Implementation**:
```typescript
// In InboundShipmentWizard.tsx - before allowing booking
const checkCanBookNextLoad = async () => {
  const existingLoads = request.truckingLoads ?? [];
  const inboundLoads = existingLoads.filter(l => l.direction === 'INBOUND');

  // Check if all previous loads are APPROVED or COMPLETED
  const hasUnapproved = inboundLoads.some(
    load => load.status === 'NEW'
  );

  if (hasUnapproved) {
    return {
      canBook: false,
      message: 'Please wait for MPS to verify your previous load before booking another.'
    };
  }

  return { canBook: true };
};
```

**UI Changes Needed**:
- Show "Waiting for Load #1 approval..." message
- Disable "Book Another Load" button until previous approved
- Display status indicator on customer dashboard tile

---

### ❌ Priority 4: State Transition Notifications

**Current State**: Only notification at initial booking (NEW status)
**Expected**: Slack notifications for each state change

**Missing Notifications**:

1. **NEW → APPROVED** (Admin verifies load):
```
✅ Load #1 Approved
Company: Acme Oil & Gas
Reference: ABC-123
Time Slot: Nov 10, 2025 @ 8:00 AM
Joints: 100 | Length: 1,200 ft | Weight: 24,000 lbs
```

2. **APPROVED → IN_TRANSIT** (Truck departs):
```
🚛 Load #1 In Transit
Driver: John Doe
Company: Fast Trucking
Expected Arrival: Nov 10, 2025 @ 8:00 AM
```

3. **IN_TRANSIT → COMPLETED** (Truck received at MPS):
```
✅ Load #1 Completed
Arrival Time: Nov 10, 2025 @ 8:15 AM
Actual Joints: 100
Status: All pipe received
```

4. **Any → CANCELLED**:
```
❌ Load #1 Cancelled
Reason: Customer rescheduled
Original Time Slot: Nov 10, 2025 @ 8:00 AM
```

---

## State Machine

### Current Flow
```
NEW → APPROVED → IN_TRANSIT → COMPLETED
  ↓
CANCELLED (from any state)
```

### State Descriptions

| State | Trigger | Who Sets | Slack? | Next State |
|-------|---------|----------|--------|------------|
| **NEW** | Customer books load | Customer (auto) | ✅ YES | APPROVED |
| **APPROVED** | Admin verifies load | Admin | ❌ MISSING | IN_TRANSIT |
| **IN_TRANSIT** | Truck departs storage | Admin | ❌ MISSING | COMPLETED |
| **COMPLETED** | Truck arrives at MPS | Admin | ❌ MISSING | (final) |
| **CANCELLED** | Cancellation requested | Either | ❌ MISSING | (final) |

---

## Files Involved

### Customer Side
- [InboundShipmentWizard.tsx](../components/InboundShipmentWizard.tsx) - Main wizard
- [LoadSummaryReview.tsx](../components/LoadSummaryReview.tsx) - Summary display
- [DocumentUploadStep.tsx](../components/DocumentUploadStep.tsx) - File upload
- [TimeSlotPicker.tsx](../components/TimeSlotPicker.tsx) - Calendar selection
- [TruckingMethodStep.tsx](../components/TruckingMethodStep.tsx) - Method selection
- [TruckingDriverStep.tsx](../components/TruckingDriverStep.tsx) - Driver info

### Services
- [manifestProcessingService.ts](../utils/manifestProcessingService.ts) - AI document parsing
- [slackService.ts](../utils/slackService.ts) - Slack notifications
- [useSupabaseData.ts](../hooks/useSupabaseData.ts) - Database queries

### Admin Side
- [AdminDashboard.tsx](../components/admin/AdminDashboard.tsx) - Main dashboard
- [TruckReceiving.tsx](../components/TruckReceiving.tsx) - Manual receiving (different workflow)

---

## Implementation Roadmap

### Phase 1: Customer Verification (2-4 hours)
- [ ] Add "Verify" / "Incorrect" buttons to LoadSummaryReview.tsx
- [ ] Create `sendManifestIssueNotification()` in slackService.ts
- [ ] Add issue description modal for customer input
- [ ] Test customer can report issues

### Phase 2: Admin Verification UI (4-6 hours)
- [ ] Add "Pending Loads" tab to AdminDashboard.tsx
- [ ] Create LoadVerificationPanel component
- [ ] Display AI-extracted data with raw document
- [ ] Add "Approve Load" button (updates status to APPROVED)
- [ ] Add "Request Correction" button (notifies customer)
- [ ] Test admin can approve loads

### Phase 3: Sequential Blocking (2-3 hours)
- [ ] Add `checkCanBookNextLoad()` validation in InboundShipmentWizard
- [ ] Show "waiting for approval" message on customer dashboard
- [ ] Disable "Book Another Load" button until previous approved
- [ ] Test Load #2 cannot be booked until Load #1 approved

### Phase 4: State Transition Notifications (3-4 hours)
- [ ] Create `sendLoadApprovedNotification()`
- [ ] Create `sendLoadInTransitNotification()`
- [ ] Create `sendLoadCompletedNotification()`
- [ ] Create `sendLoadCancelledNotification()`
- [ ] Add database triggers or function hooks for status changes
- [ ] Test all 4 notification types

---

## Testing Checklist

### Customer Workflow
- [ ] Book Load #1 with documents
- [ ] See load summary (joints, weight, length)
- [ ] Click "Verify" → Proceeds to confirmation
- [ ] Book Load #1 again but click "Incorrect, Notify MPS"
- [ ] Verify Slack notification sent to admin
- [ ] Try to book Load #2 before Load #1 approved → Blocked
- [ ] See "waiting for approval" message

### Admin Workflow
- [ ] Receive Slack notification for Load #1 booking
- [ ] Log into admin dashboard
- [ ] See "Pending Loads" tab
- [ ] View Load #1 with AI-extracted data
- [ ] Click "Approve Load" → Status changes to APPROVED
- [ ] Verify customer can now book Load #2
- [ ] Mark Load #1 as IN_TRANSIT
- [ ] Mark Load #1 as COMPLETED
- [ ] Verify Slack notifications sent for each transition

### Edge Cases
- [ ] Cancel load before approval
- [ ] Cancel load after approval
- [ ] Report issue after initial verification
- [ ] Book multiple loads for different time slots
- [ ] Handle after-hours surcharge correctly
- [ ] Prevent double-booking same time slot

---

## Recommendations

1. **Start with Phase 1** - Customer verification is user-facing and blocks workflow
2. **Deploy Phase 2 immediately after** - Admin needs verification UI to complete flow
3. **Phase 3 can be delayed** - Sequential blocking is nice-to-have, not critical
4. **Phase 4 for operational visibility** - Notifications help admin track progress

**Estimated Total Time**: 11-17 hours of development + 4-6 hours testing = ~2-3 days

---

## Next Steps

1. User reviews this analysis
2. User confirms priorities and timeline
3. Implement Phase 1 (customer verification)
4. Test with real documents
5. Implement Phase 2 (admin verification)
6. Test end-to-end workflow
7. Deploy to production
8. Implement Phases 3-4 based on operational needs
