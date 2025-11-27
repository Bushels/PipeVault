# PipeVault Delivery Scheduling - Workflow Summary

## Quick Reference for Updated Delivery Workflow

### Key Principles
1. **Frictionless for Engineers** - Minimal data entry, AI does the heavy lifting
2. **Admin Handles Corrections** - Customer reviews, admin fixes errors
3. **Clear Separation** - Storage yard ≠ Trucking company
4. **Standard Hours** - 7am-4pm weekdays (everything else = after-hours + $450)

---

## 6-Step Customer Workflow

### Step 1: Storage Yard Details
**Where is the pipe currently stored?**
- Storage company name
- Storage yard address (with Google Places autocomplete)
- Contact name at storage company
- Contact email
- Contact phone

**Example:**
- Company: "Calgary Industrial Pipe Yard"
- Address: "1234 Industrial Blvd, Calgary AB T2E 6Z8"
- Contact: Sarah Johnson, sjohnson@pipeyard.com, (403) 555-1234

---

### Step 2: Trucking Company & Driver
**Who's transporting the pipe?**
- Trucking company name *(may be same as storage company)*
- Driver name
- Driver contact number

**Simplified - No Need For:**
- ❌ License plate
- ❌ Truck make/model
- ❌ Trailer type
- ❌ VIN numbers

**Why?** We only need to contact the driver if they're running late or something happened.

**Example:**
- Trucking Company: "Acme Transport Ltd"
- Driver: John Smith
- Driver Phone: (403) 555-9876

---

### Step 3: Time Slot Selection
**When will delivery arrive?**

**Standard Hours:** Monday-Friday, 7:00 AM - 4:00 PM
- ✅ No surcharge
- Green color coding

**After-Hours:** Weekends or outside 7am-4pm
- ⚠️ $450 surcharge
- Yellow color coding
- Pricing only shown when customer selects after-hours slot

**Slot Duration:** 1-hour windows
- Example: 10:00 AM - 11:00 AM

---

### Step 4: Document Upload
**Upload manifest/tally sheets**
- Drag-and-drop interface
- Supports: PDF, JPG, PNG, scanned documents
- AI automatically extracts:
  - Total joints count
  - Total length (ft and m)
  - Total weight (lbs and kg)
  - Individual pipe details (heat numbers, serial numbers, manufacturers)

**No Manual Entry Required!**

---

### Step 5: Review & Confirm
**Customer sees read-only summary**
- AI-calculated load totals
- Both imperial and metric units
- Simple "Looks Good" confirmation button

**Note:** "MPS admin will review and verify all details. If you notice any issues, you can add notes in the next step."

**Customer Does NOT Edit Data** - Admin handles corrections later.

---

### Step 6: Confirmation Complete
**Delivery scheduled!**
- ✅ iCal file download (auto-opens in Outlook)
- ✅ Slack notification sent to MPS team
- ✅ Confirmation email sent to customer

---

## Admin Side (Separate from Customer Flow)

### Admin Dashboard - Delivery Management

**Admin can:**
- View all scheduled deliveries
- See AI extraction results with error/warning flags
- **Edit manifest data** in full editable table
  - Fix manufacturer name typos
  - Correct heat numbers
  - Update tally lengths
  - Fix serial number misreads
- Save corrections back to database
- Mark delivery as "Verified"

**Component:** `ManifestEditTable.tsx` (in AdminDashboard)

---

## Slack Notification Format

**Sent to:** MPS team channel

**Includes:**
- 🏢 Storage Company + address
- 📞 Storage Contact (name, email, phone)
- 🚛 Trucking Company
- 👤 Driver name + phone
- 📅 Scheduled Time (1-hour slot)
- 📦 Load Details (joints, length, weight)

**Example:**
```
🚛 New Delivery Scheduled to MPS

Storage Company: Downtown Calgary Pipe Yard
📍 123 Industrial Ave, Calgary AB

Storage Contact: Sarah Johnson
📧 sjohnson@pipeyard.com
📞 (403) 555-1234

Trucking Company: Acme Transport
Driver: John Smith
📞 (403) 555-9876

Scheduled Time: Jan 15, 2025
10:00 AM - 11:00 AM

Load Details:
150 joints
1,850 m (6,070 ft)
24,500 lbs (11,113 kg)
```

---

## Database Schema

### `shipments` table
```sql
CREATE TABLE shipments (
  id UUID PRIMARY KEY,
  storage_request_id UUID REFERENCES storage_requests(id),

  -- Storage yard info (where pipe is currently stored)
  storage_company_name TEXT NOT NULL,
  storage_yard_address TEXT NOT NULL,
  storage_contact_name TEXT NOT NULL,
  storage_contact_email TEXT NOT NULL,
  storage_contact_phone TEXT NOT NULL,

  -- Trucking/delivery info
  trucking_company_name TEXT NOT NULL,
  driver_name TEXT NOT NULL,
  driver_phone TEXT NOT NULL,

  -- Time slot
  scheduled_slot_start TIMESTAMP NOT NULL,
  scheduled_slot_end TIMESTAMP NOT NULL,
  is_after_hours BOOLEAN DEFAULT FALSE,
  surcharge_amount DECIMAL(10,2) DEFAULT 0,

  -- Load details (from AI extraction)
  total_joints INTEGER,
  total_length_ft DECIMAL(10,2),
  total_length_m DECIMAL(10,2),
  total_weight_lbs DECIMAL(10,2),
  total_weight_kg DECIMAL(10,2),

  status TEXT DEFAULT 'scheduled', -- scheduled, in_transit, delivered
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### `shipment_items` table
```sql
CREATE TABLE shipment_items (
  id UUID PRIMARY KEY,
  shipment_id UUID REFERENCES shipments(id),
  document_id UUID REFERENCES shipment_documents(id),

  -- AI-extracted pipe joint details
  manufacturer TEXT,
  heat_number TEXT,
  serial_number TEXT,
  tally_length_ft DECIMAL(10,2),
  quantity INTEGER DEFAULT 1,
  grade TEXT,
  outer_diameter DECIMAL(10,2),
  weight_lbs_ft DECIMAL(10,2),

  -- Admin corrections
  admin_verified BOOLEAN DEFAULT FALSE,
  admin_notes TEXT,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

---

## AI Processing Flow

1. **Customer uploads manifest** → Supabase Storage
2. **AI extraction triggered** → Google Gemini Vision API
3. **Parse manifest** → Extract all joint details
4. **Calculate totals** → Sum joints, length, weight
5. **Validation check** → Flag errors/warnings (duplicates, invalid formats)
6. **Show customer summary** → Read-only totals (no editing)
7. **Save to database** → `shipment_items` table with validation flags
8. **Admin reviews later** → Full editing capabilities

---

## Cost Analysis

### Google Gemini Vision API
- **Model:** Gemini 1.5 Flash
- **Cost:** $0.000125 per image
- **Typical manifest:** 1-3 pages = $0.0004/shipment
- **Annual cost (1,200 shipments):** ~$0.45/year

**Essentially free!**

---

## Integration Points

### Google Places API
- Address autocomplete for storage yard address
- Speeds up data entry
- Ensures accurate addresses

### Supabase Storage
- Secure document storage
- Row-level security (RLS)
- Automatic backups

### Supabase Webhooks
- Trigger Slack notifications on shipment INSERT
- Real-time notifications to MPS team

### iCal Format
- Universal calendar compatibility
- Works with Outlook, Google Calendar, Apple Calendar
- No Microsoft Graph OAuth required (for now)

---

## Success Metrics

### Customer Experience
- ⏱️ **Booking time:** <5 minutes
- 📝 **Data entry fields:** <10 (minimal friction)
- 🤖 **AI accuracy:** >95% for clear manifests
- ✅ **User satisfaction:** High (engineer-friendly)

### Admin Efficiency
- 🔍 **Review time:** <2 minutes per delivery
- ✏️ **Correction rate:** <10% of fields need editing
- 📊 **Data quality:** >99% accuracy after admin review

---

## Next Implementation Steps

### Week 1: Build Wizard UI
1. ✅ TimeSlotPicker (complete - 1-hour slots, conditional pricing)
2. Create `StorageYardStep.tsx`
3. Create `TruckingDriverStep.tsx`
4. Integrate Google Places API

### Week 2: Document Processing
1. Build `DocumentUploadStep.tsx`
2. ✅ Manifest processing service (complete)
3. Build `LoadSummaryReview.tsx` (read-only)
4. Test AI extraction with sample manifests

### Week 3: Calendar & Admin
1. ✅ iCal generation service (complete)
2. Set up Slack webhook
3. Build `ManifestEditTable.tsx` for AdminDashboard
4. End-to-end testing

---

## Questions & Answers

**Q: What if the trucking company is the same as the storage company?**
**A:** Customer enters same name in both fields. Driver info is still required.

**Q: What if AI extraction is wrong?**
**A:** Admin fixes it in their dashboard. Customer doesn't see errors - keeps flow frictionless.

**Q: Can customer upload manifest later?**
**A:** Not in initial version. Manifest upload is required to complete booking (provides load details).

**Q: What if manifest is handwritten?**
**A:** Gemini Vision handles handwriting. If accuracy is poor, admin corrects it.

**Q: What if customer books same-day delivery?**
**A:** Allowed! No minimum notice period. Slack notification alerts MPS team immediately.

**Q: What happens if time slot is already booked?**
**A:** UI shows slot as unavailable (grayed out). Backend checks `dock_appointments` table for conflicts.

---

**Last Updated:** January 2025
**Status:** ✅ Core services built, wizard UI in development
