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

PipeVault sends real-time alerts to a designated Slack channel for all critical operational events, enabling the admin team to act quickly. The system uses a combination of Supabase Database Triggers and Webhooks for security and reliability.

### Notification Events

1.  **New User Signup:** When a new user creates an account.
2.  **Pipe Approval Request:** When a customer submits a new storage request.
3.  **Pipe Delivery Request:** When a customer wants to schedule a delivery to the MPS yard.
4.  **Pipe Pickup Request:** When a customer wants to schedule a pickup from the MPS yard.
5.  **Project Completion:** When all pipe from a customer's project has been picked up.

### Setup Instructions

**Step 1: Create a Slack Incoming Webhook**

1.  Go to `https://api.slack.com/apps`, create a new app called "PipeVault Notifications", and select your workspace.
2.  Enable **Incoming Webhooks** and add a new webhook to your desired channel (e.g., `#pipevault-notifications`).
3.  Copy the **Webhook URL**. You will use this for all the setups below.

**Step 2: Enable pg_net Extension**

The database triggers require the `pg_net` extension to make HTTP requests.

1.  Go to your Supabase Project > **SQL Editor**.
2.  Run the following command:
    ```sql
    CREATE EXTENSION IF NOT EXISTS pg_net;
    ```

**Step 3: Apply the Database Triggers**

1.  Open the `supabase/SETUP_SLACK_WEBHOOKS_COMPLETE.sql` file.
2.  Replace all instances of `YOUR_SLACK_WEBHOOK_URL` with the actual URL you copied in Step 1.
3.  Run the entire script in the Supabase **SQL Editor**. This will create the necessary functions and triggers for the "New User Signup" and "Project Completion" notifications.

**Step 4: Configure Supabase Webhooks**

For the remaining notifications, you will use the Supabase Webhooks interface.

1.  Go to your Supabase Project > **Database** > **Webhooks**.
2.  Create a new webhook for each of the following events, using the payload templates from the `supabase/SETUP_SLACK_WEBHOOKS_COMPLETE.sql` file.

*   **Pipe Approval Request:**
    *   **Name:** `slack-new-storage-request`
    *   **Table:** `storage_requests`
    *   **Events:** `INSERT`
    *   **Filter:** `status` -> `eq` -> `PENDING`
    *   **Payload:** Copy from the "NOTIFICATION 2" section of the SQL file.

*   **Pipe Delivery to MPS Request:**
    *   **Name:** `slack-pipe-delivery-request`
    *   **Table:** `trucking_loads`
    *   **Events:** `INSERT`
    *   **Filter:** `direction` -> `eq` -> `INBOUND`
    *   **Payload:** Copy from the "NOTIFICATION 3" section of the SQL file.

*   **Pipe Pickup from MPS Request:**
    *   **Name:** `slack-pipe-pickup-request`
    *   **Table:** `trucking_loads`
    *   **Events:** `INSERT`
    *   **Filter:** `direction` -> `eq` -> `OUTBOUND`
    *   **Payload:** Copy from the "NOTIFICATION 4" section of the SQL file.

**Step 5: Set Up Edge Functions for Interactive Notifications (Required for Delivery/Pickup)**

The "Approve Timeslot" and "Confirm Pickup" buttons in the Slack messages require backend functions to process the clicks.

1.  Create two new **Edge Functions** in your Supabase project:
    *   `approve-delivery-timeslot`
    *   `confirm-pickup-timeslot`
2.  Write the code for these functions to:
    *   Receive the `action_id` from Slack.
    *   Update the corresponding `dock_appointments` or `trucking_loads` table in the database.
    *   Use the `response_url` from Slack's callback to update the original message to a confirmed state (e.g., "Timeslot Approved!").
3.  In your Slack App settings (not in PipeVault), go to **Interactivity & Shortcuts** and set the **Request URL** to the URL of your new Edge Functions.

### Notification Flow Diagram

```
EVENT                   | TRIGGER MECHANISM         | SLACK ACTION
------------------------|---------------------------|------------------------------------
User Signs Up           | DB Trigger on auth.users  | Notify channel of new user
Pipe Request Submitted  | Webhook on storage_requests | Notify channel with link to admin panel
Delivery Requested      | Webhook on trucking_loads | Notify with "Approve" button -> Edge Function
Pickup Requested        | Webhook on trucking_loads | Notify with "Confirm" button -> Edge Function
Final Pipe Picked Up    | DB Trigger on trucking_loads| Notify channel that project is complete
```

### Troubleshooting Slack Notifications

*   **Notification Not Received:**
    1.  **Check Supabase Logs:** For webhook-based notifications, go to **Database > Webhooks** and check the **Logs** for the specific webhook. For trigger-based ones, check your database and function logs.
    2.  **Verify Webhook URL:** Ensure the URL in your SQL file and webhook configurations is correct.
    3.  **Check Filters:** Make sure the event (e.g., a new `trucking_loads` row) matches the filter conditions for the webhook.
*   **Interactive Button Fails:**
    1.  **Check Edge Function Logs:** Look for errors in the specific function's logs.
    2.  **Verify Slack Request URL:** Ensure the URL in your Slack App's "Interactivity & Shortcuts" settings points to the correct Edge Function.
    3.  **Check Permissions:** The Edge Function needs the correct permissions to update the database.