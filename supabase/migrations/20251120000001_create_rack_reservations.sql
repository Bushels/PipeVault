-- Create rack_reservations table
CREATE TABLE IF NOT EXISTS public.rack_reservations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rack_id TEXT NOT NULL REFERENCES public.racks(id) ON DELETE CASCADE,
    request_id UUID NOT NULL REFERENCES public.storage_requests(id) ON DELETE CASCADE,
    company_id UUID REFERENCES public.companies(id),
    start_date DATE NOT NULL,
    end_date DATE,
    reserved_joints INTEGER DEFAULT 0,
    reserved_meters NUMERIC DEFAULT 0,
    status TEXT DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'CANCELLED', 'COMPLETED')),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_rack_reservations_dates ON public.rack_reservations(rack_id, start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_rack_reservations_request ON public.rack_reservations(request_id);
CREATE INDEX IF NOT EXISTS idx_rack_reservations_company ON public.rack_reservations(company_id);

-- RLS Policies
ALTER TABLE public.rack_reservations ENABLE ROW LEVEL SECURITY;

-- Allow admins to do everything
CREATE POLICY "Admins can do everything on rack_reservations"
    ON public.rack_reservations
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.admin_users
            WHERE email = auth.jwt()->>'email'
        )
    );

-- Allow users to view their own reservations
CREATE POLICY "Users can view their company reservations"
    ON public.rack_reservations
    FOR SELECT
    TO authenticated
    USING (
        company_id IN (
            SELECT company_id FROM public.users
            WHERE id = auth.uid()
        )
    );
