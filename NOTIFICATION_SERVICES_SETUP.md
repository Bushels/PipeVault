# Notification Services Setup Guide

## Overview

PipeVault includes three notification systems to keep customers and admins informed:

1. **Approval/Rejection Emails** - Sends celebratory approval or empathetic rejection emails to customers
2. **Sign-up Confirmation Emails** - Professional welcome emails for new users (configured in Supabase)
3. **Slack Notifications** - Real-time notifications to admin Slack channel when new requests are submitted

All services gracefully fall back to console logging in development mode when API keys are not configured.

---

## 1. Email Notifications (Resend API)

### What Gets Sent

**Approval Email:**
- Subject: "Congratulations! Your FREE Pipe Storage has been Approved! 🎉"
- Celebrates 20 Years of MPS Group
- Shows assigned storage location prominently
- Includes "What's Next" steps with dashboard link
- Sent to: Customer's email (`request.userId`)

**Rejection Email:**
- Subject: "Update on Your PipeVault Storage Request (Reference ID)"
- Professional, empathetic tone
- Explains rejection reason
- Provides next steps (contact support, resubmit)
- Sent to: Customer's email

### Setup Instructions

1. **Create a Resend Account**
   - Go to https://resend.com
   - Sign up for a free account
   - Verify your sending domain (pipevault@mpsgroup.ca)

2. **Get Your API Key**
   - Navigate to **API Keys** in Resend dashboard
   - Click **Create API Key**
   - Copy the key (starts with `re_`)

3. **Configure PipeVault**
   - Open your `.env` file
   - Add: `VITE_RESEND_API_KEY=re_your_actual_key_here`
   - Save and restart your dev server

4. **Verify Domain**
   - In Resend dashboard, go to **Domains**
   - Add `mpsgroup.com` as a verified domain
   - Add the required DNS records (SPF, DKIM, DMARC)
   - Wait for verification (can take up to 48 hours)

### Testing

**Development Mode (No API Key):**
```bash
# Emails will log to console instead
npm run dev

# Submit a test request, approve it, check console output:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📧 EMAIL (Development Mode - Configure VITE_RESEND_API_KEY)
To: customer@example.com
Subject: Congratulations! Your FREE Pipe Storage has been Approved! 🎉
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Production Mode (With API Key):**
```bash
# Real emails will be sent
1. Configure VITE_RESEND_API_KEY in .env
2. Restart server: npm run dev
3. Submit a test request
4. Approve it from admin dashboard
5. Check customer's email inbox
6. Check browser console for: "✅ Email sent successfully: <email_id>"
```

### Email Service Files

- **`services/emailService.ts`** - Email sending logic
  - `sendApprovalEmail()` - Sends approval celebration email
  - `sendRejectionEmail()` - Sends rejection email with reason
  - `sendEmail()` - Helper that handles Resend API calls with fallback

- **`App.tsx`** (Lines 129-131, 144-145)
  - Calls email service after approval/rejection

### Customization

To customize email templates, edit `services/emailService.ts`:
- HTML templates include inline CSS for email client compatibility
- Plain text versions for clients that don't support HTML
- MPS Group branding (red gradients, 20 Years messaging)

---

## 2. Sign-up Confirmation Emails (Supabase)

### What Gets Sent

**Welcome Email:**
- Subject: "Welcome to PipeVault - Confirm Your Email 🎉"
- Celebrates 20 Years of MPS Group
- Highlights FREE storage promotion
- Clear email confirmation button
- Lists PipeVault benefits

### Setup Instructions

1. **Access Supabase Dashboard**
   - Go to https://app.supabase.com
   - Select your PipeVault project

2. **Navigate to Email Templates**
   - Left sidebar: **Authentication** → **Email Templates**
   - Select **Confirm signup** template

3. **Update Template**
   - Copy the HTML template from the conversation above
   - Paste into the **HTML Body** field
   - Copy the plain text version
   - Paste into the **Plain Text Body** field
   - Update **Subject Line** to: `Welcome to PipeVault - Confirm Your Email 🎉`
   - Click **Save**

4. **Test the Flow**
   - Create a new test user account
   - Check the email inbox
   - Verify branding and formatting

### Template Variables

Supabase provides these variables for the template:
- `{{ .ConfirmationURL }}` - Email confirmation link
- `{{ .Email }}` - Recipient's email address
- `{{ .Token }}` - Confirmation token (if needed separately)

---

## 3. Slack Notifications (via Supabase Webhooks)

### What Gets Sent

**New Request Notification:**
- Sent when: Customer submits a new storage request (automatically via database trigger)
- Includes:
  - Project Reference ID
  - Status
  - Contact Email
  - Button linking to PipeVault Admin Dashboard
  - Timestamp of submission

### Setup Instructions (Recommended: Supabase Database Webhooks)

**Why Supabase Webhooks?**
- ✅ More secure (webhook URL not exposed in frontend code)
- ✅ More reliable (server-side, guaranteed delivery)
- ✅ Automatic retries on failure
- ✅ No client-side code or environment variables needed

**Step 1: Create a Slack Incoming Webhook**
1. Go to https://api.slack.com/apps
2. Click **Create New App** → **From scratch**
3. Name: "PipeVault Notifications"
4. Select your workspace
5. Click **Incoming Webhooks** in sidebar
6. Toggle **Activate Incoming Webhooks** to **On**
7. Click **Add New Webhook to Workspace**
8. Select the channel (e.g., `#pipevault-requests`)
9. Click **Allow**
10. Copy the webhook URL (starts with `https://hooks.slack.com/services/...`)

**Step 2: Configure Supabase Database Webhook**
1. Go to https://app.supabase.com
2. Select your PipeVault project
3. Navigate to **Database** → **Webhooks** in left sidebar
4. Click **Create a new hook** or **Enable Webhooks**
5. Configure webhook:

   **Basic Settings:**
   - **Name**: `slack-new-storage-request`
   - **Table**: `storage_requests`
   - **Events**: Check **INSERT** only
   - **Type**: `HTTP Request`
   - **Method**: `POST`
   - **URL**: Paste your Slack webhook URL
   - **HTTP Headers**:
     ```
     Content-Type: application/json
     ```

   **Payload Template** (copy this exactly):
   ```json
   {
     "blocks": [
       {
         "type": "header",
         "text": {
           "type": "plain_text",
           "text": "🔔 New Storage Request Submitted",
           "emoji": true
         }
       },
       {
         "type": "section",
         "fields": [
           {
             "type": "mrkdwn",
             "text": "*Project Reference:*\n{{ record.reference_id }}"
           },
           {
             "type": "mrkdwn",
             "text": "*Status:*\n{{ record.status }}"
           },
           {
             "type": "mrkdwn",
             "text": "*Contact Email:*\n{{ record.user_email }}"
           }
         ]
       },
       {
         "type": "section",
         "text": {
           "type": "mrkdwn",
           "text": "⏰ *Action Required:* Review and approve this request in the PipeVault Admin Dashboard."
         }
       },
       {
         "type": "actions",
         "elements": [
           {
             "type": "button",
             "text": {
               "type": "plain_text",
               "text": "🔍 Review in PipeVault",
               "emoji": true
             },
             "url": "https://kylegronning.github.io/PipeVault/",
             "style": "primary"
           }
         ]
       }
     ]
   }
   ```

   **Conditions** (optional but recommended):
   - Add filter: `status = 'PENDING'` to only notify for pending requests (not drafts)

6. Click **Save** or **Create**

**Step 3: Test the Webhook**
1. Submit a test storage request from the customer dashboard
2. Check your Slack channel - you should receive a notification immediately
3. If it doesn't work:
   - Go to Supabase **Database** → **Webhooks** → Click your webhook → Check **Logs** tab
   - Verify the webhook URL is correct
   - Verify the payload template is valid JSON

### Alternative Method: Database Trigger (Advanced)

If Supabase webhooks aren't available in your plan, see `supabase/SETUP_SLACK_WEBHOOK.sql` for a database trigger implementation using the `pg_net` extension.

### Setup Files

- **`supabase/SETUP_SLACK_WEBHOOK.sql`** - Complete setup documentation
  - Webhook configuration template with full payload example
  - Alternative database trigger implementation for advanced users
  - Test queries and verification steps

- **`components/StorageRequestWizard.tsx`** (Line 252)
  - No client-side code needed - webhook handles it automatically
  - Comment indicates Supabase webhook integration

### Customization

**To customize Slack messages:**
1. Go to Supabase Dashboard → Database → Webhooks
2. Edit your `slack-new-storage-request` webhook
3. Modify the **Payload Template** JSON
4. Save changes
5. Test by submitting a new request

**Design custom layouts** with Slack's Block Kit Builder: https://api.slack.com/block-kit/building

**Available Supabase Variables:**
- `{{ record.column_name }}` - Access any column from the inserted row
- `{{ record.reference_id }}` - Project reference
- `{{ record.user_email }}` - Customer email
- `{{ record.status }}` - Request status
- `{{ record.created_at }}` - Timestamp
- See your database schema for all available columns

---

## Environment Variables Summary

Update your `.env` file with these values:

```env
# Supabase Configuration
VITE_SUPABASE_URL=your_project_url_here
VITE_SUPABASE_ANON_KEY=your_anon_key_here

# AI API Keys
VITE_ANTHROPIC_API_KEY=your_anthropic_key_here
VITE_GOOGLE_AI_API_KEY=your_google_ai_key_here

# Email Service (Resend) - For approval/rejection emails
VITE_RESEND_API_KEY=re_your_resend_key_here

# Note: Slack webhook is configured in Supabase Dashboard (not in .env)
# See Section 3 above for Supabase webhook setup instructions
```

**Important:** Never commit your `.env` file to version control! The `.env.example` file is provided as a template.

---

## Notification Flow Diagram

```
Customer submits request
        ↓
    [Frontend → Supabase INSERT]
        ↓
    [Supabase Database]
        ↓
        ├─→ Database Webhook (automatic)
        │   ↓
        │   Slack Notification → #pipevault-requests channel
        │
Admin approves/rejects (via Admin Dashboard)
        ↓
    [Frontend → Supabase UPDATE]
        ↓
    [App.tsx calls emailService]
        ↓
    [Email via Resend API]:
        • Approval: Celebration email with storage location
        • Rejection: Professional email with reason and next steps
```

**Key Architecture Benefits:**
- ✅ Slack: Server-side via Supabase webhooks (secure, reliable)
- ✅ Email: Frontend-initiated but Resend handles delivery (fallback logging in dev)
- ✅ No webhook URLs exposed in client-side code

---

## Troubleshooting

### Emails Not Sending

1. **Check API Key**
   - Verify `VITE_RESEND_API_KEY` is set correctly in `.env`
   - Key should start with `re_`
   - Restart dev server after updating

2. **Check Domain Verification**
   - Go to Resend dashboard → Domains
   - Ensure `mpsgroup.com` is verified (green checkmark)
   - If not verified, add DNS records and wait

3. **Check Browser Console**
   - Look for: `❌ Failed to send email: <error message>`
   - Common issues:
     - `401 Unauthorized` - Invalid API key
     - `403 Forbidden` - Domain not verified
     - `422 Unprocessable Entity` - Invalid email address

4. **Check Fallback Logging**
   - If API fails, emails log to console as fallback
   - Look for: `📧 EMAIL (Fallback - API Failed)`

### Slack Notifications Not Sending

**Since Slack is configured via Supabase webhooks (not client-side), troubleshoot in Supabase Dashboard:**

1. **Check Webhook Configuration**
   - Go to Supabase Dashboard → Database → Webhooks
   - Find your `slack-new-storage-request` webhook
   - Verify it's **Enabled** (toggle should be on)
   - Verify **Table** is set to `storage_requests`
   - Verify **Events** has **INSERT** checked

2. **Check Webhook URL**
   - In the webhook settings, verify the URL is correct
   - Should start with `https://hooks.slack.com/services/`
   - Test the webhook URL directly with curl:
   ```bash
   curl -X POST https://hooks.slack.com/services/YOUR/WEBHOOK/URL \
     -H 'Content-Type: application/json' \
     -d '{"text":"Test from PipeVault"}'
   ```
   - Should receive "ok" response

3. **Check Webhook Logs**
   - In Supabase Dashboard → Database → Webhooks
   - Click on your webhook → Click **Logs** tab
   - Look for recent execution attempts
   - Check for error messages:
     - `404 Not Found` - Webhook URL is invalid
     - `410 Gone` - Webhook was revoked in Slack
     - `Invalid JSON` - Payload template has syntax errors
     - `Timeout` - Slack API is slow or down

4. **Test with a Request**
   - Submit a test storage request from the customer dashboard
   - Immediately check Supabase webhook logs
   - Should see a successful POST request
   - Check your Slack channel for the notification

5. **Verify Payload Template**
   - In webhook settings, check the **Payload Template** JSON
   - Ensure it's valid JSON (no trailing commas, proper quotes)
   - Use a JSON validator if needed: https://jsonlint.com
   - Make sure variables like `{{ record.reference_id }}` match your database column names

6. **Check Slack App Permissions**
   - Go to https://api.slack.com/apps → Your app
   - Verify the webhook is still active (not revoked)
   - If webhook was recreated, update the URL in Supabase

### Sign-up Emails Not Arriving

1. **Check Supabase Email Settings**
   - Go to Supabase Dashboard → Authentication → Email Templates
   - Ensure template is saved correctly
   - Check that email auth is enabled

2. **Check Spam Folder**
   - Confirmation emails might be marked as spam
   - Add noreply@supabase.com or your custom domain to safe senders

3. **Check Rate Limits**
   - Supabase has rate limits on emails
   - Check project quota in dashboard

---

## Production Deployment Checklist

Before deploying to production (GitHub Pages):

**Email Configuration:**
- [ ] Configure `VITE_RESEND_API_KEY` with production API key
- [ ] Verify Resend domain (mpsgroup.com) in production
- [ ] Update Supabase email templates with production branding
- [ ] Test email delivery to real customer emails
- [ ] Set up email bounce handling (optional)

**Slack Configuration:**
- [ ] Create production Slack webhook (or use same webhook for dev/prod)
- [ ] Configure Supabase Database Webhook in production project
- [ ] Update Slack button URL in webhook payload to production dashboard URL
- [ ] Test Slack notifications by submitting a test request
- [ ] Verify webhook logs show successful deliveries

**General:**
- [ ] Monitor error rates in browser console
- [ ] Check Supabase webhook logs periodically
- [ ] Set up monitoring for failed Slack webhooks (optional)

---

## Cost Considerations

### Resend Pricing
- Free tier: 3,000 emails/month
- Pro tier: $20/month for 50,000 emails
- Pay-as-you-go: $0.001 per email after quota

### Slack Webhook
- **Free** - Slack webhooks have no cost
- Unlimited messages
- No rate limits for normal usage

---

## Support

If you encounter issues:

1. Check browser console for error messages
2. Check this guide's troubleshooting section
3. Verify all environment variables are set correctly
4. Test in development mode (console logging) first
5. Contact Resend support for email delivery issues
6. Check Slack API documentation for webhook issues

---

**Last Updated:** October 30, 2025
