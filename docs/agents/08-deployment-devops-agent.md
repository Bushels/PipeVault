# Deployment & DevOps Agent Playbook

## Identity
- **Agent Name**: Deployment & DevOps Agent
- **Primary Role**: Manage deployments, build process, environment configuration, monitoring
- **Domain**: CI/CD, GitHub Actions, Vite builds, Supabase migrations, environment management
- **Priority**: Critical (production availability)

---

## Responsibilities

### Core Duties
1. **Build Process Management**
   - Configure Vite build for production
   - Optimize bundle size and performance
   - Manage environment variables at build time
   - Generate source maps for debugging

2. **Deployment Automation**
   - GitHub Actions workflow for CI/CD
   - Automated deployment to GitHub Pages
   - Supabase migration deployment
   - Edge function deployment

3. **Environment Configuration**
   - Manage .env files for dev/staging/prod
   - Secure API key storage (GitHub Secrets)
   - Supabase project configuration
   - Domain and DNS setup

4. **Database Migrations**
   - Apply SQL migrations to Supabase
   - Rollback procedures for failed migrations
   - Test migrations on staging first
   - Document migration dependencies

5. **Monitoring & Logging**
   - Track build failures
   - Monitor production errors (console logs)
   - Supabase dashboard metrics
   - Uptime monitoring

6. **Performance Optimization**
   - Code splitting and lazy loading
   - Asset optimization (images, fonts)
   - CDN configuration
   - Caching strategies

---

## Build Configuration

### Vite Configuration
**File**: `vite.config.ts`

```typescript
import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');

    // Use base path for GitHub Pages or Wix embedding
    // Set VITE_GITHUB_PAGES=true when building for GitHub Pages
    const isGitHubPages = env.VITE_GITHUB_PAGES === 'true';
    const base = isGitHubPages ? '/PipeVault/' : '/';

    return {
      base,
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      build: {
        // Generate relative paths for better portability
        assetsDir: 'assets',
        // Optimize for embedding - using esbuild (faster and built-in)
        minify: 'esbuild',
        sourcemap: false,
      }
    };
});
```

**Key Settings**:
- **base**: `/PipeVault/` for GitHub Pages, `/` for custom domain
- **minify**: `esbuild` (faster than terser)
- **sourcemap**: `false` in production (security)
- **assetsDir**: `assets` for organized output

---

### Package.json Scripts
**File**: `package.json`

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "deploy": "npm run build && echo 'Built successfully! Push to GitHub to deploy.'"
  }
}
```

**Usage**:
- `npm run dev` - Start dev server on localhost:3000
- `npm run build` - Production build to `dist/`
- `npm run preview` - Preview production build locally
- `npm run deploy` - Build + reminder to push to GitHub

---

## CI/CD Pipeline

### GitHub Actions Workflow
**File**: `.github/workflows/deploy.yml`

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [ main ]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: "pages"
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build
        run: npm run build
        env:
          # This tells Vite to use correct base path for GitHub Pages
          VITE_GITHUB_PAGES: 'true'
          # Environment variables for runtime (embedded in build)
          VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
          VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY }}
          VITE_ANTHROPIC_API_KEY: ${{ secrets.VITE_ANTHROPIC_API_KEY }}
          VITE_GOOGLE_AI_API_KEY: ${{ secrets.VITE_GOOGLE_AI_API_KEY }}

      - name: Setup Pages
        uses: actions/configure-pages@v4

      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: './dist'

  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    needs: build

    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

**Triggers**:
- Push to `main` branch (automatic)
- Manual workflow dispatch (via GitHub UI)

**Steps**:
1. Checkout code
2. Setup Node.js 18 with npm cache
3. Install dependencies (`npm ci` for reproducible builds)
4. Build with production env vars (from GitHub Secrets)
5. Configure GitHub Pages
6. Upload build artifact
7. Deploy to GitHub Pages

**Environment Variables**:
- Stored in GitHub repo Settings → Secrets and variables → Actions
- Injected at build time (not runtime)
- Embedded in JavaScript bundle

---

## Environment Management

### Local Development (.env)
**File**: `.env` (not committed to git)

```bash
# Supabase Configuration
VITE_SUPABASE_URL=https://yourproject.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here

# AI Configuration
VITE_GOOGLE_AI_API_KEY=your_gemini_key_here
VITE_ANTHROPIC_API_KEY=your_claude_key_here

# Email Configuration
VITE_RESEND_API_KEY=your_resend_key_here

# Weather Configuration
VITE_TOMORROW_API_KEY=your_tomorrow_io_key_here

# GitHub Pages (for local testing)
VITE_GITHUB_PAGES=false
```

**Security**:
- Never commit `.env` to git (in `.gitignore`)
- Use `.env.example` as template
- Rotate keys if accidentally exposed

---

### Production (GitHub Secrets)
**Location**: GitHub repo → Settings → Secrets and variables → Actions

**Required Secrets**:
1. `VITE_SUPABASE_URL` - Supabase project URL
2. `VITE_SUPABASE_ANON_KEY` - Supabase anonymous key
3. `VITE_GOOGLE_AI_API_KEY` - Gemini API key
4. `VITE_ANTHROPIC_API_KEY` - Claude API key (optional)
5. `VITE_RESEND_API_KEY` - Resend email API key
6. `VITE_TOMORROW_API_KEY` - Tomorrow.io weather API key

**Setting Secrets**:
1. Go to repo Settings → Secrets and variables → Actions
2. Click "New repository secret"
3. Name: `VITE_SUPABASE_URL`, Value: `https://yourproject.supabase.co`
4. Repeat for each secret
5. Trigger redeploy to apply changes

---

## Database Migrations

### Migration Workflow
1. **Create Migration** - Write SQL in `supabase/` directory
2. **Test Locally** - Run on local Supabase instance (if available)
3. **Peer Review** - Have another dev review SQL
4. **Apply to Staging** - Test on staging environment first
5. **Apply to Production** - Run during maintenance window
6. **Verify** - Check data integrity, run verification queries
7. **Document** - Update CHANGELOG.md

### Migration Execution Guide
**File**: `supabase/MIGRATION_EXECUTION_GUIDE.md`

**Steps to Apply Migration**:
1. Log in to Supabase dashboard
2. Go to SQL Editor
3. Open migration file (e.g., `RESTORE_SLACK_NOTIFICATIONS.sql`)
4. Review SQL carefully
5. Click "Run" (or F5)
6. Check for errors in output
7. Run verification queries (if provided)
8. Test affected features

**Example Migration** (RESTORE_SLACK_NOTIFICATIONS.sql):
```sql
-- Step 1: Restore function
CREATE OR REPLACE FUNCTION public.notify_slack_storage_request() ...

-- Step 2: Create trigger
CREATE TRIGGER on_storage_request_insert ...

-- Step 3: Verify
SELECT * FROM pg_trigger WHERE tgname = 'on_storage_request_insert';
```

### Rollback Procedures
1. **Identify Failed Migration** - Check error message
2. **Assess Impact** - What broke? Data loss? Schema change?
3. **Create Rollback Script** - Reverse the migration (DROP, ALTER)
4. **Test Rollback** - On staging first
5. **Apply Rollback** - Run in production
6. **Verify** - Ensure system restored
7. **Document Incident** - What went wrong, how to prevent

**Rollback Example**:
```sql
-- Rollback for RESTORE_SLACK_NOTIFICATIONS.sql
DROP TRIGGER IF EXISTS on_storage_request_insert ON storage_requests;
DROP FUNCTION IF EXISTS public.notify_slack_storage_request();
```

---

### Recent Migrations
**Source**: CHANGELOG.md, supabase/ directory

1. **RESTORE_SLACK_NOTIFICATIONS.sql** (Nov 5, 2025)
   - Restored Slack notification trigger and function
   - Fixed: Notifications not firing on new requests

2. **FIX_ALL_RACK_CAPACITIES.sql** (Nov 5, 2025)
   - Updated all racks from capacity=1 to capacity=100
   - Fixed: Yard showing "1 pipe free" instead of proper capacity

3. **FIX_ADMIN_SCHEMA.sql** (Oct 30, 2025)
   - Fixed admin_users table schema issues

4. **SETUP_SHIPPING_WORKFLOW.sql** (Nov 5, 2025)
   - Set up trucking loads and shipment tables

---

## Edge Function Deployment

### Deploy Edge Function
**Command**:
```bash
supabase functions deploy fetch-realtime-weather
```

**Prerequisites**:
- Supabase CLI installed (`npm install -g supabase`)
- Logged in to Supabase (`supabase login`)
- Linked to project (`supabase link --project-ref your-project-ref`)

### Edge Function Structure
**Directory**: `supabase/functions/fetch-realtime-weather/`

```
fetch-realtime-weather/
├── index.ts        # Main function code
└── .env.local      # Local env vars (not deployed)
```

**Environment Variables**:
- Set in Supabase dashboard (Settings → Edge Functions → Secrets)
- Access via `Deno.env.get('TOMORROW_API_KEY')`

**Deploy All Functions**:
```bash
# Deploy all functions at once
supabase functions deploy --no-verify-jwt
```

---

## Monitoring & Logging

### Build Monitoring
**GitHub Actions**:
- View workflow runs: repo → Actions tab
- Check build logs for errors
- Failed builds block deployment (good!)

**Common Build Errors**:
1. **TypeScript errors** - Fix type issues before pushing
2. **Missing dependencies** - Run `npm install` locally first
3. **Env var missing** - Check GitHub Secrets configured
4. **Bundle too large** - Optimize imports, lazy load

---

### Production Monitoring
**Browser Console**:
- Open DevTools → Console
- Look for errors (red text)
- Check network tab for failed requests

**Supabase Dashboard**:
- Database → Performance (query stats)
- Edge Functions → Logs (function errors)
- Authentication → Users (login issues)
- Storage → Buckets (document upload issues)

**Key Metrics**:
- **Page Load Time**: Target <3s
- **API Response Time**: Target <200ms (p95)
- **Error Rate**: Target <1% of requests
- **Build Time**: Target <2 minutes

---

### Error Tracking
**Current**: Browser console logs only
**Recommended**: Sentry, LogRocket, or similar

**Setup Sentry** (future):
```typescript
import * as Sentry from '@sentry/react';

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,
  tracesSampleRate: 0.1,
});
```

---

## Performance Optimization

### Bundle Size Optimization
**Current Size**: ~500KB (gzipped)
**Target**: <300KB (gzipped)

**Strategies**:
1. **Code Splitting**:
   ```typescript
   // Lazy load admin dashboard (not needed for customers)
   const AdminDashboard = lazy(() => import('./components/admin/AdminDashboard'));
   ```

2. **Tree Shaking**:
   - Use named imports (not `import * as`)
   - Remove unused dependencies

3. **Dependency Audit**:
   ```bash
   npm ls --depth=0  # List top-level dependencies
   npx depcheck      # Find unused dependencies
   ```

4. **Image Optimization**:
   - Use WebP format
   - Lazy load images below fold
   - Serve responsive images

---

### Caching Strategies
**Static Assets**:
- Vite automatically hashes filenames (`app.abc123.js`)
- Cache-Control: `max-age=31536000` (1 year)

**API Responses**:
- TanStack Query caches Supabase data
- Stale-while-revalidate pattern
- Configurable cache time per query

**Service Worker** (future):
- Offline support
- Background sync
- Push notifications

---

## Files Owned

### Build Configuration
- `vite.config.ts` - Vite build settings
- `package.json` - Dependencies and scripts
- `tsconfig.json` - TypeScript configuration
- `.gitignore` - Exclude files from git

### Deployment
- `.github/workflows/deploy.yml` - GitHub Actions workflow
- `.env.example` - Environment variable template

### Database
- `supabase/config.toml` - Supabase project config
- `supabase/schema.sql` - Main schema
- `supabase/*.sql` - Migration files
- `supabase/MIGRATION_EXECUTION_GUIDE.md` - How to apply migrations

### Documentation
- `README.md` - Setup and deployment instructions
- `CHANGELOG.md` - Version history
- `docs/agents/` - Agent playbooks (this file!)

---

## Quality Standards

### Pre-Deployment Checklist
- [ ] All TypeScript errors resolved
- [ ] Build succeeds locally (`npm run build`)
- [ ] No console errors in production build
- [ ] Environment variables set in GitHub Secrets
- [ ] Database migrations tested on staging
- [ ] Edge functions deployed and tested
- [ ] CHANGELOG.md updated
- [ ] README.md reflects current setup

### Post-Deployment Verification
- [ ] GitHub Pages site loads (check URL)
- [ ] User can log in
- [ ] User can create storage request
- [ ] Admin can approve request
- [ ] Slack notification received
- [ ] Email sent successfully
- [ ] AI features working (chatbot, manifest extraction)
- [ ] No console errors on production

---

## Common Patterns

### Deploy New Feature
```bash
# 1. Create feature branch
git checkout -b feature/new-feature

# 2. Develop and test locally
npm run dev

# 3. Build and verify
npm run build
npm run preview

# 4. Commit and push
git add .
git commit -m "feat: Add new feature"
git push origin feature/new-feature

# 5. Create PR, get review

# 6. Merge to main (triggers auto-deploy)
git checkout main
git merge feature/new-feature
git push origin main

# 7. Monitor deployment in GitHub Actions

# 8. Verify on production site
```

---

### Apply Database Migration
```bash
# 1. Create migration file
cat > supabase/ADD_NEW_COLUMN.sql << EOF
ALTER TABLE storage_requests
ADD COLUMN new_column TEXT;
EOF

# 2. Test locally (if possible)
supabase db reset --local

# 3. Review SQL with team

# 4. Log in to Supabase dashboard
# 5. Go to SQL Editor
# 6. Paste migration SQL
# 7. Run and verify

# 8. Document in CHANGELOG.md
echo "- Added new_column to storage_requests" >> CHANGELOG.md
git commit -am "chore: Document migration"
```

---

### Rollback Deployment
```bash
# Option 1: Revert commit
git revert <commit-hash>
git push origin main

# Option 2: Roll back to previous commit
git reset --hard <previous-commit-hash>
git push origin main --force

# Option 3: Redeploy previous version
# Go to GitHub Actions → Re-run workflow from earlier commit
```

---

## Collaboration & Handoffs

### Works Closely With
- **All Agents**: Deploy code changes from any agent
- **Database Integrity Agent**: Apply migrations safely
- **Integration & Events Agent**: Deploy edge functions
- **Security & Quality Agent**: Implement security configs

### Escalation Triggers
Hand off when:
- **Build failing**: Check TypeScript errors, dependencies
- **Deployment blocked**: Check GitHub Actions logs
- **Migration failed**: Database Integrity Agent (rollback)
- **Performance issue**: Optimize bundle, lazy loading
- **Secrets exposed**: Rotate keys immediately, audit logs

---

## Testing Checklist

### Build Tests
- [ ] `npm run build` succeeds locally
- [ ] No TypeScript errors
- [ ] Bundle size <500KB (gzipped)
- [ ] All env vars replaced in build
- [ ] Source maps disabled in production

### Deployment Tests
- [ ] GitHub Actions workflow passes
- [ ] Production site accessible
- [ ] All pages load correctly
- [ ] API calls work (Supabase, Gemini, etc.)
- [ ] Images and assets load

### Migration Tests
- [ ] Migration applies without errors
- [ ] Data integrity maintained
- [ ] No orphaned records
- [ ] RLS policies still work
- [ ] Rollback script tested

### Edge Function Tests
- [ ] Function deploys successfully
- [ ] Accessible via URL
- [ ] CORS headers present
- [ ] Env vars loaded correctly
- [ ] Logs visible in dashboard

---

## Common Issues & Solutions

### Issue: Build Fails with "Module not found"
**Problem**: `npm run build` fails with missing module error
**Root Cause**: Dependency not installed or import path wrong
**Solution**: Install dependency or fix import
```bash
# Check if dependency installed
npm ls <package-name>

# Install if missing
npm install <package-name>

# Fix import path
# Before: import { foo } from '../../utils/bar'
# After: import { foo } from '@/utils/bar'
```

---

### Issue: Env Vars Not Working in Production
**Problem**: Features work locally but not on GitHub Pages
**Root Cause**: Env vars not set in GitHub Secrets
**Solution**: Add secrets to GitHub
1. Go to repo Settings → Secrets and variables → Actions
2. Add missing secrets
3. Redeploy (push to main or manual workflow trigger)

---

### Issue: GitHub Pages Shows 404
**Problem**: Deployed but site shows 404 error
**Root Cause**: Incorrect base path in vite.config.ts
**Solution**: Set `VITE_GITHUB_PAGES=true` in build env
**File**: `.github/workflows/deploy.yml:38`

---

## Metrics & KPIs

### Build Performance
- **Build Time**: Target <2 minutes
- **Bundle Size**: Target <300KB (gzipped)
- **Build Success Rate**: Target >95%

### Deployment Reliability
- **Deployment Frequency**: ~5-10 per week
- **Deployment Failure Rate**: Target <5%
- **Rollback Frequency**: Target <1 per month
- **Time to Deploy**: Target <5 minutes

### Production Performance
- **Uptime**: Target 99.9%
- **Page Load Time (p95)**: Target <3s
- **Time to First Byte (TTFB)**: Target <500ms
- **Error Rate**: Target <1%

---

## Decision Records

### DR-001: GitHub Pages for Hosting
**Date**: 2025-10-24
**Decision**: Deploy to GitHub Pages instead of Vercel/Netlify
**Rationale**:
- Free for public repos
- Automatic deployment via GitHub Actions
- No vendor lock-in
- Simple setup (no third-party account)
**Alternative Considered**: Vercel (rejected due to free tier limits)

### DR-002: Vite for Build Tool
**Date**: 2025-10-24
**Decision**: Use Vite instead of Create React App
**Rationale**:
- Faster build times (esbuild vs webpack)
- Simpler configuration
- Better developer experience (instant HMR)
- Modern tooling (native ESM)
**Migration**: Already using Vite

### DR-003: Supabase Migrations via SQL Editor
**Date**: 2025-11-05
**Decision**: Apply migrations manually via Supabase SQL Editor instead of Supabase CLI
**Rationale**:
- No local Supabase instance required
- Easier for non-technical team members
- Direct control over when migrations run
- Can test on staging before production
**Trade-off**: Less automation, more manual steps

---

## Next Steps

### Short-term (This Week)
- [ ] Set up Sentry for error tracking
- [ ] Add bundle size monitoring (bundlephobia)
- [ ] Create rollback playbook (step-by-step)
- [ ] Document all GitHub Secrets

### Medium-term (This Month)
- [ ] Implement code splitting (admin dashboard)
- [ ] Add staging environment (separate Supabase project)
- [ ] Automate migration deployment (Supabase CLI)
- [ ] Set up uptime monitoring (UptimeRobot)

### Long-term (This Quarter)
- [ ] Migrate to custom domain (pipevault.mpsgroup.ca)
- [ ] Implement service worker (offline support)
- [ ] Add performance budgets (fail build if too large)
- [ ] Blue-green deployments (zero downtime)

---

**Agent Status**: ✅ Active
**Last Updated**: 2025-11-06
**Next Review**: 2025-11-13
**Primary Contact**: DevOps Team
