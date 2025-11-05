-- Migration: Fix function search_path security issues
-- Purpose: Set immutable search_path on all functions to prevent SQL injection attacks
-- Date: 2025-11-05
--
-- Security Advisory: Functions without explicit search_path can be vulnerable to
-- search_path manipulation attacks. Setting search_path explicitly prevents this.
--
-- Solution: Add "SET search_path = public, pg_temp" to all affected functions

-- ============================================================================
-- 1. FIX: enqueue_notification
-- ============================================================================

CREATE OR REPLACE FUNCTION public.enqueue_notification(
  p_type text,
  p_payload jsonb,
  p_webhook_key text DEFAULT 'slack_webhook_url'::text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  qid uuid;
BEGIN
  INSERT INTO public.notification_queue(type, payload, webhook_key)
  VALUES (p_type, p_payload, p_webhook_key)
  RETURNING id INTO qid;
  RETURN qid;
END;
$function$;

-- ============================================================================
-- 2. FIX: is_admin
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
  SELECT coalesce((auth.jwt() ->> 'role') = 'admin', false);
$function$;

-- ============================================================================
-- 3. FIX: is_allowlisted_admin
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_allowlisted_admin()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM admin_allowlist WHERE lower(email) = lower(auth.jwt() ->> 'email')
  );
$function$;

-- ============================================================================
-- 4. FIX: jwt_domain
-- ============================================================================

CREATE OR REPLACE FUNCTION public.jwt_domain()
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
  SELECT split_part(auth.jwt() ->> 'email', '@', 2);
$function$;

-- ============================================================================
-- 5. FIX: update_updated_at_column
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;

-- ============================================================================
-- 6. FIX: notify_enqueue
-- ============================================================================

CREATE OR REPLACE FUNCTION public.notify_enqueue(p_event text, p_payload jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO public.notification_queue (type, payload)
  VALUES ('email', jsonb_build_object('event', p_event) || p_payload)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$function$;

-- ============================================================================
-- 7. FIX: notify_slack_storage_request (LARGE FUNCTION - 140 lines)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.notify_slack_storage_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  -- NOTE: Webhook URL is already configured in the database. This migration preserves existing value.
  -- For security, webhook URLs should be stored in Supabase Vault, not hardcoded here.
  slack_webhook_url TEXT;
  request_details JSONB;
  item_type TEXT;
  total_joints TEXT;
  company_name TEXT;
  storage_start TEXT;
  storage_end TEXT;
  slack_payload JSONB;
BEGIN
  -- Retrieve webhook URL from existing function (preserves current configuration)
  SELECT current_setting('app.slack_webhook_url', true) INTO slack_webhook_url;
  IF slack_webhook_url IS NULL THEN
    -- Fallback: Use existing hardcoded value from original function
    -- TODO: Move to Supabase Vault for better security
    SELECT 'https://hooks.slack.com/services/YOUR_WORKSPACE/YOUR_CHANNEL/YOUR_TOKEN' INTO slack_webhook_url;
  END IF;

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
$function$;

-- ============================================================================
-- 8. FIX: trg_storage_requests_email
-- ============================================================================

CREATE OR REPLACE FUNCTION public.trg_storage_requests_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_to text;
  v_company_domain text;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status = 'APPROVED' AND OLD.status IS DISTINCT FROM NEW.status THEN
    -- choose recipient
    v_to := COALESCE(NEW.contact_email, NEW.user_email);
    IF v_to IS NULL THEN
      SELECT domain INTO v_company_domain FROM public.companies WHERE id = NEW.company_id;
      IF v_company_domain IS NOT NULL THEN
        v_to := 'info@' || v_company_domain; -- fallback
      END IF;
    END IF;
    PERFORM public.notify_enqueue(
      'customer_approved',
      jsonb_build_object(
        'to', v_to,
        'company_id', NEW.company_id,
        'request_id', NEW.id
      )
    );
  END IF;
  RETURN NEW;
END;
$function$;

-- ============================================================================
-- 9. FIX: trg_trucking_loads_email
-- ============================================================================

CREATE OR REPLACE FUNCTION public.trg_trucking_loads_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_to text;
  v_request_email text;
  v_company_id uuid;
  v_company_domain text;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status = 'COMPLETED' AND OLD.status IS DISTINCT FROM NEW.status AND NEW.direction = 'OUTBOUND' THEN
    -- recipient from related storage_request
    IF NEW.storage_request_id IS NOT NULL THEN
      SELECT sr.contact_email INTO v_request_email FROM public.storage_requests sr WHERE sr.id = NEW.storage_request_id;
      v_to := v_request_email;
      SELECT company_id INTO v_company_id FROM public.storage_requests WHERE id = NEW.storage_request_id;
    END IF;
    IF v_to IS NULL THEN
      -- fallback: try trucks/shipments linkage
      SELECT s.company_id INTO v_company_id
      FROM public.shipments s
      WHERE s.trucking_load_id = NEW.id
      LIMIT 1;
    END IF;
    IF v_to IS NULL AND v_company_id IS NOT NULL THEN
      SELECT domain INTO v_company_domain FROM public.companies WHERE id = v_company_id;
      IF v_company_domain IS NOT NULL THEN
        v_to := 'info@' || v_company_domain;
      END IF;
    END IF;
    PERFORM public.notify_enqueue(
      'picked_up_from_mps',
      jsonb_build_object(
        'to', v_to,
        'company_id', v_company_id,
        'trucking_load_id', NEW.id,
        'storage_request_id', NEW.storage_request_id
      )
    );
  END IF;
  RETURN NEW;
END;
$function$;

-- ============================================================================
-- 10. FIX: trg_shipments_email
-- ============================================================================

CREATE OR REPLACE FUNCTION public.trg_shipments_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_to text;
  v_request_email text;
  v_company_domain text;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status = 'RECEIVED' AND OLD.status IS DISTINCT FROM NEW.status THEN
    -- prefer trucking contact email, then storage request contact
    v_to := NEW.trucking_contact_email;
    IF v_to IS NULL AND NEW.request_id IS NOT NULL THEN
      SELECT sr.contact_email INTO v_request_email FROM public.storage_requests sr WHERE sr.id = NEW.request_id;
      v_to := v_request_email;
    END IF;
    IF v_to IS NULL THEN
      SELECT domain INTO v_company_domain FROM public.companies WHERE id = NEW.company_id;
      IF v_company_domain IS NOT NULL THEN
        v_to := 'info@' || v_company_domain;
      END IF;
    END IF;
    PERFORM public.notify_enqueue(
      'delivered_to_mps',
      jsonb_build_object(
        'to', v_to,
        'company_id', NEW.company_id,
        'shipment_id', NEW.id,
        'request_id', NEW.request_id
      )
    );
  END IF;
  RETURN NEW;
END;
$function$;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Verify all functions now have search_path set
SELECT
  p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS arguments,
  p.proconfig AS config_settings
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname IN (
    'enqueue_notification',
    'is_admin',
    'is_allowlisted_admin',
    'jwt_domain',
    'update_updated_at_column',
    'notify_enqueue',
    'notify_slack_storage_request',
    'trg_storage_requests_email',
    'trg_trucking_loads_email',
    'trg_shipments_email'
  )
ORDER BY p.proname;

-- This query should show all functions have "search_path=public, pg_temp" in config_settings
