BEGIN;

-- ============================================================================
-- RECOVERY: Ensure table exists (in case 001 failed or was skipped)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.rack_reservations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rack_id TEXT NOT NULL REFERENCES public.racks(id) ON DELETE CASCADE,
    request_id UUID NOT NULL REFERENCES public.storage_requests(id) ON DELETE CASCADE,
    company_id UUID REFERENCES public.companies(id), -- Will be set NOT NULL below
    start_date DATE NOT NULL,
    end_date DATE,
    reserved_joints INTEGER DEFAULT 0,
    reserved_meters NUMERIC DEFAULT 0,
    status TEXT DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'CANCELLED', 'COMPLETED')),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Ensure base indexes
CREATE INDEX IF NOT EXISTS idx_rack_reservations_dates ON public.rack_reservations(rack_id, start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_rack_reservations_request ON public.rack_reservations(request_id);
CREATE INDEX IF NOT EXISTS idx_rack_reservations_company ON public.rack_reservations(company_id);

-- ============================================================================
-- ENHANCEMENTS: Constraints, Triggers, Policies
-- ============================================================================

-- 0) Prereqs
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- 1) Basic constraints
-- Check if constraint exists before adding to avoid errors on re-runs
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reserved_non_negative') THEN
    ALTER TABLE public.rack_reservations
      ADD CONSTRAINT reserved_non_negative
      CHECK (reserved_joints >= 0 AND reserved_meters >= 0) NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'rack_reservations_date_order') THEN
    ALTER TABLE public.rack_reservations
      ADD CONSTRAINT rack_reservations_date_order
      CHECK (end_date IS NULL OR end_date >= start_date) NOT VALID;
  END IF;
END $$;

-- NEW: Make company_id NOT NULL
ALTER TABLE public.rack_reservations
  ALTER COLUMN company_id SET NOT NULL;

-- 2) Prevent overlapping ACTIVE reservations on the same rack
-- End date is EXCLUSIVE => use '[)'
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'rack_reservations_no_overlap') THEN
    ALTER TABLE public.rack_reservations
      ADD CONSTRAINT rack_reservations_no_overlap
      EXCLUDE USING gist (
        rack_id WITH =,
        daterange(start_date, COALESCE(end_date, 'infinity'::date), '[)') WITH &&
      )
      WHERE (status = 'ACTIVE');
  END IF;
END $$;

-- 3) Auto-update updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_rack_reservations_updated_at ON public.rack_reservations;
CREATE TRIGGER set_rack_reservations_updated_at
BEFORE UPDATE ON public.rack_reservations
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4) Ensure company matches storage_request.company_id
CREATE OR REPLACE FUNCTION public.rack_reservation_validate_request_company()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  req_company uuid;
BEGIN
  SELECT company_id INTO req_company
  FROM public.storage_requests
  WHERE id = NEW.request_id;

  IF req_company IS NULL THEN
    RAISE EXCEPTION 'Invalid request_id %', NEW.request_id;
  END IF;

  IF NEW.company_id IS DISTINCT FROM req_company THEN
    RAISE EXCEPTION 'company_id (%) must match storage_request.company_id (%)', NEW.company_id, req_company;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS rack_reservation_company_match ON public.rack_reservations;
CREATE TRIGGER rack_reservation_company_match
BEFORE INSERT OR UPDATE OF company_id, request_id
ON public.rack_reservations
FOR EACH ROW EXECUTE FUNCTION public.rack_reservation_validate_request_company();

-- 5) Capacity enforcement (reserved_joints only)
CREATE OR REPLACE FUNCTION public.check_rack_capacity()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  rack_cap integer;
  sum_reserved integer;
  new_start date;
  new_end date;
  consider_active boolean;
BEGIN
  consider_active := (NEW.status = 'ACTIVE');

  IF NOT consider_active THEN
    RETURN NEW;
  END IF;

  SELECT capacity INTO rack_cap
  FROM public.racks
  WHERE id = NEW.rack_id;

  IF rack_cap IS NULL THEN
    RETURN NEW;
  END IF;

  new_start := NEW.start_date;
  new_end := COALESCE(NEW.end_date, 'infinity'::date);

  SELECT COALESCE(SUM(r.reserved_joints), 0) INTO sum_reserved
  FROM public.rack_reservations r
  WHERE r.rack_id = NEW.rack_id
    AND r.status = 'ACTIVE'
    AND daterange(r.start_date, COALESCE(r.end_date, 'infinity'::date), '[)') &&
        daterange(new_start, new_end, '[)')
    AND (r.id IS DISTINCT FROM NEW.id);

  sum_reserved := sum_reserved + COALESCE(NEW.reserved_joints, 0);

  IF sum_reserved > rack_cap THEN
    RAISE EXCEPTION 'Rack % capacity exceeded: % joints requested across overlaps (capacity %)',
      NEW.rack_id, sum_reserved, rack_cap
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS check_rack_capacity_trg ON public.rack_reservations;
CREATE TRIGGER check_rack_capacity_trg
BEFORE INSERT OR UPDATE OF rack_id, start_date, end_date, reserved_joints, status
ON public.rack_reservations
FOR EACH ROW EXECUTE FUNCTION public.check_rack_capacity();

-- 6) RLS policies

ALTER TABLE public.companies
  ADD CONSTRAINT companies_domain_unique UNIQUE (domain) DEFERRABLE INITIALLY IMMEDIATE;

CREATE INDEX IF NOT EXISTS idx_companies_domain_lower ON public.companies (lower(domain));

-- NEW: Harden domain helper
CREATE OR REPLACE FUNCTION public.company_id_from_email_domain()
RETURNS uuid
LANGUAGE sql STABLE
AS $$
  SELECT c.id
  FROM public.companies c
  WHERE lower(c.domain) = lower(NULLIF(split_part((auth.jwt()->>'email')::text, '@', 2), ''))
  LIMIT 1
$$;

ALTER TABLE public.rack_reservations ENABLE ROW LEVEL SECURITY;

-- Cleanup old policies from 001 if they exist
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins can do everything on rack_reservations' AND tablename = 'rack_reservations') THEN
    DROP POLICY "Admins can do everything on rack_reservations" ON public.rack_reservations;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view their company reservations' AND tablename = 'rack_reservations') THEN
    DROP POLICY "Users can view their company reservations" ON public.rack_reservations;
  END IF;
END$$;

-- Re-create policies
CREATE POLICY "Admins full access"
  ON public.rack_reservations
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_users au
      WHERE au.user_id = (SELECT auth.uid())
        AND au.is_active = true
    )
    AND lower(split_part((auth.jwt()->>'email')::text, '@', 2)) = 'mpsgroup.ca'
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.admin_users au
      WHERE au.user_id = (SELECT auth.uid())
        AND au.is_active = true
    )
    AND lower(split_part((auth.jwt()->>'email')::text, '@', 2)) = 'mpsgroup.ca'
  );

CREATE POLICY "Users read company reservations"
  ON public.rack_reservations
  FOR SELECT
  TO authenticated
  USING (
    company_id = public.company_id_from_email_domain()
  );

-- NEW: Disallow open-ended reservations for users
CREATE POLICY "Users insert company reservations"
  ON public.rack_reservations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id = public.company_id_from_email_domain()
    AND status = 'ACTIVE'
    AND end_date IS NOT NULL
  );

CREATE POLICY "Users update company reservations"
  ON public.rack_reservations
  FOR UPDATE
  TO authenticated
  USING (
    company_id = public.company_id_from_email_domain()
  )
  WITH CHECK (
    company_id = public.company_id_from_email_domain()
    AND status = 'ACTIVE'
    AND end_date IS NOT NULL
  );

CREATE POLICY "Users delete company reservations"
  ON public.rack_reservations
  FOR DELETE
  TO authenticated
  USING (
    company_id = public.company_id_from_email_domain()
    AND status = 'ACTIVE'
  );

-- 7) Helpful indexes for performance
CREATE INDEX IF NOT EXISTS idx_rack_reservations_active_dates
  ON public.rack_reservations (rack_id, start_date, end_date)
  WHERE status = 'ACTIVE';

CREATE UNIQUE INDEX IF NOT EXISTS uq_reservation_per_request_rack_active
  ON public.rack_reservations (rack_id, request_id)
  WHERE status = 'ACTIVE';

-- Validate constraints
ALTER TABLE public.rack_reservations VALIDATE CONSTRAINT reserved_non_negative;
ALTER TABLE public.rack_reservations VALIDATE CONSTRAINT rack_reservations_date_order;

COMMIT;
