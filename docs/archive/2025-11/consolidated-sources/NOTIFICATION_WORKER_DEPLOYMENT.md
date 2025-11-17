# Notification Queue Worker - Deployment Guide

**Edge Function**: `process-notification-queue`
**Purpose**: Drain notification_queue table and send emails/Slack notifications
**Trigger**: Cron schedule (every 5 minutes) or manual invocation

---

## Overview

The notification queue worker processes queued notifications from the `notification_queue` table that are created by the atomic approval/rejection stored procedures. It sends emails via Resend API and optional Slack notifications via webhook.

**What it does:**
1. Queries `notification_queue` WHERE `processed = false` and `attempts < 3`
2. Sends email via Resend API (if configured)
3. Sends Slack notification via webhook (if configured)
4. Marks entries as `processed = true` on success
5. Increments `attempts` counter on failure (max 3 retries)
6. Returns processing summary

---

## Prerequisites

### 1. Resend API Key (Required for Email)

Sign up at [https://resend.com](https://resend.com) and get your API key.

**Free tier**: 3,000 emails/month, 100 emails/day

### 2. Slack Webhook URL (Optional)

Create a Slack webhook:
1. Go to [https://api.slack.com/apps](https://api.slack.com/apps)
2. Create new app → "From scratch"
3. Name: "PipeVault Notifications"
4. Select your workspace
5. Under "Features" → "Incoming Webhooks", toggle "On"
6. Click "Add New Webhook to Workspace"
7. Select channel (e.g., #pipe-storage-notifications)
8. Copy the webhook URL

---

## Deployment Steps

### Step 1: Set Environment Variables

Open Supabase Dashboard → Settings → Edge Functions → Secrets

Add the following secrets:

```bash
# Required for email
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxx

# Optional for Slack notifications
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXX

# Optional: Custom from email (defaults to noreply@pipevault.mpsgroup.ca)
NOTIFICATION_FROM_EMAIL=notifications@yourdomain.com
```

### Step 2: Deploy Edge Function

Using Supabase CLI:

```bash
# Deploy the function
npx supabase functions deploy process-notification-queue

# Verify deployment
npx supabase functions list
```

**Or via Supabase Dashboard:**
1. Go to Edge Functions → "New Function"
2. Name: `process-notification-queue`
3. Copy the contents of `supabase/functions/process-notification-queue/index.ts`
4. Click "Deploy"

### Step 3: Test Manually

Invoke the function manually to test:

```bash
# Using CLI
npx supabase functions invoke process-notification-queue

# Or using curl
curl -X POST https://<project-ref>.supabase.co/functions/v1/process-notification-queue \
  -H "Authorization: Bearer <anon-key>"
```

**Expected response** (if no notifications in queue):
```json
{
  "message": "No notifications to process",
  "processed": 0
}
```

**Expected response** (if notifications processed):
```json
{
  "message": "Notification processing complete",
  "success": 2,
  "failed": 0,
  "skipped": 0,
  "errors": []
}
```

### Step 4: Set Up Cron Schedule

To run automatically every 5 minutes:

**Option A: Database Cron Extension (Recommended)**

```sql
-- Enable pg_cron extension (run once)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule the worker to run every 5 minutes
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

-- Verify cron job created
SELECT * FROM cron.job WHERE jobname = 'process-notification-queue';
```

**Option B: External Cron Service**

Use services like:
- **GitHub Actions** (free, cron workflows)
- **Vercel Cron** (free tier: 1 cron/project)
- **Cron-job.org** (free, up to 50 jobs)

Example GitHub Actions workflow (`.github/workflows/notification-worker.yml`):

```yaml
name: Process Notification Queue

on:
  schedule:
    - cron: '*/5 * * * *'  # Every 5 minutes
  workflow_dispatch:  # Allow manual trigger

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

---

## Verification

### 1. Test Approval Workflow End-to-End

```sql
-- Create test storage request
INSERT INTO storage_requests (id, company_id, user_email, reference_id, status)
VALUES (
  'test-12345'::uuid,
  (SELECT id FROM companies LIMIT 1),
  'your-test-email@example.com',
  'REF-TEST-001',
  'PENDING'
);

-- Approve it (this will queue notification)
SELECT approve_storage_request_atomic(
  p_request_id := 'test-12345'::uuid,
  p_assigned_rack_ids := ARRAY['A-A1-01']::text[],
  p_required_joints := 50,
  p_notes := 'Test approval'
);

-- Check notification was queued
SELECT * FROM notification_queue WHERE processed = false;
```

Expected: 1 unprocessed notification

### 2. Run Worker Manually

```bash
npx supabase functions invoke process-notification-queue
```

Expected: Email sent to `your-test-email@example.com`

### 3. Verify Notification Processed

```sql
SELECT * FROM notification_queue WHERE processed = true;
```

Expected: Notification marked as processed, `processed_at` timestamp set

### 4. Check Slack (if configured)

Expected: Message posted to configured Slack channel

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

---

## Troubleshooting

### Issue: No emails being sent

**Check 1: Verify Resend API key is set**
```bash
npx supabase secrets list
```

**Check 2: Test Resend API directly**
```bash
curl -X POST 'https://api.resend.com/emails' \
  -H "Authorization: Bearer ${RESEND_API_KEY}" \
  -H 'Content-Type: application/json' \
  -d '{ "from": "noreply@yourdomain.com", "to": ["test@example.com"], "subject": "Test", "text": "Test email" }'
```

**Check 3: Verify email domain**
- Resend free tier only allows sending from `onboarding@resend.dev`
- To use custom domain, verify it in Resend dashboard

### Issue: Worker not running automatically

**Check cron job status**
```sql
SELECT * FROM cron.job WHERE jobname = 'process-notification-queue';
SELECT * FROM cron.job_run_details WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'process-notification-queue') ORDER BY start_time DESC LIMIT 10;
```

**Check Edge Function logs**
- Supabase Dashboard → Edge Functions → `process-notification-queue` → Logs

### Issue: High failure rate

**Check notification_queue for errors**
```sql
SELECT
  type,
  payload,
  attempts,
  last_attempt_at
FROM notification_queue
WHERE attempts > 0
  AND NOT processed
ORDER BY created_at DESC
LIMIT 20;
```

**Manually retry failed notifications**
```sql
-- Reset attempts counter to allow retry
UPDATE notification_queue
SET attempts = 0, last_attempt_at = NULL
WHERE id = '<notification-id>';
```

---

## Scaling Considerations

### Current Setup
- Batch size: 50 notifications per invocation
- Run frequency: Every 5 minutes
- Max throughput: 600 notifications/hour (50 × 12)

### If Queue Backs Up

**Option 1: Increase frequency**
```sql
-- Update cron to run every 1 minute
SELECT cron.schedule(
  'process-notification-queue',
  '* * * * *', -- Every 1 minute
  $$ ... $$
);
```

**Option 2: Increase batch size**

Edit `supabase/functions/process-notification-queue/index.ts`:
```typescript
const BATCH_SIZE = 100; // Was 50
```

**Option 3: Add parallel workers**

Deploy multiple instances with different cron offsets:
- Worker 1: Runs at :00, :05, :10, etc.
- Worker 2: Runs at :02, :07, :12, etc.

---

## Cost Estimates

### Resend API
- Free tier: 3,000 emails/month ($0)
- Pro tier: $20/month for 50,000 emails
- Usage estimate: ~300 emails/month (10 approvals/day × 30 days)

### Supabase Edge Functions
- Free tier: 500K invocations/month ($0)
- Usage estimate: 8,640 invocations/month (every 5 mins × 60 × 24 × 30)
- Cost: **$0/month**

### Total Monthly Cost
- **$0** on free tiers (sufficient for current usage)

---

## Security Notes

1. **API Key Rotation**: Rotate RESEND_API_KEY every 90 days
2. **Webhook Security**: Slack webhook URLs should be kept secret
3. **Email Validation**: Worker validates email format before sending
4. **Rate Limiting**: Batch size prevents overwhelming email provider
5. **Retry Logic**: Max 3 attempts prevents infinite retries

---

## Next Steps After Deployment

1. ✅ Deploy Edge Function with environment variables
2. ✅ Set up cron schedule (pg_cron or external)
3. ✅ Test with manual approval workflow
4. ✅ Verify emails received
5. ✅ Monitor processing stats for 24 hours
6. 📊 Set up alerting for failed notifications (optional)
7. 📧 Add custom email templates (optional)

---

## Custom Email Templates (Optional)

To customize email templates, edit the `sendEmail()` function in `index.ts`:

```typescript
// Add company logo
htmlBody = `
  <img src="https://yourdomain.com/logo.png" alt="Company Logo" width="200">
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

**Last Updated**: 2025-11-10
**Status**: Ready for deployment
**Dependencies**: Resend API key (required), Slack webhook (optional)
