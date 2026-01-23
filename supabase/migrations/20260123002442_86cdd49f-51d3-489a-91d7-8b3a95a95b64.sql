-- Add columns for email-company mismatch tracking
ALTER TABLE public.distribution_contacts
ADD COLUMN email_company_mismatch boolean NOT NULL DEFAULT false,
ADD COLUMN email_mismatch_dismissed boolean NOT NULL DEFAULT false;