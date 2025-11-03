# PipeVault

PipeVault is MPS Group's portal for running the 20-year anniversary "Free Pipe Storage" promotion. Customers submit storage requests and monitor projects, while admins approve work, assign racks, and track inventory with AI assistance.

## Table of Contents
- [Product Snapshot](#product-snapshot)
- [Core Flows](#core-flows)
- [Technology Stack](#technology-stack)
- [Environment Setup](#environment-setup)
- [Local Development](#local-development)
- [Supabase Configuration](#supabase-configuration)
- [AI Configuration](#ai-configuration)
- [Slack Integration](#slack-integration)
- [Operational Playbooks](#operational-playbooks)
- [Current Gaps & Follow-ups](#current-gaps--follow-ups)
- [Deployment Notes](#deployment-notes)
- [Support & Contact](#support--contact)

## Product Snapshot
- **Audience**: Energy operators and service companies storing pipe with MPS Group.
- **AI Assistants**:
  - **Roughneck** - customer-facing field hand that answers project questions.
  - **Roughneck Ops** - admin-side assistant for approvals, capacity checks, and analytics.
- **Data Source**: Supabase (project-specific instance) for auth, storage requests, inventory, documents, notifications, and trucking.
- **AI Stack**: Gemini Flash 2.5 (chat) + 2.0 summaries (free-tier friendly).

## Core Flows

### Customer
1. **Account Access** - customers sign up with email/password, first name, last name, company name, and contact number. Supabase Auth handles email verification; users must confirm before accessing the dashboard.
2. **Dashboard Landing** - authenticated customers see a modern **tile-based system**:
   - **Request Storage Button** - prominent gradient button above tiles for creating new storage requests
   - **Request Tiles** - each active request displayed as a card showing status, pipe specs (with thread type), quantity (total meters + joints), storage dates with day counters, and assigned location
   - **Roughneck AI Tile** - permanent tile featuring:
     - Live weather updates from Tomorrow.io API with dynamic quips
     - Project status summary
     - Quick command suggestions
     - Chat input for instant AI assistance
3. **New Storage Request** - streamlined wizard that **pre-fills contact information** from signup metadata:
   - Contact info shown as read-only summary (no duplicate data entry)
   - Collects pipe specifications (item type, grade, connection with thread type, size, joints, length)
   - Storage duration with start/end dates
   - Trucking preference (customer delivery vs MPS pickup with details)
   - Submission generates reference ID and creates `PENDING` request
   - AI generates summary for admin approval queue
4. **Logistics Scheduling** - "Truck to MPS" button appears on approved requests, allowing customers to schedule delivery without re-authentication (tied to `truck_loads` table)
5. **Roughneck Chat** - AI assistant provides:
   - Real-time weather updates with personality-driven quips
   - Request status inquiries scoped to customer's company
   - Storage duration and location information
   - General oilfield advice in conversational tone

### Administrator
1. **Admin Login** - admins sign in through Supabase Auth. `AuthContext` marks admins by:
   - A temporary hard-coded email allowlist.
   - The `admin_users` table (preferred) with RLS enforcement.
2. **Admin Dashboard Tabs** - Overview, Approvals, Requests, Companies, Inventory, Storage, Roughneck Ops. The Approvals tab now surfaces full pipe specifications (grade, connection, length, trucking preferences) alongside an internal notes field, and the All Requests table mirrors that detail with inline-editable notes, a total length column, and approver/timestamp metadata.
3. **Truck Loads & Pickups** - record inbound and outbound loads to keep utilisation accurate.

## Technology Stack
- **Frontend**: React 19 + Vite + TypeScript
- **State/Data**: TanStack Query (Supabase fetch/mutations)
- **Backend-as-a-Service**: Supabase (Postgres, Auth, Storage, Realtime)
- **Styling**: Tailwind-style utility classes within custom components
- **AI**: `@google/genai` (Gemini Flash 2.5 chat + 2.0 summaries)
- **Weather**: Tomorrow.io API for real-time weather data in Roughneck AI tile

## Environment Setup
Create `.env` from `.env.example`:

```bash
VITE_SUPABASE_URL=your_project_url_here
VITE_SUPABASE_ANON_KEY=your_anon_key_here
VITE_GOOGLE_AI_API_KEY=your_gemini_key_here
VITE_RESEND_API_KEY=your_resend_key_here
VITE_TOMORROW_API_KEY=your_tomorrow_io_key_here
VITE_ANTHROPIC_API_KEY=your_anthropic_key_here
```

**Required Configuration:**
- `VITE_SUPABASE_URL` - Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Supabase anonymous key for client-side auth
- `VITE_GOOGLE_AI_API_KEY` - Gemini API key for Roughneck chat assistants
- `VITE_RESEND_API_KEY` - Resend API key for approval/rejection emails sent from `services/emailService.ts`
- `VITE_TOMORROW_API_KEY` - Tomorrow.io API key for real-time weather data in Roughneck tile

**Optional variables:**
- `VITE_SUPABASE_SERVICE_ROLE` for privileged Edge Functions
- `VITE_AI_SYSTEM_PROMPT` to override default AI prompts
- `VITE_ANTHROPIC_API_KEY` for future Claude integration

**Important Notes:**
- Never commit real keys; the samples are for local debugging only
- **Contact Email**: All emails sent from `pipevault@mpsgroup.ca` (requires Resend domain verification in production)
- **Slack Notifications**: Configured via Supabase Database Webhooks (not client-side), see `NOTIFICATION_SERVICES_SETUP.md`
- After changing `.env`, restart your dev server for changes to take effect

## Local Development
```bash
npm install
npm run dev         # start Vite dev server
npm run build       # type-check + production bundle
npm run preview     # test the production build locally
```

### Test Accounts
- Create customer/admin accounts in the Supabase dashboard.
- `Auth.tsx` contains a temporary admin allowlist (`adminEmails`). Remove it once all admins live in `admin_users`.

## Supabase Configuration
1. **Schema** - run `supabase/schema.sql` in the Supabase SQL editor to create tables, enums, and seed yard data.
2. **Row-Level Security** - run `supabase/rls-policies-fix.sql` **whenever this file changes**. The script:
   - Enforces RLS on companies, storage requests, inventory, truck_loads, documents, conversations, and notifications.
   - Restricts customers to data that matches their email domain.
   - Grants admins broader SELECT/UPDATE access via the `admin_users` table.
   - Adds an allowlisted admin fallback for key policies; update the email list in the SQL to match your roster.
3. **Checks** - use the verification queries at the bottom of the SQL file to confirm RLS state.
4. **Admin Users** - insert admin records (Supabase Auth UUID) into `admin_users` via service-role SQL or the dashboard.

## AI Configuration
- Set `VITE_GOOGLE_AI_API_KEY`. Without it, the app uses canned fallback responses.
- `services/geminiService.ts` contains all prompts for Roughneck, Roughneck Ops, request summaries, and the form helper.
- Adjust tone/behaviour by editing the prompt strings or `services/conversationScripts.ts`.
- Chat history is trimmed in the client to stay within free-tier token limits.
- For details on ongoing AI development and the product roadmap, see [ROUGHNECK_AI_REFERENCE.md](ROUGHNECK_AI_REFERENCE.md).

## Slack Integration

PipeVault sends real-time notifications to your Slack workspace for all critical events using **Supabase Database Webhooks** (server-side, secure).

### Notification Events

The system automatically notifies your team when:
1. **New User Signups** - customer creates account with name, email, company
2. **New Storage Requests** - customer submits pipe storage request
3. **Delivery Bookings** - truck scheduled to deliver pipe to MPS facility
4. **Pickup Bookings** - truck scheduled to pick up pipe from MPS to well site

### Setup Instructions

**Prerequisites:**
- Slack workspace with admin access
- Supabase project with database access

**Steps:**
1. **Create Slack Incoming Webhook**
   - Go to https://api.slack.com/apps
   - Create new app: "PipeVault Notifications"
   - Enable **Incoming Webhooks**
   - Add webhook to your `#pipevault-notifications` channel
   - Copy the webhook URL (you'll need this for each webhook config)

2. **Enable pg_net Extension** (for user signup trigger)
   ```sql
   -- Run in Supabase SQL Editor:
   CREATE EXTENSION IF NOT EXISTS pg_net;
   ```

3. **Configure Database Webhooks**
   - Open `supabase/SETUP_SLACK_WEBHOOKS_COMPLETE.sql` in your project
   - Follow the detailed setup instructions for all 4 webhooks:
     - **slack-new-user-signup** (database trigger on `auth.users`)
     - **slack-new-storage-request** (webhook on `storage_requests` INSERT with `status.eq.PENDING` filter)
     - **slack-delivery-booking** (webhook on `truck_loads` INSERT with `type.eq.DELIVERY` filter)
     - **slack-pickup-booking** (webhook on `truck_loads` INSERT with `type.eq.PICKUP` filter)
   - Each webhook uses Slack Block Kit for rich, interactive notifications
   - All notifications include direct links to PipeVault admin dashboard

4. **Test Webhooks**
   - Submit test storage request → verify Slack notification
   - Create test delivery booking → verify Slack notification
   - Create test pickup booking → verify Slack notification
   - Check Supabase webhook logs for delivery confirmation

**Architecture Benefits:**
- ✅ **Secure** - Slack webhook URL never exposed in frontend code
- ✅ **Reliable** - Server-side execution with automatic retries
- ✅ **Guaranteed** - Notifications sent even if user closes browser
- ✅ **Logged** - All webhook executions visible in Supabase Dashboard

**Reference Files:**
- [supabase/SETUP_SLACK_WEBHOOKS_COMPLETE.sql](supabase/SETUP_SLACK_WEBHOOKS_COMPLETE.sql) - Complete webhook setup with payload templates
- [SLACK_INTEGRATION_MIGRATION.md](SLACK_INTEGRATION_MIGRATION.md) - Migration from client-side to Supabase webhooks
- [NOTIFICATION_SERVICES_SETUP.md](NOTIFICATION_SERVICES_SETUP.md) - Email + Slack notification guide

## Technical Troubleshooting & Issue Resolution

This section documents critical issues encountered during development, their root causes, and technical solutions. Written for AI comprehension and future debugging.

### Issue 1: React Query Cache Persistence Across Authentication State Changes

**Symptom**: When switching between user accounts (customer → admin or vice versa), the application displays stale data from the previous session until the development server is restarted. Admin dashboards show customer data, customer dashboards show admin data.

**Root Cause Analysis**:
- React Query (`@tanstack/react-query`) caches all API responses with a 5-minute `staleTime` ([QueryProvider.tsx:13](lib/QueryProvider.tsx#L13))
- When authentication state changes (logout → login with different account):
  1. Supabase auth state updates correctly (new JWT token issued)
  2. Local React state clears (`user`, `session`, `isAdmin` in AuthContext)
  3. **BUT** React Query cache persists with data fetched using the previous user's JWT
  4. New queries see "fresh" cached data and don't refetch
  5. Even though the new JWT has different Row Level Security (RLS) permissions, cached data is still returned
- This is a JWT caching issue at the React Query layer, not a Supabase Auth layer issue
- The problem compounds in development due to Hot Module Replacement (HMR) maintaining in-memory state across code changes

**Technical Solution**:
Implemented automatic cache invalidation in [AuthContext.tsx](lib/AuthContext.tsx) when authentication events occur:

```typescript
// Import queryClient from QueryProvider
import { queryClient } from './QueryProvider';

// In useEffect - onAuthStateChange listener (lines 62-82)
supabase.auth.onAuthStateChange((event, session) => {
  const previousUserId = user?.id;
  const newUserId = session?.user?.id;

  // Update local auth state
  setSession(session);
  setUser(session?.user ?? null);
  checkAdminStatus(session?.user ?? null);

  // Clear cache on logout or account switch
  if (event === 'SIGNED_OUT' || (newUserId && previousUserId && newUserId !== previousUserId)) {
    console.log('Auth state changed - clearing query cache to prevent stale data');
    queryClient.clear(); // Remove all queries from cache
  }
  // Refetch all data when logging in or token refreshes
  else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
    console.log('User authenticated - invalidating queries to refetch with new permissions');
    queryClient.invalidateQueries(); // Mark all queries as stale and refetch
  }
});
```

**Cache Invalidation Strategy**:
- `queryClient.clear()` - Complete cache removal on logout and account switch
- `queryClient.invalidateQueries()` - Mark queries stale and refetch on login and token refresh
- User ID comparison prevents unnecessary cache clears when same user refreshes token

**Files Modified**:
- [lib/QueryProvider.tsx:9](lib/QueryProvider.tsx#L9) - Exported `queryClient` for external access
- [lib/AuthContext.tsx:9](lib/AuthContext.tsx#L9) - Imported `queryClient`
- [lib/AuthContext.tsx:73-81](lib/AuthContext.tsx#L73-L81) - Added cache invalidation in auth event handler
- [lib/AuthContext.tsx:189-191](lib/AuthContext.tsx#L189-L191) - Added redundant cache clear in `signOut()` function

**Testing Verification**:
```bash
# Before fix:
1. Login as customer@example.com → see customer dashboard
2. Logout
3. Login as admin@mpsgroup.com → ❌ still shows customer data
4. Restart dev server → ✅ now shows admin data

# After fix:
1. Login as customer@example.com → see customer dashboard
2. Logout → Console: "Auth state changed - clearing query cache to prevent stale data"
3. Login as admin@mpsgroup.com → Console: "User authenticated - invalidating queries to refetch with new permissions"
4. ✅ Immediately shows correct admin data (no restart needed)
```

**Production Impact**: Minimal. This was primarily a development issue due to HMR and rapid account switching. Production users rarely switch accounts in the same browser session. However, the fix ensures robustness in all environments and handles edge cases like:
- JWT token refresh every hour (auto-refetch with new token)
- RLS policy changes in Supabase (clear cache forces new permission check)
- Multi-tab logout scenarios (prevents stale data in other tabs)

**Reference**: See [CACHE_INVALIDATION_FIX.md](CACHE_INVALIDATION_FIX.md) for complete analysis.

---

### Issue 2: Slack Webhook URL Exposure in Client Bundle

**Symptom**: Original Slack notification implementation sent notifications directly from the browser using a webhook URL stored in `VITE_SLACK_WEBHOOK_URL` environment variable.

**Security Vulnerability**:
- Vite bundles all `VITE_*` environment variables into the client-side JavaScript bundle
- Slack webhook URL becomes visible in browser DevTools and production bundle
- Any user can extract the webhook URL and send arbitrary messages to the Slack channel
- Client-side network requests can fail silently (CORS, network issues, ad blockers)

**Technical Solution**:
Migrated from client-side fetch to Supabase Database Webhooks (server-side):

**Architecture Comparison**:
```
# Before (Client-side):
[Browser] → [fetch(VITE_SLACK_WEBHOOK_URL)] → [Slack API]
Issues: URL exposed, unreliable, no retries

# After (Server-side):
[Browser] → [Supabase INSERT] → [Supabase Webhook] → [Slack API]
Benefits: Secure, reliable, automatic retries, centralized logging
```

**Implementation Changes**:
1. **Removed client-side code**:
   - Deleted `import * as slackService` from [StorageRequestWizard.tsx:254-268](components/StorageRequestWizard.tsx)
   - Removed fetch call to Slack webhook
   - Added comment: "Slack notification handled automatically by Supabase webhook on INSERT"

2. **Created Supabase webhook configuration**:
   - [supabase/SETUP_SLACK_WEBHOOK.sql](supabase/SETUP_SLACK_WEBHOOK.sql) - Complete webhook template
   - Webhook triggers on `INSERT` to `storage_requests` table
   - Uses Slack Block Kit for rich message formatting
   - Includes all request details (reference ID, company, pipe specs, dates)

3. **Updated documentation**:
   - Removed `VITE_SLACK_WEBHOOK_URL` from [.env.example](.env.example)
   - Updated [NOTIFICATION_SERVICES_SETUP.md](NOTIFICATION_SERVICES_SETUP.md) with Supabase webhook instructions
   - Created [SLACK_INTEGRATION_MIGRATION.md](SLACK_INTEGRATION_MIGRATION.md) for migration details

**Webhook Configuration** (applied in Supabase Dashboard):
```
Name: slack-new-storage-request
Table: storage_requests
Events: INSERT
Type: HTTP Request
Method: POST
URL: https://hooks.slack.com/services/YOUR/WEBHOOK/URL
HTTP Headers: Content-Type: application/json
```

**Benefits of Server-Side Webhooks**:
- **Security**: Webhook URL never exposed to client
- **Reliability**: Supabase handles retries and error logging
- **Automatic**: No client-side code needed
- **Centralized**: All database events logged in Supabase Dashboard
- **Testable**: Can test directly in Supabase SQL Editor

**Testing Verification**:
```bash
# Test webhook in Supabase SQL Editor:
INSERT INTO storage_requests (reference_id, company_name, user_email, status)
VALUES ('TEST-001', 'Test Company', 'test@example.com', 'PENDING');
# Check Slack channel for notification
```

**Reference**: See [SLACK_INTEGRATION_MIGRATION.md](SLACK_INTEGRATION_MIGRATION.md) and [NOTIFICATION_SERVICES_SETUP.md](NOTIFICATION_SERVICES_SETUP.md).

---

### Issue 3: Email Notifications Not Being Delivered

**Symptom**: Sign-up confirmation emails arrive successfully, but approval/rejection emails sent from admin dashboard never reach customer inboxes.

**Root Cause Analysis**:
- **Sign-up emails**: Handled by Supabase Auth's built-in email service (working correctly)
- **Approval/rejection emails**: Handled by custom code in [services/emailService.ts](services/emailService.ts) using Resend API
- The `VITE_RESEND_API_KEY` was set to placeholder value `'your_resend_key_here'`
- When [emailService.ts:30-34](services/emailService.ts#L30-L34) detects missing/invalid API key:
  ```typescript
  if (isDevelopment || !isValidApiKey) {
    console.log('📧 [DEV MODE] Email would be sent:', { to, subject });
    return; // Email logged to console but not sent
  }
  ```

**Email Architecture**:
```
Sign-up Flow:
[User Registration] → [Supabase Auth] → [Built-in Email Service] → ✅ Customer Inbox

Approval Flow:
[Admin Approves] → [App.tsx:130] → [emailService.sendApprovalEmail()]
  → [Resend API] → ✅ Customer Inbox (after fix)

Rejection Flow:
[Admin Rejects] → [App.tsx:145] → [emailService.sendRejectionEmail()]
  → [Resend API] → ✅ Customer Inbox (after fix)
```

**Solution**:
1. Configured valid Resend API key in [.env:10](.env#L10):
   ```bash
   VITE_RESEND_API_KEY=re_99TDdtXH_5EUoLuQY8jCGUW7cq9zXhx2K
   ```
   (Key will be rotated before production)

2. Updated all email contact references to `pipevault@mpsgroup.ca`:
   - [services/emailService.ts:28](services/emailService.ts#L28) - `FROM_EMAIL` constant
   - [components/RequestSummaryPanel.tsx:167](components/RequestSummaryPanel.tsx#L167) - mailto link
   - [NOTIFICATION_SERVICES_SETUP.md](NOTIFICATION_SERVICES_SETUP.md) - documentation
   - [README.md:132](README.md#L132) - support contact

3. **Domain Verification Pending**: `mpsgroup.ca` domain needs DNS records (SPF, DKIM, DMARC) configured in Resend dashboard for production delivery. Currently paused pending DNS access.

**Email Templates**:
- **Approval Email**: Celebration theme, red gradient header, yellow "20 Years of MPS Group" highlight, green location box, dashboard link
- **Rejection Email**: Professional tone, reason explanation, resubmission encouragement, support contact
- Both templates include HTML (styled) and plain text (fallback) versions

**Testing Verification**:
```bash
# Development mode (logs to console):
npm run dev
# Approve request in admin dashboard
# Check browser console for: "📧 [DEV MODE] Email would be sent: { to, subject }"

# Production mode (sends via Resend):
VITE_RESEND_API_KEY=re_99... npm run dev
# Approve request
# Check customer inbox for email
```

**Reference**: See [NOTIFICATION_SERVICES_SETUP.md](NOTIFICATION_SERVICES_SETUP.md) for complete email configuration.

---

### Issue 4: Archive Feature Database Schema Mismatch

**Symptom**: Archive functionality implemented in TypeScript code but `archived_at` column missing from Supabase database, causing runtime errors when attempting to archive requests.

**Root Cause**: Frontend code updated ([types.ts:95](types.ts#L95), [database.types.ts:51](lib/database.types.ts#L51), [useSupabaseData.ts:32](hooks/useSupabaseData.ts#L32)) but database schema not applied.

**Solution**: Created [supabase/APPLY_ARCHIVE_COLUMN.sql](supabase/APPLY_ARCHIVE_COLUMN.sql):
```sql
-- Add archived_at column to storage_requests table
ALTER TABLE storage_requests
ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

-- Add index for faster filtering of archived requests
CREATE INDEX IF NOT EXISTS idx_requests_archived
ON storage_requests(archived_at)
WHERE archived_at IS NOT NULL;
```

**Archive Feature Implementation**:
- [components/RequestSummaryPanel.tsx:12](components/RequestSummaryPanel.tsx#L12) - Archive/Restore button with loading state
- [components/RequestSummaryPanel.tsx:170](components/RequestSummaryPanel.tsx#L170) - "Show Archived" toggle
- [components/Dashboard.tsx:26](components/Dashboard.tsx#L26) - Archive mutation wiring
- [hooks/useSupabaseData.ts:223](hooks/useSupabaseData.ts#L223) - Supabase UPDATE mutation
- Archived requests hidden by default, visible via toggle
- Admin dashboards still see all requests (customer-only filter)

**Deployment Checklist**:
1. Apply SQL in Supabase SQL Editor
2. Verify column exists: `SELECT column_name FROM information_schema.columns WHERE table_name = 'storage_requests' AND column_name = 'archived_at';`
3. Test archive/restore in customer dashboard
4. Deploy frontend with `npm run build`

---

### Common Debugging Patterns

**React Query Cache Issues**:
- Symptoms: Stale data after auth state change, data from wrong user
- Solution: Check if `queryClient.clear()` or `invalidateQueries()` called on auth events
- Debug: Add `console.log` in [AuthContext.tsx:74,79](lib/AuthContext.tsx#L74) to verify cache clearing

**RLS Permission Issues**:
- Symptoms: Data not visible, "new row violates row-level security policy"
- Solution: Verify JWT token has correct claims, check admin_users table, verify RLS policies
- Debug: Run `SELECT auth.uid()` in Supabase SQL Editor to see current user ID

**Email Not Sending**:
- Symptoms: No email in inbox, no errors in console
- Solution: Check if API key valid, verify domain verified in Resend, check spam folder
- Debug: Look for "📧 [DEV MODE]" logs indicating development mode vs production mode

**Webhook Not Firing**:
- Symptoms: Database INSERT succeeds but no Slack notification
- Solution: Check Supabase Dashboard → Database → Webhooks for error logs
- Debug: Test webhook with manual INSERT in SQL Editor, verify webhook URL valid

## Testing & Quality Assurance

### Flow Testing Methodology

**Authentication Flow Testing**:
```bash
# Test 1: Customer Sign-up
1. Navigate to sign-up page
2. Enter email, password, company details
3. Submit form
4. Verify Supabase Auth email received
5. Confirm email address
6. Login with credentials
7. Verify redirect to customer dashboard

# Test 2: Admin Login
1. Navigate to login page
2. Enter admin email (listed in AuthContext.tsx:96-100)
3. Login with credentials
4. Verify redirect to admin dashboard (not customer dashboard)
5. Verify admin tabs visible (Overview, Approvals, Requests, etc.)

# Test 3: Account Switching (Cache Invalidation)
1. Login as customer account
2. Note data visible on dashboard
3. Logout → Check console for "clearing query cache"
4. Login as admin account → Check console for "invalidating queries"
5. Verify admin data shown (NOT customer data)
6. No page refresh or server restart required
```

**Storage Request Flow Testing**:
```bash
# Test 4: Customer Request Submission
1. Login as customer
2. Click "Request Storage" on dashboard
3. Complete wizard steps:
   - Contact information (auto-filled from user metadata)
   - Pipe specifications (type, size, grade, joints)
   - Storage duration (start/end dates)
   - Trucking preference (customer delivery vs MPS pickup)
4. Submit request
5. Verify project reference ID displayed
6. Verify request appears in dashboard summary panel
7. Verify request status shows "PENDING"
8. Check Slack channel for new request notification (if webhook configured)

# Test 5: Admin Approval Flow
1. Login as admin
2. Navigate to "Approvals" tab
3. Select pending request
4. Review AI-generated summary
5. Assign rack locations (select from available racks)
6. Click "Approve"
7. Verify confirmation alert appears
8. Verify request status changes to "APPROVED"
9. Verify request moves from Approvals to Requests tab
10. Check customer email inbox for approval email
11. Verify email includes assigned location

# Test 6: Admin Rejection Flow
1. Login as admin
2. Navigate to "Approvals" tab
3. Select pending request
4. Click "Reject"
5. Enter rejection reason
6. Submit rejection
7. Verify confirmation alert appears
8. Verify request status changes to "REJECTED"
9. Check customer email inbox for rejection email
10. Verify email includes reason and support contact
```

**Archive Feature Testing**:
```bash
# Test 7: Archive Request (Customer)
1. Login as customer with multiple active requests
2. View dashboard with request summary cards
3. Click "Archive" button on a completed request
4. Verify card disappears from default view
5. Verify button shows loading state during update
6. Click "Show Archived" toggle
7. Verify archived request appears with "Restore" button
8. Click "Restore"
9. Verify request returns to default view
10. Verify admin dashboard still shows all requests (archived + active)
```

**Email Notification Testing**:
```bash
# Test 8: Email Delivery (Development)
1. Set VITE_RESEND_API_KEY to placeholder value
2. Start dev server: npm run dev
3. Approve a storage request
4. Check browser console for "📧 [DEV MODE] Email would be sent"
5. Verify no actual email sent (development mode)

# Test 9: Email Delivery (Production)
1. Set valid VITE_RESEND_API_KEY in .env
2. Restart dev server (required for env change)
3. Approve a storage request
4. Check customer email inbox (may take 1-2 minutes)
5. Verify HTML formatting renders correctly
6. Test "View Dashboard" button link
7. Reply to email and verify reply-to address works
```

**Roughneck AI Assistant Testing**:
```bash
# Test 10: Customer Chat
1. Login as customer
2. Click "Ask Roughneck" on dashboard
3. Ask: "What is the status of my storage request?"
4. Verify response scoped to customer's requests only
5. Ask: "How long will my pipe be stored?"
6. Verify AI references specific dates from request
7. Ask: "What location is my pipe stored at?"
8. Verify AI responds with assigned rack location

# Test 11: Admin Assistant (Roughneck Ops)
1. Login as admin
2. Navigate to "Roughneck Ops" tab
3. Ask: "Which companies are picking up this month?"
4. Verify AI analyzes truck_loads table
5. Ask: "What is our current utilization rate?"
6. Verify AI calculates from racks and inventory
7. Ask: "Show me all pending approvals"
8. Verify AI references storage_requests table
```

### Modern Development Practices

**React Query Data Fetching Pattern**:
```typescript
// Pattern used in hooks/useSupabaseData.ts
export function useStorageRequests(userEmail?: string) {
  return useQuery({
    queryKey: ['requests', userEmail], // Unique cache key
    queryFn: async () => {
      const { data, error } = await supabase
        .from('storage_requests')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!userEmail, // Only fetch when userEmail available
  });
}
```

**Benefits**:
- Automatic caching reduces redundant API calls
- Background refetching keeps data fresh
- Loading and error states handled automatically
- Optimistic updates for better UX
- Query invalidation ensures consistency

**Environment-Based Configuration**:
```typescript
// Pattern used in services/emailService.ts
const isDevelopment = import.meta.env.MODE === 'development';
const apiKey = import.meta.env.VITE_RESEND_API_KEY;
const isValidApiKey = apiKey && !apiKey.includes('your_') && apiKey.startsWith('re_');

if (isDevelopment || !isValidApiKey) {
  console.log('📧 [DEV MODE] Email would be sent:', { to, subject });
  return; // Safe fallback in development
}

// Production: actually send email
await fetch('https://api.resend.com/emails', { ... });
```

**Benefits**:
- Safe development environment (no accidental emails/notifications)
- Easy testing without external service costs
- Production parity with environment variables
- No code changes between environments

**TypeScript Type Safety**:
```typescript
// Pattern used throughout codebase
export interface StorageRequest {
  id: string;
  referenceId: string;
  companyName: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED'; // Type-safe enum
  archivedAt: string | null; // Explicit nullability
  // ... other fields
}

// Supabase types generated from database schema
import { Database } from './lib/database.types';
type StorageRequestRow = Database['public']['Tables']['storage_requests']['Row'];
```

**Benefits**:
- Compile-time error detection
- Autocomplete in IDE
- Refactoring safety
- Self-documenting code
- Prevents runtime type errors

**Component Composition Pattern**:
```typescript
// Pattern used in components/Dashboard.tsx
export function Dashboard() {
  const { user } = useAuth();
  const { data: requests } = useStorageRequests(user?.email);
  const { mutate: archiveRequest } = useArchiveRequest();

  return (
    <RequestSummaryPanel
      requests={requests}
      onArchive={archiveRequest}
    />
  );
}
```

**Benefits**:
- Separation of concerns (data fetching, UI rendering)
- Reusable components
- Testable in isolation
- Clear prop interfaces
- Easy to reason about data flow

**Security Best Practices**:
```typescript
// Pattern: Never expose secrets in client bundle
// ❌ Bad:
const SLACK_WEBHOOK = 'https://hooks.slack.com/...' // Visible in browser

// ✅ Good:
// Supabase Database Webhook (server-side)
// Configured in Supabase Dashboard, never touches client code

// Pattern: Validate API keys before use
const isValidApiKey = apiKey &&
                      !apiKey.includes('placeholder') &&
                      apiKey.startsWith('expected_prefix');

// Pattern: Row Level Security (RLS) in database
-- Policy: Customers see only their company's data
CREATE POLICY customer_select_own ON storage_requests
FOR SELECT USING (
  user_email LIKE '%' || (SELECT substring(auth.jwt() ->> 'email' FROM '@(.*)$'))
);
```

**Benefits**:
- Defense in depth (client + server + database security)
- Automatic authorization enforcement
- No secret leakage in browser
- Principle of least privilege

**Error Handling Pattern**:
```typescript
// Pattern used in hooks/useSupabaseData.ts
const { mutate: approveRequest } = useMutation({
  mutationFn: async ({ requestId, rackIds }) => {
    const { data, error } = await supabase
      .from('storage_requests')
      .update({ status: 'APPROVED', assignedRackIds: rackIds })
      .eq('id', requestId);

    if (error) throw error; // Propagate error to React Query
    return data;
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['requests'] }); // Refetch
    toast.success('Request approved successfully'); // User feedback
  },
  onError: (error) => {
    console.error('Approval failed:', error);
    toast.error('Failed to approve request. Please try again.');
  },
});
```

**Benefits**:
- Graceful error handling
- User-friendly error messages
- Error logging for debugging
- Automatic retry on transient failures
- Optimistic updates with rollback

**Git Workflow & Commit Hygiene**:
```bash
# Pattern: Feature branch workflow
git checkout -b feat/archive-functionality
git add components/RequestSummaryPanel.tsx hooks/useSupabaseData.ts
git commit -m "feat: Add archive/restore functionality for customer requests"
git push origin feat/archive-functionality

# Pattern: Descriptive commit messages
feat: Add Slack webhook integration via Supabase
fix: Clear React Query cache on authentication state change
docs: Add technical troubleshooting section to README
chore: Update Resend API key and email configuration
```

**Benefits**:
- Clear change history
- Easy rollback if needed
- Searchable commit messages
- CI/CD integration readiness

## Operational Playbooks

### Daily Admin Routine
- Review **Approvals**, assign racks, and approve/reject (confirmation alerts will appear).
- Monitor **Overview** metrics: utilisation, upcoming pickups, trucking quote backlog.
- Record truck movements in **Storage/Inventory** so utilisation stays accurate.
- Ask **Roughneck Ops** for quick analytics (for example, "Which companies are picking up this month?").

### Customer Support Checklist
- Confirm new users verified their email (Supabase returns "email not confirmed" otherwise).
- If a user cannot find their request:
  - Ensure their email domain maps to a company domain.
  - Verify the request exists and `user_email` is stored in lower case.
  - Remind them multiple requests show up as swipeable cards in the summary panel.
- Encourage customers to use the dashboard Roughneck chat rather than the old inquiry form.

## Recent Architecture Improvements & Legacy Code Removal

### Authentication System Modernization (January 2025)

**Legacy System Removed:**
- ❌ **WelcomeScreen.tsx** - Old dual authentication system with 4-tile menu and email/reference ID sign-in
- ❌ **Dual Session State** - Complex session management mixing Supabase Auth with custom session objects
- ❌ **Email/Reference ID Authentication** - Secondary authentication layer for delivery scheduling (no longer needed)
- ❌ **Full Name Storage** - Single `full_name` field replaced with structured `first_name` + `last_name`

**Modern Architecture:**
- ✅ **Streamlined Authentication** - Single Supabase Auth flow with automatic session creation ([App.tsx:240-253](App.tsx#L240-L253))
- ✅ **Tile-Based Dashboard** - Modern UI with permanent Roughneck AI tile and request cards ([StorageRequestMenu.tsx](components/StorageRequestMenu.tsx))
- ✅ **Structured User Metadata** - First name, last name, company name, and contact number stored separately in `auth.users.raw_user_meta_data`
- ✅ **Pre-filled Forms** - Contact information auto-populated from signup metadata ([StorageRequestWizard.tsx:235-250](components/StorageRequestWizard.tsx#L235-L250))
- ✅ **Removed Session.referenceId** - Simplified session interface to only contain company and userId ([types.ts:133-136](types.ts#L133-L136))

**Files Deleted:**
- `components/WelcomeScreen.tsx` - 442 lines of legacy code removed

**Files Modernized:**
- [App.tsx](App.tsx) - Auto-create session from authenticated user (removed dual session management)
- [Auth.tsx](Auth.tsx) - Split full name into first/last name fields in signup form
- [AuthContext.tsx](lib/AuthContext.tsx) - Updated signUpWithEmail to accept firstName/lastName
- [types.ts](types.ts) - Removed referenceId from Session interface
- [StorageRequestWizard.tsx](components/StorageRequestWizard.tsx) - Pre-fill contact info from metadata
- [Header.tsx](components/Header.tsx) - Construct full name from first_name + last_name
- [customerIdentity.ts](utils/customerIdentity.ts) - Resolve identity from structured metadata

### UI/UX Enhancements (January 2025)

**Improvements:**
- ✅ **Connection Display** - Shows thread type alongside connection (e.g., "BTC 8 Round") ([RequestSummaryPanel.tsx:365-366](components/RequestSummaryPanel.tsx#L365-L366))
- ✅ **Quantity Display** - Total meters as primary value with joints breakdown (e.g., "1266.9m / 103 joints @ 12.3m avg length") ([RequestSummaryPanel.tsx:373-378](components/RequestSummaryPanel.tsx#L373-L378))
- ✅ **Weather Integration** - Real-time weather from Tomorrow.io API with dynamic Roughneck quips ([services/weatherService.ts](services/weatherService.ts))
- ✅ **Request Adjustments** - Removed "Request Adjustment" button; adjustments now handled via Roughneck AI chat

**Weather Service Features:**
- Live temperature and conditions for Calgary, Alberta (MPS location)
- 80+ weather codes mapped to emojis and descriptions
- Dynamic personality-driven quips based on temperature and conditions
- Automatic fallback if API unavailable

## Current Gaps & Follow-ups

### Completed
- ✅ **Archive Feature** - Customer dashboard archive/restore functionality implemented ([RequestSummaryPanel.tsx](components/RequestSummaryPanel.tsx), [Dashboard.tsx](components/Dashboard.tsx))
- ✅ **Cache Invalidation** - Fixed stale data on account switching with automatic React Query cache clearing ([AuthContext.tsx:73-81](lib/AuthContext.tsx#L73-L81))
- ✅ **Slack Notifications** - Migrated from client-side to secure Supabase Database Webhooks ([SLACK_INTEGRATION_MIGRATION.md](SLACK_INTEGRATION_MIGRATION.md))
- ✅ **Email Service** - Configured Resend API for approval/rejection emails ([emailService.ts](services/emailService.ts))
- ✅ **Contact Email** - Standardized on `pipevault@mpsgroup.ca` across all touchpoints
- ✅ **Authentication Modernization** - Removed 442-line WelcomeScreen component and dual authentication system
- ✅ **Structured User Metadata** - Split full name into first/last name fields with automatic form pre-fill
- ✅ **Tile-Based Dashboard** - Permanent Roughneck AI tile with live weather integration
- ✅ **Enhanced Request Cards** - Thread type display and metric-first quantity formatting
- Admin approvals now surface full pipe specifications, support persistent internal notes, and persist approver/timestamp metadata for the All Requests ledger.
- Customer request wizard now presents casing OD and wt selections in metric-first formatting (mm, kg/m) with imperial references retained in brackets.

### Pending (Requires User Action)
1. **Database Schema Update** - Run [supabase/APPLY_ARCHIVE_COLUMN.sql](supabase/APPLY_ARCHIVE_COLUMN.sql) in Supabase SQL Editor to add `archived_at` column
2. **Approval Metadata Columns** - Run [supabase/APPLY_APPROVER_METADATA.sql](supabase/APPLY_APPROVER_METADATA.sql) in Supabase SQL Editor so `storage_requests` stores approver email and internal notes.
3. **Slack Webhook Configuration** - ⚙️ **IN PROGRESS**: Slack app created and webhook URL configured. Complete setup by:
   - Running SQL trigger for user signups: `CREATE EXTENSION pg_net;` then execute `notify_slack_new_user()` function from [supabase/SETUP_SLACK_WEBHOOKS_COMPLETE.sql](supabase/SETUP_SLACK_WEBHOOKS_COMPLETE.sql)
   - Creating 3 Supabase Dashboard webhooks for storage requests, deliveries, and pickups using payload templates from the SQL file
   - Testing each webhook by triggering the corresponding event
4. **Domain Verification** - Add DNS records (SPF, DKIM, DMARC) for `mpsgroup.ca` in Resend dashboard to enable production email delivery
5. **API Key Rotation** - Rotate `VITE_RESEND_API_KEY` before production launch (current key shared for development)

### Pending (Development Work)
1. **Delivery Scheduling** - Replace placeholder cards with forms that write to `truck_loads` table for scheduling deliveries to MPS and worksite
2. **Inventory Sync** - Automate inventory record creation when admins approve storage requests (currently manual)
3. **Session Routing** - Decide whether to show dedicated `Dashboard` view immediately after login or keep current flow
4. **Automated Tests** - Add unit/UI test coverage:
   - Summary calculation logic ([RequestSummaryPanel.tsx](components/RequestSummaryPanel.tsx))
   - Rack assignment logic ([AdminDashboard.tsx](components/admin/AdminDashboard.tsx))
   - Cache invalidation behavior ([AuthContext.tsx](lib/AuthContext.tsx))
   - Archive/restore mutations ([useSupabaseData.ts](hooks/useSupabaseData.ts))
5. **Production Hardening** - Replace temporary admin email allowlist ([AuthContext.tsx:96-100](lib/AuthContext.tsx#L96-L100)) with:
   - Custom JWT claims (`app_metadata.role === 'admin'`), OR
   - Strict `admin_users` table membership check only
6. **Notifications UX** - Surface content from `notifications` table via:
   - In-app notification inbox component
   - Toast notification system for real-time alerts
   - Badge counter for unread notifications

## Deployment Notes
- GitHub Pages hosts the static bundle. Run `npm run build`, commit, then push to trigger `.github/workflows/`.
- Configure the same `VITE_*` variables on the hosting service to match production Supabase and Gemini keys.
- Post-deploy smoke test: customer login, new submission, admin approval, multi-request summary swipe, Roughneck responses.

## Support & Contact
- **Product Owner**: Kyle Gronning (MPS Group)
- **Supabase Project**: `your_supabase_project_id`
- **AI Vendor**: Google Gemini (Flash 2.5)

See `CHECKLISTS.md` for SOPs. For help or hand-off questions, reach out via the internal Slack channel or email `pipevault@mpsgroup.ca`.
