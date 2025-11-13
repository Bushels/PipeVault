-- Migration: Fix notify_slack_project_complete to use consistent Vault secret name
-- Date: 2025-11-07
-- Purpose: Update function to use 'slack_webhook_url' instead of 'Slack-URL-Webhook'
--
-- Background:
-- - notify_slack_new_user() uses: vault.decrypted_secrets WHERE name = 'slack_webhook_url'
-- - notify_slack_storage_request() uses: vault.decrypted_secrets WHERE name = 'slack_webhook_url'
-- - notify_slack_project_complete() uses: vault.decrypted_secret('Slack-URL-Webhook') <- DIFFERENT!
--
-- User has single Vault secret: slack_webhook_url
-- This migration updates the third function to match the naming convention

CREATE OR REPLACE FUNCTION public.notify_slack_project_complete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'extensions', 'pg_temp'
AS $function$
DECLARE
  slack_webhook_url TEXT;
  remaining_inventory INT;
  request_company TEXT;
BEGIN
  -- Retrieve Slack webhook URL from Supabase Vault (secure storage)
  -- Updated to use consistent naming: 'slack_webhook_url'
  SELECT decrypted_secret
    INTO slack_webhook_url
  FROM vault.decrypted_secrets
  WHERE name = 'slack_webhook_url'
  LIMIT 1;

  -- Only proceed if we have a valid webhook URL
  IF slack_webhook_url IS NULL OR slack_webhook_url = '' THEN
    RAISE NOTICE 'Slack webhook URL not set in Vault';
    RETURN NEW;
  END IF;

  -- Only act when OUTBOUND load is COMPLETED
  IF NEW.direction = 'OUTBOUND' AND NEW.status = 'COMPLETED' THEN
    -- Check remaining inventory for this storage request
    SELECT COUNT(*)
      INTO remaining_inventory
    FROM public.inventory i
    WHERE i.request_id = NEW.storage_request_id
      AND i.status = 'IN_STORAGE';

    -- If all pipe has been moved out, send completion notification
    IF remaining_inventory = 0 THEN
      -- Get company name for the notification
      SELECT c.name
        INTO request_company
      FROM public.storage_requests sr
      JOIN public.companies c ON sr.company_id = c.id
      WHERE sr.id = NEW.storage_request_id;

      -- Send Slack notification
      PERFORM net.http_post(
        url := slack_webhook_url,
        headers := jsonb_build_object('Content-Type','application/json'),
        body := jsonb_build_object(
          'blocks', jsonb_build_array(
            jsonb_build_object(
              'type','section',
              'text', jsonb_build_object(
                'type','mrkdwn',
                'text','✅ *Project Complete* All pipe for project *' || NEW.storage_request_id || '* from company *' || COALESCE(request_company,'N/A') || '* has been moved out.'
              )
            )
          )
        )
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- Verification: Check that function was updated
SELECT
  p.proname AS function_name,
  'Updated to use vault.decrypted_secrets WHERE name = ''slack_webhook_url''' AS status
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname = 'notify_slack_project_complete';
