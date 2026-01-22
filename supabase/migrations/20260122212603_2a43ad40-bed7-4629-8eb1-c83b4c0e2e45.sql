-- Add new enrichment columns to distribution_contacts
ALTER TABLE public.distribution_contacts
ADD COLUMN IF NOT EXISTS email_status text,
ADD COLUMN IF NOT EXISTS sic_codes text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS naics_codes text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS company_keywords text[] DEFAULT '{}';