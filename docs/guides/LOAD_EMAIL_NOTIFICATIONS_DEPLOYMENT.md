# Load Email Notifications - Deployment Guide

**Version**: 2.0.2
**Created**: 2025-11-17
**Status**: Ready for Deployment

---

## Overview

This guide documents the complete email notification system for trucking load lifecycle events. The system automatically sends professional HTML emails to customers when loads are approved, in transit, or completed.

---

## What Was Implemented

### 1. Database Triggers (Migration File Created)

**File**: `supabase/migrations/20251117000001_add_load_approval_email_trigger.sql`

**Created 3 Trigger Functions**:
- `notify_load_approved()` - Fires when load status → APPROVED
- `notify_load_completed()` - Fires when load status → COMPLETED
- `notify_load_in_transit()` - Fires when load status → IN_TRANSIT

**How It Works**:
```sql
-- Example: When admin approves a load
UPDATE trucking_loads SET status = 'APPROVED' WHERE id = '...';

-- Trigger automatically:
-- 1. Detects status change to APPROVED
-- 2. Queries customer email from auth.users
-- 3. Gathers load details (driver, schedule, etc.)
-- 4. Inserts into notification_queue table
-- 5. Edge Function processes queue every 5 minutes
-- 6. Email sent via Resend API
```

### 2. Email Templates (Edge Function Updated)

**File**: `supabase/functions/process-notification-queue/index.ts`

**Added 3 Professional HTML Email Templates**:

#### Load Approved Email
- **Color Theme**: Green gradient (#10B981 → #059669)
- **Icon**: ✅
- **Subject**: "Load #X Approved - Delivery Scheduled"
- **Contains**: Scheduled date/time, driver info, trucking company, expected joints
- **CTA**: "View Dashboard" button

#### Load Completed Email
- **Color Theme**: Blue gradient (#3B82F6 → #1E40AF)
- **Icon**: 🎉
- **Subject**: "Load #X Delivered & Stored at MPS"
- **Contains**: Joints received, total length/weight, rack location, project totals
- **CTA**: "View Inventory" button

#### Load In Transit Email
- **Color Theme**: Orange gradient (#F59E0B → #D97706)
- **Icon**: 🚛
- **Subject**: "Load #X En Route to MPS"
- **Contains**: Driver info, ETA, expected joints, tracking info
- **CTA**: "Track Load" button

### 3. Documentation Created

- **`docs/guides/EMAIL_TEMPLATES.md`** - Comprehensive template reference
- **`docs/guides/LOAD_EMAIL_NOTIFICATIONS_DEPLOYMENT.md`** - This file

---

## Deployment Steps

### Step 1: Apply Database Migration

**Option A: Supabase Dashboard (Recommended)**

1. Log into [Supabase Dashboard](https://supabase.com)
2. Navigate to your project
3. Go to **SQL Editor**
4. Click "New Query"
5. Copy entire contents of `supabase/migrations/20251117000001_add_load_approval_email_trigger.sql`
6. Paste into SQL Editor
7. Click **Run** (bottom right)
8. Verify success: Should see "Success. No rows returned"

**Option B: Supabase CLI**

```bash
# If you have Supabase CLI installed
npx supabase db push
```

**Verification**:

Run this query to verify triggers were created:

```sql
SELECT
  trigger_name,
  event_manipulation,
  event_object_table,
  action_timing
FROM information_schema.triggers
WHERE trigger_name IN (
  'trigger_load_approved_email',
  'trigger_load_completed_email',
  'trigger_load_in_transit_email'
)
ORDER BY trigger_name;
```

Expected output: 3 rows showing all 3 triggers on `trucking_loads` table.

---

### Step 2: Deploy Edge Function

The Edge Function has been updated with new email templates. Deploy to production:

```bash
npx supabase functions deploy process-notification-queue
```

**Expected Output**:
```
Deploying function: process-notification-queue
Function deployed successfully
URL: https://<project-ref>.supabase.co/functions/v1/process-notification-queue
```

**Verify Environment Variables**:

Ensure these are set in Supabase Dashboard → Edge Functions → Secrets:

- `RESEND_API_KEY` - Your Resend API key
- `NOTIFICATION_FROM_EMAIL` - noreply@pipevault.mpsgroup.ca (or your domain)
- `SLACK_WEBHOOK_URL` - (Optional) For Slack notifications

---

### Step 3: Test Email Notifications

#### Test 1: Load Approval Email

1. Log in as **admin** to PipeVault
2. Navigate to **Admin Dashboard → Shipments tab**
3. Find a load with status "NEW"
4. Click "Approve Load"
5. Fill in:
   - Scheduled date/time
   - Driver name
   - Driver phone
   - Trucking company
6. Click "Approve"

**Verify**:

```sql
-- Check notification was queued
SELECT
  type,
  payload->>'userEmail' as recipient,
  payload->>'subject' as subject,
  payload->>'loadNumber' as load_number,
  processed,
  created_at
FROM notification_queue
WHERE type = 'load_approved'
ORDER BY created_at DESC
LIMIT 5;
```

Expected: 1 row with `processed = false` (will be true after 5 minutes)

**Wait 5 minutes** (Edge Function runs on cron), then verify:

```sql
-- Check notification was processed
SELECT * FROM notification_queue WHERE type = 'load_approved' ORDER BY created_at DESC LIMIT 1;
```

Expected: `processed = true`, `processed_at` timestamp populated

**Check customer's email inbox** - Should receive professional HTML email with green header.

---

#### Test 2: Load In Transit Email

1. As **admin**, find the approved load
2. Click "Edit Load"
3. Change status to "IN_TRANSIT"
4. Click "Save"

**Verify**: Same SQL queries as above, but for `type = 'load_in_transit'`

Expected: Email with orange header and truck icon.

---

#### Test 3: Load Completion Email

1. As **admin**, find the in-transit load
2. Mark load as "COMPLETED" (upload manifest, enter actual quantities)
3. Complete the load

**Verify**: Same SQL queries, but for `type = 'load_completed'`

Expected: Email with blue header, delivery summary, and project totals.

---

### Step 4: Production Verification

After successful testing:

1. Monitor notification queue for failures:

```sql
SELECT
  type,
  attempts,
  last_attempt_at,
  payload->>'userEmail' as email
FROM notification_queue
WHERE processed = false
  OR attempts > 0
ORDER BY created_at DESC
LIMIT 20;
```

2. Check Edge Function logs in Supabase Dashboard:
   - Go to **Edge Functions → process-notification-queue → Logs**
   - Look for errors or failed email sends

3. Verify Resend API dashboard for email delivery status

---

## Email Flow Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    EMAIL NOTIFICATION FLOW                   │
└─────────────────────────────────────────────────────────────┘

1. ADMIN UPDATES LOAD STATUS
   ↓
   (e.g., status changed to APPROVED)

2. DATABASE TRIGGER FIRES AUTOMATICALLY
   ↓
   Function: notify_load_approved()
   - Queries customer email from auth.users
   - Gathers load details (driver, schedule, company, etc.)
   - Builds JSON payload

3. INSERT INTO notification_queue
   ↓
   {
     type: 'load_approved',
     payload: { userEmail, loadNumber, scheduledDate, ... },
     processed: false,
     attempts: 0
   }

4. EDGE FUNCTION RUNS (every 5 minutes via cron)
   ↓
   SELECT * FROM notification_queue WHERE processed = false

5. SEND EMAIL via Resend API
   ↓
   - Build HTML email from template
   - POST to https://api.resend.com/emails
   - Mark notification as processed

6. CUSTOMER RECEIVES EMAIL ✅
```

---

## Troubleshooting

### Issue: Notification queued but email not sent

**Symptoms**:
- Notification appears in `notification_queue` with `processed = false`
- 5+ minutes have passed
- No email received

**Diagnosis**:

```sql
-- Check if notification is stuck
SELECT
  id,
  type,
  attempts,
  last_attempt_at,
  created_at,
  payload->>'userEmail' as email
FROM notification_queue
WHERE processed = false
  AND created_at < NOW() - INTERVAL '10 minutes'
ORDER BY created_at DESC;
```

**Possible Causes**:
1. **Edge Function not deployed**: Redeploy with `npx supabase functions deploy process-notification-queue`
2. **RESEND_API_KEY missing**: Check Edge Functions → Secrets
3. **Invalid email address**: Verify `payload->>'userEmail'` is correct
4. **Resend API rate limit**: Check Resend dashboard

**Manual Trigger Edge Function**:

```bash
curl -X POST \
  https://<project-ref>.supabase.co/functions/v1/process-notification-queue \
  -H "Authorization: Bearer <anon-key>"
```

---

### Issue: Email sent but looks broken

**Symptoms**:
- Email received but HTML rendering is incorrect
- Missing data or ${...} placeholders visible

**Diagnosis**:
- Check Edge Function logs for template rendering errors
- Verify payload structure matches template expectations

**Fix**:
- Review `payload` JSON in notification_queue:

```sql
SELECT payload FROM notification_queue WHERE id = '<notification-id>';
```

- Ensure all required fields are present:
  - `load_approved`: loadNumber, scheduledDate, scheduledTime, driverName, driverPhone, truckingCompany, totalJoints
  - `load_completed`: loadNumber, jointsReceived, totalLength, totalWeight, rackLocation, projectTotalJoints
  - `load_in_transit`: loadNumber, driverName, driverPhone, eta, totalJoints

---

### Issue: Trigger not firing

**Symptoms**:
- Admin updates load status
- No notification appears in `notification_queue`

**Diagnosis**:

```sql
-- Verify triggers exist
SELECT * FROM information_schema.triggers
WHERE trigger_name LIKE '%load%email%';
```

**Possible Causes**:
1. **Migration not applied**: Run migration SQL in Supabase Dashboard
2. **Wrong status transition**: Trigger only fires when status CHANGES to APPROVED/COMPLETED/IN_TRANSIT
3. **RLS policy blocking**: Ensure service role can insert into notification_queue

**Manual Test**:

```sql
-- Manually trigger notification (use real load ID)
UPDATE trucking_loads
SET status = 'APPROVED'
WHERE id = '<load-id>';

-- Check if notification was created
SELECT * FROM notification_queue ORDER BY created_at DESC LIMIT 1;
```

---

## Rollback Plan

If issues arise in production:

### Quick Disable (Recommended)

Disable triggers without deleting them:

```sql
-- Disable all load email triggers
ALTER TABLE trucking_loads DISABLE TRIGGER trigger_load_approved_email;
ALTER TABLE trucking_loads DISABLE TRIGGER trigger_load_completed_email;
ALTER TABLE trucking_loads DISABLE TRIGGER trigger_load_in_transit_email;
```

Re-enable when fixed:

```sql
ALTER TABLE trucking_loads ENABLE TRIGGER trigger_load_approved_email;
ALTER TABLE trucking_loads ENABLE TRIGGER trigger_load_completed_email;
ALTER TABLE trucking_loads ENABLE TRIGGER trigger_load_in_transit_email;
```

### Complete Removal

If rollback is required:

```sql
-- Remove triggers
DROP TRIGGER IF EXISTS trigger_load_approved_email ON trucking_loads;
DROP TRIGGER IF EXISTS trigger_load_completed_email ON trucking_loads;
DROP TRIGGER IF EXISTS trigger_load_in_transit_email ON trucking_loads;

-- Remove functions
DROP FUNCTION IF EXISTS notify_load_approved();
DROP FUNCTION IF EXISTS notify_load_completed();
DROP FUNCTION IF EXISTS notify_load_in_transit();
```

For Edge Function, redeploy previous version or remove new templates.

---

## Monitoring & Maintenance

### Daily Monitoring

Check for stuck notifications:

```sql
-- Notifications older than 1 hour not processed
SELECT
  type,
  payload->>'userEmail' as email,
  attempts,
  created_at
FROM notification_queue
WHERE processed = false
  AND created_at < NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC;
```

### Weekly Review

Analyze notification success rate:

```sql
-- Last 7 days
SELECT
  type,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE processed = true) as successful,
  COUNT(*) FILTER (WHERE processed = false) as failed,
  ROUND(100.0 * COUNT(*) FILTER (WHERE processed = true) / COUNT(*), 2) as success_rate
FROM notification_queue
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY type
ORDER BY type;
```

Expected: 95%+ success rate

---

## Additional Resources

- **Email Templates Reference**: `docs/guides/EMAIL_TEMPLATES.md`
- **Complete Workflow**: `docs/architecture/COMPLETE_WORKFLOW.md`
- **Troubleshooting Guide**: `TROUBLESHOOTING.md`
- **Resend API Docs**: https://resend.com/docs
- **Supabase Edge Functions**: https://supabase.com/docs/guides/functions

---

## Next Steps

After successful deployment:

1. ✅ Apply database migration
2. ✅ Deploy Edge Function
3. ✅ Test all 3 email types
4. ✅ Monitor for 24 hours
5. ⏳ Gather customer feedback on email quality
6. ⏳ Consider adding:
   - Email preferences (opt-out)
   - SMS notifications
   - Calendar invites for scheduled loads
   - Email tracking/analytics

---

**Deployment Contact**: Kyle Gronning
**Last Updated**: 2025-11-17
**Version**: 2.0.2
