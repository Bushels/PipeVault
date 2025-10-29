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

- ✅ **4-Option Landing Page** - Clean, card-based interface (no login required to start)
- ✅ **AI Form Helper** - Claude-powered chatbot assists with form completion
- ✅ **Smart Request Summaries** - Gemini AI generates professional summaries
- ✅ **Real-time Inventory Tracking** - Live database with Supabase
- ✅ **Admin Dashboard** - Approve/reject requests, manage yards, track trucks
- ✅ **Project Reference System** - Acts as passcode for future inquiries
- ✅ **Trucking Coordination** - Quote requests or customer-provided options
- ✅ **Responsive Design** - Works on desktop, tablet, and mobile

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
- Claude 3.5 Haiku (Anthropic) - Form helper chatbot (~$0.01/conversation)
- Gemini 2.0 Flash (Google) - Request summaries (FREE tier)

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

Access admin dashboard with credentials (Admin/Admin):

- View pending requests with AI-generated summaries
- Approve/reject with reason
- Assign storage locations (yard, area, rack)
- Manage inventory
- Track truck loads
- View all company data

---

## 🔧 Recent Changes (January 2025)

### Major Updates

1. **Removed Login Screen** - Now starts with 4 option cards directly
2. **Created WelcomeScreen** - New landing page component
3. **Email Field Made Editable** - Collects email as part of form (not pre-filled)
4. **Added Semi-Premium Connection** - New option in connection type dropdown
5. **Passcode Reminder** - Prominent yellow text near project reference field
6. **Interactive AI Chatbot** - Replaced static helper card with real chatbot
7. **Fixed Typo** - Removed comma in "Welcome to PipeVault [company]!"

### Component Structure

**Main Components:**
- `WelcomeScreen.tsx` - Landing page with 4 option cards (NEW)
- `StorageRequestWizard.tsx` - Multi-step form for storage requests
- `FormHelperChatbot.tsx` - AI assistant for form help (NEW)
- `Dashboard.tsx` - Main customer dashboard (deprecated for new flow)
- `AdminDashboard.tsx` - Admin control panel
- `Chatbot.tsx` - Inventory inquiry chatbot

**Services:**
- `claudeService.ts` - Claude API integration
- `geminiService.ts` - Gemini API integration
- `supabase.ts` - Database client

**Hooks:**
- `useSupabaseData.ts` - React Query hooks for all CRUD operations

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

### Current Setup (Supabase)

- **Supabase Free Tier**: $0/month (500MB database, 50,000 monthly active users)
- **Supabase Pro**: $25/month (8GB database, 100,000 MAU)
- **Hosting (Vercel/Netlify)**: $0-20/month
- **Claude API**: ~$0.01 per conversation
- **Gemini API**: FREE (15 requests/min)
- **Total**: $0-50/month

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
│   ├── WelcomeScreen.tsx          # Landing page with 4 cards (NEW)
│   ├── StorageRequestWizard.tsx   # Form-based request flow
│   ├── FormHelperChatbot.tsx      # AI form assistant (NEW)
│   ├── StorageRequestMenu.tsx     # 4-option menu component
│   ├── Dashboard.tsx              # Customer dashboard
│   ├── Chatbot.tsx                # Inventory chatbot
│   ├── InventoryDisplay.tsx       # Inventory table
│   ├── admin/
│   │   ├── AdminDashboard.tsx     # Admin control panel
│   │   ├── RequestsPanel.tsx      # Approval management
│   │   ├── YardsPanel.tsx         # Storage facility management
│   │   └── InventoryPanel.tsx     # Inventory tracking
│   └── ui/                        # Reusable UI components
│       ├── Card.tsx
│       ├── Button.tsx
│       └── Spinner.tsx
├── services/
│   ├── claudeService.ts           # Claude API integration
│   ├── geminiService.ts           # Gemini API integration
│   ├── conversationScripts.ts     # AI conversation templates
│   └── emailService.ts            # Email notifications
├── hooks/
│   └── useSupabaseData.ts         # React Query hooks
├── lib/
│   ├── supabase.ts                # Supabase client
│   └── QueryProvider.tsx          # React Query setup
├── supabase/
│   ├── schema.sql                 # Database schema
│   └── rls-policies-fix.sql       # Security policies
├── wix/                           # Wix deployment package (NEW)
│   ├── README.md                  # Wix quick start
│   ├── WIX_MIGRATION_GUIDE.md     # Step-by-step guide
│   ├── backend/
│   │   ├── ai.jsw                 # AI service for Wix
│   │   └── data.jsw               # Database operations
│   └── pages/
│       └── storageRequest.js      # Example page code
├── types.ts                       # TypeScript interfaces
├── App.tsx                        # Main app component
└── index.tsx                      # Entry point
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
