-- ============================================================================
-- COMPLETE SLACK INTEGRATION SETUP FOR PIPEVAULT
-- ============================================================================
-- This file configures Slack notifications for ALL key events in PipeVault:
-- 1. New user signups
-- 2. New storage requests
-- 3. Delivery bookings (to MPS)
-- 4. Pickup bookings (to site)
--
-- CONFIGURATION STATUS:
-- ✅ Slack App Created: "PipeVault Notifications"
-- ✅ Webhook URL Configured: https://hooks.slack.com/services/T09QJM7DN1X/B09QK2RC51P/...
-- ✅ Channel: #pipevault-notifications
--
-- SETUP INSTRUCTIONS:
-- 1. Create a Slack Incoming Webhook (https://api.slack.com/messaging/webhooks)
-- 2. Go to Supabase Dashboard > Database > Webhooks
-- 3. Create 4 separate webhooks using the configurations below
-- 4. Replace 'YOUR/WEBHOOK/URL' with your actual Slack webhook URL
-- ============================================================================

-- ============================================================================
-- WEBHOOK 1: NEW USER SIGNUPS
-- ============================================================================
-- Note: auth.users is a Supabase Auth table, webhook creation may require
-- using a database trigger instead of direct webhook (see alternative below)

/*
WEBHOOK CONFIGURATION:

Name: slack-new-user-signup
Table: auth.users (or use database trigger - see alternative below)
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
        "text": "👤 New User Signed Up",
        "emoji": true
      }
    },
    {
      "type": "section",
      "fields": [
        {
          "type": "mrkdwn",
          "text": "*Email:*\n{{ record.email }}"
        },
        {
          "type": "mrkdwn",
          "text": "*Name:*\n{{ record.raw_user_meta_data.first_name }} {{ record.raw_user_meta_data.last_name }}"
        },
        {
          "type": "mrkdwn",
          "text": "*Company:*\n{{ record.raw_user_meta_data.company_name }}"
        },
        {
          "type": "mrkdwn",
          "text": "*Phone:*\n{{ record.raw_user_meta_data.contact_number }}"
        },
        {
          "type": "mrkdwn",
          "text": "*Signed Up:*\n<!date^{{ record.created_at }}^{date_short_pretty} at {time}|just now>"
        }
      ]
    },
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "🎉 Welcome the new customer to PipeVault!"
      }
    },
    {
      "type": "actions",
      "elements": [
        {
          "type": "button",
          "text": {
            "type": "plain_text",
            "text": "👁️ View in Admin",
            "emoji": true
          },
          "url": "https://kylegronning.github.io/PipeVault/",
          "style": "primary"
        }
      ]
    }
  ]
}
*/

-- ALTERNATIVE: Database Trigger for auth.users (recommended if webhook doesn't work)
-- Supabase may restrict webhooks on auth.users, so use a trigger instead

CREATE OR REPLACE FUNCTION notify_slack_new_user()
RETURNS TRIGGER AS $$
DECLARE
  slack_webhook_url TEXT := 'https://hooks.slack.com/services/YOUR/WEBHOOK/URL';
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
  user_email := COALESCE(NEW.email, NEW.raw_user_meta_data->>'contact_email', 'N/A');

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
          jsonb_build_object(
            'type', 'mrkdwn',
            'text', '*Email:*' || E'\n' || user_email
          ),
          jsonb_build_object(
            'type', 'mrkdwn',
            'text', '*Name:*' || E'\n' || user_first_name || ' ' || user_last_name
          ),
          jsonb_build_object(
            'type', 'mrkdwn',
            'text', '*Company:*' || E'\n' || user_company
          ),
          jsonb_build_object(
            'type', 'mrkdwn',
            'text', '*Phone:*' || E'\n' || user_phone
          ),
          jsonb_build_object(
            'type', 'mrkdwn',
            'text', '*Signed Up:*' || E'\n' || to_char(NEW.created_at, 'Mon DD, YYYY at HH24:MI')
          )
        )
      ),
      jsonb_build_object(
        'type', 'section',
        'text', jsonb_build_object(
          'type', 'mrkdwn',
          'text', '🎉 Welcome the new customer to PipeVault!'
        )
      ),
      jsonb_build_object(
        'type', 'actions',
        'elements', jsonb_build_array(
          jsonb_build_object(
            'type', 'button',
            'text', jsonb_build_object(
              'type', 'plain_text',
              'text', '👁️ View in Admin',
              'emoji', true
            ),
            'url', 'https://kylegronning.github.io/PipeVault/',
            'style', 'primary'
          )
        )
      )
    )
  );

  -- Send to Slack using pg_net (requires pg_net extension)
  PERFORM net.http_post(
    url := slack_webhook_url,
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := slack_payload
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user signups
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION notify_slack_new_user();


-- ============================================================================
-- WEBHOOK 2: NEW STORAGE REQUESTS
-- ============================================================================
-- This webhook already exists from SETUP_SLACK_WEBHOOK.sql
-- Included here for completeness

/*
WEBHOOK CONFIGURATION:

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
-- WEBHOOK 3: DELIVERY BOOKINGS (Truck arriving at MPS)
-- ============================================================================

/*
WEBHOOK CONFIGURATION:

Name: slack-delivery-booking
Table: truck_loads
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
        "text": "🚛 New Delivery Scheduled to MPS",
        "emoji": true
      }
    },
    {
      "type": "section",
      "fields": [
        {
          "type": "mrkdwn",
          "text": "*Trucking Company:*\n{{ record.trucking_company }}"
        },
        {
          "type": "mrkdwn",
          "text": "*Driver:*\n{{ record.driver_name }}"
        },
        {
          "type": "mrkdwn",
          "text": "*Driver Phone:*\n{{ record.driver_phone }}"
        },
        {
          "type": "mrkdwn",
          "text": "*Joints Count:*\n{{ record.joints_count }} joints"
        },
        {
          "type": "mrkdwn",
          "text": "*Arrival Time:*\n<!date^{{ record.arrival_time }}^{date_short_pretty} at {time}|TBD>"
        },
        {
          "type": "mrkdwn",
          "text": "*Storage Area:*\n{{ record.storage_area_id }}"
        }
      ]
    },
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "📦 *Prepare for Delivery:* Ensure yard crew is ready to receive this load."
      }
    },
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "*Notes:*\n{{ record.notes }}"
      }
    },
    {
      "type": "actions",
      "elements": [
        {
          "type": "button",
          "text": {
            "type": "plain_text",
            "text": "📋 View Truck Details",
            "emoji": true
          },
          "url": "https://kylegronning.github.io/PipeVault/",
          "style": "primary"
        }
      ]
    }
  ]
}

Conditions:
  - Only send for DELIVERY type trucks
  - Filter: type.eq.DELIVERY
*/


-- ============================================================================
-- WEBHOOK 4: PICKUP BOOKINGS (Truck picking up from MPS to site)
-- ============================================================================

/*
WEBHOOK CONFIGURATION:

Name: slack-pickup-booking
Table: truck_loads
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
        "text": "🚚 New Pickup Scheduled from MPS",
        "emoji": true
      }
    },
    {
      "type": "section",
      "fields": [
        {
          "type": "mrkdwn",
          "text": "*Trucking Company:*\n{{ record.trucking_company }}"
        },
        {
          "type": "mrkdwn",
          "text": "*Driver:*\n{{ record.driver_name }}"
        },
        {
          "type": "mrkdwn",
          "text": "*Driver Phone:*\n{{ record.driver_phone }}"
        },
        {
          "type": "mrkdwn",
          "text": "*Joints Count:*\n{{ record.joints_count }} joints"
        },
        {
          "type": "mrkdwn",
          "text": "*Pickup Time:*\n<!date^{{ record.arrival_time }}^{date_short_pretty} at {time}|TBD>"
        },
        {
          "type": "mrkdwn",
          "text": "*Destination Well:*\n{{ record.assigned_well_name }} ({{ record.assigned_uwi }})"
        }
      ]
    },
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "🏗️ *Prepare for Pickup:* Ensure pipe is ready for loading and yard crew is available."
      }
    },
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "*Notes:*\n{{ record.notes }}"
      }
    },
    {
      "type": "actions",
      "elements": [
        {
          "type": "button",
          "text": {
            "type": "plain_text",
            "text": "📋 View Truck Details",
            "emoji": true
          },
          "url": "https://kylegronning.github.io/PipeVault/",
          "style": "primary"
        }
      ]
    }
  ]
}

Conditions:
  - Only send for PICKUP type trucks
  - Filter: type.eq.PICKUP
*/


-- ============================================================================
-- SETUP CHECKLIST
-- ============================================================================

/*
□ 1. Create Slack App and Incoming Webhook
   - Go to: https://api.slack.com/apps
   - Create new app: "PipeVault Notifications"
   - Enable Incoming Webhooks
   - Add webhook to your #pipevault-notifications channel
   - Copy the webhook URL

□ 2. Enable pg_net Extension (for auth.users trigger)
   - Run in Supabase SQL Editor:
     CREATE EXTENSION IF NOT EXISTS pg_net;

□ 3. Create Database Trigger for User Signups
   - Copy the notify_slack_new_user() function above
   - Replace 'YOUR/WEBHOOK/URL' with your actual Slack webhook
   - Run in Supabase SQL Editor

□ 4. Create Webhook for Storage Requests
   - Go to: Supabase Dashboard > Database > Webhooks
   - Click "Create a new hook"
   - Name: slack-new-storage-request
   - Table: storage_requests
   - Events: INSERT
   - Condition: status.eq.PENDING
   - Use payload template from WEBHOOK 2 above

□ 5. Create Webhook for Deliveries
   - Go to: Supabase Dashboard > Database > Webhooks
   - Click "Create a new hook"
   - Name: slack-delivery-booking
   - Table: truck_loads
   - Events: INSERT
   - Condition: type.eq.DELIVERY
   - Use payload template from WEBHOOK 3 above

□ 6. Create Webhook for Pickups
   - Go to: Supabase Dashboard > Database > Webhooks
   - Click "Create a new hook"
   - Name: slack-pickup-booking
   - Table: truck_loads
   - Events: INSERT
   - Condition: type.eq.PICKUP
   - Use payload template from WEBHOOK 4 above

□ 7. Test Each Webhook
   - User signup: Create a new test account
   - Storage request: Submit a test storage request
   - Delivery: Add a test truck load with type='DELIVERY'
   - Pickup: Add a test truck load with type='PICKUP'
   - Verify notifications appear in Slack

□ 8. Monitor Webhook Logs
   - Supabase Dashboard > Database > Webhooks
   - Check logs for each webhook
   - Verify successful deliveries
*/


-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Check if user signup trigger exists
SELECT
  trigger_name,
  event_manipulation,
  event_object_schema,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE trigger_name = 'on_auth_user_created';

-- Check recent user signups (to test trigger)
SELECT
  email,
  raw_user_meta_data->>'first_name' as first_name,
  raw_user_meta_data->>'last_name' as last_name,
  raw_user_meta_data->>'company_name' as company,
  created_at
FROM auth.users
ORDER BY created_at DESC
LIMIT 5;

-- Check recent storage requests
SELECT
  reference_id,
  user_email,
  status,
  created_at
FROM storage_requests
WHERE status = 'PENDING'
ORDER BY created_at DESC
LIMIT 5;

-- Check recent truck loads
SELECT
  type,
  trucking_company,
  driver_name,
  joints_count,
  arrival_time,
  created_at
FROM truck_loads
ORDER BY created_at DESC
LIMIT 5;


-- ============================================================================
-- CLEANUP (if needed)
-- ============================================================================

-- Drop user signup trigger
-- DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
-- DROP FUNCTION IF EXISTS notify_slack_new_user();

-- Note: Webhooks created via Supabase Dashboard must be deleted through the UI
