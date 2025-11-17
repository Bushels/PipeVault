# Integration & Events Agent Playbook

## Identity
- **Agent Name**: Integration & Events Agent
- **Primary Role**: Manage external integrations, notifications, webhooks, and event-driven workflows
- **Domain**: Slack, email, webhooks, edge functions, event triggers
- **Priority**: High (critical for customer/admin communication)

---

## Responsibilities

### Core Duties
1. **Slack Notifications**
   - Send real-time notifications to MPS admin channel
   - New user signups, storage requests, delivery bookings, pickup bookings
   - Use Supabase Database Webhooks (server-side, secure)
   - Format with Slack Block Kit for rich UI

2. **Email Notifications**
   - Approval emails (celebration email with free storage message)
   - Rejection emails (with reason and next steps)
   - Delivery reminders (24hrs before scheduled arrival)
   - Pickup confirmations
   - Use Resend API for delivery

3. **Database Triggers**
   - AFTER INSERT/UPDATE triggers on storage_requests
   - Fire Slack webhooks on status changes
   - Maintain audit trail (who, when, what)
   - Ensure idempotent operations

4. **Edge Functions**
   - Supabase Edge Functions for server-side logic
   - Weather data fetch (Tomorrow.io API)
   - Future: Quote generation, invoicing, external API calls

5. **Event Orchestration**
   - Coordinate multi-step workflows (approval → email → Slack)
   - Handle failures gracefully (retry, fallback, log)
   - Maintain event log for debugging

6. **Third-Party Integrations**
   - Resend (email delivery)
   - Slack (team notifications)
   - Tomorrow.io (weather data)
   - Future: Accounting, ERP, Twilio (SMS)

---

## Slack Integration

### Architecture: Supabase Database Webhooks
**Why**: Server-side execution, secure webhook URL storage, no client-side API keys

### Setup: Vault-Based Webhook Storage
**File**: `supabase/SETUP_SLACK_WEBHOOKS_COMPLETE.sql`

1. **Store Webhook URL in Supabase Vault**:
```sql
-- Insert webhook URL into secure vault (one-time setup)
INSERT INTO vault.secrets (name, secret)
VALUES ('slack_webhook_url', 'https://hooks.slack.com/services/YOUR/WEBHOOK/URL')
ON CONFLICT (name) DO UPDATE
SET secret = EXCLUDED.secret;
```

2. **Grant Access to Functions**:
```sql
GRANT USAGE ON SCHEMA vault TO postgres;
GRANT SELECT ON vault.decrypted_secrets TO postgres;
```

---

### Slack Notification Function
**File**: `supabase/RESTORE_SLACK_NOTIFICATIONS.sql`

```sql
CREATE OR REPLACE FUNCTION public.notify_slack_storage_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  slack_webhook_url TEXT;
  request_details JSONB;
  item_type TEXT;
  total_joints TEXT;
  company_name TEXT;
  storage_start TEXT;
  storage_end TEXT;
  slack_payload JSONB;
BEGIN
  -- Only send notification for PENDING requests (not drafts)
  IF NEW.status = 'PENDING' THEN

    -- Retrieve Slack webhook URL from Supabase Vault (secure storage)
    SELECT decrypted_secret
    INTO slack_webhook_url
    FROM vault.decrypted_secrets
    WHERE name = 'slack_webhook_url'
    LIMIT 1;

    -- Extract request details from JSONB
    request_details := NEW.request_details;
    item_type := COALESCE(request_details->>'itemType', 'N/A');
    total_joints := COALESCE((request_details->>'totalJoints')::text, 'N/A');
    company_name := COALESCE(request_details->>'companyName', 'N/A');
    storage_start := COALESCE(request_details->>'storageStartDate', 'N/A');
    storage_end := COALESCE(request_details->>'storageEndDate', 'N/A');

    -- Build Slack payload with Block Kit formatting
    slack_payload := jsonb_build_object(
      'blocks', jsonb_build_array(
        -- Header
        jsonb_build_object(
          'type', 'header',
          'text', jsonb_build_object(
            'type', 'plain_text',
            'text', '🔔 New Storage Request Submitted',
            'emoji', true
          )
        ),
        -- Request details section
        jsonb_build_object(
          'type', 'section',
          'fields', jsonb_build_array(
            jsonb_build_object('type', 'mrkdwn', 'text', '*Project Reference:*\n' || COALESCE(NEW.reference_id, 'N/A')),
            jsonb_build_object('type', 'mrkdwn', 'text', '*Company:*\n' || company_name),
            jsonb_build_object('type', 'mrkdwn', 'text', '*Contact Email:*\n' || COALESCE(NEW.user_email, 'N/A')),
            jsonb_build_object('type', 'mrkdwn', 'text', '*Item Type:*\n' || item_type),
            jsonb_build_object('type', 'mrkdwn', 'text', '*Quantity:*\n' || total_joints || ' joints'),
            jsonb_build_object('type', 'mrkdwn', 'text', '*Storage Period:*\n' || storage_start || ' to ' || storage_end)
          )
        ),
        -- Action required section
        jsonb_build_object(
          'type', 'section',
          'text', jsonb_build_object(
            'type', 'mrkdwn',
            'text', '⏰ *Action Required:* Review and approve this request in the PipeVault Admin Dashboard.'
          )
        )
      )
    );

    -- Send webhook via http extension
    PERFORM net.http_post(
      url := slack_webhook_url,
      body := slack_payload::text,
      headers := '{"Content-Type": "application/json"}'::jsonb
    );

  END IF;

  RETURN NEW;
END;
$function$;
```

---

### Slack Trigger
**Create Trigger** (lines 137-144, RESTORE_SLACK_NOTIFICATIONS.sql):
```sql
DROP TRIGGER IF EXISTS on_storage_request_insert ON storage_requests;

CREATE TRIGGER on_storage_request_insert
AFTER INSERT OR UPDATE ON storage_requests
FOR EACH ROW
WHEN (NEW.status = 'PENDING')
EXECUTE FUNCTION notify_slack_storage_request();
```

**Behavior**:
- Fires on INSERT or UPDATE of storage_requests
- Only when status = 'PENDING' (excludes drafts)
- Sends formatted message to Slack channel
- Idempotent (safe to retry)

---

### Notification Events

#### 1. New User Signup
**Trigger**: User completes registration
**Payload**:
```json
{
  "blocks": [
    {
      "type": "header",
      "text": { "type": "plain_text", "text": "👤 New User Signed Up" }
    },
    {
      "type": "section",
      "fields": [
        { "type": "mrkdwn", "text": "*Name:*\nJohn Doe" },
        { "type": "mrkdwn", "text": "*Email:*\njohn@example.com" },
        { "type": "mrkdwn", "text": "*Company:*\nBigOil Corp" }
      ]
    }
  ]
}
```
**Status**: ⚠️ TODO (trigger not yet implemented)

---

#### 2. New Storage Request
**Trigger**: Customer submits storage request (status → PENDING)
**Payload**: See `notify_slack_storage_request()` above
**Status**: ✅ Implemented (RESTORE_SLACK_NOTIFICATIONS.sql)

---

#### 3. Delivery Booking
**Trigger**: Customer schedules inbound delivery (creates trucking_load with direction=INBOUND)
**Payload**:
```json
{
  "blocks": [
    {
      "type": "header",
      "text": { "type": "plain_text", "text": "🚚 Delivery Scheduled" }
    },
    {
      "type": "section",
      "fields": [
        { "type": "mrkdwn", "text": "*Project:*\nBigOil-2024-Q4" },
        { "type": "mrkdwn", "text": "*Company:*\nBigOil Corp" },
        { "type": "mrkdwn", "text": "*Scheduled:*\n2024-11-20 09:00 AM" },
        { "type": "mrkdwn", "text": "*Trucking:*\nAcme Trucking (555-1234)" },
        { "type": "mrkdwn", "text": "*Quantity:*\n150 joints" }
      ]
    }
  ]
}
```
**Status**: ⚠️ TODO (trigger not yet implemented)

---

#### 4. Pickup Booking
**Trigger**: Customer schedules outbound pickup (creates trucking_load with direction=OUTBOUND)
**Payload**: Similar to delivery booking
**Status**: ⚠️ TODO (trigger not yet implemented)

---

## Email Notifications

### Service: Resend API
**File**: `services/emailService.ts`
**API**: `https://api.resend.com/emails`
**From Address**: `PipeVault <pipevault@mpsgroup.ca>`

**Configuration**:
```typescript
const RESEND_API_KEY = import.meta.env.VITE_RESEND_API_KEY;
const FROM_EMAIL = 'PipeVault <pipevault@mpsgroup.ca>';
const RESEND_API_URL = 'https://api.resend.com/emails';
```

---

### Approval Email
**Function**: `sendApprovalEmail(to, referenceId, assignedLocation)`
**Trigger**: Admin clicks "Approve" button
**Subject**: "Congratulations! Your FREE Pipe Storage has been Approved! 🎉"

**Template** (lines 17-83, emailService.ts):
```html
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #DC2626 0%, #991B1B 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; }
    .highlight { background: #FEF3C7; padding: 15px; border-left: 4px solid #F59E0B; margin: 20px 0; }
    .location { background: #D1FAE5; padding: 15px; border-radius: 8px; margin: 20px 0; }
    .footer { background: #f9fafb; padding: 20px; text-align: center; font-size: 12px; color: #6b7280; border-radius: 0 0 8px 8px; }
    .button { background: #DC2626; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 20px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0; font-size: 28px;">🎉 Congratulations!</h1>
      <p style="margin: 10px 0 0 0; font-size: 18px;">Your FREE Pipe Storage is Approved!</p>
    </div>

    <div class="content">
      <p>Dear Valued Customer,</p>

      <p><strong>Great news!</strong> We're thrilled to inform you that your storage request for project <strong>"${referenceId}"</strong> has been approved!</p>

      <div class="highlight">
        <p style="margin: 0;"><strong>🎊 Celebrating 20 Years of MPS Group!</strong></p>
        <p style="margin: 10px 0 0 0;">As we celebrate two decades of excellence in the energy industry, we're honored to offer you FREE pipe storage as part of our anniversary promotion. Thank you for being part of our journey!</p>
      </div>

      <div class="location">
        <p style="margin: 0; color: #065F46;"><strong>📍 Your Assigned Storage Location:</strong></p>
        <p style="margin: 5px 0 0 0; font-size: 20px; font-weight: bold; color: #047857;">${assignedLocation}</p>
      </div>

      <p><strong>Next Steps:</strong></p>
      <ol>
        <li>Schedule your delivery to our facility</li>
        <li>Coordinate with your trucking company</li>
        <li>Track your shipment in the PipeVault dashboard</li>
      </ol>

      <p style="text-align: center;">
        <a href="https://pipevault.mpsgroup.ca" class="button">View Dashboard</a>
      </p>

      <p>If you have any questions, our team is here to help!</p>

      <p>Thank you for choosing MPS Group!</p>
    </div>

    <div class="footer">
      <p>MPS Group | Celebrating 20 Years of Excellence</p>
      <p>📧 pipevault@mpsgroup.ca | 📞 (555) 123-4567</p>
    </div>
  </div>
</body>
</html>
```

**API Request**:
```typescript
await fetch(RESEND_API_URL, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${RESEND_API_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    from: FROM_EMAIL,
    to: [to],
    subject: subject,
    html: htmlBody,
  }),
});
```

---

### Rejection Email
**Function**: `sendRejectionEmail(to, referenceId, reason)`
**Trigger**: Admin clicks "Reject" button
**Subject**: "Update on Your Storage Request"

**Template**: Professional, apologetic, provides reason and next steps
**File**: `services/emailService.ts` (lines 90-150 approx)

---

### Delivery Reminder Email
**Function**: `sendDeliveryReminder(to, referenceId, scheduledDate, location)`
**Trigger**: 24 hours before scheduled delivery (cron job)
**Subject**: "Reminder: Delivery Tomorrow at ${scheduledDate}"
**Status**: ⚠️ TODO (not yet implemented)

---

## Edge Functions

### Current Edge Functions
**Directory**: `supabase/functions/`

1. **fetch-realtime-weather** (`supabase/functions/fetch-realtime-weather/index.ts`)
   - Fetches current weather from Tomorrow.io API
   - Used by Roughneck AI tile for weather quips
   - CORS enabled for client-side calls

2. **fetch-weather-forecast** (`supabase/functions/fetch-weather-forecast/index.ts`)
   - Fetches 5-day forecast
   - Future use: Delivery scheduling recommendations

---

### Edge Function Pattern
```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

serve(async (req) => {
  // CORS headers
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  try {
    // Parse request
    const { param1, param2 } = await req.json();

    // Call external API
    const apiKey = Deno.env.get('TOMORROW_API_KEY');
    const response = await fetch(`https://api.tomorrow.io/v4/...`);
    const data = await response.json();

    // Return response
    return new Response(JSON.stringify(data), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
```

**Deploy**:
```bash
supabase functions deploy fetch-realtime-weather
```

---

## Files Owned

### SQL Migrations
- `supabase/RESTORE_SLACK_NOTIFICATIONS.sql` - Slack trigger and function
- `supabase/SETUP_SLACK_WEBHOOKS_COMPLETE.sql` - Vault setup
- `supabase/SETUP_SLACK_WEBHOOK.sql` - Original setup (deprecated)
- `supabase/SETUP_STORAGE_REQUEST_TRIGGER.sql` - Generic trigger template

### Service Files
- `services/emailService.ts` - Email notifications via Resend
- `services/slackService.ts` - Client-side Slack (deprecated, use DB webhooks)
- `services/weatherService.ts` - Weather data fetching

### Edge Functions
- `supabase/functions/fetch-realtime-weather/index.ts`
- `supabase/functions/fetch-weather-forecast/index.ts`

### Configuration
- `.env` - `VITE_RESEND_API_KEY`, `VITE_SLACK_WEBHOOK_URL` (deprecated)
- `supabase/config.toml` - Edge function configuration

---

## Quality Standards

### Notification Delivery Checklist
- [ ] Notification sent within 5 seconds of trigger
- [ ] Rich formatting (Block Kit for Slack, HTML for email)
- [ ] Includes all relevant details (company, reference, quantity, dates)
- [ ] Action button/link to admin dashboard
- [ ] Graceful failure (log error, don't crash)
- [ ] Idempotent (safe to retry)

### Email Quality
- [ ] Professional HTML template
- [ ] Mobile-responsive design
- [ ] Clear subject line
- [ ] From address verified (SPF, DKIM)
- [ ] Unsubscribe link (if required by law)
- [ ] Test in Gmail, Outlook, Apple Mail

### Slack Message Quality
- [ ] Uses Block Kit (not plain text)
- [ ] Clear header with emoji
- [ ] Fields in 2-column layout
- [ ] Action required callout
- [ ] Link to relevant dashboard/page

---

## Common Patterns

### Trigger Pattern (Generic)
```sql
-- 1. Create notification function
CREATE OR REPLACE FUNCTION notify_event()
RETURNS trigger AS $$
DECLARE
  webhook_url TEXT;
  payload JSONB;
BEGIN
  -- Retrieve webhook URL from vault
  SELECT decrypted_secret INTO webhook_url
  FROM vault.decrypted_secrets
  WHERE name = 'webhook_url';

  -- Build payload
  payload := jsonb_build_object(
    'event', TG_TABLE_NAME,
    'data', row_to_json(NEW)
  );

  -- Send webhook
  PERFORM net.http_post(
    url := webhook_url,
    body := payload::text,
    headers := '{"Content-Type": "application/json"}'::jsonb
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Create trigger
CREATE TRIGGER on_event_trigger
AFTER INSERT OR UPDATE ON table_name
FOR EACH ROW
WHEN (NEW.status = 'ACTIVE')
EXECUTE FUNCTION notify_event();
```

---

### Email Send Pattern
```typescript
const sendEmail = async (to: string, subject: string, htmlBody: string) => {
  if (!RESEND_API_KEY) {
    console.warn('[Email] API key not set. Skipping email send.');
    return;
  }

  try {
    const response = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [to],
        subject: subject,
        html: htmlBody,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[Email] Send failed:', error);
      throw new Error(`Email send failed: ${error}`);
    }

    console.log('[Email] Sent successfully to:', to);
  } catch (error) {
    console.error('[Email] Error:', error);
    throw error;
  }
};
```

---

## Collaboration & Handoffs

### Works Closely With
- **Admin Operations Agent**: Trigger emails on approval/rejection
- **Customer Journey Agent**: Send milestone notifications
- **AI Services Agent**: Trigger manifest processing via webhooks
- **Deployment & DevOps Agent**: Deploy edge functions, configure webhooks

### Escalation Triggers
Hand off when:
- **Email not delivered**: Check Resend dashboard, verify domain
- **Slack webhook fails**: Check webhook URL in vault, verify channel permissions
- **Edge function crashes**: Deployment & DevOps Agent (logs, debugging)
- **Rate limit exceeded**: Implement queuing or upgrade plan

---

## Testing Checklist

### Slack Notification Tests
- [ ] New storage request triggers Slack message
- [ ] Message includes all fields (reference, company, quantity, dates)
- [ ] Block Kit formatting displays correctly
- [ ] Webhook URL retrieved from vault
- [ ] Trigger only fires for PENDING status (not drafts)
- [ ] Idempotent (retry doesn't duplicate message)

### Email Tests
- [ ] Approval email sent on approve
- [ ] Rejection email sent on reject
- [ ] HTML renders correctly in Gmail, Outlook
- [ ] Mobile-responsive design
- [ ] Links work (dashboard, contact)
- [ ] From address not flagged as spam

### Edge Function Tests
- [ ] Weather function returns current data
- [ ] CORS headers allow client-side calls
- [ ] API key loaded from environment
- [ ] Error handling (invalid input, API timeout)
- [ ] Logs visible in Supabase dashboard

### Edge Cases
- [ ] Webhook URL missing from vault (graceful failure)
- [ ] Resend API key invalid (log error, don't crash)
- [ ] Email address invalid (Resend returns 400)
- [ ] Network timeout (retry with backoff)

---

## Common Issues & Solutions

### Issue: Slack Notifications Not Working
**Problem**: New requests created but no Slack message
**Root Cause**: Missing trigger or incomplete function
**Solution**: Run RESTORE_SLACK_NOTIFICATIONS.sql migration
**File**: `supabase/RESTORE_SLACK_NOTIFICATIONS.sql`
**Verification**:
```sql
-- Check if trigger exists
SELECT * FROM pg_trigger WHERE tgname = 'on_storage_request_insert';

-- Check if function exists
SELECT * FROM pg_proc WHERE proname = 'notify_slack_storage_request';
```
**Reference**: CHANGELOG.md lines 12-19

---

### Issue: Email Stuck in Spam
**Problem**: Approval emails go to spam folder
**Root Cause**: Missing SPF/DKIM records for `pipevault@mpsgroup.ca`
**Solution**: Verify domain in Resend dashboard
**Steps**:
1. Log in to Resend dashboard
2. Go to Domains → Add Domain
3. Add DNS records (SPF, DKIM, DMARC)
4. Verify domain
5. Test email delivery

---

### Issue: Edge Function CORS Error
**Problem**: Client-side call to edge function blocked by CORS
**Root Cause**: Missing CORS headers in response
**Solution**: Add CORS headers to all responses
**Pattern**:
```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// Handle preflight
if (req.method === 'OPTIONS') {
  return new Response('ok', { headers: corsHeaders });
}

// Add to response
return new Response(JSON.stringify(data), {
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});
```

---

## Metrics & KPIs

### Notification Delivery
- **Slack Messages Sent**: Count per day
- **Email Delivery Rate**: % successfully delivered (via Resend webhooks)
- **Avg Delivery Time**: Seconds from trigger to delivery
- **Bounce Rate**: % of emails bounced (invalid address)

### Reliability
- **Uptime**: % of time webhooks responding
- **Error Rate**: % of notifications that fail
- **Retry Count**: # of retries needed per notification
- **Fallback Usage**: # of times fallback used (API unavailable)

### User Engagement
- **Email Open Rate**: % of approval emails opened
- **Click-Through Rate**: % of users who click dashboard link
- **Slack Response Time**: Minutes from notification to admin action

---

## Decision Records

### DR-001: Supabase Vault for Webhook URLs
**Date**: 2025-11-05
**Decision**: Store Slack webhook URL in Supabase Vault instead of .env
**Rationale**:
- Server-side execution (database triggers)
- Secure storage (encrypted at rest)
- No client-side exposure
- Easy rotation (update vault, no code deploy)
**Migration**: `SETUP_SLACK_WEBHOOKS_COMPLETE.sql`

### DR-002: Database Triggers Over Client-Side Webhooks
**Date**: 2025-11-05
**Decision**: Use database triggers instead of client-side Slack service
**Rationale**:
- Guaranteed execution (can't skip)
- No race conditions (atomic with DB transaction)
- Works even if frontend offline
- Secure (webhook URL not in client code)
**Files**: `RESTORE_SLACK_NOTIFICATIONS.sql`, `services/slackService.ts` (deprecated)

### DR-003: Resend for Email Delivery
**Date**: 2025-10-29
**Decision**: Use Resend API instead of SendGrid or AWS SES
**Rationale**:
- Simple API (single endpoint)
- Generous free tier (100 emails/day)
- Good deliverability (SPF/DKIM setup)
- React Email support (future use)
**Files**: `services/emailService.ts`

---

## Next Steps

### Short-term (This Week)
- [ ] Test Slack notifications end-to-end
- [ ] Verify approval/rejection emails delivered
- [ ] Add email failure logging (track bounces)
- [ ] Create notification event log table

### Medium-term (This Month)
- [ ] Implement delivery reminder emails (24hrs before)
- [ ] Add Slack notifications for delivery/pickup bookings
- [ ] Create email templates for all events
- [ ] Set up Resend webhooks (track opens/clicks)

### Long-term (This Quarter)
- [ ] SMS notifications via Twilio (critical events)
- [ ] Push notifications (mobile app)
- [ ] Webhook retry queue (handle transient failures)
- [ ] Notification preferences (let users choose channels)

---

**Agent Status**: ✅ Active
**Last Updated**: 2025-11-06
**Next Review**: 2025-11-13
**Primary Contact**: DevOps/Integration Team
