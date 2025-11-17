# Troubleshooting Guide
**Quick problem → solution reference for common PipeVault issues**

**Last Updated:** 2025-11-16
**Target Audience:** Developers, Support, DevOps

---

## 🔍 Quick Problem Finder

| Symptom | Likely Cause | Jump to |
|---------|--------------|---------|
| "Can't log in" | RLS policy or admin_users | [Auth Issues](#authentication-issues) |
| "Data from wrong user showing" | Cache invalidation | [Cache Issues](#cache--state-management) |
| "Emails not sending" | Resend API key or domain | [Email Issues](#email-notifications) |
| "Slack notifications not working" | Webhook URL or trigger | [Slack Issues](#slack-notifications) |
| "Build failing" | TypeScript error or migration | [Build Issues](#build--deployment) |
| "AI chat not responding" | Gemini API key or rate limit | [AI Issues](#ai-services) |
| "Manifest extraction failed" | File format or API limit | [AI Issues](#ai-services) |
| "Database error on insert" | RLS policy or constraint | [Database Issues](#database--migrations) |
| "Mobile layout broken" | Responsive classes missing | [UI Issues](#ui--responsive-design) |

---

## 🔐 Authentication Issues

### Problem: User Can't Log In (Email Verified but Access Denied)

**Symptoms:**
- Email verified successfully
- Login form accepts credentials
- Redirects back to login immediately
- No error message

**Root Cause:** Row-Level Security (RLS) policy blocking access

**Solution:**
```sql
-- Check if user exists in admin_users (for admin access):
SELECT * FROM admin_users WHERE email = 'user@example.com';

-- If not found and user should be admin, add them:
INSERT INTO admin_users (email) VALUES ('user@example.com');

-- For customers, check company_id matches email domain:
SELECT * FROM companies WHERE domain = 'example.com';

-- If company doesn't exist, create it:
INSERT INTO companies (name, domain, email, phone_number)
VALUES ('Example Company', 'example.com', 'contact@example.com', '555-1234');
```

**Prevention:** Always create company record before customer signup

**Related:** [Auth Setup](docs/setup/DATABASE_SETUP.md#admin-users)

---

### Problem: Admin User Can't See Admin Dashboard

**Symptoms:**
- User logs in successfully
- Sees customer dashboard instead of admin dashboard
- No admin tabs visible

**Root Cause:** Email not in `admin_users` table OR temporary allowlist

**Solution:**
```typescript
// Option 1: Add to admin_users table (RECOMMENDED)
-- Run in Supabase SQL Editor:
INSERT INTO admin_users (email) VALUES ('admin@mpsgroup.ca');

// Option 2: Temporary allowlist (AuthContext.tsx:96-100)
// Add email to adminEmails array (ONLY for testing)
const adminEmails = [
  'kyle@mpsgroup.ca',
  'your-admin@mpsgroup.ca', // Add here
];
```

**Best Practice:** Use `admin_users` table, not hard-coded list

**Related:** [RLS Policies](docs/architecture/DATABASE_SCHEMA.md#row-level-security)

---

### Problem: "Email Not Confirmed" Error

**Symptoms:**
- User signs up
- Tries to log in immediately
- Error: "Email address not confirmed"

**Root Cause:** User didn't click confirmation link in email

**Solution:**
1. Check spam folder for confirmation email
2. Resend confirmation:
   ```typescript
   const { error } = await supabase.auth.resend({
     type: 'signup',
     email: 'user@example.com'
   });
   ```
3. For testing, manually confirm in Supabase dashboard:
   - Authentication → Users → Find user → ... → Confirm Email

**Prevention:** Add "Check your email" message after signup

---

## 💾 Cache & State Management

### Problem: Stale Data After Login/Logout

**Symptoms:**
- Switch accounts (customer → admin or vice versa)
- Old user's data still showing
- Persists until page refresh or dev server restart

**Root Cause:** React Query cache not cleared on auth state change

**Solution (Already Implemented):**
Check `lib/AuthContext.tsx:73-81` for cache invalidation:
```typescript
if (event === 'SIGNED_OUT' || (newUserId && previousUserId && newUserId !== previousUserId)) {
  queryClient.clear(); // Should be present
}
```

**If still occurring:**
1. Check browser console for cache clear log
2. Hard refresh: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)
3. Clear browser storage: DevTools → Application → Clear Storage

**Related:** [Cache Fix](CACHE_INVALIDATION_FIX.md)

---

### Problem: Real-Time Updates Not Working

**Symptoms:**
- Admin A approves request
- Admin B doesn't see update (must refresh)
- Multi-admin collaboration broken

**Root Cause:** Supabase Realtime not subscribed or RLS blocking

**Solution:**
```typescript
// Check if useRealtimeUpdates is called (AdminDashboard.tsx:136):
useRealtimeUpdates({ enabled: true, debug: false });

// Enable debug mode to see subscription logs:
useRealtimeUpdates({ enabled: true, debug: true });

// Check browser console for:
// - "Subscribed to realtime updates"
// - "Realtime change detected: [table]"

// If not seeing logs, check RLS policy allows SELECT:
SELECT * FROM storage_requests; -- Should work for admins
```

**Related:** [Realtime Features](docs/DATA_INTEGRITY_AND_REALTIME_FEATURES.md)

---

## 📧 Email Notifications

### Problem: Approval/Rejection Emails Not Sending

**Symptoms:**
- Admin approves/rejects request
- Success message appears
- Customer never receives email

**Root Cause:** Missing or invalid Resend API key

**Solution:**
```bash
# Check .env file:
VITE_RESEND_API_KEY=re_YOUR_KEY_HERE

# Key should start with "re_" and be 32+ characters
# Invalid examples:
VITE_RESEND_API_KEY=your_resend_key_here  # ❌ Placeholder
VITE_RESEND_API_KEY=                      # ❌ Empty

# Valid example:
VITE_RESEND_API_KEY=re_99TDdtXH_5EUoLuQY8jCGUW7cq9zXhx2K  # ✅
```

**Check email service logic (services/emailService.ts:30-34):**
```typescript
const isDevelopment = import.meta.env.MODE === 'development';
const isValidApiKey = apiKey && !apiKey.includes('your_') && apiKey.startsWith('re_');

if (isDevelopment || !isValidApiKey) {
  console.log('📧 [DEV MODE] Email would be sent:', { to, subject });
  return; // Email logged but not sent
}
```

**Development Mode Behavior:**
- Logs email to console
- Does NOT actually send
- Use `npm run preview` to test production mode

**Related:** [Email Setup](docs/setup/NOTIFICATIONS_SETUP.md#resend-email)

---

### Problem: Emails Going to Spam

**Symptoms:**
- Emails sending successfully
- Not appearing in inbox
- Found in spam folder

**Root Cause:** Domain not verified (SPF, DKIM, DMARC records missing)

**Solution:**
1. Log into Resend dashboard
2. Go to Domains → mpsgroup.ca
3. Add DNS records provided by Resend:
   ```
   TXT  @  "v=spf1 include:_spf.resend.com ~all"
   TXT  resend._domainkey  "v=DKIM1; k=rsa; p=[key]"
   TXT  _dmarc  "v=DMARC1; p=none; ..."
   ```
4. Wait 24-48 hours for DNS propagation
5. Verify in Resend dashboard

**Temporary Workaround:** Use resend.dev domain (less professional)

**Related:** [Domain Verification](docs/setup/NOTIFICATIONS_SETUP.md#domain-verification)

---

## 💬 Slack Notifications

### Problem: Slack Notifications Not Appearing

**Symptoms:**
- Customer submits storage request
- No notification in Slack channel
- Database INSERT succeeds

**Root Cause:** Webhook URL incorrect or trigger not firing

**Solution:**
```sql
-- Check if trigger exists:
SELECT * FROM pg_trigger WHERE tgname = 'on_storage_request_created';

-- Check if webhook is configured in Supabase:
-- Dashboard → Database → Webhooks → Check "slack-new-storage-request"

-- Test webhook manually:
SELECT net.http_post(
  url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'slack_webhook_url'),
  headers := '{"Content-Type": "application/json"}'::jsonb,
  body := '{"text": "Test notification"}'::jsonb
);

-- If error "no rows returned", webhook URL not in vault:
INSERT INTO vault.secrets (name, secret)
VALUES ('slack_webhook_url', 'https://hooks.slack.com/services/YOUR/WEBHOOK/URL');
```

**Common Mistakes:**
- ❌ Webhook URL has typo
- ❌ Trigger created but not enabled
- ❌ RLS policy blocking trigger execution
- ❌ Slack app permissions insufficient

**Related:** [Slack Setup](docs/setup/NOTIFICATIONS_SETUP.md#slack-webhooks)

---

## 🤖 AI Services

### Problem: Roughneck AI Not Responding

**Symptoms:**
- Click "Ask Roughneck"
- Chat interface opens
- Type message and submit
- Loading spinner forever
- No response

**Root Cause:** Gemini API key missing or rate limit exceeded

**Solution:**
```bash
# Check .env file:
VITE_GOOGLE_AI_API_KEY=AIza...YOUR_KEY_HERE

# Key should start with "AIza" and be 39 characters

# Test API key:
curl -X POST \
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=YOUR_KEY' \
  -H 'Content-Type: application/json' \
  -d '{"contents": [{"parts": [{"text": "test"}]}]}'

# If rate limited:
{
  "error": {
    "code": 429,
    "message": "Resource has been exhausted (e.g. check quota)."
  }
}
```

**Rate Limit Fix:**
- Free tier: 15 requests/minute, 1500/day
- Wait 60 seconds or upgrade to paid tier
- Check usage: https://makersuite.google.com/app/apikey

**Fallback Behavior:**
If API key missing, uses canned responses (services/geminiService.ts:20-40)

**Related:** [AI Setup](docs/setup/AI_SETUP.md#gemini-api)

---

### Problem: Manifest Extraction Fails

**Symptoms:**
- Upload PDF manifest
- Processing spinner shows
- Error: "Failed to extract manifest data"
- Document uploaded but no extracted data

**Root Cause:** File format unsupported, too large, or API error

**Solution:**
1. **Check file format:**
   - ✅ PDF, PNG, JPG, JPEG
   - ❌ TIFF, BMP, GIF (not supported)

2. **Check file size:**
   - Max: 20 MB
   - If larger, compress PDF or reduce image quality

3. **Check file content:**
   - Must be readable (not scanned image)
   - Text should be selectable in PDF
   - If scanned image, use OCR first

4. **Check browser console:**
   ```typescript
   // Look for error message:
   "Gemini API error: [specific error]"
   ```

5. **Retry with debug mode:**
   ```typescript
   // In services/manifestProcessingService.ts, enable debug:
   console.log('Sending to Gemini:', { file, prompt });
   ```

**Known Issues:**
- Handwritten manifests: 70% accuracy (AI struggles with handwriting)
- Multi-column tables: Sometimes extracts out of order
- Faded/poor quality scans: OCR fails

**Workaround:** Manual entry via "Skip Documents" option

**Related:** [AI Features](docs/reference/AI_REFERENCE.md#manifest-extraction)

---

## 🗄️ Database & Migrations

### Problem: "row violates row-level security policy"

**Symptoms:**
- Try to INSERT or UPDATE data
- PostgreSQL error: "new row violates row-level security policy for table [table]"
- Works for admin, fails for customer (or vice versa)

**Root Cause:** RLS policy blocking the operation

**Solution:**
```sql
-- Check which policy is blocking (run in Supabase SQL Editor):
-- For customers:
SET request.jwt.claim.email = 'customer@example.com';
INSERT INTO storage_requests (company_name, ...) VALUES (...);
-- If error, policy is blocking

-- For admins:
SET request.jwt.claim.email = 'admin@mpsgroup.ca';
INSERT INTO storage_requests (...) VALUES (...);
-- Should work for admin

-- Find blocking policy:
SELECT * FROM pg_policies WHERE tablename = 'storage_requests';

-- Check policy definition:
\d+ storage_requests
```

**Common Fixes:**
1. **Customer can't see their data:**
   - Check company_id matches user's email domain
   - Check user_email lowercase match

2. **Admin can't update:**
   - Add email to admin_users table
   - Check RLS policy includes admin check

**Related:** [RLS Policies](docs/architecture/DATABASE_SCHEMA.md#row-level-security)

---

### Problem: Migration Fails with "column already exists"

**Symptoms:**
- Run migration in Supabase SQL Editor
- Error: "column [column] of relation [table] already exists"
- Migration was run before

**Root Cause:** Migration run multiple times (not idempotent)

**Solution:**
```sql
-- Check if migration already applied:
SELECT * FROM supabase_migrations.schema_migrations
WHERE version = '20251113000003';

-- If exists, skip this migration

-- Fix migration to be idempotent:
ALTER TABLE storage_requests
ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ; -- Add "IF NOT EXISTS"

-- Or drop column first:
ALTER TABLE storage_requests DROP COLUMN IF EXISTS archived_at;
ALTER TABLE storage_requests ADD COLUMN archived_at TIMESTAMPTZ;
```

**Best Practice:** Always use `IF NOT EXISTS` / `IF EXISTS` in migrations

**Related:** [Migration Guide](docs/guides/MIGRATION_GUIDE.md)

---

### Problem: Database Schema Drift (Types Don't Match)

**Symptoms:**
- TypeScript type error: "Property [X] does not exist on type [Y]"
- Database has column, but TypeScript types don't
- Recently ran migration but types not updated

**Root Cause:** `database.types.ts` out of sync with schema

**Solution:**
```bash
# Option 1: Supabase CLI (recommended)
npx supabase gen types typescript --project-id YOUR_PROJECT_ID > lib/database.types.ts

# Option 2: Manual update
# Edit lib/database.types.ts and add missing column to interface

# Restart dev server:
npm run dev
```

**Prevention:** Run type generation after every migration

**Related:** [Database Setup](docs/setup/DATABASE_SETUP.md#type-generation)

---

## 🚀 Build & Deployment

### Problem: Build Fails with TypeScript Error

**Symptoms:**
- Run `npm run build`
- Error: "Type [X] is not assignable to type [Y]"
- Dev server works fine (`npm run dev`)

**Root Cause:** Vite dev server is more lenient than production build

**Solution:**
```bash
# Run TypeScript check explicitly:
npx tsc --noEmit

# Fix all errors shown
# Common issues:
# - Missing null checks: value.property → value?.property
# - Wrong types: string → string | null
# - Missing imports: import type { ... } from '...'

# After fixes, verify build:
npm run build

# If build succeeds, test locally:
npm run preview
```

**Prevention:** Run `npx tsc --noEmit` before committing

**Related:** [Deployment](docs/guides/DEPLOYMENT.md)

---

### Problem: GitHub Pages Deployment 404

**Symptoms:**
- Deploy to GitHub Pages
- Homepage loads
- Navigate to route: 404
- Refresh page: 404

**Root Cause:** GitHub Pages doesn't support SPA routing

**Solution:**
Create `public/404.html`:
```html
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <title>PipeVault</title>
    <script>
      // SPA redirect
      sessionStorage.redirect = location.href;
      location.replace(location.origin);
    </script>
  </head>
  <body></body>
</html>
```

Update `index.html`:
```html
<script>
  const redirect = sessionStorage.redirect;
  delete sessionStorage.redirect;
  if (redirect && redirect !== location.href) {
    history.replaceState(null, null, redirect);
  }
</script>
```

**Alternative:** Use HashRouter instead of BrowserRouter

**Related:** [GitHub Pages Setup](docs/guides/DEPLOYMENT.md#github-pages)

---

### Problem: Environment Variables Not Working in Production

**Symptoms:**
- `import.meta.env.VITE_SUPABASE_URL` is `undefined`
- Works locally, fails in production
- Features dependent on env vars broken

**Root Cause:** Env vars not set in GitHub Secrets or wrong naming

**Solution:**
```bash
# GitHub Secrets must match .env naming:
# In GitHub repo → Settings → Secrets → Actions:

# ✅ Correct naming:
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
VITE_GOOGLE_AI_API_KEY

# ❌ Wrong naming (won't work):
SUPABASE_URL  # Missing VITE_ prefix
VITE_GEMINI_KEY  # Wrong variable name

# Check GitHub Actions workflow (.github/workflows/deploy.yml):
env:
  VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
  # etc...
```

**Debugging:** Add console.log in built app:
```typescript
console.log('Env vars:', {
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
  // Will show in browser console after deploy
});
```

**Related:** [Deployment](docs/guides/DEPLOYMENT.md#environment-variables)

---

## 🎨 UI & Responsive Design

### Problem: Layout Broken on Mobile

**Symptoms:**
- Desktop looks perfect
- Mobile (iPhone/Android): elements overlap, text cut off, buttons off-screen
- Horizontal scroll appears

**Root Cause:** Missing responsive classes or fixed widths

**Solution:**
```tsx
// ❌ BAD: Fixed width
<div className="w-96 px-4">

// ✅ GOOD: Responsive width
<div className="w-full sm:w-96 px-4 sm:px-6">

// ❌ BAD: Always horizontal
<div className="flex flex-row gap-4">

// ✅ GOOD: Stack on mobile
<div className="flex flex-col sm:flex-row gap-4">

// ❌ BAD: Small touch target
<button className="px-2 py-1">

// ✅ GOOD: 44px minimum (mobile)
<button className="px-6 py-3 sm:px-4 sm:py-2">
```

**Test on Real Devices:**
- iPhone SE (375px width - smallest modern iPhone)
- Chrome DevTools → Toggle device toolbar
- Test landscape orientation too

**Related:** [Mobile Optimization](docs/MOBILE_OPTIMIZATION_PLAN.md)

---

### Problem: Admin Dashboard Tabs Wrapping on Mobile

**Symptoms:**
- 12 tabs in admin dashboard
- Mobile: tabs wrap into 3-4 rows
- Takes up 200px vertical space
- Hard to tap accurately

**Root Cause:** Horizontal layout designed for desktop

**Solution (In Progress):**
See [Mobile Optimization Plan](docs/MOBILE_OPTIMIZATION_PLAN.md) for bottom navigation implementation.

**Temporary Workaround:**
```tsx
// Make tabs scrollable on mobile:
<div className="flex gap-2 overflow-x-auto pb-2">
  {tabs.map(tab => (
    <button className="flex-shrink-0 px-4 py-2 ...">
      {tab.label}
    </button>
  ))}
</div>
```

---

## 🔧 Miscellaneous

### Problem: React "Hydration Error"

**Symptoms:**
- Console warning: "Hydration failed because the initial UI does not match what was rendered on the server"
- Content flashes/jumps on page load
- Inconsistent rendering

**Root Cause:** Server-rendered HTML doesn't match client-rendered React

**Solution:**
```tsx
// ❌ BAD: Date.now() or Math.random() in render
<div>{Date.now()}</div> // Different on each render

// ✅ GOOD: Use useEffect for client-only values
const [timestamp, setTimestamp] = useState<number | null>(null);
useEffect(() => {
  setTimestamp(Date.now());
}, []);

// Or use suppressHydrationWarning for intentional mismatches:
<time suppressHydrationWarning>{new Date().toISOString()}</time>
```

**Related:** React 19 hydration improvements

---

### Problem: "Cannot read property 'X' of undefined"

**Symptoms:**
- Console error: "Cannot read property 'status' of undefined"
- Component renders blank or crashes
- Happens intermittently

**Root Cause:** Data not loaded yet or null value

**Solution:**
```tsx
// ❌ BAD: Assumes data always exists
<div>{request.status}</div>

// ✅ GOOD: Optional chaining + fallback
<div>{request?.status ?? 'PENDING'}</div>

// ✅ BETTER: Early return
if (!request) {
  return <Spinner />;
}
return <div>{request.status}</div>;

// ✅ BEST: TypeScript null check
if (!request) {
  return <div>Loading...</div>;
}
const status: RequestStatus = request.status; // Type-safe
```

---

## 📞 Getting Help

### Before Asking for Help

**Check these first:**
1. Search this TROUBLESHOOTING.md file (Ctrl+F)
2. Check [CHANGELOG.md](CHANGELOG.md) for recent changes
3. Check browser console for error messages
4. Try incognito mode (rules out extension conflicts)
5. Hard refresh: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)

### Where to Ask

**GitHub Issues:**
- Bug reports: Use "bug" label
- Feature requests: Use "enhancement" label
- Security issues: Email privately, don't post publicly

**Slack Channels:**
- #dev-help: General development questions
- #bugs: Urgent production issues
- #database: Schema/RLS/migration questions
- #deployments: CI/CD and environment issues

**Email:**
- pipevault@mpsgroup.ca: General support
- kyle@mpsgroup.ca: Urgent production issues

### How to Report a Bug

**Good Bug Report:**
```markdown
**Environment:**
- Browser: Chrome 120 (Windows 11)
- User role: Admin
- Environment: Production (pipevault.mpsgroup.ca)

**Steps to Reproduce:**
1. Log in as admin
2. Navigate to Approvals tab
3. Click "Approve" on request ID REF-123
4. Error appears

**Expected Behavior:**
Request should be approved and email sent

**Actual Behavior:**
Error: "Failed to approve request"
Console shows: [paste error]

**Screenshots:**
[attach screenshot of error]

**Additional Context:**
- Happens for all requests
- Started after deploy on 2025-11-15
- Works fine in staging
```

**Bad Bug Report:**
```markdown
The app is broken, please fix.
```

---

## 🔄 Recently Fixed Issues

### Week of 2025-11-13
- ✅ Load Detail Modal blank screen → CompanyDetailModal state conflict ([CRITICAL_FIXES_LOAD_DETAIL_MODAL_2025-11-13.md](docs/CRITICAL_FIXES_LOAD_DETAIL_MODAL_2025-11-13.md))
- ✅ Ghost tiles after admin deletion → Optimistic update race condition ([GHOST_TILES_ELIMINATION_GUIDE.md](docs/GHOST_TILES_ELIMINATION_GUIDE.md))
- ✅ Manual rack adjustment → Added audit trail ([MANUAL_RACK_ADJUSTMENT_DEPLOYMENT.md](MANUAL_RACK_ADJUSTMENT_DEPLOYMENT.md))

### Week of 2025-11-09
- ✅ In-Transit tab tile issues → Status filtering and state sync ([IN_TRANSIT_TAB_FIXES.md](docs/IN_TRANSIT_TAB_FIXES.md))
- ✅ AI manifest display → Summary cards and data quality indicators ([AI_MANIFEST_DISPLAY_SUMMARY.md](AI_MANIFEST_DISPLAY_SUMMARY.md))
- ✅ Atomic approval transactions → Race condition in rack assignment ([ATOMIC_APPROVAL_DEPLOYMENT.md](docs/ATOMIC_APPROVAL_DEPLOYMENT.md))

See [CHANGELOG.md](CHANGELOG.md) for full history.

---

**Maintained By:** Development Team + AI Agents
**Last Updated:** 2025-11-16
**Next Review:** 2025-12-01
