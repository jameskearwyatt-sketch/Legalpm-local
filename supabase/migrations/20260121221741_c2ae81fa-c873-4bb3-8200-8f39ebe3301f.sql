-- Add rate modifier and pricing model columns to matters table
ALTER TABLE public.matters
ADD COLUMN rate_modifier text,
ADD COLUMN rate_modifier_value numeric,
ADD COLUMN pricing_model text;

-- Add comments for documentation
COMMENT ON COLUMN public.matters.rate_modifier IS 'Rate modifier type: rack_rates, discounted_rates, blended_hourly_rate';
COMMENT ON COLUMN public.matters.rate_modifier_value IS 'Value for rate modifier - percentage for discounted, rate amount for blended';
COMMENT ON COLUMN public.matters.pricing_model IS 'Pricing model: fixed_fee, fixed_fee_by_phase, fee_cap, fee_collar, milestone_based, monthly_retainer';