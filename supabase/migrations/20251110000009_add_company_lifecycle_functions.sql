-- Migration: Add Company Lifecycle Management Functions
-- Purpose: Provide admin utility functions for archiving and managing companies
-- Author: Database Integrity Guardian Agent
-- Date: 2025-11-10
--
-- Functions:
-- 1. archive_company(company_id) - Archive a company
-- 2. unarchive_company(company_id) - Restore archived company
-- 3. soft_delete_company(company_id) - Soft delete for GDPR compliance
-- 4. mark_company_as_admin(company_id) - Mark company as admin/non-customer
-- 5. get_archived_companies() - List archived companies for admin review

-- ============================================================================
-- FUNCTION 1: Archive Company
-- ============================================================================

CREATE OR REPLACE FUNCTION public.archive_company(company_id_param UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSONB;
  company_record RECORD;
BEGIN
  -- Verify caller is admin
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only admins can archive companies';
  END IF;

  -- Get company info before archiving
  SELECT id, name, domain, is_archived INTO company_record
  FROM public.companies
  WHERE id = company_id_param;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Company not found: %', company_id_param;
  END IF;

  IF company_record.is_archived THEN
    RAISE EXCEPTION 'Company % is already archived', company_record.name;
  END IF;

  -- Archive the company
  UPDATE public.companies
  SET
    is_archived = true,
    archived_at = now(),
    updated_at = now()
  WHERE id = company_id_param;

  -- Return result
  result := jsonb_build_object(
    'success', true,
    'company_id', company_id_param,
    'company_name', company_record.name,
    'archived_at', now()
  );

  RETURN result;
END;
$$;

COMMENT ON FUNCTION public.archive_company(UUID) IS
  'Archives a company, hiding it from active customer lists. ' ||
  'Admin-only function. ' ||
  'Use this for companies with deleted users or inactive accounts.';

-- ============================================================================
-- FUNCTION 2: Unarchive Company
-- ============================================================================

CREATE OR REPLACE FUNCTION public.unarchive_company(company_id_param UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSONB;
  company_record RECORD;
BEGIN
  -- Verify caller is admin
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only admins can unarchive companies';
  END IF;

  -- Get company info
  SELECT id, name, domain, is_archived INTO company_record
  FROM public.companies
  WHERE id = company_id_param;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Company not found: %', company_id_param;
  END IF;

  IF NOT company_record.is_archived THEN
    RAISE EXCEPTION 'Company % is not archived', company_record.name;
  END IF;

  -- Unarchive the company
  UPDATE public.companies
  SET
    is_archived = false,
    archived_at = NULL,
    updated_at = now()
  WHERE id = company_id_param;

  -- Return result
  result := jsonb_build_object(
    'success', true,
    'company_id', company_id_param,
    'company_name', company_record.name,
    'unarchived_at', now()
  );

  RETURN result;
END;
$$;

COMMENT ON FUNCTION public.unarchive_company(UUID) IS
  'Restores an archived company to active status. ' ||
  'Admin-only function. ' ||
  'Use this if a previously deleted user returns or company becomes active again.';

-- ============================================================================
-- FUNCTION 3: Soft Delete Company (GDPR Compliance)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.soft_delete_company(company_id_param UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSONB;
  company_record RECORD;
BEGIN
  -- Verify caller is admin
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only admins can soft delete companies';
  END IF;

  -- Get company info
  SELECT id, name, domain INTO company_record
  FROM public.companies
  WHERE id = company_id_param;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Company not found: %', company_id_param;
  END IF;

  -- Soft delete the company
  UPDATE public.companies
  SET
    deleted_at = now(),
    is_archived = true,
    archived_at = COALESCE(archived_at, now()),
    updated_at = now()
  WHERE id = company_id_param;

  -- Anonymize sensitive data in storage_requests
  UPDATE public.storage_requests
  SET
    internal_notes = '[REDACTED - Company deleted per GDPR]',
    admin_notes = '[REDACTED - Company deleted per GDPR]',
    updated_at = now()
  WHERE company_id = company_id_param;

  -- Return result
  result := jsonb_build_object(
    'success', true,
    'company_id', company_id_param,
    'company_name', company_record.name,
    'deleted_at', now(),
    'message', 'Company soft-deleted and sensitive data anonymized'
  );

  RETURN result;
END;
$$;

COMMENT ON FUNCTION public.soft_delete_company(UUID) IS
  'Soft deletes a company for GDPR compliance. ' ||
  'Sets deleted_at timestamp and anonymizes sensitive data. ' ||
  'Admin-only function. ' ||
  'This is permanent - use archive_company() for temporary hiding.';

-- ============================================================================
-- FUNCTION 4: Mark Company as Admin/Non-Customer
-- ============================================================================

CREATE OR REPLACE FUNCTION public.mark_company_as_admin(company_id_param UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSONB;
  company_record RECORD;
BEGIN
  -- Verify caller is admin
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only admins can mark companies as admin accounts';
  END IF;

  -- Get company info
  SELECT id, name, domain, is_customer INTO company_record
  FROM public.companies
  WHERE id = company_id_param;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Company not found: %', company_id_param;
  END IF;

  IF NOT company_record.is_customer THEN
    RAISE EXCEPTION 'Company % is already marked as non-customer', company_record.name;
  END IF;

  -- Mark as non-customer (admin account)
  UPDATE public.companies
  SET
    is_customer = false,
    updated_at = now()
  WHERE id = company_id_param;

  -- Return result
  result := jsonb_build_object(
    'success', true,
    'company_id', company_id_param,
    'company_name', company_record.name,
    'is_customer', false,
    'message', 'Company marked as admin/internal account'
  );

  RETURN result;
END;
$$;

COMMENT ON FUNCTION public.mark_company_as_admin(UUID) IS
  'Marks a company as non-customer (admin/internal account). ' ||
  'This hides the company from customer tile carousel. ' ||
  'Admin-only function. ' ||
  'Use for internal accounts like mpsgroup.ca.';

-- ============================================================================
-- FUNCTION 5: Get Archived Companies (Admin Review)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_archived_companies()
RETURNS TABLE (
  id UUID,
  name TEXT,
  domain TEXT,
  is_customer BOOLEAN,
  archived_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  request_count BIGINT,
  last_request_date TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
BEGIN
  -- Verify caller is admin
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only admins can view archived companies';
  END IF;

  RETURN QUERY
  SELECT
    c.id,
    c.name,
    c.domain,
    c.is_customer,
    c.archived_at,
    c.deleted_at,
    COUNT(sr.id) as request_count,
    MAX(sr.created_at) as last_request_date
  FROM public.companies c
  LEFT JOIN public.storage_requests sr ON sr.company_id = c.id
  WHERE c.is_archived = true OR c.deleted_at IS NOT NULL
  GROUP BY c.id, c.name, c.domain, c.is_customer, c.archived_at, c.deleted_at
  ORDER BY c.archived_at DESC NULLS LAST;
END;
$$;

COMMENT ON FUNCTION public.get_archived_companies() IS
  'Returns list of archived and soft-deleted companies. ' ||
  'Admin-only function. ' ||
  'Used for reviewing archived companies and deciding whether to restore them.';

-- ============================================================================
-- Grant Execute Permissions
-- ============================================================================

GRANT EXECUTE ON FUNCTION public.archive_company(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unarchive_company(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.soft_delete_company(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_company_as_admin(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_archived_companies() TO authenticated;

-- Note: Functions check is_admin() internally, so granting to authenticated is safe

-- ============================================================================
-- VALIDATION QUERIES (Run manually after migration)
-- ============================================================================

-- Test archive function (as admin)
-- SELECT archive_company('79786b6f-68d7-4a7a-838f-4e085328674b');

-- Test get archived companies (as admin)
-- SELECT * FROM get_archived_companies();

-- Test unarchive function (as admin)
-- SELECT unarchive_company('79786b6f-68d7-4a7a-838f-4e085328674b');

-- Test mark as admin (as admin)
-- SELECT mark_company_as_admin('ed19a223-4b83-4c3a-baae-279142d7a08c');
