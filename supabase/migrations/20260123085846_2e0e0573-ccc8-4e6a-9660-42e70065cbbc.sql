-- Add sent tracking columns to distribution_email_drafts
ALTER TABLE public.distribution_email_drafts 
ADD COLUMN IF NOT EXISTS was_sent boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS sent_date date,
ADD COLUMN IF NOT EXISTS sent_confirmed_at timestamp with time zone;