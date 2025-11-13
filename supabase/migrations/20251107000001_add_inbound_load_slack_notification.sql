-- Migration: Add Slack notification for new inbound trucking loads
-- Date: 2025-11-07
-- Purpose: Automatically notify Slack when customers book inbound deliveries

-- Create function to send Slack notification for new inbound trucking loads
CREATE OR REPLACE FUNCTION public.notify_slack_inbound_load()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  slack_webhook_url text;
  customer_company text;
  load_number text;
  delivery_date text;
  time_slot text;
  is_after_hours boolean;
  storage_request_ref text;
BEGIN
  -- Only send notification for new INBOUND loads
  IF NEW.direction <> 'INBOUND' OR TG_OP <> 'INSERT' THEN
    RETURN NEW;
  END IF;

  -- Get webhook URL from Vault
  SELECT public._get_slack_webhook_url() INTO slack_webhook_url;
  IF slack_webhook_url IS NULL OR slack_webhook_url = '' THEN
    RAISE NOTICE 'Slack webhook URL not set in Vault';
    RETURN NEW;
  END IF;

  -- Get company name from storage request
  SELECT
    c.name,
    sr.reference_id
  INTO
    customer_company,
    storage_request_ref
  FROM public.storage_requests sr
  JOIN public.companies c ON sr.company_id = c.id
  WHERE sr.id = NEW.storage_request_id;

  customer_company := COALESCE(customer_company, 'Unknown Company');
  storage_request_ref := COALESCE(storage_request_ref, NEW.storage_request_id::text);
  load_number := 'Load #' || COALESCE(NEW.sequence_number::text, '?');

  -- Format delivery date and time
  delivery_date := COALESCE(
    to_char(NEW.scheduled_slot_start, 'Day, Month DD, YYYY'),
    'Not scheduled'
  );

  time_slot := COALESCE(
    to_char(NEW.scheduled_slot_start, 'HH12:MI AM') || ' - ' ||
    to_char(NEW.scheduled_slot_end, 'HH12:MI AM'),
    'Not scheduled'
  );

  -- Check if after-hours (weekends or outside 7 AM - 5 PM Mon-Fri)
  is_after_hours := (
    EXTRACT(DOW FROM NEW.scheduled_slot_start) IN (0, 6) OR
    EXTRACT(HOUR FROM NEW.scheduled_slot_start) < 7 OR
    EXTRACT(HOUR FROM NEW.scheduled_slot_start) >= 17
  );

  -- Send Slack notification with Block Kit format
  PERFORM net.http_post(
    url := slack_webhook_url,
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := jsonb_build_object(
      'blocks', jsonb_build_array(
        -- Header
        jsonb_build_object(
          'type', 'header',
          'text', jsonb_build_object(
            'type', 'plain_text',
            'text', '✅ ' || load_number || ' Booked',
            'emoji', true
          )
        ),
        -- Company and load details
        jsonb_build_object(
          'type', 'section',
          'fields', jsonb_build_array(
            jsonb_build_object('type', 'mrkdwn', 'text', '*Company:*' || E'\n' || customer_company),
            jsonb_build_object('type', 'mrkdwn', 'text', '*Load Number:*' || E'\n' || load_number),
            jsonb_build_object('type', 'mrkdwn', 'text', '*Reference ID:*' || E'\n' || storage_request_ref),
            jsonb_build_object('type', 'mrkdwn', 'text', '*Status:*' || E'\n' || NEW.status)
          )
        ),
        -- Delivery details
        jsonb_build_object(
          'type', 'section',
          'fields', jsonb_build_array(
            jsonb_build_object('type', 'mrkdwn', 'text', '*Delivery Date:*' || E'\n' || delivery_date),
            jsonb_build_object('type', 'mrkdwn', 'text', '*Time Slot:*' || E'\n' || time_slot)
          )
        ),
        -- After-hours warning (conditional)
        CASE
          WHEN is_after_hours THEN
            jsonb_build_object(
              'type', 'section',
              'text', jsonb_build_object(
                'type', 'mrkdwn',
                'text', '⚠️ *Off-Hours Delivery* - $450 surcharge applied'
              )
            )
          ELSE
            NULL
        END,
        -- Action required
        jsonb_build_object(
          'type', 'section',
          'text', jsonb_build_object(
            'type', 'mrkdwn',
            'text', '📋 Review booking details and make any necessary adjustments in the Admin Dashboard.'
          )
        ),
        -- Admin dashboard button
        jsonb_build_object(
          'type', 'actions',
          'elements', jsonb_build_array(
            jsonb_build_object(
              'type', 'button',
              'text', jsonb_build_object(
                'type', 'plain_text',
                'text', '🔧 View in Admin Dashboard',
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
              'text', '📅 Booked: <!date^' || EXTRACT(EPOCH FROM NOW())::bigint || '^{date_short_pretty} at {time}|just now>'
            )
          )
        )
      ) - NULL::jsonb  -- Remove NULL elements (after-hours warning if not applicable)
    )
  );

  RETURN NEW;
END;
$$;

-- Create trigger to fire on new inbound loads
DROP TRIGGER IF EXISTS trigger_notify_slack_inbound_load ON public.trucking_loads;

CREATE TRIGGER trigger_notify_slack_inbound_load
  AFTER INSERT ON public.trucking_loads
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_slack_inbound_load();

-- Add comment for documentation
COMMENT ON FUNCTION public.notify_slack_inbound_load() IS
  'Sends Slack notification when new INBOUND trucking load is created. ' ||
  'Includes company, load number, delivery date/time, and after-hours indicator. ' ||
  'Uses webhook URL from vault.decrypted_secrets.';
