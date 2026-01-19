-- Add default_rate_card column to user_settings
-- This stores the user's preferred default rates for new pricing proposals
ALTER TABLE public.user_settings
ADD COLUMN default_rate_card JSONB DEFAULT NULL;

-- Add a comment explaining the purpose
COMMENT ON COLUMN public.user_settings.default_rate_card IS 'User-defined default rate card (in team currency) for new pricing proposals. NULL uses system defaults.';