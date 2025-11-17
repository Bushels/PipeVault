# MPS Trucking Quote Workflow - Implementation Summary

## Overview
This document describes the implementation of the MPS trucking quote workflow, which allows customers to request MPS to quote and coordinate trucking from their storage yard to the MPS facility.

## Workflow Branching

After the customer enters their storage yard information, they are presented with two options:

### Option 1: Customer-Provided Trucking
- Customer arranges their own trucking company
- Customer provides trucking company name, driver name, and driver phone
- Customer proceeds to select delivery time slot
- Customer uploads manifest documents
- Delivery is scheduled immediately

### Option 2: MPS Trucking Quote
- Customer requests MPS to quote trucking
- Quote request is created with unique quote number (PV-0001, PV-0002, etc.)
- Slack notification sent to MPS admin team
- Customer sees "Quote Pending" confirmation screen
- Customer returns to dashboard to await quote
- MPS admin fills out quote (distance, price, notes) in admin dashboard
- Quote status changes from PENDING → QUOTED
- Customer receives notification of quote availability
- Customer reviews and approves/rejects quote in their dashboard
- If approved: Slack notification sent to MPS, customer can schedule delivery
- If rejected: Quote remains in system with rejection reason

## Database Schema

### New Table: `trucking_quotes`

```sql
CREATE TABLE trucking_quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES storage_requests(id),
  company_id UUID NOT NULL REFERENCES companies(id),
  created_by TEXT NOT NULL,

  -- Quote identification
  quote_number TEXT NOT NULL UNIQUE, -- PV-0001, PV-0002, etc.

  -- Location details
  origin_address TEXT NOT NULL,
  destination_address TEXT NOT NULL,

  -- Quote details (filled by admin)
  quoted_amount NUMERIC(10, 2),
  distance_km NUMERIC(10, 2),
  estimated_duration_hours NUMERIC(5, 2),
  admin_notes TEXT,
  customer_notes TEXT,

  -- Status tracking
  status quote_status NOT NULL DEFAULT 'PENDING',

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  quoted_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  rejection_reason TEXT
);
```

### Quote Status Enum

```sql
CREATE TYPE quote_status AS ENUM (
  'PENDING',      -- Waiting for MPS to provide quote
  'QUOTED',       -- MPS has provided quote, waiting for customer approval
  'APPROVED',     -- Customer approved quote
  'REJECTED',     -- Customer rejected quote
  'EXPIRED'       -- Quote expired (future use)
);
```

### Updated Table: `shipments`

New columns added:
- `storage_company_name` - Storage yard company name
- `storage_yard_address` - Full storage yard address
- `storage_contact_name` - Storage yard contact name
- `storage_contact_email` - Storage yard contact email
- `storage_contact_phone` - Storage yard contact phone
- `driver_name` - Driver name
- `driver_phone` - Driver phone
- `trucking_quote_id` - Reference to trucking quote (if applicable)
- `scheduled_slot_start` - Scheduled delivery slot start time
- `scheduled_slot_end` - Scheduled delivery slot end time
- `is_after_hours` - Whether delivery is after hours
- `total_joints` - AI-extracted total joints from manifest
- `total_length_ft` - AI-extracted total length (feet)
- `total_length_m` - AI-extracted total length (meters)
- `total_weight_lbs` - AI-extracted total weight (pounds)
- `total_weight_kg` - AI-extracted total weight (kilograms)

## Components

### 1. TruckingMethodStep.tsx
**Purpose**: Allow customer to choose between customer-provided trucking or MPS quote

**Key Features**:
- Two large option cards (Customer Provided vs MPS Quote)
- Visual selection indicators
- Clear descriptions of each option with feature lists
- Info box explaining how each method works

**Props**:
```typescript
interface TruckingMethodStepProps {
  selectedMethod: TruckingMethod | null;
  onSelectMethod: (method: TruckingMethod) => void;
}

type TruckingMethod = 'CUSTOMER_PROVIDED' | 'MPS_QUOTE';
```

### 2. InboundShipmentWizard.tsx (Updated)
**Updates**:
- Added 'method' step after 'storage' step
- Added 'quote-pending' step for MPS quote flow
- Dynamic step indicator based on trucking method selection
- Quote creation with auto-incrementing quote numbers (PV-0001, PV-0002...)
- Slack notification integration for quote requests
- Branching logic based on trucking method selection

**New Steps**:
1. Storage Yard Info
2. **Transportation Method** (new)
3a. Customer Provided: Trucking Details → Time Slot → Documents → Review → Confirmation
3b. MPS Quote: **Quote Pending** (new) → Return to Dashboard

**Key Functions**:
```typescript
const handleMethodSelect = async (method: TruckingMethod) => {
  if (method === 'CUSTOMER_PROVIDED') {
    // Continue to trucking driver details
    setStep('trucking');
  } else if (method === 'MPS_QUOTE') {
    // Create quote request
    // Generate quote number (PV-0001, PV-0002, etc.)
    // Send Slack notification
    // Show quote-pending confirmation
    setStep('quote-pending');
  }
};
```

## Slack Notifications

### New Service Functions

#### `sendTruckingQuoteRequest()`
Sent when customer requests MPS trucking quote

**Notification includes**:
- Quote number (PV-0001, etc.)
- Project reference ID
- Company name
- Contact email
- Pickup location (storage yard address)
- Timestamp
- Link to admin dashboard
- "Create Quote" button

#### `sendTruckingQuoteApproved()`
Sent when customer approves a quote

**Notification includes**:
- Quote number
- Company name
- Approved amount
- Pickup location
- Timestamp
- Link to admin dashboard
- "View Details" button

## Quote Number Generation

Quote numbers follow the format: **PV-0001**, **PV-0002**, **PV-0003**, etc.

**Implementation**:
```typescript
// Get latest quote number
const { data: existingQuotes } = await supabase
  .from('trucking_quotes')
  .select('quote_number')
  .order('created_at', { ascending: false })
  .limit(1);

// Generate next quote number
let quoteNumber = 'PV-0001';
if (existingQuotes && existingQuotes.length > 0) {
  const lastNumber = parseInt(existingQuotes[0].quote_number.split('-')[1]);
  quoteNumber = `PV-${String(lastNumber + 1).padStart(4, '0')}`;
}
```

## User Experience Flow

### Customer Request Flow
1. Customer enters storage yard information
2. Customer selects "Request MPS Trucking Quote"
3. Quote request is created with unique PV-XXXX number
4. Customer sees confirmation screen with:
   - Quote number
   - Storage location summary
   - Expected timeline (24-48 hours)
   - Next steps explanation
5. Customer returns to dashboard
6. MPS admin receives Slack notification

### Admin Quote Flow (Future Implementation)
1. Admin receives Slack notification
2. Admin opens PipeVault admin dashboard
3. Admin navigates to "Trucking Quotes" section
4. Admin sees pending quote with storage location
5. Admin calculates distance and cost
6. Admin fills out quote form:
   - Quoted amount ($)
   - Distance (km)
   - Estimated duration (hours)
   - Admin notes
7. Admin submits quote
8. Quote status changes to QUOTED
9. Customer receives notification (email/dashboard)

### Customer Approval Flow (Future Implementation)
1. Customer sees notification of available quote
2. Customer opens dashboard
3. Customer reviews quote details:
   - Pricing breakdown
   - Distance and duration
   - Terms and conditions
4. Customer clicks "Approve Quote" or "Reject Quote"
5. If approved:
   - Slack notification sent to MPS
   - Customer proceeds to schedule delivery time slot
   - Rest of delivery flow continues as normal
6. If rejected:
   - Quote marked as rejected
   - Customer can add rejection reason
   - MPS admin receives notification

## File Structure

```
components/
  ├── TruckingMethodStep.tsx              (NEW)
  ├── InboundShipmentWizard.tsx           (UPDATED)
  ├── StorageYardStep.tsx
  ├── TruckingDriverStep.tsx
  ├── TimeSlotPicker.tsx
  ├── DocumentUploadStep.tsx
  └── LoadSummaryReview.tsx

services/
  ├── slackService.ts                     (UPDATED - added 2 new functions)
  ├── manifestProcessingService.ts
  └── emailService.ts

supabase/
  ├── SETUP_TRUCKING_QUOTES.sql           (NEW)
  ├── ALTER_SHIPMENTS_ADD_STORAGE_FIELDS.sql (NEW)
  └── schema.sql
```

## Next Steps (Not Yet Implemented)

1. **Admin Quote Management Dashboard**
   - View pending quote requests
   - Fill out quote form
   - Update quote status to QUOTED
   - View quote history

2. **Customer Quote Dashboard**
   - View pending quotes
   - View available quotes (QUOTED status)
   - Approve/reject quotes
   - View quote history

3. **Email Notifications**
   - Email customer when quote is available
   - Email customer when quote is approved
   - Email reminder if quote pending for >48 hours

4. **Quote Expiration**
   - Auto-expire quotes after 7 days
   - Send notification before expiration

5. **Quote Analytics**
   - Track approval rate
   - Track average quote amount
   - Track distance distribution

## Testing Checklist

### Customer Flow
- [ ] Customer can select "Request MPS Trucking Quote"
- [ ] Quote number is generated correctly (PV-0001, PV-0002...)
- [ ] Quote is saved to database with correct data
- [ ] Slack notification is sent to admin channel
- [ ] Customer sees quote-pending confirmation screen
- [ ] Customer can return to dashboard
- [ ] Quote appears in database with PENDING status

### Customer Provided Trucking Flow
- [ ] Customer can select "I'll Arrange My Own Trucking"
- [ ] Customer proceeds to trucking driver details step
- [ ] Rest of delivery flow works as before

### Step Indicator
- [ ] Shows correct steps for customer-provided flow
- [ ] Shows correct steps for MPS quote flow
- [ ] Highlights current step
- [ ] Shows completed steps with checkmarks

### Database
- [ ] trucking_quotes table exists
- [ ] quote_status enum exists
- [ ] shipments table has new columns
- [ ] RLS policies work correctly
- [ ] Triggers work correctly

## SQL Migration Commands

Run these in order in Supabase SQL Editor:

```sql
-- 1. Create trucking_quotes table
\i supabase/SETUP_TRUCKING_QUOTES.sql

-- 2. Update shipments table
\i supabase/ALTER_SHIPMENTS_ADD_STORAGE_FIELDS.sql
```

## Environment Variables

No new environment variables required. Uses existing:
- `VITE_SLACK_WEBHOOK_URL` - For Slack notifications

## Success Metrics

- Number of quote requests per month
- Quote approval rate
- Average time from quote request to approval
- Customer satisfaction with quote process
- Percentage of customers choosing MPS trucking vs customer-provided

---

**Implementation Date**: January 2025
**Status**: ✅ Core workflow complete, admin UI pending
**Next Milestone**: Admin quote management dashboard
