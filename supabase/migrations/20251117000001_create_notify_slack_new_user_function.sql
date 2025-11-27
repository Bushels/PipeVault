-- Migration: Create notify_slack_new_user() function
-- Date: 2025-11-17
-- Purpose: Send Slack notification when new customers sign up
--
-- This function was missing and causing the Phase 1 notification to fail.
-- The trigger migration (20251107000002) assumes this function exists.
--
-- Implementation:
-- - Retrieves webhook URL from Vault (not hardcoded)
-- - Extracts user metadata (first name, last name, company, phone, domain)
-- - Sends formatted Slack notification using Block Kit
-- - Includes email verification status

CREATE OR REPLACE FUNCTION public.notify_slack_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'extensions', 'pg_temp'
AS $$
DECLARE
  slack_webhook_url TEXT;
  user_first_name TEXT;
  user_last_name TEXT;
  user_company TEXT;
  user_phone TEXT;
  user_email TEXT;
  company_domain TEXT;
BEGIN
  -- Retrieve Slack webhook URL from Vault (secure storage)
  SELECT decrypted_secret
    INTO slack_webhook_url
  FROM vault.decrypted_secrets
  WHERE name = 'slack_webhook_url'
  LIMIT 1;

  -- Only proceed if webhook URL is configured
  IF slack_webhook_url IS NULL OR slack_webhook_url = '' THEN
    RAISE NOTICE 'Slack webhook URL not set in Vault - skipping notification';
    RETURN NEW;
  END IF;

  -- Extract user metadata from sign-up
  user_first_name := COALESCE(NEW.raw_user_meta_data->>'first_name', 'N/A');
  user_last_name := COALESCE(NEW.raw_user_meta_data->>'last_name', '');
  user_company := COALESCE(NEW.raw_user_meta_data->>'company_name', 'N/A');
  user_phone := COALESCE(NEW.raw_user_meta_data->>'contact_number', 'N/A');
  user_email := COALESCE(NEW.email, 'N/A');
  company_domain := COALESCE(NEW.raw_user_meta_data->>'company_domain', 'N/A');

  -- Send formatted Slack notification using Block Kit
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
            'text', '🆕 New Customer Sign-up',
            'emoji', true
          )
        ),
        -- Customer details
        jsonb_build_object(
          'type', 'section',
          'fields', jsonb_build_array(
            jsonb_build_object('type', 'mrkdwn', 'text', '*Company:*' || E'\n' || user_company),
            jsonb_build_object('type', 'mrkdwn', 'text', '*Name:*' || E'\n' || user_first_name || ' ' || user_last_name),
            jsonb_build_object('type', 'mrkdwn', 'text', '*Email:*' || E'\n' || user_email),
            jsonb_build_object('type', 'mrkdwn', 'text', '*Phone:*' || E'\n' || user_phone),
            jsonb_build_object('type', 'mrkdwn', 'text', '*Domain:*' || E'\n' || company_domain),
            jsonb_build_object('type', 'mrkdwn', 'text', '*Status:*' || E'\n' || CASE WHEN NEW.email_confirmed_at IS NULL THEN '⏳ Awaiting verification' ELSE '✅ Email verified' END)
          )
        ),
        -- Action button
        jsonb_build_object(
          'type', 'actions',
          'elements', jsonb_build_array(
            jsonb_build_object(
              'type', 'button',
              'text', jsonb_build_object(
                'type', 'plain_text',
                'text', '👀 View in PipeVault',
                'emoji', true
              ),
              'url', 'https://kylegronning.github.io/PipeVault/',
              'style', 'primary'
            )
          )
        ),
        -- Timestamp
        jsonb_build_object(
          'type', 'context',
          'elements', jsonb_build_array(
            jsonb_build_object(
              'type', 'mrkdwn',
              'text', '📅 Signed up: <!date^' || EXTRACT(EPOCH FROM NOW())::bigint || '^{date_short_pretty} at {time}|just now>'
            )
          )
        )
      )
    )
  );

  RETURN NEW;
END;
$$;

-- Add function comment for documentation
COMMENT ON FUNCTION public.notify_slack_new_user() IS
  'Sends Slack notification when new user signs up. ' ||
  'Includes company name, contact details, and email verification status. ' ||
  'Retrieves webhook URL from vault.decrypted_secrets.';

-- Verification: Check that function was created
SELECT
  p.proname AS function_name,
  'Function created successfully - ready for trigger' AS status
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname = 'notify_slack_new_user';
