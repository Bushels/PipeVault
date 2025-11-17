# PipeVault Testing Guide

**Quick Overview**: PipeVault manages pipe storage at MPS facilities. Customers request storage, book truck deliveries, and upload manifests. AI extracts pipe data automatically. Admins approve requests, track loads, and manage inventory.

---

## 🔑 Admin Accounts

**Nathan Turchyn**: nathan@mpsgroup.ca
**Tyrel Turchyn**: tyrel@mpsgroup.ca

**Note**: After signing up, Kyle will grant you admin access in the database.

---

## 👤 CUSTOMER WORKFLOW (5 Steps)

### Step 1: Sign Up & Request Storage
1. Go to app → Click **Sign Up**
2. Use a **real email** (you'll get a verification link)
3. Fill in company details (name, domain)
4. Create your first **Storage Request**:
   - Pipe type, grade, diameter, weight
   - Estimated quantity (joints)
   - Expected delivery date

**🚨 STUCK?** Mark which field confused you or what error you got.

---

### Step 2: Book Load #1
1. After creating request, click **"Request a Load"**
2. Pick delivery time slot
3. Enter driver/trucking company info
4. Click **Submit**

**Expected**: Load shows as "Pending Admin Approval"

**🚨 STUCK?** Note if time slots don't load, form errors, or submission fails.

---

### Step 3: Upload Manifest
1. Go to **Documents** tab in your request
2. Select the load you just created
3. Upload a **PDF manifest** (shipping document with pipe list)
4. Wait 10-15 seconds for AI extraction

**Expected**:
- Loading spinner appears
- Success message: "Document uploaded and manifest data extracted successfully!"
- Load totals update automatically (joints, length, weight)

**🚨 STUCK?** Mark if:
- AI extraction fails
- Document won't upload
- Totals don't update

---

### Step 4: Wait for Admin Approval
1. Admin reviews your load (you'll see status change to "Approved")
2. Admin marks it "In Transit" when truck departs
3. You can track status in your dashboard

**Expected**: Loads show in your dashboard with current status

**🚨 STUCK?** Can't see your load? Status stuck?

---

### Step 5: View Inventory
1. After admin marks load "Completed", go to **Inventory** tab
2. See your pipe listed with:
   - Rack location (e.g., "A-A1-5")
   - Quantity stored
   - Pipe specs

**Expected**: All joints from manifest appear as individual inventory items

**🚨 STUCK?** Inventory missing? Wrong quantity? Can't find rack location?

---

## 👔 ADMIN WORKFLOW (4 Steps)

### Step 1: Approve Pending Load
1. Sign in as admin → Go to **Admin Dashboard**
2. Click on company tile showing **"1 new"** badge (orange)
3. Click on the pending load
4. Review:
   - Delivery time
   - Manifest data (if uploaded)
   - Pipe specs
5. Click **Approve Load**

**Expected**: Load disappears from "Pending Loads", appears in "Approved Loads"

**🚨 STUCK?** Mark if:
- Can't see company tile
- Badge count wrong
- Manifest data doesn't show
- Approval fails

---

### Step 2: Mark Load In Transit
1. Go to **Approved Loads** tab
2. Click on the approved load
3. Click **Mark In Transit**

**Expected**: Load moves to "In Transit" tab

**🚨 STUCK?** Button doesn't work? Load stuck in Approved?

---

### Step 3: Mark Load Completed
1. Go to **In Transit** tab
2. Click on the load
3. Review manifest data (should show pipe list)
4. Select rack (e.g., "A-A1-5")
5. Enter actual joints received (must match manifest)
6. Add notes (optional)
7. Click **Mark Completed**

**Expected**:
- Success message
- Load status changes to COMPLETED
- Inventory created automatically (87 records if manifest had 87 joints)
- Rack occupancy updates

**🚨 STUCK?** Mark if:
- "No manifest data found" error
- Rack capacity error
- Quantity mismatch error
- Inventory not created

---

### Step 4: View Company Inventory
1. Click on company tile
2. Go to **Inventory** tab
3. See all pipe in storage with rack locations

**Expected**:
- Inventory count matches completed loads
- Each joint has rack location
- Totals are accurate

**🚨 STUCK?** Wrong totals? Missing inventory? Can't filter by company?

---

## 🐛 REPORTING ISSUES

**When you get stuck**, note:

1. **Which step?** (e.g., "Customer Step 3: Upload Manifest")
2. **What happened?** (error message, wrong behavior, stuck loading)
3. **What you expected?** (what should have happened)
4. **Screenshot?** (if possible)

**Send to Kyle with**:
- Your email address
- Browser (Chrome, Firefox, etc.)
- Device (laptop, phone)

---

## ✅ SUCCESS CRITERIA

**Customer Test Complete When**:
- ✅ Signed up & verified email
- ✅ Created storage request
- ✅ Booked load with time slot
- ✅ Uploaded manifest (AI extracted data)
- ✅ Saw inventory after admin completed load

**Admin Test Complete When**:
- ✅ Approved a pending load
- ✅ Marked load in transit
- ✅ Marked load completed with manifest data
- ✅ Verified inventory was created correctly
- ✅ Saw company tile update in real-time

---

## 💡 TIPS

- **Use real data**: Actual company names, realistic pipe specs
- **Test edge cases**:
  - Upload manifest with 1 joint (minimum)
  - Upload manifest with 100 joints (large load)
  - Try uploading a non-PDF (should reject)
  - Try booking same time slot twice (should conflict)
- **Test on mobile**: Does it work on your phone?
- **Refresh the page**: Do changes persist?
- **Open two browsers**: Customer view + Admin view side-by-side

---

## 🎯 WHAT WE'RE TESTING

1. **AI Manifest Extraction**: Does Gemini accurately extract pipe data from PDFs?
2. **Workflow States**: Do loads transition correctly (NEW → APPROVED → IN_TRANSIT → COMPLETED)?
3. **Real-time Updates**: Do company tiles update when you approve loads?
4. **Inventory Creation**: Do all 87 joints appear after marking completed?
5. **Rack Capacity**: Does it prevent over-capacity assignments?
6. **User Experience**: Is anything confusing, broken, or slow?

---

**Questions?** Ask Kyle.

**Good luck! 🚀**
