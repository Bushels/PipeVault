-- ============================================================================
-- COMPLETE SLACK INTEGRATION SETUP FOR PIPEVAULT
-- ============================================================================
-- This file configures Slack notifications for ALL key events in PipeVault:
-- 1. New user signups
-- 2. New storage requests
-- 3. Delivery bookings (to MPS)
-- 4. Pickup bookings (to site)
-- 5. Project completion
--
-- SETUP INSTRUCTIONS:
-- 1. Create a Slack Incoming Webhook (https://api.slack.com/messaging/webhooks)
-- 2. Go to Supabase Dashboard > Database > Webhooks
-- 3. Create webhooks using the configurations below
-- 4. For interactive notifications, create Supabase Edge Functions and update the URLs.
-- ============================================================================

-- ============================================================================
-- NOTIFICATION 1: NEW USER SIGNUP
-- ============================================================================
-- This trigger calls a webhook when a new user is created in auth.users.

CREATE OR REPLACE FUNCTION notify_slack_new_user()
RETURNS TRIGGER AS $$
DECLARE
  slack_webhook_url TEXT := 'YOUR_SLACK_WEBHOOK_URL'; -- IMPORTANT: Replace with your actual webhook URL
  user_first_name TEXT;
  user_last_name TEXT;
  user_company TEXT;
  user_phone TEXT;
  user_email TEXT;
  slack_payload JSONB;
BEGIN
  -- Extract user metadata
  user_first_name := COALESCE(NEW.raw_user_meta_data->>'first_name', 'N/A');
  user_last_name := COALESCE(NEW.raw_user_meta_data->>'last_name', '');
  user_company := COALESCE(NEW.raw_user_meta_data->>'company_name', 'N/A');
  user_phone := COALESCE(NEW.raw_user_meta_data->>'contact_number', 'N/A');
  user_email := COALESCE(NEW.email, 'N/A');

  -- Build Slack payload
  slack_payload := jsonb_build_object(
    'blocks', jsonb_build_array(
      jsonb_build_object(
        'type', 'header',
        'text', jsonb_build_object(
          'type', 'plain_text',
          'text', '👤 New User Signed Up',
          'emoji', true
        )
      ),
      jsonb_build_object(
        'type', 'section',
        'fields', jsonb_build_array(
          jsonb_build_object('type', 'mrkdwn', 'text', '*Company:*
' || user_company),
          jsonb_build_object('type', 'mrkdwn', 'text', '*Name:*
' || user_first_name || ' ' || user_last_name),
          jsonb_build_object('type', 'mrkdwn', 'text', '*Email:*
' || user_email),
          jsonb_build_object('type', 'mrkdwn', 'text', '*Contact:*
' || user_phone)
        )
      )
    )
  );

  -- Send to Slack using pg_net
  PERFORM net.http_post(
    url := slack_webhook_url,
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := slack_payload
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger to avoid duplicates
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create trigger for new user signups
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION notify_slack_new_user();

-- ============================================================================
-- NOTIFICATION 2: PIPE APPROVAL REQUEST
-- ============================================================================
-- This webhook triggers when a new storage_request is created with PENDING status.

/*
WEBHOOK CONFIGURATION:
Name: slack-new-storage-request
Table: storage_requests
Events: INSERT
Filter: status.eq.PENDING
Type: HTTP Request
Method: POST
URL: YOUR_SLACK_WEBHOOK_URL
HTTP Headers: Content-Type: application/json
Payload Template:
{
  "blocks": [
    {
      "type": "header",
      "text": { "type": "plain_text", "text": "🔔 New Pipe Approval Request", "emoji": true }
    },
    {
      "type": "section",
      "fields": [
        { "type": "mrkdwn", "text": "*Company:*
{{ record.request_details.companyName }}" },
        { "type": "mrkdwn", "text": "*Customer Name:*
{{ record.request_details.fullName }}" },
        { "type": "mrkdwn", "text": "*Pipe OD & Wt:*
{{ record.request_details.pipeOuterDiameter }} in, {{ record.request_details.pipeWeight }} lbs/ft" },
        { "type": "mrkdwn", "text": "*Pipe Length:*
{{ record.request_details.pipeLength }} ft" },
        { "type": "mrkdwn", "text": "*Total Joints:*
{{ record.request_details.totalJoints }}" }
      ]
    },
    {
      "type": "actions",
      "elements": [
        {
          "type": "button",
          "text": { "type": "plain_text", "text": "Review & Approve", "emoji": true },
          "style": "primary",
          "url": "https://kylegronning.github.io/PipeVault/"
        }
      ]
    }
  ]
}
*/

-- ============================================================================
-- NOTIFICATION 3: PIPE DELIVERY TO MPS REQUEST
-- ============================================================================
-- This webhook triggers on a new INBOUND trucking_load.

/*
WEBHOOK CONFIGURATION:
Name: slack-pipe-delivery-request
Table: trucking_loads
Events: INSERT
Filter: direction.eq.INBOUND
Type: HTTP Request
Method: POST
URL: YOUR_SLACK_WEBHOOK_URL
HTTP Headers: Content-Type: application/json
Payload Template:
{
  "blocks": [
    {
      "type": "header",
      "text": { "type": "plain_text", "text": "🚚 Pipe Delivery to MPS Request", "emoji": true }
    },
    {
      "type": "section",
      "text": { "type": "mrkdwn", "text": "A customer has requested to deliver pipe to the MPS yard." },
      "fields": [
        { "type": "mrkdwn", "text": "*Company:*
{{ record.contact_company }}" },
        { "type": "mrkdwn", "text": "*Trucking Company:*
{{ record.trucking_company }}" },
        { "type": "mrkdwn", "text": "*Requested Timeslot:*
{{ record.scheduled_slot_start }} to {{ record.scheduled_slot_end }}" }
      ]
    },
    {
      "type": "actions",
      "elements": [
        {
          "type": "button",
          "text": { "type": "plain_text", "text": "Approve Timeslot", "emoji": true },
          "style": "primary",
          "action_id": "approve_delivery_{{ record.id }}"
        },
        {
          "type": "button",
          "text": { "type": "plain_text", "text": "Reject", "emoji": true },
          "style": "danger",
          "action_id": "reject_delivery_{{ record.id }}"
        }
      ]
    }
  ]
}
-- Note: The action_id values will be handled by a Supabase Edge Function.
-- The URL for that function will need to be configured in the Slack App settings.
*/

-- ============================================================================
-- NOTIFICATION 4: PIPE PICKUP FROM MPS REQUEST
-- ============================================================================
-- This webhook triggers on a new OUTBOUND trucking_load.

/*
WEBHOOK CONFIGURATION:
Name: slack-pipe-pickup-request
Table: trucking_loads
Events: INSERT
Filter: direction.eq.OUTBOUND
Type: HTTP Request
Method: POST
URL: YOUR_SLACK_WEBHOOK_URL
HTTP Headers: Content-Type: application/json
Payload Template:
{
  "blocks": [
    {
      "type": "header",
      "text": { "type": "plain_text", "text": "📦 Pipe Pickup from MPS Request", "emoji": true }
    },
    {
      "type": "section",
      "text": { "type": "mrkdwn", "text": "A customer has requested to pick up pipe from the MPS yard." },
      "fields": [
        { "type": "mrkdwn", "text": "*Company:*
{{ record.contact_company }}" },
        { "type": "mrkdwn", "text": "*Destination:*
{{ record.well_name }}" },
        { "type": "mrkdwn", "text": "*Requested Timeslot:*
{{ record.scheduled_slot_start }} to {{ record.scheduled_slot_end }}" }
      ]
    },
    {
      "type": "actions",
      "elements": [
        {
          "type": "button",
          "text": { "type": "plain_text", "text": "Confirm Timeslot", "emoji": true },
          "style": "primary",
          "action_id": "confirm_pickup_{{ record.id }}"
        }
      ]
    }
  ]
}
-- Note: The action_id will be handled by a Supabase Edge Function.
*/

-- ============================================================================
-- NOTIFICATION 5: PROJECT COMPLETION
-- ============================================================================
-- This is triggered by a function that checks inventory after a pickup.

CREATE OR REPLACE FUNCTION notify_slack_project_complete()
RETURNS TRIGGER AS $$
DECLARE
  slack_webhook_url TEXT := 'YOUR_SLACK_WEBHOOK_URL'; -- IMPORTANT: Replace with your actual webhook URL
  remaining_inventory INT;
  request_company TEXT;
BEGIN
  -- Check if the load is an outbound pickup and is completed
  IF NEW.direction = 'OUTBOUND' AND NEW.status = 'COMPLETED' THEN
    -- Check for remaining inventory for this storage request
    SELECT COUNT(*)
    INTO remaining_inventory
    FROM inventory
    WHERE storage_request_id = NEW.storage_request_id AND status = 'IN_STORAGE';

    -- If no inventory is left, send notification
    IF remaining_inventory = 0 THEN
      SELECT c.name
      INTO request_company
      FROM storage_requests sr
      JOIN companies c ON sr.company_id = c.id
      WHERE sr.id = NEW.storage_request_id;

      PERFORM net.http_post(
        url := slack_webhook_url,
        headers := jsonb_build_object('Content-Type', 'application/json'),
        body := jsonb_build_object(
          'blocks', jsonb_build_array(
            jsonb_build_object(
              'type', 'section',
              'text', jsonb_build_object(
                'type', 'mrkdwn',
                'text', '✅ *Project Complete*
All pipe for project *' || NEW.storage_request_id || '* from company *' || request_company || '* has been moved out.'
              )
            )
          )
        )
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger to avoid duplicates
DROP TRIGGER IF EXISTS on_pickup_completion ON trucking_loads;

-- Create trigger to check for project completion after a pickup
CREATE TRIGGER on_pickup_completion
  AFTER UPDATE ON trucking_loads
  FOR EACH ROW
  EXECUTE FUNCTION notify_slack_project_complete();

-- ============================================================================
-- SETUP CHECKLIST
-- ============================================================================
/*
1.  [ ] Enable pg_net extension in Supabase SQL Editor: `CREATE EXTENSION IF NOT EXISTS pg_net;`
2.  [ ] Create a Slack Incoming Webhook and replace 'YOUR_SLACK_WEBHOOK_URL' in this file.
3.  [ ] Run this entire SQL script in the Supabase SQL Editor to create the triggers and functions.
4.  [ ] In the Supabase Dashboard, create the three webhooks for:
        - New Storage Request
        - Pipe Delivery Request
        - Pipe Pickup Request
        Use the payload templates provided in the comments above.
5.  [ ] Create and deploy the Supabase Edge Functions to handle interactive button clicks from Slack.
6.  [ ] Update the Slack App settings with the URLs of your Edge Functions.
*/