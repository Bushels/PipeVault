# PipeVault - Changelog

All notable changes to the PipeVault project are documented in this file.

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
