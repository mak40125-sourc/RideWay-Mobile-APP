-- KYC review & approval workflow (Driver KYC Review & Approval feature).
-- Safe to re-run: every statement is idempotent.

-- Add the NEEDS_CORRECTION state to the existing kyc_status enum.
ALTER TYPE kyc_status ADD VALUE IF NOT EXISTS 'needs_correction';

-- Track who/when performed the last KYC review on the driver row.
ALTER TABLE public.drivers
  ADD COLUMN IF NOT EXISTS kyc_reviewed_by TEXT,
  ADD COLUMN IF NOT EXISTS kyc_reviewed_at TIMESTAMPTZ;

-- Audit trail of every KYC decision.
CREATE TABLE IF NOT EXISTS public.driver_kyc_reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  driver_id UUID REFERENCES public.drivers(id) ON DELETE CASCADE,
  reviewer TEXT,
  action TEXT NOT NULL,
  previous_status kyc_status,
  new_status kyc_status,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_driver_kyc_reviews_driver ON public.driver_kyc_reviews(driver_id);
