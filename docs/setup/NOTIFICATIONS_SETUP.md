# Notifications Setup Guide

**Complete setup guide for PipeVault email and Slack notifications**

**Last Updated:** 2025-11-16
**Services:** Resend API (emails) + Slack Webhooks + Supabase Edge Functions
**Cost:** $0/month (free tier usage)

---

## Table of Contents

1. [Quick Setup](#quick-setup)
2. [Email Notifications (Resend)](#email-notifications-resend)
3. [Slack Notifications](#slack-notifications)
4. [Notification Queue Worker](#notification-queue-worker)
5. [Testing & Verification](#testing--verification)
6. [Monitoring](#monitoring)
7. [Troubleshooting](#troubleshooting)

---

## Quick Setup

### 1. Get API Keys

**Resend API (Email):**
1. Sign up at: https://resend.com
2. Create API key in dashboard
3. Free tier: 3,000 emails/month, 100 emails/day

**Slack Webhook (Optional):**
1. Go to: https://api.slack.com/apps
2. Create new app: "PipeVault Notifications"
3. Enable Incoming Webhooks
4. Add webhook to your channel (e.g., `#pipevault-notifications`)
5. Copy webhook URL

### 2. Configure Supabase Secrets

Supabase Dashboard → Settings → Edge Functions → Secrets:

```bash
# Required for emails
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxx

# Optional for Slack
slack_webhook_url=https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXX

# Optional: Custom from email
NOTIFICATION_FROM_EMAIL=notifications@yourdomain.com
```

### 3. Enable Required Extensions

```sql
-- Enable HTTP requests (for Slack)
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Enable cron jobs (for notification worker)
CREATE EXTENSION IF NOT EXISTS pg_cron;
```

### 4. Apply Database Triggers

Run these migrations in Supabase SQL Editor:

```bash
supabase/migrations/20251107000001_activate_slack_notification_trigger.sql
supabase/migrations/20251107000002_activate_new_user_slack_notification_trigger.sql
supabase/migrations/20251107000003_activate_project_complete_slack_notification_trigger.sql
```

### 5. Deploy Notification Worker

```bash
# Deploy Edge Function
npx supabase functions deploy process-notification-queue

# Set up cron schedule (see Notification Queue Worker section)
```

---

## Email Notifications (Resend)

### Overview

PipeVault sends professional emails to customers for critical status changes:
- **Approval Email:** Celebratory email showing assigned storage location
- **Rejection Email:** Professional email explaining reason for rejection
- **Sign-up Confirmation:** Default Supabase auth email for account verification

### Setup Steps

**1. Create Resend Account**
- Sign up at https://resend.com
- Free tier: 3,000 emails/month (sufficient for most usage)

**2. Generate API Key**
- Go to Resend Dashboard → API Keys
- Click "Create API Key"
- Copy the key (starts with `re_`)

**3. Add to Supabase Secrets**
```bash
# Supabase Dashboard → Settings → Edge Functions → Secrets
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxx
```

**4. Configure From Email (Optional)**

Free tier default: `onboarding@resend.dev`

To use custom domain:
1. Add domain in Resend Dashboard
2. Verify DNS records (SPF, DKIM, DMARC)
3. Set custom from email:
   ```bash
   NOTIFICATION_FROM_EMAIL=notifications@yourdomain.com
   ```

### Email Templates

**Approval Email:**
```
Subject: Storage Request Approved - REF-20251116-001

Hi [Customer Name],

Great news! Your storage request has been approved.

Request Details:
- Reference ID: REF-20251116-001
- Pipe Type: L80 Casing
- Quantity: 150 joints
- Assigned Location: Rack A-B1-05

Next Steps:
1. Schedule delivery to MPS yard
2. Contact us at 555-1234 to coordinate trucking

Thank you for choosing MPS Group!

---
Powered by PipeVault
```

**Rejection Email:**
```
Subject: Storage Request Update - REF-20251116-001

Hi [Customer Name],

We've reviewed your storage request REF-20251116-001.

Unfortunately, we're unable to accommodate this request at this time.

Reason: [Admin-provided rejection reason]

If you have questions or would like to discuss alternatives, please contact us at 555-1234.

Thank you for your understanding.

---
Powered by PipeVault
```

### Email Queue Processing

Emails are queued in the `notification_queue` table and processed by the Edge Function worker (every 5 minutes).

**Retry Logic:**
- Max 3 attempts per email
- Exponential backoff: 1s, 2s, 4s
- Failed emails logged with error message

---

## Slack Notifications

### Overview

PipeVault sends real-time alerts to Slack for operational events using Supabase Database Triggers.

**Notification Events:**
1. **New User Signup:** Customer creates account
2. **New Storage Request:** Customer submits pipe storage request
3. **Inbound Load Booking:** Customer books delivery to MPS facility
4. **Project Completion:** All pipe from project picked up from storage

### Architecture

```
Database Event → Trigger Function → pg_net HTTP POST → Slack Webhook → Channel Notification
```

**Benefits:**
- ✅ Secure: Webhook URL never exposed in client code
- ✅ Reliable: Server-side execution with automatic retries
- ✅ Guaranteed: Notifications sent even if user closes browser
- ✅ Logged: All executions visible in Supabase Dashboard

### Setup Steps

**1. Create Slack Webhook**
1. Go to: https://api.slack.com/apps
2. Create new app: "PipeVault Notifications"
3. Select your workspace
4. Enable **Incoming Webhooks**
5. Click "Add New Webhook to Workspace"
6. Select channel (e.g., `#pipevault-notifications`)
7. Copy the webhook URL

**2. Store Webhook in Supabase Vault**
```sql
-- Run in Supabase SQL Editor
INSERT INTO vault.secrets (name, secret)
VALUES ('slack_webhook_url', 'https://hooks.slack.com/services/YOUR/WEBHOOK/URL');
```

**3. Enable pg_net Extension**
```sql
CREATE EXTENSION IF NOT EXISTS pg_net;
```

**4. Apply Database Triggers**

Run these migrations:

```sql
-- Storage requests
supabase/migrations/20251107000001_activate_slack_notification_trigger.sql

-- User signups
supabase/migrations/20251107000002_activate_new_user_slack_notification_trigger.sql

-- Project completion
supabase/migrations/20251107000003_activate_project_complete_slack_notification_trigger.sql
```

These create:
- `notify_slack_new_user()` function + trigger on `auth.users`
- `notify_slack_storage_request()` function + trigger on `storage_requests`
- `notify_slack_project_complete()` function + trigger on `trucking_loads`

**5. Test Notifications**
1. **New User:** Create account → Verify Slack message
2. **Storage Request:** Submit request → Verify Slack message
3. **Load Booking:** Book delivery → Verify Slack message

Check Supabase **Database → Functions** for execution logs.

### Slack Message Examples

**New User Signup:**
```
🆕 New User Signup

👤 Name: John Doe
🏢 Company: ABC Corp
📧 Email: john@abc.com
🆔 User ID: auth-uid-12345
```

**New Storage Request:**
```
📦 New Storage Request

👤 Customer: John Doe
🏢 Company: ABC Corp
📋 Reference: REF-20251116-001
⚙️ Pipe Spec: 150 joints L80 casing, 5.5" OD
📅 Storage Dates: Nov 16 - Dec 15
📧 Contact: john@abc.com
```

**Inbound Load Booking:**
```
🚚 Inbound Delivery Scheduled

📅 Date/Time: Nov 16, 2025 10:00 AM
🔢 Load Number: Load #1
👤 Customer: John Doe
🏢 Company: ABC Corp
⏰ Off-Hours: No
```

### Migration from Client-Side

**Before (Client-Side):**
```
Customer submits request → Frontend calls slackService → AJAX POST → Slack
```

❌ Issues:
- Webhook URL exposed in frontend bundle
- Fails if user closes browser
- No retry mechanism
- No centralized logging

**After (Database Triggers):**
```
Customer submits request → Supabase INSERT → Database Trigger → pg_net POST → Slack
```

✅ Benefits:
- Webhook URL secure in Vault
- Guaranteed delivery (server-side)
- Automatic retries on failure
- Logs in Supabase Dashboard
- No environment variable needed

---

## Notification Queue Worker

### Overview

The notification queue worker is a Supabase Edge Function that processes queued notifications from the `notification_queue` table.

**What it does:**
1. Queries `notification_queue` WHERE `processed = false` and `attempts < 3`
2. Sends email via Resend API
3. Sends Slack notification via webhook (optional)
4. Marks entries as `processed = true` on success
5. Increments `attempts` counter on failure (max 3 retries)

### Deployment Steps

**1. Set Environment Variables**

Supabase Dashboard → Settings → Edge Functions → Secrets:

```bash
# Required
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxx

# Optional
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
NOTIFICATION_FROM_EMAIL=notifications@yourdomain.com
```

**2. Deploy Edge Function**

```bash
# Deploy
npx supabase functions deploy process-notification-queue

# Verify
npx supabase functions list
```

**Or via Supabase Dashboard:**
1. Go to Edge Functions → "New Function"
2. Name: `process-notification-queue`
3. Copy contents of `supabase/functions/process-notification-queue/index.ts`
4. Click "Deploy"

**3. Test Manually**

```bash
# Using CLI
npx supabase functions invoke process-notification-queue

# Using curl
curl -X POST https://<project-ref>.supabase.co/functions/v1/process-notification-queue \
  -H "Authorization: Bearer <anon-key>"
```

**Expected response** (no notifications):
```json
{
  "message": "No notifications to process",
  "processed": 0
}
```

**Expected response** (notifications processed):
```json
{
  "message": "Notification processing complete",
  "success": 2,
  "failed": 0,
  "skipped": 0,
  "errors": []
}
```

**4. Set Up Cron Schedule**

**Option A: Database Cron (Recommended)**

```sql
-- Enable extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule worker to run every 5 minutes
SELECT cron.schedule(
  'process-notification-queue',
  '*/5 * * * *', -- Every 5 minutes
  $$
  SELECT net.http_post(
    url := 'https://<project-ref>.supabase.co/functions/v1/process-notification-queue',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')),
    body := '{}'::jsonb
  );
  $$
);

-- Verify cron job
SELECT * FROM cron.job WHERE jobname = 'process-notification-queue';
```

**Option B: External Cron Service**

Use GitHub Actions, Vercel Cron, or Cron-job.org.

Example GitHub Actions (`.github/workflows/notification-worker.yml`):

```yaml
name: Process Notification Queue

on:
  schedule:
    - cron: '*/5 * * * *'  # Every 5 minutes
  workflow_dispatch:

jobs:
  process:
    runs-on: ubuntu-latest
    steps:
      - name: Invoke Edge Function
        run: |
          curl -X POST \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_ANON_KEY }}" \
            https://${{ secrets.SUPABASE_PROJECT_REF }}.supabase.co/functions/v1/process-notification-queue
```

### Scaling Considerations

**Current Setup:**
- Batch size: 50 notifications per invocation
- Run frequency: Every 5 minutes
- Max throughput: 600 notifications/hour

**If queue backs up:**

**Option 1: Increase frequency**
```sql
SELECT cron.schedule('process-notification-queue', '* * * * *', ...); -- Every 1 minute
```

**Option 2: Increase batch size**
```typescript
const BATCH_SIZE = 100; // Was 50
```

**Option 3: Add parallel workers**
- Worker 1: Runs at :00, :05, :10
- Worker 2: Runs at :02, :07, :12

---

## Testing & Verification

### 1. Test Approval Workflow End-to-End

```sql
-- Create test storage request
INSERT INTO storage_requests (id, company_id, user_email, reference_id, status)
VALUES (
  gen_random_uuid(),
  (SELECT id FROM companies LIMIT 1),
  'your-test-email@example.com',
  'REF-TEST-001',
  'PENDING'
);

-- Get the inserted ID
SELECT id FROM storage_requests WHERE reference_id = 'REF-TEST-001';

-- Approve it (queues notification)
SELECT approve_storage_request_atomic(
  p_request_id := '<inserted-id>'::uuid,
  p_assigned_rack_ids := ARRAY['A-A1-01']::text[],
  p_required_joints := 50,
  p_notes := 'Test approval'
);

-- Check notification queued
SELECT * FROM notification_queue WHERE processed = false;
```

### 2. Run Worker Manually

```bash
npx supabase functions invoke process-notification-queue
```

Expected: Email sent to `your-test-email@example.com`

### 3. Verify Notification Processed

```sql
SELECT * FROM notification_queue WHERE processed = true ORDER BY processed_at DESC LIMIT 5;
```

Expected: Notification marked as processed with timestamp

### 4. Test Slack Notifications

```sql
-- Test new user notification
INSERT INTO auth.users (email, raw_user_meta_data)
VALUES ('test@example.com', '{"firstName":"Test","lastName":"User","companyName":"Test Corp"}');

-- Check Slack channel for message
```

### 5. Test Error Handling

```sql
-- Queue notification with invalid email
INSERT INTO notification_queue (type, payload)
VALUES ('EMAIL', '{"to":"invalid-email","subject":"Test"}');

-- Run worker
-- Check attempts incremented and error logged
SELECT * FROM notification_queue WHERE type = 'EMAIL' ORDER BY created_at DESC LIMIT 1;
```

---

## Monitoring

### Check Processing Stats

```sql
-- Notifications processed in last 24 hours
SELECT
  type,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE processed) as processed_count,
  COUNT(*) FILTER (WHERE NOT processed AND attempts >= 3) as failed_permanently,
  AVG(EXTRACT(EPOCH FROM (processed_at - created_at))) as avg_processing_time_seconds
FROM notification_queue
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY type;
```

### Check Failed Notifications

```sql
-- Notifications that failed max attempts
SELECT *
FROM notification_queue
WHERE NOT processed
  AND attempts >= 3
ORDER BY created_at DESC;
```

### Check Processing Lag

```sql
-- Oldest unprocessed notification
SELECT
  id,
  type,
  created_at,
  NOW() - created_at as age,
  attempts
FROM notification_queue
WHERE NOT processed
  AND attempts < 3
ORDER BY created_at ASC
LIMIT 10;
```

### Check Cron Job Status

```sql
SELECT * FROM cron.job WHERE jobname = 'process-notification-queue';

SELECT *
FROM cron.job_run_details
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'process-notification-queue')
ORDER BY start_time DESC
LIMIT 10;
```

---

## Troubleshooting

### Issue 1: No Emails Being Sent

**Diagnosis:**
```bash
# Check Resend API key is set
npx supabase secrets list

# Test Resend API directly
curl -X POST 'https://api.resend.com/emails' \
  -H "Authorization: Bearer ${RESEND_API_KEY}" \
  -H 'Content-Type: application/json' \
  -d '{"from":"onboarding@resend.dev","to":["test@example.com"],"subject":"Test","text":"Test email"}'
```

**Solutions:**
1. Verify `RESEND_API_KEY` is set correctly
2. Check Resend free tier only allows `onboarding@resend.dev` as from email
3. To use custom domain, verify DNS records in Resend dashboard
4. Check Edge Function logs: Supabase Dashboard → Edge Functions → Logs

---

### Issue 2: Slack Notifications Not Received

**Diagnosis:**
```sql
-- Check Vault secret exists
SELECT name FROM vault.secrets WHERE name = 'slack_webhook_url';

-- Check pg_net extension
SELECT * FROM pg_extension WHERE extname = 'pg_net';

-- Check triggers exist
SELECT * FROM pg_trigger WHERE tgname LIKE '%slack%';

-- Test function manually
SELECT notify_slack_storage_request();
```

**Solutions:**
1. Verify webhook URL stored in Vault
2. Enable `pg_net` extension
3. Check Supabase **Database → Functions** for execution errors
4. Test webhook with curl:
   ```bash
   curl -X POST https://hooks.slack.com/services/YOUR/WEBHOOK/URL \
     -H 'Content-Type: application/json' \
     -d '{"text":"Test notification"}'
   ```

---

### Issue 3: Worker Not Running Automatically

**Diagnosis:**
```sql
-- Check cron job exists
SELECT * FROM cron.job WHERE jobname = 'process-notification-queue';

-- Check recent cron runs
SELECT *
FROM cron.job_run_details
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'process-notification-queue')
ORDER BY start_time DESC
LIMIT 10;
```

**Solutions:**
1. Verify `pg_cron` extension enabled
2. Check cron schedule syntax: `SELECT cron.schedule(...)`
3. Check Edge Function logs for errors
4. Manually invoke to test: `npx supabase functions invoke process-notification-queue`

---

### Issue 4: High Failure Rate

**Diagnosis:**
```sql
-- Check failed notifications with errors
SELECT type, payload, attempts, last_error
FROM notification_queue
WHERE attempts > 0 AND NOT processed
ORDER BY created_at DESC
LIMIT 20;
```

**Solutions:**
1. Check payload format is correct
2. Verify email addresses are valid
3. Check Resend API rate limits (free tier: 100/day)
4. Manually retry failed notifications:
   ```sql
   UPDATE notification_queue
   SET attempts = 0, last_error = NULL
   WHERE id = '<notification-id>';
   ```

---

### Issue 5: Wrong or Missing Data in Slack

**Diagnosis:**
```sql
-- Check metadata extraction
SELECT
  email,
  raw_user_meta_data->>'firstName' as first_name,
  raw_user_meta_data->>'lastName' as last_name,
  raw_user_meta_data->>'companyName' as company
FROM auth.users
WHERE email = 'user@example.com';

-- Check request details
SELECT
  reference_id,
  request_details->>'fullName' as full_name,
  request_details->>'companyName' as company,
  request_details->>'casingSpec' as pipe_spec
FROM storage_requests
WHERE reference_id = 'REF-20251116-001';
```

**Solutions:**
1. Verify `auth.users.raw_user_meta_data` contains firstName, lastName, companyName
2. Verify `storage_requests.request_details` JSONB contains expected fields
3. Review trigger function code for correct field extraction
4. Check for NULL values in source data

---

## Cost Breakdown

### Current Monthly Cost: $0

```
Email (Resend):
  - Free tier: 3,000 emails/month
  - Usage estimate: ~300 emails/month
  - Cost: $0/month

Slack Webhooks:
  - Free (unlimited)

Supabase Edge Functions:
  - Free tier: 500K invocations/month
  - Usage estimate: 8,640 invocations/month (every 5 mins)
  - Cost: $0/month

Total: $0/month
```

### When to Upgrade

**Resend:**
- Upgrade to Pro ($20/month) if:
  - Sending > 3,000 emails/month
  - Need custom domain for from email
  - Pro tier: 50,000 emails/month

**Supabase:**
- Free tier sufficient for most usage
- Edge Functions: 500K invocations/month free

---

## Custom Email Templates

To customize email templates, edit the `sendEmail()` function in `supabase/functions/process-notification-queue/index.ts`:

```typescript
// Add company logo
htmlBody = `
  <img src="https://yourdomain.com/logo.png" alt="MPS Group" width="200">
  <h2>Storage Request Approved</h2>
  ...
`;

// Add custom CSS styling
htmlBody = `
  <style>
    body { font-family: Arial, sans-serif; }
    h2 { color: #1a73e8; }
    .button { background: #1a73e8; color: white; padding: 10px 20px; }
  </style>
  ...
`;

// Add call-to-action button
htmlBody += `
  <a href="https://pipevault.mpsgroup.ca/dashboard" class="button">
    View in PipeVault
  </a>
`;
```

---

## Related Documentation

- **Email Service:** `services/emailService.ts`
- **Slack Service:** `services/slackService.ts` (legacy, not used)
- **Notification Service:** `services/notificationService.ts`
- **Edge Function:** `supabase/functions/process-notification-queue/index.ts`
- **Database Schema:** `docs/setup/DATABASE_SETUP.md`
- **Troubleshooting:** `TROUBLESHOOTING.md`

---

**Document Owner:** Integration Events Orchestrator
**Last Review:** 2025-11-16
**Next Review:** 2025-12-16
