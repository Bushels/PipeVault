# Customer Journey Agent Playbook

## Identity
- **Agent Name**: Customer Journey Agent
- **Primary Role**: Ensure seamless end-to-end customer experience
- **Domain**: Customer workflow logic, state transitions, user flows
- **Priority**: Critical (core business value)

---

## Responsibilities

### Core Duties
1. **Workflow Orchestration**
   - Ensure customers can complete all steps without friction
   - Validate state transitions are logical
   - Prevent customers from getting stuck

2. **Journey Mapping**
   - Document each step from sign-up to completion
   - Identify pain points and bottlenecks
   - Optimize conversion at each stage

3. **State Management**
   - Track request status throughout lifecycle
   - Ensure status displayed accurately to customer
   - Handle edge cases (network errors, timeouts)

4. **Progress Indicators**
   - Show "Step X of Y" throughout wizards
   - Display milestones and completion percentage
   - Set clear expectations for next steps

5. **Error Recovery**
   - Allow customers to resume incomplete flows
   - Save draft data to prevent data loss
   - Provide clear error messages with solutions

---

## Customer Journey Map

### Stage 1: Discovery & Sign-Up
**Steps**:
1. Land on 4-card homepage
2. Click "Request Pipe Storage"
3. Sign up with email + password
4. Verify email (if required)
5. Select/create company

**Files**:
- `App.tsx` - Landing page routing
- `Auth.tsx` - Sign-up form
- `AuthContext.tsx` - Authentication logic

**Success Criteria**:
- User has authenticated session
- User has company association
- User redirected to dashboard

---

### Stage 2: Storage Request Creation
**Steps**:
1. View dashboard with "Request Pipe Storage" tile
2. Click tile to open `StorageRequestWizard`
3. Enter pipe details:
   - Pipe type, grade, diameter
   - Quantity (joints, length, weight)
   - Connection type (thread)
   - Storage timeline
4. Review and submit request

**Files**:
- `Dashboard.tsx` - Main customer dashboard
- `StorageRequestWizard.tsx` - Request creation wizard
- `types.ts` - StorageRequest interface

**Success Criteria**:
- Storage request created with status `PENDING`
- Customer sees confirmation message
- Admin receives Slack notification

**State Transitions**:
```
NULL → PENDING (after submit)
```

---

### Stage 3: Delivery Scheduling (Inbound)
**Steps**:
1. After request approved, customer clicks "Schedule Delivery to MPS"
2. Opens `InboundShipmentWizard`
3. Step 1: Select trucking method (own vs MPS arranges)
4. Step 2: Enter trucking details (company, contact, driver)
5. Step 3: Create trucking loads (one per truck)
   - Direction: INBOUND
   - Well information (Asset, UWI)
   - Estimated quantities
6. Step 4: Upload manifest documents (per load)
   - AI extraction runs automatically
   - Extracted totals update load record
7. Step 5: Review and confirm

**Files**:
- `InboundShipmentWizard.tsx` - Multi-step wizard
- `DocumentUploadStep.tsx` - Document upload component
- `LoadSummaryReview.tsx` - AI extraction display
- `manifestProcessingService.ts` - AI extraction logic

**Success Criteria**:
- Shipment created with status `SCHEDULING`
- Trucking loads created (status `NEW`)
- Manifests uploaded and AI extracted
- Dock appointments booked (if MPS arranges)
- Customer receives email confirmation

**State Transitions**:
```
Shipment: NULL → SCHEDULING → SCHEDULED → IN_TRANSIT → COMPLETED
Trucking Load: NEW → APPROVED → IN_TRANSIT → ARRIVED → COMPLETED
```

---

### Stage 4: In-Transit Tracking
**Steps**:
1. Customer views dashboard
2. Sees status tile showing "In Transit"
3. Receives email 24hrs before scheduled arrival
4. Can view trucking load details and documents

**Files**:
- `Dashboard.tsx` - Status display
- `RequestDocumentsPanel.tsx` - View documents

**Success Criteria**:
- Real-time status updates
- Email reminders sent
- Document preview works

**State Transitions**:
```
SCHEDULED → IN_TRANSIT (truck departs)
```

---

### Stage 5: Pipe Arrival & Storage
**Steps**:
1. Admin marks load as `ARRIVED` after unloading
2. Admin assigns pipe to inventory (with rack location)
3. Customer sees status change to "In Storage"
4. Customer can view inventory details

**Files**:
- `AdminDashboard.tsx` - Admin marks arrived
- `Dashboard.tsx` - Customer sees updated status

**Success Criteria**:
- All loads marked `ARRIVED`
- Inventory created with company_id, rack assignment
- Storage request status → `APPROVED` (stored)
- Customer receives email: "Your pipe is now in storage"

**State Transitions**:
```
Trucking Load: ARRIVED → COMPLETED
Storage Request: PENDING → APPROVED (all pipe stored)
Inventory: NULL → IN_STORAGE
```

---

### Stage 6: Pickup Scheduling (Outbound)
**Steps**:
1. Customer clicks "Request Pipe Pickup" from dashboard
2. Opens outbound wizard (similar to inbound)
3. Selects which inventory to pick up (can be partial)
4. Creates outbound trucking loads
5. Uploads delivery documents (BOL, destination details)
6. Reviews and submits

**Files**:
- Similar to inbound, but direction: `OUTBOUND`
- `OutboundShipmentWizard.tsx` (if separate component)

**Success Criteria**:
- Outbound trucking loads created
- Inventory status → `PENDING_PICKUP`
- Admin receives notification
- Customer receives confirmation

**State Transitions**:
```
Inventory: IN_STORAGE → PENDING_PICKUP → IN_TRANSIT → DELIVERED
Trucking Load: NEW → APPROVED → IN_TRANSIT → COMPLETED
```

---

### Stage 7: Delivery & Completion
**Steps**:
1. Truck picks up pipe from MPS
2. Delivers to customer site
3. Admin marks load as `DELIVERED`
4. Inventory status → `DELIVERED`
5. When all inventory delivered, storage request → `COMPLETE`
6. Request archived

**Files**:
- `AdminDashboard.tsx` - Mark delivered

**Success Criteria**:
- All loads delivered
- Storage request status → `COMPLETE`
- Customer receives final email: "Your project is complete!"
- Request moved to archive

**State Transitions**:
```
Trucking Load: IN_TRANSIT → COMPLETED
Inventory: IN_TRANSIT → DELIVERED
Storage Request: APPROVED → COMPLETE (all pipe delivered)
```

---

## State Machine Diagram

### Storage Request States
```
NULL
  ↓
PENDING (customer submitted)
  ↓
APPROVED (admin approved, pipe in storage)
  ↓
PICKUP_REQUESTED (customer requested outbound)
  ↓
COMPLETE (all pipe delivered)
  ↓
ARCHIVED
```

### Trucking Load States
```
NEW (just created)
  ↓
APPROVED (admin approved)
  ↓
IN_TRANSIT (truck departed)
  ↓
ARRIVED / DELIVERED (at destination)
  ↓
COMPLETED
```

### Inventory States
```
NULL
  ↓
IN_STORAGE (arrived at MPS)
  ↓
PENDING_PICKUP (outbound requested)
  ↓
IN_TRANSIT (on truck to site)
  ↓
DELIVERED (at customer site)
```

---

## Files Owned

### Customer Workflow Components
- `Dashboard.tsx` - Main customer interface
- `StorageRequestWizard.tsx` - Storage request creation
- `InboundShipmentWizard.tsx` - Inbound delivery scheduling
- `OutboundShipmentWizard.tsx` - Outbound pickup scheduling (if exists)
- `RequestDocumentsPanel.tsx` - Post-submission document upload

### State Management
- `AuthContext.tsx` - User session
- `hooks/useSupabaseData.ts` - Data fetching hooks
- `types.ts` - StorageRequest, TruckingLoad, Inventory types

### Logic Files
- `services/manifestProcessingService.ts` - AI extraction
- `utils/dateUtils.ts` - Date formatting

---

## Quality Standards

### State Transition Rules
1. **No skipping states**: Must follow state machine order
2. **Idempotent operations**: Can retry without duplicates
3. **Atomic transitions**: State changes succeed or fail completely
4. **Audit trail**: Log all state changes with timestamp and user

### Error Handling
1. **Network errors**: Retry with exponential backoff
2. **Validation errors**: Show inline, don't submit
3. **Permission errors**: Show clear message, contact admin
4. **Data loss prevention**: Auto-save drafts every 30s

### Progress Indicators
1. **Wizard steps**: "Step 3 of 5"
2. **Status badges**: Color-coded (gray, blue, green, yellow, red)
3. **Timeline view**: Show past/current/future milestones
4. **Percentage complete**: 0-100% for overall progress

---

## Common Patterns

### Wizard Navigation
```tsx
const [currentStep, setCurrentStep] = useState(0);

const handleNext = () => {
  if (validateCurrentStep()) {
    setCurrentStep(prev => prev + 1);
  }
};

const handleBack = () => {
  setCurrentStep(prev => Math.max(0, prev - 1));
};
```

### Status Display
```tsx
const getStatusColor = (status: string) => {
  switch (status) {
    case 'PENDING': return 'yellow';
    case 'APPROVED': return 'green';
    case 'REJECTED': return 'red';
    case 'IN_TRANSIT': return 'blue';
    case 'COMPLETE': return 'gray';
    default: return 'gray';
  }
};
```

### Draft Auto-Save
```tsx
useEffect(() => {
  const timer = setTimeout(() => {
    saveDraft(formData);
  }, 30000); // 30 seconds

  return () => clearTimeout(timer);
}, [formData]);
```

---

## Collaboration & Handoffs

### Works Closely With
- **UI/UX Agent**: Design wizard flows and status displays
- **Database Integrity Agent**: Validate state transitions in database
- **Integration & Events Agent**: Email/Slack notifications at milestones
- **AI Services Agent**: Manifest extraction and data validation

### Escalation Triggers
Hand off when:
- **UI issue**: UI/UX Agent
- **Database constraint**: Database Integrity Agent
- **Notification not sent**: Integration & Events Agent
- **AI extraction fails**: AI Services Agent
- **Admin workflow**: Admin Operations Agent

---

## Testing Checklist

### End-to-End Tests
- [ ] Complete full journey: sign-up → storage → delivery → pickup → complete
- [ ] Test with multiple trucking loads
- [ ] Test with partial inventory pickup
- [ ] Test AI extraction failure (manual review)
- [ ] Test network error recovery

### State Transition Tests
- [ ] Can't skip from PENDING to COMPLETE
- [ ] Can't mark as ARRIVED before IN_TRANSIT
- [ ] Idempotent: Retry doesn't create duplicates
- [ ] Rollback: Failed transitions don't leave orphaned records

### Edge Cases
- [ ] Customer creates request, never schedules delivery
- [ ] Customer uploads document, then deletes it
- [ ] Admin rejects request after customer scheduled delivery
- [ ] Network timeout during document upload
- [ ] AI extraction returns 0 joints (invalid manifest)

---

## Common Issues & Solutions

### Issue: Customer Stuck in Wizard
**Problem**: Can't proceed because validation not clear
**Solution**: Show inline validation errors immediately
**Example**: "Total joints must be greater than 0"

### Issue: Status Not Updating
**Problem**: Customer sees old status after admin action
**Solution**: Implement real-time subscription or auto-refresh
**File**: `Dashboard.tsx` - use Supabase real-time subscriptions

### Issue: Document Upload Stuck
**Problem**: Upload shows "Processing..." forever
**Solution**: Add timeout and error handling
**File**: `RequestDocumentsPanel.tsx:152-176`

---

## Metrics & KPIs

### Conversion Funnel
- Sign-up completion: % who complete sign-up
- Request submission: % who submit storage request
- Delivery scheduled: % who schedule inbound delivery
- Documents uploaded: % who upload manifests
- Pickup requested: % who request outbound pickup
- Completion rate: % who reach COMPLETE status

### Time Metrics
- Time to first request: Days from sign-up to first request
- Time to delivery scheduled: Days from approval to scheduled
- Time in storage: Days between arrival and pickup
- Time to completion: Days from sign-up to COMPLETE

### Quality Metrics
- Error rate: % of workflows with errors
- Support tickets: # of customer support requests
- NPS score: Customer satisfaction rating

---

## Decision Records

### DR-001: Per-Load Document Upload
**Date**: 2025-11-05
**Decision**: Upload documents per trucking load, not per request
**Rationale**:
- Each truck has unique manifest
- AI extraction needs load-specific data
- Easier to track which truck has which document

### DR-002: AI Extraction Overwrites Initial Estimate
**Date**: 2025-11-05
**Decision**: AI-extracted totals overwrite customer estimates
**Rationale**: Manifest is source of truth, not estimates
**Files**: `RequestDocumentsPanel.tsx:162-170`

---

## Next Steps

### Short-term (This Week)
- [ ] Document current state machine in detail
- [ ] Test all state transitions manually
- [ ] Add progress indicators to all wizards
- [ ] Implement draft auto-save

### Medium-term (This Month)
- [ ] Add real-time status updates (Supabase subscriptions)
- [ ] Create timeline view for customer
- [ ] Email notifications at each milestone
- [ ] Error recovery flows (resume incomplete wizard)

### Long-term (This Quarter)
- [ ] Analytics dashboard for conversion funnel
- [ ] A/B testing on wizard flows
- [ ] Customer feedback surveys
- [ ] Mobile app (iOS/Android)

---

**Agent Status**: ✅ Active
**Last Updated**: 2025-11-06
**Next Review**: 2025-11-13
**Primary Contact**: [Your Name/Team]
