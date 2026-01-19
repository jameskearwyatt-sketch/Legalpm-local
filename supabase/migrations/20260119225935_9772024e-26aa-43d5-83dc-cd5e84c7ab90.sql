-- Add team_rate_currency column to pricing_proposals
-- This stores the user's local currency for expressing team rates
-- Defaults to the proposal's fee currency (so existing proposals work unchanged)
ALTER TABLE public.pricing_proposals
ADD COLUMN team_rate_currency TEXT DEFAULT NULL;

-- Add a comment explaining the purpose
COMMENT ON COLUMN public.pricing_proposals.team_rate_currency IS 'The currency in which team rates are expressed. If different from the fee currency (currency column), rates are converted using exchange rates. NULL defaults to fee currency.';
