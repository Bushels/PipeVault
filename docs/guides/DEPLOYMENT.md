# Deployment Guide

**Complete deployment reference for PipeVault**

**Last Updated:** 2025-11-16
**Current Version:** 2.0.13

---

## Table of Contents

1. [Quick Deployment](#quick-deployment)
2. [Database Migrations](#database-migrations)
3. [Edge Functions](#edge-functions)
4. [Frontend Deployment](#frontend-deployment)
5. [Environment Configuration](#environment-configuration)
6. [Rollback Procedures](#rollback-procedures)
7. [Post-Deployment Verification](#post-deployment-verification)
8. [Troubleshooting](#troubleshooting)

---

## Quick Deployment

### Pre-Deployment Checklist

- [ ] All tests passing locally
- [ ] Database migrations tested in staging
- [ ] Environment variables configured
- [ ] Backup database before applying migrations
- [ ] Review CHANGELOG.md for breaking changes
- [ ] Notify team of deployment window

### Deployment Order

1. **Database migrations** (5-10 minutes)
2. **Edge Functions** (2-5 minutes)
3. **Frontend build** (1-2 minutes)
4. **Verification** (5 minutes)

**Total estimated time:** 15-25 minutes

---

## Database Migrations

### Migration Overview

All database migrations are in `/supabase/migrations/` directory.

**Naming convention:** `YYYYMMDDHHMMSS_description.sql`

### How to Apply Migrations

#### Option 1: Supabase Dashboard (Recommended)

1. Log into [Supabase Dashboard](https://supabase.com)
2. Navigate to **SQL Editor**
3. Copy contents of migration file
4. Paste into SQL Editor
5. Click **Run**
6. Verify success message

**Note**: Some migrations use `CONCURRENTLY` for index creation. These must be run **outside of a transaction**. Execute each statement separately.

#### Option 2: Supabase CLI

```bash
# Login
npx supabase login

# Link to your project
npx supabase link --project-ref your-project-ref

# Apply all pending migrations
npx supabase db push

# Or apply specific migration
npx supabase db push --file supabase/migrations/20251109000001_FINAL_CORRECTED.sql
```

#### Option 3: psql (Direct Connection)

```bash
# Connect to database
psql "postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres"

# Apply migration
\i supabase/migrations/20251109000001_FINAL_CORRECTED.sql
```

---

### Critical Migrations Reference

#### Migration: Add created_at Indexes

**File:** `20251107000003_add_created_at_indexes.sql`

**Impact:** Improves ORDER BY performance for admin dashboard queries

**Steps to Apply**:

These indexes use `CONCURRENTLY`, which cannot run in a transaction. Execute each statement **separately**:

```sql
-- Execute these statements ONE AT A TIME:

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_storage_requests_created_at
ON storage_requests(created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_inventory_created_at
ON inventory(created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_storage_requests_status_created_at
ON storage_requests(status, created_at DESC);

-- Cleanup duplicate indexes (also one at a time):

DROP INDEX CONCURRENTLY IF EXISTS idx_storage_requests_company_id;

DROP INDEX CONCURRENTLY IF EXISTS idx_trucking_loads_storage_request_id;
```

**Verification**:
```sql
SELECT
  schemaname,
  tablename,
  indexname
FROM pg_indexes
WHERE indexname IN (
  'idx_storage_requests_created_at',
  'idx_inventory_created_at',
  'idx_storage_requests_status_created_at'
);
```

**Expected**: 3 rows

---

#### Migration: Company Summaries Function

**File:** `20251107000004_add_company_summaries_function.sql`

**Impact:** Reduces admin dashboard load time from 5-10 seconds to 100-200ms

**Steps to Apply**:
1. Copy ENTIRE contents of migration file
2. Paste into SQL Editor
3. Click **Run**

**Verification**:
```sql
-- Check function exists
SELECT
  routine_name,
  routine_type,
  data_type
FROM information_schema.routines
WHERE routine_name = 'get_company_summaries';

-- Test the function
SELECT * FROM get_company_summaries();
```

**Expected**: One row per company with aggregated counts

---

#### Migration: CASCADE Rules

**File:** `20251107000005_add_cascade_rules.sql`

**Impact:** Improves data integrity and prevents accidental deletions

**Steps to Apply**:
1. Copy contents of migration file
2. Paste into SQL Editor
3. Click **Run**

**Verification**:
```sql
SELECT
  tc.table_name,
  tc.constraint_name,
  tc.constraint_type
FROM information_schema.table_constraints tc
WHERE tc.constraint_name IN (
  'trucking_documents_trucking_load_id_fkey',
  'trucking_loads_storage_request_id_fkey',
  'inventory_company_id_fkey'
);
```

**Expected**: 3 rows showing FOREIGN KEY constraints

---

#### Migration: Atomic Approval Workflow

**File:** `20251109000003_fix_approval_workflow_schema.sql`

**Impact:** Implements atomic approval/rejection workflow with proper transaction handling

**Critical Features**:
- Atomic approval: All or nothing (request status, rack occupancy, notifications, audit log)
- Capacity validation before approval
- Automatic notification queueing
- Admin audit trail

**Verification**:
```sql
-- Test approval function exists
SELECT routine_name
FROM information_schema.routines
WHERE routine_name = 'approve_storage_request_atomic';

-- Test rejection function exists
SELECT routine_name
FROM information_schema.routines
WHERE routine_name = 'reject_storage_request_atomic';
```

---

### Migration Performance Impact

| Migration | Table Locks | Estimated Time | Can Run During Traffic |
|-----------|-------------|----------------|------------------------|
| Index (CONCURRENTLY) | None | 5-30 seconds | ✅ Yes |
| Index (non-CONCURRENT) | Exclusive | 1-5 seconds | ❌ No |
| Function creation | None | <1 second | ✅ Yes |
| Foreign key constraints | Share | 2-10 seconds | ⚠️ Low traffic only |
| Data migrations | Exclusive | Varies | ❌ No |

---

### Migration Troubleshooting

#### "Index creation failed"

- Ensure no other migrations are running
- Check for table locks: `SELECT * FROM pg_locks WHERE NOT granted;`
- Try without `CONCURRENTLY` if necessary (will lock table briefly)

#### "Function returns no rows"

- Verify RLS policies allow admin access
- Check that you're logged in as admin user
- Run: `SELECT is_admin();` - should return `true`

#### "CASCADE rule failed"

- Check for existing data that violates constraints
- Run orphaned records check (see DATABASE_OPTIMIZATION_ANALYSIS.md)
- Fix data integrity issues before applying migration

---

## Edge Functions

### Deploy Notification Worker

The notification queue worker processes email notifications asynchronously.

**File:** `supabase/functions/process-notification-queue/index.ts`

#### Set Environment Variables

1. Go to Supabase Dashboard → **Project Settings** → **Edge Functions**
2. Add secrets:
   - `RESEND_API_KEY` = your Resend API key
   - `SLACK_WEBHOOK_URL` = your Slack webhook (optional)

#### Deploy Function

```bash
# Deploy notification worker
npx supabase functions deploy process-notification-queue

# Test manually
npx supabase functions invoke process-notification-queue
```

**Expected Response**:
```json
{
  "message": "No notifications to process",
  "processed": 0
}
```

---

### Set Up Cron Schedule

The notification worker should run every 5 minutes.

#### Enable pg_cron Extension

```sql
CREATE EXTENSION IF NOT EXISTS pg_cron;
```

#### Schedule Cron Job

```sql
SELECT cron.schedule(
  'process-notification-queue',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://<your-project-ref>.supabase.co/functions/v1/process-notification-queue',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')),
    body := '{}'::jsonb
  );
  $$
);
```

**Verify Cron Job**:
```sql
SELECT * FROM cron.job WHERE jobname = 'process-notification-queue';
```

---

## Frontend Deployment

### GitHub Pages Deployment (Automatic)

PipeVault auto-deploys to GitHub Pages on every push to `main` branch.

#### GitHub Actions Workflow

**File:** `.github/workflows/deploy.yml`

**Triggers**:
- Push to `main` branch
- Manual workflow dispatch

**Steps**:
1. Checkout code
2. Setup Node.js 20
3. Install dependencies
4. Build with `VITE_GITHUB_PAGES=true npm run build`
5. Deploy to `gh-pages` branch

#### Verify Deployment

1. Go to [GitHub Actions](https://github.com/your-org/PipeVault/actions)
2. Check latest workflow run
3. Ensure all steps passed
4. Visit deployed site: https://your-org.github.io/PipeVault/

---

### Manual Deployment

#### Build Locally

```bash
# Set GitHub Pages mode
export VITE_GITHUB_PAGES=true

# Build
npm run build

# Preview build
npm run preview
```

#### Deploy to GitHub Pages

```bash
# Install gh-pages (if not already installed)
npm install --save-dev gh-pages

# Deploy dist folder
npx gh-pages -d dist
```

---

## Environment Configuration

### Environment Variables

#### Frontend (.env)

```bash
# Supabase
VITE_SUPABASE_URL=https://[project-ref].supabase.co
VITE_SUPABASE_ANON_KEY=[your-anon-key]

# Google Gemini AI
VITE_GEMINI_API_KEY=[your-gemini-api-key]

# GitHub Pages (production only)
VITE_GITHUB_PAGES=true
```

#### Edge Functions (Supabase Dashboard)

```bash
# Resend Email API
RESEND_API_KEY=[your-resend-key]

# Slack (optional)
SLACK_WEBHOOK_URL=[your-slack-webhook]
```

#### Database Secrets (Supabase Vault)

```sql
-- Store Slack webhook in vault
INSERT INTO vault.secrets (name, secret)
VALUES ('slack_webhook_url', 'https://hooks.slack.com/services/YOUR/WEBHOOK/URL');

-- Verify
SELECT name FROM vault.secrets WHERE name = 'slack_webhook_url';
```

---

### Getting API Keys

#### Supabase

1. Go to [Supabase Dashboard](https://supabase.com)
2. Select your project
3. Go to **Settings** → **API**
4. Copy **URL** and **anon public** key

#### Google Gemini AI

1. Go to [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Create API key
3. Copy key to `.env` file

#### Resend Email

1. Go to [Resend Dashboard](https://resend.com/api-keys)
2. Create API key
3. Add to Supabase Edge Functions secrets

#### Slack Webhook (Optional)

1. Go to [Slack API](https://api.slack.com/apps)
2. Create app → **Incoming Webhooks**
3. Add to channel
4. Copy webhook URL
5. Store in Supabase Vault

---

## Rollback Procedures

### Rollback Database Migration

#### Rollback Indexes

```sql
DROP INDEX CONCURRENTLY IF EXISTS idx_storage_requests_created_at;
DROP INDEX CONCURRENTLY IF EXISTS idx_inventory_created_at;
DROP INDEX CONCURRENTLY IF EXISTS idx_storage_requests_status_created_at;

-- Restore removed indexes
CREATE INDEX CONCURRENTLY idx_storage_requests_company_id ON storage_requests(company_id);
CREATE INDEX CONCURRENTLY idx_trucking_loads_storage_request_id ON trucking_loads(storage_request_id);
```

#### Rollback Function

```sql
DROP FUNCTION IF EXISTS public.get_company_summaries();
```

#### Rollback CASCADE Rules

```sql
ALTER TABLE trucking_documents
DROP CONSTRAINT IF EXISTS trucking_documents_trucking_load_id_fkey,
ADD CONSTRAINT trucking_documents_trucking_load_id_fkey
  FOREIGN KEY (trucking_load_id)
  REFERENCES trucking_loads(id);

ALTER TABLE trucking_loads
DROP CONSTRAINT IF EXISTS trucking_loads_storage_request_id_fkey,
ADD CONSTRAINT trucking_loads_storage_request_id_fkey
  FOREIGN KEY (storage_request_id)
  REFERENCES storage_requests(id);

ALTER TABLE inventory
DROP CONSTRAINT IF EXISTS inventory_company_id_fkey,
ADD CONSTRAINT inventory_company_id_fkey
  FOREIGN KEY (company_id)
  REFERENCES companies(id);
```

---

### Rollback Frontend Deployment

#### Revert to Previous Commit

```bash
# Find previous working commit
git log --oneline

# Revert to specific commit
git revert <commit-hash>

# Push to trigger re-deployment
git push origin main
```

#### Or Manually Deploy Previous Version

```bash
# Checkout previous commit
git checkout <previous-commit-hash>

# Build and deploy
export VITE_GITHUB_PAGES=true
npm run build
npx gh-pages -d dist

# Return to main branch
git checkout main
```

---

## Post-Deployment Verification

### Database Verification

```sql
-- Check indexes created
SELECT indexname FROM pg_indexes
WHERE tablename IN ('storage_requests', 'inventory', 'trucking_loads');

-- Check functions exist
SELECT routine_name FROM information_schema.routines
WHERE routine_schema = 'public';

-- Check foreign key constraints
SELECT constraint_name, table_name
FROM information_schema.table_constraints
WHERE constraint_type = 'FOREIGN KEY';

-- Test RPC functions
SELECT * FROM get_company_summaries() LIMIT 1;
```

---

### Frontend Verification

1. **Open deployed site** in browser
2. **Check browser console** for errors
3. **Test authentication**:
   - Sign up
   - Sign in
   - Sign out
4. **Test customer workflow**:
   - Create storage request
   - Book load
   - Upload manifest
5. **Test admin workflow** (as admin):
   - View admin dashboard
   - Approve request
   - Mark load in transit
   - Mark load completed

---

### Performance Verification

```sql
-- Check query performance
SELECT
  query,
  calls,
  mean_exec_time,
  max_exec_time
FROM pg_stat_statements
WHERE query LIKE '%get_company_summaries%'
ORDER BY mean_exec_time DESC;
```

**Expected**: Mean execution time < 200ms

```sql
-- Check index usage
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read
FROM pg_stat_user_indexes
WHERE indexname LIKE '%created_at%'
ORDER BY idx_scan DESC;
```

**Expected**: `idx_scan` > 0 after dashboard loads

---

## Troubleshooting

### Database Connection Issues

**Error**: `Connection refused`

**Solution**:
1. Verify Supabase project is not paused
2. Check database credentials
3. Verify network connectivity
4. Check Supabase status page

---

### Migration Failures

**Error**: `relation already exists`

**Solution**:
```sql
-- Check if migration already applied
SELECT * FROM supabase_migrations.schema_migrations
ORDER BY version DESC
LIMIT 10;

-- If duplicate, skip migration or use IF NOT EXISTS
```

---

**Error**: `insufficient privilege`

**Solution**:
- Ensure you're using service role key for migrations
- Check RLS policies are not blocking migration
- Verify you have SUPERUSER permissions

---

### Edge Function Errors

**Error**: `Function not found`

**Solution**:
```bash
# Verify function deployed
npx supabase functions list

# Re-deploy if missing
npx supabase functions deploy process-notification-queue
```

---

**Error**: `Timeout`

**Solution**:
- Check Edge Function logs in Supabase Dashboard
- Verify Resend API key is correct
- Ensure notification_queue table has data

---

### Frontend Deployment Issues

**Error**: `Build failed`

**Solution**:
1. Check GitHub Actions logs
2. Verify all dependencies installed
3. Check TypeScript errors: `npm run type-check`
4. Verify environment variables set

---

**Error**: `Page not found (404)`

**Solution**:
1. Verify GitHub Pages is enabled
2. Check `gh-pages` branch exists
3. Verify deployment workflow completed successfully
4. Clear browser cache

---

## Deployment Timeline

**Recommended deployment window:** Low-traffic hours

### Development → Production

1. **Test in development**: `npm run dev`
2. **Run tests**: `npm run test` (if configured)
3. **Type check**: `npm run type-check`
4. **Apply migrations to staging** (if available)
5. **Test in staging**
6. **Apply migrations to production** (5-10 min)
7. **Deploy Edge Functions** (2-5 min)
8. **Deploy frontend** (auto on push to main)
9. **Verify deployment** (5 min)
10. **Monitor for 1 hour**

**Total time:** ~20-30 minutes + monitoring

---

## Success Criteria

✅ All migrations applied successfully
✅ Functions return expected data
✅ Admin dashboard loads in <1 second
✅ No errors in browser console
✅ All indexes show usage in `pg_stat_user_indexes`
✅ Edge Functions responding
✅ Notifications sending correctly
✅ Frontend deployed to GitHub Pages
✅ All tests passing

---

## Support & Monitoring

### Monitoring Tools

- **Supabase Dashboard**: Database metrics, logs, query performance
- **GitHub Actions**: Deployment history and logs
- **Browser DevTools**: Frontend errors and network requests
- **Sentry** (optional): Error tracking

### Getting Help

1. Check [TROUBLESHOOTING.md](../../TROUBLESHOOTING.md)
2. Review Supabase logs: **Logs → Postgres Logs**
3. Check GitHub Actions logs
4. Contact support: support@mpsgroup.ca

---

**Last Updated**: 2025-11-16
**Next Review**: After major feature releases
