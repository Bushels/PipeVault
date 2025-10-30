# PipeVault - FREE Pipe Storage Management System

**Celebrating 20 Years of MPS Group** 🎉

PipeVault is a comprehensive pipe inventory and storage management platform built for MPS Group's 20th Anniversary FREE storage promotion. The system allows customers to request storage, track inventory, schedule deliveries, and inquire about their pipe storage—all through an intuitive web interface with AI-powered assistance.

---

## 🎯 Project Overview

### What is PipeVault?

PipeVault manages the complete lifecycle of pipe storage for oil & gas customers:

1. **Request New Storage** - Submit approval requests for FREE pipe storage
2. **Schedule Delivery to MPS** - Arrange pipe delivery to storage facility
3. **Schedule Delivery to Worksite** - Coordinate pickup and delivery to well sites
4. **Inquire** - Check status, view inventory, request modifications

### Key Features

**Customer-Facing:**
- ✅ **4-Option Landing Page** - Clean, card-based interface (no login required to start)
- ✅ **AI Form Helper** - Gemini-powered chatbot assists with form completion
- ✅ **Smart Request Summaries** - AI generates professional internal summaries
- ✅ **Project Reference System** - Acts as passcode for future inquiries
- ✅ **Inquiry Status Display** - Shows "Your Pipe Request is Pending Approval" with details
- ✅ **Logout After Submission** - Users can sign out after completing requests
- ✅ **Trucking Coordination** - Quote requests or customer-provided options

**Admin-Facing:**
- ✅ **Comprehensive Admin Dashboard** - 7-tab interface for complete backend management
- ✅ **AI Admin Assistant** - Gemini-powered chatbot answers operational questions
- ✅ **Approval Queue** - Visual rack selection, batch processing, AI-generated summaries
- ✅ **Request Management** - Filterable table with status tracking
- ✅ **Company Dashboard** - View all companies with request/inventory counts
- ✅ **Inventory Panel** - Complete pipe tracking with well assignments
- ✅ **Storage Visualization** - Real-time capacity monitoring across yards
- ✅ **Global Search** - Search across all data (requests, companies, inventory)
- ✅ **Admin Account Creation** - Self-service admin account setup

**Technical:**
- ✅ **Real-time Database** - Supabase with React Query for live updates
- ✅ **Responsive Design** - Works on desktop, tablet, and mobile
- ✅ **GitHub Pages Deployment** - Auto-deploy on git push

---

## 🏗️ Architecture

### Tech Stack

**Frontend:**
- React 19.2 with TypeScript
- Vite for blazing-fast builds
- Tailwind CSS for styling
- React Query (@tanstack/react-query) for server state

**Backend:**
- Supabase (PostgreSQL database, authentication, storage)
- Row-Level Security (RLS) policies for data protection

**AI Integration:**
- **Gemini 2.0 Flash (Google)** - Form helper chatbot, Admin AI assistant, Request summaries (FREE - 1M tokens/day)
- **Claude 3.5 Haiku (Anthropic)** - Available as alternative (~$0.01/conversation)

**Deployment:**
- Supports standard React hosting (Vercel, Netlify, etc.)
- **Wix-ready** - Full migration package included (see `/wix` folder)

### Database Schema

**Collections:**
- `companies` - Customer organizations
- `storage_requests` - Storage approval requests
- `inventory` - Pipe inventory items
- `yards` - Storage facilities with areas and racks
- `truck_loads` - Delivery tracking
- `conversations` - Chat history
- `notifications` - System alerts

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ and npm
- Supabase account (free tier works)
- Claude API key (Anthropic)
- Gemini API key (Google) - optional, has free tier

### Local Development Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-org/pipevault.git
   cd pipevault
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**

   Create a `.env` file in the root directory:
   ```env
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   VITE_ANTHROPIC_API_KEY=sk-ant-api03-...
   VITE_GOOGLE_AI_API_KEY=AIza...
   ```

4. **Set up Supabase database**

   Run the SQL scripts in order:
   ```bash
   # In Supabase SQL Editor
   1. Run supabase/schema.sql
   2. Run supabase/rls-policies-fix.sql
   ```

5. **Start development server**
   ```bash
   npm run dev
   ```

   Open [http://localhost:5173](http://localhost:5173)

---

## 📋 User Flow

### For Customers

#### First Visit (Landing Page)

Users see 4 colorful option cards:

1. **Request New Pipe Storage** (Purple/Indigo)
   - Click to open form
   - Fill out contact info, pipe specs, trucking preferences
   - AI chatbot helps with questions
   - Submit for admin approval
   - Receive Reference ID (acts as passcode)

2. **Schedule Delivery to MPS** (Blue/Cyan)
   - Requires email + reference ID
   - Coordinate delivery to storage facility
   - Upload documents, confirm trucking

3. **Schedule Delivery to Worksite** (Green/Emerald)
   - Requires email + reference ID
   - Arrange pickup from MPS
   - Deliver to well site

4. **Inquire** (Orange/Red)
   - Requires email + reference ID
   - Check request status
   - View inventory
   - Request modifications
   - AI chatbot for questions

#### Form Details (New Storage Request)

**Contact Information:**
- Company Name
- Full Name
- Contact Email (editable)
- Contact Number

**Pipe Specifications:**
- Item Type (Blank Pipe, Sand Control, Flow Control, Tools, Other)
- API Casing Spec (OD, Weight, ID, Drift)
- Grade (H40, J55, L80, N80, C90, T95, P110, Other)
- Connection (NUE, EUE, BTC, Premium, **Semi-Premium**, Other)
- Thread Type
- Average Joint Length (meters)
- Total Joints
- Calculated Total Length

**Project Details:**
- Storage Start Date
- Storage End Date
- **Project Reference** - Acts as passcode for future access
  - Reminder text: "💡 This will act as your unique passcode to check status and make inquiries"

**Trucking:**
- Request Quote from MPS
- Provide Own Trucking

**AI Helper Chatbot:**
- Sidebar chatbot (right side of form)
- Powered by Claude 3.5 Haiku
- Answers questions about form fields
- Explains pipe terminology
- Provides examples
- Promotes 20 Years FREE Storage

### For Admins

#### Admin Access

**How to Access:**
1. Click the **PipeVault shield icon** on the login screen
2. Enter admin email (whitelisted in AuthContext.tsx)
3. Enter password (if account exists) OR click "Create Admin Account"

**Whitelisted Admin Emails:**
- kylegronning@mpsgroup.ca
- admin@mpsgroup.com
- kyle@bushels.com
- admin@bushels.com

**First-Time Setup:**
1. Click shield icon on login screen
2. Enter your whitelisted email
3. Create a password (minimum 6 characters)
4. Click "Create Admin Account"
5. System automatically signs you in

#### Admin Dashboard Overview (7 Tabs)

The admin dashboard provides comprehensive backend management across 7 specialized tabs:

**1. Overview Tab**
- **Analytics Cards**: Total requests, pending approvals, storage utilization, active companies
- **Quick Metrics**: At-a-glance KPIs for operational status
- **Utilization Percentage**: Real-time storage capacity monitoring
- **Recent Activity**: Latest requests and status changes

**2. Approvals Tab**
- **Approval Queue**: Cards showing pending requests needing review
- **AI-Generated Summaries**: Each request includes Gemini-generated internal summary
- **Visual Rack Selection**: Choose yard → area → specific rack for storage assignment
- **Approve/Reject Actions**: One-click approval with location assignment or rejection with reason
- **Request Details**: Full pipe specs, trucking info, contact details
- **Capacity Validation**: Real-time rack capacity checking

**3. Requests Tab**
- **Filterable Table**: All requests with status filter (ALL, PENDING, APPROVED, REJECTED, COMPLETED)
- **Sortable Columns**: Company, Reference ID, Status, Created Date
- **Search Functionality**: Filter by company name or reference ID
- **Status Indicators**: Color-coded badges (yellow=pending, green=approved, red=rejected, blue=completed)
- **Request Count**: Shows total and filtered counts

**4. Companies Tab**
- **Company Cards**: Visual cards for each registered company
- **Request Count**: Number of storage requests per company
- **Inventory Count**: Number of pipe items in storage per company
- **Domain Display**: Email domain for company identification
- **Quick Stats**: At-a-glance company activity metrics

**5. Inventory Tab**
- **Complete Inventory List**: All pipes in system with full details
- **Status Tracking**: IN_STORAGE, PICKED_UP, EN_ROUTE
- **Pipe Specifications**: Type, grade, connection, length, joints
- **Storage Location**: Yard, area, rack assignment
- **Well Assignment**: UWI and well name for picked-up pipes
- **Days in Storage**: Automatic calculation from drop-off to current/pickup date
- **Search & Filter**: Find specific pipes or filter by status

**6. Storage Tab**
- **Yard Overview**: All storage yards with capacity visualization
- **Area Breakdown**: Capacity by area within each yard
- **Rack Details**: Individual rack capacity and occupancy
- **Utilization Metrics**: Occupied vs. available space in meters
- **Visual Indicators**: Progress bars showing fullness
- **Capacity Planning**: Identify available storage locations

**7. AI Assistant Tab**
- **Gemini-Powered Chatbot**: Ask questions about operations
- **Contextual Awareness**: Has access to all current system data
- **Quick Questions**: Pre-populated common queries
  - "What storage areas have space available?"
  - "How many pending requests do we have?"
  - "What is our current storage utilization?"
  - "Which companies have the most inventory?"
- **Data-Driven Responses**: Provides specific numbers and metrics
- **Operational Insights**: Suggests optimal storage allocation
- **Real-Time Context**: System state updated with each query

**Global Features (All Tabs):**
- **Global Search Bar**: Search across requests, companies, and inventory from any tab
- **Tab Navigation**: Quick switching between management areas
- **Responsive Layout**: Works on all screen sizes
- **Real-Time Updates**: React Query keeps data fresh
- **Logout Button**: Secure sign-out functionality

#### Admin Workflows

**Approving a Storage Request:**
1. Navigate to "Approvals" tab
2. Review AI-generated summary
3. Check pipe specifications and trucking details
4. Click "Approve"
5. Select Yard (e.g., "Main Yard")
6. Select Area (e.g., "North Section")
7. Select Rack (shows available capacity)
8. Confirm assignment
9. Request status changes to APPROVED
10. Pipe inventory automatically created

**Rejecting a Request:**
1. Navigate to "Approvals" tab
2. Review request details
3. Click "Reject"
4. Enter reason for rejection
5. Confirm rejection
6. User notified via email (if configured)

**Finding Available Storage:**
1. Navigate to "Storage" tab
2. Review yard utilization percentages
3. Drill into areas to see rack-level capacity
4. OR ask AI Assistant: "What storage areas have space available?"
5. AI provides specific recommendations with capacity numbers

**Searching for Specific Data:**
1. Use Global Search bar (top of dashboard)
2. Enter company name, reference ID, or keyword
3. Results filter across all tabs
4. Click filtered results to view details

**Monitoring Operations:**
1. Navigate to "Overview" tab
2. Check pending approvals count
3. Review storage utilization percentage
4. Monitor active company count
5. Track total requests processed

#### Admin AI Assistant Capabilities

The AI assistant has access to:
- **All Storage Requests**: Total, pending, approved, completed, rejected counts
- **Company Data**: Names, domains, request counts
- **Storage Capacity**: Yards, areas, racks with capacity/occupancy metrics
- **Inventory Stats**: Total pipes, in-storage count, picked-up count
- **Utilization Metrics**: Real-time capacity calculations

Example queries:
- "Which yard has the most capacity?"
- "Show me companies with pending requests"
- "What's our average storage utilization?"
- "How many requests did we approve this month?"
- "Which racks in Main Yard are available?"

**Cost:** FREE (Gemini 2.0 Flash with 1M tokens/day free tier)

---

## 🔧 Recent Changes (January 2025)

### Major Updates - Phase 1 (Early January)

1. **Removed Login Screen** - Now starts with 4 option cards directly
2. **Created WelcomeScreen** - New landing page component
3. **Email Field Made Editable** - Collects email as part of form (not pre-filled)
4. **Added Semi-Premium Connection** - New option in connection type dropdown
5. **Passcode Reminder** - Prominent yellow text near project reference field
6. **Interactive AI Chatbot** - Replaced static helper card with real chatbot
7. **Fixed Typo** - Removed comma in "Welcome to PipeVault [company]!"

### Major Updates - Phase 2 (Late January)

**Admin Dashboard Overhaul:**
8. **Complete Admin Dashboard Rewrite** - Replaced old dashboard with comprehensive 7-tab system
   - Overview tab with analytics cards
   - Approvals tab with visual rack selection
   - Requests tab with filterable table
   - Companies tab with card-based view
   - Inventory tab with complete pipe tracking
   - Storage tab with capacity visualization
   - AI Assistant tab with Gemini chatbot

9. **Admin AI Assistant** - NEW: Gemini-powered operational chatbot
   - Answers questions about storage capacity, requests, companies, inventory
   - Real-time context awareness with system state
   - Quick question buttons for common queries
   - FREE (Gemini 2.0 Flash)

10. **Cost Optimization** - Switched from Claude to Gemini for chatbots
    - **Form Helper Chatbot**: Now uses `callGeminiFormHelper()` (was Claude)
    - **Admin AI Assistant**: Uses `callGeminiAdminAssistant()` (Gemini)
    - **Savings**: ~95% cost reduction (FREE vs $0.80/$4.00 per million tokens)
    - **Impact**: Essentially unlimited conversations on free tier (1M tokens/day)

**Authentication & UX Improvements:**
11. **Admin Account Creation** - Self-service admin setup
    - "Create Admin Account" button on admin login screen
    - Password validation (minimum 6 characters)
    - Auto-sign-in after account creation
    - Helpful error messages for existing accounts

12. **Enhanced Inquiry Status Display** - User-friendly status messages
    - Shows "Your Pipe Request is Pending Approval"
    - Color-coded status indicators
    - Full request details display
    - Conditional content based on status

13. **Logout After Request Submission** - Improved user flow
    - Logout button appears after successful submission
    - Clear indication of signed-in status
    - Refresh to return to login screen

14. **GitHub Pages Deployment** - Auto-deploy on git push
    - Hosted at GitHub Pages URL
    - Automatic deployment via GitHub Actions
    - Production environment with Supabase backend

**Services & Backend:**
15. **geminiService.ts Enhancements** - Added two new AI functions
    - `callGeminiAdminAssistant()` - Operational queries with full context
    - `callGeminiFormHelper()` - Form assistance for users
    - Both use Gemini 2.0 Flash model
    - Comprehensive system instructions for each use case

16. **AuthContext.tsx Updates** - Admin email whitelist
    - Added `kylegronning@mpsgroup.ca`
    - Supports multiple admin methods (hardcoded, metadata, admin_users table)
    - Graceful fallback for admin checking

### Component Structure

**Main Components:**
- `WelcomeScreen.tsx` - Landing page with 4 option cards
- `StorageRequestWizard.tsx` - Multi-step form for storage requests
- `FormHelperChatbot.tsx` - AI assistant for form help (Gemini-powered)
- `Auth.tsx` - Authentication with admin/user login
- `Dashboard.tsx` - Main customer dashboard (deprecated for new flow)
- `Chatbot.tsx` - Inventory inquiry chatbot

**Admin Components:**
- `admin/AdminDashboard.tsx` - Complete rewrite with 7-tab system
- `admin/AdminAIAssistant.tsx` - NEW: Gemini-powered operational chatbot
- `admin/RequestsPanel.tsx` - Approval management (deprecated, now part of AdminDashboard)
- `admin/YardsPanel.tsx` - Storage facility management (deprecated, now part of AdminDashboard)
- `admin/InventoryPanel.tsx` - Inventory tracking (deprecated, now part of AdminDashboard)

**Services:**
- `claudeService.ts` - Claude API integration (available as alternative)
  - `generateRequestSummary()` - Professional request summaries
  - `getClaudeResponse()` - Generic chat responses
  - `callClaudeAdminAssistant()` - Admin operational queries
- `geminiService.ts` - Gemini API integration (PRIMARY AI SERVICE)
  - `generateRequestSummary()` - Request summaries with Gemini
  - `getChatbotResponse()` - Customer inventory chatbot
  - `callGeminiAdminAssistant()` - NEW: Admin AI assistant
  - `callGeminiFormHelper()` - NEW: Form assistance chatbot
- `conversationScripts.ts` - AI conversation templates and prompts
- `supabase.ts` - Database client

**Hooks:**
- `useSupabaseData.ts` - React Query hooks for all CRUD operations

**Context:**
- `lib/AuthContext.tsx` - Authentication state management with admin role checking
- `lib/QueryProvider.tsx` - React Query setup

---

## 🌐 Deployment Options

### Option 1: Deploy to Wix (RECOMMENDED)

**Quick Start - 10 steps, 15 minutes:**

📖 **[QUICK_START_WIX.md](QUICK_START_WIX.md)** - Simple checklist

📘 **[DEPLOY_TO_WIX.md](DEPLOY_TO_WIX.md)** - Detailed guide

This approach:
- Hosts React app on GitHub Pages (free)
- Embeds in Wix using iframe
- Uses Wix Data Collections or Supabase
- Auto-deploys on every git push

**Benefits:**
- Free hosting (GitHub Pages)
- Easy updates (just push to GitHub)
- Keep React code
- All features work

### Option 2: Standard React Deployment

Deploy to Vercel, Netlify, or any static host:

```bash
npm run build
# Upload dist/ folder to your host
```

**Environment Variables:** Set in your hosting platform's settings

### Option 3: Full Wix Native Conversion

**Complete migration package available in `/wix` folder:**

- ✅ Wix Data Collections (replaces Supabase)
- ✅ Velo backend functions (AI + database)
- ✅ Production-ready code
- ✅ Step-by-step guide

**See `/wix/README.md` and `/wix/WIX_MIGRATION_GUIDE.md`**

**Benefits:**
- All-in-one platform (~$30-40/month)
- No separate database hosting
- Built-in forms, members, payments
- Better SEO

---

## 💰 Cost Breakdown

### Current Setup (Supabase + Gemini)

**OPTIMIZED FOR COST SAVINGS:**

- **Supabase Free Tier**: $0/month (500MB database, 50,000 monthly active users)
- **Supabase Pro**: $25/month (8GB database, 100,000 MAU) - only if scaling needed
- **Hosting (GitHub Pages)**: $0/month (FREE static hosting)
- **Gemini 2.0 Flash API**: $0/month (FREE tier: 1M tokens/day = ~1,000+ conversations/day)
  - Form Helper Chatbot: FREE
  - Admin AI Assistant: FREE
  - Request Summaries: FREE
- **Claude API** (optional fallback): ~$0.01 per conversation (not currently used)
- **Total Current Cost**: $0-25/month (FREE on small scale, $25/month if database scaling needed)

**Cost Savings from Gemini Migration:**
- **Before**: Claude Haiku at $0.80 input / $4.00 output per million tokens
- **After**: Gemini 2.0 Flash at $0 for first 1M tokens/day
- **Savings**: ~95% cost reduction on AI operations
- **Impact**: Essentially unlimited conversations for free during growth phase

**Projected Costs at Scale:**
- **100 requests/month**: ~$0/month (all on free tiers)
- **500 requests/month**: ~$25/month (Supabase Pro for data)
- **1000+ requests/month**: ~$25-50/month (may need paid AI tier eventually)

### Wix Setup (Alternative)

- **Wix Premium**: ~$27-32/month (includes hosting + database + backend)
- **Claude API**: ~$0.01 per conversation
- **Gemini API**: FREE
- **Total**: ~$30-40/month

---

## 📁 Project Structure

```
PipeVault/
├── components/
│   ├── Auth.tsx                   # Authentication screen with admin/user login
│   ├── WelcomeScreen.tsx          # Landing page with 4 cards
│   ├── StorageRequestWizard.tsx   # Form-based request flow
│   ├── FormHelperChatbot.tsx      # AI form assistant (Gemini)
│   ├── StorageRequestMenu.tsx     # 4-option menu component
│   ├── StorageRequestChatbot.tsx  # Storage request chatbot
│   ├── Dashboard.tsx              # Customer dashboard (deprecated)
│   ├── Chatbot.tsx                # Inventory chatbot
│   ├── InventoryDisplay.tsx       # Inventory table
│   ├── admin/
│   │   ├── AdminDashboard.tsx     # NEW: Complete rewrite - 7-tab admin system
│   │   ├── AdminAIAssistant.tsx   # NEW: Gemini-powered operational chatbot
│   │   ├── RequestsPanel.tsx      # Approval management (deprecated)
│   │   ├── YardsPanel.tsx         # Storage facility management (deprecated)
│   │   └── InventoryPanel.tsx     # Inventory tracking (deprecated)
│   ├── icons/
│   │   └── Icons.tsx              # Icon components (PipeVaultIcon, etc.)
│   └── ui/                        # Reusable UI components
│       ├── Card.tsx
│       ├── Button.tsx
│       └── Spinner.tsx
├── services/
│   ├── claudeService.ts           # Claude API integration (alternative)
│   ├── geminiService.ts           # NEW: Gemini API integration (PRIMARY)
│   ├── conversationScripts.ts     # AI conversation templates
│   └── emailService.ts            # Email notifications
├── hooks/
│   └── useSupabaseData.ts         # React Query hooks for all CRUD
├── lib/
│   ├── supabase.ts                # Supabase client
│   ├── AuthContext.tsx            # Authentication context with admin checking
│   └── QueryProvider.tsx          # React Query setup
├── supabase/
│   ├── schema.sql                 # Database schema
│   └── rls-policies-fix.sql       # Security policies
├── wix/                           # Wix deployment package
│   ├── README.md                  # Wix quick start
│   ├── WIX_MIGRATION_GUIDE.md     # Step-by-step guide
│   ├── backend/
│   │   ├── ai.jsw                 # AI service for Wix
│   │   └── data.jsw               # Database operations
│   └── pages/
│       └── storageRequest.js      # Example page code
├── .github/                       # GitHub Actions for deployment
│   └── workflows/
│       └── deploy.yml             # Auto-deploy to GitHub Pages
├── types.ts                       # TypeScript interfaces
├── App.tsx                        # Main app component
├── index.tsx                      # Entry point
├── .env.example                   # Environment variable template
├── AUTH_QUICK_START.md            # Authentication setup guide
├── CHANGELOG.md                   # Version history
├── DEPLOY_TO_WIX.md               # Wix deployment detailed guide
├── QUICK_START_WIX.md             # Wix deployment quick start
└── WIX_DEPLOYMENT.md              # Wix deployment overview
```

---

## 🔐 Security

### Supabase Row-Level Security (RLS)

All tables have RLS policies:
- Users can only see their own company's data
- Admins have full access
- Public cannot read sensitive data

### API Keys

- Stored in `.env` (never committed to git)
- `.env` is in `.gitignore`
- Use Wix Secrets Manager for Wix deployment

### Authentication

- Email-based (no passwords stored)
- Reference ID acts as project-specific passcode
- Admin credentials for backend access

---

## 🧪 Testing

### Manual Testing Checklist

**Customer Flow:**
- [ ] Load landing page - see 4 option cards
- [ ] Click "Request New Pipe Storage" - opens form with chatbot
- [ ] Fill out all fields - validation works
- [ ] Ask chatbot questions - gets helpful responses
- [ ] Submit form - receives reference ID
- [ ] Try other 3 options - prompts for email + reference ID

**Admin Flow:**
- [ ] Login as admin (Admin/Admin)
- [ ] View pending requests
- [ ] Approve request - assigns location
- [ ] Check inventory - pipe added
- [ ] Reject request - sends notification

---

## 🤝 Contributing

This is a private project for MPS Group. For internal contributions:

1. Create feature branch
2. Make changes
3. Test thoroughly
4. Submit pull request
5. Get approval from project lead

---

## 📞 Support

For questions or issues:

- **Technical Issues**: Check `/wix/README.md` or `/wix/WIX_MIGRATION_GUIDE.md`
- **AI Integration**: See `services/claudeService.ts` and `services/geminiService.ts`
- **Database**: See `supabase/schema.sql` and `hooks/useSupabaseData.ts`

---

## 🤖 Notes for AI Assistants (Codex, ChatGPT, Claude)

This section provides context for AI coding assistants working on PipeVault.

### Project Context

**Purpose**: Pipe storage management system for MPS Group's 20th Anniversary FREE storage promotion

**Current State**: Production-ready, deployed on GitHub Pages with Supabase backend

**Tech Stack Priorities**:
1. **Gemini 2.0 Flash** - PRIMARY AI service (FREE tier)
2. **Claude 3.5 Haiku** - Available as fallback (paid)
3. **React + TypeScript** - Frontend framework
4. **Supabase** - Database and authentication
5. **React Query** - Server state management

### Key Architecture Decisions

**Why Gemini over Claude for Chatbots?**
- Cost: Gemini is FREE (1M tokens/day) vs Claude at $0.80/$4.00 per million tokens
- Savings: ~95% reduction in AI operation costs
- Current functions using Gemini:
  - `callGeminiAdminAssistant()` - Admin operational queries
  - `callGeminiFormHelper()` - User form assistance
  - `generateRequestSummary()` - Request summaries
- When to use Claude: Complex multi-turn conversations requiring nuanced understanding (not currently needed)

**Authentication Pattern:**
- Users: Email + Reference ID (Reference ID acts as password)
- Admins: Email + password with whitelist checking in AuthContext.tsx
- Admin whitelist: `kylegronning@mpsgroup.ca`, `admin@mpsgroup.com`, `kyle@bushels.com`, `admin@bushels.com`
- Self-service admin account creation via "Create Admin Account" button

**Admin Dashboard Architecture:**
- Single comprehensive component: [admin/AdminDashboard.tsx](components/admin/AdminDashboard.tsx)
- 7 tabs managed via internal state (not separate routes)
- Deprecated components: RequestsPanel, YardsPanel, InventoryPanel (all merged into AdminDashboard)
- AI Assistant in separate component: [admin/AdminAIAssistant.tsx](components/admin/AdminAIAssistant.tsx)

### Common Tasks

**Adding a new AI chatbot:**
1. Add function to [services/geminiService.ts](services/geminiService.ts) using `ai.chats.create()` pattern
2. Define `systemInstruction` with role, capabilities, guidelines
3. Map chat history to Gemini format (role: 'user' | 'model')
4. Use model: 'gemini-2.5-flash'
5. Include contextual data in system instruction (JSON.stringify)

**Adding admin functionality:**
1. Work in [components/admin/AdminDashboard.tsx](components/admin/AdminDashboard.tsx)
2. Add new tab to `TabType` if needed
3. Create render function for tab content
4. Update tab navigation in JSX
5. Use existing React Query hooks from [hooks/useSupabaseData.ts](hooks/useSupabaseData.ts)

**Database operations:**
1. All queries go through React Query hooks in [hooks/useSupabaseData.ts](hooks/useSupabaseData.ts)
2. Use `useQuery` for reads, `useMutation` for writes
3. Row-Level Security (RLS) policies in [supabase/rls-policies-fix.sql](supabase/rls-policies-fix.sql)
4. Schema in [supabase/schema.sql](supabase/schema.sql)

### Known Issues & Gotchas

**Reference ID as Password:**
- Users set Reference ID during request submission
- System uses `signUpWithEmail(email, referenceId)` to create auth account
- Reference ID must be memorable but unique
- Warning displayed in yellow on form

**Admin Access on GitHub Pages:**
- Changes to admin whitelist require git push to deploy
- GitHub Actions auto-deploys to gh-pages branch
- Production URL: [GitHub Pages URL]
- Local changes won't affect production until pushed

**Deprecated Components:**
- [Dashboard.tsx](components/Dashboard.tsx) - Old customer dashboard, now uses WelcomeScreen
- [admin/RequestsPanel.tsx](components/admin/RequestsPanel.tsx) - Merged into AdminDashboard
- [admin/YardsPanel.tsx](components/admin/YardsPanel.tsx) - Merged into AdminDashboard
- [admin/InventoryPanel.tsx](components/admin/InventoryPanel.tsx) - Merged into AdminDashboard

**Don't delete these yet** - may have reusable code snippets

### File Locations Quick Reference

**Authentication:**
- Login screen: [components/Auth.tsx](components/Auth.tsx)
- Auth context: [lib/AuthContext.tsx](lib/AuthContext.tsx)
- Admin whitelist: [lib/AuthContext.tsx](lib/AuthContext.tsx) line 24-29

**Admin Dashboard:**
- Main dashboard: [components/admin/AdminDashboard.tsx](components/admin/AdminDashboard.tsx)
- AI assistant: [components/admin/AdminAIAssistant.tsx](components/admin/AdminAIAssistant.tsx)
- Analytics calculation: [components/admin/AdminDashboard.tsx](components/admin/AdminDashboard.tsx) useMemo hook around line 40

**AI Services:**
- Gemini service: [services/geminiService.ts](services/geminiService.ts)
- Admin AI function: [services/geminiService.ts](services/geminiService.ts) line 173-229
- Form helper function: [services/geminiService.ts](services/geminiService.ts) line 235-292
- Claude service (alternative): [services/claudeService.ts](services/claudeService.ts)

**Customer Flow:**
- Landing page: [components/WelcomeScreen.tsx](components/WelcomeScreen.tsx)
- Request wizard: [components/StorageRequestWizard.tsx](components/StorageRequestWizard.tsx)
- Form chatbot: [components/FormHelperChatbot.tsx](components/FormHelperChatbot.tsx)
- Inquiry status: [components/WelcomeScreen.tsx](components/WelcomeScreen.tsx) renderInquiryStatus() around line 147

**Database:**
- React Query hooks: [hooks/useSupabaseData.ts](hooks/useSupabaseData.ts)
- Schema: [supabase/schema.sql](supabase/schema.sql)
- RLS policies: [supabase/rls-policies-fix.sql](supabase/rls-policies-fix.sql)

### Testing Checklist

**Before committing changes:**
- [ ] Test both admin and user login flows
- [ ] Verify Gemini API key is set (VITE_GOOGLE_AI_API_KEY)
- [ ] Check Supabase connection (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)
- [ ] Test form submission creates request and auth account
- [ ] Verify admin can approve/reject requests
- [ ] Check AI assistants respond (form helper and admin assistant)
- [ ] Ensure no console errors in browser
- [ ] Test on mobile viewport

**For production deployment:**
- [ ] Update environment variables in hosting platform
- [ ] Run `npm run build` successfully
- [ ] Test built version locally
- [ ] Push to GitHub (auto-deploys to Pages)
- [ ] Verify deployment at GitHub Pages URL
- [ ] Test admin login on production
- [ ] Confirm AI services work on production

### Development Workflow

**Typical development session:**
1. Pull latest from main: `git pull origin main`
2. Create feature branch: `git checkout -b feature/description`
3. Make changes with hot reload: `npm run dev`
4. Test locally at http://localhost:5173
5. Commit changes: `git add . && git commit -m "description"`
6. Push to GitHub: `git push origin feature/description`
7. Create pull request
8. Merge to main (auto-deploys to production)

**Working with Supabase:**
1. Changes to schema: Edit [supabase/schema.sql](supabase/schema.sql), run in Supabase SQL Editor
2. Changes to RLS: Edit [supabase/rls-policies-fix.sql](supabase/rls-policies-fix.sql), run in SQL Editor
3. Local development uses production Supabase instance (no local Supabase)
4. Test with real data or create test company in database

### Collaboration Notes

**When Codex/ChatGPT/Claude is helping:**
- Prefer Gemini functions for new AI features (cost-effective)
- Follow existing patterns in AdminDashboard.tsx for new admin features
- Use React Query hooks from useSupabaseData.ts (don't create new Supabase queries)
- Keep AI system instructions detailed and specific
- Test admin features with whitelisted email before asking user
- Remember: Reference ID acts as password for users
- GitHub Pages deployment means changes need git push to go live

**Code Style:**
- TypeScript strict mode enabled
- Functional components with hooks (no class components)
- Tailwind CSS for styling (no CSS modules)
- Props interfaces defined above components
- Comprehensive comments for complex logic
- Error handling with try/catch and user-friendly messages

---

## 📝 License

Proprietary - MPS Group © 2025

---

## 🎉 Acknowledgments

- Built for MPS Group's 20th Anniversary
- Celebrating 20 Years of FREE Pipe Storage
- Powered by AI: Claude (Anthropic) & Gemini (Google)
- Database: Supabase
- Framework: React + TypeScript + Vite

---

**PipeVault - Your pipes, your project, our commitment.** 🚀
