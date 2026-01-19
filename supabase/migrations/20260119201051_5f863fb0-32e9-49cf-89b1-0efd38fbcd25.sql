-- Add scope_assumptions column to pricing_proposals table
ALTER TABLE public.pricing_proposals 
ADD COLUMN scope_assumptions JSONB DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.pricing_proposals.scope_assumptions IS 'Stores scope assumptions for pricing proposals (time to completion, turns, who drafts, etc.)';