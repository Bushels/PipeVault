-- ============================================================================
-- SUPABASE SLACK INTEGRATION VIA DATABASE WEBHOOKS
-- ============================================================================
-- This sets up automatic Slack notifications when new storage requests are created
-- using Supabase's native webhook functionality (more secure than client-side calls)
--
-- SETUP INSTRUCTIONS:
-- 1. Create a Slack Incoming Webhook (https://api.slack.com/messaging/webhooks)
-- 2. Go to Supabase Dashboard > Database > Webhooks
-- 3. Click "Create a new hook"
-- 4. Configure with the settings below
-- ============================================================================

-- Note: This file documents the webhook configuration.
-- The actual webhook is created through the Supabase UI, not SQL.

/*
WEBHOOK CONFIGURATION (to be entered in Supabase Dashboard):

Name: slack-new-storage-request
Table: storage_requests
Events: INSERT
Type: HTTP Request
Method: POST
URL: https://hooks.slack.com/services/YOUR/WEBHOOK/URL
HTTP Headers:
  Content-Type: application/json

Payload Template:
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
        },
        {
          "type": "mrkdwn",
          "text": "*Created:*\n<!date^{{ record.created_at }}^{date_short_pretty} at {time}|just now>"
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

Conditions (optional):
  - Only send when status = 'PENDING' to avoid notifications for draft saves
  - Filter: status.eq.PENDING

*/

-- ============================================================================
-- ALTERNATIVE: Database Function + Trigger (if webhooks don't work)
-- ============================================================================
-- If Supabase webhooks aren't available in your plan, you can use pg_net extension
-- This requires the pg_net extension to be enabled

-- Step 1: Enable pg_net extension (run in SQL Editor)
-- CREATE EXTENSION IF NOT EXISTS pg_net;

-- Step 2: Create function to send Slack notification
/*
CREATE OR REPLACE FUNCTION notify_slack_new_request()
RETURNS TRIGGER AS $$
DECLARE
  slack_webhook_url TEXT := 'https://hooks.slack.com/services/YOUR/WEBHOOK/URL';
  request_details JSONB;
  slack_payload JSONB;
BEGIN
  -- Only send notification for PENDING requests (not drafts)
  IF NEW.status = 'PENDING' THEN

    -- Extract request details from JSONB
    request_details := NEW.request_details;

    -- Build Slack payload
    slack_payload := jsonb_build_object(
      'blocks', jsonb_build_array(
        jsonb_build_object(
          'type', 'header',
          'text', jsonb_build_object(
            'type', 'plain_text',
            'text', '🔔 New Storage Request Submitted',
            'emoji', true
          )
        ),
        jsonb_build_object(
          'type', 'section',
          'fields', jsonb_build_array(
            jsonb_build_object(
              'type', 'mrkdwn',
              'text', '*Project Reference:*' || E'\n' || NEW.reference_id
            ),
            jsonb_build_object(
              'type', 'mrkdwn',
              'text', '*Contact Email:*' || E'\n' || NEW.user_email
            ),
            jsonb_build_object(
              'type', 'mrkdwn',
              'text', '*Item Type:*' || E'\n' || COALESCE(request_details->>'itemType', 'N/A')
            ),
            jsonb_build_object(
              'type', 'mrkdwn',
              'text', '*Quantity:*' || E'\n' || COALESCE((request_details->>'totalJoints')::text || ' joints', 'N/A')
            )
          )
        ),
        jsonb_build_object(
          'type', 'section',
          'text', jsonb_build_object(
            'type', 'mrkdwn',
            'text', '⏰ *Action Required:* Review and approve this request in the PipeVault Admin Dashboard.'
          )
        ),
        jsonb_build_object(
          'type', 'actions',
          'elements', jsonb_build_array(
            jsonb_build_object(
              'type', 'button',
              'text', jsonb_build_object(
                'type', 'plain_text',
                'text', '🔍 Review in PipeVault',
                'emoji', true
              ),
              'url', 'https://kylegronning.github.io/PipeVault/',
              'style', 'primary'
            )
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

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 3: Create trigger
CREATE TRIGGER on_storage_request_created
  AFTER INSERT ON storage_requests
  FOR EACH ROW
  EXECUTE FUNCTION notify_slack_new_request();
*/

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Check if webhook/trigger exists
SELECT
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE trigger_name = 'on_storage_request_created';

-- Test insert (will trigger Slack notification if configured)
-- UNCOMMENT TO TEST:
/*
INSERT INTO storage_requests (
  company_id,
  user_email,
  reference_id,
  status,
  request_details
) VALUES (
  (SELECT id FROM companies LIMIT 1),
  'test@example.com',
  'TEST-' || floor(random() * 1000)::text,
  'PENDING',
  jsonb_build_object(
    'itemType', 'Blank Pipe',
    'totalJoints', 100,
    'companyName', 'Test Company'
  )
);
*/

-- ============================================================================
-- CLEANUP (if needed)
-- ============================================================================

-- Drop trigger if you need to recreate it
-- DROP TRIGGER IF EXISTS on_storage_request_created ON storage_requests;

-- Drop function if you need to recreate it
-- DROP FUNCTION IF EXISTS notify_slack_new_request();
