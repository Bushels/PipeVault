# Email Templates Guide

**How to add and update email notification templates**

**Last Updated:** 2025-11-17

---

## Overview

PipeVault uses **database triggers** → **notification queue** → **Edge Function** to send emails. This guide shows you how to:

1. Add email templates to the Edge Function
2. Create database triggers that queue emails
3. Test email notifications

---

## Email Template Locations

### Option 1: Edge Function Templates (Recommended)

**File**: `supabase/functions/process-notification-queue/index.ts`

**Why**: Centralized, runs server-side, secure

**How**: Add template logic in `sendEmail()` function

---

### Option 2: Frontend Email Service (For Direct Sends)

**File**: `services/emailService.ts`

**Why**: Used for immediate sends from frontend (rare)

**How**: Create new function like `sendApprovalEmail()`

---

## Adding Templates to Edge Function

### Step 1: Open Edge Function

File: `supabase/functions/process-notification-queue/index.ts`

### Step 2: Add Template in `sendEmail()` Function

Find the section with existing templates (around line 76) and add your new template:

```typescript
// Existing templates
if (notification.type === 'storage_request_approved') {
  // ... existing approval template
}

// ADD NEW TEMPLATE HERE
else if (notification.type === 'load_approved') {
  const { payload } = notification;

  htmlBody = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #10B981 0%, #059669 100%);
                  color: white; padding: 30px; text-align: center;
                  border-radius: 8px 8px 0 0; }
        .content { background: #ffffff; padding: 30px;
                   border: 1px solid #e5e7eb; }
        .details-box { background: #D1FAE5; padding: 15px;
                       border-radius: 8px; margin: 20px 0; }
        .footer { background: #f9fafb; padding: 20px; text-align: center;
                  font-size: 12px; color: #6b7280;
                  border-radius: 0 0 8px 8px; }
        .button { background: #10B981; color: white; padding: 12px 30px;
                  text-decoration: none; border-radius: 6px;
                  display: inline-block; margin: 20px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 style="margin: 0; font-size: 28px;">✅ Load #${payload.loadNumber} Approved!</h1>
          <p style="margin: 10px 0 0 0; font-size: 18px;">Your delivery is scheduled</p>
        </div>

        <div class="content">
          <p>Hi ${payload.companyName} team,</p>

          <p>Great news! Your <strong>Load #${payload.loadNumber}</strong> has been approved by our team.</p>

          <div class="details-box">
            <h3 style="margin-top: 0; color: #065F46;">📅 Delivery Details</h3>
            <ul style="list-style: none; padding: 0;">
              <li><strong>Date:</strong> ${payload.scheduledDate}</li>
              <li><strong>Time:</strong> ${payload.scheduledTime}</li>
              <li><strong>Location:</strong> MPS Facility, 123 Main St</li>
              <li><strong>Driver:</strong> ${payload.driverName} (${payload.driverPhone})</li>
              <li><strong>Trucking:</strong> ${payload.truckingCompany}</li>
              <li><strong>Expected:</strong> ${payload.totalJoints} joints</li>
            </ul>
          </div>

          <p><strong>What to Expect:</strong></p>
          <ul>
            <li>MPS will be ready to receive your delivery at the scheduled time</li>
            <li>Unload time: Approximately 2 hours</li>
            <li>You'll receive a confirmation email when unloading is complete</li>
            <li>Inventory will be automatically added to your dashboard</li>
          </ul>

          <center>
            <a href="https://kylegronning.github.io/PipeVault/" class="button">View Your Dashboard</a>
          </center>

          <p>Questions? Reply to this email or call us at (555) 867-5309.</p>

          <p><strong>The PipeVault Team</strong><br>MPS Group</p>
        </div>

        <div class="footer">
          <p>MPS Group | pipevault@mpsgroup.ca</p>
          <p>Project: ${payload.referenceId} | Load #${payload.loadNumber}</p>
        </div>
      </div>
    </body>
    </html>
  `.trim();

  textBody = `
✅ Load #${payload.loadNumber} Approved!

Hi ${payload.companyName} team,

Great news! Your Load #${payload.loadNumber} has been approved.

📅 Delivery Details:
- Date: ${payload.scheduledDate}
- Time: ${payload.scheduledTime}
- Location: MPS Facility, 123 Main St
- Driver: ${payload.driverName} (${payload.driverPhone})
- Trucking: ${payload.truckingCompany}
- Expected: ${payload.totalJoints} joints

What to Expect:
• MPS will be ready to receive your delivery at the scheduled time
• Unload time: Approximately 2 hours
• You'll receive confirmation when unloading is complete
• Inventory will be automatically added to your dashboard

View your dashboard: https://kylegronning.github.io/PipeVault/

Questions? Reply to this email or call (555) 867-5309.

The PipeVault Team
MPS Group

Project: ${payload.referenceId} | Load #${payload.loadNumber}
  `.trim();
}

else if (notification.type === 'load_completed') {
  const { payload } = notification;

  htmlBody = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #3B82F6 0%, #2563EB 100%);
                  color: white; padding: 30px; text-align: center;
                  border-radius: 8px 8px 0 0; }
        .content { background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; }
        .summary-box { background: #DBEAFE; padding: 15px;
                       border-radius: 8px; margin: 20px 0; }
        .project-totals { background: #F3F4F6; padding: 15px;
                         border-left: 4px solid #3B82F6; margin: 20px 0; }
        .footer { background: #f9fafb; padding: 20px; text-align: center;
                  font-size: 12px; color: #6b7280;
                  border-radius: 0 0 8px 8px; }
        .button { background: #3B82F6; color: white; padding: 12px 30px;
                  text-decoration: none; border-radius: 6px;
                  display: inline-block; margin: 20px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 style="margin: 0; font-size: 28px;">🎉 Load #${payload.loadNumber} Delivered!</h1>
          <p style="margin: 10px 0 0 0; font-size: 18px;">Your pipe has been unloaded and stored</p>
        </div>

        <div class="content">
          <p>Hi ${payload.companyName} team,</p>

          <p>Your pipe has been successfully delivered and stored at MPS!</p>

          <div class="summary-box">
            <h3 style="margin-top: 0; color: #1E40AF;">📦 Load #${payload.loadNumber} Summary</h3>
            <ul style="list-style: none; padding: 0;">
              <li><strong>Joints Received:</strong> ${payload.jointsReceived}</li>
              <li><strong>Total Length:</strong> ${payload.totalLength} feet</li>
              <li><strong>Total Weight:</strong> ${payload.totalWeight} tonnes</li>
              <li><strong>Storage Rack:</strong> ${payload.rackLocation}</li>
              <li><strong>Completed:</strong> ${new Date(payload.completedAt).toLocaleString()}</li>
            </ul>
          </div>

          <div class="project-totals">
            <h3 style="margin-top: 0;">📊 Project Totals (${payload.referenceId})</h3>
            <ul style="list-style: none; padding: 0;">
              <li><strong>Total Joints in Storage:</strong> ${payload.projectTotalJoints}</li>
              <li><strong>Storage Racks:</strong> ${payload.rackLocation}</li>
            </ul>
          </div>

          <p><strong>What's Next?</strong></p>
          <ul>
            <li>View your complete inventory in the PipeVault dashboard</li>
            <li>You can now book your next load if needed</li>
            <li>Track your pipe storage timeline</li>
          </ul>

          <center>
            <a href="https://kylegronning.github.io/PipeVault/" class="button">View Inventory</a>
          </center>

          <p>Questions about your inventory? Reply to this email.</p>

          <p><strong>The PipeVault Team</strong><br>MPS Group</p>
        </div>

        <div class="footer">
          <p>MPS Group | pipevault@mpsgroup.ca</p>
          <p>Project: ${payload.referenceId} | Load #${payload.loadNumber}</p>
        </div>
      </div>
    </body>
    </html>
  `.trim();

  textBody = `
🎉 Load #${payload.loadNumber} Delivered!

Hi ${payload.companyName} team,

Your pipe has been successfully delivered and stored at MPS!

📦 Load #${payload.loadNumber} Summary:
- Joints Received: ${payload.jointsReceived}
- Total Length: ${payload.totalLength} feet
- Total Weight: ${payload.totalWeight} tonnes
- Storage Rack: ${payload.rackLocation}
- Completed: ${new Date(payload.completedAt).toLocaleString()}

📊 Project Totals (${payload.referenceId}):
- Total Joints in Storage: ${payload.projectTotalJoints}
- Storage Racks: ${payload.rackLocation}

What's Next?
• View your complete inventory in the PipeVault dashboard
• You can now book your next load if needed
• Track your pipe storage timeline

View your inventory: https://kylegronning.github.io/PipeVault/

Questions? Reply to this email.

The PipeVault Team
MPS Group

Project: ${payload.referenceId} | Load #${payload.loadNumber}
  `.trim();
}

else if (notification.type === 'load_in_transit') {
  const { payload } = notification;

  htmlBody = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #F59E0B 0%, #D97706 100%);
                  color: white; padding: 30px; text-align: center;
                  border-radius: 8px 8px 0 0; }
        .content { background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; }
        .details-box { background: #FEF3C7; padding: 15px;
                       border-radius: 8px; margin: 20px 0; }
        .footer { background: #f9fafb; padding: 20px; text-align: center;
                  font-size: 12px; color: #6b7280;
                  border-radius: 0 0 8px 8px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 style="margin: 0; font-size: 28px;">🚛 Load #${payload.loadNumber} En Route</h1>
          <p style="margin: 10px 0 0 0; font-size: 18px;">Your delivery is on the way!</p>
        </div>

        <div class="content">
          <p>Hi ${payload.companyName} team,</p>

          <p>Your <strong>Load #${payload.loadNumber}</strong> is currently en route to MPS!</p>

          <div class="details-box">
            <h3 style="margin-top: 0; color: #92400E;">🚚 Delivery Status</h3>
            <ul style="list-style: none; padding: 0;">
              <li><strong>Driver:</strong> ${payload.driverName} (${payload.driverPhone})</li>
              <li><strong>ETA:</strong> ${payload.eta}</li>
              <li><strong>Expected:</strong> ${payload.totalJoints} joints</li>
            </ul>
          </div>

          <p>We'll send you another email when the truck arrives and unloading is complete.</p>

          <p><strong>The PipeVault Team</strong><br>MPS Group</p>
        </div>

        <div class="footer">
          <p>MPS Group | pipevault@mpsgroup.ca</p>
          <p>Project: ${payload.referenceId} | Load #${payload.loadNumber}</p>
        </div>
      </div>
    </body>
    </html>
  `.trim();

  textBody = `
🚛 Load #${payload.loadNumber} En Route

Hi ${payload.companyName} team,

Your Load #${payload.loadNumber} is currently en route to MPS!

🚚 Delivery Status:
- Driver: ${payload.driverName} (${payload.driverPhone})
- ETA: ${payload.eta}
- Expected: ${payload.totalJoints} joints

We'll send you another email when the truck arrives and unloading is complete.

The PipeVault Team
MPS Group

Project: ${payload.referenceId} | Load #${payload.loadNumber}
  `.trim();
}
```

### Step 3: Deploy Updated Edge Function

```bash
npx supabase functions deploy process-notification-queue
```

---

## How It Works (Step-by-Step)

### Example: Admin Approves Load #1

**1. Admin clicks "Approve Load"** in PipeVault

**2. Frontend updates database:**
```typescript
await supabase
  .from('trucking_loads')
  .update({ status: 'APPROVED', approved_at: NOW() })
  .eq('id', load_id);
```

**3. Database trigger fires automatically:**
```sql
-- trigger_load_approved_email fires
-- Executes notify_load_approved() function
```

**4. Function inserts into notification_queue:**
```sql
INSERT INTO notification_queue (
  type: 'load_approved',
  payload: {
    userEmail: 'john@apexdrilling.com',
    companyName: 'Apex Drilling',
    referenceId: 'REF-2025001',
    loadNumber: 1,
    scheduledDate: 'Monday, January 15, 2025',
    scheduledTime: '9:00 AM',
    ...
  }
);
```

**5. Edge Function runs (every 5 min):**
```typescript
// Fetches unprocessed notifications
const notifications = await supabase
  .from('notification_queue')
  .select('*')
  .eq('processed', false);

// Sends email for each notification
for (const notification of notifications) {
  await sendEmail(notification);

  // Mark as processed
  await supabase
    .from('notification_queue')
    .update({ processed: true })
    .eq('id', notification.id);
}
```

**6. Customer receives email ✅**

---

## Testing Email Notifications

### Option 1: Test in Development (Console Logs)

If `VITE_RESEND_API_KEY` is not set, emails log to console:

```bash
npm run dev
```

Then approve a load in the UI. Check browser console:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📧 EMAIL (Development Mode)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
To: john@apexdrilling.com
Subject: Load #1 Approved - Delivery Monday, January 15 at 9:00 AM
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Text Body:
✅ Load #1 Approved!
...
```

---

### Option 2: Test with Real Emails

1. **Set Resend API key:**
   ```bash
   # .env
   VITE_RESEND_API_KEY=re_123456789
   ```

2. **Approve a test load** in the UI

3. **Wait 5 minutes** for Edge Function to process queue

4. **Check your email**

---

### Option 3: Manually Trigger Edge Function

Force immediate processing (don't wait 5 minutes):

```bash
npx supabase functions invoke process-notification-queue
```

Output:
```json
{
  "message": "Notification processing complete",
  "success": 1,
  "failed": 0,
  "skipped": 0,
  "errors": []
}
```

---

## Verifying Triggers Are Working

### Check Notification Queue

```sql
-- See all queued emails
SELECT
  type,
  payload->>'userEmail' as recipient,
  payload->>'subject' as subject,
  processed,
  created_at
FROM notification_queue
ORDER BY created_at DESC
LIMIT 10;
```

**Expected**: After approving a load, you should see a row with `type = 'load_approved'`

---

### Check Trigger Exists

```sql
SELECT
  trigger_name,
  event_object_table,
  action_timing,
  event_manipulation
FROM information_schema.triggers
WHERE trigger_name LIKE '%email%';
```

**Expected**: See triggers like:
- `trigger_load_approved_email`
- `trigger_load_completed_email`
- `trigger_load_in_transit_email`

---

## Common Issues

### Issue: Emails Not Sending

**Check 1**: Is Resend API key set?
```bash
# Supabase Dashboard → Edge Functions → Secrets
RESEND_API_KEY=re_xxxxx
```

**Check 2**: Is notification in queue?
```sql
SELECT * FROM notification_queue WHERE processed = false;
```

**Check 3**: Is Edge Function running?
```bash
npx supabase functions invoke process-notification-queue
```

---

### Issue: Trigger Not Firing

**Check**: Does trigger exist?
```sql
SELECT * FROM information_schema.triggers
WHERE trigger_name = 'trigger_load_approved_email';
```

**Fix**: Re-run migration
```bash
# In Supabase SQL Editor
\i supabase/migrations/20251117000001_add_load_approval_email_trigger.sql
```

---

### Issue: Email Content Wrong

**Check**: View queued payload
```sql
SELECT payload FROM notification_queue
WHERE type = 'load_approved'
ORDER BY created_at DESC
LIMIT 1;
```

**Fix**: Update trigger function to include correct fields

---

## Next Steps

1. ✅ **Apply Migration**: Run `20251117000001_add_load_approval_email_trigger.sql` in Supabase SQL Editor

2. ✅ **Update Edge Function**: Add email templates (copy from this guide)

3. ✅ **Deploy Edge Function**:
   ```bash
   npx supabase functions deploy process-notification-queue
   ```

4. ✅ **Test**: Approve a test load and verify email is queued

5. ✅ **Verify**: Check notification_queue table

---

**Questions?** Check [TROUBLESHOOTING.md](../../TROUBLESHOOTING.md) or email support@mpsgroup.ca
