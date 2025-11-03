-- ============================================================================
-- SLACK NOTIFICATION TRIGGER FOR STORAGE REQUESTS
-- ============================================================================
-- This sets up a PostgreSQL trigger to send Slack notifications when
-- new storage requests are submitted (status = 'PENDING')
--
-- SETUP INSTRUCTIONS:
-- 1. Copy this entire file
-- 2. Go to Supabase Dashboard > SQL Editor
-- 3. Click "New Query"
-- 4. Paste and run this SQL
-- 5. Test by submitting a storage request
-- ============================================================================

-- Create function to send Slack notification for new storage requests
CREATE OR REPLACE FUNCTION notify_slack_storage_request()
RETURNS TRIGGER AS $$
DECLARE
  slack_webhook_url TEXT := 'https://hooks.slack.com/services/YOUR/WEBHOOK/URL';
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
            jsonb_build_object(
              'type', 'mrkdwn',
              'text', '*Project Reference:*' || E'\n' || COALESCE(NEW.reference_id, 'N/A')
            ),
            jsonb_build_object(
              'type', 'mrkdwn',
              'text', '*Company:*' || E'\n' || company_name
            ),
            jsonb_build_object(
              'type', 'mrkdwn',
              'text', '*Contact Email:*' || E'\n' || COALESCE(NEW.user_email, 'N/A')
            ),
            jsonb_build_object(
              'type', 'mrkdwn',
              'text', '*Item Type:*' || E'\n' || item_type
            ),
            jsonb_build_object(
              'type', 'mrkdwn',
              'text', '*Quantity:*' || E'\n' || total_joints || ' joints'
            ),
            jsonb_build_object(
              'type', 'mrkdwn',
              'text', '*Storage Period:*' || E'\n' || storage_start || ' to ' || storage_end
            )
          )
        ),
        -- Action required section
        jsonb_build_object(
          'type', 'section',
          'text', jsonb_build_object(
            'type', 'mrkdwn',
            'text', '⏰ *Action Required:* Review and approve this request in the PipeVault Admin Dashboard.'
          )
        ),
        -- Button to view in PipeVault
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
        ),
        -- Timestamp context
        jsonb_build_object(
          'type', 'context',
          'elements', jsonb_build_array(
            jsonb_build_object(
              'type', 'mrkdwn',
              'text', '📅 Submitted: ' || to_char(NEW.created_at, 'Mon DD, YYYY at HH24:MI')
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

-- Create trigger for new storage requests
DROP TRIGGER IF EXISTS on_storage_request_pending ON storage_requests;
CREATE TRIGGER on_storage_request_pending
  AFTER INSERT ON storage_requests
  FOR EACH ROW
  EXECUTE FUNCTION notify_slack_storage_request();

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Check if trigger was created
SELECT
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE trigger_name = 'on_storage_request_pending';

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Slack notification trigger created successfully!';
  RAISE NOTICE '📝 Trigger: on_storage_request_pending';
  RAISE NOTICE '📊 Table: storage_requests';
  RAISE NOTICE '🔔 Condition: Only fires when status = PENDING';
  RAISE NOTICE '';
  RAISE NOTICE '🧪 TEST: Submit a storage request to test the Slack notification';
END $$;
