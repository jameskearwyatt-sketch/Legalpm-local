-- Add email_signature column to user_settings table
ALTER TABLE public.user_settings
ADD COLUMN IF NOT EXISTS email_signature TEXT;