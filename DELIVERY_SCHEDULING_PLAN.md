# Pipe Delivery Scheduling & Document Processing Plan

## Overview
Complete workflow for customers to schedule pipe deliveries to MPS, including intelligent document processing for manifests and tally sheets.

## Workflow Phases

### Phase 1: Delivery Booking Interface ⚙️ IN PROGRESS

**User Journey:**
1. Customer has **APPROVED** storage request
2. Clicks **"Schedule Delivery to MPS"** button on request card
3. Opens `InboundShipmentWizard` with multi-step form:
   - **Step 1: Storage Yard Details**
     - Storage company name (where pipe is currently located)
     - Storage yard address (with address autocomplete)
     - Contact name at storage company
     - Contact email
     - Contact phone
   - **Step 2: Trucking Company & Driver**
     - Trucking company name (if different from storage company)
     - Driver name
     - Driver contact number
     - *(No truck details/license plate needed - contact info only)*
   - **Step 3: Time Slot Selection**
     - **Standard Hours:** Monday-Friday 7:00 AM - 4:00 PM
     - **After-Hours:** Any time outside standard hours
     - 1-hour time slots with visual distinction (green vs yellow)
     - Surcharge pricing ($450) only shown when after-hours slot selected
   - **Step 4: Document Upload**
     - Upload manifest/tally sheets (PDF, images, scanned docs)
     - AI auto-extracts: joints count, total length, weight per foot
     - No manual entry required for load details
   - **Step 5: Review & Confirm**
     - Customer reviews AI-extracted load summary (read-only)
     - **Admin handles error corrections** in their dashboard later
     - Frictionless for engineer - no editing required
   - **Step 6: Confirmation Complete**
     - iCal file download (auto-opens in Outlook/calendar app)
     - Slack notification sent to MPS team
     - Confirmation email sent to customer

**Database Tables:**
- `shipments` - Overall delivery record
  - `storage_company_name` - Where pipe is currently stored
  - `storage_yard_address` - Full address of storage location
  - `storage_contact_name`, `storage_contact_email`, `storage_contact_phone`
  - `trucking_company_name` - Company transporting pipe (may be same as storage)
  - `driver_name`, `driver_phone` - Driver contact info only
  - `scheduled_slot_start`, `scheduled_slot_end` - 1-hour delivery window
  - `is_after_hours` - Boolean flag for after-hours deliveries
  - `surcharge_amount` - $450 if after-hours, $0 if standard
- `dock_appointments` - Time slot reservations (prevent double-booking)
- `shipment_documents` - Uploaded manifest files
- `shipment_items` - AI-extracted pipe joint data (admin can edit)

**UI Components:**
```
InboundShipmentWizard.tsx (existing - needs enhancement)
  ├── StorageYardStep.tsx
  │   └── AddressAutocomplete.tsx (Google Places API)
  ├── TruckingDriverStep.tsx (combined - simplified)
  ├── TimeSlotPicker.tsx ✅ (7am-4pm standard hours)
  ├── DocumentUploadStep.tsx (drag-and-drop)
  ├── LoadSummaryReview.tsx (read-only for customer)
  └── DeliveryConfirmation.tsx (iCal + Slack)
```

**Key Features:**
- **Storage vs Trucking Separation:** Clear distinction between where pipe is stored vs who's transporting it
- **Simplified Driver Info:** Only name and phone - no truck details or license plates needed
- **Address Autocomplete:** Google Places API for storage yard address entry
- **Load Details Auto-Extraction:** AI reads manifest and calculates totals (no manual entry)
- **Standard Hours:** 7am-4pm weekdays (everything else = after-hours + $450)
- **Conditional Pricing:** Surcharge only shown when after-hours slot selected
- **Admin Error Correction:** Customer sees read-only summary; admin fixes AI errors in their dashboard

---

### Phase 2: Calendar Integration

**Option A: iCal Format (Recommended - Universal)**
- Generate `.ics` file when delivery confirmed
- Email attachment + download link
- Works with Outlook, Google Calendar, Apple Calendar

**Implementation:**
```typescript
// services/calendarService.ts
export const generateDeliveryCalendarEvent = (appointment) => {
  const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//PipeVault//Delivery Scheduler//EN
BEGIN:VEVENT
UID:${appointment.id}@pipevault.mpsgroup.ca
DTSTART:${formatICalDateTime(appointment.slot_start)}
DTEND:${formatICalDateTime(appointment.slot_end)}
SUMMARY:PipeVault Pipe Delivery - ${appointment.trucking_company}
DESCRIPTION:Driver: ${appointment.driver_name}\\n\\
Phone: ${appointment.driver_phone}\\n\\
Estimated Joints: ${appointment.joints_count}\\n\\
Reference: ${appointment.reference_id}
LOCATION:MPS Group Pipe Yard\\n123 Industrial Blvd\\nCalgary, AB
ORGANIZER:mailto:pipevault@mpsgroup.ca
ATTENDEE:mailto:${appointment.customer_email}
STATUS:CONFIRMED
SEQUENCE:0
END:VEVENT
END:VCALENDAR`;

  return new Blob([icsContent], { type: 'text/calendar' });
};
```

**Option B: Microsoft Graph API (If MPS uses Microsoft 365)**
- Direct integration with Outlook calendars
- Requires OAuth setup and Microsoft app registration
- More complex but seamless for Microsoft users

**Recommendation:** Start with iCal (Option A), add Graph API later if needed.

---

### Phase 3: Slack Notifications

**Trigger:** When delivery is confirmed

**Purpose:** Send quick summary of customer delivery request to MPS team

**Notification Payload:**
```json
{
  "blocks": [
    {
      "type": "header",
      "text": {
        "type": "plain_text",
        "text": "🚛 New Delivery Scheduled to MPS",
        "emoji": true
      }
    },
    {
      "type": "section",
      "fields": [
        {
          "type": "mrkdwn",
          "text": "*Storage Company:*\nDowntown Calgary Pipe Yard\n📍 123 Industrial Ave, Calgary AB"
        },
        {
          "type": "mrkdwn",
          "text": "*Storage Contact:*\nSarah Johnson\n📧 sjohnson@pipeyard.com\n📞 (403) 555-1234"
        },
        {
          "type": "mrkdwn",
          "text": "*Trucking Company:*\nAcme Transport"
        },
        {
          "type": "mrkdwn",
          "text": "*Driver:*\nJohn Smith\n📞 (403) 555-9876"
        },
        {
          "type": "mrkdwn",
          "text": "*Scheduled Time:*\nJan 15, 2025\n10:00 AM - 11:00 AM"
        },
        {
          "type": "mrkdwn",
          "text": "*Load Details:*\n150 joints\n1,850 m (6,070 ft)\n24,500 lbs (11,113 kg)"
        }
      ]
    },
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "📦 *Prepare for Delivery:* Ensure yard crew is ready to receive this load."
      }
    },
    {
      "type": "actions",
      "elements": [
        {
          "type": "button",
          "text": {
            "type": "plain_text",
            "text": "📋 View Shipment Details"
          },
          "url": "https://kylegronning.github.io/PipeVault/",
          "style": "primary"
        }
      ]
    }
  ]
}
```

**Implementation:** Use existing Supabase webhook on `shipments` table INSERT.

---

### Phase 4: Document Processing (AI-Powered)

## Recommended: Google Gemini Vision API

**Why Gemini Vision?**
- ✅ Already have API key (`VITE_GOOGLE_AI_API_KEY`)
- ✅ Handles PDF, JPEG, PNG, scanned documents
- ✅ Structured JSON output for pipe data
- ✅ Cost-effective ($0.000125 per image for Gemini 1.5 Flash)
- ✅ Free tier: 1,500 requests/day
- ✅ Built-in error correction capabilities

**Alternative Considered:** Specialized OCR APIs (Google Document AI, AWS Textract)
- ❌ More expensive ($1.50 per 1,000 pages)
- ❌ Requires additional API setup
- ❌ Overkill for structured pipe manifests
- ✅ Slightly better accuracy on poor quality scans

**Decision:** Start with Gemini Vision. Upgrade to specialized OCR only if accuracy issues arise.

---

## Document Processing Workflow

### Step 1: Upload & Store
```typescript
// User uploads manifest PDF/image
const uploadManifest = async (file: File, shipmentId: string) => {
  // Upload to Supabase Storage
  const { data, error } = await supabase.storage
    .from('shipment-documents')
    .upload(`${shipmentId}/${file.name}`, file);

  // Create document record
  await supabase.from('shipment_documents').insert({
    shipment_id: shipmentId,
    document_type: 'manifest',
    file_name: file.name,
    storage_path: data.path,
    status: 'uploaded'
  });
};
```

### Step 2: Extract Data with Gemini Vision
```typescript
// services/manifestProcessingService.ts
import { GoogleGenerativeAI } from '@google/generative-ai';

const MANIFEST_EXTRACTION_PROMPT = `
You are a pipe manifest data extraction specialist for the oil & gas industry.

Extract ALL pipe joints from this manifest document into structured JSON.

For each joint/row, extract:
- manufacturer: Company that made the pipe (e.g., "Tenaris", "VAM", "US Steel")
- heat_number: Heat/lot number (usually alphanumeric like "H12345" or "AB-67890")
- serial_number: Unique joint identifier (may be stamped or printed)
- tally_length_ft: Actual measured length in FEET (convert from meters if needed: 1m = 3.28084ft)
- quantity: Number of joints (usually 1 per line, but could be multiple)
- grade: Steel grade (e.g., "L80", "P110", "J55", "N80")
- outer_diameter: Outside diameter in INCHES (e.g., 5.5, 7.0, 9.625)
- weight_lbs_ft: Weight per foot in pounds (e.g., 23.0, 29.7)

**CRITICAL RULES:**
1. If a field is missing/unclear, use null
2. Heat numbers are typically 5-10 characters
3. Tally lengths for drill pipe: 28-33 feet typical
4. Tally lengths for casing: 38-45 feet typical
5. Convert all measurements to imperial (feet, inches, lbs/ft)
6. Preserve leading zeros in serial numbers

Return ONLY valid JSON array (no markdown, no explanation):
[
  {
    "manufacturer": "Tenaris",
    "heat_number": "H12345",
    "serial_number": "ABC-001",
    "tally_length_ft": 31.2,
    "quantity": 1,
    "grade": "L80",
    "outer_diameter": 5.5,
    "weight_lbs_ft": 23.0
  },
  ...
]
`;

export const extractManifestData = async (
  documentUrl: string
): Promise<ManifestItem[]> => {
  const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GOOGLE_AI_API_KEY);
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

  // Fetch document as base64
  const response = await fetch(documentUrl);
  const blob = await response.blob();
  const base64 = await blobToBase64(blob);

  // Send to Gemini Vision
  const result = await model.generateContent([
    MANIFEST_EXTRACTION_PROMPT,
    {
      inlineData: {
        mimeType: blob.type,
        data: base64.split(',')[1]
      }
    }
  ]);

  // Parse JSON response
  const text = result.response.text();
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    throw new Error('No JSON array found in response');
  }

  return JSON.parse(jsonMatch[0]);
};
```

### Step 3: AI Validation & Error Checking
```typescript
// Double-check extracted data with Gemini Flash
const VALIDATION_PROMPT = `
You are a pipe manifest quality control specialist.

Review this extracted pipe manifest data for errors and inconsistencies:

${JSON.stringify(extractedData, null, 2)}

**Check for:**
1. **Duplicate serial numbers** - Flag any duplicates
2. **Invalid heat number formats** - Should be alphanumeric, 5-10 chars
3. **Impossible tally lengths:**
   - Drill pipe: typically 28-33 ft (flag if <25 or >35)
   - Casing: typically 38-45 ft (flag if <35 or >48)
4. **Missing critical fields** - manufacturer, heat_number, serial_number
5. **Inconsistent manufacturers** - Flag unusual spellings (e.g., "Tenaris" vs "TENARIS")
6. **Total joint count** - Does it match expected count?
7. **Out-of-range weights** - Flag if weight_lbs_ft seems wrong for diameter

Return JSON:
{
  "is_valid": boolean,
  "total_joints": number,
  "errors": [
    {"field": "serial_number", "joint_index": 5, "issue": "Duplicate serial: ABC-005"},
    {"field": "tally_length_ft", "joint_index": 12, "issue": "Unusually short: 22.1 ft"}
  ],
  "warnings": [
    {"field": "manufacturer", "joint_index": 3, "issue": "Unusual spelling: TENRIS (did you mean TENARIS?)"}
  ],
  "suggestions": {
    "manufacturer_corrections": {
      "TENRIS": "Tenaris",
      "US STEEL": "US Steel"
    }
  }
}
`;

export const validateManifestData = async (
  extractedData: ManifestItem[]
): Promise<ValidationResult> => {
  const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GOOGLE_AI_API_KEY);
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

  const result = await model.generateContent(VALIDATION_PROMPT);
  const text = result.response.text();
  const jsonMatch = text.match(/\{[\s\S]*\}/);

  return JSON.parse(jsonMatch[0]);
};
```

### Step 4: Customer Review UI (Read-Only)
```typescript
// Component: LoadSummaryReview.tsx
// Shows AI-calculated load summary (read-only for customer)
// Frictionless - no editing required
// Admin handles error corrections in their dashboard

<div className="bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800 rounded-2xl border border-gray-700/50 p-6">
  <h3 className="text-xl font-bold text-white mb-4">
    📦 Load Summary (from manifest)
  </h3>

  {/* AI Extraction Status */}
  <div className="flex items-center gap-2 mb-6">
    <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
    <span className="text-sm text-gray-300">
      AI extracted {loadSummary.total_joints} joints from your manifest
    </span>
  </div>

  {/* Load Totals Grid */}
  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
    <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
      <p className="text-xs text-gray-400 mb-1">Total Joints</p>
      <p className="text-2xl font-bold text-white">{loadSummary.total_joints}</p>
    </div>
    <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
      <p className="text-xs text-gray-400 mb-1">Total Length</p>
      <p className="text-2xl font-bold text-white">
        {loadSummary.total_length_ft.toLocaleString()} ft
      </p>
      <p className="text-sm text-gray-400">
        ({loadSummary.total_length_m.toLocaleString()} m)
      </p>
    </div>
    <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
      <p className="text-xs text-gray-400 mb-1">Total Weight</p>
      <p className="text-2xl font-bold text-white">
        {loadSummary.total_weight_lbs.toLocaleString()} lbs
      </p>
      <p className="text-sm text-gray-400">
        ({loadSummary.total_weight_kg.toLocaleString()} kg)
      </p>
    </div>
  </div>

  {/* Admin Note */}
  <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-3">
    <p className="text-xs text-gray-400">
      <strong>Note:</strong> MPS admin will review and verify all details. If you notice any issues, you can add notes in the next step.
    </p>
  </div>
</div>
```

**Admin Error Correction (Separate Component)**
```typescript
// Component: ManifestEditTable.tsx (in AdminDashboard)
// Full editable table for admin to fix AI extraction errors
// Only accessible to admin users

<table className="w-full">
  <thead>
    <tr className="border-b border-gray-700">
      <th className="text-left p-3 text-gray-400 text-xs">Joint #</th>
      <th className="text-left p-3 text-gray-400 text-xs">Manufacturer</th>
      <th className="text-left p-3 text-gray-400 text-xs">Heat Number</th>
      <th className="text-left p-3 text-gray-400 text-xs">Serial Number</th>
      <th className="text-left p-3 text-gray-400 text-xs">Tally (ft)</th>
      <th className="text-left p-3 text-gray-400 text-xs">Weight (lbs/ft)</th>
      <th className="text-left p-3 text-gray-400 text-xs">Status</th>
    </tr>
  </thead>
  <tbody>
    {manifestItems.map((item, index) => (
      <tr key={item.id} className={getRowStatusClass(item)}>
        <td className="p-3 text-white">{index + 1}</td>
        <td className="p-3">
          <input
            value={item.manufacturer || ''}
            onChange={(e) => updateItem(item.id, 'manufacturer', e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-white text-sm w-full"
          />
        </td>
        {/* ... other editable fields ... */}
        <td className="p-3">
          {validationErrors[item.id] && (
            <span className="text-xs text-red-400">⚠️ {validationErrors[item.id]}</span>
          )}
          {validationWarnings[item.id] && (
            <span className="text-xs text-yellow-400">⚠️ {validationWarnings[item.id]}</span>
          )}
        </td>
      </tr>
    ))}
  </tbody>
</table>
```

### Step 5: Calculate Load Totals

After AI extraction, automatically calculate load summary from individual joint data:

```typescript
export interface LoadSummary {
  total_joints: number;
  total_length_ft: number;
  total_length_m: number;
  total_weight_lbs: number;
  total_weight_kg: number;
}

/**
 * Calculate load totals from extracted manifest items
 * Eliminates need for user to manually enter load details
 */
export const calculateLoadSummary = (items: ManifestItem[]): LoadSummary => {
  let totalJoints = 0;
  let totalLengthFt = 0;
  let totalWeightLbs = 0;

  items.forEach(item => {
    const qty = item.quantity || 1;
    const lengthFt = item.tally_length_ft || 0;
    const weightPerFoot = item.weight_lbs_ft || 0;

    totalJoints += qty;
    totalLengthFt += lengthFt * qty;
    totalWeightLbs += lengthFt * qty * weightPerFoot;
  });

  return {
    total_joints: totalJoints,
    total_length_ft: Math.round(totalLengthFt * 100) / 100,
    total_length_m: Math.round(totalLengthFt / 3.28084 * 100) / 100,
    total_weight_lbs: Math.round(totalWeightLbs),
    total_weight_kg: Math.round(totalWeightLbs / 2.20462)
  };
};
```

**Benefits:**
- ✅ No manual data entry required
- ✅ Accurate calculations from source documents
- ✅ Reduces human error
- ✅ Faster booking process
- ✅ Automatic unit conversions (ft/m, lbs/kg)

**Display in UI:**
```tsx
{/* Show calculated summary after manifest upload */}
<div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
  <h4 className="text-sm font-bold text-white mb-3">Load Summary (from manifest)</h4>
  <div className="grid grid-cols-3 gap-4">
    <div>
      <p className="text-xs text-gray-400">Total Joints</p>
      <p className="text-lg font-bold text-white">{loadSummary.total_joints}</p>
    </div>
    <div>
      <p className="text-xs text-gray-400">Total Length</p>
      <p className="text-lg font-bold text-white">
        {loadSummary.total_length_ft.toLocaleString()} ft
        <span className="text-sm text-gray-400 ml-2">
          ({loadSummary.total_length_m.toLocaleString()} m)
        </span>
      </p>
    </div>
    <div>
      <p className="text-xs text-gray-400">Total Weight</p>
      <p className="text-lg font-bold text-white">
        {loadSummary.total_weight_lbs.toLocaleString()} lbs
        <span className="text-sm text-gray-400 ml-2">
          ({loadSummary.total_weight_kg.toLocaleString()} kg)
        </span>
      </p>
    </div>
  </div>
</div>
```

---

### Step 6: Save to Database
```typescript
// After user confirms, save to shipment_items
const saveManifestData = async (
  shipmentId: string,
  truckId: string,
  documentId: string,
  items: ManifestItem[]
) => {
  await supabase.from('shipment_items').insert(
    items.map(item => ({
      shipment_id: shipmentId,
      truck_id: truckId,
      document_id: documentId,
      manufacturer: item.manufacturer,
      heat_number: item.heat_number,
      serial_number: item.serial_number,
      tally_length_ft: item.tally_length_ft,
      quantity: item.quantity || 1,
      status: 'in_transit'
    }))
  );

  // Update document status
  await supabase.from('shipment_documents').update({
    status: 'parsed',
    processed_at: new Date().toISOString()
  }).eq('id', documentId);
};
```

---

## Cost Analysis

### Gemini Vision Pricing
- **Model:** Gemini 1.5 Flash
- **Cost:** $0.000125 per image (up to 1,500 free/day)
- **Typical Manifest:** 1-3 pages = $0.000125 - $0.000375 per shipment
- **Monthly (100 shipments):** ~$0.0125 - $0.0375/month
- **Annual (1,200 shipments):** ~$0.15 - $0.45/year

**Conclusion:** Essentially free for PipeVault's volume.

### Alternative (Google Document AI)
- **Cost:** $1.50 per 1,000 pages
- **Typical Manifest:** 2 pages = $0.003 per shipment
- **Monthly (100 shipments):** $0.30/month
- **Annual (1,200 shipments):** $3.60/year

**Decision:** Start with Gemini Vision. If accuracy issues arise (e.g., poor quality scans), upgrade to Document AI.

---

## Implementation Checklist

### Phase 1: Booking Interface (Week 1)
- [x] Enhance `InboundShipmentWizard.tsx` with 6-step wizard flow
- [x] Build `TimeSlotPicker.tsx` with 1-hour slots (7am-4pm standard hours)
- [x] Create `StorageYardStep.tsx` with address autocomplete
  - Storage company name, yard address, contact name, email, phone
- [x] Create `TruckingDriverStep.tsx` (simplified - combined step)
  - Trucking company name, driver name, driver phone only
  - No truck details or license plate needed
- [ ] Integrate Google Places API for address autocomplete (future enhancement)
- [x] Implement form validation and error handling

### Phase 2: Document Upload (Week 1-2)
- [x] Add `DocumentUploadStep.tsx` with drag-and-drop
- [ ] Integrate Supabase Storage for file uploads (integrated in wizard)
- [ ] Create `shipment_documents` table records on upload (integrated in wizard)
- [x] Show upload progress and file previews

### Phase 3: AI Document Processing (Week 2)
- [x] Create `services/manifestProcessingService.ts`
- [x] Implement Gemini Vision extraction with structured prompts
- [x] Build validation logic with error detection
- [ ] Test with sample manifests (PDF, images, scanned docs)
- [ ] Auto-populate joints count, total length, and weight from manifest

### Phase 4: Customer Review UI (Week 2-3)
- [x] Build `LoadSummaryReview.tsx` (read-only for customer)
  - Show AI-extracted load totals (joints, length, weight)
  - Display in both imperial and metric units
  - Integrated into wizard confirmation flow
- [ ] Build admin-side `ManifestEditTable.tsx` (for AdminDashboard)
  - Full editing capabilities for admin to fix AI errors
  - Highlight errors/warnings with color coding
  - Inline editing for all fields
  - Save changes back to `shipment_items` table

### Phase 5: Calendar & Notifications (Week 3)
- [ ] Create `services/calendarService.ts` for iCal generation
- [ ] Email calendar invite to customer
- [ ] Set up Supabase webhook for Slack delivery notifications
- [ ] Test end-to-end booking → calendar → Slack flow

### Phase 6: Database Integration (Week 3-4)
- [ ] Save confirmed shipments to `shipments` table
- [ ] Create `shipment_trucks` records
- [ ] Insert `dock_appointments` with time slots
- [ ] Bulk insert `shipment_items` from manifest
- [ ] Link documents via `shipment_documents.shipment_id`

### Phase 7: Testing & Refinement (Week 4)
- [ ] Test with various manifest formats (PDF, JPG, PNG)
- [ ] Test with poor quality scans
- [ ] Validate AI extraction accuracy (target: >95%)
- [ ] Test time slot conflicts and double-booking prevention
- [ ] End-to-end user testing with real customers

---

## Future Enhancements

### V2 Features:
1. **SMS Notifications** - Alert driver 24h before delivery
2. **Real-Time Tracking** - GPS integration for truck location
3. **QR Code Check-In** - Driver scans QR on arrival
4. **Automatic Tally Verification** - Compare manifest vs actual received
5. **Signature Capture** - Digital sign-off on delivery
6. **Integration with Yard Management** - Auto-assign storage racks

### Advanced AI:
1. **Handwriting Recognition** - For handwritten tally sheets
2. **Multi-Page Manifest Handling** - Stitch together multi-page docs
3. **Cross-Reference Validation** - Check heat numbers against industry databases
4. **Predictive Scheduling** - ML model suggests optimal delivery times

---

## Key Decisions

| Decision | Recommendation | Rationale |
|----------|---------------|-----------|
| **Calendar Format** | iCal (.ics) | Universal compatibility, easy to implement |
| **AI for Document Processing** | Google Gemini Vision | Already have API, cost-effective, good accuracy |
| **Validation Approach** | Two-stage (extraction + validation) | Catch errors before user review |
| **Document Storage** | Supabase Storage | Integrated, secure, RLS support |
| **User Review Required?** | Yes, with AI pre-check | Ensure data accuracy, legal liability |
| **Real-Time Processing** | No, process on user request | Prevent unnecessary API calls |

---

## Success Metrics

### Accuracy Targets:
- **AI Extraction Accuracy:** >95% for clear manifests
- **User Correction Rate:** <10% of fields need manual correction
- **Zero Duplicates:** No duplicate serial numbers in database

### Performance Targets:
- **Document Processing:** <10 seconds per 2-page manifest
- **Booking Flow:** User completes in <5 minutes
- **Calendar Delivery:** Email sent within 30 seconds of confirmation

### User Experience:
- **Mobile-Friendly:** Works on phone/tablet for field use
- **Offline Upload:** Queue uploads when offline
- **Auto-Save:** Prevent data loss if browser closes

---

## Next Steps

**Immediate Action Items:**
1. Review this plan with Kyle - confirm approach
2. Create sample manifest PDFs for testing
3. Build `ManifestProcessingService.ts` first (can test independently)
4. Enhance `InboundShipmentWizard.tsx` with time slot picker
5. Set up Supabase webhook for delivery notifications

**MPS Configuration (Confirmed):**
1. ✅ **Receiving Hours:** 7am-4pm weekdays (Monday-Friday)
2. ✅ **Off-Hours Surcharge:** $450 for deliveries outside standard hours
3. ✅ **Manifest Formats:** All formats (PDF, images, handwritten, scanned)
4. ✅ **Calendar Recipients:** Admin team (to start)
5. ✅ **Same-Day Booking:** Allowed (no minimum notice period)
6. ✅ **Office 365:** MPS uses Microsoft 365 - Microsoft Graph API recommended

---

**Status:** ✅ **IN DEVELOPMENT** - Core components built, wizard enhancement in progress

**Completed Components:**
- ✅ `services/manifestProcessingService.ts` - Gemini Vision AI extraction + validation + calculateLoadSummary()
- ✅ `services/calendarService.ts` - iCal generation + Microsoft Graph API stubs
- ✅ `components/TimeSlotPicker.tsx` - 1-hour time slots with conditional surcharge display (7am-4pm standard hours)
- ✅ `components/StorageYardStep.tsx` - Storage yard information capture with form validation
- ✅ `components/TruckingDriverStep.tsx` - Simplified trucking/driver details (no truck info needed)
- ✅ `components/DocumentUploadStep.tsx` - Drag-and-drop manifest upload with AI processing status
- ✅ `components/LoadSummaryReview.tsx` - Read-only AI-extracted load summary for customers
- ✅ `components/InboundShipmentWizard.tsx` - Complete 6-step delivery scheduling wizard

**Next:**
- ⚙️ Update database schema to match new shipments table structure
- ⚙️ Build admin-side ManifestEditTable.tsx for error corrections
- ⚙️ Implement Supabase webhook for delivery Slack notifications
- ⚙️ Add Google Places API for address autocomplete
