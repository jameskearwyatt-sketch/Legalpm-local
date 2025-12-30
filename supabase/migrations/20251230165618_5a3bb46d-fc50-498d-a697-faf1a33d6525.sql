-- Add onboarding/compliance boolean columns to matters
ALTER TABLE public.matters 
ADD COLUMN aml_kyc_complete boolean NOT NULL DEFAULT false,
ADD COLUMN assignment_letter_signed boolean NOT NULL DEFAULT false,
ADD COLUMN matter_open boolean NOT NULL DEFAULT false;