# PipeVault User Workflows

Complete guide to customer and admin workflows from start to finish.

**Last Updated:** November 2025
**Version:** 2.0.8

---

## Table of Contents

1. [Customer Journey](#customer-journey)
2. [Admin Journey](#admin-journey)
3. [Workflow State Machine](#workflow-state-machine)
4. [Database Interaction Patterns](#database-interaction-patterns)
5. [Visual Cues & User Feedback](#visual-cues--user-feedback)
6. [Backend Communication](#backend-communication)

---

## Customer Journey

### Phase 1: Account Creation & Onboarding

**Step 1.1: Signup Form**

Customer navigates to signup page and enters:
- Email address (used for login and company identification)
- Password (Supabase Auth requirements: min 8 characters)
- First name
- Last name
- Company name
- Contact phone number

**What Happens Behind the Scenes:**
```typescript
// Frontend: Auth.tsx
const { data, error } = await supabase.auth.signUp({
  email,
  password,
  options: {
    data: {
      first_name: firstName,
      last_name: lastName,
      company_name: companyName,
      contact_phone: contactPhone
    }
  }
});
```

**Database Changes:**
1. Supabase creates user in `auth.users` table
2. User metadata stored in `auth.users.raw_user_meta_data` JSON column
3. Email domain extracted (`@apexdrilling.com`)
4. `companies` table checked for existing company with that domain
5. If new company: INSERT into `companies` (id, name, domain)
6. Verification email sent via Supabase Auth

**Notification Triggers:**
- Slack notification to MPS admin channel: "New user signup"
- Includes: name, email, company, phone

**Step 1.2: Email Verification**

Customer receives email with verification link.

**What Happens:**
- Click link → Supabase Auth verifies email
- `auth.users.email_confirmed_at` timestamp set
- User can now log in

**Step 1.3: First Login**

Customer enters email and password.

**What Happens Behind the Scenes:**
```typescript
// Frontend: Auth.tsx
const { data, error } = await supabase.auth.signInWithPassword({
  email,
  password
});
```

**Database Queries:**
1. Supabase Auth validates credentials
2. JWT token generated with user ID and email
3. Frontend stores session in AuthContext
4. App.tsx extracts user metadata:
   - first_name, last_name, company_name, contact_phone
5. Query companies table to get company_id:
```sql
SELECT id FROM companies WHERE domain = 'apexdrilling.com'
```

**Step 1.4: Dashboard Introduction**

Customer lands on modern **tile-based dashboard**.

**UI Elements:**
- **Header**: Company name, user name, logout button
- **"Request Storage" Button**: Prominent gradient button above tiles
- **Roughneck AI Tile**: Permanent tile with live weather, status summary, chat input
- **Request Tiles**: Empty state initially ("No active projects")

**What Loads:**
```typescript
// hooks/useSupabaseData.ts
const storageRequests = useQuery({
  queryKey: ['storageRequests', companyId],
  queryFn: async () => {
    const { data } = await supabase
      .from('storage_requests')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });
    return data;
  }
});
```

**RLS Security:**
Row-Level Security ensures customer only sees their company's data:
```sql
-- storage_requests RLS policy
CREATE POLICY "Customers see only their company's requests"
ON storage_requests FOR SELECT TO authenticated
USING (
  company_id = (
    SELECT id FROM companies
    WHERE domain = split_part(auth.jwt()->>'email', '@', 2)
  )
);
```

---

### Phase 2: Storage Request Submission

**Step 2.1: Click "Request Storage" Button**

Customer clicks the prominent "Request Storage" button.

**What Happens:**
- StorageRequestWizard component mounts
- Wizard initializes with pre-filled contact info from signup metadata:
  ```typescript
  const { user } = useAuth();
  const contactInfo = {
    name: `${user.first_name} ${user.last_name}`,
    phone: user.contact_phone,
    email: user.email,
    company: user.company_name
  };
  ```

**Step 2.2: Wizard Flow**

**Screen 1: Contact Information**
- **Pre-filled**: Name, phone, email, company (read-only summary)
- **Why**: Eliminates duplicate data entry, reduces errors
- Customer reviews and proceeds

**Screen 2: Pipe Specifications**
Customer enters:
- Item type (Casing, Tubing, Drill Pipe, Line Pipe, Structural Tubing)
- Grade (e.g., L80, P110, J55)
- Connection type (e.g., BTC, LTC, VAM TOP) **with thread type display**
- Size (outer diameter, weight per foot)
- Quantity (number of joints)
- Average length per joint (meters)
- Total weight estimate (calculated: joints × length × weight_per_foot)

**Why Thread Type Matters:**
- Thread type (e.g., "8 Round" for BTC) displayed alongside connection
- Critical for rack assignment (threaded vs non-threaded storage requirements)
- Admin sees this during approval to select appropriate racks

**Screen 3: Storage Duration**
Customer selects:
- Desired start date (when pipe will arrive)
- Desired end date (estimated pickup date)
- Duration calculated and displayed (e.g., "90 days")

**Screen 4: Trucking Preferences**
Customer chooses:
- **Option A: Customer Delivery** - Customer arranges trucking to MPS
- **Option B: MPS Pickup** - MPS arranges trucking (requires pickup location, contact)

If MPS Pickup selected:
- Pickup location address
- On-site contact name and phone
- Special instructions (access codes, site requirements)

**Step 2.3: Submission**

Customer clicks "Submit Request".

**What Happens Behind the Scenes:**

1. **Generate Reference ID:**
```typescript
// utils/referenceId.ts
const refId = `REF-${format(new Date(), 'yyyyMMdd')}-${String(dailyCount + 1).padStart(3, '0')}`;
// Example: REF-20251110-001
```

2. **AI Summary Generation:**
```typescript
// services/geminiService.ts
const summary = await gemini.generateText({
  prompt: `Summarize this storage request for admin review: ${JSON.stringify(requestData)}`,
  temperature: 0.1
});
```

3. **Database INSERT:**
```typescript
const { data, error } = await supabase
  .from('storage_requests')
  .insert({
    company_id: companyId,
    user_email: user.email,
    reference_id: refId,
    status: 'PENDING',
    request_details: {
      pipe: {
        item_type,
        grade,
        connection,
        thread_type,
        size,
        joints,
        avg_length_m,
        total_weight_lbs
      },
      storage: {
        start_date,
        end_date,
        duration_days
      },
      trucking: {
        delivery_method,
        pickup_location,
        contact_info
      }
    },
    trucking_info: truckingPreferences,
    ai_summary: summary
  })
  .select()
  .single();
```

4. **Notification Trigger Fires:**
Database trigger inserts into `notification_queue`:
```sql
-- Trigger function
INSERT INTO notification_queue (type, payload, processed)
VALUES (
  'storage_request',
  jsonb_build_object(
    'request_id', NEW.id,
    'reference_id', NEW.reference_id,
    'company_name', (SELECT name FROM companies WHERE id = NEW.company_id),
    'user_email', NEW.user_email,
    'pipe_specs', NEW.request_details->'pipe',
    'summary', NEW.ai_summary
  ),
  false
);
```

5. **Slack Notification Sent:**
Notification worker processes queue and posts to Slack:
```
🔔 New Storage Request
Reference: REF-20251110-001
Company: Apex Drilling
Customer: John Smith (john@apexdrilling.com)
Pipe: 100 joints of P110 BTC (8 Round) casing
Duration: 90 days
```

6. **Frontend Redirect:**
```typescript
navigate(`/requests/${data.id}`);
// Shows new request tile with PENDING status
```

**Database State After Submission:**
```
storage_requests:
  id: uuid-generated
  company_id: <company-uuid>
  user_email: john@apexdrilling.com
  reference_id: REF-20251110-001
  status: PENDING
  request_details: {...pipe specs, storage duration, trucking...}
  ai_summary: "Customer requests 90-day storage for 100 joints..."
  created_at: 2025-11-10 10:30:00
  updated_at: 2025-11-10 10:30:00

notification_queue:
  id: uuid-generated
  type: storage_request
  payload: {requestId, referenceId, companyName, ...}
  processed: false
  created_at: 2025-11-10 10:30:00
```

---

### Phase 3: Waiting for Approval

**What Customer Sees:**

**Request Tile on Dashboard:**
```
┌─────────────────────────────────────┐
│ REF-20251110-001                    │
│ [PENDING APPROVAL] ⚠️ Yellow Badge  │
│                                     │
│ Pipe: 100 joints P110 BTC (8 Round)│
│ Quantity: 3,050 m (10,000 ft)       │
│ Duration: 90 days                   │
│ Submitted: Nov 10, 2025             │
│                                     │
│ Status: Awaiting Admin Approval     │
│ Next: Admin will review and assign  │
│       storage location              │
└─────────────────────────────────────┘
```

**Roughneck AI Tile Available:**
Customer can ask questions:
- "What's the status of my request?"
- "How long does approval usually take?"
- "What happens after approval?"

**AI Response (with RLS enforcement):**
```typescript
// Chatbot context enrichment
const context = {
  storageRequests: await supabase
    .from('storage_requests')
    .select('*')
    .eq('company_id', companyId), // RLS automatically filters

  loads: await supabase
    .from('trucking_loads')
    .select('*')
    .in('storage_request_id', requestIds) // RLS via FK join
};

// System prompt includes:
"You have access to this customer's data only. Never reference other companies."
```

**What Customer CANNOT Do:**
- Edit the request (no modification after submission)
- Cancel the request (must contact admin)
- Book inbound loads (button disabled until approved)

**Backend State:**
- storage_requests.status remains 'PENDING'
- No scheduled loads
- No inventory records
- No rack assignments

---

### Phase 4: Post-Approval Actions

**Admin Approves Request** (see Admin Journey section for details)

**What Happens:**
1. Admin executes `approve_storage_request_atomic()` RPC
2. Atomic transaction updates:
   ```sql
   UPDATE storage_requests
   SET status = 'APPROVED',
       assigned_rack_ids = ARRAY['A-A1-10', 'B-B1-05'],
       admin_notes = 'Approved for 90-day storage',
       approved_at = NOW()
   WHERE id = <request-uuid>;

   UPDATE racks
   SET occupied = occupied + 50
   WHERE id IN ('A-A1-10', 'B-B1-05');

   INSERT INTO admin_audit_log ...
   INSERT INTO notification_queue (type='storage_request_approved', ...) ...
   ```

**Customer Notification:**
Email sent via notification worker:
```
Subject: Storage Request Approved - REF-20251110-001

Your storage request has been approved!

Reference: REF-20251110-001
Assigned Racks: A-A1-10, B-B1-05
Storage Duration: 90 days
Next Step: Book your first inbound load

[Book Inbound Load] button
```

**Dashboard Update:**

**Realtime Subscription Fires:**
```typescript
// hooks/useSupabaseData.ts - Realtime setup
supabase
  .channel('storage-requests')
  .on('postgres_changes', {
    event: 'UPDATE',
    schema: 'public',
    table: 'storage_requests',
    filter: `company_id=eq.${companyId}`
  }, (payload) => {
    queryClient.invalidateQueries(['storageRequests']);
  })
  .subscribe();
```

**Request Tile Updates Instantly:**
```
┌─────────────────────────────────────┐
│ REF-20251110-001                    │
│ [APPROVED] ✅ Green Badge            │
│                                     │
│ Pipe: 100 joints P110 BTC (8 Round)│
│ Quantity: 3,050 m (10,000 ft)       │
│ Duration: 90 days                   │
│ Racks: A-A1-10, B-B1-05             │
│                                     │
│ [Book First Inbound Load] 🚚        │
│                                     │
│ Status: Ready for Delivery          │
│ Next: Schedule your first load      │
└─────────────────────────────────────┘
```

**"Book First Inbound Load" Button Now Enabled!**

---

### Phase 5: Inbound Load Booking

**Step 5.1: Click "Book First Inbound Load"**

Customer clicks button on approved request tile.

**What Happens:**
- InboundShipmentWizard component mounts
- Wizard initializes with request context:
  ```typescript
  const { request } = useStorageRequest(requestId);
  const wizardContext = {
    requestId: request.id,
    referenceId: request.reference_id,
    assignedRacks: request.assigned_rack_ids,
    pipeSpecs: request.request_details.pipe,
    loadNumber: 1 // First load for this request
  };
  ```

**Step 5.2: 8-Step Wizard Flow**

**Step 1: Storage Info Confirmation**
- Shows: Reference ID, pipe specs, assigned racks (read-only)
- Purpose: Customer verifies they're booking for correct request
- Button: "Continue"

**Step 2: Trucking Method Selection**
Customer chooses:
- **Customer Delivery**: Customer trucking company delivers to MPS
- **MPS Pickup**: MPS arranges trucking (requires pickup location)

If Customer Delivery:
- Trucking company name
- Dispatcher contact

If MPS Pickup:
- Pickup location
- On-site contact

**Step 3: Driver Details**
Customer enters:
- Driver name
- Driver phone
- Truck license plate (for gate access)
- Special instructions (oversized load, escort required, etc.)

**Step 4: Time Slot Selection**

**TimeSlotPicker Component:**
```
┌─────────────────────────────────────┐
│ Select Delivery Date & Time         │
│                                     │
│ [< November 2025 >]                 │
│                                     │
│ Mo Tu We Th Fr Sa Su                │
│ 4  5  6  7  8  9  10                │
│ 11 [12] 13 14 15 16 17 OFF OFF      │
│ 18 19 20 21 22 23 24 OFF OFF        │
│                                     │
│ Selected: Wednesday, Nov 12         │
│                                     │
│ Available Time Slots:               │
│ ○ 7:00 AM - 9:00 AM                 │
│ ○ 9:00 AM - 11:00 AM                │
│ ● 11:00 AM - 1:00 PM ✓              │
│ ○ 1:00 PM - 3:00 PM                 │
│ ○ 3:00 PM - 4:00 PM                 │
│                                     │
│ MPS Receiving Hours: 7 AM - 4 PM    │
│ Weekdays Only (Weekend: +$450)      │
└─────────────────────────────────────┘
```

**Weekend Handling:**
- Weekend dates show "OFF" badge
- If weekend selected: "$450 off-hours surcharge" displayed
- Surcharge automatically added to load record

**Database Query for Available Slots:**
```sql
-- Check existing bookings for selected date
SELECT scheduled_slot_start, scheduled_slot_end
FROM trucking_loads
WHERE DATE(scheduled_slot_start) = '2025-11-12'
  AND status NOT IN ('CANCELLED', 'COMPLETED');
```

**Slot Availability Logic:**
```typescript
const bookedSlots = existingLoads.map(l => ({
  start: l.scheduled_slot_start,
  end: l.scheduled_slot_end
}));

const availableSlots = TIME_SLOTS.filter(slot =>
  !bookedSlots.some(booked =>
    slotsOverlap(slot, booked)
  )
);
```

**Step 5: Document Upload**

Customer has two options:

**Option A: Upload Documents Now**
- Drag-and-drop zone for PDF/images
- Accepts: manifest, bill of lading, tally sheet
- Multiple files supported
- File size limit: 10 MB per file

**Upload Flow:**
```typescript
// Upload to Supabase Storage
const { data: storageData, error: uploadError } = await supabase.storage
  .from('documents')
  .upload(`manifests/${loadId}/${fileName}`, file);

// Create document record
const { data: docData } = await supabase
  .from('trucking_documents')
  .insert({
    trucking_load_id: loadId,
    file_name: fileName,
    storage_path: storageData.path,
    document_type: 'manifest',
    uploaded_by: user.email
  })
  .select()
  .single();

// Trigger AI processing
await processManifest(storageData.path, docData.id);
```

**AI Manifest Processing:**
```typescript
// services/manifestProcessingService.ts
export async function processManifest(storagePath: string, documentId: string) {
  // 1. Fetch file from storage
  const { data: fileData } = await supabase.storage
    .from('documents')
    .download(storagePath);

  // 2. Convert to base64
  const base64 = await fileToBase64(fileData);

  // 3. Call Gemini Vision API
  const response = await gemini.generateContent({
    model: 'gemini-2.0-flash-exp',
    prompt: MANIFEST_EXTRACTION_PROMPT,
    image: base64,
    temperature: 0.1 // Low temperature for accuracy
  });

  // 4. Parse response to structured JSON
  const manifestItems: ManifestItem[] = parseManifestResponse(response);

  // 5. Validate extracted data
  const validation = validateManifestItems(manifestItems);

  // 6. Save to database
  await supabase
    .from('trucking_documents')
    .update({
      parsed_payload: manifestItems,
      extraction_quality: validation.quality // green/yellow/red
    })
    .eq('id', documentId);

  return { manifestItems, validation };
}
```

**Extracted Data Structure:**
```typescript
interface ManifestItem {
  manufacturer: string; // "Tenaris", "TMK", etc.
  heat_number: string; // "D12345"
  serial_number: string; // "12345-001"
  tally_length_ft: number; // 31.5 (converted to meters in UI)
  quantity: number; // 1 (joint count)
  grade?: string; // "P110"
  weight_lbs?: number; // 287
  connection_type?: string; // "BTC"
}
```

**Option B: Skip Upload**
Customer clicks "Skip Upload" button:
- "Confirm Booking Without Documents" button in review step
- Documents can be added later by admin
- Manifest processing happens when admin uploads

**Why Skip?**
- Documents come with trucker (physical paperwork)
- Rush booking (documents follow later)
- Customer doesn't have manifest yet

**Step 6: AI Processing (if documents uploaded)**

Customer sees loading indicator:
```
🔄 Processing Manifest...
Extracting pipe data using AI
This may take 5-10 seconds
```

**AI Extraction Result:**
```
✅ Manifest Processed Successfully

Extracted Data:
- 87 joints identified
- Total length: 2,740 feet (835 meters)
- Manufacturers: Tenaris (45), TMK (42)
- Quality: 🟢 Complete (all fields present)

[Review Extracted Data] button
```

**If Extraction Partial:**
```
⚠️ Manifest Processed with Gaps

Extracted Data:
- 87 joints identified
- Total length: 2,740 feet (835 meters)
- Quality: 🟡 Partial (some serial numbers missing)

Admin will verify data upon arrival.
```

**Step 7: Review & Confirmation**

Customer reviews all booking details:
```
┌─────────────────────────────────────┐
│ Review Your Booking                 │
│                                     │
│ Request: REF-20251110-001           │
│ Load Number: #1                     │
│                                     │
│ Delivery Details:                   │
│ Date: Wednesday, Nov 12, 2025       │
│ Time: 11:00 AM - 1:00 PM            │
│ Driver: Mike Johnson                │
│ Phone: (555) 123-4567               │
│ Truck: ABC-123                      │
│                                     │
│ Trucking: Customer Delivery         │
│ Company: Swift Logistics            │
│                                     │
│ Documents: ✅ 1 manifest uploaded   │
│ AI Extracted: 87 joints, 835m       │
│                                     │
│ [Verify & Confirm Booking] 🚚       │
└─────────────────────────────────────┘
```

**Step 8: Confirmation**

Customer clicks "Verify & Confirm Booking".

**Database Transaction:**
```typescript
// 1. Get next sequence number for this request
const { data: existingLoads } = await supabase
  .from('trucking_loads')
  .select('sequence_number')
  .eq('storage_request_id', requestId)
  .eq('direction', 'INBOUND')
  .order('sequence_number', { ascending: false })
  .limit(1);

const nextSequence = existingLoads[0]?.sequence_number + 1 || 1;

// 2. Insert load record
const { data: load } = await supabase
  .from('trucking_loads')
  .insert({
    storage_request_id: requestId,
    sequence_number: nextSequence,
    direction: 'INBOUND',
    status: 'SCHEDULED',
    scheduled_slot_start: selectedSlot.start,
    scheduled_slot_end: selectedSlot.end,
    trucking_company: truckingCompany,
    driver_name: driverName,
    driver_phone: driverPhone,
    truck_license_plate: licensePlate,
    total_joints_planned: estimatedJoints,
    notes: specialInstructions
  })
  .select()
  .single();

// 3. Link uploaded documents to load
await supabase
  .from('trucking_documents')
  .update({ trucking_load_id: load.id })
  .eq('id', documentId);

// 4. Create inventory records (PENDING_DELIVERY status)
const inventoryRecords = manifestItems.map(item => ({
  request_id: requestId,
  trucking_load_id: load.id,
  manifest_item_id: item.serial_number,
  status: 'PENDING_DELIVERY'
}));

await supabase
  .from('inventory')
  .insert(inventoryRecords);
```

**Notification Trigger:**
```sql
-- Database trigger on trucking_loads INSERT
INSERT INTO notification_queue (type, payload, processed)
VALUES (
  'load_scheduled',
  jsonb_build_object(
    'load_id', NEW.id,
    'reference_id', (SELECT reference_id FROM storage_requests WHERE id = NEW.storage_request_id),
    'load_number', NEW.sequence_number,
    'scheduled_date', NEW.scheduled_slot_start,
    'driver_name', NEW.driver_name,
    'total_joints', NEW.total_joints_planned
  ),
  false
);
```

**Slack Notification:**
```
🚚 Load Scheduled
Reference: REF-20251110-001
Load #1 of 1
Date: Wednesday, Nov 12, 2025, 11:00 AM - 1:00 PM
Driver: Mike Johnson (555-123-4567)
Truck: ABC-123
Expected: 87 joints
Documents: ✅ Manifest uploaded, AI processed
```

**Success Screen:**
```
✅ Load Booked Successfully!

Load #1 Scheduled
Reference: REF-20251110-001
Date: Wednesday, Nov 12, 2025
Time: 11:00 AM - 1:00 PM

What's Next:
1. You'll receive a confirmation email
2. Driver should arrive in the scheduled window
3. MPS will verify pipe against manifest
4. You'll be notified when load is complete

[Back to Dashboard] [Book Another Load]
```

**Dashboard Update:**
Request tile now shows scheduled load:
```
┌─────────────────────────────────────┐
│ REF-20251110-001                    │
│ [IN PROGRESS] 🔵 Blue Badge         │
│                                     │
│ Pipe: 100 joints P110 BTC (8 Round)│
│ Racks: A-A1-10, B-B1-05             │
│                                     │
│ 📦 Load #1: SCHEDULED               │
│ Nov 12, 2025 @ 11:00 AM            │
│ Driver: Mike Johnson                │
│                                     │
│ [View Load Details]                 │
│ [Book Load #2] (if needed)          │
└─────────────────────────────────────┘
```

---

### Phase 6: Active Storage

**What Happens After Load Arrives:**

Admin marks load as "ARRIVED" in admin dashboard:
```typescript
await supabase
  .from('trucking_loads')
  .update({
    status: 'ARRIVED',
    arrived_at: NOW()
  })
  .eq('id', loadId);
```

**Admin Verifies Manifest:**
- Compares AI-extracted data to physical pipe count
- Updates `total_joints_completed` if different
- Marks discrepancies for customer notification

**Admin Assigns Inventory to Racks:**
```typescript
// Update inventory records with rack assignments
await supabase
  .from('inventory')
  .update({
    storage_area_id: 'A-A1-10',
    status: 'IN_STORAGE'
  })
  .eq('trucking_load_id', loadId)
  .in('id', selectedInventoryIds);
```

**Customer Dashboard Updates:**
```
┌─────────────────────────────────────┐
│ REF-20251110-001                    │
│ [IN STORAGE] 🟢 Green Badge         │
│                                     │
│ Pipe: 87 joints P110 BTC (8 Round) │
│ Racks: A-A1-10 (45 joints)          │
│        B-B1-05 (42 joints)          │
│                                     │
│ 📦 Load #1: COMPLETED ✅            │
│ Arrived: Nov 12, 2025               │
│                                     │
│ Storage Duration:                   │
│ ⏱️ 5 days in storage (85 remaining) │
│                                     │
│ [Request Pickup] (future feature)   │
└─────────────────────────────────────┘
```

**Roughneck AI Capabilities During Storage:**
Customer can ask:
- "Where is my pipe stored?"
  → Response: "Your 87 joints are in Racks A-A1-10 (45 joints) and B-B1-05 (42 joints)."
- "How long has it been in storage?"
  → Response: "5 days. You have 85 days remaining in your 90-day storage period."
- "Can I extend my storage?"
  → Response: "Yes, contact our team at..." (future: self-service extension)

**Backend State:**
```
storage_requests:
  status: APPROVED
  assigned_rack_ids: ['A-A1-10', 'B-B1-05']

trucking_loads:
  status: COMPLETED
  total_joints_completed: 87

inventory (87 records):
  status: IN_STORAGE
  storage_area_id: 'A-A1-10' (45 records)
  storage_area_id: 'B-B1-05' (42 records)

racks:
  A-A1-10: occupied = 45
  B-B1-05: occupied = 42
```

---

### Phase 7: Pickup & Completion

**Future Feature: Outbound Load Booking**

Similar wizard to inbound, but for pickup:
1. Select joints to pick up (partial or full)
2. Choose trucking method
3. Enter driver details
4. Select pickup slot
5. Confirm booking

**Admin Marks Outbound Load Complete:**
```typescript
await supabase
  .from('trucking_loads')
  .update({
    status: 'COMPLETED',
    completed_at: NOW()
  })
  .eq('id', outboundLoadId);

// Update inventory status
await supabase
  .from('inventory')
  .update({ status: 'PICKED_UP' })
  .eq('trucking_load_id', outboundLoadId);

// Decrement rack occupancy
await supabase
  .from('racks')
  .update({ occupied: occupied - jointsPickedUp })
  .eq('id', rackId);

// Update storage request if all pipe picked up
const remainingInventory = await supabase
  .from('inventory')
  .select('id')
  .eq('request_id', requestId)
  .neq('status', 'PICKED_UP');

if (remainingInventory.length === 0) {
  await supabase
    .from('storage_requests')
    .update({ status: 'COMPLETED' })
    .eq('id', requestId);
}
```

**Final Dashboard State:**
```
┌─────────────────────────────────────┐
│ REF-20251110-001                    │
│ [COMPLETED] ⚪ Gray Badge            │
│                                     │
│ Pipe: 87 joints P110 BTC (8 Round) │
│ Storage: 90 days                    │
│                                     │
│ ✅ All pipe picked up               │
│ Completed: Feb 10, 2026             │
│                                     │
│ [View Final Report]                 │
│ [Download Invoice]                  │
└─────────────────────────────────────┘
```

---

## Admin Journey

### Phase 1: Admin Login & Dashboard Access

**Step 1.1: Admin Authentication**

Admin navigates to login page and enters credentials.

**What Happens Behind the Scenes:**
```typescript
// Frontend: Auth.tsx
const { data, error } = await supabase.auth.signInWithPassword({
  email: adminEmail,
  password
});

// Check if user is admin
const { data: adminUser } = await supabase
  .from('admin_users')
  .select('user_id')
  .eq('user_id', data.user.id)
  .single();

if (!adminUser) {
  throw new Error('Access denied. Admin privileges required.');
}

// Set admin flag in AuthContext
setIsAdmin(true);
```

**Security:**
- `admin_users` table stores authorized admin user IDs
- RLS policies prevent non-admins from accessing admin views
- SECURITY DEFINER functions enforce admin checks at RPC level

**Step 1.2: Admin Dashboard Loads**

Admin lands on **new tile-based dashboard**.

**Layout:**
```
┌─────────────────────────────────────────────────────────────┐
│ [Header: MPS Group Admin | Logout]                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐        │
│ │ Pending      │ │ Active       │ │ Capacity     │        │
│ │ Approvals    │ │ Projects     │ │ Overview     │        │
│ │ 🔔 3 requests│ │ 12 projects  │ │ 67% utilized │        │
│ └──────────────┘ └──────────────┘ └──────────────┘        │
│                                                             │
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐        │
│ │ Inbound      │ │ Outbound     │ │ Recent       │        │
│ │ Loads        │ │ Loads        │ │ Activity     │        │
│ │ 5 scheduled  │ │ 2 upcoming   │ │ 8 actions    │        │
│ └──────────────┘ └──────────────┘ └──────────────┘        │
│                                                             │
│ ┌──────────────┐                                           │
│ │ Roughneck Ops│  (Admin AI Assistant)                    │
│ │ 💬 Ask me... │                                           │
│ └──────────────┘                                           │
│                                                             │
│ [Company Projects Carousel] ▼                              │
│                                                             │
│ ┌─────────────────┐ ┌─────────────────┐ ┌───────────────┐│
│ │ Apex Drilling   │ │ Summit Energy   │ │ Pinnacle Oil  ││
│ │ 2 projects      │ │ 1 project       │ │ 3 projects    ││
│ │ 🟡 1 pending    │ │ 🟢 all approved │ │ 🟢 all good   ││
│ └─────────────────┘ └─────────────────┘ └───────────────┘│
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**What Loads:**
```typescript
// hooks/useProjectSummaries.ts
const { data, isLoading } = useProjectSummaries();
// Calls RPC: get_project_summaries_by_company()
// Returns: CompanyWithProjects[] (nested data structure)
```

**RPC Function Execution:**
```sql
-- supabase/migrations/20251109000001_FINAL_CORRECTED.sql
CREATE FUNCTION get_project_summaries_by_company()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Security check
  IF NOT is_admin_user() THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  -- Complex query with 5 CTEs:
  -- 1. project_base: storage requests with company info
  -- 2. load_documents: trucking documents with AI manifests
  -- 3. project_loads: inbound/outbound loads with documents
  -- 4. rack_inventory: per-rack inventory counts
  -- 5. project_inventory: inventory summary per project

  RETURN (
    SELECT json_agg(
      json_build_object(
        'company', ...,
        'projects', projects_array
      )
    )
    FROM project_base
    GROUP BY company_id, company_name, company_domain
  );
END;
$$;
```

**Performance:**
- **9 indexes** optimize this query
- **100-200ms** execution time for 50 companies
- **React Query caching**: 30s stale, 60s polling
- **Realtime subscriptions**: Instant updates on changes

---

### Phase 2: Approval Workflow

**Step 2.1: Pending Approvals Tile**

Admin clicks "Pending Approvals" tile (shows count badge: "3").

**What Loads:**
```typescript
// hooks/useProjectSummaries.ts - Derived hook
const { data, projects } = useProjectSummaries();
const pendingRequests = projects.filter(p => p.status === 'PENDING');
```

**Pending Requests List:**
```
┌─────────────────────────────────────────────────────────────┐
│ Pending Approvals (3)                                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ REF-20251110-001 | Apex Drilling                           │
│ 📋 100 joints P110 BTC (8 Round) casing                    │
│ 📏 3,050 m (10,000 ft) total length                        │
│ ⏱️ 90 days storage requested                                │
│ 📝 AI Summary: "Customer requests 90-day storage for        │
│     100 joints of P110 BTC threaded casing..."             │
│ [View Details] [Approve] [Reject]                          │
│                                                             │
│ ─────────────────────────────────────────────────────────  │
│                                                             │
│ REF-20251110-002 | Summit Energy                           │
│ ...                                                         │
└─────────────────────────────────────────────────────────────┘
```

**Step 2.2: View Full Request Details**

Admin clicks "View Details" or "Approve" button.

**Request Detail Modal Opens:**
```
┌─────────────────────────────────────────────────────────────┐
│ Storage Request: REF-20251110-001                           │
│ Status: PENDING APPROVAL ⚠️                                 │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ 📧 Customer Information                                    │
│ Company: Apex Drilling                                      │
│ Contact: John Smith                                         │
│ Email: john@apexdrilling.com                               │
│ Phone: (555) 123-4567                                       │
│                                                             │
│ 📦 Pipe Specifications                                     │
│ Item Type: Casing                                          │
│ Grade: P110                                                 │
│ Connection: BTC (8 Round)      👈 Thread type displayed    │
│ Size: 9-5/8" OD, 53.5 lb/ft                                │
│ Quantity: 100 joints                                        │
│ Avg Length: 30.5 m (100 ft) per joint                      │
│ Total Length: 3,050 m (10,000 ft)                          │
│ Est. Weight: 53,500 lbs (24,267 kg)                        │
│                                                             │
│ 📅 Storage Duration                                        │
│ Start Date: Nov 15, 2025                                    │
│ End Date: Feb 13, 2026                                      │
│ Duration: 90 days                                           │
│                                                             │
│ 🚚 Trucking Preferences                                    │
│ Delivery Method: Customer Delivery                          │
│ Trucking Company: Swift Logistics                           │
│ Dispatcher: Sarah Johnson (555-987-6543)                    │
│                                                             │
│ 🤖 AI-Generated Summary                                    │
│ Customer requests 90-day storage for 100 joints of          │
│ P110 BTC threaded casing. Delivery by customer's           │
│ trucking company. Estimated weight 24 tonnes.               │
│                                                             │
│ ─────────────────────────────────────────────────────────  │
│                                                             │
│ 🏷️ Rack Assignment                                         │
│ [Select Racks ▼] (dropdown shows available racks)          │
│                                                             │
│ Available Racks (capacity ≥ 50 joints):                     │
│ ✅ A-A1-10 - Available: 100 joints (JOINT mode)            │
│ ✅ B-B1-05 - Available: 75 joints (JOINT mode)             │
│ ✅ C-C1-03 - Available: 120 joints (JOINT mode)            │
│ ❌ A-A2-08 - Available: 20 joints (insufficient)           │
│                                                             │
│ Selected Racks:                                             │
│ [x] A-A1-10 (assign 50 joints)                             │
│ [x] B-B1-05 (assign 50 joints)                             │
│                                                             │
│ Capacity Check: ✅ 100 available, 100 required             │
│                                                             │
│ 📝 Internal Notes (Admin Only)                             │
│ [Text area]                                                 │
│ "Approved for 90-day storage. Threaded casing requires     │
│  covered racks - assigned A and B yards."                   │
│                                                             │
│ [Approve Request] [Reject Request] [Cancel]                │
└─────────────────────────────────────────────────────────────┘
```

**Rack Selection Logic:**
```typescript
// Admin selects racks based on:
// 1. Available capacity (occupied < capacity)
// 2. Rack type (SLOT vs JOINT mode)
// 3. Pipe requirements (threaded = covered racks)
// 4. Yard proximity (minimize forklift travel)

const availableRacks = racks.filter(r =>
  (r.capacity - r.occupied) >= requiredJoints / selectedRacks.length
);

// Admin can split across multiple racks
const rackAssignments = [
  { rackId: 'A-A1-10', joints: 50 },
  { rackId: 'B-B1-05', joints: 50 }
];
```

**Step 2.3: Approve Request**

Admin clicks "Approve Request" button.

**What Happens - ATOMIC TRANSACTION:**

```typescript
// Frontend: hooks/useApprovalWorkflow.ts
const approveRequest = useApproveRequest();

await approveRequest.mutateAsync({
  requestId: request.id,
  assignedRackIds: ['A-A1-10', 'B-B1-05'],
  requiredJoints: 100,
  notes: 'Approved for 90-day storage. Threaded casing requires covered racks.'
});
```

**Backend - RPC Function Execution:**
```sql
-- supabase/migrations/20251109000006_fix_admin_user_id_test_mode.sql
CREATE FUNCTION approve_storage_request_atomic(
  p_request_id UUID,
  p_assigned_rack_ids TEXT[],
  p_required_joints INTEGER,
  p_notes TEXT DEFAULT NULL,
  p_admin_user_id TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_user_id TEXT;
  v_company_id UUID;
  v_company_name TEXT;
  v_user_email TEXT;
  v_reference_id TEXT;
  v_current_status TEXT;
  v_rack_record RECORD;
  v_total_capacity INTEGER := 0;
  v_total_occupied INTEGER := 0;
  v_available_capacity INTEGER := 0;
  v_rack_names TEXT[] := '{}';
  v_result JSON;
BEGIN
  -- Admin user ID (handles service role test mode)
  v_admin_user_id := COALESCE(
    p_admin_user_id,
    auth.uid()::text,
    'service_role'
  );

  -- Security check: Admin-only
  IF NOT is_admin_user() THEN
    RAISE EXCEPTION 'Access denied. Admin privileges required.'
      USING HINT = 'Only admins can approve storage requests';
  END IF;

  -- STEP 1: Validate request exists and is PENDING
  SELECT sr.company_id, sr.reference_id, sr.status::text, sr.user_email, c.name
  INTO v_company_id, v_reference_id, v_current_status, v_user_email, v_company_name
  FROM storage_requests sr
  INNER JOIN companies c ON c.id = sr.company_id
  WHERE sr.id = p_request_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Storage request not found: %', p_request_id;
  END IF;

  IF v_current_status != 'PENDING' THEN
    RAISE EXCEPTION 'Request % is not pending (current status: %)', v_reference_id, v_current_status
      USING HINT = 'Only PENDING requests can be approved';
  END IF;

  -- STEP 2: Validate rack capacity BEFORE any updates
  IF array_length(p_assigned_rack_ids, 1) IS NULL OR array_length(p_assigned_rack_ids, 1) = 0 THEN
    RAISE EXCEPTION 'At least one rack must be assigned'
      USING HINT = 'Provide one or more rack IDs in p_assigned_rack_ids';
  END IF;

  FOR v_rack_record IN
    SELECT r.id, r.name, r.capacity, r.occupied, (r.capacity - r.occupied) AS available
    FROM racks r
    WHERE r.id = ANY(p_assigned_rack_ids)
    ORDER BY r.name
  LOOP
    v_total_capacity := v_total_capacity + v_rack_record.capacity;
    v_total_occupied := v_total_occupied + v_rack_record.occupied;
    v_available_capacity := v_available_capacity + v_rack_record.available;
    v_rack_names := array_append(v_rack_names, v_rack_record.name);
  END LOOP;

  IF array_length(v_rack_names, 1) != array_length(p_assigned_rack_ids, 1) THEN
    RAISE EXCEPTION 'One or more rack IDs are invalid'
      USING HINT = 'Check that all rack IDs exist in racks table';
  END IF;

  IF v_available_capacity < p_required_joints THEN
    RAISE EXCEPTION 'Insufficient rack capacity: % joints required, % available across racks: %',
      p_required_joints, v_available_capacity, array_to_string(v_rack_names, ', ')
      USING HINT = 'Assign additional racks or reduce required joints';
  END IF;

  -- STEP 3: Update storage request status
  UPDATE storage_requests
  SET
    status = 'APPROVED',
    assigned_rack_ids = p_assigned_rack_ids,
    admin_notes = p_notes,
    approved_at = NOW(),
    updated_at = NOW()
  WHERE id = p_request_id;

  -- STEP 4: Update rack occupancy (distributed across racks)
  IF array_length(p_assigned_rack_ids, 1) = 1 THEN
    -- Single rack: assign all joints
    UPDATE racks
    SET occupied = occupied + p_required_joints, updated_at = NOW()
    WHERE id = p_assigned_rack_ids[1];
  ELSE
    -- Multiple racks: distribute evenly
    DECLARE
      v_joints_per_rack INTEGER;
      v_remainder INTEGER;
      v_rack_id TEXT;
      v_idx INTEGER := 1;
    BEGIN
      v_joints_per_rack := p_required_joints / array_length(p_assigned_rack_ids, 1);
      v_remainder := p_required_joints % array_length(p_assigned_rack_ids, 1);

      FOREACH v_rack_id IN ARRAY p_assigned_rack_ids
      LOOP
        UPDATE racks
        SET
          occupied = occupied + v_joints_per_rack + CASE WHEN v_idx <= v_remainder THEN 1 ELSE 0 END,
          updated_at = NOW()
        WHERE id = v_rack_id;
        v_idx := v_idx + 1;
      END LOOP;
    END;
  END IF;

  -- STEP 5: Insert audit log entry
  INSERT INTO admin_audit_log (admin_user_id, action, entity_type, entity_id, details, created_at)
  VALUES (
    v_admin_user_id,
    'APPROVE_REQUEST',
    'storage_request',
    p_request_id,
    json_build_object(
      'referenceId', v_reference_id,
      'companyName', v_company_name,
      'assignedRacks', v_rack_names,
      'requiredJoints', p_required_joints,
      'notes', p_notes
    ),
    NOW()
  );

  -- STEP 6: Insert notification queue entry
  INSERT INTO notification_queue (type, payload, processed, created_at)
  VALUES (
    'storage_request_approved',
    jsonb_build_object(
      'requestId', p_request_id,
      'referenceId', v_reference_id,
      'companyName', v_company_name,
      'userEmail', v_user_email,
      'subject', 'Storage Request Approved - ' || v_reference_id,
      'assignedRacks', v_rack_names,
      'requiredJoints', p_required_joints,
      'notes', p_notes,
      'notificationType', 'email'
    ),
    false,
    NOW()
  );

  -- STEP 7: Return success result
  v_result := json_build_object(
    'success', true,
    'requestId', p_request_id,
    'referenceId', v_reference_id,
    'status', 'APPROVED',
    'assignedRacks', v_rack_names,
    'requiredJoints', p_required_joints,
    'availableCapacity', v_available_capacity - p_required_joints,
    'message', format('Request %s approved successfully. Assigned to racks: %s', v_reference_id, array_to_string(v_rack_names, ', '))
  );

  RETURN v_result;

EXCEPTION WHEN OTHERS THEN
  -- All updates automatically rolled back on exception (ACID guarantee)
  RAISE EXCEPTION 'Approval failed: %', SQLERRM
    USING HINT = 'All changes have been rolled back. No partial state.';
END;
$$;
```

**ACID Transaction Guarantee:**
- All 6 operations (validate, update request, update racks, audit log, notification, return) execute in single transaction
- If ANY operation fails, ALL operations roll back
- No partial state possible (request approved but racks not updated, etc.)

**Database State After Approval:**
```
storage_requests:
  status: APPROVED (was PENDING)
  assigned_rack_ids: ['A-A1-10', 'B-B1-05'] (was NULL)
  admin_notes: "Approved for 90-day storage..." (was NULL)
  approved_at: 2025-11-10 14:30:00 (was NULL)
  updated_at: 2025-11-10 14:30:00

racks:
  A-A1-10:
    occupied: 50 (was 0)
    updated_at: 2025-11-10 14:30:00
  B-B1-05:
    occupied: 50 (was 0)
    updated_at: 2025-11-10 14:30:00

admin_audit_log (new row):
  admin_user_id: <admin-uuid>
  action: APPROVE_REQUEST
  entity_type: storage_request
  entity_id: <request-uuid>
  details: {referenceId, companyName, assignedRacks, requiredJoints, notes}
  created_at: 2025-11-10 14:30:00

notification_queue (new row):
  type: storage_request_approved
  payload: {requestId, referenceId, userEmail, subject, assignedRacks, ...}
  processed: false
  created_at: 2025-11-10 14:30:00
```

**Frontend Response:**
```typescript
// hooks/useApprovalWorkflow.ts - onSuccess callback
onSuccess: (result, request) => {
  // Invalidate React Query cache
  queryClient.invalidateQueries({ queryKey: ['projectSummaries'] });

  // Show success toast
  toast.success(`Request ${result.referenceId} approved!`);

  console.log('✅ Approval successful:', {
    requestId: result.requestId,
    assignedRacks: result.assignedRacks,
    availableCapacity: result.availableCapacity
  });
}
```

**Admin Dashboard Updates Automatically:**
- React Query cache invalidated
- `useProjectSummaries()` refetches immediately
- Pending Approvals tile count decreases (3 → 2)
- Company tile for Apex Drilling updates (🟡 → 🟢)
- Request removed from Pending list
- Request appears in Active Projects list

**Customer Notification:**
- Notification worker processes `notification_queue`
- Email sent via Resend API:
  ```
  Subject: Storage Request Approved - REF-20251110-001

  Your storage request has been approved!

  Reference: REF-20251110-001
  Assigned Racks: A-A1-10, B-B1-05
  Storage Duration: 90 days (Nov 15 - Feb 13)

  Next Step: Book your first inbound load to schedule delivery.

  [Book Inbound Load] button link
  ```

---

### Phase 3: Load Management

**Step 3.1: Inbound Loads Tile**

Admin clicks "Inbound Loads" tile (shows count: "5 scheduled").

**What Loads:**
```typescript
const { data } = useProjectSummaries();
const inboundLoads = data
  .flatMap(company => company.projects)
  .flatMap(project => project.inboundLoads)
  .filter(load => load.status === 'SCHEDULED' || load.status === 'ARRIVED');
```

**Inbound Loads List:**
```
┌─────────────────────────────────────────────────────────────┐
│ Scheduled Inbound Loads (5)                                 │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ 📅 Wednesday, Nov 12, 2025 @ 11:00 AM - 1:00 PM            │
│ REF-20251110-001 | Load #1 | Apex Drilling                 │
│ Driver: Mike Johnson (555-123-4567)                         │
│ Truck: ABC-123                                               │
│ Expected: 87 joints                                          │
│ 📄 Documents: ✅ Manifest uploaded, AI processed            │
│ [View Manifest Data] [Mark as Arrived]                      │
│                                                             │
│ ─────────────────────────────────────────────────────────  │
│                                                             │
│ 📅 Thursday, Nov 13, 2025 @ 9:00 AM - 11:00 AM             │
│ REF-20251110-002 | Load #1 | Summit Energy                 │
│ ...                                                         │
└─────────────────────────────────────────────────────────────┘
```

**Step 3.2: View AI-Extracted Manifest Data**

Admin clicks "View Manifest Data" button.

**ManifestDataDisplay Component Opens:**
```
┌─────────────────────────────────────────────────────────────┐
│ Manifest Data: REF-20251110-001, Load #1                   │
│ Uploaded: Nov 10, 2025 @ 2:30 PM                           │
│ Processed by: AI (Gemini Vision API)                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ 📊 Summary Cards                                           │
│                                                             │
│ ┌───────────────┐ ┌───────────────┐ ┌───────────────┐    │
│ │ Total Joints  │ │ Total Length  │ │ Total Weight  │    │
│ │ 87            │ │ 835 m         │ │ 25,000 lbs    │    │
│ │               │ │ (2,740 ft)    │ │ (11,340 kg)   │    │
│ └───────────────┘ └───────────────┘ └───────────────┘    │
│                                                             │
│ ┌───────────────────────────────────────┐                  │
│ │ Data Quality: 🟢 Complete             │                  │
│ │ All required fields present           │                  │
│ │ Manufacturers: Tenaris (45), TMK (42) │                  │
│ └───────────────────────────────────────┘                  │
│                                                             │
│ 📋 Detailed Manifest Table                                │
│                                                             │
│ #  | Mfr      | Heat #  | Serial # | Length | Qty | Wt    │
│ ───┼──────────┼─────────┼──────────┼────────┼─────┼────── │
│ 1  | Tenaris  | D12345  | 12345-001│ 9.6 m  │ 1   │ 287lb │
│ 2  | Tenaris  | D12345  | 12345-002│ 9.6 m  │ 1   │ 287lb │
│ 3  | Tenaris  | D12346  | 12346-001│ 9.5 m  │ 1   │ 285lb │
│ ...│ ...      │ ...     │ ...      │ ...    │ ... │ ...   │
│ 87 | TMK      | T98765  | 98765-042│ 9.7 m  │ 1   │ 289lb │
│                                                             │
│ [Export to CSV] [Verify Count] [Print]                     │
└─────────────────────────────────────────────────────────────┘
```

**Data Quality Indicators:**
- **🟢 Green**: All required fields present (manufacturer, heat number, length, quantity)
- **🟡 Yellow**: Some optional fields missing (serial number, weight)
- **🔴 Red**: Critical fields missing (manufacturer, length)

**Step 3.3: Mark Load as Arrived**

Admin clicks "Mark as Arrived" button when truck arrives at facility.

**What Happens:**
```typescript
await supabase
  .from('trucking_loads')
  .update({
    status: 'ARRIVED',
    arrived_at: NOW()
  })
  .eq('id', loadId);
```

**Load Status Updates:**
- SCHEDULED → ARRIVED
- Appears in "Arrived Loads" filter
- Admin can now verify physical count vs manifest

**Step 3.4: Verify Physical Count**

Admin compares AI-extracted manifest (87 joints) to physical count.

**If Count Matches:**
```typescript
await supabase
  .from('trucking_loads')
  .update({
    status: 'COMPLETED',
    total_joints_completed: 87,
    completed_at: NOW()
  })
  .eq('id', loadId);
```

**If Count Mismatches:**
```typescript
await supabase
  .from('trucking_loads')
  .update({
    status: 'COMPLETED',
    total_joints_completed: 85, // Actual count
    notes: 'Discrepancy: Manifest shows 87 joints, actual count 85. Customer notified.',
    completed_at: NOW()
  })
  .eq('id', loadId);

// Create discrepancy notification
await supabase
  .from('notification_queue')
  .insert({
    type: 'load_discrepancy',
    payload: {
      loadId,
      referenceId,
      manifestCount: 87,
      actualCount: 85,
      userEmail: customerEmail
    },
    processed: false
  });
```

**Step 3.5: Assign Inventory to Racks**

Admin assigns joints to specific racks (respecting approved `assigned_rack_ids`).

**Inventory Assignment UI:**
```
┌─────────────────────────────────────────────────────────────┐
│ Assign Inventory: REF-20251110-001, Load #1                │
│ Total Joints: 87                                            │
│ Assigned Racks: A-A1-10, B-B1-05                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ Rack A-A1-10:                                               │
│ Assign [45] joints [Assign] 📍                              │
│ Capacity: 100 (50 occupied, 50 available)                   │
│                                                             │
│ Rack B-B1-05:                                               │
│ Assign [42] joints [Assign] 📍                              │
│ Capacity: 75 (50 occupied, 25 available)                    │
│                                                             │
│ Total Assigned: 87 / 87 ✅                                  │
│                                                             │
│ [Confirm Assignment] [Cancel]                               │
└─────────────────────────────────────────────────────────────┘
```

**Database Updates:**
```typescript
// Update inventory records with rack assignments
await supabase
  .from('inventory')
  .update({
    storage_area_id: rackId,
    status: 'IN_STORAGE'
  })
  .eq('trucking_load_id', loadId)
  .in('id', selectedInventoryIds);
```

**Notification to Customer:**
```
Subject: Load #1 Received - REF-20251110-001

Your first load has been received and verified!

Load #1 Details:
- Received: Nov 12, 2025 @ 11:15 AM
- Joints: 87 (matches manifest ✅)
- Assigned Racks: A-A1-10 (45 joints), B-B1-05 (42 joints)

Your pipe is now in storage and secure.

[View Dashboard] button link
```

---

### Phase 4: Inventory & Rack Management

**Step 4.1: Storage Areas Overview**

Admin clicks "Capacity Overview" tile.

**Yard Utilization Display:**
```
┌─────────────────────────────────────────────────────────────┐
│ Storage Capacity Overview                                   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ 🏗️ Area A (Open Storage - SLOT mode)                       │
│ Utilization: 9.1% (2 of 22 slots occupied)                 │
│ ▓▓░░░░░░░░░░░░░░░░░░░░░░                                   │
│ Active Slots: A1-1, A1-2                                    │
│                                                             │
│ 🏗️ Yard B (Covered - JOINT mode)                          │
│ Utilization: 62% (4,500 of 7,250 joints)                   │
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░                                   │
│ Top Racks: B-B1-05 (95% full), B-B1-08 (89% full)          │
│                                                             │
│ 🏗️ Yard C (Covered - JOINT mode)                          │
│ Utilization: 45% (3,200 of 7,100 joints)                   │
│ ▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░                                   │
│                                                             │
│ 🏗️ Yard D (Covered - JOINT mode)                          │
│ Utilization: 38% (2,850 of 7,500 joints)                   │
│ ▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░                                     │
│                                                             │
│ 📊 Overall Utilization: 47% (10,552 of 22,094 capacity)   │
│                                                             │
│ [View Rack Details] [Capacity Report]                       │
└─────────────────────────────────────────────────────────────┘
```

**Per-Rack Details:**
Admin can drill down to individual racks:
```
┌─────────────────────────────────────────────────────────────┐
│ Rack: B-B1-05                                               │
│ Yard: B (Covered Storage)                                   │
│ Mode: JOINT                                                 │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ Capacity: 100 joints                                        │
│ Occupied: 95 joints (95%)                                   │
│ Available: 5 joints                                         │
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░                                   │
│                                                             │
│ 📦 Current Storage:                                        │
│ - REF-20251110-001 (Apex): 42 joints P110 BTC             │
│ - REF-20251107-008 (Summit): 35 joints L80 STC            │
│ - REF-20251105-003 (Pinnacle): 18 joints J55 LTC          │
│                                                             │
│ 🕒 Last Updated: Nov 12, 2025 @ 11:30 AM                   │
│                                                             │
│ [View Inventory Details] [Adjust Capacity]                  │
└─────────────────────────────────────────────────────────────┘
```

**Query Behind the Scenes:**
```sql
SELECT
  r.id,
  r.name,
  r.capacity,
  r.occupied,
  (r.capacity - r.occupied) as available,
  array_agg(DISTINCT sr.reference_id) as stored_requests
FROM racks r
LEFT JOIN inventory i ON i.storage_area_id = r.id
LEFT JOIN storage_requests sr ON sr.id = i.request_id
WHERE r.id = 'B-B1-05'
GROUP BY r.id, r.name, r.capacity, r.occupied;
```

---

### Phase 5: Roughneck Ops (Admin AI Assistant)

**Step 5.1: Open Roughneck Ops**

Admin clicks "Roughneck Ops" tile or chat icon.

**Admin AI Assistant Interface:**
```
┌─────────────────────────────────────────────────────────────┐
│ Roughneck Ops - Admin Assistant 🤖                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ 👋 How can I help you manage operations today?            │
│                                                             │
│ 💡 Suggested Queries:                                      │
│ • "Which racks are over 80% capacity?"                      │
│ • "Show me all pending approvals"                           │
│ • "What's our total utilization?"                           │
│ • "Which companies have the most active projects?"          │
│                                                             │
│ ─────────────────────────────────────────────────────────  │
│                                                             │
│ [Chat input box...]                                         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Example Conversation:**

**Admin:** "Which racks are over 80% capacity?"

**AI Processing:**
```typescript
// System prompt for admin context:
const systemPrompt = `
You are Roughneck Ops, an AI assistant for MPS Group administrators.
You have access to ALL companies' data (no RLS filtering).
You can query storage requests, loads, inventory, rack capacity, and audit logs.
Provide data-driven insights and recommendations.
`;

// Context enrichment (no RLS - admin sees all):
const context = {
  racks: await supabase.from('racks').select('*'),
  inventory: await supabase.from('inventory').select('*'),
  requests: await supabase.from('storage_requests').select('*')
};

// AI generates SQL query or processes data
const highUtilizationRacks = racks.filter(r =>
  (r.occupied / r.capacity) > 0.80
);
```

**Roughneck Ops Response:**
```
📊 High-Utilization Racks (>80% Full):

1. **B-B1-05** - 95% (95/100 joints)
   - 🔴 CRITICAL: Only 5 joints available
   - Companies: Apex (42j), Summit (35j), Pinnacle (18j)
   - Recommendation: Consider moving Pinnacle to C-C1-03

2. **B-B1-08** - 89% (89/100 joints)
   - 🟡 WARNING: Limited capacity
   - Companies: Apex (60j), Summit (29j)

3. **C-C2-04** - 84% (101/120 joints)
   - 🟡 WARNING: 19 joints available
   - Companies: Pinnacle (65j), Summit (36j)

💡 Action Items:
- Evaluate moving pipe from B-B1-05 to free up covered storage
- Consider prioritizing pickups for long-term storage (>60 days)
- Yard D has 62% available capacity - suggest for new approvals
```

**Admin:** "Show me all pending approvals"

**Roughneck Ops Response:**
```
📋 Pending Approvals (3 requests):

1. **REF-20251110-003** - Pinnacle Oil
   - 120 joints J55 LTC tubing
   - 60-day storage
   - Submitted: Nov 10, 2025
   - 🟢 Capacity available in Yard D

2. **REF-20251110-004** - Summit Energy
   - 75 joints P110 VAM TOP casing
   - 90-day storage
   - Submitted: Nov 10, 2025
   - 🟡 Threaded - requires covered storage (Yards B/C at 62%/45%)

3. **REF-20251109-012** - Apex Drilling
   - 200 joints L80 STC casing
   - 120-day storage
   - Submitted: Nov 9, 2025
   - 🔴 Large quantity - may need multiple racks

💡 Recommendation: Approve REF-20251110-003 first (Yard D availability).
REF-20251110-004 needs careful rack selection due to threading.
REF-20251109-012 requires capacity planning discussion.
```

**Key Differences from Customer Chatbot:**
- **Data Scope**: Admin sees ALL companies, customer sees only theirs
- **Capabilities**: Admin can generate reports, customer can ask project-specific questions
- **Persona**: Data-driven analyst vs conversational field hand
- **Actions**: Admin can take actions (approve/reject), customer is read-only

---

## Workflow State Machine

PipeVault uses an 8-state workflow state machine to track project progress from submission to completion.

### State Definitions

**1. Pending Approval**
- **Trigger**: Customer submits new storage request
- **Database**: `storage_requests.status = 'PENDING'`
- **Customer View**: Yellow badge "Awaiting Admin Approval"
- **Admin View**: Appears in Pending Approvals tile
- **Available Actions**:
  - Customer: Ask questions via Roughneck AI
  - Admin: Approve or reject request
- **Next Milestone**: Admin must approve or reject

**2. Waiting on Load #N to MPS**
- **Trigger**: Request approved but first inbound load not yet scheduled/arrived
- **Database**:
  - `storage_requests.status = 'APPROVED'`
  - `trucking_loads.status IN ('PENDING', 'SCHEDULED')`
  - Load exists with `direction = 'INBOUND'`
- **Customer View**: Blue badge "Waiting on Load #1"
- **Admin View**: Shows scheduled inbound load date/time
- **Available Actions**:
  - Customer: "Book First Inbound Load" button or "Book Load #2" (if sequential)
  - Admin: View scheduled loads, mark as arrived
- **Next Milestone**: Customer books load OR truck arrives at facility
- **Progress Calculation**: 20% + (sequence_number / total_loads) * 40%

**3. All Loads Received**
- **Trigger**: All inbound loads status = 'COMPLETED' but manifests not processed
- **Database**:
  - All `trucking_loads` (INBOUND) have `status = 'COMPLETED'`
  - `trucking_documents.parsed_payload` is NULL (manifest not processed)
- **Customer View**: Blue badge "Processing Manifests"
- **Admin View**: "Needs Manifest Review" filter highlights this project
- **Available Actions**:
  - Customer: Wait (read-only state)
  - Admin: Upload manifest, trigger AI processing, verify data
- **Next Milestone**: Admin uploads/processes all manifests
- **Progress Calculation**: 60%

**4. In Storage**
- **Trigger**: All loads received AND all manifests processed AND inventory assigned
- **Database**:
  - All inbound loads completed
  - All `trucking_documents.parsed_payload` is NOT NULL
  - `inventory.status = 'IN_STORAGE'`
  - `inventory.storage_area_id` is NOT NULL
- **Customer View**: Green badge "In Storage"
- **Admin View**: Active Projects tile, capacity tracking
- **Available Actions**:
  - Customer: View rack assignments, storage duration, request pickup (future)
  - Admin: Monitor capacity, adjust assignments
- **Next Milestone**: Customer requests pickup OR storage duration expires
- **Progress Calculation**: 70%

**5. Pending Pickup Request**
- **Trigger**: Storage duration approaching end (within 14 days of end_date)
- **Database**:
  - `inventory.status = 'IN_STORAGE'`
  - `CURRENT_DATE > (storage_end_date - 14 days)`
  - No outbound loads exist
- **Customer View**: "Request Pickup" button enabled, countdown warning
- **Admin View**: "Approaching End Date" filter highlights project
- **Available Actions**:
  - Customer: Request pickup (initiates outbound load booking)
  - Admin: Contact customer proactively
- **Next Milestone**: Customer initiates pickup request
- **Progress Calculation**: 70% (same as In Storage)

**6. Pickup Requested**
- **Trigger**: Customer submitted pickup request (outbound load created)
- **Database**:
  - `trucking_loads` exists with `direction = 'OUTBOUND'`, `status = 'PENDING'`
  - `inventory.status = 'IN_STORAGE'` (not yet picked up)
- **Customer View**: "Pickup Requested" badge (blue)
- **Admin View**: Outbound Loads tile shows pending pickup
- **Available Actions**:
  - Customer: Modify pickup details (if not yet scheduled)
  - Admin: Schedule pickup slot, confirm with customer
- **Next Milestone**: Admin schedules pickup
- **Progress Calculation**: 75%

**7. Waiting on Load #N Pickup**
- **Trigger**: Outbound load scheduled
- **Database**:
  - Outbound `trucking_loads.status = 'SCHEDULED'`
  - `scheduled_slot_start` is set
- **Customer View**: "Pickup Scheduled" badge with date/time
- **Admin View**: Upcoming pickups in Outbound Loads tile
- **Available Actions**:
  - Customer: View pickup details, contact driver (if needed)
  - Admin: Mark as completed when truck departs
- **Next Milestone**: Truck arrives, pipe loaded, truck departs
- **Progress Calculation**: 80% + (outbound_sequence / total_outbound_loads) * 20%

**8. Complete**
- **Trigger**: All outbound loads completed OR all inventory picked up
- **Database**:
  - All outbound `trucking_loads.status = 'COMPLETED'`
  - All `inventory.status = 'PICKED_UP'`
  - `storage_requests.status = 'COMPLETED'`
- **Customer View**: Gray badge "Complete", project archived
- **Admin View**: Archived Projects section
- **Available Actions**:
  - Customer: View final report, download invoice, rate experience
  - Admin: Generate final billing, close project
- **Next Milestone**: None (terminal state)
- **Progress Calculation**: 100%

### State Calculation Logic

The `calculateWorkflowState()` function (in `utils/workflowStates.ts`) determines state based on project data:

```typescript
export function calculateWorkflowState(project: ProjectSummary): WorkflowStateResult {
  const { status, inboundLoads, outboundLoads, inventorySummary } = project;

  // ✅ IMPORTANT: Defensive copy before sorting (prevents React Query cache mutation)
  const sortedInbound = [...inboundLoads].sort((a, b) => a.sequenceNumber - b.sequenceNumber);
  const sortedOutbound = [...outboundLoads].sort((a, b) => a.sequenceNumber - b.sequenceNumber);

  // STATE 1: Pending Approval
  if (status === 'PENDING') {
    return {
      state: 'Pending Approval',
      label: 'Pending Admin Approval',
      badgeTone: 'pending',
      nextAction: 'Admin must approve or reject this request'
    };
  }

  // STATE 2: Rejected
  if (status === 'REJECTED') {
    return {
      state: 'Rejected',
      label: 'Request Rejected',
      badgeTone: 'danger',
      nextAction: null
    };
  }

  // STATE 3: Waiting on Load #N to MPS
  const nextPendingInbound = sortedInbound.find(
    load => load.status === 'PENDING' || load.status === 'SCHEDULED'
  );
  if (nextPendingInbound) {
    const scheduledDate = nextPendingInbound.scheduledSlotStart
      ? format(new Date(nextPendingInbound.scheduledSlotStart), 'MMM d')
      : 'TBD';

    return {
      state: 'Waiting on Load #N to MPS',
      label: `Waiting on Load #${nextPendingInbound.sequenceNumber} to MPS`,
      badgeTone: 'info',
      nextAction: `Load #${nextPendingInbound.sequenceNumber} scheduled for ${scheduledDate}`
    };
  }

  // STATE 4: All Loads Received (manifests being processed)
  const allInboundCompleted = sortedInbound.every(load => load.status === 'COMPLETED');
  const allManifestsProcessed = sortedInbound.every(load =>
    load.documents.some(doc => doc.parsedPayload !== null)
  );

  if (allInboundCompleted && !allManifestsProcessed) {
    return {
      state: 'All Loads Received',
      label: 'Processing Manifests',
      badgeTone: 'info',
      nextAction: 'Admin must upload and process manifest documents'
    };
  }

  // STATE 5: In Storage
  if (inventorySummary.inStorage > 0 && outboundLoads.length === 0) {
    const daysInStorage = Math.floor(
      (Date.now() - new Date(project.submittedAt).getTime()) / (1000 * 60 * 60 * 24)
    );

    return {
      state: 'In Storage',
      label: `In Storage (${daysInStorage} days)`,
      badgeTone: 'success',
      nextAction: 'Request pickup when ready'
    };
  }

  // STATE 6: Pickup Requested
  const hasOutboundPending = sortedOutbound.some(
    load => load.status === 'PENDING'
  );
  if (hasOutboundPending) {
    return {
      state: 'Pickup Requested',
      label: 'Pickup Requested',
      badgeTone: 'info',
      nextAction: 'Admin will schedule pickup slot'
    };
  }

  // STATE 7: Waiting on Load #N Pickup
  const nextScheduledOutbound = sortedOutbound.find(
    load => load.status === 'SCHEDULED'
  );
  if (nextScheduledOutbound) {
    const scheduledDate = format(
      new Date(nextScheduledOutbound.scheduledSlotStart),
      'MMM d'
    );

    return {
      state: 'Waiting on Load #N Pickup',
      label: `Pickup Scheduled - Load #${nextScheduledOutbound.sequenceNumber}`,
      badgeTone: 'info',
      nextAction: `Pickup on ${scheduledDate}`
    };
  }

  // STATE 8: Complete
  if (status === 'COMPLETED' || inventorySummary.pickedUp === inventorySummary.total) {
    return {
      state: 'Complete',
      label: 'Complete',
      badgeTone: 'neutral',
      nextAction: null
    };
  }

  // Default/Unknown State
  return {
    state: 'In Progress',
    label: 'In Progress',
    badgeTone: 'info',
    nextAction: 'Contact support if this state persists'
  };
}
```

### State Transition Diagram

```
[Customer Submits Request]
         ↓
    ┌─────────────┐
    │  PENDING    │ ← Admin can approve or reject
    │  APPROVAL   │
    └─────────────┘
         ↓ (Admin approves)
    ┌─────────────┐
    │  WAITING    │ ← Customer books inbound load
    │  ON LOAD #1 │
    └─────────────┘
         ↓ (Truck arrives, manifest uploaded)
    ┌─────────────┐
    │ ALL LOADS   │ ← Admin processes manifests
    │  RECEIVED   │
    └─────────────┘
         ↓ (Manifests processed, inventory assigned)
    ┌─────────────┐
    │ IN STORAGE  │ ← Storage duration active
    │             │
    └─────────────┘
         ↓ (Customer requests pickup)
    ┌─────────────┐
    │   PICKUP    │ ← Admin schedules outbound load
    │  REQUESTED  │
    └─────────────┘
         ↓ (Outbound load scheduled)
    ┌─────────────┐
    │  WAITING    │ ← Truck arrives, pipe loaded
    │ ON PICKUP   │
    └─────────────┘
         ↓ (All pipe picked up)
    ┌─────────────┐
    │  COMPLETE   │ ← Terminal state
    │             │
    └─────────────┘
```

---

## Database Interaction Patterns

### Storage Request Submission

**Frontend Action**: Customer submits storage request form

**Database Operations**:

1. **Generate Reference ID**:
```sql
-- Count requests for today
SELECT COUNT(*) FROM storage_requests
WHERE DATE(created_at) = CURRENT_DATE;
-- Result used to generate: REF-20251110-001
```

2. **Insert Request**:
```sql
INSERT INTO storage_requests (
  company_id,
  user_email,
  reference_id,
  status,
  request_details,
  trucking_info,
  ai_summary,
  created_at,
  updated_at
) VALUES (
  $1, -- company_id from JWT domain lookup
  $2, -- user email
  'REF-20251110-001',
  'PENDING',
  $3, -- JSONB pipe specs
  $4, -- JSONB trucking preferences
  $5, -- AI-generated summary
  NOW(),
  NOW()
) RETURNING *;
```

3. **Trigger Fires** (automatic):
```sql
-- Database trigger on storage_requests INSERT
CREATE TRIGGER notify_new_request
AFTER INSERT ON storage_requests
FOR EACH ROW
EXECUTE FUNCTION notify_new_storage_request();

-- Function body:
INSERT INTO notification_queue (type, payload, processed)
VALUES (
  'storage_request',
  jsonb_build_object(
    'request_id', NEW.id,
    'reference_id', NEW.reference_id,
    'company_name', (SELECT name FROM companies WHERE id = NEW.company_id),
    'user_email', NEW.user_email,
    'summary', NEW.ai_summary
  ),
  false
);
```

4. **RLS Enforcement**:
```sql
-- Customer can only insert for their company
CREATE POLICY "Customers can insert for their company"
ON storage_requests FOR INSERT TO authenticated
WITH CHECK (
  company_id = (
    SELECT id FROM companies
    WHERE domain = split_part(auth.jwt()->>'email', '@', 2)
  )
);
```

### Approval Workflow

**Frontend Action**: Admin clicks "Approve" button

**Database Operations**: See "Admin Journey - Phase 2: Approval Workflow" above for complete atomic transaction flow.

**Key Pattern**: SECURITY DEFINER function with admin check:
```sql
CREATE FUNCTION approve_storage_request_atomic(...)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER  -- Runs with function owner's privileges (bypasses RLS)
AS $$
BEGIN
  -- Admin check at function level
  IF NOT is_admin_user() THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  -- All updates in single transaction
  UPDATE storage_requests ...;
  UPDATE racks ...;
  INSERT INTO admin_audit_log ...;
  INSERT INTO notification_queue ...;

  RETURN success_json;
END;
$$;
```

### Load Booking

**Frontend Action**: Customer completes InboundShipmentWizard

**Database Operations**:

1. **Get Next Sequence Number**:
```sql
SELECT COALESCE(MAX(sequence_number), 0) + 1 AS next_sequence
FROM trucking_loads
WHERE storage_request_id = $1
  AND direction = 'INBOUND';
```

2. **Insert Load**:
```sql
INSERT INTO trucking_loads (
  storage_request_id,
  sequence_number,
  direction,
  status,
  scheduled_slot_start,
  scheduled_slot_end,
  trucking_company,
  driver_name,
  driver_phone,
  truck_license_plate,
  total_joints_planned,
  notes,
  created_at,
  updated_at
) VALUES (
  $1, -- request_id
  $2, -- next_sequence
  'INBOUND',
  'SCHEDULED',
  $3, -- slot start
  $4, -- slot end
  $5, -- trucking company
  $6, -- driver name
  $7, -- driver phone
  $8, -- license plate
  $9, -- estimated joints
  $10, -- special instructions
  NOW(),
  NOW()
) RETURNING *;
```

3. **Upload Documents to Storage**:
```typescript
// Frontend: Supabase Storage API
const { data: storageData, error } = await supabase.storage
  .from('documents')
  .upload(`manifests/${loadId}/${fileName}`, file, {
    cacheControl: '3600',
    upsert: false
  });
```

4. **Insert Document Record**:
```sql
INSERT INTO trucking_documents (
  trucking_load_id,
  file_name,
  storage_path,
  document_type,
  uploaded_by,
  uploaded_at,
  created_at,
  updated_at
) VALUES (
  $1, -- load_id
  $2, -- file name
  $3, -- storage path
  'manifest',
  $4, -- user email
  NOW(),
  NOW(),
  NOW()
) RETURNING *;
```

5. **Trigger AI Processing** (asynchronous):
```typescript
// services/manifestProcessingService.ts
await processManifest(storagePath, documentId);
// Updates trucking_documents.parsed_payload when complete
```

6. **Create Inventory Records**:
```sql
INSERT INTO inventory (
  request_id,
  trucking_load_id,
  manifest_item_id,
  status,
  created_at,
  updated_at
)
SELECT
  $1, -- request_id
  $2, -- load_id
  item->>'serial_number',
  'PENDING_DELIVERY',
  NOW(),
  NOW()
FROM jsonb_array_elements($3::jsonb) AS item; -- parsed_payload array
```

### Inventory Tracking

**Admin Action**: Mark load as arrived and assign to racks

**Database Operations**:

1. **Update Load Status**:
```sql
UPDATE trucking_loads
SET
  status = 'ARRIVED',
  arrived_at = NOW(),
  updated_at = NOW()
WHERE id = $1;
```

2. **Update Inventory with Rack Assignments**:
```sql
UPDATE inventory
SET
  storage_area_id = $2, -- rack_id
  status = 'IN_STORAGE',
  updated_at = NOW()
WHERE trucking_load_id = $1
  AND id = ANY($3); -- array of selected inventory IDs
```

3. **Decrement Rack Capacity**:
```sql
-- This would typically happen via approval workflow
-- But if reassigning inventory post-arrival:
UPDATE racks
SET
  occupied = occupied + $2, -- joint_count
  updated_at = NOW()
WHERE id = $1; -- rack_id
```

4. **Verify Capacity Constraint**:
```sql
-- Check constraint ensures: occupied <= capacity
-- If violated, transaction rolls back
```

---

## Visual Cues & User Feedback

### Status Badges

**Color Coding:**
- 🟡 **Yellow** (Pending): PENDING, SCHEDULED states
- 🔵 **Blue** (Info): IN PROGRESS, WAITING states
- 🟢 **Green** (Success): APPROVED, IN STORAGE, COMPLETED states
- 🔴 **Red** (Danger): REJECTED, FAILED states
- ⚪ **Gray** (Neutral): ARCHIVED, COMPLETED (terminal)

**Badge Implementation:**
```typescript
// utils/workflowStates.ts
export function getWorkflowBadgeClass(state: WorkflowState): string {
  const badgeMap: Record<WorkflowBadgeTone, string> = {
    pending: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    info: 'bg-blue-100 text-blue-800 border-blue-300',
    success: 'bg-green-100 text-green-800 border-green-300',
    danger: 'bg-red-100 text-red-800 border-red-300',
    neutral: 'bg-gray-100 text-gray-800 border-gray-300'
  };

  return badgeMap[state.badgeTone];
}
```

### Progress Indicators

**Customer Dashboard Tiles:**
```
┌─────────────────────────────────────┐
│ REF-20251110-001                    │
│ [IN STORAGE] 🟢                     │
│                                     │
│ Progress: ████████████░░░░░ 70%     │
│                                     │
│ ⏱️ 5 days in storage (85 remaining) │
└─────────────────────────────────────┘
```

**Progress Calculation:**
```typescript
export function calculateProjectProgress(project: ProjectSummary): number {
  const { status, inboundLoads, outboundLoads, inventorySummary } = project;

  if (status === 'PENDING') return 10;
  if (status === 'REJECTED') return 0;

  // Inbound loads contribute 20-60%
  const inboundProgress = (inboundLoads.filter(l => l.status === 'COMPLETED').length / inboundLoads.length) * 40;

  // In storage = 70%
  if (inventorySummary.inStorage > 0 && outboundLoads.length === 0) {
    return 70;
  }

  // Outbound loads contribute 70-100%
  const outboundProgress = (outboundLoads.filter(l => l.status === 'COMPLETED').length / outboundLoads.length) * 30;

  return Math.min(100, 20 + inboundProgress + outboundProgress);
}
```

### Action Buttons

**State-Based Button Visibility:**
```typescript
// Customer Dashboard
{status === 'APPROVED' && inboundLoads.length === 0 && (
  <button
    onClick={() => navigate(`/book-inbound/${request.id}`)}
    className="btn-primary"
  >
    📦 Book First Inbound Load
  </button>
)}

{status === 'APPROVED' && inboundLoads.length > 0 && (
  <button
    onClick={() => navigate(`/book-inbound/${request.id}?sequence=${nextSequence}`)}
    className="btn-secondary"
  >
    📦 Book Load #{nextSequence}
  </button>
)}

{inventorySummary.inStorage > 0 && !hasOutboundLoads && (
  <button
    onClick={() => navigate(`/request-pickup/${request.id}`)}
    className="btn-primary"
    disabled // Future feature
  >
    🚚 Request Pickup
  </button>
)}
```

### Loading States

**During Data Fetching:**
```typescript
const { data, isLoading, error } = useProjectSummaries();

if (isLoading) {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
      <span className="ml-4">Loading projects...</span>
    </div>
  );
}
```

**During Mutations:**
```typescript
const approveRequest = useApproveRequest();

<button
  onClick={handleApprove}
  disabled={approveRequest.isPending}
  className="btn-primary"
>
  {approveRequest.isPending ? (
    <>
      <Spinner className="mr-2" />
      Approving...
    </>
  ) : (
    'Approve Request'
  )}
</button>
```

### Toast Notifications

**Success:**
```typescript
// hooks/useApprovalWorkflow.ts - onSuccess callback
toast.success(`Request ${result.referenceId} approved successfully!`, {
  duration: 5000,
  icon: '✅'
});
```

**Error:**
```typescript
// hooks/useApprovalWorkflow.ts - onError callback
toast.error(error.message, {
  duration: 7000,
  icon: '❌'
});
```

**Info:**
```typescript
toast.info('Manifest processing started. This may take 5-10 seconds.', {
  duration: 10000,
  icon: '🔄'
});
```

### Empty States

**No Requests Yet:**
```
┌─────────────────────────────────────┐
│                                     │
│     📦                               │
│     No Active Projects              │
│                                     │
│     Click "Request Storage" above   │
│     to submit your first request    │
│                                     │
│     [Request Storage] button        │
│                                     │
└─────────────────────────────────────┘
```

**No Pending Approvals:**
```
┌─────────────────────────────────────┐
│                                     │
│     ✅                               │
│     All Caught Up!                  │
│                                     │
│     No pending approvals at this    │
│     time. New requests will appear  │
│     here automatically.             │
│                                     │
└─────────────────────────────────────┘
```

---

## Backend Communication

### React Query Configuration

**Global Setup:**
```typescript
// App.tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000, // 30 seconds
      refetchOnWindowFocus: true,
      refetchOnMount: 'always',
      retry: 3,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000)
    },
    mutations: {
      retry: 1
    }
  }
});
```

### Data Fetching Pattern

**Query Hook:**
```typescript
// hooks/useProjectSummaries.ts
export function useProjectSummaries() {
  return useQuery({
    queryKey: ['projectSummaries'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_project_summaries_by_company');

      if (error) {
        if (error.message?.includes('Access denied')) {
          throw new Error('Admin privileges required.');
        }
        throw new Error(`Failed to fetch project summaries: ${error.message}`);
      }

      // Parse if string response
      return typeof data === 'string' ? JSON.parse(data) : data;
    },

    // Data freshness settings
    staleTime: 30 * 1000, // Consider data fresh for 30 seconds
    refetchOnMount: 'always', // Always fetch latest on component mount
    refetchOnWindowFocus: true, // Refetch when user returns to tab
    refetchInterval: 60 * 1000 // Poll every 60 seconds for updates
  });
}
```

### Realtime Subscriptions

**Setup:**
```typescript
// hooks/useProjectSummariesRealtime.ts
export function useProjectSummariesRealtime() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const subscription = supabase
      .channel('admin-project-updates')
      .on('postgres_changes', {
        event: '*', // INSERT, UPDATE, DELETE
        schema: 'public',
        table: 'storage_requests'
      }, () => {
        // Invalidate cache when any storage request changes
        queryClient.invalidateQueries({ queryKey: ['projectSummaries'] });
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'trucking_loads'
      }, () => {
        // Invalidate cache when any load changes
        queryClient.invalidateQueries({ queryKey: ['projectSummaries'] });
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [queryClient]);
}
```

**Usage in Component:**
```typescript
function AdminDashboard() {
  const { data, isLoading } = useProjectSummaries();
  useProjectSummariesRealtime(); // Sets up subscriptions

  // Component automatically re-renders when data changes
}
```

### Mutation Pattern

**Approval Mutation:**
```typescript
// hooks/useApprovalWorkflow.ts
export function useApproveRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request: ApprovalRequest) => {
      const { data, error } = await supabase.rpc('approve_storage_request_atomic', {
        p_request_id: request.requestId,
        p_assigned_rack_ids: request.assignedRackIds,
        p_required_joints: request.requiredJoints,
        p_notes: request.notes || null
      });

      if (error) throw new Error(error.message);
      return data as ApprovalResult;
    },

    onSuccess: (result, request) => {
      // Invalidate queries to trigger refetch
      queryClient.invalidateQueries({ queryKey: ['projectSummaries'] });

      // Optionally update cache optimistically
      queryClient.setQueryData(['projectSummaries'], (old: any) => {
        // Update the specific request in cached data
        return updateRequestInCache(old, result.requestId, { status: 'APPROVED' });
      });

      toast.success(`Request ${result.referenceId} approved!`);
    },

    onError: (error) => {
      toast.error(error.message);
    }
  });
}
```

### Cache Invalidation Strategy

**When to Invalidate:**
1. **After Mutations**: Approve, reject, create, update, delete
2. **On Realtime Events**: Supabase subscriptions fire
3. **On Tab Focus**: User returns to application
4. **Manual Refresh**: User clicks refresh button

**Granular vs Broad:**
```typescript
// Broad: Invalidate all project summaries
queryClient.invalidateQueries({ queryKey: ['projectSummaries'] });

// Granular: Invalidate specific company
queryClient.invalidateQueries({
  queryKey: ['projectSummaries', 'company', companyId]
});

// Specific: Invalidate single project
queryClient.invalidateQueries({
  queryKey: ['projectSummaries', 'project', projectId]
});
```

### Error Handling

**Network Errors:**
```typescript
if (error?.message.includes('Failed to fetch')) {
  toast.error('Network error. Please check your connection.');
}
```

**Auth Errors:**
```typescript
if (error?.message.includes('JWT')) {
  toast.error('Session expired. Please log in again.');
  navigate('/login');
}
```

**Permission Errors:**
```typescript
if (error?.message.includes('Access denied')) {
  toast.error('You do not have permission to perform this action.');
}
```

**Validation Errors:**
```typescript
if (error?.message.includes('Insufficient capacity')) {
  toast.error(error.message); // Show detailed capacity error
}
```

### Retry Logic

**Automatic Retries:**
```typescript
// React Query configuration
retry: 3, // Retry failed queries 3 times
retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
// Exponential backoff: 1s, 2s, 4s, capped at 30s
```

**Conditional Retry:**
```typescript
retry: (failureCount, error) => {
  // Don't retry auth errors
  if (error.message?.includes('Access denied')) return false;

  // Don't retry client errors (4xx)
  if (error.statusCode >= 400 && error.statusCode < 500) return false;

  // Retry server errors (5xx) up to 3 times
  return failureCount < 3;
}
```

---

## Summary

This document provides a complete walkthrough of PipeVault's user workflows from both customer and admin perspectives. Key takeaways:

1. **Customer Journey**: Signup → Request → Approval → Book Load → Storage → Pickup → Complete
2. **Admin Journey**: Login → Approve Requests → Manage Loads → Monitor Capacity → AI Assistance
3. **8-State Workflow**: Clear progression from Pending Approval to Complete
4. **Atomic Transactions**: Approval workflow uses ACID guarantees (all-or-nothing)
5. **AI Integration**: Manifest extraction, chatbot assistance, admin analytics
6. **Real-time Updates**: Supabase subscriptions + React Query for instant UI updates
7. **Security**: RLS policies, SECURITY DEFINER functions, admin authorization

Every user action triggers specific database operations, state transitions, and UI updates, creating a seamless experience while maintaining data integrity and security.
