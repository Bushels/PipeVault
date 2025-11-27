# Notification Services Setup Guide

## Overview

PipeVault uses a combination of emails and Slack messages to keep customers and administrators informed at every stage of the pipe storage lifecycle.

1.  **Email Notifications (Resend):** For customer-facing communication like approvals and rejections.
2.  **Sign-up Emails (Supabase):** Default emails for account verification.
3.  **Slack Notifications (Supabase Triggers & Webhooks):** For real-time admin alerts for all major workflow events.

---

## 1. Email Notifications (Resend API)

This service handles direct communication with customers for critical status changes to their requests.

*   **Approval Email:** A celebratory email showing the assigned storage location.
*   **Rejection Email:** A professional and empathetic email explaining the reason for rejection.

For setup, see the original documentation. No changes are needed for this service.

---

## 2. Sign-up Confirmation Emails (Supabase)

This is the default Supabase authentication email for new users to confirm their email address.

For setup, see the original documentation. No changes are needed for this service.

---

## 3. Slack Notifications

PipeVault sends real-time alerts to a designated Slack channel for all critical operational events using **Supabase Database Triggers** (System 1 architecture). All notifications are server-side, secure, and logged.

### Notification Events

1.  **New User Signup:** Customer creates account with full name, email, company, contact number
2.  **New Storage Request:** Customer submits pipe storage request with customer name, company, pipe specs (size, length, quantity), and storage dates
3.  **Inbound Load Booking:** Customer books delivery to MPS facility with date/time, load number, and off-hours indicator
4.  **Project Completion:** All pipe from a customer's project has been picked up from storage

### Setup Instructions (System 1 - Database Triggers)

**Step 1: Create a Slack Incoming Webhook**

1.  Go to `https://api.slack.com/apps`, create a new app called "PipeVault Notifications", and select your workspace.
2.  Enable **Incoming Webhooks** and add a new webhook to your desired channel (e.g., `#pipevault-notifications`).
3.  Copy the **Webhook URL**. You will use this in the next step.

**Step 2: Store Webhook URL in Supabase Vault**

1.  Go to your Supabase Project > **SQL Editor**.
2.  Run the following command to store the webhook URL securely:
    ```sql
    INSERT INTO vault.secrets (name, secret)
    VALUES ('slack_webhook_url', 'https://hooks.slack.com/services/YOUR/WEBHOOK/URL');
    ```
3.  Replace `YOUR/WEBHOOK/URL` with the actual webhook URL from Step 1.

**Step 3: Enable pg_net Extension**

The database triggers require the `pg_net` extension to make HTTP requests.

1.  In Supabase **SQL Editor**, run:
    ```sql
    CREATE EXTENSION IF NOT EXISTS pg_net;
    ```

**Step 4: Apply Database Triggers**

1.  Locate the migration files in `supabase/migrations/` directory:
    *   `20251107000001_activate_slack_notification_trigger.sql` (storage requests)
    *   `20251107000002_activate_new_user_slack_notification_trigger.sql` (user signups)
    *   `20251107000003_activate_project_complete_slack_notification_trigger.sql` (project completion)

2.  Run each migration file in the Supabase **SQL Editor** (or use `supabase db push` via CLI).

3.  These create:
    *   `notify_slack_new_user()` function + trigger on `auth.users`
    *   `notify_slack_storage_request()` function + trigger on `storage_requests`
    *   `notify_slack_project_complete()` function + trigger on `trucking_loads`

**Step 5: Test Notifications**

1.  **New User Signup**: Create a new account → Verify Slack notification shows name, company, email
2.  **Storage Request**: Submit a storage request → Verify Slack notification shows customer details and pipe specs
3.  **Load Booking**: Book inbound delivery → Verify Slack notification shows date/time and load number
4.  Check Supabase **Database → Functions** for execution logs

### Notification Architecture (System 1)

```
EVENT                   | TRIGGER MECHANISM                     | NOTIFICATION CONTENT
------------------------|---------------------------------------|--------------------------------
User Signs Up           | DB Trigger on auth.users INSERT      | Name, company, email, user ID
Storage Request         | DB Trigger on storage_requests       | Customer, company, pipe specs,
                        | INSERT/UPDATE (status=PENDING)       | dates, reference ID
Load Booking            | Client-side slackService call        | Date/time, load #, off-hours badge
                        | (sendInboundDeliveryNotification)    | customer, company
Final Pipe Picked Up    | DB Trigger on trucking_loads UPDATE  | Project ID, company, completion
                        | (direction=OUTBOUND, inventory=0)    | confirmation
```

**Why Database Triggers?**
- ✅ Secure: Webhook URL never exposed in client code
- ✅ Reliable: Server-side execution with automatic retries
- ✅ Guaranteed: Notifications sent even if user closes browser
- ✅ Logged: All executions visible in Supabase Dashboard

### Troubleshooting Slack Notifications

*   **Notification Not Received:**
    1.  **Check Supabase Logs:** Go to **Database → Functions** and look for execution logs of `notify_slack_*` functions
    2.  **Verify Vault Secret:** Ensure `slack_webhook_url` exists in Vault with correct URL
    3.  **Check pg_net Extension:** Run `SELECT * FROM pg_extension WHERE extname = 'pg_net';` to verify installed
    4.  **Verify Triggers Exist:** Query `SELECT * FROM pg_trigger WHERE tgname LIKE '%slack%';` to confirm triggers created
    5.  **Test Manual Call:** Run `SELECT notify_slack_new_user();` to test function directly

*   **Wrong or Missing Data in Notification:**
    1.  **Verify Metadata Extraction:** Check `auth.users.raw_user_meta_data` contains firstName, lastName, companyName
    2.  **Check Request Details:** Ensure `storage_requests.request_details` JSONB contains fullName, companyName, casingSpec
    3.  **Inspect Function Code:** Review SQL migration files for correct JSONB field extraction

*   **Duplicate Notifications:**
    1.  **Check for Multiple Triggers:** Run `SELECT tgname, tgtable FROM pg_trigger WHERE tgname LIKE '%slack%';`
    2.  **Remove Old Triggers:** Drop any duplicate triggers from System 2 migration
    3.  **Verify Only One Execution:** Check Supabase function logs for duplicate calls