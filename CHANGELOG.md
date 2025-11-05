# PipeVault - Changelog

All notable changes to the PipeVault project are documented in this file.

---

## [2.0.1] - 2025-11-05

### 🐛 Critical Bug Fixes

#### Slack Notification System Restored
- **Issue**: New storage requests not triggering Slack notifications to MPS team
- **Root Cause**: Missing trigger and incomplete function (lost during search_path migration)
- **Solution**: Created `RESTORE_SLACK_NOTIFICATIONS.sql` migration
  - Restores full `notify_slack_storage_request` function with Block Kit formatting
  - Retrieves webhook URL securely from Supabase Vault (`vault.decrypted_secrets`)
  - Creates AFTER INSERT OR UPDATE trigger on `storage_requests` table
  - Fires only for PENDING status requests (not drafts)
- **Files**: `supabase/RESTORE_SLACK_NOTIFICATIONS.sql`

#### Gemini API Model Updated for Document Processing
- **Issue**: Document upload failing with 404 error: "models/gemini-1.5-flash is not found"
- **Root Cause**: Using deprecated model name in `manifestProcessingService.ts`
- **Solution**: Updated to current model `gemini-2.0-flash-exp`
  - Line 190: `extractManifestData()` function
  - Line 265: `validateManifestData()` function
- **Impact**: Document upload/manifest extraction now works correctly
- **Files**: `services/manifestProcessingService.ts`

#### Rack Capacity Correction
- **Issue**: All racks showing capacity of 1 joint instead of 100
- **Impact**: Yard A showed "1 pipe free" instead of proper capacity (2,200 joints)
- **Root Cause**: Initial rack setup used wrong default capacity value
- **Solution**: Created `FIX_ALL_RACK_CAPACITIES.sql` migration
  - Updates all racks with `capacity < 100` to `capacity = 100`
  - Sets `capacity_meters = 1200` (100 joints × 12m average)
  - Preserves existing `occupied` values
- **Result**: Yard A now shows 2,198 joints available (22 racks × 100 capacity - 2 occupied)
- **Files**: `supabase/FIX_ALL_RACK_CAPACITIES.sql`

### ✨ New Features

#### Edit and Delete Trucking Loads
- **Feature**: Admins can now edit or delete trucking loads before/during processing
- **Implementation**: Added comprehensive edit modal and delete confirmation dialog
- **Edit Modal Sections**:
  - Direction (INBOUND/OUTBOUND) and Sequence Number
  - Status (NEW, APPROVED, IN_TRANSIT, COMPLETED, CANCELLED)
  - Scheduled Start/End Times (datetime pickers)
  - Well Information (Asset Name, Wellpad Name, Well Name, UWI)
  - Contact Information (Trucking Company, Contact details, Driver info)
  - Planned Quantities (Total Joints, Length ft, Weight lbs)
  - Notes (free-form text area)
- **Delete Features**:
  - Confirmation dialog with load sequence number
  - Clear warning that action cannot be undone
  - Error handling with user-friendly messages
- **Technical Details**:
  - State management for `editingLoad` and `loadToDelete`
  - Automatic UI refresh after save/delete
  - Scrollable modal with sticky header/footer
- **Files**: `components/admin/AdminDashboard.tsx` (lines 110-111, 174-215, 1985-1998, 2251-2676)

### 📚 Documentation

#### New Documentation Files
- **`AI_TROUBLESHOOTING.md`** - Comprehensive guide for AI service issues
  - Gemini API model updates and version management
  - Rate limiting and quota handling
  - Error debugging checklist
  - Current model configuration reference
  - Best practices for prompt engineering

#### Updated Documentation
- **`ADMIN_TROUBLESHOOTING_GUIDE.md`** - Added three new troubleshooting sections:
  - Slack Notifications Not Working for Storage Requests
  - Rack Capacity Shows Wrong Values (1 joint instead of 100)
  - Cannot Edit or Delete Trucking Loads
- **`CHANGELOG.md`** (this file) - Added version 2.0.1 entry

### 🔧 Technical Improvements

#### Database Migrations Created
1. `RESTORE_SLACK_NOTIFICATIONS.sql` - Fixes notification system
2. `FIX_ALL_RACK_CAPACITIES.sql` - Corrects rack capacity values
3. `FIX_DUPLICATE_ENQUEUE_NOTIFICATION.sql` - Removes duplicate function (referenced in session)

#### Code Quality
- TypeScript type safety maintained throughout changes
- Error handling improved in admin dashboard
- Consistent model naming across AI services
- Build successful with no errors or warnings

### 🎯 Testing & Verification

All changes tested and verified:
- ✅ Slack notifications work for new storage requests
- ✅ Document upload processes manifests correctly
- ✅ Rack capacities display accurate available space
- ✅ Edit load modal saves changes and refreshes UI
- ✅ Delete load confirmation prevents accidental deletion
- ✅ No TypeScript errors or build warnings
- ✅ Production build successful

### 📊 Current AI Model Configuration

| Service | File | Model | Purpose |
|---------|------|-------|---------|
| Request Summaries | `geminiService.ts` | `gemini-2.5-flash` | Generate storage request summaries |
| Customer Chatbot | `geminiService.ts` | `gemini-2.5-flash` | Roughneck AI customer assistant |
| Admin Assistant | `geminiService.ts` | `gemini-2.5-flash` | Admin operations assistant |
| Form Helper | `geminiService.ts` | `gemini-2.5-flash` | Form completion help |
| Manifest Extraction | `manifestProcessingService.ts` | `gemini-2.0-flash-exp` | OCR/Vision for pipe data |
| Manifest Validation | `manifestProcessingService.ts` | `gemini-2.0-flash-exp` | Data quality checks |

---

## [2.0.0] - 2025-01-27

### 🎉 Major Redesign - 4-Option Card Landing Page

Complete overhaul of user flow to start with a clean, card-based interface instead of login screen.

### Added

#### New Components
- **`WelcomeScreen.tsx`** - Landing page with 4 colorful option cards
  - Purple/Indigo: Request New Pipe Storage
  - Blue/Cyan: Schedule Delivery to MPS
  - Green/Emerald: Schedule Delivery to Worksite
  - Orange/Red: Inquire about storage
  - No login required to view options
  - Authentication only for delivery/inquiry workflows

- **`FormHelperChatbot.tsx`** - Interactive AI assistant for form help
  - Powered by Claude 3.5 Haiku (~$0.01/conversation)
  - Sidebar component (1/3 width)
  - Comprehensive knowledge base covering:
    - Project reference explanation (acts as passcode)
    - Pipe types (Blank, Sand Control, Flow Control, Tools)
    - Connection types (NUE, EUE, BTC, Premium, **Semi-Premium**, Other)
    - Grade information (H40, J55, L80, N80, C90, T95, P110)
    - Casing specifications (OD, Weight, ID, Drift)
    - Screen types (DWW, PPS, SL)
    - Trucking options
    - 20 Years FREE Storage promotion
  - Real-time responses during form completion
  - Replaced static helper card

#### New Features
- **Semi-Premium Connection Type** - Added to dropdown and TypeScript interface
- **Contact Email Field** - Now editable input (not pre-filled)
- **Passcode Reminder** - Yellow highlighted text near project reference field
  - "💡 This will act as your unique passcode to check status and make inquiries - make sure it's something you'll remember!"
- **Authentication Modal** - For delivery and inquiry workflows
  - Email + Reference ID validation
  - Checks against database
  - Secure access to existing projects

#### Wix Deployment Package (`/wix` folder)
- **`README.md`** - Comprehensive quick start guide
- **`WIX_MIGRATION_GUIDE.md`** - Detailed step-by-step deployment
- **`backend/ai.jsw`** - Production-ready AI service
  - Claude API integration for chatbot
  - Gemini API integration for summaries
  - Secrets Manager integration
  - Error handling
- **`backend/data.jsw`** - Complete database layer
  - All CRUD operations
  - Company management
  - Request submission
  - Inventory tracking
  - Authentication validation
- **`pages/storageRequest.js`** - Example Wix page code
  - Form handling
  - Chatbot integration
  - Validation
  - Success/error states

### Changed

#### User Flow
- **Landing Page**: Now shows 4 cards immediately (removed "Welcome to PipeVault" screen)
- **No Login Required**: Users can start storage request without authentication
- **Email Collection**: Email is now part of form data (not session-based)
- **Reference ID**: Acts as passcode for future access to delivery/inquiry features

#### Components Updated
- **`App.tsx`**
  - Replaced `LoginScreen` import with `WelcomeScreen`
  - Updated render logic to show WelcomeScreen when no session
  - Removed auto-login logic

- **`StorageRequestWizard.tsx`**
  - Added `contactEmail` to form state
  - Changed email field from disabled to editable
  - Updated to use `formData.contactEmail` instead of `session.userId`
  - Added Semi-Premium to connection dropdown
  - Added passcode reminder text near project reference field

- **`StorageRequestMenu.tsx`**
  - Removed welcome header section
  - Now shows just the 4 option cards
  - Fixed typo: "Welcome to PipeVault, [company]!" → "Welcome to PipeVault [company]!"

- **`Dashboard.tsx`**
  - Replaced static helper card with `FormHelperChatbot`
  - Updated layout to show form (2/3 width) + chatbot (1/3 width)
  - Removed welcome text from 4-option menu display

#### Types Updated
- **`types.ts`**
  - Added `contactEmail: string` to `NewRequestDetails` interface
  - Updated connection type to include `'Semi-Premium'`

### Documentation

#### Main README
- **Complete rewrite** of `README.md`
  - Updated project overview
  - Added detailed user flow documentation
  - Documented all recent changes
  - Added testing checklist
  - Included deployment options
  - Cost breakdown comparison
  - Project structure diagram
  - Security information

#### Wix Deployment
- **`/wix/README.md`** - Comprehensive guide including:
  - What Wix provides (Data Collections, Velo, Web Modules)
  - AI integration details (Claude + Gemini)
  - Cost comparison ($30-40/month all-in-one)
  - Quick start steps
  - Deployment options (Native Wix, React embed, Hybrid)
  - Troubleshooting guide
  - Performance expectations

- **`/wix/WIX_MIGRATION_GUIDE.md`** - Step-by-step instructions:
  - Collection setup with exact schema
  - Backend code implementation
  - Frontend page design
  - Authentication flow
  - Data migration from Supabase

- **`CHANGELOG.md`** (this file) - Comprehensive change tracking

### Fixed
- **Typo in welcome message**: Removed comma before exclamation point
- **Missing connection type**: Added Semi-Premium option
- **Static helper card**: Replaced with interactive AI chatbot
- **Email field**: Now editable instead of disabled
- **Passcode clarity**: Added prominent reminder about reference ID usage

### Technical Improvements
- **Better separation of concerns**: WelcomeScreen handles routing, components handle functionality
- **Improved type safety**: Updated TypeScript interfaces
- **Enhanced UX**: Clear visual hierarchy with colorful cards
- **AI integration**: Production-ready chatbot with comprehensive knowledge base
- **Wix compatibility**: Full deployment package with all necessary code

---

## [1.0.0] - 2025-01-XX (Previous Session)

### Initial Development
- React 19.2 + TypeScript + Vite setup
- Supabase integration (PostgreSQL, RLS policies)
- Claude AI integration (form summaries)
- Gemini AI integration (chatbot responses)
- Admin dashboard with approval workflow
- Inventory management system
- Yard/rack allocation
- Truck load tracking
- Multi-step form wizard
- Mock data with transition to live data

---

## Migration Notes

### Breaking Changes in 2.0.0

1. **LoginScreen removed** - No longer used as entry point
2. **WelcomeScreen required** - New landing page component
3. **Email field behavior changed** - Now editable, collected in form
4. **Session structure changed** - Email collected from form instead of login
5. **Navigation flow changed** - 4 cards first, then auth (if needed)

### Backward Compatibility

- Admin dashboard unchanged
- Database schema unchanged
- API integrations unchanged (Claude, Gemini, Supabase)
- Request approval workflow unchanged
- Inventory system unchanged

### Migration Path

If upgrading from 1.0.0:

1. Update `App.tsx` to use `WelcomeScreen` instead of `LoginScreen`
2. Update `StorageRequestWizard` to include email field
3. Add `FormHelperChatbot` component
4. Update `types.ts` with new fields
5. Test new user flow thoroughly

---

## Deployment Status

### Current (React + Supabase)
- ✅ Development complete
- ✅ All features implemented
- ✅ AI integration working
- ✅ Database connected
- ⏳ Production deployment pending

### Wix Deployment
- ✅ Migration guide complete
- ✅ Backend code ready (`ai.jsw`, `data.jsw`)
- ✅ Example page code ready
- ✅ Documentation complete
- ⏳ Awaiting deployment to Wix site

---

## Future Enhancements

### Planned Features
- [ ] Delivery to MPS workflow (AI-powered)
- [ ] Delivery to Worksite workflow (AI-powered)
- [ ] Enhanced inquiry chatbot with inventory search
- [ ] Email notifications (approval, rejection, updates)
- [ ] PDF document generation for requests
- [ ] Real-time inventory updates
- [ ] Mobile app (React Native)
- [ ] Analytics dashboard for admins
- [ ] Automated trucking quotes
- [ ] Barcode/QR code scanning for pipe tracking

### Potential Improvements
- [ ] Multi-language support (English, Spanish)
- [ ] Dark mode toggle
- [ ] Advanced filtering in admin dashboard
- [ ] Bulk operations for admins
- [ ] Automated testing suite
- [ ] Performance monitoring
- [ ] A/B testing for UI variations
- [ ] Integration with trucking APIs
- [ ] Customer satisfaction surveys

---

## Version History

| Version | Date | Description |
|---------|------|-------------|
| 2.0.0 | 2025-01-27 | Major redesign - 4-card landing, interactive AI chatbot, email collection, Semi-Premium, passcode reminder, Wix deployment package |
| 1.0.0 | 2025-01-XX | Initial release - Core functionality, admin dashboard, Supabase integration, AI integration |

---

**For detailed information about any version, see the respective section above.**
**For deployment instructions, see `/wix/README.md` or `/wix/WIX_MIGRATION_GUIDE.md`.**
