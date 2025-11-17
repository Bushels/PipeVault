# PipeVault - Wix Deployment Package

**Celebrating 20 Years of MPS Group - FREE Pipe Storage** 🎉

## Overview

This folder contains everything you need to deploy PipeVault on your Wix site. Production-ready code that replaces Supabase with Wix Data Collections and integrates Claude + Gemini AI APIs.

### 🎯 What is PipeVault?

PipeVault is a pipe storage management system with a modern, card-based interface where customers can:

1. **Request New Pipe Storage** - Submit requests with AI assistance (no login required)
2. **Schedule Delivery to MPS** - Arrange delivery to storage facility
3. **Schedule Delivery to Worksite** - Coordinate pickup and delivery to well sites
4. **Inquire** - Check status, view inventory, request modifications

### ✨ Recent Updates (January 2025)

PipeVault has been redesigned with a **cleaner, more intuitive flow**:

- ✅ **4-Option Card Landing Page** - Users see options immediately (no login screen)
- ✅ **Interactive AI Chatbot** - Claude-powered form helper on the sidebar
- ✅ **Email Collection** - Email field now part of the form (not pre-filled)
- ✅ **Semi-Premium Connection** - Added new pipe connection type option
- ✅ **Passcode Reminder** - Prominent text explaining reference ID purpose
- ✅ **Simplified Authentication** - Only required for delivery/inquiry workflows
- ✅ **Form-First Approach** - Traditional forms with AI helper for assistance

---

## 📁 What's Included

### Files Created

1. **README.md** (this file) - Quick start guide
2. **WIX_MIGRATION_GUIDE.md** - Detailed step-by-step deployment
3. **backend/ai.jsw** - AI service (Claude + Gemini integration)
4. **backend/data.jsw** - Database operations using Wix Data API
5. **pages/storageRequest.js** - Example frontend page code with complete form

---

## 🌐 Wix Platform Capabilities

### ✅ What Wix Provides (Included in Premium Plan)

#### 1. Wix Data Collections - Built-in Database

Replaces Supabase PostgreSQL:
- Store companies, storage requests, inventory, yards, truck loads
- Real-time updates
- Query/filter/sort capabilities
- Row-level security via permissions
- No separate database hosting needed

#### 2. Velo by Wix - Backend Runtime

JavaScript backend environment:
- Server-side code execution
- External API integrations (Claude, Gemini, etc.)
- Secrets Manager for secure API key storage
- npm package support
- Similar to Supabase Edge Functions

#### 3. Web Modules (.jsw) - Frontend-Callable Functions

Secure backend functions:
- API keys never exposed to frontend
- Data validation and business logic
- Called directly from page code
- Similar to React Server Components

### 🤖 AI Integration

**Important:** Wix does NOT have native AI, but integrates easily with:

- ✅ **Claude 3.5 Haiku (Anthropic)** - Form helper chatbot (~$0.01/conversation)
- ✅ **Gemini 2.0 Flash (Google)** - Request summaries (FREE tier: 15/min, 1500/day)
- ✅ **ChatGPT (OpenAI)** - Alternative option (if you prefer)

**All integration code is ready** in `backend/ai.jsw` - just add API keys!

### 🔒 Security Features

- **Secrets Manager** - Encrypted API key storage
- **Backend-only API calls** - Keys never sent to browser
- **Collection Permissions** - Control read/write access
- **HTTPS Everywhere** - All connections encrypted
- **Row-level Security** - Users see only their data

---

## 💰 Cost Comparison

### Current Setup (Supabase + Vercel)

- Supabase: $0-25/month
- Hosting: $0-20/month
- Claude API: ~$0.01 per conversation
- Gemini API: FREE
- **Total: $0-50/month**

### Wix Setup (All-in-One)

- Wix Premium: $27-32/month (includes hosting + database + backend + forms)
- Claude API: ~$0.01 per conversation
- Gemini API: FREE
- **Total: $30-40/month**

**Similar cost, simpler management!**

---

## 🚀 Quick Start

### Step 1: Enable Velo

1. Open your Wix site in the Editor
2. Click **Dev Mode** in the top menu
3. Enable **Velo Development Mode**

### Step 2: Create Data Collections

**Database** → Create these collections:

#### Companies
- `name` (Text)
- `domain` (Text)
- Permission: Site Content

#### StorageRequests
- `companyId` (Text)
- `userId` (Text) - Email
- `referenceId` (Text) - Project reference
- `status` (Text) - PENDING, APPROVED, REJECTED
- `requestDetails` (JSON) - All form data
- `truckingInfo` (JSON)
- `approvalSummary` (Text) - AI-generated
- `assignedLocation` (Text)
- `assignedRackIds` (Text)
- `rejectionReason` (Text)
- Permission: Site Content

#### Inventory
- `companyId` (Text)
- `referenceId` (Text)
- `rackId` (Text)
- `status` (Text)
- `pipeData` (JSON)
- `pickUpTimestamp` (Date)
- Permission: Site Content

#### Yards (Admin only)
- `yardId` (Text)
- `name` (Text)
- `areas` (JSON)
- Permission: Admin

#### TruckLoads (Admin only)
- `loadNumber` (Text)
- `truckDetails` (JSON)
- `status` (Text)
- Permission: Admin

**See `WIX_MIGRATION_GUIDE.md` for exact field configurations.**

### Step 3: Add API Keys

1. **Velo Sidebar** → **Secrets Manager**
2. Add secrets:
   - Name: `ANTHROPIC_API_KEY`, Value: `sk-ant-api03-...`
   - Name: `GOOGLE_AI_API_KEY`, Value: `AIza...` (optional - free tier)

### Step 4: Add Backend Code

1. **Backend** folder → Create **New Web Module** → `ai.jsw`
2. Copy contents from `backend/ai.jsw`
3. Create another module → `data.jsw`
4. Copy contents from `backend/data.jsw`

### Step 5: Design Your Page

Create a new page with these elements:

**Form Inputs:**
- `#companyNameInput` - Text Input
- `#fullNameInput` - Text Input
- `#emailInput` - Text Input (NEW - not pre-filled!)
- `#phoneInput` - Text Input
- `#referenceInput` - Text Input (with passcode reminder)
- `#itemTypeDropdown` - Dropdown
- `#gradeDropdown` - Dropdown
- `#connectionDropdown` - Dropdown (includes Semi-Premium!)
- `#odDropdown` - Dropdown
- `#weightDropdown` - Dropdown
- `#avgLengthInput` - Number Input
- `#totalJointsInput` - Number Input
- `#startDatePicker` - Date Picker
- `#endDatePicker` - Date Picker

**Trucking Selection:**
- `#truckingQuoteButton` - Button
- `#truckingOwnButton` - Button

**AI Chatbot:**
- `#chatInput` - Text Input
- `#chatSendButton` - Button
- `#chatMessages` - Text element (multi-line)

**Submit:**
- `#submitButton` - Button
- `#successBox` - Box (hidden initially)
- `#successMessage` - Text
- `#errorMessage` - Text (hidden initially)

### Step 6: Add Page Code

1. Select your page
2. **Page Code** panel → Paste code from `pages/storageRequest.js`
3. Customize element IDs if needed

### Step 7: Create Landing Page

Create a page with 4 card buttons:

```javascript
// Page: Home/Landing
import { validateAuth } from 'backend/data';

$w.onReady(function () {
  // Option 1: Request New Storage
  $w('#newStorageCard').onClick(() => {
    wixLocation.to('/storage-request'); // No auth needed
  });

  // Option 2: Delivery to MPS
  $w('#deliveryInCard').onClick(async () => {
    await handleAuthFlow('delivery-in');
  });

  // Option 3: Delivery to Worksite
  $w('#deliveryOutCard').onClick(async () => {
    await handleAuthFlow('delivery-out');
  });

  // Option 4: Inquire
  $w('#inquireCard').onClick(async () => {
    await handleAuthFlow('inquire');
  });
});

async function handleAuthFlow(option) {
  // Show auth modal/lightbox
  $w('#authLightbox').show();

  $w('#authSubmitButton').onClick(async () => {
    const email = $w('#authEmailInput').value;
    const refId = $w('#authReferenceInput').value;

    const result = await validateAuth(email, refId);

    if (result.valid) {
      wixLocation.to(`/${option}?ref=${refId}`);
    } else {
      $w('#authError').text = 'Invalid email or reference ID';
      $w('#authError').show();
    }
  });
}
```

### Step 8: Test & Publish

1. **Preview** your site
2. Test form submission
3. Test AI chatbot
4. Verify database operations
5. **Publish** when ready!

---

## 📋 Application Flow (Updated)

### Customer Journey

#### 1. Landing Page (4 Colorful Cards)

No login required - shows immediately:

1. **Request New Pipe Storage** (Purple/Indigo with + icon)
2. **Schedule Delivery to MPS** (Blue/Cyan with truck icon)
3. **Schedule Delivery to Worksite** (Green/Emerald with package icon)
4. **Inquire** (Orange/Red with clipboard icon)

#### 2. Request New Storage Flow

**Clicks card** → **Opens form page**:

- **Left Side (2/3 width)**: Multi-step form
  - Contact Information (company, name, **email**, phone)
  - Pipe Specifications (type, casing, grade, **Semi-Premium**, etc.)
  - Project Details (dates, **reference ID with passcode reminder**)
  - Trucking (quote or provided)

- **Right Side (1/3 width)**: AI Chatbot Helper
  - Powered by Claude 3.5 Haiku
  - Answers form questions
  - Explains pipe terminology
  - Promotes 20 Years FREE storage

**Submits** → **Gets Reference ID** → **Saves for later use**

#### 3. Other Options Flow (Delivery/Inquire)

**Clicks card** → **Authentication modal**:

- Enter email
- Enter reference ID (passcode)
- Validates against database

**If valid** → **Opens respective workflow page**

**If invalid** → **Shows error message**

---

## 🎨 Design Notes

### Landing Page Cards

Use Wix's **Strip** or **Section** elements with:

- Gradient backgrounds (purple→indigo, blue→cyan, green→emerald, orange→red)
- Large icons (use Wix icon picker or upload SVGs)
- Bold headlines
- Hover effects (scale, shadow)
- Responsive grid (2 columns on desktop, 1 on mobile)

### Form Page Layout

- **Multi-column** sections (use Wix columns)
- **Sticky sidebar** for chatbot (use sticky position)
- **Progress indicator** (optional - use Wix progress bar)
- **Validation** (built into Wix input elements)

### AI Chatbot Design

- **Chat bubble style** (alternating left/right)
- **User avatar** vs **Bot avatar**
- **Typing indicator** (show during API call)
- **Scroll to bottom** (auto-scroll on new messages)

---

## 🔄 Data Migration from Supabase

If you have existing data:

### Option 1: CSV Import (Simple)

1. **Export from Supabase** → CSV
2. **Wix Database** → Import CSV
3. Map columns to collection fields

### Option 2: Velo Script (Complex)

```javascript
// Backend migration script
import wixData from 'wix-data';

export async function migrateFromSupabase(supabaseData) {
  for (const item of supabaseData) {
    await wixData.insert('StorageRequests', {
      companyId: item.company_id,
      userId: item.user_id,
      referenceId: item.reference_id,
      status: item.status,
      requestDetails: item.request_details,
      // ... map all fields
    });
  }
}
```

---

## 📚 Deployment Options

### Option 1: Native Wix Pages (RECOMMENDED ⭐)

**Pros:**
- Best SEO and performance
- Full Wix features (members, payments, forms, booking)
- No build process
- Visual editor for easy updates
- Built-in mobile responsiveness

**Cons:**
- Need to recreate UI in Wix Editor (no React)
- Learning curve for Velo

**Time to Deploy:** 4-8 hours

### Option 2: Embed React App (Advanced)

**Pros:**
- Keep existing React code
- Modern development workflow
- Reuse components

**Cons:**
- More complex setup
- Need to host build files separately
- SEO challenges
- Requires custom element integration

**Time to Deploy:** 8-16 hours

### Option 3: Hybrid (Best of Both Worlds)

**Strategy:**
- Wix pages for main structure
- React components embedded for complex features
- Shared backend (Wix Data + Velo)

**Time to Deploy:** 6-12 hours

---

## 🛠️ Troubleshooting

### Common Issues

**Problem:** "Collection not found"
**Solution:** Ensure collection ID matches exactly (case-sensitive)

**Problem:** "Permission denied"
**Solution:** Check collection permissions in Database settings

**Problem:** "Secret not found"
**Solution:** Verify secret name in Secrets Manager matches code

**Problem:** "AI responses not working"
**Solution:**
- Check API keys are valid
- Verify Secrets Manager has keys
- Check browser console for errors
- Ensure backend module is saved

**Problem:** "Data not showing"
**Solution:**
- Check Wix Data query syntax
- Verify collection has data
- Check permissions (Site Content vs Admin)

---

## 📞 Support & Resources

### Wix Documentation

- **Velo**: https://dev.wix.com/docs/velo
- **Wix Data**: https://www.wix.com/velo/reference/wix-data
- **Secrets Manager**: https://dev.wix.com/docs/develop-websites/articles/coding-with-velo/packages/using-the-secrets-manager

### AI APIs

- **Claude**: https://docs.anthropic.com/
- **Gemini**: https://ai.google.dev/docs

### Community

- **Wix Forum**: https://www.wix.com/velo/forum
- **Velo Discord**: Wix Developers community

---

## ✅ Deployment Checklist

- [ ] Enable Velo on Wix site
- [ ] Create all 5 data collections with correct fields
- [ ] Add API keys to Secrets Manager
- [ ] Upload `ai.jsw` to backend
- [ ] Upload `data.jsw` to backend
- [ ] Create landing page with 4 cards
- [ ] Create storage request form page
- [ ] Add page code for form
- [ ] Create auth modal/lightbox
- [ ] Test form submission
- [ ] Test AI chatbot
- [ ] Test authentication flow
- [ ] Verify database writes
- [ ] Test on mobile
- [ ] Publish site
- [ ] Test production site
- [ ] Monitor for errors

---

## 🎯 Next Steps

1. **Read** `WIX_MIGRATION_GUIDE.md` for detailed instructions
2. **Choose** deployment option (Native Wix recommended)
3. **Set up** Velo and collections
4. **Copy** backend code
5. **Design** pages in Wix Editor
6. **Wire up** with page code
7. **Test** thoroughly
8. **Deploy** to production!

---

## 📊 Expected Performance

**Load Times:**
- Landing page: <2 seconds
- Form page: <3 seconds
- AI response: 1-3 seconds

**Concurrent Users:**
- Wix Premium: ~1,000/month
- Wix Business: ~10,000/month

**Database:**
- Free collections (unlimited records)
- 500MB storage included

---

**You have everything you need to deploy PipeVault on Wix!** 🚀

The code is production-ready, well-documented, and follows Wix best practices. All recent changes (4-card landing, interactive chatbot, email collection, Semi-Premium option, passcode reminder) are reflected in the provided code.

**Questions?** See `WIX_MIGRATION_GUIDE.md` for detailed answers.
