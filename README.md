# PipeVault

**Enterprise-grade pipe storage management portal for MPS Group's "Free Pipe Storage" promotion.**

Customers submit storage requests and monitor projects. Admins approve work, assign racks, and track inventory with AI assistance.

---

## Quick Overview

**FREE, enterprise-grade application** built in 2 weeks with AI assistance (traditional cost: $222,000, 9 months).

**Key Innovations**:
- **AI-Powered**: Gemini Vision extracts manifest data automatically, Claude chatbot provides instant assistance
- **Zero Friction**: One-click booking, auto-filled forms, drag-and-drop uploads, real-time status updates
- **Real-time Collaboration**: Multiple admins see changes instantly (like Google Docs)
- **Production Security**: Multi-tenant RLS, atomic transactions, comprehensive audit trails

**Impact**:
- Customers: Book storage in **5 minutes** (vs 2 days of emails)
- Admins: Approve requests in **30 seconds** with AI-verified data
- MPS Group: **$312,000 5-year value**, fully customizable, zero vendor lock-in

🎯 **[Read Full Elevator Pitch](docs/planning/ELEVATOR_PITCH.md)** | 📊 **[View Statistics](docs/planning/PROJECT_STATISTICS.md)**

---

## Project Statistics

**Enterprise application: 119,105 lines of code + documentation**

| Metric | Count |
|--------|-------|
| **Total Lines** | **119,105** |
| TypeScript/JavaScript | 30,222 lines |
| SQL (Database) | 14,479 lines |
| Documentation | 74,404 lines |
| React Components | 51 |
| Database Migrations | 81 |
| Total Files | 308+ |

### Development Comparison

| Metric | Traditional Agency | AI-Assisted | Savings |
|--------|-------------------|-------------|---------|
| **Development Time** | 37 weeks (~9 months) | 2 weeks | **94% faster** |
| **Estimated Cost** | $222,000 @ $150/hr | $0 | **$222,000 saved** |
| **Documentation** | ~100 lines/hour | ~15,000 lines/hour | **15,000% faster** |

**Key Achievement**: 74,404 lines of docs vs 44,701 lines of code (**1.66:1 ratio**, industry average is 0.2:1)

📊 **[View Detailed Statistics](docs/planning/PROJECT_STATISTICS.md)**

---

## Technology Stack

- **Frontend**: React 19.2.0 + Vite 6.2.0 + TypeScript 5.3.3
- **State Management**: TanStack Query 5.20.0 + Zustand 4.5.0
- **Backend**: Supabase (PostgreSQL 15 + Realtime + Storage)
- **Styling**: Tailwind CSS 3.4.17
- **AI**: Google Gemini 2.0/2.5 Flash + Claude (Anthropic)
- **Notifications**: Resend API (email) + Slack Webhooks
- **Weather**: Tomorrow.io API
- **Deployment**: GitHub Pages (auto-deploy on push to `main`)

**Cost**: $27.50/month (Supabase free tier + API usage)

---

## Quick Start

### 1. Clone Repository

```bash
git clone https://github.com/your-org/PipeVault.git
cd PipeVault
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment

Create `.env` from `.env.example`:

```bash
VITE_SUPABASE_URL=your_project_url
VITE_SUPABASE_ANON_KEY=your_anon_key
VITE_GOOGLE_AI_API_KEY=your_gemini_key
VITE_RESEND_API_KEY=your_resend_key
VITE_TOMORROW_API_KEY=your_tomorrow_io_key
```

**📖 [Complete Setup Guide](docs/setup/README.md)**

### 4. Setup Database

1. Create Supabase project at [supabase.com](https://supabase.com)
2. Run migrations in SQL Editor (execute files in `/supabase/migrations/` in order)
3. Configure RLS policies

**📖 [Database Setup Guide](docs/setup/DATABASE_SETUP.md)**

### 5. Configure AI Services

Set up Gemini API key for manifest extraction and chatbot features.

**📖 [AI Setup Guide](docs/setup/AI_SETUP.md)**

### 6. Setup Notifications

Configure Resend (email) and Slack webhooks for real-time notifications.

**📖 [Notifications Setup Guide](docs/setup/NOTIFICATIONS_SETUP.md)**

### 7. Start Development Server

```bash
npm run dev
```

Visit [http://localhost:5173](http://localhost:5173)

---

## Core Workflows

### Customer Journey

1. **Sign Up** → Email verification via Supabase Auth
2. **Create Storage Request** → Submit pipe specifications and delivery preferences
3. **Book Inbound Load** → Schedule delivery, upload manifest (AI extracts data automatically)
4. **Track Progress** → Real-time status updates (PENDING → APPROVED → IN_TRANSIT → COMPLETED)
5. **View Inventory** → See stored pipe with rack locations

### Admin Workflow

1. **Review Pending Requests** → View AI-generated summaries and pipe specs
2. **Approve/Reject** → Atomic approval with rack assignment and capacity validation
3. **Track Loads** → Monitor deliveries (NEW → APPROVED → IN_TRANSIT → COMPLETED)
4. **Manage Inventory** → View all inventory with rack assignments and company breakdown

**📖 [Testing Guide](docs/guides/TESTING_GUIDE.md)** for step-by-step testing procedures

---

## Documentation

### 📚 Quick Navigation

**Essential Docs**:
- **[DOCUMENTATION_INDEX.md](DOCUMENTATION_INDEX.md)** - Master navigation hub
- **[TROUBLESHOOTING.md](TROUBLESHOOTING.md)** - Problem → solution quick reference
- **[CHANGELOG.md](CHANGELOG.md)** - Version history and release notes

**Setup Guides**:
- [Database Setup](docs/setup/DATABASE_SETUP.md) - Migrations, schema, RLS
- [AI Setup](docs/setup/AI_SETUP.md) - Gemini API, chatbot configuration
- [Notifications Setup](docs/setup/NOTIFICATIONS_SETUP.md) - Email, Slack integration

**Architecture**:
- [System Architecture](docs/architecture/SYSTEM_ARCHITECTURE.md) - Stack, components, data flow
- [State Machines](docs/architecture/STATE_MACHINES.md) - Request and load lifecycle
- [Data Flow](docs/architecture/DATA_FLOW.md) - Database operations and transitions

**Guides**:
- [Testing Guide](docs/guides/TESTING_GUIDE.md) - Manual testing procedures
- [Deployment Guide](docs/guides/DEPLOYMENT.md) - Migrations, Edge Functions, GitHub Pages

**Planning & Analysis**:
- [Elevator Pitch](docs/planning/ELEVATOR_PITCH.md) - Product vision and value proposition
- [Project Statistics](docs/planning/PROJECT_STATISTICS.md) - Detailed metrics and analysis
- [Mobile Optimization Plan](docs/planning/MOBILE_OPTIMIZATION_PLAN.md) - Future mobile strategy

**📖 [DOCUMENTATION_INDEX.md](DOCUMENTATION_INDEX.md)** - Complete documentation navigation

---

## Deployment

PipeVault auto-deploys to GitHub Pages on every push to `main` branch.

### Build & Deploy

```bash
# Build for production
export VITE_GITHUB_PAGES=true
npm run build

# Deploy to GitHub Pages (automatic via GitHub Actions)
git push origin main
```

### Database Migrations

Apply migrations via Supabase Dashboard SQL Editor or CLI:

```bash
npx supabase db push
```

### Edge Functions

Deploy notification worker:

```bash
npx supabase functions deploy process-notification-queue
```

**📖 [Complete Deployment Guide](docs/guides/DEPLOYMENT.md)**

---

## Testing

### Run Tests

```bash
# Type check
npm run type-check

# Build
npm run build

# Preview production build
npm run preview
```

### Manual Testing

Follow the comprehensive testing guide for customer and admin workflows.

**📖 [Testing Guide](docs/guides/TESTING_GUIDE.md)**

---

## Current Version

**Version**: 2.0.13
**Last Updated**: 2025-11-16
**Status**: Production-ready

**Recent Changes**:
- Documentation reorganization (82% token reduction)
- Architecture docs consolidated
- Setup guides unified
- Testing and deployment guides created

**📖 [Full Changelog](CHANGELOG.md)**

---

## Troubleshooting

### Common Issues

**Problem**: Database connection fails
**Solution**: Check Supabase credentials in `.env` and verify project is not paused

**Problem**: AI manifest extraction not working
**Solution**: Verify `VITE_GOOGLE_AI_API_KEY` is set correctly

**Problem**: Email notifications not sending
**Solution**: Verify `VITE_RESEND_API_KEY` and check notification queue

**📖 [Complete Troubleshooting Guide](TROUBLESHOOTING.md)**

---

## Support & Contact

**Documentation Issues**: Check [DOCUMENTATION_INDEX.md](DOCUMENTATION_INDEX.md) or [TROUBLESHOOTING.md](TROUBLESHOOTING.md)

**Technical Questions**: Review architecture and setup guides

**Bug Reports**: Create detailed issue with:
- Steps to reproduce
- Expected vs actual behavior
- Browser/device information
- Console errors (if applicable)

**Contact**: support@mpsgroup.ca

---

## Project Structure

```
PipeVault/
├── src/                    # React application source
│   ├── components/         # React components
│   ├── hooks/              # Custom React hooks
│   ├── services/           # API services (Supabase, AI, notifications)
│   ├── types/              # TypeScript type definitions
│   └── utils/              # Utility functions
├── supabase/               # Database migrations and config
│   └── migrations/         # SQL migration files
├── docs/                   # Documentation
│   ├── setup/              # Setup guides
│   ├── architecture/       # System architecture docs
│   ├── guides/             # Testing, deployment guides
│   ├── planning/           # Project planning docs
│   └── archive/            # Historical documentation
├── .claude/                # Claude Code agent playbooks
│   └── agents/             # Specialized agent configurations
├── DOCUMENTATION_INDEX.md  # Master navigation
├── TROUBLESHOOTING.md      # Quick problem-solving guide
├── CHANGELOG.md            # Version history
└── README.md               # This file
```

---

## License

Proprietary - MPS Group

**Copyright © 2025 MPS Group. All rights reserved.**

---

**Built with** ❤️ **and AI assistance by MPS Group**

**Documentation**: 📖 [DOCUMENTATION_INDEX.md](DOCUMENTATION_INDEX.md) | **Troubleshooting**: 🔧 [TROUBLESHOOTING.md](TROUBLESHOOTING.md) | **Changelog**: 📝 [CHANGELOG.md](CHANGELOG.md)
